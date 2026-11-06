// chat.js — "Claude oldalchat" engine (WP-23): headless `claude -p --output-format stream-json` with the account's own sign-in.
//   const chat = createChat({ spawn, execFile, env, repo, bin, claudeDirB, paths, emit, readFile, packText, keepText, platform, log });
//   chat.start({ account, prompt, attach, tools }) → { chat } | { ok:false, err, hu }      chat.follow(id, prompt)      chat.stop(id)      chat.list()
//   chat.history(id) → { msgs }   (DESK-Q63 B: with the setting chat.keepText on, every thread's text is saved in <userDir>\chats\<id>.json)
//   emit(type, data): chat.delta {chat,text} · chat.tool {chat,name,target?} (DESK-Q64 B: the file or pattern the tool works on, repo-relative) · chat.done {chat,session,cost?,turns?} · chat.error {chat,hu}
// The prompt goes on stdin (never argv). Env = the app env minus ELECTRON_* / NODE_OPTIONS, CLAUDE_CONFIG_DIR only for account B (as WP-14).
// Electron stays out: spawn, execFile and the file / pack readers are passed in, so node --test can load this file.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const MAX_TOTAL = 256 * 1024, MAX_FILE = 64 * 1024, MAX_CHATS = 100;
const bad = hu => ({ ok: false, err: 'bad-request', hu });
const LOG_MAX = 512 * 1024, ID_RE = /^c[0-9a-f]{10}$/;
const clean = (s, n) => String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);

// the tool's target for the chat row: file_path / path / pattern from the tool input; a path inside the repo is shown repo-relative
function toolTarget(input, repo) {
  if (!input || typeof input !== 'object') return '';
  const v = [input.file_path, input.path, input.pattern].find(x => typeof x === 'string' && x);
  if (!v) return '';
  let s = v;
  if (repo && path.isAbsolute(s)) { const rel = path.relative(repo, s); if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) s = rel; }
  return clean(s, 200);
}
const LOGIN_RE = /login|authenticate|401/i;
const loginMsg = acc => `A(z) ${acc} fiók nincs bejelentkezve. Jelentkezz be egy Claude terminálban.`;

// the exe and its leading args: VRG_CLAUDE_BIN (tests; a .js runs through node) or the registry's claude
function binary({ env, bin }) {
  const o = env && env.VRG_CLAUDE_BIN;
  if (typeof o === 'string' && o && path.isAbsolute(o)) return /\.js$/i.test(o) ? { exe: process.execPath, lead: [o] } : { exe: o, lead: [] };
  const b = typeof bin === 'function' ? bin() : bin;
  return b ? { exe: b, lead: [] } : null;
}

function childEnv(env, account, claudeDirB) {
  const e = {};
  for (const k of Object.keys(env || {})) {
    if (/^ELECTRON_/i.test(k) || /^NODE_OPTIONS$/i.test(k)) continue;
    if (/^CLAUDE_CONFIG_DIR$/i.test(k)) continue;
    if (env[k] !== undefined) e[k] = env[k];
  }
  if (account === 'B' && claudeDirB) e.CLAUDE_CONFIG_DIR = claudeDirB;
  return e;
}

function createChat({ spawn, execFile, env = process.env, repo, bin, claudeDirB, paths, emit = () => {}, readFile, packText, keepText = () => false, platform = process.platform, log = () => {} }) {
  const threads = new Map();                                  // id → { id, account, session, title, at, tools, proc, stopped, ended }
  const file = () => path.join(paths.userDir(), 'chats.json');
  const logFile = id => (ID_RE.test(id) ? path.join(paths.userDir(), 'chats', id + '.json') : null);
  const keepOn = () => { try { return keepText() === true; } catch (e) { return false; } };
  const okMsg = m => m && ((m.who === 'user' && typeof m.text === 'string') || (m.who === 'assistant' && Array.isArray(m.parts)));
  const lastAnswer = t => { const a = t.log && t.log[t.log.length - 1]; return a && a.who === 'assistant' ? a : null; };

  // the thread's messages in the chat pane's own shape: { who:'user', text } | { who:'assistant', parts:[{ text } | { tool, target }] }
  function saveLog(t) {
    if (!keepOn() || !t.log || !t.log.length) return;
    const f = logFile(t.id); if (!f) return;
    let msgs = t.log;
    while (msgs.length > 2 && Buffer.byteLength(JSON.stringify(msgs), 'utf8') > LOG_MAX) msgs = msgs.slice(2);   // the oldest question + answer go first
    t.log = msgs;
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify({ msgs }), 'utf8'); fs.renameSync(f + '.tmp', f); }
    catch (e) { log('chat', 'chat text not written'); }
  }
  function readLog(id) {
    const f = logFile(id); if (!f) return [];
    try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j && j.msgs) ? j.msgs.filter(okMsg) : []; } catch (e) { return []; }
  }

  function readSaved() {
    try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); return Array.isArray(j) ? j.filter(c => c && typeof c.id === 'string') : []; }
    catch (e) { return []; }
  }
  function persist() {
    const keep = keepText() === true;
    const mem = [...threads.values()].map(t => ({ id: t.id, account: t.account, session: t.session || null, title: keep ? t.title : t.label, at: t.at }));
    const ids = new Set(mem.map(c => c.id));
    const all = [...mem, ...readSaved().filter(c => !ids.has(c.id))].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, MAX_CHATS);
    try { fs.writeFileSync(file(), JSON.stringify(all, null, 1), 'utf8'); } catch (e) { log('chat', 'chats.json not written'); }
  }

  // the stdin text: attachments first, then the prompt; total ≤ 256 KB
  async function compose(prompt, attach) {
    let out = '';
    const a = attach && typeof attach === 'object' ? attach : {};
    if (typeof a.text === 'string' && a.text) out += `<selection>${a.text}</selection>\n\n`;
    if (a.packId !== undefined) {
      const t = typeof packText === 'function' ? await packText(a.packId) : null;
      if (typeof t !== 'string') return bad('Nincs ilyen csomag.');
      out += `<context-pack>${t}</context-pack>\n\n`;
    }
    if (a.file !== undefined) {
      const f = typeof readFile === 'function' ? await readFile(a.file) : null;
      if (!f || typeof f.text !== 'string') return bad('A fájl nem olvasható szövegként.');
      out += `<file name="${String(f.name || 'file').replace(/["<>\r\n]/g, '_')}">${f.text.slice(0, MAX_FILE)}</file>\n\n`;
    }
    out += prompt;
    if (Buffer.byteLength(out, 'utf8') > MAX_TOTAL) return bad('A kérés túl hosszú.');
    return { text: out };
  }

  function finish(t, kind, data) {                            // exactly one terminal event per run
    if (t.ended) return;
    t.ended = true;
    if (kind === 'done') emit('chat.done', { chat: t.id, ...data }); else emit('chat.error', { chat: t.id, hu: data });
  }

  function onLine(t, line) {
    let m; try { m = JSON.parse(line); } catch (e) { return; }
    if (!m || typeof m !== 'object' || t.stopped) return;
    if (m.session_id && typeof m.session_id === 'string' && m.type !== 'result') t.session = t.session || m.session_id;
    if (m.type === 'assistant' && m.message && Array.isArray(m.message.content)) {
      for (const b of m.message.content) {
        if (!b) continue;
        const a = lastAnswer(t);
        if (b.type === 'text' && typeof b.text === 'string' && b.text) {
          emit('chat.delta', { chat: t.id, text: b.text });
          if (a) { const p = a.parts[a.parts.length - 1]; if (p && p.text !== undefined) p.text += b.text; else a.parts.push({ text: b.text }); }
        } else if (b.type === 'tool_use' && typeof b.name === 'string') {
          const target = toolTarget(b.input, repo);
          emit('chat.tool', target ? { chat: t.id, name: b.name, target } : { chat: t.id, name: b.name });
          if (a) a.parts.push(target ? { tool: clean(b.name, 40), target } : { tool: clean(b.name, 40) });
        }
      }
    } else if (m.type === 'result') {
      if (typeof m.session_id === 'string') t.session = m.session_id;
      if (m.is_error) return finish(t, 'error', t.authFail ? loginMsg(t.account) : 'A Claude hibát jelzett.');
      const d = { session: t.session || '' };
      if (typeof m.total_cost_usd === 'number') d.cost = m.total_cost_usd;
      if (typeof m.num_turns === 'number') d.turns = m.num_turns;
      t.at = new Date().toISOString();
      persist(); saveLog(t);
      finish(t, 'done', d);
    }
  }

  function run(t, text) {
    const b = binary({ env, bin });
    if (!b) return { ok: false, err: 'not-found', hu: 'A Claude Code nem található.' };
    const args = [...b.lead, '-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
      '--tools', t.tools === 'none' ? '' : 'Read,Grep,Glob', '--name', 'VRG oldalchat'];
    if (t.session) args.push('--resume', t.session);
    let p;
    try { p = spawn(b.exe, args, { cwd: repo, env: childEnv(env, t.account, claudeDirB), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (e) { return { ok: false, err: 'error', hu: 'A Claude Code nem indult el.' }; }
    t.proc = p; t.stopped = false; t.ended = false; t.authFail = false;
    let buf = '', err = '';
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) onLine(t, l); } });
    p.stderr.setEncoding('utf8');
    p.stderr.on('data', d => { err = (err + d).slice(-4000); if (LOGIN_RE.test(d)) t.authFail = true; });
    p.stdin.on('error', () => {});
    p.on('error', () => { if (t.proc === p) finish(t, 'error', 'A Claude Code nem indult el.'); });
    p.on('close', code => {
      if (t.proc !== p) return;
      t.proc = null;
      if (buf.trim()) onLine(t, buf.trim());
      if (t.ended || t.stopped) return;
      if (t.authFail || LOGIN_RE.test(err)) return finish(t, 'error', loginMsg(t.account));
      finish(t, 'error', code === 0 ? 'A válasz megszakadt.' : 'A Claude Code hibával állt le.');
    });
    p.stdin.end(text, 'utf8');                                 // the prompt goes on stdin, then stdin closes
    return null;
  }

  async function start({ account, prompt, attach, tools } = {}) {
    if (account !== 'A' && account !== 'B') return bad('Érvénytelen fiók.');
    if (typeof prompt !== 'string' || !prompt.trim()) return bad('Üres kérés.');
    const c = await compose(prompt, attach);
    if (!c.text) return c;
    const id = 'c' + crypto.randomBytes(5).toString('hex');
    const at = new Date().toISOString();
    const t = { id, account, session: '', title: prompt.replace(/\s+/g, ' ').trim().slice(0, 60), label: 'Beszélgetés ' + at.slice(0, 16).replace('T', ' '), at, tools: tools === 'none' ? 'none' : 'read', proc: null, stopped: false, ended: false };
    t.log = [{ who: 'user', text: prompt }, { who: 'assistant', parts: [] }];
    const r = run(t, c.text);
    if (r) return r;
    threads.set(id, t);
    persist();
    return { chat: id };
  }

  // a thread of an earlier run (chats.json) comes back to memory so it can continue: its session resumes, its saved text (if any) is its log
  function revive(id) {
    if (threads.has(id) || !ID_RE.test(String(id))) return threads.get(id);
    const c = readSaved().find(x => x.id === id);
    if (!c || typeof c.session !== 'string' || !c.session) return null;
    const t = { id, account: c.account === 'B' ? 'B' : 'A', session: c.session, title: String(c.title || ''), label: String(c.title || ''), at: c.at, tools: 'read', proc: null, stopped: false, ended: true, log: keepOn() ? readLog(id) : [] };
    threads.set(id, t);
    return t;
  }

  async function follow(id, prompt) {
    const t = revive(id);
    if (!t) return { ok: false, err: 'not-found', hu: 'Nincs ilyen beszélgetés.' };
    if (typeof prompt !== 'string' || !prompt.trim()) return bad('Üres kérés.');
    if (t.proc && !t.ended) return { ok: false, err: 'busy', hu: 'A válasz még készül.' };
    if (!t.session) return { ok: false, err: 'not-found', hu: 'A beszélgetés még nem folytatható.' };
    if (Buffer.byteLength(prompt, 'utf8') > MAX_TOTAL) return bad('A kérés túl hosszú.');
    if (!t.log) t.log = [];
    t.log.push({ who: 'user', text: prompt }, { who: 'assistant', parts: [] });
    return run(t, prompt) || {};
  }

  function stop(id) {
    const t = threads.get(id);
    if (!t || !t.proc) return { ok: false, err: 'not-found', hu: 'Nincs futó beszélgetés.' };
    const p = t.proc;
    t.stopped = true;
    if (platform === 'win32' && p.pid) {
      try { execFile('taskkill', ['/pid', String(p.pid), '/t', '/f'], { windowsHide: true }, () => {}); } catch (e) { try { p.kill(); } catch (e2) {} }
    } else { try { p.kill('SIGKILL'); } catch (e) {} }
    finish(t, 'error', 'Megállítva.');
    return {};
  }

  function list() {
    const keep = keepText() === true;
    const mem = [...threads.values()].map(t => ({ chat: t.id, account: t.account, title: keep ? t.title : t.label, session: t.session || null, at: t.at, running: !!t.proc }));
    const ids = new Set(mem.map(c => c.chat));
    const old = readSaved().filter(c => !ids.has(c.id)).map(c => ({ chat: c.id, account: c.account, title: c.title, session: c.session || null, at: c.at, running: false }));
    return { chats: [...mem, ...old].sort((a, b) => String(b.at).localeCompare(String(a.at))) };
  }

  // the saved text of a thread: memory first; from disk only while chat.keepText is on
  function history(id) {
    if (!ID_RE.test(String(id))) return bad('Érvénytelen beszélgetés.');
    const t = threads.get(id);
    if (t && t.log && t.log.length) return { msgs: t.log };
    return { msgs: keepOn() ? readLog(id) : [] };
  }

  return { start, follow, stop, list, history, killAll: () => { for (const t of threads.values()) if (t.proc) stop(t.id); } };
}

module.exports = { createChat, binary, childEnv, toolTarget, MAX_TOTAL, MAX_FILE, LOG_MAX };
