#!/usr/bin/env node
// selftest.js — scan.js against a throwaway fixture repo with an agent commit, a rename and a delete.
//
//   node CodeCity/tools/selftest.js
//
// The fixture lives in the OS temp folder and is removed afterwards (KEEP_FIXTURE=1 keeps it and prints
// its path, e.g. to render it: node CodeCity/scan.js <path> --html x.html). Exit code 1 on any failure.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kodvaros-fx-'));
const g = (...a) => execFileSync('git', ['-c', 'user.name=Teszt', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { cwd: dir, encoding: 'utf8' });
const put = (p, s) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), s); };
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`); if (!ok) fail++; };

try {
  g('init', '-q', '-b', 'main');
  put('a.js', 'one\ntwo\nthree\n'); put('b.md', '# b\n');
  g('add', '.'); g('commit', '-q', '-m', 'first');
  put('a.js', 'one\ntwo\nthree\nfour\n'); put('c.js', 'x\n');
  g('add', '.'); g('commit', '-q', '-m', 'agent work', '-m', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
  fs.mkdirSync(path.join(dir, 'src')); g('mv', 'a.js', 'src/a2.js'); g('commit', '-q', '-m', 'move');
  g('rm', '-q', 'b.md'); g('commit', '-q', '-m', 'delete');
  put('c.js', "const a = require('./src/a2');\nconst fs = require('fs');\n"); g('add', '.'); g('commit', '-q', '-m', 'import');

  const out = path.join(dir, 'out.city.json');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scan.js'), dir, '--out', out], { stdio: 'ignore' });
  const city = JSON.parse(fs.readFileSync(out, 'utf8'));
  const by = p => city.files.find(f => f.p === p);

  check(city.commits.length === 5, `5 commits (got ${city.commits.length})`);
  check(city.files.length === 3, `3 file identities: a2 (renamed), b (gone), c (got ${city.files.map(f => f.p).join(', ')})`);
  check(!by('a.js'), 'the old name a.js is not a separate building');
  const a = by('src/a2.js');
  check(a && a.n === 3 && a.born === 0 && a.loc === 4, `src/a2.js keeps its history across the rename: n=3 born=0 loc=4 (got n=${a && a.n} born=${a && a.born} loc=${a && a.loc})`);
  const b = by('b.md');
  check(b && b.gone === 1 && b.goneAt === 3, `b.md is a ghost, gone at commit 3 (got gone=${b && b.gone} goneAt=${b && b.goneAt})`);
  const c = by('c.js');
  check(c && c.ag === 1 && c.n === 2, `c.js: 2 commits, 1 agent-assisted (got n=${c && c.n} ag=${c && c.ag})`);
  check(city.agents.join() === 'Claude' && city.commits[1][2] === 0 && city.commits[0][2] === -1, 'only commit 2 is agent-assisted, by Claude');
  check(c && c.imp && c.imp.length === 1 && city.files[c.imp[0]].p === 'src/a2.js', `c.js has one road, to src/a2.js; the package 'fs' is not a road (got ${c && JSON.stringify(c.imp)})`);
  const touched = city.commits[2][5].filter((_, i) => i % 3 === 0).map(i => city.files[i].p);
  check(touched.join() === 'src/a2.js', `the rename commit touches src/a2.js (got ${touched.join()})`);
  check(!('sessions' in city), 'no sessions without --sessions (opt-in)');

  // --sessions: a fake transcript with secrets in every field that must NOT travel
  const line = (o) => JSON.stringify(o) + '\n';
  const use = (id, name, input, ts) => line({ type: 'assistant', sessionId: 'feedbeef-0000', cwd: dir, timestamp: ts, message: { content: [{ type: 'text', text: 'SECRET-REPLY' }, { type: 'tool_use', id, name, input }] } });
  put('../' + path.basename(dir) + '-tx/s.jsonl', line({ type: 'user', sessionId: 'feedbeef-0000', cwd: dir, timestamp: '2026-10-23T10:00:00Z', message: { content: 'SECRET-PROMPT' } })
    + use('t1', 'Read', { file_path: path.join(dir, 'src', 'a2.js') }, '2026-10-23T10:00:05Z')
    + use('t1', 'Read', { file_path: path.join(dir, 'src', 'a2.js') }, '2026-10-23T10:00:05Z')          // streamed twice
    + use('t2', 'Edit', { file_path: 'c.js', old_string: 'SECRET-OLD', new_string: 'SECRET-NEW' }, '2026-10-23T10:01:00Z')
    + use('t3', 'Grep', { pattern: 'SECRET-PATTERN' }, '2026-10-23T10:02:00Z')                       // no path: the cwd
    + use('t4', 'Read', { file_path: path.join(os.tmpdir(), 'elsewhere.txt') }, '2026-10-23T10:03:00Z')  // outside the repo
    + use('t5', 'Bash', { command: 'cat SECRET-CMD' }, '2026-10-23T10:04:00Z'));
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scan.js'), dir, '--out', out, '--sessions', '--sessions-dir', dir + '-tx'], { stdio: 'ignore' });
  const raw = fs.readFileSync(out, 'utf8'), sc = JSON.parse(raw), s = sc.sessions && sc.sessions[0];
  check(sc.sessions && sc.sessions.length === 1 && s.id === 'feedbeef', `one session, id cut to 8 chars (got ${JSON.stringify(sc.sessions && sc.sessions.map(x => x.id))})`);
  const ev = s ? s.ev : [];
  check(JSON.stringify(ev) === JSON.stringify([0, 0, sc.files.indexOf(sc.files.find(f => f.p === 'src/a2.js')), 55, 2, sc.files.indexOf(sc.files.find(f => f.p === 'c.js')), 115, 1, -1]),
    `read a2 · edit c.js (relative path) · search the root; duplicate and outside calls dropped (got ${JSON.stringify(ev)}, dirs ${JSON.stringify(s && s.dirs)})`);
  check(!/SECRET/.test(raw), 'no prompt, reply, pattern, edit text or command in the city');
  check(Object.keys(s || {}).sort().join() === 'dirs,ev,id,t0', `a session holds only id, t0, dirs, ev (got ${Object.keys(s || {}).join()})`);

  // mcp.js (C10): the whole conversation in one stdin; it scans the fixture into its own dist on first use
  const dist = path.join(dir, 'kv-dist'), rq = (id, method, params) => JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const call = (id, name, args) => rq(id, 'tools/call', { name, arguments: args });
  const input = [rq(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selftest', version: '0' } }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), rq(2, 'tools/list', {}),
    call(3, 'city_query', { q: 'javascript legnagyobb' }), call(4, 'city_file', { path: 'a2.js' }),
    call(5, 'city_file', { path: 'b.md' }), call(6, 'city_view_link', { follow: 'claude', lens: 'ugynok' }),
    call(7, 'city_file', { path: 'nope' }), rq(8, 'no/such', {})].join('\n') + '\n';
  const res = execFileSync(process.execPath, [path.join(__dirname, '..', 'mcp.js'), dir, '--dist', dist], { input, encoding: 'utf8' })
    .trim().split('\n').map(l => JSON.parse(l));
  const R = id => res.find(r => r.id === id) || {}, text = id => ((R(id).result || {}).content || [{}])[0].text || '';
  check(res.length === 8 && R(1).result && R(1).result.protocolVersion === '2025-06-18', `mcp: 8 answers (the notification gets none), protocol 2025-06-18 (got ${res.length})`);
  check(R(2).result && R(2).result.tools.map(t => t.name).join() === 'city_summary,city_query,city_file,city_hotspots,city_view_link,city_rescan', 'mcp: the six tools');
  check(/2 találat/.test(text(3)) && /1\. src\/a2\.js/.test(text(3)) && /#q=javascript\+legnagyobb/.test(text(3)), `mcp: city_query uses the page's parser and links #q= (got ${JSON.stringify(text(3).split('\n').slice(1, 3))})`);
  check(/src\/a2\.js/.test(text(4)) && /imported by \(1\): c\.js/.test(text(4)) && /#sel=src%2Fa2\.js/.test(text(4)), 'mcp: city_file finds src/a2.js by fragment, with its importer and a #sel= link');
  check(/deleted at/.test(text(5)), 'mcp: city_file knows b.md is a ghost');
  check(/#lens=ugynok&follow=g0$/.test(text(6)), `mcp: city_view_link resolves "claude" to the agent trail (got ${text(6).split('\n').pop()})`);
  check(R(7).result && R(7).result.isError === true, 'mcp: an unknown file is a tool error, not a crash');
  check(R(8).error && R(8).error.code === -32601, 'mcp: an unknown method is -32601');
  check(fs.readdirSync(dist).sort().join() === `${path.basename(dir)}.city.json,${path.basename(dir)}.html`, `mcp: wrote only the city and its page into --dist (got ${fs.readdirSync(dist).join()})`);

  // companion.js (KV-04): the Kapu companion spec, re-pointed; a dry-run server on a random port, nothing launched
  const spec = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'),
    path.join(__dirname, '..', 'from-kapu', 'test', 'spec-95-companion.js')], { encoding: 'utf8', timeout: 60000 });
  const lines = String(spec.stdout || '').trim().split('\n').filter(Boolean);
  for (const l of lines) check(l.startsWith('ok'), 'companion: ' + l.replace(/^(ok|FAIL)\s+/, ''));
  check(lines.length === 10 && spec.status === 0, `companion: all 10 cases ran (got ${lines.length}, exit ${spec.status})`);
  // the embedded terminal end to end (CITY-D15 C): a real ConPTY cmd.exe, only when Vendor/node-pty is there
  const ts = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-terminal.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(ts.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(ts.status === 0, `terminal spec exit ${ts.status}`);
  // the live repo end to end (P3, KV-08) on a throwaway fixture repo: edit -> fs event, commit -> git event + /api/city
  const lv = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-live.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(lv.stdout || '').trim().split('
').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)s+/, ''));
  check(lv.status === 0, `live spec exit ${lv.status}`);
} finally {
  if (process.env.KEEP_FIXTURE === '1') console.log('fixture kept: ' + dir);
  else { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(dir + '-tx', { recursive: true, force: true }); }
}
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
