// End-to-end: Planner (jsdom; PLANNER=<build with 07e>) <-> real relay <-> real bridge <-> fake CYD (here).
// NODE_PATH must point at varler-planner/node_modules (jsdom). Run: node e2e_planner.js
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const P = path.join(__dirname, '../../../../Planner/projects/varler-planner');   // <repo>/Firmware/planner-cyd/app/tools
const DIST = process.env.PLANNER || path.join(P, 'dist/varler_planner.html');   // a build that includes src/07e-dash-link.js
const BRIDGE = path.join(__dirname, '../bridge/bridge.js');
const RELAY_PORT = 47391, CYD_PORT = 7789;
const procs = [];
const R = [];
const ok = (n, c, x) => { R.push([n, !!c, x || '']); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];   // what the fake CYD received

function run(cmd, args, tag) {
  const p = spawn(process.execPath, args, { cwd: path.dirname(cmd), stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => process.env.V && process.stdout.write(`[${tag}] ${d}`));
  p.stderr.on('data', d => process.stdout.write(`[${tag} ERR] ${d}`));
  procs.push(p);
  return p;
}

let cyd = null;
const press = l => { lines.push('<<< ' + l); cyd.write(l + '\n'); };
const last = re => { for (let i = lines.length - 1; i >= 0; i--) if (re.test(lines[i])) return lines[i]; return null; };

(async () => {
  net.createServer(s => {
    cyd = s;
    let rx = '';
    s.setEncoding('utf8');
    s.on('error', () => {});
    s.on('data', b => { rx += b; let i; while ((i = rx.indexOf('\n')) >= 0) { const l = rx.slice(0, i); rx = rx.slice(i + 1); if (!/^L\|/.test(l) || process.env.BEATS) lines.push(l); if (/^L\|/.test(l)) lines.lastL = l; } });
  }).listen(CYD_PORT, '127.0.0.1');

  run(path.join(P, 'tools/phone-relay-server.js'), [path.join(P, 'tools/phone-relay-server.js'), String(RELAY_PORT)], 'relay');
  await sleep(800);
  // the START button opens a harmless stand-in that only leaves a marker file
  const os = require('os');
  const STUB = path.join(os.tmpdir(), 'cyd_start_stub.cmd'), MARK = path.join(os.tmpdir(), 'cyd_start_opened.txt');
  try { fs.unlinkSync(MARK); } catch (e) {}
  // one MAKROK button: a Planner action
  const MACROS = path.join(os.tmpdir(), 'cyd_macros_test.json');
  fs.writeFileSync(MACROS, JSON.stringify([{ label: 'Blueprint nézet', color: '#3A4F7A', type: 'planner', value: 'view.style.blueprint' }]));
  fs.writeFileSync(STUB, `@echo off\r\necho opened> "${MARK}"\r\nexit\r\n`);
  run(BRIDGE, [BRIDGE, '--relay', `ws://127.0.0.1:${RELAY_PORT}`, '--tcp', `127.0.0.1:${CYD_PORT}`, '--name', 'Teszt PC', '--start', STUB, '--macros', MACROS], 'bridge');

  const dom = new JSDOM(fs.readFileSync(DIST, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  await sleep(1500);
  w.confirm = () => true; w.alert = () => {}; w.prompt = () => null;
  const ev = s => { try { return w.eval(s); } catch (e) { return 'ERR:' + e.message; } };
  ev('hardResetWorkspace()');
  ok('PLANNER_DASH is in the build', ev('typeof PLANNER_DASH') === 'object');
  ok('no polling while the link is down', ev('PLANNER_DASH.stats().polling') === false);
  const snap = ev('JSON.stringify(PLANNER_DASH.snapshot())');
  let s0 = null; try { s0 = JSON.parse(snap); } catch (e) {}
  ok('snapshot: 6 phases, tools of the current phase, totals', s0 && s0.phases.length === 6 && s0.tools.length > 0 && s0.totals, snap && snap.slice(0, 200));

  ev(`PLANNER_LINK.connect('ws://127.0.0.1:${RELAY_PORT}')`);
  await sleep(2500);
  ok('link up, polling', ev('PLANNER_LINK.isUp()') === true && ev('PLANNER_DASH.stats().polling') === true);
  ok('CYD got N| with the PC name', lines.includes('N|Teszt PC'));
  ok('CYD heartbeat says Planner live (L|1)', lines.lastL === 'L|1', lines.lastL);
  ok('CYD got a status line', !!last(/^S\|/), last(/^S\|/));
  ok('CYD got 6 phases (R|6)', !!last(/^R\|6$/));
  ok('CYD got the PLANNER banner', !!last(/^E\|1\|PLANNER\|/));
  ok('level arrives with its accents (FÖLDSZINT)', /^S\|[^|]*\|FÖLDSZINT\|/.test(last(/^S\|/) || ''), last(/^S\|/));
  ok('CYD got the ÓRA button (B|<file> megnyitása)', lines.includes('B|cyd_start_stub.cmd megnyitása'), lines.find(l => /^B\|/.test(l)));
  const y = last(/^Y\|/), now = Math.floor(Date.now() / 1000);
  ok('CYD got the clock (Y|utc|tz)', y && Math.abs(Number(y.split('|')[1]) - now) < 10 && y.split('|')[2] === String(-new Date().getTimezoneOffset()), y);
  const z = last(/^Z\|/);
  ok('tab in use → Z|0 with the tab\'s input time', z && z.split('|')[1] === '0' && now - Number(z.split('|')[2]) <= 40, z);

  press('!P|0'); await sleep(900);
  ok('!P|0 → Planner phase alap', ev('state.wfPhase') === 'alap', ev('state.wfPhase'));
  ok('… S| reports phase 0 Alapozás', /^S\|[^|]*\|[^|]*\|0\|Alapozás\|/.test(last(/^S\|/) || ''), last(/^S\|/));
  const k0 = last(/^K\|0\|/);
  ok('… K|0 is Helyiség-toll (accents kept, emoji dropped)', k0 === 'K|0|Helyiség-toll|', k0);

  press('!T|0'); await sleep(900);
  ok('!T|0 → room pen running', ev('state.mode') === 'room', ev('state.mode'));
  ok('… K|0 lit (a)', last(/^K\|0\|/) === 'K|0|Helyiség-toll|a', last(/^K\|0\|/));
  ok('… S| tool field = Helyiség-toll', /\|Helyiség-toll\|/.test(last(/^S\|/) || ''), last(/^S\|/));

  press('!T|0'); await sleep(900);
  ok('tap again → back to Select', ev('state.mode') === 'select' && ev('toolCurrent()') === null, ev('state.mode'));

  press('!P|2'); await sleep(700);
  press('!T|1'); await sleep(900);
  ok('!P|2 then !T|1 → Vezethető fal pen live', ev('toolCurrent()&&toolCurrent().id') === 'wf.routeWalls', ev('JSON.stringify(toolCurrent())'));
  press('!C|stop'); await sleep(900);
  ok('!C|stop → nothing running', ev('toolCurrent()') === null);

  const v0 = ev('state.flat');
  press('!C|view3d'); await sleep(900);
  ok('!C|view3d toggles 2D/3D', ev('state.flat') !== v0, v0 + ' → ' + ev('state.flat'));
  press('!C|view3d'); await sleep(600);

  press('!C|lvlup'); await sleep(900);
  const ackLine = last(/^E\|/);
  ok('!C|lvlup → level changes or a refusal banner', /\|[^|]*\|/.test(last(/^S\|/) || '') && ackLine, `level=${ev('state.active')} last banner=${ackLine}`);

  press('!C|esc'); await sleep(500);

  ok('CYD got the MAKROK button (M|0 … X|1)', lines.includes('M|0|Blueprint nézet|3A4F7A') && lines.includes('X|1'));
  press('!M|0'); await sleep(900);
  ok('!M|0 → the Planner switches to blueprint view', ev('state.style') === 'blueprint', ev('state.style'));

  press('!O|start'); await sleep(2500);
  ok('!O|start → the bridge opens its configured file', fs.existsSync(MARK) && !!last(/^E\|1\|MEGNYITVA\|cyd_start_stub\.cmd/), last(/^E\|/));
  ok('!C|esc arrives without error', !lines.some(l => /NEM SIKERÜLT\|Esc/.test(l)));

  // the tab closes: the CYD must hear about it
  ev('PLANNER_LINK.disconnect()');
  await sleep(7500);
  ok('tab gone → L|0 and a banner', lines.lastL === 'L|0' && !!last(/^E\|2\|PLANNER\|nincs kapcsolat/), lines.lastL);
  press('!C|undo'); await sleep(400);
  ok('a press with no tab → NINCS PLANNER banner', !!last(/^E\|2\|NINCS PLANNER/));

  const bad = R.filter(r => !r[1]).length;
  R.forEach(r => console.log((r[1] ? 'PASS ' : 'FAIL ') + r[0] + (r[2] && !r[1] ? '   [' + r[2] + ']' : '')));
  console.log(`\n${R.length - bad}/${R.length} passed`);
  if (process.env.DUMP) console.log(lines.join('\n'));
  procs.forEach(p => p.kill());
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); procs.forEach(p => p.kill()); process.exit(2); });
