// screen.js — WP-56 Szem: what is on the screen, READ-ONLY and offline, for the voice overlay's "mi van a képernyőn?" questions.
//   const scr = createScreen({ spawn, powershell, capture, ocr, policy, ownPids, log, script?, timeoutMs? });
//   await scr.describe({ what: 'focused' | 'windows' | 'error' | 'read', maxNodes?, lang? })
//     → { ok:true, source:'uia'|'ocr'|'uia+ocr', app, title, own, say (≤ 8 words, Hungarian), detail (≤ 200 chars), lines (≤ 40, redacted), redacted, ms }
//     | { ok:false, err:'denied'|'disabled'|'no-window'|'unavailable'|'error'|'elevated', hu }
//   scr.close()
// Sources, in order: the UI Automation tree of the foreground window (uia-host.ps1, one long-running Windows PowerShell 5.1 process,
// JSON lines), then OCR of a screenshot (`capture()` → `ocr.recognize`) when the tree is thin (fewer than THIN named nodes: a canvas,
// a game, a remote desktop) or when "read" finds no text. Nothing is ever clicked, typed, focused or written to disk.
// Policy (`policy()` on every call, DEFAULT_POLICY when it returns nothing): `enabled:false` → disabled; a denied process or title
// pattern → denied (its title is not even said); a non-empty `allow` list → only those. The VRG Asztal's own windows (`ownPids()`)
// come back as `own:true` with no text: phase 2 describes them from the Desktop's own state.
// Redaction (`redact()`, on unless policy.redact === false) runs on the title, every line, `say` and `detail` before anything leaves
// this module: e-mails, phone numbers (Hungarian forms too), IBANs, HU bank account numbers (8-8 / 8-8-8), card numbers (Luhn),
// Hungarian tax numbers, TAJ, tax IDs, tokens in URLs, keys and "password: …" values.
'use strict';
const path = require('path');

const THIN = 5;
const MAX_LINES = 40, MAX_LINE = 200, MAX_DETAIL = 200;
const DEFAULT_POLICY = {
  enabled: true,
  allow: [],
  // password managers, the Windows credential / UAC prompts, remote-access tools
  deny: ['keepass', 'keepassxc', '1password', 'bitwarden', 'lastpass', 'dashlane', 'enpass', 'credentialuibroker', 'consent', 'logonui', 'anydesk', 'teamviewer'],
  // banking, passwords, client folders (title patterns, case-insensitive)
  denyTitles: ['jelsz[oó]', 'password', 'netbank', 'internetbank', '\\bbank\\b', 'otp\\s*bank', 'k&h', 'erste', 'raiffeisen', 'unicredit', 'cib bank', 'revolut', 'wise\\.com', 'paypal', 'ügyfélkapu', 'ugyfelkapu', 'jobs[\\\\/]', 'planner_projektek'],
  redact: true,
};

const APP = {
  chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', opera: 'Opera', zen: 'Zen', brave: 'Brave', code: 'VS Code', cursor: 'Cursor',
  explorer: 'Intéző', totalcmd: 'Total Commander', totalcmd64: 'Total Commander', winword: 'Word', excel: 'Excel', powerpnt: 'PowerPoint',
  outlook: 'Outlook', olk: 'Outlook', notepad: 'Jegyzettömb', 'notepad++': 'Notepad++', windowsterminal: 'Terminál', powershell: 'PowerShell',
  pwsh: 'PowerShell', cmd: 'Parancssor', acrord32: 'Acrobat', acrobat: 'Acrobat', sumatrapdf: 'SumatraPDF', vlc: 'VLC', claude: 'Claude',
  teams: 'Teams', 'ms-teams': 'Teams', slack: 'Slack', spotify: 'Spotify', mspaint: 'Paint', taskmgr: 'Feladatkezelő', 'vrg desktop': 'VRG Asztal',
};
const appName = proc => { const p = String(proc || '').toLowerCase().replace(/\.exe$/, ''); return APP[p] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Ismeretlen'); };
const words = (s, n) => { const w = String(s || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); return w.length > n ? w.slice(0, n).join(' ') + '…' : w.join(' '); };
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
// "Pull request #13 · webagoly-work/vrg-toolset - Google Chrome" → "Pull request #13 · webagoly-work/vrg-toolset"
function cleanTitle(title, app) {
  let t = String(title || '').trim();
  t = t.replace(/\s+[-–—]\s+(Google Chrome|Microsoft Edge|Mozilla Firefox|Visual Studio Code|Opera|Brave|Zen Browser)\s*$/i, '');
  if (app && t.toLowerCase().endsWith(' - ' + app.toLowerCase())) t = t.slice(0, -(app.length + 3));
  return t.trim();
}

// ------------------------------------------------------------ redaction
function luhn(digits) {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) { let d = digits.charCodeAt(i) - 48; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; }
  return sum % 10 === 0;
}
const RULES = [
  // keys and secrets first (they can contain digits the number rules would split)
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g, '[kulcs]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[kulcs]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[kulcs]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[kulcs]'],
  [/((?:password|jelsz[oó]|passwd|pwd|secret|api[_-]?key|token|pin)\s*[:=]\s*)\S+/gi, '$1[rejtve]'],
  [/([?&#](?:token|access_token|id_token|key|api_key|apikey|sig|signature|code|auth|password|pwd|secret|session|sid|ticket|vrg_s)=)[^\s&#]+/gi, '$1[rejtve]'],
  [/\b(?=[A-Za-z0-9+_-]{40,}={0,2})(?=[A-Za-z0-9+=_-]*[A-Z])(?=[A-Za-z0-9+=_-]*[a-z])(?=[A-Za-z0-9+=_-]*\d)[A-Za-z0-9+_-]{40,}={0,2}/g, '[kulcs]'],   // no '/': long repo paths are not keys
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-mail]'],
  [/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g, '[IBAN]'],
  [/\b\d{8}[- ]\d{8}(?:[- ]\d{8})?\b/g, '[számlaszám]'],
  [/\b\d{8}-\d-\d{2}\b/g, '[adószám]'],
  [/\b8\d{9}\b/g, '[adóazonosító]'],
  [/\b\d{3}[ -]\d{3}[ -]\d{3}\b/g, '[TAJ]'],
];
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;
const PHONE = /(?:\+36|\b06)[ \-/]?\(?\d{1,2}\)?[ \-/]?\d{3}[ \-]?\d{3,4}\b|\+\d{2,3}[ \-]?\d{1,4}(?:[ \-]?\d{2,4}){2,4}\b/g;
function redact(text) {
  let s = String(text == null ? '' : text), n = 0;
  for (const [re, rep] of RULES) s = s.replace(re, (...m) => { n++; return rep.replace('$1', m[1] || ''); });
  s = s.replace(CARD, m => { const d = m.replace(/\D/g, ''); if (d.length >= 13 && d.length <= 19 && luhn(d)) { n++; return '[kártyaszám]'; } return m; });
  s = s.replace(PHONE, m => { n++; return '[telefon]'; });
  return { text: s, n };
}

// ------------------------------------------------------------ policy
function compileTitles(list) {
  const out = [];
  for (const src of Array.isArray(list) ? list : []) { try { out.push(new RegExp(String(src), 'i')); } catch (e) {} }
  return out;
}
// win = { pid, process, title } → { ok:true, own } | { ok:false, err:'denied', reason }
function policyCheck(win, policy, ownPids) {
  const P = policy && typeof policy === 'object' ? policy : DEFAULT_POLICY;
  const proc = String(win && win.process || '').toLowerCase().replace(/\.exe$/, '');
  const own = Array.isArray(ownPids) && win && ownPids.includes(Number(win.pid));
  if (own) return { ok: true, own: true };
  const deny = (Array.isArray(P.deny) ? P.deny : []).map(x => String(x).toLowerCase().replace(/\.exe$/, ''));
  if (proc && deny.includes(proc)) return { ok: false, err: 'denied', reason: 'process' };
  const title = String(win && win.title || '');
  if (compileTitles(P.denyTitles).some(re => re.test(title))) return { ok: false, err: 'denied', reason: 'title' };
  const allow = (Array.isArray(P.allow) ? P.allow : []).map(x => String(x).toLowerCase().replace(/\.exe$/, ''));
  if (allow.length && !allow.includes(proc)) return { ok: false, err: 'denied', reason: 'not-allowed' };
  return { ok: true, own: false };
}

// ------------------------------------------------------------ the summary (pure)
const TEXT_ROLES = new Set(['Text', 'Document', 'Edit', 'Hyperlink', 'ListItem', 'Header', 'HeaderItem', 'TabItem', 'TreeItem', 'DataItem', 'MenuItem', 'Button', 'CheckBox', 'RadioButton', 'StatusBar', 'TitleBar', 'Group', 'Pane', 'Custom', 'ComboBox']);
const CHROME_ROLES = new Set(['TitleBar', 'MenuBar', 'ScrollBar', 'Thumb', 'Separator']);
const ROLE_HU = { Edit: 'szerkesztőmező', Document: 'dokumentum', Button: 'gomb', Hyperlink: 'hivatkozás', ListItem: 'listaelem', TreeItem: 'faelem', TabItem: 'fül', MenuItem: 'menüpont', ComboBox: 'legördülő', CheckBox: 'jelölőnégyzet', DataItem: 'cella', Text: 'szöveg' };
const ERR_RE = /\b(error|errors|failed|failure|fatal|exception|traceback|cannot|could not|not found|denied|hiba|hibás|hibát|sikertelen|elbukott|nem sikerült|nem található|megtagadva|kivétel)\b/i;
const NOT_ERR_RE = /\b(0 errors?|no errors?|0 hiba|nincs hiba|without errors?)\b/i;

function nodeText(n) {
  if (!n || n.pw) return '';
  const name = String(n.name || '').trim(), value = n.value == null ? '' : String(n.value).trim();
  if (value && name && value !== name && !value.startsWith(name)) return name + ': ' + value;
  return value || name;
}
// tree = { win:{ process, title }, focus?, selection?, nodes:[…] } | { windows:[…] }; what → { app, title, say, detail, lines, named }
function summarize(tree, what) {
  const t = tree || {};
  if (what === 'windows') {
    const ws = (Array.isArray(t.windows) ? t.windows : []).filter(w => w && String(w.title || '').trim());
    const apps = [...new Set(ws.map(w => appName(w.process)))];
    const lines = ws.slice(0, MAX_LINES).map(w => appName(w.process) + ' — ' + clip(cleanTitle(w.title, appName(w.process)), MAX_LINE - 20) + (w.min ? ' (kis méret)' : ''));
    const say = ws.length ? words(ws.length + ' ablak: ' + apps.slice(0, 3).join(', ') + (apps.length > 3 ? ' és mások' : ''), 8) : 'Nincs nyitott ablak.';
    return { app: '', title: '', say, detail: clip(lines.join('; '), MAX_DETAIL), lines, named: ws.length };
  }
  const win = t.win || {};
  const app = appName(win.process), title = cleanTitle(win.title, app);
  const nodes = (Array.isArray(t.nodes) ? t.nodes : []).filter(n => n && !n.pw);
  const visible = nodes.filter(n => !n.off && !CHROME_ROLES.has(n.role));
  const named = visible.filter(n => nodeText(n)).length;
  const seen = new Set(), texts = [];
  for (const n of visible) {
    if (!TEXT_ROLES.has(n.role)) continue;
    const s = clip(nodeText(n), MAX_LINE);
    if (!s || s.length < 2 || seen.has(s) || s === win.title) continue;
    seen.add(s); texts.push(s);
  }
  const focus = t.focus && !t.focus.pw ? t.focus : null;
  const focusLine = focus && nodeText(focus) ? 'Fókusz: ' + (ROLE_HU[focus.role] || focus.role) + ' „' + clip(nodeText(focus), 80) + '”' : '';
  if (what === 'error') {
    const hits = texts.filter(s => ERR_RE.test(s) && !NOT_ERR_RE.test(s));
    if (t.selection && ERR_RE.test(t.selection)) hits.unshift(clip(t.selection, MAX_LINE));
    return { app, title, say: hits.length ? words('Hiba: ' + hits[0].replace(/^(error|hiba)\s*[:：]\s*/i, ''), 8) : 'Nincs látható hiba.', detail: clip(hits.length ? hits.length + ' hibaszerű sor. ' + hits[0] : app + ': ' + title, MAX_DETAIL), lines: hits.slice(0, MAX_LINES), named };
  }
  if (what === 'read') {
    let text = t.selection && String(t.selection).trim() ? String(t.selection) : '';
    if (!text && focus) text = focus.value && String(focus.value).trim() ? String(focus.value) : '';
    if (!text) {
      const doc = visible.filter(n => (n.role === 'Document' || n.role === 'Edit') && n.value).sort((a, b) => String(b.value).length - String(a.value).length)[0];
      if (doc) text = String(doc.value);
    }
    if (!text) text = texts.filter(s => s.split(' ').length >= 4).join('\n');
    const lines = text.split(/\r?\n/).map(l => clip(l, MAX_LINE)).filter(Boolean).slice(0, MAX_LINES);
    return { app, title, say: lines.length ? words(lines.join(' '), 8) : 'Nincs felolvasható szöveg.', detail: clip(lines.join(' '), MAX_DETAIL), lines, named, empty: !lines.length };
  }
  // focused: the app and the title, then the focused element and the main texts
  return { app, title, say: words(app + (title ? ': ' + title : ''), 8), detail: clip([title, focusLine].filter(Boolean).join(' · ') || app, MAX_DETAIL), lines: texts.slice(0, MAX_LINES), named };
}

// ------------------------------------------------------------ the helper process
function createHost({ spawn, powershell, script, log = () => {}, timeoutMs = 3000 }) {
  let proc = null, buf = '', seq = 0;
  const pending = new Map();
  // fail the requests of one process (a late 'exit' of a killed, hung helper must not fail the retry on its successor); no process = all
  const failAll = (err, of) => { for (const [id, p] of [...pending]) { if (of && p.proc !== of) continue; pending.delete(id); clearTimeout(p.timer); p.reject(err); } };
  function start() {
    const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script];
    const p = spawn(powershell || 'powershell.exe', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    proc = p; buf = '';
    p.stdout.on('data', d => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch (e) { log('screen', 'bad line', line.slice(0, 120)); continue; }
        const q = pending.get(String(m.id));
        if (q) { pending.delete(String(m.id)); clearTimeout(q.timer); q.resolve(m); }
      }
    });
    if (p.stderr) p.stderr.on('data', d => log('screen', 'stderr', String(d).slice(0, 300)));
    p.on('exit', code => { if (proc === p) proc = null; failAll(Object.assign(new Error('helper exited ' + code), { code: 'crashed' }), p); });
    p.on('error', e => { if (proc === p) proc = null; failAll(Object.assign(new Error(String(e && e.message || e)), { code: 'spawn' }), p); });
  }
  function request(op, extra) {
    if (!proc) start();
    const id = String(++seq);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        const p = proc; proc = null;
        try { p && p.kill(); } catch (e) {}
        reject(Object.assign(new Error('timeout'), { code: 'timeout' }));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, proc });
      try { proc.stdin.write(JSON.stringify({ id, op, ...(extra || {}) }) + '\n'); }
      catch (e) { pending.delete(id); clearTimeout(timer); proc = null; reject(Object.assign(e, { code: 'crashed' })); }
    });
  }
  // one retry on a crashed / hung helper: a fresh process
  async function call(op, extra) {
    try { return await request(op, extra); }
    catch (e) {
      if (e.code !== 'crashed' && e.code !== 'timeout') throw e;
      log('screen', 'helper restart after', e.code);
      return request(op, extra);
    }
  }
  function close() { const p = proc; proc = null; failAll(Object.assign(new Error('closed'), { code: 'closed' })); if (p) { try { p.stdin.write('{"id":"0","op":"quit"}\n'); } catch (e) {} try { p.kill(); } catch (e) {} } }
  return { call, close, running: () => !!proc };
}

// ------------------------------------------------------------ the screen reader
function createScreen({ spawn, powershell, capture, ocr, policy, ownPids, log = () => {}, script, timeoutMs } = {}) {
  const host = createHost({ spawn, powershell, script: script || path.join(__dirname, 'uia-host.ps1'), log, timeoutMs });
  const pol = () => { try { const p = typeof policy === 'function' ? policy() : policy; return p && typeof p === 'object' ? { ...DEFAULT_POLICY, ...p } : DEFAULT_POLICY; } catch (e) { return DEFAULT_POLICY; } };
  const own = () => { try { const v = typeof ownPids === 'function' ? ownPids() : ownPids; return Array.isArray(v) ? v.map(Number) : []; } catch (e) { return []; } };
  const fail = (err, hu) => ({ ok: false, err, hu });
  const HU = { 'no-window': 'Nincs előtérben lévő ablak.', elevated: 'Ez az ablak rendszergazdaként fut; nem olvasom.', error: 'A képernyő nem olvasható.', unavailable: 'A képernyőolvasó nem érhető el ezen a gépen.' };

  async function ocrLines(P) {
    if (!ocr || typeof capture !== 'function') return null;
    const av = ocr.available ? ocr.available() : { ok: true };
    if (!av.ok) return null;
    const shot = await capture();
    if (!shot || !Buffer.isBuffer(shot.png)) return null;
    const r = await ocr.recognize(shot.png);
    return String(r.text || '').split(/\r?\n/).map(l => clip(l, MAX_LINE)).filter(l => l.length > 1).slice(0, MAX_LINES);
  }

  async function describe({ what = 'focused', maxNodes, lang } = {}) {
    const t0 = Date.now();
    if (!['focused', 'windows', 'error', 'read'].includes(what)) return fail('error', 'Ismeretlen kérés.');
    const P = pol();
    if (P.enabled === false) return fail('disabled', 'A képernyőolvasás ki van kapcsolva.');
    if (typeof spawn !== 'function') return fail('unavailable', HU.unavailable);
    let r;
    try { r = await host.call(what === 'windows' ? 'windows' : 'focused', what === 'windows' ? {} : { maxNodes: Math.min(Math.max(Number(maxNodes) || 400, 10), 1500) }); }
    catch (e) { log('screen', 'helper failed', e.code || '', String(e.message || e).slice(0, 120)); return fail(e.code === 'spawn' ? 'unavailable' : 'error', e.code === 'spawn' ? HU.unavailable : HU.error); }
    if (!r || r.ok === false) { const err = r && ['no-window', 'elevated'].includes(r.err) ? r.err : 'error'; return fail(err, HU[err] || HU.error); }
    const ownList = own();
    let sum, source = 'uia', app = '', title = '', isOwn = false;
    if (what === 'windows') {
      let hidden = 0;
      const ws = (r.windows || []).filter(w => { if (ownList.includes(Number(w.pid))) return true; const c = policyCheck(w, P, ownList); if (!c.ok) hidden++; return c.ok; })
        .map(w => (ownList.includes(Number(w.pid)) ? { ...w, process: 'vrg desktop' } : w));
      sum = summarize({ windows: ws }, 'windows');
      if (hidden) { sum.say = words(sum.say.replace(/…$/, '') + ` (+${hidden} rejtett)`, 10); sum.lines.push(hidden + ' ablak rejtve (szabály szerint).'); }
    } else {
      const c = policyCheck(r.win, P, ownList);
      if (!c.ok) return fail('denied', 'Ezt az ablakot nem olvasom (' + appName(r.win && r.win.process) + ').');
      if (c.own) return { ok: true, source: 'uia', app: 'VRG Asztal', title: '', own: true, say: 'A VRG Asztal.', detail: '', lines: [], redacted: 0, ms: Date.now() - t0 };
      sum = summarize(r, what);
      app = sum.app; title = sum.title;
      // a thin tree (a canvas, a game, a remote desktop) or "read" with nothing to read → OCR of a screenshot
      if (sum.named < THIN || (what === 'read' && sum.empty)) {
        let ol = null;
        try { ol = await ocrLines(P); } catch (e) { log('screen', 'ocr failed', String(e.message || e).slice(0, 120)); }
        if (ol && ol.length) {
          source = sum.lines.length ? 'uia+ocr' : 'ocr';
          const merged = [...sum.lines, ...ol.filter(l => !sum.lines.includes(l))].slice(0, MAX_LINES);
          if (what === 'error') {
            const hits = merged.filter(s => ERR_RE.test(s) && !NOT_ERR_RE.test(s));
            sum.lines = hits; sum.say = hits.length ? words('Hiba: ' + hits[0], 8) : 'Nincs látható hiba.'; sum.detail = clip(hits.length ? hits.length + ' hibaszerű sor. ' + hits[0] : sum.detail, MAX_DETAIL);
          } else if (what === 'read') { sum.lines = merged; sum.say = words(merged.join(' '), 8); sum.detail = clip(merged.join(' '), MAX_DETAIL); }
          else sum.lines = merged;
        }
      }
    }
    let n = 0;
    const R = s => { if (P.redact === false) return s; const x = redact(s); n += x.n; return x.text; };
    const out = { ok: true, source, app, title: R(title), own: isOwn, say: R(sum.say), detail: R(sum.detail), lines: sum.lines.map(R), redacted: 0, ms: Date.now() - t0 };
    out.redacted = n;
    void lang;
    return out;
  }

  return { describe, close: () => host.close(), running: () => host.running() };
}

module.exports = { createScreen, summarize, redact, policyCheck, DEFAULT_POLICY, appName, cleanTitle, createHost, luhn, THIN };
