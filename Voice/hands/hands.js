// hands.js — WP-58 Kéz (hands): controlled actions in OTHER programs for the VRG Asztal's voice shell, through Windows UI Automation.
//   const h = createHands({ spawn, powershell, policy, ownPids, log, now, append?, script?, timeoutMs?, rules? });
//   await h.plan({ verb, target?, role?, arg?, window? }) → { ok:true, plan } | { ok:false, err, hu, choices? }
//   await h.act(planId)  → { ok:true, say, verified, ms } | { ok:false, err, hu }
//   h.stop() (the kill switch) · h.log() (the last 50 actions, names only) · h.close()
// THE HARD RULE: spoken words never type into another program. There is no text entry here at all (act-host.ps1 has no value setting,
// no key or mouse synthesis, no copy buffer). Verbs: invoke, toggle, select, expand, collapse, scroll, focus-window, window
// (minimize / maximize / restore / close). Never acted on: the VRG Asztal's own windows ('own'), elevated windows ('elevated'), denied
// apps / titles (Voice/screen's policy), blocked apps and names (rules.json), password fields.
// A plan is bound to the window handle and the element's RuntimeId it found, expires after rules.planTtlMs, and `act` refuses when the
// window in front or the element changed ('stale'). One action at a time; `act` is never retried (a timed-out action has an UNKNOWN
// outcome: the helper is killed and the answer says so). stop() cancels the pending plan and kills an in-flight action at once.
'use strict';
const path = require('path');
const { policyCheck, DEFAULT_POLICY, appName } = require('../screen/screen.js');

const RULES = require('./rules.json');
const VERBS = ['invoke', 'toggle', 'select', 'expand', 'collapse', 'scroll', 'focus-window', 'window'];
const ROLES = { button: ['Button', 'SplitButton'], checkbox: ['CheckBox', 'RadioButton'], tab: ['TabItem'], menuitem: ['MenuItem'], link: ['Hyperlink'], listitem: ['ListItem', 'TreeItem', 'DataItem'], window: ['Window'] };
const SCROLL_ARGS = ['up', 'down', 'page-up', 'page-down', 'top', 'bottom'];
const WINDOW_ARGS = ['minimize', 'maximize', 'restore', 'close'];
const NEED_PATTERN = { invoke: ['invoke', 'select'], toggle: ['toggle'], select: ['select'], expand: ['expand'], collapse: ['expand'], scroll: ['scroll'] };
const MAX_LOG = 50;

// ------------------------------------------------------------ words (accent folding and a light Hungarian stem, as Prefilter does)
const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase();
const SUF = ['bol', 'rol', 'tol', 'ban', 'ben', 'nak', 'nek', 'val', 'vel', 'hoz', 'hez', 'hoz', 'ra', 're', 'ba', 'be', 'on', 'en', 'ot', 'at', 'et', 'ok', 'ek', 'ak', 'ig', 'nal', 'nel'];
// one folded word → its stem: up to two endings off ("mentésre" → "mentes"), never shorter than 3 letters; words with digits stay whole
function stem(w) {
  let s = String(w || '');
  if (/\d/.test(s)) return s;
  for (let round = 0; round < 2; round++) {
    const suf = SUF.find(x => s.length - x.length >= 3 && s.endsWith(x));
    if (suf) { s = s.slice(0, -suf.length); continue; }
    if (s.length >= 5 && /[tkn]$/.test(s)) { s = s.slice(0, -1); continue; }
    break;
  }
  return s;
}
const words = s => fold(s).replace(/-(?:ot|at|et|t|ra|re|ba|be|on|en|nak|nek|val|vel|hoz|hez|ig)\b/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
// edit distance, for misrecognitions ("bögészőt" ~ "böngészőt")
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// two words alike: equal stems, one stem the other's prefix (≥ 3 letters), or close by edit distance
function wordSim(a, b) {
  if (a === b) return 1;
  const sa = stem(a), sb = stem(b);
  if (sa === sb) return 0.95;
  const short = sa.length <= sb.length ? sa : sb, long = short === sa ? sb : sa;
  if (short.length >= 3 && long.startsWith(short)) return 0.9 - Math.min(0.2, (long.length - short.length) * 0.03);
  const d = lev(sa, sb), L = Math.max(sa.length, sb.length);
  const s = 1 - d / L;
  return L >= 4 && s >= 0.7 ? s * 0.9 : 0;
}

// the spoken phrase → { words, role?, ordinal? }: command verbs, articles and role words are not part of a name
const FILLER = new Set(['kattints', 'kattintsd', 'katt', 'klikk', 'klikkelj', 'nyomd', 'nyomj', 'meg', 'ra', 're', 'nyisd', 'nyiss', 'valts', 'valtsd', 'menj', 'lepj',
  'pipald', 'pipa', 'jelold', 'be', 'ki', 'kapcsold', 'valaszd', 'valassz', 'zard', 'csukd', 'nyisd', 'gorgess', 'gorgesd', 'tekerj', 'hozd', 'elore', 'mutasd',
  'a', 'az', 'egy', 'ezt', 'azt', 'ez', 'ezen', 'erre', 'arra', 'gomb', 'gombot', 'gombra', 'gombjat', 'ful', 'fulre', 'fulet', 'menu', 'menupont', 'menupontot', 'link', 'linkre',
  'hivatkozas', 'hivatkozasra', 'jelolo', 'jelolonegyzet', 'listaelem', 'elem', 'elemet', 'ablak', 'ablakot', 'ablakra', 'programra', 'program', 'programot', 'kerlek', 'legyszi',
  'click', 'press', 'push', 'hit', 'tap', 'the', 'on', 'button', 'tab', 'menu', 'item', 'link', 'checkbox', 'box', 'check', 'tick', 'select', 'choose', 'open', 'switch', 'to',
  'go', 'please', 'this', 'that', 'window', 'app', 'expand', 'collapse', 'scroll', 'close', 'focus', 'kinyit', 'kinyitod', 'lenyit', 'osszecsuk', 'ra']);
const ROLE_WORDS = { gomb: 'button', gombot: 'button', gombra: 'button', button: 'button', ful: 'tab', fulre: 'tab', fulet: 'tab', tab: 'tab', menu: 'menuitem', menupont: 'menuitem', menupontot: 'menuitem',
  link: 'link', linkre: 'link', hivatkozas: 'link', hivatkozasra: 'link', jelolo: 'checkbox', jelolonegyzet: 'checkbox', pipald: 'checkbox', pipa: 'checkbox', checkbox: 'checkbox', tick: 'checkbox',
  listaelem: 'listitem', ablak: 'window', ablakot: 'window', ablakra: 'window', window: 'window' };
const ORDINALS = { elso: 1, elsot: 1, elsore: 1, first: 1, masodik: 2, masodikat: 2, masodikra: 2, second: 2, harmadik: 3, harmadikat: 3, harmadikra: 3, third: 3,
  negyedik: 4, negyediket: 4, fourth: 4, utolso: -1, utolsot: -1, utolsora: -1, last: -1 };
function parsePhrase(spoken) {
  const ws = words(spoken);
  let role = '', ordinal = 0;
  const keep = [];
  for (const w of ws) {
    if (ORDINALS[w] !== undefined) { ordinal = ORDINALS[w]; continue; }
    const r = ROLE_WORDS[w] || ROLE_WORDS[stem(w)];
    if (r && !role) role = r;
    if (FILLER.has(w) || FILLER.has(stem(w))) continue;   // 'menut' -> 'menu', 'gombot' -> 'gomb'
    keep.push(w);
  }
  return { words: keep, role, ordinal };
}

// candidates [{ name, role, ... }] + what was said → { ok:true, item, score } | { ok:false, err:'ambiguous', choices } | { ok:false, err:'not-found' }
// opts.role: the role asked for (a role list key: 'button', 'tab' …); a matching role gets a small bonus, an ordinal counts within it
function matchTarget(candidates, spoken, opts = {}) {
  const list = (Array.isArray(candidates) ? candidates : []).filter(c => c && typeof c.name === 'string');
  const p = parsePhrase(spoken);
  const role = opts.role || p.role;
  const inRole = c => !role || (ROLES[role] || []).includes(c.role);
  if (p.ordinal && !p.words.length) {
    const pool = list.filter(inRole);
    const it = p.ordinal === -1 ? pool[pool.length - 1] : pool[p.ordinal - 1];
    return it ? { ok: true, item: it, score: 1 } : { ok: false, err: 'not-found' };
  }
  if (!p.words.length) return { ok: false, err: 'not-found' };
  const said = p.words.join(' ');
  const scored = [];
  for (const c of list) {
    const nw = words(c.name);
    if (!nw.length) continue;
    const name = nw.join(' ');
    let s;
    if (name === said) s = 1;
    else {
      // every spoken word must find a name word; a name with many extra words scores a little lower
      let sum = 0, all = true;
      for (const w of p.words) { const best = Math.max(0, ...nw.map(x => wordSim(w, x))); if (best < 0.6) { all = false; break; } sum += best; }
      if (!all) continue;
      s = (sum / p.words.length) * (1 - Math.min(0.25, Math.max(0, nw.length - p.words.length) * 0.07));
    }
    if (role && inRole(c)) s += 0.05;
    if (c.off) s -= 0.1;
    scored.push({ c, s: Math.min(1, s) });
  }
  scored.sort((a, b) => b.s - a.s);
  if (!scored.length || scored[0].s < 0.6) return { ok: false, err: 'not-found' };
  if (p.ordinal) {
    const same = scored.filter(x => x.s >= scored[0].s - 0.1).map(x => x.c);
    const it = p.ordinal === -1 ? same[same.length - 1] : same[p.ordinal - 1];
    if (it) return { ok: true, item: it, score: scored[0].s };
  }
  const close = scored.filter(x => x.s >= scored[0].s - 0.06 && fold(x.c.name) !== fold(scored[0].c.name));
  if (close.length && scored[0].s < 1) {
    const names = [...new Set([scored[0], ...close].map(x => x.c.name))].slice(0, 3);
    if (names.length > 1) return { ok: false, err: 'ambiguous', choices: names };
  }
  return { ok: true, item: scored[0].c, score: scored[0].s };
}

// ------------------------------------------------------------ risk (rules.json)
const nameWords = s => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
// an entry blocks a name when its words start consecutive words of the name ('torl' → 'Kosár törlése'; 'visszaallit alap' → 'Visszaállítás alapra')
function blockedName(name, rules) {
  const ws = nameWords(name);
  for (const b of rules.blockedNames || []) {
    const parts = nameWords(b);
    if (!parts.length) continue;
    for (let i = 0; i + parts.length <= ws.length; i++) if (parts.every((p, k) => ws[i + k].startsWith(p))) return b;
  }
  return '';
}
function blockedApp(proc, rules) {
  const p = fold(proc).replace(/\.exe$/, '');
  if (!p) return '';
  if ((rules.blockedApps || []).map(fold).includes(p)) return p;
  for (const src of rules.blockedAppPatterns || []) { try { if (new RegExp(src, 'i').test(p)) return p; } catch (e) {} }
  return '';
}
// plan-like { verb, arg, app (process), own, elevated, target:{ name, role, pw } } → { risk, reason }
function classify(plan, rules = RULES) {
  const p = plan || {};
  if (p.own) return { risk: 'own', reason: 'a VRG Asztal saját ablaka' };
  if (p.elevated) return { risk: 'elevated', reason: 'rendszergazdaként fut' };
  const t = p.target || {};
  if (t.pw) return { risk: 'blocked', reason: 'jelszómező' };
  const app = blockedApp(p.app || p.process, rules);
  if (app) return { risk: 'blocked', reason: 'tiltott program: ' + app };
  const nm = t.name ? blockedName(t.name, rules) : '';
  if (nm) return { risk: 'blocked', reason: 'tiltott művelet: „' + t.name + '”' };
  const v = rules.verbs || {};
  let risk = v[p.verb];
  if (p.verb === 'window') risk = (v.window || {})[p.arg] || 'confirm';
  if (!risk) return { risk: 'blocked', reason: 'ismeretlen ige' };
  if (p.verb === 'invoke' && (rules.reversibleRoles || []).includes(t.role)) risk = 'reversible';
  return { risk, reason: '' };
}

// ------------------------------------------------------------ what the overlay says (≤ 6 words)
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const SCROLL_HU = { up: 'fel', down: 'le', 'page-up': 'egy oldalt fel', 'page-down': 'egy oldalt le', top: 'a tetejére', bottom: 'az aljára' };
const WINDOW_HU = { minimize: 'Kis méretre', maximize: 'Teljes méretre', restore: 'Eredeti méretre', close: 'Bezárjam' };
function sayFor(verb, arg, name, risk, app) {
  const n = clip(name, 28);
  const q = risk === 'confirm';
  switch (verb) {
    case 'invoke': return q ? 'Rákattintsak: ' + n + '?' : 'Kattintás: ' + n + '.';
    case 'toggle': return q ? 'Átkapcsoljam: ' + n + '?' : 'Átkapcsolás: ' + n + '.';
    case 'select': return 'Kiválasztás: ' + n + '.';
    case 'expand': return 'Kinyitás: ' + n + '.';
    case 'collapse': return 'Becsukás: ' + n + '.';
    case 'scroll': return 'Görgetés ' + (SCROLL_HU[arg] || 'le') + '.';
    case 'focus-window': return 'Előre: ' + clip(app || n, 24) + '.';
    case 'window': return arg === 'close' ? 'Bezárjam: ' + clip(app || n, 24) + '?' : (WINDOW_HU[arg] || 'Ablak') + ': ' + clip(app || n, 20) + '.';
    default: return n;
  }
}
const DONE_HU = { invoke: 'Kész', toggle: 'Átkapcsolva', select: 'Kiválasztva', expand: 'Kinyitva', collapse: 'Becsukva', scroll: 'Görgetve', 'focus-window': 'Előtérben', window: 'Kész' };

// ------------------------------------------------------------ the helper process (JSON lines). `do` is never retried.
function createHost({ spawn, powershell, script, log = () => {}, timeoutMs = 4000 }) {
  let proc = null, buf = '', seq = 0;
  const pending = new Map();
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
        let m; try { m = JSON.parse(line); } catch (e) { log('hands', 'bad line', line.slice(0, 120)); continue; }
        const q = pending.get(String(m.id));
        if (q) { pending.delete(String(m.id)); clearTimeout(q.timer); q.resolve(m); }
      }
    });
    if (p.stderr) p.stderr.on('data', d => log('hands', 'stderr', String(d).slice(0, 300)));
    p.on('exit', code => { if (proc === p) proc = null; failAll(Object.assign(new Error('helper exited ' + code), { code: 'crashed' }), p); });
    p.on('error', e => { if (proc === p) proc = null; failAll(Object.assign(new Error(String(e && e.message || e)), { code: 'spawn' }), p); });
  }
  function request(op, extra, ms) {
    if (!proc) start();
    const id = String(++seq);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); kill(); reject(Object.assign(new Error('timeout'), { code: 'timeout' })); }, ms || timeoutMs);
      pending.set(id, { resolve, reject, timer, proc });
      try { proc.stdin.write(JSON.stringify({ id, op, ...(extra || {}) }) + '\n'); }
      catch (e) { pending.delete(id); clearTimeout(timer); proc = null; reject(Object.assign(e, { code: 'crashed' })); }
    });
  }
  // reading ops get one retry on a crashed / hung helper; `do` never does (its outcome would be unknown)
  async function call(op, extra, { retry = true, ms } = {}) {
    try { return await request(op, extra, ms); }
    catch (e) {
      if (!retry || (e.code !== 'crashed' && e.code !== 'timeout')) throw e;
      log('hands', 'helper restart after', e.code);
      return request(op, extra, ms);
    }
  }
  // the kill switch: every waiting request fails with `code`, the process goes (a fresh one starts on the next call)
  function kill(code) {
    const p = proc; proc = null;
    if (code) failAll(Object.assign(new Error(code), { code }));
    if (p) { try { p.kill(); } catch (e) {} }
  }
  function close() { const p = proc; proc = null; failAll(Object.assign(new Error('closed'), { code: 'closed' })); if (p) { try { p.stdin.write('{"id":"0","op":"quit"}\n'); } catch (e) {} try { p.kill(); } catch (e) {} } }
  return { call, kill, close, running: () => !!proc };
}

// ------------------------------------------------------------ plan / act / stop / log
const ERR_HU = {
  denied: 'Ehhez a programhoz nem nyúlok.', 'not-found': 'Nem találom.', ambiguous: 'Melyikre gondolsz?', elevated: 'Rendszergazdaként fut; nem nyúlok hozzá.',
  blocked: 'Ezt nem csinálom meg.', own: 'Ez a VRG Asztal; azt a saját parancsaival kezelem.', unavailable: 'A vezérlő segéd nem érhető el.', 'bad-request': 'Érvénytelen kérés.',
  stale: 'Közben megváltozott az ablak; nem csináltam semmit.', expired: 'Lejárt; mondd újra.', stopped: 'Leállítva.', error: 'Nem sikerült.',
  unknown: 'Nem tudom, megtörtént-e: a segéd nem válaszolt.', busy: 'Egy művelet még fut.',
};
const fail = (err, extra) => ({ ok: false, err, hu: ERR_HU[err] || ERR_HU.error, ...(extra || {}) });

function createHands({ spawn, powershell, policy, ownPids, log = () => {}, now = () => Date.now(), append, script, timeoutMs, rules = RULES } = {}) {
  const host = createHost({ spawn, powershell, script: script || path.join(__dirname, 'act-host.ps1'), log, timeoutMs });
  const pol = () => { try { const p = typeof policy === 'function' ? policy() : policy; return p && typeof p === 'object' ? { ...DEFAULT_POLICY, ...p } : DEFAULT_POLICY; } catch (e) { return DEFAULT_POLICY; } };
  const own = () => { try { const v = typeof ownPids === 'function' ? ownPids() : ownPids; return Array.isArray(v) ? v.map(Number) : []; } catch (e) { return []; } };
  const TTL = Number(rules.planTtlMs) > 0 ? Number(rules.planTtlMs) : 20000;
  let pending = null, busy = false, seq = 0, stopped = 0;
  const history = [];
  function record(entry) {
    const e = { at: new Date(now()).toISOString(), ...entry };
    history.push(e); if (history.length > MAX_LOG) history.shift();
    if (typeof append === 'function') { try { append(e); } catch (x) {} }
  }
  const hostErr = e => (e && e.code === 'stopped' ? fail('stopped') : e && (e.code === 'spawn' || e.code === 'closed') ? fail('unavailable') : fail('unavailable'));

  // the window to work in: the foreground one, or a named top-level window (title words or app name)
  async function windowFor(name) {
    if (!name) return { hwnd: 0 };
    const w = await host.call('windows');
    if (!w || !w.ok) return { err: (w && w.err) || 'error' };
    const cands = (w.windows || []).map(x => ({ ...x, name: appName(x.process) + ' ' + x.title, role: 'Window' }));   // 'code' → 'VS Code'
    const m = matchTarget(cands, name, { role: 'window' });
    if (!m.ok) return { err: m.err, choices: m.choices ? m.choices.map(c => clip(c, 40)) : undefined };
    return { hwnd: m.item.hwnd, win: m.item };
  }

  async function plan(req = {}) {
    const verb = req.verb, arg = req.arg || '';
    if (!VERBS.includes(verb)) return fail('bad-request');
    if (verb === 'scroll' && arg && !SCROLL_ARGS.includes(arg)) return fail('bad-request');
    if (verb === 'window' && !WINDOW_ARGS.includes(arg)) return fail('bad-request');
    if (req.role && !ROLES[req.role]) return fail('bad-request');
    if (!['scroll', 'window', 'focus-window'].includes(verb) && !(typeof req.target === 'string' && req.target.trim())) return fail('bad-request');
    if (verb === 'focus-window' && !((req.window || req.target || '').trim())) return fail('bad-request');
    if (busy) return fail('busy');
    pending = null;
    try {
      // focus-window: a top-level window by name; it does not have to be in front
      if (verb === 'focus-window') {
        const w = await windowFor(req.window || req.target);
        if (w.err) return fail(w.err === 'ambiguous' ? 'ambiguous' : w.err === 'not-found' ? 'not-found' : 'unavailable', w.choices ? { choices: w.choices } : undefined);
        return finishPlan({ verb, arg: '', hwnd: w.hwnd, rid: '', fg: false, win: { pid: w.win.pid, process: w.win.process, title: w.win.title }, target: { name: w.win.title, role: 'Window' } });
      }
      const where = await windowFor(req.window);
      if (where.err) return fail(where.err === 'ambiguous' ? 'ambiguous' : where.err === 'not-found' ? 'not-found' : 'unavailable', where.choices ? { choices: where.choices } : undefined);
      const f = await host.call('find', { hwnd: where.hwnd || 0, maxNodes: 600, budgetMs: 1500 });
      if (!f || !f.ok) return fail(f && f.err === 'elevated' ? 'elevated' : f && f.err === 'no-window' ? 'not-found' : 'error');
      const win = f.win || {};
      // the policy first: a denied or own window is refused before anything in it is looked at
      const pc = policyCheck({ pid: win.pid, process: win.process, title: win.title }, pol(), own());
      if (pc.ok && pc.own) return fail('own');
      if (!pc.ok) return fail('denied');
      // a named window must be in front for anything but focus-window (the overlay brings it forward first)
      if (where.hwnd && Number(f.fg) !== Number(win.hwnd)) return fail('stale', { hu: 'Előbb hozd előre: „váltás ' + clip(win.title, 20) + '”.' });
      if (verb === 'window') {
        const rootItem = (f.items || []).find(i => i.role === 'Window' && (i.pat || []).includes('window')) || { rid: '', name: win.title, role: 'Window', pat: ['window'] };
        return finishPlan({ verb, arg, hwnd: win.hwnd, rid: rootItem.rid || '', fg: true, win, target: { name: win.title, role: 'Window' } });
      }
      const need = NEED_PATTERN[verb];
      let items = (f.items || []).filter(i => (i.pat || []).some(x => need.includes(x)) && i.role !== 'Window');
      let item;
      if (verb === 'scroll' && !(req.target && req.target.trim())) {
        // no target: the scrollable area with the keyboard focus, else the biggest one
        items = (f.items || []).filter(i => (i.pat || []).includes('scroll'));
        if (!items.length) return fail('not-found', { hu: 'Itt nincs mit görgetni.' });
        item = items.find(i => i.focus) || items.slice().sort((a, b) => (b.rect[2] * b.rect[3]) - (a.rect[2] * a.rect[3]))[0];
      } else {
        const m = matchTarget(items, req.target, { role: req.role });
        if (!m.ok) return fail(m.err, m.choices ? { choices: m.choices } : undefined);
        item = m.item;
      }
      if (item.enabled === false) return fail('not-found', { hu: 'Ez most nem elérhető: ' + clip(item.name, 30) + '.' });
      return finishPlan({ verb, arg: verb === 'scroll' ? (arg || 'down') : arg, hwnd: win.hwnd, rid: item.rid, fg: true, win, target: { name: item.name, role: item.role, pw: !!item.pw }, item });
    } catch (e) { return hostErr(e); }
  }

  function finishPlan({ verb, arg, hwnd, rid, fg, win, target, item }) {
    const pc = policyCheck({ pid: win.pid, process: win.process, title: win.title }, pol(), own());
    if (pc.ok && pc.own) return fail('own');
    if (!pc.ok) return fail('denied');
    const app = win.process || '';
    const c = classify({ verb, arg, app, own: false, elevated: false, target }, rules);
    if (c.risk === 'blocked') { record({ verb, app, target: clip(verb === 'window' || verb === 'focus-window' ? appName(app) : target.name, 60), risk: 'blocked', ok: false, err: 'blocked' }); return fail('blocked', { hu: 'Ezt nem csinálom meg: ' + c.reason + '.' }); }
    const id = 'k' + (++seq);
    const p = {
      id, verb, arg, app, title: clip(win.title, 80), target: { name: clip(target.name, 80), role: target.role || '' }, risk: c.risk,
      // window verbs name the program ("Bezárjam: VS Code?"), not its long title
      say: sayFor(verb, arg, target.name, c.risk, appName(app) || win.title),
      detail: clip((win.title || app) + (item && item.aid ? ' · ' + item.aid : ''), 120), expires: now() + TTL,
    };
    pending = { ...p, hwnd, rid, fg, before: item ? { toggle: item.toggle, expand: item.expand, selected: item.selected, vscroll: item.vscroll } : null };
    return { ok: true, plan: p };
  }

  // did the action do what it should? true / false when a re-read can tell, null when it cannot (a plain click)
  function verify(verb, arg, r, plan) {
    const b = r.before || {}, a = r.after || {};
    switch (verb) {
      case 'toggle': return a.exists === false ? null : (a.toggle && b.toggle ? a.toggle !== b.toggle : null);
      case 'select': return a.exists === false ? null : a.selected === true;
      case 'expand': return a.exists === false ? null : a.expand === 'expanded';
      case 'collapse': return a.exists === false ? null : a.expand === 'collapsed';
      case 'scroll': return typeof a.vscroll === 'number' && typeof b.vscroll === 'number' && b.vscroll >= 0 ? a.vscroll !== b.vscroll || (arg.includes('down') || arg === 'bottom' ? b.vscroll >= 100 : b.vscroll <= 0) : null;
      case 'focus-window': return Number(a.fg) === Number(plan.hwnd);
      case 'window': return arg === 'close' ? a.exists === false : arg === 'minimize' ? a.window === 'minimized' : arg === 'maximize' ? a.window === 'maximized' : arg === 'restore' ? a.window === 'normal' : null;
      case 'invoke': return a.exists === false ? true : null;
      default: return null;
    }
  }

  async function act(planId) {
    const p = pending;
    if (!p || p.id !== planId) return fail('expired');
    if (now() > p.expires) { pending = null; return fail('expired'); }
    if (busy) return fail('busy');
    busy = true; pending = null;
    const mark = stopped;
    // window verbs are logged and answered by the program's name: a window title can carry a client's name
    const isWin = p.verb === 'window' || p.verb === 'focus-window';
    const label = isWin ? appName(p.app) : p.target.name;
    const entry = { verb: p.verb, app: p.app, target: clip(label, 60), risk: p.risk };
    try {
      const r = await host.call('do', { verb: p.verb, hwnd: p.hwnd, rid: p.rid, arg: p.arg, fg: p.fg }, { retry: false });
      if (stopped !== mark) { record({ ...entry, ok: false, err: 'stopped' }); return fail('stopped'); }
      if (!r || !r.ok) {
        const err = r && ['stale', 'gone'].includes(r.err) ? 'stale' : r && r.err === 'elevated' ? 'elevated' : r && r.err === 'password' ? 'blocked' : 'error';
        record({ ...entry, ok: false, err });
        return fail(err);
      }
      const verified = verify(p.verb, p.arg, r, p);
      record({ ...entry, ok: true, verified });
      return { ok: true, say: (DONE_HU[p.verb] || 'Kész') + ': ' + clip(label || p.app, 28) + '.', verified, ms: Number(r.ms) || 0 };
    } catch (e) {
      const err = e && e.code === 'stopped' ? 'stopped' : e && e.code === 'timeout' ? 'unknown' : 'error';
      record({ ...entry, ok: false, err });
      return fail(err);
    } finally { busy = false; }
  }

  // the kill switch: the pending plan goes, an action in flight is cut off (the helper is killed; a fresh one starts next time)
  function stop() {
    pending = null; stopped++;
    if (busy) host.kill('stopped');
    return { ok: true };
  }
  return { plan, act, stop, log: () => history.map(e => ({ ...e })), close: () => { pending = null; host.close(); }, pending: () => (pending ? { id: pending.id, expires: pending.expires } : null) };
}

module.exports = { createHands, classify, matchTarget, RULES, parsePhrase, stem, fold, wordSim, blockedName, blockedApp, sayFor, createHost, VERBS, ROLES };
