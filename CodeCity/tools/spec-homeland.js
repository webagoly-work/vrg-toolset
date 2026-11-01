'use strict';

// Gépország's feed (CITY-D34…D49): homeland.js on made-up raw lines (rates, layers, classes, the privacy strip), then the
// segéd with a fake vrg-probe: the feed starts only when the page asks, a 'hm' event reaches the stream, and hm-close asks
// only for counted windows of a program the city may close. The page's fixture must stay invented (CITY-D27 A).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const vm = require('vm');
const { spawn, execFileSync } = require('child_process');
const hm = require('../homeland.js');

const CITY = path.resolve(__dirname, '..');
const rules = hm.loadClasses(path.join(CITY, 'homeland-classes.json'));
const row = (pid, session, name, cpu, ws, rd = 0) => [pid, 4, session, name, 3, cpu, ws, ws / 2, rd, 0, 0, 10, ''];
const raw = (at, rows) => ({ t: 'hm', at, ms: 30, p: rows, c: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], m: { total: 1000, avail: 400 }, s: { modified: 1, sbCore: 2, sbNorm: 3, sbRes: 4, free: 5 }, d: [{ name: '0 C:', r: 1, w: 2, q: 0, idle: 75 }, { name: '2 E: H:', r: 0, w: 0, q: 0, idle: 100 }], n: [], g: { eng: {} } });
const ctx = over => Object.assign({ rules, wins: new Map(), fg: 0 }, over);

const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-hm-'));
const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const FAKE = `
const fs = require('fs'), log = process.argv[2];
const out = o => process.stdout.write(JSON.stringify(o) + '\\n');
let inbuf = '', tick = null;
process.stdin.on('data', d => { inbuf += d; let k; while ((k = inbuf.indexOf('\\n')) >= 0) { const l = inbuf.slice(0, k); inbuf = inbuf.slice(k + 1); fs.appendFileSync(log, l + '\\n');
  const m = JSON.parse(l);
  if (m.t === 'hm' && m.on && !tick) tick = setInterval(() => out(${JSON.stringify(raw(1000, [row(50, 1, 'proba.exe', 1000, 2048)]))}), 200);
  if (m.t === 'hm' && !m.on) { clearInterval(tick); tick = null; } } });
process.stdin.on('end', () => process.exit(0));
out({ t: 'hello', v: 2, pid: process.pid });
out({ t: 'windows', list: [{ h: 10, pid: 50, exe: 'proba.exe', name: 'Próba' }, { h: 11, pid: 60, exe: 'explorer.exe', name: 'Explorer' }] });
`;
let srv = null, stream = '', token = '';
async function start() {
  if (srv) return srv;
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: fx });
  for (const f of ['companion.js', 'scan.js', 'sessions.js', 'agents-poll.js', 'homeland.js', 'homeland-classes.json', 'estate-walk.js']) put(path.join(fx, 'CodeCity', f), fs.readFileSync(path.join(CITY, f), 'utf8'));
  put(path.join(fx, 'CodeCity', 'dist', 'vrg-codecity.html'), '<!doctype html><html><head></head><body>fixture</body></html>');
  put(path.join(fx, 'fake-probe.js'), FAKE);
  const cfg = path.join(fx, 'none.json');
  put(cfg, JSON.stringify({ downloads: path.join(fx, 'dl'), agentsCmd: [process.execPath, '-e', 'console.log("[]")'], probeCmd: [process.execPath, path.join(fx, 'fake-probe.js'), path.join(fx, 'cmds.txt')] }));
  const env = Object.assign({}, process.env); delete env.KP_DRY_RUN;
  const child = spawn(process.execPath, [path.join(fx, 'CodeCity', 'companion.js'), '--port', '0', '--no-open', '--no-terminal', '--config', cfg], { env });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = out.match(/port (\d+)/); if (m) resolve(+m[1]); });
    child.on('exit', c => reject(new Error('server exited ' + c)));
    setTimeout(() => reject(new Error('server did not start')), 5000);
  });
  srv = { child, port };
  process.on('exit', () => { child.kill(); try { fs.rmSync(fx, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  const page = await new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port, path: '/', headers: { Host: '127.0.0.1:' + port } }, x => { x.resume(); res(x); }); r.on('error', rej); r.end(); });
  const cookie = String((page.headers['set-cookie'] || [''])[0]).split(';')[0];
  token = fs.readFileSync(path.join(fx, 'CodeCity', '.companion-token'), 'utf8').trim();
  await new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port, path: '/api/stream', headers: { Host: '127.0.0.1:' + port, Cookie: cookie } }, res => { res.on('data', d => { stream += d; }); resolve(); });
    r.on('error', () => {}); r.end();
  });
  return srv;
}
function post(action, body) {
  return new Promise((resolve, reject) => {
    const s = JSON.stringify(body), r = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/' + action, method: 'POST', headers: { Host: '127.0.0.1:' + srv.port, 'Content-Type': 'application/json', 'X-Kodvaros-Token': token, 'Content-Length': Buffer.byteLength(s) } },
      x => { let b = ''; x.on('data', d => { b += d; }); x.on('end', () => resolve({ status: x.statusCode, json: JSON.parse(b || '{}') })); });
    r.on('error', reject); r.end(s);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = [
  { name: 'homeland: cpu and I/O are rates over the elapsed time, shared over the logical CPUs', async fn() {
    const st = {};
    hm.normalise(raw(1000, [row(50, 1, 'proba.exe', 0, 2048, 0)]), st, ctx());
    const e = hm.normalise(raw(2000, [row(50, 1, 'proba.exe', 1e7, 2048, 500)]), st, ctx());
    assert.ok(Math.abs(e.procs[0].cpu - 50) < 0.01, 'one core busy of two = 50 %, got ' + e.procs[0].cpu);
    assert.strictEqual(e.procs[0].r, 500);
  } },
  { name: 'homeland: the layer is the session number and the window, not a judgement', async fn() {
    const wins = new Map([[9, { h: 9, pid: 2, exe: 'a.exe' }]]);
    const e = hm.normalise(raw(1000, [row(0, 0, 'Idle', 0, 0), row(4, 0, 'System', 0, 1), row(1, 0, 'svchost.exe', 0, 1), row(2, 1, 'a.exe', 0, 1), row(3, 1, 'b.exe', 0, 1)]), {}, ctx({ wins, fg: 9 }));
    const by = Object.fromEntries(e.procs.map(p => [p.key, p]));
    assert.ok(!by.idle, 'Idle is what is left over, not a tenant');
    assert.deepStrictEqual([by.system.layer, by['svchost.exe'].layer, by['a.exe'].layer, by['b.exe'].layer], [-3, -2, 0, -1]);
    assert.ok(by['a.exe'].fg && by['a.exe'].win === 1);
  } },
  { name: 'homeland: an unknown program goes to the suburbs, nothing is dropped', async fn() {
    assert.deepStrictEqual(hm.classify(rules, 'sohanemlatott.exe'), { cls: 'other', place: 'kulvaros' });
    assert.strictEqual(hm.classify(rules, 'chrome.exe').place, 'belvaros');
  } },
  { name: 'homeland: disks keep their letters, E: and H: stay on one disk', async fn() {
    const e = hm.normalise(raw(1000, []), {}, ctx());
    assert.deepStrictEqual(e.disks[1].letters, ['E:', 'H:']);
    assert.strictEqual(e.disks[0].busy, 25);
  } },
  { name: 'homeland: extra fields on a raw line do not reach the event', async fn() {
    const m = raw(1000, [row(5, 1, 'x.exe', 0, 1)]); m.title = 'titkos ablak'; m.cmd = 'C:\\Users\\titkos';
    assert.ok(!/titkos/.test(JSON.stringify(hm.normalise(m, {}, ctx()))));
  } },
  { name: 'homeland: nvidia-smi line parses, N/A values stay empty', async fn() {
    assert.deepStrictEqual(hm.parseSmi('56, 0, 923, 1454, 4096'), { temp: 56, fan: 0, mhz: 923, used: 1454 * 1048576, total: 4096 * 1048576 });
    assert.strictEqual(hm.parseSmi('56, [N/A], 923, 1, 2').fan, null);
    assert.strictEqual(hm.parseSmi('nem fut'), null);
  } },
  { name: 'homeland: the page fixture is invented and marked', async fn() {
    const src = fs.readFileSync(path.join(CITY, 'src', '40-hm-core.js'), 'utf8'), fx0 = src.slice(src.indexOf('const HMFX_PROCS'));
    assert.ok(!/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(fx0), 'no address');
    assert.ok(!/[A-Za-z]:\\\\/.test(fx0), 'no path');
    assert.ok(/fixture: true/.test(fx0) && /PRÓBAADAT/.test(src), 'marked');
  } },
  { name: 'homeland: the Növekedés plan reads the history: order, time as distance, a sweep is no merge', async fn() {
    const box = {};
    vm.runInNewContext(fs.readFileSync(path.join(CITY, 'src', '43-hm-plan.js'), 'utf8') + '\nthis.plan = hmGrowthPlan;', box);
    const file = (p, born, lang, loc, extra) => Object.assign({ p, lang, loc, born, last: born + 1 }, extra);
    const files = [file('Falu/a.js', 0, 'JavaScript', 6000), file('Falu/b.md', 0, 'Markdown', 50), file('Falu/c.js', 0, 'JavaScript', 9), file('Kis/a.js', 0, 'JavaScript', 600), file('Uj/app.html', 8, 'HTML', 700, { mv: 1 }), file('Uj/d.json', 18, 'JSON', 20),
      file('Mult/x.js', 9, 'JavaScript', 0, { gone: 1 }), file('.titok/x.md', 0, 'Markdown', 5), file('fo.html', 2, 'HTML', 30), file('Y/a.js', 19, 'JavaScript', 3), file('Z/a.js', 19, 'JavaScript', 3)];
    const touch = (...ids) => ids.flatMap(i => [i, 1, 0]);
    const commits = Array.from({ length: 21 }, (_, i) => [1000 + i, 0, 0, 'titkos tárgy ' + i, 'h' + i, i >= 10 && i < 14 ? touch(0, 3) : i >= 15 && i < 19 ? touch(0, 3, 4, 6, 8, 9, 10) : touch(0)]);
    const city = { repo: { name: 'Proba', head: 'h20' }, commits, files };
    const a = JSON.parse(JSON.stringify(box.plan(city, [{ name: 'Uj bolt', path: 'C:\\x\\Proba\\Uj\\app.html' }, { name: 'Nincs ilyen', path: 'Sehol/a.html' }])));
    assert.strictEqual(a.hub, 'Falu', 'the hub is where the first commit landed');
    assert.deepStrictEqual(a.areas.map(x => x.name), ['Falu', 'Kis', '', 'Uj', 'Mult', 'Y', 'Z'], 'order of first appearance; dot folders stay out');
    const r = l => Math.hypot(l.u - 50, l.v - 50), lot = (ar, kind) => a.lots.find(l => l.area === ar && l.kind === kind);
    assert.ok(r(lot('Uj', 'data')) > r(lot('Uj', 'code')) && r(lot('Uj', 'code')) > r(lot('Falu', 'code')), 'distance is time');
    assert.strictEqual(lot('Falu', 'code').size, 'warehouse');
    assert.strictEqual(lot('Kis', 'code').size, 'boxes');
    assert.strictEqual(lot('Uj', 'data').size, 'pack');
    assert.ok(lot('Mult', 'gone'), 'a deleted idea stays as a ruin');
    assert.deepStrictEqual(a.shops.map(s => [s.name, s.area, s.garden]), [['Uj bolt', 'Uj', true]], 'a shop on its road, a garden for the design system, nothing for an unknown tool');
    assert.deepStrictEqual(a.links.map(l => [l.a, l.b, l.n]), [['Falu', 'Kis', 4]], 'four shared commits merge two ideas; four seven-area sweeps count for nothing');
    assert.ok(!/titkos/.test(JSON.stringify(a)), 'no commit subject in the plan');
    assert.strictEqual(JSON.stringify(box.plan(city, []).lots), JSON.stringify(box.plan(city, []).lots), 'same history, same plan');
  } },
  { name: 'homeland: the scan marks the files that wear the design system', async fn() {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-mv-')), out = path.join(r, 'c.json');
    const g = (...a) => execFileSync('git', ['-c', 'user.name=p', '-c', 'user.email=p@p', ...a], { cwd: r });
    put(path.join(r, 'a.html'), '<style>/* Mélyvíz */</style>'); put(path.join(r, 'b.html'), '<p>x</p>'); put(path.join(r, 'c.js'), '// Mélyvíz\n');
    g('init', '-q', '-b', 'main'); g('add', '.'); g('commit', '-qm', 'x');
    execFileSync(process.execPath, [path.join(CITY, 'scan.js'), r, '--out', out], { stdio: 'ignore' });
    const c = JSON.parse(fs.readFileSync(out, 'utf8')), mv = n => !!c.files.find(f => f.p === n).mv;
    assert.deepStrictEqual([mv('a.html'), mv('b.html'), mv('c.js')], [true, false, false]);
  } },
  { name: 'homeland: the estate walk gives sizes and kinds, skips links and walled zones, and carries no file name', async fn() {
    const { walk } = require('../estate-walk.js');
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-est-'));
    put(path.join(r, 'Mappa', 'Al', 'titkos-kep.jpg'), Buffer.alloc(3000)); put(path.join(r, 'Mappa', 'Al', 'titkos-dal.mp3'), Buffer.alloc(2000)); put(path.join(r, 'Mappa', 'sajat.txt'), Buffer.alloc(100));
    put(path.join(r, '.ssh', 'id'), Buffer.alloc(9000)); put(path.join(r, 'gyoker.bin'), Buffer.alloc(50));
    const w = walk(r, 5), d = w.dirs.find(x => x.name === 'Mappa'), al = d.kids.find(k => k.name === 'Al');
    assert.strictEqual(d.size, 5100);
    assert.deepStrictEqual([al.kinds.image, al.kinds.audio], [3000, 2000]);
    assert.ok(d.kids.some(k => k.own && k.size === 100), 'a folder keeps its own files');
    assert.deepStrictEqual(w.walled, ['.ssh'], 'a walled zone is named, not read');
    assert.ok(!w.dirs.some(x => x.name === '.ssh') && w.dirs.reduce((a, x) => a + x.size, 0) === 5150);
    assert.ok(!/titkos|sajat|gyoker/.test(JSON.stringify(w)), 'no file name in the result');
  } },
  { name: 'homeland: Birtok is true to area: bytes take their share of the square, across drives too', async fn() {
    const box = {};
    vm.runInNewContext(fs.readFileSync(path.join(CITY, 'src', '45-hm-estate-plan.js'), 'utf8') + '\nthis.plan = hmEstatePlan; this.side = hmEstSide;', box);
    const G = 2 ** 30, kid = (name, gb, kinds, top = []) => ({ name, size: gb * G, files: 10, kinds, bands: [5, 4, 1], top });
    const walk = { partial: false, dirs: [
      { name: 'Nagy', size: 300 * G, kids: [kid('Film', 200, { video: 200 * G }, [[50 * G, 'video']]), kid('Kep', 100, { image: 90 * G, other: 10 * G })] },
      { name: 'Kis', size: 100 * G, kids: [kid('Zene', 100, { audio: 100 * G })] } ] };
    const vol = { letter: 'D:', size: 1000 * G, free: 500 * G }, a = box.plan(vol, walk, 4000 * G), A = r => r.w * r.h, S = a.side * a.side;
    assert.ok(Math.abs(a.side - 165) < 0.01, 'a quarter of the capacity takes a quarter of the area');
    assert.ok(Math.abs(box.side(4000 * G, 4000 * G) - 330) < 0.01);
    const cell = t => a.cells.find(c => c.type === t);
    assert.ok(Math.abs(A(cell('free')) / S - 0.5) < 1e-9, 'free space is half the square');
    assert.ok(Math.abs(A(cell('unread')) / S - 0.1) < 1e-9, 'what the walk could not read keeps its true share');
    assert.ok(Math.abs(a.cells.reduce((s, c) => s + A(c), 0) - S) < 1e-6, 'nothing lost, nothing added');
    for (let i = 0; i < a.cells.length; i++) for (let j = i + 1; j < a.cells.length; j++) { const p = a.cells[i], q = a.cells[j]; assert.ok(p.x + p.w <= q.x + 1e-6 || q.x + q.w <= p.x + 1e-6 || p.y + p.h <= q.y + 1e-6 || q.y + q.h <= p.y + 1e-6, 'cells do not overlap'); }
    const film = a.plots.find(p => p.sub === 'Film'), kinds = l => l.leaves.map(x => x.type + ':' + (x.kind || '')).sort().join();
    assert.strictEqual(kinds(film), 'hall:video,tower:video', 'the largest file is a tower, its kind a hall');
    assert.strictEqual(kinds(a.plots.find(p => p.sub === 'Kep')), 'hall:image,homes:');
    const w = a.plots.find(p => p.sub === 'Zene');
    assert.strictEqual(kinds(w), 'hall:audio', 'audio stands in a concert hall');
    const t = film.leaves.find(x => x.type === 'tower');
    assert.ok(Math.abs(A(t) / A(film) - 0.25) < 1e-9, 'a tower takes its file\'s share of the plot');
    const none = box.plan(vol, null, 4000 * G);
    assert.ok(!none.measured && Math.abs(A(none.cells.find(c => c.type === 'unread')) / S - 0.5) < 1e-9, 'before the walk only capacity and free space are known');
  } },
  { name: 'homeland: hm-estate takes only a drive the inventory knows; hm-open only a known plot', async fn() {
    await start();
    assert.strictEqual((await post('hm-estate', { letter: 'C:\\Windows' })).status, 400);
    assert.strictEqual((await post('hm-estate', { letter: 'Q:', rescan: false })).status, 404);
    assert.strictEqual((await post('hm-open', { letter: 'Q:', top: 0, kid: 0 })).status, 404);
  } },
  { name: 'homeland: a sensor line keeps only known groups, kinds and real numbers', async fn() {
    const c = hm.cleanSensors({ pawnio: 1, list: [{ g: 'cpu', hw: 'CPU', k: 'temp', n: 'Core Average', v: 47.5, serial: 'TITKOS' }, { g: 'gpu', hw: 'x', k: 'temp', n: 'y', v: 1 }, { g: 'cpu', k: 'clock', n: 'z', v: 1 }, { g: 'disk', hw: 'y'.repeat(99), k: 'temp', n: 'T', v: 'forró' }, 7, null] });
    assert.deepStrictEqual(c.list, [{ g: 'cpu', hw: 'CPU', k: 'temp', n: 'Core Average', v: 47.5 }]);
    assert.strictEqual(c.pawnio, true);
    assert.deepStrictEqual(hm.cleanSensors({}).list, []);
    assert.ok(!/SetSoftware|\.Control\b|Control\.Set/.test(fs.readFileSync(path.join(CITY, 'etw', 'Sensors.cs'), 'utf8')), 'the sidecar only reads: no fan or voltage is ever set');
  } },
  { name: 'homeland: a recording line is totals and classes; no program name can get in', async fn() {
    const ev = n => ({ at: 1000 + n, cores: [{ u: 40, k: 10 }, { u: 20, k: 10 }], mem: { total: 100, avail: 25, hard: 4 }, disks: [{ r: 100, w: 50, busy: 30 + n }], nics: [{ name: 'titkos halozat', rx: 10, tx: 5 }],
      procs: [{ exe: 'titkos-ugyfel.exe', key: 'titkos-ugyfel.exe', cls: 'other', cpu: 2, ws: 100, hint: 'temp' }, { exe: 'b.exe', key: 'b.exe', cls: 'agent', cpu: 1, ws: 50 }, { exe: 'c.exe', key: 'c.exe', cls: 'agent', cpu: 3, ws: 50 }] });
    const a = hm.aggregate([ev(0), ev(10)]);
    assert.deepStrictEqual([a.secs, a.cpu, a.ram, a.disk[0], a.disk[2], a.net, a.procs], [2, [40, 40], [75, 75], 100, 40, [10, 5], 3]);
    assert.deepStrictEqual(a.cls, { other: { cpu: 2, ws: 100 }, agent: { cpu: 4, ws: 100 } });
    assert.ok(!/titkos|\.exe|temp/.test(JSON.stringify(a)), 'no name, no hint');
  } },
  { name: 'homeland: the recording starts only when asked, stops with the feed, and is listed', async fn() {
    await start();
    assert.strictEqual((await post('hm-rec', { on: true })).json.rec, false, 'no feed, no recording');
    assert.strictEqual((await post('hm-rec', { on: 'igen' })).status, 400);
    await post('hm-feed', { on: true });
    assert.strictEqual((await post('hm-rec', { on: true })).json.rec, true);
    await sleep(2600);
    assert.strictEqual((await post('hm-rec', { on: false })).json.rec, false);
    await post('hm-feed', { on: false });
    const dir = path.join(fx, '.cache', 'homeland'), file = fs.readdirSync(dir)[0], text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(/^rec-/.test(file) && text.length > 10, 'written');
    assert.ok(!/proba|\.exe/.test(text), 'no program name on disk');
    const list = (await post('hm-recs', {})).json.list;
    assert.ok(list.length === 1 && list[0].secs > 0, JSON.stringify(list));
  } },
  { name: 'homeland: no feed until the page asks; then hm events on the stream', async fn() {
    await start();
    await sleep(300);
    const mark = stream.length;
    await sleep(700);
    assert.ok(!/event: hm\n/.test(stream.slice(mark)), 'the feed ran unasked');
    assert.strictEqual((await post('hm-feed', { on: true })).status, 200);
    await sleep(800);
    assert.ok(/event: hm\n/.test(stream), 'no hm event');
    assert.ok(/"key":"proba.exe"/.test(stream) && /"layer":0/.test(stream), 'program on the surface');
  } },
  { name: 'homeland: hm-close reaches the probe only for a counted window of an allowed program', async fn() {
    await sleep(300);
    const ok = await post('hm-close', { key: 'proba.exe' });
    assert.ok(ok.status === 200 && ok.json.n === 1, JSON.stringify(ok));
    assert.strictEqual((await post('hm-close', { key: 'explorer.exe' })).status, 403);
    assert.strictEqual((await post('hm-close', { key: 'claude.exe' })).status, 403);
    assert.strictEqual((await post('hm-close', { key: 'nincs.exe' })).status, 404);
    assert.strictEqual((await post('hm-close', { key: 5 })).status, 403);
    await sleep(200);
    const cmds = fs.readFileSync(path.join(fx, 'cmds.txt'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(c => c.t === 'hmclose');
    assert.deepStrictEqual(cmds, [{ t: 'hmclose', h: 10 }]);
  } },
];
