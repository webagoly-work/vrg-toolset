// VRG Stack — P · Próbák (tests and checks), S12 of research/STRINGS-PLAN.md (§5, STK-Q24: T → N → P → K → J): every
// test suite and check as a node, with its last result. P separates **built** from **verified**: a string that
// reaches C but no P is code nothing tests (DRIFT.md §12), and a suite whose last run failed, or ran before its code
// last changed, says so on the string.
//
//   suites(files, { menu, pkg }) → [suite]       pure: the repo's tracked files grouped into suites, each with how it runs
//     a test folder (test/, tests/, selftest/; fixtures/ left out)    one suite, its files inside it
//     a Gradle module's src/test/                                     one suite per module (runner gradle)
//     a check or selftest file outside a test folder (tools/check-*.js, …/selftest.js)   a suite of its own
//   How a suite runs: every START step that names a file inside it (that START key `runs` it), every CI workflow line
//   that does (.github/workflows/*.yml), else `npm test` of the package.json next to it when its test script points
//   into it · node --test its *.test.js · node its run.js · powershell its one .ps1 · gradle. A suite with none keeps
//   state 'no runner': tests that nothing runs (DRIFT.md §12).
//
//   layer({ suites, results, stale, read }) → { nodes, edges }
//     P:suite.<dir>   kind 'test suite' (or 'check'); state pass / fail / stale / unrun / skipped; t = the last run's day
//     P:<file>        each file of the suite (kind test / runner / e2e / selftest / golden / helper); its text carries
//                     what it requires, resolved into the repo, so the join links it to the folders it tests
//     N:start.<key> → P:suite.<dir>   rel 'runs'
//
//   run(suite, { repo, exec }) → record          runs one suite, parses its counts (TAP "# pass N", "N passed",
//                                               "✓ N"), and gives the record that data/probes.jsonl keeps
//   Results live in Stack/data/probes.jsonl (git-ignored: per PC, like events.jsonl), one JSON record per run;
//   `node stack.js probe [<suite words>|--all] [--list]` writes them.
'use strict';

const path = require('path');
const { resolver } = require('./entry');

const TESTDIR = /^(test|tests|selftest)$/;
const CHECKFILE = /(^|\/)(check-[\w-]+\.js|selftest\.js)$/;
const CODE = /\.(js|cjs|mjs|ps1|kt|py|html)$/;
const GOLDEN = /golden[^/]*\.json$/;

// the suite a tracked file belongs to, or null
function suiteOf(f) {
  if (/\/fixtures\//.test(f) || /^Vendor\//.test(f)) return null;
  const k = /^(.*?)\/src\/test\/(kotlin|java)\//.exec(f);
  if (k) return /\.(kt|java)$/.test(f) ? { dir: k[1], runner: 'gradle' } : null;
  if (!CODE.test(f) && !GOLDEN.test(f)) return null;
  const parts = f.split('/');
  for (let i = 0; i < parts.length - 1; i++) if (TESTDIR.test(parts[i])) return { dir: parts.slice(0, i + 1).join('/') };
  if (CHECKFILE.test(f)) return { dir: f, single: true };
  return null;
}

const kindOf = f => {
  const b = f.split('/').pop();
  if (GOLDEN.test(b)) return 'golden';
  if (/\.(test|spec)\.\w+$|Test\.kt$|Tests?\.java$/.test(b)) return 'test';
  if (/^check-/.test(b)) return 'check';
  if (/selftest/i.test(b)) return 'selftest';
  if (/e2e/i.test(b)) return 'e2e';
  if (/^run\.(js|cjs|mjs)$/.test(b)) return 'runner';
  return 'helper';
};

// suites(files, { menu, pkg(dir) → package.json object or null }) → [{ dir, files, runner, cmd, cwd, by, keys }]
function suites(files, { menu = null, pkg = () => null, workflows = {} } = {}) {
  const by = new Map();
  for (const f of files) {
    const s = suiteOf(f); if (!s) continue;
    const S = by.get(s.dir) || by.set(s.dir, { dir: s.dir, files: [], runner: s.runner || '', single: !!s.single, cmds: [], keys: [], ci: [] }).get(s.dir);
    S.files.push(f);
  }
  // START steps: every step's arguments, resolved into the repo, with its key path
  const where = resolver((menu && menu.paths) || {}), steps = [];
  const walk = (items, prefix) => { for (const it of items || []) { if (!it || !it.key) continue; const key = prefix ? prefix + '/' + it.key : it.key;
    const cwd = it.cwd ? where(it.cwd).repo : '';
    for (const st of it.steps || []) steps.push({ key, exe: String(st.exe || ''), args: (st.args || []).map(a => { const r = where(a); return r.repo != null ? r.repo : r.outside; }), cwd: cwd == null ? null : cwd });
    if (it.menu) walk(it.menu.items, key); } };
  if (menu && menu.start) for (const part of ['tools', 'projects', 'dev', 'bottom']) walk(menu.start[part], '');
  // CI: each workflow line that names a repo path, with the step's working-directory
  for (const [wf, txt] of Object.entries(workflows || {})) {
    // a job's `defaults: run: working-directory:` holds for its steps; a step's own working-directory overrides it
    let cwd = '', jobCwd = '', inSteps = false;
    for (const line of String(txt).split(/\r?\n/)) {
      const ind = line.search(/\S/);
      if (ind >= 0 && ind <= 2 && /:\s*$/.test(line)) { jobCwd = ''; inSteps = false; }   // a new job (or top-level key)
      if (/^\s*steps:\s*$/.test(line)) inSteps = true;
      if (/^\s*-\s/.test(line)) cwd = jobCwd;
      const w = /^\s*working-directory:\s*(\S+)/.exec(line);
      if (w) { const d = w[1].replace(/^\.\/?/, '').replace(/\/$/, ''); if (inSteps) cwd = d; else jobCwd = cwd = d; continue; }
      const args = line.replace(/^\s*(-\s*)?run:\s*\|?\s*/, '').trim().split(/\s+/);
      if (!/^(node|npm|npx|\.\/gradlew|gradlew|pwsh|powershell)$/.test(args[0])) continue;
      steps.push({ key: null, wf, exe: args[0].replace(/^\.\//, ''), args: args.slice(1), cwd });
    }
  }
  const inside = (p, dir) => p === dir || p.startsWith(dir + '/');
  const parent = d => d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '';

  for (const S of by.values()) {
    S.files.sort();
    const home = parent(S.dir);
    const p = pkg(home), script = p && p.scripts && p.scripts.test ? String(p.scripts.test) : '';
    const rel = home ? S.dir.slice(home.length + 1) : S.dir;
    const pkgHits = !!script && new RegExp('(^|[\\s"\'/])' + rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([/\\s"\']|$)').test(script);
    const push = (cmd, cwd, by) => { const k = JSON.stringify([cmd, cwd]); if (!S.cmds.some(c => JSON.stringify([c.cmd, c.cwd]) === k)) S.cmds.push({ cmd, cwd, by }); };
    const exeName = e => /\{node\}/.test(e) ? 'node' : /\{npm\}/.test(e) ? 'npm' : e.replace(/^.*[\\/]/, '').replace(/\.(exe|bat|cmd)$/i, '');
    // 1. START steps and CI lines that name a file inside the suite, or `npm test` where package.json points into it
    for (const st of steps) {
      const at = a => path.posix.normalize(path.posix.join(st.cwd || '.', a.replace(/\\/g, '/')));
      const named = st.args.some(a => inside(a.replace(/^\.\//, ''), S.dir) || (st.cwd && inside(at(a), S.dir)));
      const npm = exeName(st.exe) === 'npm' && st.args[0] === 'test' && (st.cwd || '') === home && pkgHits;
      const gradle = S.runner === 'gradle' && /gradlew$/.test(exeName(st.exe)) && st.args.some(a => a === `:${S.dir.split('/').pop()}:test`);
      if (!(named || npm || gradle)) continue;
      if (st.key && !S.keys.includes(st.key)) S.keys.push(st.key);
      if (st.wf && !S.ci.includes(st.wf)) S.ci.push(st.wf);
      const cmd = gradle ? ['gradlew', `:${S.dir.split('/').pop()}:test`] : [exeName(st.exe), ...st.args];
      push(cmd, st.cwd || '', st.key ? 'start ' + st.key : 'ci ' + st.wf.split('/').pop());
    }
    // 2. package.json, 3. the file pattern
    if (!S.cmds.length && pkgHits) push(['npm', 'test'], home, 'package.json');
    if (!S.cmds.length && S.runner !== 'gradle') {
      const tests = S.files.filter(f => /\.test\.(js|cjs|mjs)$/.test(f)), runjs = S.files.find(f => /\/run\.(js|cjs|mjs)$/.test(f)), ps1 = S.files.filter(f => /\.ps1$/.test(f));
      if (S.single && /\.js$/.test(S.dir)) push(['node', S.dir], '', 'file');
      else if (tests.length) push(['node', '--test', ...tests], '', 'node --test');
      else if (runjs) push(['node', runjs], '', 'run.js');
      else if (ps1.length === 1) push(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1[0]], '', 'ps1');
    }
    if (!S.cmds.length && S.runner === 'gradle') {
      const m = /^(.*\/android)\/([^/]+)$/.exec(S.dir);
      if (m) push(['gradlew', `:${m[2]}:test`], m[1], 'gradle');
    }
    const first = S.cmds[0] && S.cmds[0].cmd[0];
    S.runner = S.runner || (!first ? '' : /^(powershell|pwsh)$/.test(first) ? 'powershell' : first === 'npm' ? 'npm' : 'node');
  }
  return [...by.values()].sort((a, b) => (a.dir < b.dir ? -1 : 1));
}

// what a test file requires, resolved into the repo (relative requires and imports only)
function requires(file, src, has = () => true) {
  const out = new Set(), dir = path.posix.dirname(file);
  const rx = /(?:require\(\s*|import\s*\(\s*|from\s+|import\s+)['"](\.{1,2}\/[^'"]+)['"]|-File\s+["']?([^"'\s]+\.ps1)/g;
  let m;
  while ((m = rx.exec(src || ''))) {
    const r = m[1] ? path.posix.normalize(path.posix.join(dir, m[1])) : String(m[2]).replace(/\\/g, '/').replace(/^.*?\$PSScriptRoot\/?/, dir + '/');
    if (r.startsWith('..')) continue;
    const hit = [r, r + '.js', r + '.cjs', r + '.mjs', r + '/index.js'].find(has);
    out.add(hit || r);
  }
  return [...out].sort();
}

const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const lastBy = results => { const m = new Map(); for (const r of results || []) if (r && r.suite && (!m.has(r.suite) || String(r.at) >= String(m.get(r.suite).at))) m.set(r.suite, r); return m; };

// stale(dir, record) → true when the suite's code changed after the record's commit (the adapter asks git)
function layer({ suites: list = [], results = [], stale = () => false, read = () => '', has = () => true } = {}) {
  const nodes = [], edges = [], last = lastBy(results);
  for (const S of list) {
    const r = last.get(S.dir) || null, id = 'P:suite.' + S.dir;
    const isCheck = S.single || S.files.every(f => kindOf(f) === 'check');
    const cmdText = S.cmds.map(c => c.cmd.join(' ')).join(' && ');
    let state = !S.cmds.length ? 'no runner' : !r ? 'unrun' : r.skipped ? 'skipped' : r.ok ? 'pass' : 'fail';
    const st = r && !r.skipped && stale(S, r);
    if (st && state === 'pass') state = 'stale';
    const counts = r && !r.skipped ? [r.pass != null ? r.pass + ' ✓' : '', r.fail ? r.fail + ' ✗' : ''].filter(Boolean).join(' ') : '';
    nodes.push({ id, layer: 'P', kind: isCheck ? 'check' : 'test suite', title: S.dir, lane: S.runner || 'none',
      brief: [S.files.length + (S.files.length === 1 ? ' file' : ' files'), S.cmds.length ? clip(cmdText, 90) : 'no runner', counts, r && r.skipped ? 'skipped: ' + r.skipped : ''].filter(Boolean).join(' · '),
      state, t: r ? String(r.at).slice(0, 10) : '', tier: '', own: ['probe:' + S.dir],
      text: [S.dir, ...S.keys.map(k => 'START ' + k), ...S.ci, ...S.cmds.filter(c => c.cmd[0] === 'npm').map(c => (c.cwd ? c.cwd + '/' : '') + 'package.json')].filter(Boolean).join('\n'),
      extra: { path: S.dir, runner: S.runner, cmds: S.cmds, files: S.files.length, keys: S.keys, ci: S.ci,
        last: r ? { at: r.at, ok: !!r.ok, pass: r.pass, fail: r.fail, ms: r.ms, head: r.head, skipped: r.skipped || '' } : null, stale: !!st } });
    for (const k of S.keys) edges.push({ a: 'N:start.' + k, b: id, rel: 'runs' });
    if (S.single) continue;
    for (const f of S.files) {
      const fid = 'P:' + f, req = S.runner === 'gradle' ? [] : requires(f, read(f), has);
      nodes.push({ id: fid, layer: 'P', kind: kindOf(f), title: f.slice(S.dir.length + 1) || f, brief: req.length ? 'tests ' + req.slice(0, 4).join(', ') + (req.length > 4 ? ' …' : '') : '',
        state: '', t: '', tier: '', lane: S.dir, own: [], text: [f, ...req].join('\n'), extra: { path: f, suite: S.dir, requires: req } });
      edges.push({ a: id, b: fid, rel: 'contains' });
    }
  }
  return { nodes, edges };
}

/* ---- the recorder: run one suite, read its counts */
function counts(out) {
  const s = String(out || '');
  const n = rx => { let m, v = null; const r = new RegExp(rx, 'gim'); while ((m = r.exec(s))) v = +m[1]; return v; };
  let pass = n('^#\\s*pass\\s+(\\d+)'), fail = n('^#\\s*fail\\s+(\\d+)');
  if (pass == null) pass = n('(\\d+)\\s+(?:passed|passing|ok\\b|pass\\b)');
  if (fail == null) fail = n('(\\d+)\\s+(?:failed|failing|fail\\b)');
  if (pass == null) pass = n('✓\\s*(\\d+)\\b');
  return { pass, fail };
}

function run(S, { repo, exec, now = () => new Date().toISOString(), head = '' } = {}) {
  const rec = { suite: S.dir, at: now(), head, ok: false, code: null, pass: null, fail: null, ms: 0, steps: [] };
  if (!S.cmds.length) return Object.assign(rec, { skipped: 'no runner' });
  const tails = [];
  for (const c of S.cmds) {
    const r = exec(c.cmd, path.join(repo, c.cwd || ''));
    if (r.skipped) { rec.steps.push({ cmd: c.cmd, skipped: r.skipped }); continue; }
    const k = counts(r.out);
    rec.steps.push({ cmd: c.cmd, code: r.code, pass: k.pass, fail: k.fail, ms: r.ms });
    rec.ms += r.ms; tails.push(String(r.out || '').split('\n').slice(-12).join('\n'));
    if (k.pass != null) rec.pass = (rec.pass || 0) + k.pass;
    if (k.fail != null) rec.fail = (rec.fail || 0) + k.fail;
  }
  const ran = rec.steps.filter(x => !x.skipped);
  if (!ran.length) return Object.assign(rec, { skipped: rec.steps.map(x => x.skipped).join('; ') });
  const bad = ran.find(x => x.code !== 0);
  rec.code = bad ? bad.code : 0;
  rec.ok = rec.code === 0 && !rec.fail;
  if (ran.length < rec.steps.length) rec.partial = rec.steps.filter(x => x.skipped).map(x => x.skipped).join('; ');
  rec.tail = tails.join('\n').slice(-1500);
  return rec;
}

// the real exec: child_process, one suite at a time, its output kept; a runner this PC lacks is a skip, not a fail
function exec(cmd, cwd, { timeout = 10 * 60 * 1000 } = {}) {
  const cp = require('child_process'), fs = require('fs');
  let [exe, ...args] = cmd;
  const win = process.platform === 'win32';
  if (exe === 'node') exe = process.execPath;
  if (exe === 'gradlew') { const g = path.join(cwd, win ? 'gradlew.bat' : 'gradlew'); if (!fs.existsSync(g)) return { skipped: 'no gradlew in ' + cwd }; exe = g; }
  if (exe === 'powershell' && !win) { const w = cp.spawnSync('sh', ['-c', 'command -v pwsh']); if (w.status !== 0) return { skipped: 'no PowerShell on this PC' }; exe = 'pwsh'; }
  const t0 = Date.now();
  const r = cp.spawnSync(exe, args, { cwd, encoding: 'utf8', timeout, shell: win && (exe === 'npm' || /\.bat$/.test(exe)), env: Object.assign({}, process.env, { FORCE_COLOR: '0', NO_COLOR: '1' }), maxBuffer: 64 * 1024 * 1024 });
  if (r.error && r.error.code === 'ENOENT') return { skipped: exe + ' not found' };
  return { code: r.status == null ? -1 : r.status, out: (r.stdout || '') + (r.stderr || '') + (r.error ? '\n' + r.error.message : ''), ms: Date.now() - t0 };
}

/* ---- pillars whose string reaches code but no test: built, not verified (DRIFT.md §12) */
function unverified(graph, S, opts = {}) {
  const edges = (graph.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e);
  const ix = S.prepare(graph.nodes, edges), out = [];
  // the folders a test reaches (P → C by path): a pillar's folder is tested when it is one of them or inside one, or
  // when one of them is inside it (Planner/projects/varler-planner holds tests/ and src/), but a bare top-level folder
  // (docs, tools, .claude) does not count as tested because something somewhere below it is
  const tested = new Set(edges.filter(e => e.a[0] === 'P' && e.b[0] === 'C').map(e => e.b.slice(2)));
  const up = d => { for (let x = d; x; x = x.includes('/') ? x.slice(0, x.lastIndexOf('/')) : '') if (tested.has(x)) return true; return false; };
  const down = d => d.includes('/') && [...tested].some(t => t.startsWith(d + '/'));
  for (const p of graph.entities || []) {
    const s = S.string(ix, 'E:' + p.id, opts); if (!s) continue;
    if (!s.reach.includes('C') || s.reach.includes('P')) continue;
    const dirs = s.members.filter(m => m.layer === 'C').map(m => m.id.slice(2));
    if (dirs.some(d => up(d) || down(d))) continue;
    out.push({ pillar: p.id, name: p.name, mask: s.mask, cls: s.cls, dirs: dirs.slice(0, 3) });
  }
  return out;
}

module.exports = { suites, suiteOf, kindOf, requires, layer, counts, run, exec, unverified, lastBy };
