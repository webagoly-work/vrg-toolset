// sessions.js — Munkamenetek (WP-50): the local Claude Code sessions of account A and B, and the ways to open one inside the VRG Asztal.
//   const s = createSessions({ roots: [{ account:'A', dir }, { account:'B', dir }] | () => [...], claudeterm, server, repo, fs?, now?, log? });
//   s.list()                                       → { ok, sessions: [{ account, session, title, project, branch, mtime, size, live }], cloud, roots }
//   s.resume({ account, session, fork?, remote? }) → claudeterm's { term, … } | { ok:false, err, hu }
//   s.teleport({ account })                        → claudeterm's reply (a Claude terminal in the repo with --teleport: the cloud picker)
//   s.canvas({ account, session })                 → the server reply { do:'web', url } of the Munkavászon, opened on that session
// Where the data is: Claude Code writes every session to <config>/projects/<project folder>/<session id>.jsonl. A = ~/.claude (the
// profile drops CLAUDE_CONFIG_DIR), B = <full>/home/claude-account-b, exactly as lib/pty.js starts them. Read only, never written.
// rootsFrom(env, defaults): VRG_SESSIONS_ROOTS="A=<abs dir>;B=<abs dir>" replaces them (tests only, CONTRACT §4.9, like VRG_CLAUDE_BIN).
// The page names an account and a session id, never a path; main finds the file and reads the folder (`cwd`) from the transcript.
// Nothing in a reply is a path: the project is the folder's last name, the cloud link is a fixed https URL.
// "Live": a transcript written in the last LIVE_MS is taken to be open in another window (the Claude app, another CLI). Folytatás then
// refuses (two processes would append to one transcript) and offers Másolat (--fork-session: a new id, the old file untouched).
'use strict';
const nodeFs = require('fs'), path = require('path');

const ACCOUNTS = ['A', 'B'];
const SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;   // Claude Code's ids are lowercase UUIDs
const MAX_LIST = 120;
const HEAD_BYTES = 256 * 1024;                                   // the title, folder and branch are in the first lines
const LIVE_MS = 2 * 60 * 1000;
const CLOUD_URL = 'https://claude.ai/code';
const REMOTE_PROMPT = '/remote-control';

const NOT_FOUND = { ok: false, err: 'not-found', hu: 'Nincs ilyen munkamenet.' };
const BAD = { ok: false, err: 'bad-request', hu: 'Érvénytelen munkamenet.' };

// the first lines of a transcript → { title, cwd, branch } (the first real prompt; tool results and <command> lines are not titles)
function headInfo(text) {
  let title = '', cwd = '', branch = '', summary = '';
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch (x) { continue; }
    if (!e || typeof e !== 'object') continue;
    if (!cwd && typeof e.cwd === 'string') cwd = e.cwd;
    if (!branch && typeof e.gitBranch === 'string' && e.gitBranch !== 'HEAD') branch = e.gitBranch;
    if (!summary && e.type === 'summary' && typeof e.summary === 'string') summary = e.summary;
    if (!title && e.type === 'user' && !e.isMeta && !e.isSidechain) {
      const c = e.message && e.message.content;
      const t = typeof c === 'string' ? c : Array.isArray(c) ? ((c.find(b => b && b.type === 'text') || {}).text || '') : '';
      if (t && !/^\s*</.test(t)) title = t;
    }
    if (title && cwd && branch) break;
  }
  const clean = s => Array.from(String(s).replace(/\s+/g, ' ').trim()).slice(0, 90).join('');
  return { title: clean(title || summary), cwd, branch: clean(branch).slice(0, 60) };
}

// a folder as the page may see it: its last name only
const folderName = p => String(p || '').split(/[\\/]/).filter(Boolean).slice(-1)[0] || '';

// the roots main uses: the test override when it is set and well-formed, else the defaults
function rootsFrom(env, defaults) {
  const v = env && env.VRG_SESSIONS_ROOTS;
  if (typeof v !== 'string' || !v) return defaults;
  const out = v.split(';').map(p => /^([AB])=(.+)$/.exec(p.trim())).filter(Boolean).map(m => ({ account: m[1], dir: m[2] }));
  return out.length && out.every(r => path.isAbsolute(r.dir)) ? out : defaults;
}

function createSessions({ roots = [], claudeterm, server, repo, fs = nodeFs, now = () => Date.now(), log = () => {} } = {}) {
  const clean = list => (Array.isArray(list) ? list : []).filter(r => r && ACCOUNTS.includes(r.account) && typeof r.dir === 'string' && path.isAbsolute(r.dir));
  const rootsNow = () => clean(typeof roots === 'function' ? roots() : roots);
  const heads = new Map();                                       // file → { m, info }: the first lines are read once per change

  const rootOf = account => rootsNow().find(r => r.account === account);
  const projectsOf = r => path.join(r.dir, 'projects');

  function readHead(file, mtime) {
    const c = heads.get(file);
    if (c && c.m === mtime) return c.info;
    let info = { title: '', cwd: '', branch: '' };
    try {
      const fd = fs.openSync(file, 'r');
      try { const buf = Buffer.alloc(HEAD_BYTES); const n = fs.readSync(fd, buf, 0, buf.length, 0); info = headInfo(buf.toString('utf8', 0, n)); }
      finally { fs.closeSync(fd); }
    } catch (e) { /* unreadable: no title */ }
    heads.set(file, { m: mtime, info });
    if (heads.size > 400) heads.delete(heads.keys().next().value);
    return info;
  }

  // every <projects>/<folder>/<uuid>.jsonl of every root, newest first (empty files and other names left out)
  function scan() {
    const out = [];
    for (const r of rootsNow()) {
      let dirs = [];
      try { dirs = fs.readdirSync(projectsOf(r), { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')); } catch (e) { continue; }
      for (const d of dirs) {
        let files = [];
        try { files = fs.readdirSync(path.join(projectsOf(r), d.name)); } catch (e) { continue; }
        for (const f of files) {
          const id = f.replace(/\.jsonl$/, '');
          if (id === f || !SESSION_RE.test(id)) continue;
          const file = path.join(projectsOf(r), d.name, f);
          let st; try { st = fs.statSync(file); } catch (e) { continue; }
          if (!st.isFile() || !st.size) continue;
          out.push({ account: r.account, session: id, file, mtime: st.mtimeMs, size: st.size });
        }
      }
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  }

  // account + session → the transcript and the folder it ran in, or a refusal
  function find(account, session) {
    if (!ACCOUNTS.includes(account) || typeof session !== 'string' || !SESSION_RE.test(session)) return BAD;
    const r = rootOf(account);
    if (!r) return NOT_FOUND;
    let dirs = [];
    try { dirs = fs.readdirSync(projectsOf(r), { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')); } catch (e) { return NOT_FOUND; }
    for (const d of dirs) {
      const file = path.join(projectsOf(r), d.name, session + '.jsonl');
      let st; try { st = fs.statSync(file); } catch (e) { continue; }
      if (!st.isFile()) continue;
      return { file, mtime: st.mtimeMs, info: readHead(file, st.mtimeMs) };
    }
    return NOT_FOUND;
  }

  const isLive = mtime => now() - mtime < LIVE_MS;
  const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };

  function list() {
    const sessions = scan().slice(0, MAX_LIST).map(s => {
      const info = readHead(s.file, s.mtime);
      return { account: s.account, session: s.session, title: info.title, project: folderName(info.cwd), branch: info.branch,
        mtime: s.mtime, size: s.size, live: isLive(s.mtime) };
    });
    return { ok: true, sessions, cloud: CLOUD_URL, roots: rootsNow().map(r => r.account), liveMs: LIVE_MS };
  }

  function resume({ account, session, fork, remote } = {}) {
    const f = find(account, session);
    if (f.ok === false) return f;
    if (!fork && isLive(f.mtime)) return { ok: false, err: 'live', hu: 'Ez a munkamenet most is fut egy másik ablakban. Nyiss róla másolatot, vagy zárd be a másikat.' };
    const cwd = f.info.cwd;
    if (!cwd || !path.isAbsolute(cwd) || !isDir(cwd)) return { ok: false, err: 'not-found', hu: 'A munkamenet mappája már nincs meg' + (cwd ? ': ' + folderName(cwd) : '.') };
    if (!claudeterm || !claudeterm.open) return { ok: false, err: 'error', hu: 'A terminál nem indult el.' };
    const extraArgs = ['--resume', session, ...(fork === true ? ['--fork-session'] : [])];
    log('sessions', 'resume', account, session, fork === true ? 'fork' : '', remote === true ? 'remote' : '');
    const deco = { origin: 'local', account, session: session.slice(0, 60), ...(f.info.title ? { title: f.info.title.slice(0, 80) } : {}) };   // WP-51 board labels
    return claudeterm.open({ account, cwd, extraArgs, deco, ...(remote === true ? { firstPrompt: REMOTE_PROMPT } : {}) });
  }

  function teleport({ account } = {}) {
    if (!ACCOUNTS.includes(account)) return BAD;
    if (typeof repo !== 'string' || !path.isAbsolute(repo)) return { ok: false, err: 'error', hu: 'A terminál nem indult el.' };
    if (!claudeterm || !claudeterm.open) return { ok: false, err: 'error', hu: 'A terminál nem indult el.' };
    log('sessions', 'teleport', account);
    return claudeterm.open({ account, cwd: repo, extraArgs: ['--teleport'], deco: { origin: 'local', account, title: 'Áthozva a felhőből' } });
  }

  async function canvas({ account, session } = {}) {
    const f = find(account, session);
    if (f.ok === false) return f;
    if (typeof server !== 'function') return { ok: false, err: 'error', hu: 'A Munkavászon nem érhető el.' };
    return server('munkavaszon', '/#s=' + session);
  }

  return { list, resume, teleport, canvas, find };
}

module.exports = { createSessions, rootsFrom, headInfo, folderName, SESSION_RE, LIVE_MS, CLOUD_URL, REMOTE_PROMPT, ACCOUNTS };
