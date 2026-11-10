// WP-45 Programok: third-party programs from launcher/programs.json + the ServiceKit catalog, as ghosts the Dashboard view installs
// into Full\programs. Unit tests against the real registry (levels, modes, folders) and a throwaway programs folder in %TEMP%
// (a real zip, a fake fetch: resolve → download → unpack → detect → state; the refusals). No network, never the real Full\programs.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync, execFile } = require('child_process');
const { createPrograms, merge, globRe } = require('../shell/lib/programs.js');
const { createJobs } = require('../shell/lib/jobs.js');
const { createCatalog } = require('../shell/lib/catalog.js');
const { KINDS } = require('../shell/lib/layout.js');
const D = require('../shell/lib/desk.js');
const build = require('../build.js');

const REPO = path.resolve(__dirname, '..', '..');
const REG = JSON.parse(fs.readFileSync(path.join(REPO, 'launcher', 'programs.json'), 'utf8'));
const SK = JSON.parse(fs.readFileSync(path.join(REPO, 'ServiceKit', 'core', 'catalog.json'), 'utf8'));
const ROOT = 'X:\\VRG\\Full\\programs';
const expand = s => s.replace('{repo}', REPO).replace('{full}', 'X:\\VRG\\Full');

test('the merged list: every ServiceKit package plus our own, User gets the short set, Dev and All get everything', () => {
  const L = merge(REG, SK, expand, ROOT);
  const ids = new Set(L.map(p => p.id));
  for (const p of SK.packages) assert.ok(ids.has(p.id), 'ServiceKit ' + p.id + ' is listed');
  for (const id of ['vlc', 'zen', 'operagx', 'keytweak']) assert.ok(ids.has(id), id + ' is listed');
  const user = L.filter(p => p.level === 'user').map(p => p.id).sort();
  assert.deepEqual(user, ['crystaldiskinfo', 'everything', 'hwinfo', 'keepassxc', 'notepadpp', 'operagx', 'sevenzip', 'sharex', 'sumatra', 'vlc', 'wiztree', 'zen']);
  assert.ok(L.every(p => ['user', 'dev'].includes(p.level)), 'nothing is hidden behind All only: Dev already sees every program');
  assert.equal(new Set(L.map(p => p.id)).size, L.length, 'no duplicate ids');
});

test('installers, ISOs and manual sources are page entries; zip / 7z / sfx / exe are installable', () => {
  const L = merge(REG, SK, expand, ROOT);
  const g = id => L.find(p => p.id === id);
  for (const id of ['wireshark', 'virtualbox', 'sandboxie', 'gpuz', 'hirens', 'zen', 'operagx', 'keytweak']) assert.equal(g(id).mode, 'page', id);
  for (const id of ['notepadpp', 'retroarch', 'sevenzip', 'rufus', 'vlc']) assert.equal(g(id).mode, 'install', id);
  assert.ok(L.filter(p => p.mode === 'page').every(p => !p.page || p.page.startsWith('https://')), 'pages are https');
});

test('every folder is inside Full\\programs; the known folders keep their names; dev tools go to dev\\<id>', () => {
  const L = merge(REG, SK, expand, ROOT);
  for (const p of L) assert.ok(p.dir.startsWith(ROOT + '\\'), p.id + ' → ' + p.dir);
  const g = id => L.find(p => p.id === id).dir;
  assert.equal(g('sevenzip'), ROOT + '\\7zip');
  assert.equal(g('vlc'), ROOT + '\\VLC');
  assert.equal(g('zen'), ROOT + '\\zen-browser');
  assert.equal(g('node'), ROOT + '\\dev\\node');
  assert.equal(g('rufus'), ROOT + '\\rufus');
  const bad = merge({ programs: [{ id: 'evil', dir: '..\\..\\Windows', format: 'zip', source: { type: 'url', url: 'https://x/y.zip' } }, { id: 'Bad Id', format: 'zip' }] }, {}, expand, ROOT);
  assert.equal(bad.length, 0, 'a folder outside the root and a bad id are dropped');
});

test('the catalog has the Programok section at User level, and the Dashboard view always draws it', () => {
  const cat = createCatalog({ file: path.join(REPO, 'launcher', 'vrg-catalog.json'), collect: () => build.collect(), kinds: KINDS });
  cat.load();
  assert.deepEqual(cat.sections().programok, { hu: 'Programok', en: 'Programs', level: 'user' });
  const secs = D.sections(cat.listFor('user'), 'user', cat.sections(), cat.groups()).map(s => s.id);
  assert.ok(secs.includes('programok'), secs.join(','));
  assert.equal(cat.errors().length, 0, cat.errors().join('\n'));
});

test('exe patterns: ServiceKit wildcards match', () => {
  assert.ok(globRe('SumatraPDF*.exe').test('SumatraPDF-3.6.1-64.exe'));
  assert.ok(globRe('notepad++.exe').test('Notepad++.exe'));
  assert.ok(!globRe('7zFM.exe').test('7zFMx.exe'));
});

// ---------------------------------------------------------------- a real install into a throwaway folder
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wp45-'));
  const src = path.join(dir, 'src', 'Tool-1.2');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'Tool.exe'), 'MZ fake');
  fs.writeFileSync(path.join(src, 'readme.txt'), 'hi');
  const zip = path.join(dir, 'tool-1.2.zip');
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-a', '-cf', zip, '-C', path.join(dir, 'src'), 'Tool-1.2']);
  const reg = { defaultLevel: 'dev', servicekit: path.join(dir, 'sk.json'), programs: [
    { id: 'tool', level: 'user', name: 'Tool', cat: 'util', format: 'zip', source: { type: 'scrape', page: 'https://example.test/dl/', regex: 'tool-[\\d.]+\\.zip' }, apps: [{ exe: 'Tool.exe' }] },
    { id: 'devtool', name: 'DevTool', cat: 'dev', format: 'zip', source: { type: 'url', url: 'https://example.test/dl/tool-1.2.zip' }, apps: [{ exe: 'Tool.exe' }] },
    { id: 'plain', level: 'user', name: 'Plain', cat: 'util', format: 'zip', source: { type: 'url', url: 'http://example.test/tool-1.2.zip' }, apps: [{ exe: 'Tool.exe' }] },
    { id: 'hashed', level: 'user', name: 'Hashed', cat: 'util', format: 'zip', sha256: '0'.repeat(64), source: { type: 'url', url: 'https://example.test/dl/tool-1.2.zip' }, apps: [{ exe: 'Tool.exe' }] },
    { id: 'vendor', level: 'user', name: 'Vendor', cat: 'web', format: 'installer', page: 'https://vendor.test/', source: { type: 'manual' }, apps: [{ exe: 'v.exe' }] },
  ] };
  fs.writeFileSync(path.join(dir, 'programs.json'), JSON.stringify(reg));
  fs.writeFileSync(path.join(dir, 'sk.json'), JSON.stringify({ categories: [{ id: 'util', hu: 'Segédeszközök', en: 'Utilities' }], packages: [] }));
  const bytes = fs.readFileSync(zip);
  const fetched = [];
  const net = {                                                       // the shape of httpsNet, without a network
    text: async url => { fetched.push(url); if (!url.startsWith('https://')) throw new Error('not https: ' + url);
      return url === 'https://example.test/dl/' ? { status: 200, body: '<a href="tool-1.2.zip">Tool</a>' } : { status: 404, body: '' }; },
    save: async (url, dest, o) => { fetched.push(url); if (!url.startsWith('https://')) throw new Error('not https: ' + url);
      if (!url.endsWith('tool-1.2.zip')) throw new Error('HTTP 404');
      fs.writeFileSync(dest, bytes); o.onData(bytes.length, bytes.length);
      return { size: bytes.length, sha256: require('crypto').createHash('sha256').update(bytes).digest('hex') }; },
  };
  const started = [], opened = [];
  const jobs = createJobs();
  const P = createPrograms({ fs, net, execFile, file: path.join(dir, 'programs.json'), expand: s => s, fullPrograms: path.join(dir, 'programs'),
    jobs, startExe: (n, exe, a, cwd) => started.push({ n, exe, cwd }), openUrl: u => opened.push(u) });
  P.load();
  return { dir, P, jobs, fetched, started, opened };
}
const waitJob = (jobs, id) => new Promise(res => { const t = setInterval(() => { const j = jobs.list().find(x => x.job === id); if (j && ['done', 'failed', 'cancelled'].includes(j.state)) { clearInterval(t); res(j); } }, 20); });

test('install: scrape → download → unpack with the lone top folder stripped → found → state written; then it launches', async () => {
  const { dir, P, jobs, started } = sandbox();
  const before = Object.fromEntries(P.list('user').map(p => [p.id, p.mode + (p.installed ? '+' : '')]));
  assert.deepEqual(before, { vendor: 'page', tool: 'install', plain: 'install', hashed: 'install' });
  const r = P.install(['tool'], 'user');
  assert.equal(r.started.length, 1);
  assert.equal(P.list('user').find(p => p.id === 'tool').job, r.started[0].job, 'the page can see the running job');
  const j = await waitJob(jobs, r.started[0].job);
  assert.equal(j.state, 'done', j.err);
  const exe = path.join(dir, 'programs', 'tool', 'Tool.exe');
  assert.ok(fs.existsSync(exe), 'Tool-1.2\\ was stripped: ' + exe);
  assert.ok(!fs.existsSync(path.join(dir, 'programs', '_staging', 'tool')), 'staging cleaned');
  assert.deepEqual(fs.readdirSync(path.join(dir, 'programs', '_downloads')), [], 'download removed');
  const st = JSON.parse(fs.readFileSync(path.join(dir, 'programs', '_state.json'), 'utf8')).tool;
  assert.match(st.sha256, /^[0-9a-f]{64}$/);
  assert.equal(st.version, '');
  assert.equal(P.list('user').find(p => p.id === 'tool').installed, true);
  assert.equal(P.launch('tool').ok, true);
  assert.equal(started[0].exe, exe);
  assert.deepEqual(P.install(['tool'], 'user').skipped, [{ id: 'tool', why: 'installed' }], 'never twice');
});

test('refusals: above the level, page entries, unknown ids, http sources, a wrong sha256', async () => {
  const { P, jobs, opened, dir } = sandbox();
  const r = P.install(['devtool', 'vendor', 'nope'], 'user');
  assert.deepEqual(r.started, []);
  assert.deepEqual(r.skipped.map(s => s.id + ':' + s.why), ['devtool:unknown', 'vendor:page', 'nope:unknown']);
  assert.equal(P.list('user').some(p => p.id === 'devtool'), false, 'a dev program is not listed at User');
  assert.equal(P.list('dev').some(p => p.id === 'devtool'), true);
  assert.equal(P.page('vendor').ok, true); assert.deepEqual(opened, ['https://vendor.test/']);
  assert.equal(P.launch('vendor').err, 'not-installed');
  const a = P.install(['plain', 'hashed'], 'user');
  const [jp, jh] = await Promise.all(a.started.map(s => waitJob(jobs, s.job)));
  assert.equal(jp.state, 'failed'); assert.match(jp.err, /^Plain: .*not https/);
  assert.equal(jh.state, 'failed'); assert.match(jh.err, /^Hashed: sha256/);
  assert.ok(!fs.existsSync(path.join(dir, 'programs', 'hashed')) || !fs.existsSync(path.join(dir, 'programs', 'hashed', 'Tool.exe')), 'nothing unpacked on a bad hash');
});

test('the dev category installs under dev\\<id>', async () => {
  const { P, jobs, dir } = sandbox();
  const r = P.install(['devtool'], 'dev');
  const j = await waitJob(jobs, r.started[0].job);
  assert.equal(j.state, 'done', j.err);
  assert.ok(fs.existsSync(path.join(dir, 'programs', 'dev', 'devtool', 'Tool.exe')));
});
