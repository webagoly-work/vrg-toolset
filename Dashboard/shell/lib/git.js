// git.js — the Git panel's engine (WP-31, DESK-Q11 A): status, branches, worktrees, log, diff, a branch, a commit and a guarded push.
//   createGit({ execFile, git, repos, anonymise?, node?, anonymiseJs?, anonymiseMap?, openTerm?, fs? }) → { repos, status, branches, worktrees, log, diff, branch, commit, push }
//   repos()        → () => [{ name, path }]   the vrg-menu.json `repos`, paths expanded; the page only ever names the id (slug of the name)
//   anonymise(files, cwd) → Promise<{ ok, out }>   default: node <anonymiseJs> [--map <anonymiseMap>] --check <files>  (tools/anonymise.js; exit 1 = a client code
//   is in there, exit 2 = no map: both refuse the push. DESK-Q87 C: anonymiseMap() names the map, so a worktree checks against the main checkout's copy)
//   openTerm(cwd, cmdline) → { term, ... }   WP-15 terminal: a push that needs credentials runs there, so GCM's own prompt shows to the Founder
// Every call returns { ok:true, ... } or { ok:false, err, hu }. The page sends repo ids, file INDEXES of the last status reply, a branch name, a message:
// never a path. Git always runs through execFile with an argument array, GIT_TERMINAL_PROMPT=0, and never with --force / -f / --force-with-lease / +refspec.
'use strict';
const nodeFs = require('fs'), path = require('path');

const BRANCH_RE = /^[a-z0-9][a-z0-9._/-]{0,59}$/;
const PUSHABLE_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;
const MAIN_BRANCHES = ['main', 'master'];
const DIFF_MAX = 512 * 1024;
const AUTH_RE = /terminal prompts disabled|could not read (username|password)|authentication failed|permission denied|invalid username|http (401|403)|error: 40[13]/i;

const bad = hu => ({ ok: false, err: 'bad-request', hu });
const notFound = hu => ({ ok: false, err: 'not-found', hu });
const fail = (hu, err) => ({ ok: false, err: err || 'error', hu });
const slug = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// a refused argument is a bug, not a user error: nothing that could force a push or rewrite a ref ever reaches git
function assertSafe(args) {
  for (const a of args) {
    const s = String(a);
    if (/^(-f|--force.*|--mirror|--delete|--prune)$/.test(s) || /^\+/.test(s)) throw new Error('refused git argument: ' + s);
  }
}

// `git status --porcelain=v2 --branch -z` → { branch, upstream, ahead, behind, files:[{ path, orig?, x, y, kind }] }
// kind: new (untracked) · conflict · renamed · deleted · staged (index changed) · modified (work tree only)
function parseStatus(out) {
  const r = { branch: '', upstream: '', ahead: 0, behind: 0, files: [] };
  const parts = String(out || '').split('\0');
  for (let i = 0; i < parts.length; i++) {
    const l = parts[i];
    if (!l) continue;
    if (l.startsWith('# ')) {
      let m;
      if ((m = /^# branch\.head (.*)$/.exec(l))) r.branch = m[1] === '(detached)' ? 'HEAD' : m[1];
      else if ((m = /^# branch\.upstream (.*)$/.exec(l))) r.upstream = m[1];
      else if ((m = /^# branch\.ab \+(\d+) -(\d+)$/.exec(l))) { r.ahead = +m[1]; r.behind = +m[2]; }
    } else if (l[0] === '?') {
      r.files.push({ path: l.slice(2), x: '?', y: '?', kind: 'new' });
    } else if (l[0] === '1') {
      const f = l.split(' '), xy = f[1];
      r.files.push({ path: f.slice(8).join(' '), x: xy[0], y: xy[1], kind: kindOf(xy[0], xy[1]) });
    } else if (l[0] === '2') {
      const f = l.split(' '), xy = f[1];
      r.files.push({ path: f.slice(9).join(' '), orig: parts[++i] || '', x: xy[0], y: xy[1], kind: 'renamed' });
    } else if (l[0] === 'u') {
      const f = l.split(' ');
      r.files.push({ path: f.slice(10).join(' '), x: f[1][0], y: f[1][1], kind: 'conflict' });
    }
  }
  return r;
}
function kindOf(x, y) {
  if (x === 'D' || y === 'D') return 'deleted';
  if (x !== '.') return 'staged';
  return 'modified';
}

function parseWorktrees(out) {
  const list = [];
  let cur = null;
  for (const l of String(out || '').split(/\r?\n/)) {
    if (l.startsWith('worktree ')) { cur = { path: l.slice(9), head: '', branch: '', bare: false, detached: false }; list.push(cur); }
    else if (!cur) continue;
    else if (l.startsWith('HEAD ')) cur.head = l.slice(5, 12);
    else if (l.startsWith('branch ')) cur.branch = l.slice(7).replace(/^refs\/heads\//, '');
    else if (l === 'bare') cur.bare = true;
    else if (l === 'detached') cur.detached = true;
  }
  return list;
}

function createGit({ execFile, git, repos, anonymise, node, anonymiseJs, anonymiseMap = () => '', openTerm, fs = nodeFs, env = process.env }) {
  const last = new Map();                                            // repo id → { checkout, files } of the last status reply (fileIx indexes into this)

  function run(cwd, args, o = {}) {
    return new Promise(resolve => {
      try { assertSafe(args); } catch (e) { return resolve({ code: -1, out: '', err: e.message }); }
      execFile(git, ['-c', 'core.quotepath=false', ...args], {
        cwd, windowsHide: true, timeout: o.timeout || 30000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8',
        env: { ...env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
      }, (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(stdout || ''), err: String(stderr || (err && err.message) || '') }));
    });
  }
  const firstLine = s => String(s || '').trim().split('\n').filter(Boolean).pop() || '';

  const list = () => { try { return (repos() || []).filter(r => r && r.name && r.path).map(r => ({ id: slug(r.name), name: String(r.name), path: r.path })); } catch (e) { return []; } };
  const find = id => list().find(r => r.id === id);
  const need = id => { const r = find(id); return r ? { r } : { bad: notFound('Nincs ilyen repó.') }; };

  const defaultAnonymise = (files, cwd) => new Promise(resolve => {
    if (!node || !anonymiseJs) return resolve({ ok: false, out: 'anonymise.js not available' });
    let map = '';
    try { map = String(anonymiseMap() || ''); } catch (e) { map = ''; }
    execFile(node, [anonymiseJs, ...(map ? ['--map', map] : []), '--check', ...files], { cwd, windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024, encoding: 'utf8' },
      (err, stdout, stderr) => resolve({ ok: !err, out: (String(stdout || '') + String(stderr || '')).trim() }));
  });
  const check = anonymise || defaultAnonymise;

  const repoList = () => ({ ok: true, repos: list().map(r => ({ id: r.id, name: r.name })) });

  async function status(id) {
    const n = need(id); if (n.bad) return n.bad;
    const s = await run(n.r.path, ['status', '--porcelain=v2', '--branch', '-z']);
    if (s.code) return fail('A git státusz nem olvasható: ' + firstLine(s.err).slice(0, 200));
    const p = parseStatus(s.out);
    last.set(id, { checkout: n.r.path, files: p.files });
    return { ok: true, checkout: n.r.path, branch: p.branch, upstream: p.upstream, ahead: p.ahead, behind: p.behind, files: p.files.map(f => ({ path: f.path, x: f.x, y: f.y, kind: f.kind })) };
  }

  async function branches(id) {
    const n = need(id); if (n.bad) return n.bad;
    const r = await run(n.r.path, ['for-each-ref', '--format=%(refname:short)%1f%(HEAD)%1f%(upstream:short)', 'refs/heads']);
    if (r.code) return fail('Az ágak nem olvashatók.');
    const items = r.out.split(/\r?\n/).filter(Boolean).map(l => { const f = l.split('\x1f'); return { name: f[0], current: f[1] === '*', upstream: f[2] || '' }; });
    return { ok: true, branches: items };
  }

  async function worktrees(id) {
    const n = need(id); if (n.bad) return n.bad;
    const r = await run(n.r.path, ['worktree', 'list', '--porcelain']);
    if (r.code) return fail('A munkafák nem olvashatók.');
    return { ok: true, worktrees: parseWorktrees(r.out) };
  }

  async function log(id, count) {
    const n = need(id); if (n.bad) return n.bad;
    const c = Number.isInteger(count) && count >= 1 && count <= 200 ? count : null;
    if (!c) return bad('Érvénytelen darabszám.');
    const r = await run(n.r.path, ['log', '-n', String(c), '--format=%h%x1f%an%x1f%ad%x1f%s', '--date=short']);
    if (r.code) return { ok: true, log: [] };                       // an empty repo has no log yet
    return { ok: true, log: r.out.split(/\r?\n/).filter(Boolean).map(l => { const f = l.split('\x1f'); return { sha: f[0], author: f[1], date: f[2], subject: f[3] || '' }; }) };
  }

  const entry = (id, ix) => {
    const s = last.get(id);
    if (!s) return { bad: bad('Előbb kérd le a státuszt.') };
    if (!Number.isInteger(ix) || ix < 0 || ix >= s.files.length) return { bad: bad('Érvénytelen fájlsorszám.') };
    return { s, f: s.files[ix] };
  };

  async function diff(id, fileIx, cached) {
    const n = need(id); if (n.bad) return n.bad;
    const e = entry(id, fileIx); if (e.bad) return e.bad;
    let text;
    if (e.f.x === '?') {                                           // untracked: show the whole file as added lines
      try {
        const abs = path.join(n.r.path, e.f.path);
        const buf = fs.readFileSync(abs);
        text = String(buf.slice(0, DIFF_MAX + 1)).split('\n').map(l => '+' + l).join('\n');
      } catch (err) { return fail('A fájl nem olvasható.'); }
    } else {
      const r = await run(n.r.path, ['diff', ...(cached === true ? ['--cached'] : []), '--', e.f.path]);
      if (r.code) return fail('A különbség nem olvasható.');
      text = r.out;
    }
    const truncated = text.length > DIFF_MAX;
    return { ok: true, diff: truncated ? text.slice(0, DIFF_MAX) : text, truncated };
  }

  function validName(name) {
    if (typeof name !== 'string' || !BRANCH_RE.test(name)) return false;
    if (MAIN_BRANCHES.concat('head').includes(name.toLowerCase())) return false;
    return !/\.\.|\/\/|\/$|\.$|\.lock$|\/\./.test(name);
  }

  async function branch(id, name, doSwitch) {
    const n = need(id); if (n.bad) return n.bad;
    if (!validName(name)) return bad('Érvénytelen ágnév.');
    if (doSwitch === true) {
      const s = await run(n.r.path, ['status', '--porcelain']);
      if (s.code || s.out.trim()) return fail('Váltás előtt a munkafának tisztának kell lennie.', 'forbidden');
    }
    const c = await run(n.r.path, ['branch', name]);
    if (c.code) return fail('Az ág nem jött létre: ' + firstLine(c.err).slice(0, 200));
    if (doSwitch === true) {
      const w = await run(n.r.path, ['switch', name]);
      if (w.code) return fail('Az ág létrejött, de a váltás nem sikerült: ' + firstLine(w.err).slice(0, 200));
    }
    return { ok: true, name, switched: doSwitch === true };
  }

  async function commit(id, fileIxs, msg) {
    const n = need(id); if (n.bad) return n.bad;
    if (!Array.isArray(fileIxs) || !fileIxs.length || fileIxs.length > 2000) return bad('Nincs kijelölt fájl.');
    const m = typeof msg === 'string' ? msg.trim() : '';
    if (!m || m.length > 2000) return bad('A commit üzenet üres vagy túl hosszú.');
    const paths = new Set(), files = new Set(), origs = new Set();     // paths = what stays in the commit; files = chosen names; origs = old names of renames
    for (const ix of fileIxs) {
      const e = entry(id, ix); if (e.bad) return e.bad;
      if (e.f.kind === 'conflict') return fail('Ütköző fájl nem commitolható.', 'forbidden');
      paths.add(e.f.path); files.add(e.f.path);
      if (e.f.orig) { paths.add(e.f.orig); origs.add(e.f.orig); }
    }
    const ps = [...paths].filter(p => !origs.has(p) || files.has(p));   // a rename's old name is already gone from the work tree and the index: nothing to add
    const a = await run(n.r.path, ['add', '--', ...ps]);
    if (a.code) return fail('A fájlok hozzáadása nem sikerült: ' + firstLine(a.err).slice(0, 200));
    const st = await run(n.r.path, ['diff', '--cached', '--name-only', '--no-renames', '-z']);   // something else already staged is taken out of the index
    if (st.code) return fail('Az index nem olvasható.');                                         // (the work tree keeps it): the commit is exactly the chosen files
    const others = st.out.split('\0').filter(f => f && !paths.has(f));
    if (others.length) {
      const u = await run(n.r.path, ['reset', '-q', '--', ...others]);
      if (u.code) return fail('A nem kijelölt fájlok kivétele az indexből nem sikerült: ' + firstLine(u.err).slice(0, 200));
    }
    const c = await run(n.r.path, ['commit', '-m', m]);
    if (c.code) return fail('A commit nem sikerült: ' + firstLine(c.err || c.out).slice(0, 200));
    const h = await run(n.r.path, ['rev-parse', '--short', 'HEAD']);
    last.delete(id);
    return { ok: true, sha: h.out.trim() };
  }

  async function unpushedFiles(cwd) {
    const r = await run(cwd, ['log', '--name-only', '--pretty=format:', '--diff-filter=d', 'HEAD', '--not', '--remotes']);
    if (r.code) return null;
    const seen = new Set();
    for (const l of r.out.split(/\r?\n/)) if (l.trim()) seen.add(l.trim());
    return [...seen].filter(f => { try { return fs.existsSync(path.join(cwd, f)); } catch (e) { return false; } }).sort();
  }

  async function push(id, confirm) {
    const n = need(id); if (n.bad) return n.bad;
    const cwd = n.r.path;
    const b = await run(cwd, ['symbolic-ref', '--short', '-q', 'HEAD']);
    const br = b.out.trim();
    if (b.code || !br) return fail('Nincs aktív ág (detached HEAD).', 'forbidden');
    if (!PUSHABLE_RE.test(br)) return fail('Az ág neve nem tölthető fel innen.', 'forbidden');
    if (MAIN_BRANCHES.includes(br)) {
      if (confirm !== 'main PUSH') return fail('A main ágra csak a pontos „main PUSH” beírásával lehet feltölteni.', 'forbidden');
    } else if (confirm !== br) return fail('Írd be az ág nevét a megerősítéshez.', 'forbidden');

    const files = await unpushedFiles(cwd);
    if (files === null) return fail('A feltöltendő fájlok listája nem olvasható.');
    if (files.length) {
      const c = await check(files, cwd);
      if (!c || c.ok !== true) return fail('Ügyfélkód a változásokban: nem töltöm fel.' + (c && c.out ? ' ' + String(c.out).slice(0, 400) : ''), 'forbidden');
    }

    const p = await run(cwd, ['push', 'origin', br], { timeout: 60000 });
    if (!p.code) return { ok: true, pushed: true, branch: br, files: files.length };
    if (AUTH_RE.test(p.err) && typeof openTerm === 'function') {
      const t = openTerm(cwd, 'push origin ' + br);                 // GCM's prompt shows in the embedded terminal; the panel never sees credentials
      if (t && t.term) return { ok: true, pushed: false, term: t.term, branch: br, hu: 'A push a terminálban fut: ott add meg a bejelentkezést.' };
      return fail((t && t.hu) || 'A terminál nem indult el.');
    }
    return fail('A push nem sikerült: ' + firstLine(p.err).slice(0, 300));
  }

  return { repos: repoList, status, branches, worktrees, log, diff, branch, commit, push, _check: check };   // _check: unit tests only (WP-35a)
}

module.exports = { createGit, parseStatus, parseWorktrees, BRANCH_RE, MAIN_BRANCHES, DIFF_MAX };
