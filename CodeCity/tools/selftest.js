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
  check(lines.length === 12 && spec.status === 0, `companion: all 12 cases ran (got ${lines.length}, exit ${spec.status})`);
  // the embedded terminal end to end (CITY-D15 C): a real ConPTY cmd.exe, only when Vendor/node-pty is there
  const ts = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-terminal.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(ts.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(ts.status === 0, `terminal spec exit ${ts.status}`);
  // the live repo end to end (P3, KV-08) on a throwaway fixture repo: edit -> fs event, commit -> git event + /api/city
  const lv = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-live.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(lv.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(lv.status === 0, `live spec exit ${lv.status}`);
  // live Claude (P4, KV-09): a fake `agents --json` and fixture transcripts -> agents + beam events, nothing more
  const ags = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-agents.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(ags.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(ags.status === 0, `agents spec exit ${ags.status}`);
  // fences and the conflict radar (P4, KV-11): two worktrees editing one file -> a conflict, on a fixture repo
  const fcs = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-fences.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(fcs.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(fcs.status === 0, `fences spec exit ${fcs.status}`);
  // supervised jobs (P6, KV-14): a fixture START.cmd server started, logged, port seen, stopped as a tree
  const jbs = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-jobs.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(jbs.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(jbs.status === 0, `jobs spec exit ${jbs.status}`);
  // git as metro lines (P7, KV-16): lines, a conflicting and a clean merge preview, nothing moved
  const mts = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-metro.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(mts.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(mts.status === 0, `metro spec exit ${mts.status}`);
  // cargo (P8, KV-19): a 100 MB browser download and a small .exe through a fixture Downloads folder
  const cgs = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-cargo.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(cgs.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(cgs.status === 0, `cargo spec exit ${cgs.status}`);
  // probe sidecar (P10, KV-21): a fake vrg-probe — Paint opens and closes, the probe crashes and comes back, no titles
  const prs = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-probe.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(prs.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(prs.status === 0, `probe spec exit ${prs.status}`);
  // elevated ETW (P11, KV-23): a fake vrg-etw pipe — exact cargo without addresses, a Bash read beams to its Claude session
  const ets = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-etw.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(ets.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(ets.status === 0, `etw spec exit ${ets.status}`);
  // wallpaper (P12 L0, KV-24): a ?wallpaper=1 listener starts no probe and polls claude agents slowly; a full page undoes it
  const wps = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-spec.js'), path.join(__dirname, 'spec-wallpaper.js')], { encoding: 'utf8', timeout: 90000 });
  for (const l of String(wps.stdout || '').trim().split('\n').filter(Boolean)) check(l.startsWith('ok'), l.replace(/^(ok|FAIL)\s+/, ''));
  check(wps.status === 0, `wallpaper spec exit ${wps.status}`);
  // overlay shell (P12 L2, KV-25): the Electron files parse with this Node, the shell loads only the segéd origin and
  // stays sandboxed; the page has #mode=overlay. The live check needs the desktop: electron CodeCity/shell --selftest
  const shellDir = path.join(__dirname, '..', 'shell');
  const parse = ['main.js', 'preload.js', 'selftest.js', 'transparency-test.js', 'portaltest.js', 'capture-test.js', 'thumb-test.js'].map(n => path.join(shellDir, n)).concat(path.join(__dirname, 'fetch-electron.js'))
    .every(p => require('child_process').spawnSync(process.execPath, ['--check', p]).status === 0);
  check(parse, 'overlay shell: main, preload, the tests, the capture probes and fetch-electron parse');
  const shellMain = fs.readFileSync(path.join(shellDir, 'main.js'), 'utf8');
  check(/sandbox: true/.test(shellMain) && /contextIsolation: true/.test(shellMain) && /nodeIntegration: false/.test(shellMain)
    && /will-navigate/.test(shellMain) && /action: 'deny'/.test(shellMain), 'overlay shell: sandboxed, context-isolated, no navigation off the segéd, no new windows');
  check(/mode'\) !== 'overlay'/.test(fs.readFileSync(path.join(__dirname, '..', 'src', '00-wallpaper.js'), 'utf8'))
    && JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vendor-manifest.json'), 'utf8')).components.some(c => c.slug === 'electron' && /^\d+\.\d+\.\d+$/.test(c.npmVersion) && /^sha512-/.test(c.npmIntegrity)),
    'overlay shell: #mode=overlay in the page; Electron pinned with sha512 in vendor-manifest.json');
  // the portal hand-off (KV-26): the shell sends handles and pictures, never a window title; the segéd moves only a window
  // the probe counts, with whole-pixel sizes; the page hands off only from the overlay
  const portalSrc = fs.readFileSync(path.join(__dirname, '..', 'src', '36-portal.js'), 'utf8'), comp = fs.readFileSync(path.join(__dirname, '..', 'companion.js'), 'utf8');
  check(!/\.name\b/.test(shellMain.slice(shellMain.indexOf('async function sendSources'), shellMain.indexOf('ipcMain.on(')))
    && /'probe-place': \{ keys: \['h', 'x', 'y', 'w', 'hh'\]/.test(comp) && /if \(!probe\.wins\.has\(cmd\.h\)\) return \[404/.test(comp)
    && /if \(!sc \|\| pt\.cur \|\| !window\.kvShell\) return;/.test(portalSrc) && /if \(!KV_OVERLAY/.test(portalSrc),
    'portal hand-off: no window titles to the page, probe-place only for a counted window, only inside the overlay');

  // ---- R1–R12 and the trademark limits (P13, KV-27; report §5.5, §4; audit: docs/city/wp/p13-rules.md)
  const src = n => fs.readFileSync(path.join(__dirname, '..', 'src', n), 'utf8');
  const allSrc = fs.readdirSync(path.join(__dirname, '..', 'src')).filter(n => /^\d\d-.*\.js$/.test(n)).map(src).join('\n');
  const lensSrc = src('07-lens.js'), liveSrc = src('22-live.js'), uiSrc = src('04-ui.js'), appsSrc = src('33-apps.js');
  check(/let lens = LENSES\.find\(l => l\.id === 'alap'\)/.test(lensSrc) && /Math\.pow\(0\.97,/.test(liveSrc),
    'R1 grey-normal: the plain night lens is the default; a change pulse fades by time (~2 s), nothing blinks for ever');
  const lensCount = (lensSrc.match(/\bid: '[a-z]+'/g) || []).length, legendCount = (lensSrc.match(/\blegend: \(\) =>/g) || []).length;
  check(lensCount >= 6 && legendCount >= lensCount && /landLabel\(a\.name/.test(appsSrc), 'R2 colour never alone: every lens has a worded legend, every construct a name label');
  check(/ablakok: friss munka világít/.test(lensSrc), 'R3 one animation, one meaning: the legend names what the window light means');
  check(/it = apMake\(a, slot\)/.test(appsSrc) && /for \(const it of ap\.items\.values\(\)\) if \(!seen\.has\(it\.key\)/.test(appsSrc), 'R4 signage only for the active: a construct and its sign live only while its program has a window');
  check(/let slot = ap\.slots\.indexOf\(null\)/.test(appsSrc) && /ap\.slots\[it\.slot\] = null/.test(appsSrc), 'R5 places never move: a construct keeps its ring slot while it lives; freed slots are reused');
  check(/function ptPortal/.test(src('36-portal.js')) && /function openPanel/.test(uiSrc), 'R6 3D for overview, flat panels for reading, the portal hand-off to the real window');
  check(/e\.key === 'k' \|\| e\.key === 'K'/.test(src('18-palette.js')) && /\^\[1-6\]\$/.test(lensSrc) && /e\.key === 'l' \|\| e\.key === 'L'/.test(src('37-look.js')),
    'R7 keyboard paths: Ctrl+K palette, 1–6 lenses, U roads, L low glow');
  check(/classList\.toggle\('on', x\.dataset\.lens === lens\.id\)/.test(lensSrc) && /id="q" type="search"/.test(src('shell.html')),
    'R8 the active lens is lit in the always-visible lens bar; the filter stays in the search box (no separate chips yet — audit)');
  check(/id="live-dot"/.test(src('shell.html')) && /id="legend"/.test(src('shell.html')), 'R9 status on the object plus one fixed place: the ● élő badge and the legend corner');
  const flights = [...allSrc.matchAll(/flyCamera\(([^;]*?),\s*(\d+)\)/g)].map(m => +m[2]);
  check(flights.length > 3 && flights.every(ms => ms === 0 || ms >= 400) && /\/ 450\)/.test(src('08-roads.js')), `R10 camera tweens ≥ 400 ms (or an explicit instant snap): ${flights.join(', ')} ms`);
  // R11: a shot check — the low-glow shot has clearly fewer bright pixels than the default (docs/city/design-pack)
  const pngLum = file => {   // a minimal PNG reader: 8-bit RGB/RGBA, no interlace — what headless Chrome writes
    const b = fs.readFileSync(file), zl = require('zlib'); let o = 8, w = 0, h = 0, ct = 0; const idat = [];
    while (o < b.length) { const n = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n);
      if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'IDAT') idat.push(d); o += 12 + n; }
    const bpp = ct === 6 ? 4 : 3, raw = zl.inflateSync(Buffer.concat(idat)), stride = w * bpp, cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
    let bright = 0, tot = 0;
    for (let y = 0; y < h; y++) {
      const ft = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let i = 0; i < stride; i++) { const A = i >= bpp ? cur[i - bpp] : 0, B = prev[i], C = i >= bpp ? prev[i - bpp] : 0;
        const p = A + B - C, pa = Math.abs(p - A), pb = Math.abs(p - B), pc = Math.abs(p - C);
        cur[i] = (row[i] + [0, A, B, (A + B) >> 1, pa <= pb && pa <= pc ? A : pb <= pc ? B : C][ft]) & 255; }
      if (y >= 60 && y % 2 === 0) for (let x = 0; x < w; x += 2) { const q = x * bpp; tot++; if (0.3 * cur[q] + 0.59 * cur[q + 1] + 0.11 * cur[q + 2] > 150) bright++; }
      cur.copy(prev);
    }
    return bright / tot;
  };
  const pack = path.join(__dirname, '..', '..', 'docs', 'city', 'design-pack');
  const lumA = pngLum(path.join(pack, 'alap.png')), lumH = pngLum(path.join(pack, 'halk.png'));
  check(/lookGlow\(delta \? 0\.3 : lens\.gain\)/.test(lensSrc) && /renderer\.render\(scene, camera\); afterRender\(\); lookFrame\(\);/.test(src('03-scene.js')) && lumH < lumA * 0.85,
    `R11 low glow + render on demand: halk.png has ${(100 * lumH).toFixed(2)} % bright pixels vs alap.png ${(100 * lumA).toFixed(2)} %`);
  check(/R12 \(report §5\.5\): fixed field order/.test(uiSrc) && uiSrc.indexOf("['Fő szerző'") < uiSrc.indexOf("['Nyelv', f.lang]") && uiSrc.indexOf("['Nyelv', f.lang]") < uiSrc.indexOf("['Első commit'"),
    'R12 the file card: name · owner · state · time');
  // Mélyvíz skin (CITY-D26, docs/city/melyviz.md): M1 ice = the instrument, M2/M3 click-only water on demand, M4 lens, M5 square glass
  const seaSrc = src('38-sea.js'), css = src('city.css');
  check(/--accent: #93d3e6/.test(css) && /color: 0x93d3e6, transparent: true, opacity: 0\.35/.test(src('03-scene.js')) && /'#93d3e6'/.test(src('10-query.js')),
    'M1 Mélyvíz: ice is the instrument (accent, beacon, query brackets); warm light stays the code\'s activity');
  check(/id="sea"/.test(src('shell.html')) && /pickAt\(e\)\) return;\s*seaDrop/.test(seaSrc) && !/setInterval|Math\.random/.test(seaSrc),
    'M2 Mélyvíz: the water moves only on a plain click on empty water (no rain, no timers)');
  check(/if \(!sea\.live\) \{ sea\.running = false; seaDraw\(\); return; \}/.test(seaSrc) && /KV_WALL\) return/.test(seaSrc) && /KV_OVERLAY\)/.test(seaSrc),
    'M3 Mélyvíz: the water simulates only while a wave lives, then stops; none on the wallpaper or the overlay');
  check(/seaLens\(lens\)/.test(lensSrc) && /wd\.group\.visible = o > 0\.01/.test(src('32-world.js')),
    'M4/M7 Mélyvíz: the water follows the lens; the planet ocean fades out near the Land');
  check(!/border-radius:\s*[1-9]\d*px/.test(css) && /backdrop-filter: blur\(var\(--blur\)\)/.test(css) && /body\[data-quality\^="low"\]/.test(css),
    'M5 Mélyvíz: square glass panels with cut corners, solid on the low quality tier');
  // trademark limits (report §4): no Tron terms in user-visible text — the page, the shell, START.cmd's menu lines
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const uiFiles = fs.readdirSync(path.join(__dirname, '..', 'src')).filter(n => /\.(js|css|html)$/.test(n)).map(n => path.join(__dirname, '..', 'src', n))
    .concat(['main.js', 'preload.js'].map(n => path.join(shellDir, n)));
  const tm = /\btron\b|derezz|\brecognizer\b|\bencom\b|braindance|\bctos\b|i\/o tower|light[- ]?cycle|identity disc/i;
  const tmHits = uiFiles.flatMap(p => strip(fs.readFileSync(p, 'utf8')).split('\n').filter(l => tm.test(l) || /\bGrid\b/.test(l)).map(l => path.basename(p) + ': ' + l.trim().slice(0, 60)))
    .concat(fs.readFileSync(path.join(__dirname, '..', '..', 'Planner', 'START.cmd'), 'utf8').split('\n').filter(l => /^\s*(if .* )?echo/i.test(l) && (tm.test(l) || /\bGrid\b/.test(l))));
  check(tmHits.length === 0, 'trademark limits: no Tron terms in user-visible text' + (tmHits.length ? ' — ' + tmHits.slice(0, 3).join(' | ') : ''));
} finally {
  if (process.env.KEEP_FIXTURE === '1') console.log('fixture kept: ' + dir);
  else { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(dir + '-tx', { recursive: true, force: true }); }
}
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
