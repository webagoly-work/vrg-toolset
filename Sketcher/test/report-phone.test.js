// Sketcher/test/report-phone.test.js — the jegyzőkönyv as the phone makes it (WP M54, F9): report-phone.js over the
// shared field package, with the phone's kind of input (the photos as data: URLs, the drawing from the SVG fixture).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const FK = require('../lib/fieldkit.js'), R = require('../lib/report.js'), TK = require('../lib/takeoff.js'), P = require('../lib/report-phone.js');
const rd = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };

const pkg = rd('Planner/projects/varler-planner/tests/sketch-field.json');
const fx = rd('Sketcher/test/fixtures/report.json');
const catalog = rd('Sketcher/catalog/fieldkit.json'), rules = TK.parseRules(rd('Sketcher/catalog/takeoff.json'));
const S = JSON.parse(JSON.stringify(pkg.sketch));
const NOW = Date.UTC(2026, 10, 21, 10, 0);
S.captures = [
  { id: 'C1', file: 'a.jpg', purpose: 'eloszto', at: NOW, kind: 'photo', note: 'az elosztó' },
  { id: 'C2', file: 'b.jpg', purpose: 'egyeb', at: NOW, kind: 'photo', privacy: true },
  { id: 'C3', file: 'c.png', purpose: 'egyeb', at: NOW, kind: 'signature', signer: 'Minta Ügyfél' },
];
const kit = FK.withVariant(FK.parseKit(catalog), null);
const t = TK.build(kit, rules, S, TK.planFromPackage(pkg), { now: NOW });
const dot = 'data:image/jpeg;base64,/9j/AA==';
const input = { survey: S, takeoff: t, catalog, variant: null, rooms: pkg.plan.data.floors.map(f => ({ id: f.sk.id, name: f.name })),
  photos: { C1: dot, C3: 'data:image/png;base64,iVBO' }, withheld: ['C2'], planSvg: fx.cases[0].svg, siteSvg: fx.cases[2].svg, siteLines: fx.cases[2].lines, now: NOW };
const html = P.render(input, FK, R);
ok(/^<!doctype html>/.test(html) && /Felmérési jegyzőkönyv/.test(html), 'a whole document');
ok(html.includes('<img src="' + dot + '"'), 'the photo as a data: URL, so the file opens anywhere');
ok(/C2 · személyes adat, elmosás nélkül nem kerül bele/.test(html) && !html.includes('b.jpg'), 'an unblurred personal photo stays out');
ok(html.includes('alt="aláírás"') && html.includes('Minta Ügyfél'), 'the signature');
ok(html.includes('id="plansvg"') && html.includes('class="siteplace"') && html.includes(fx.cases[2].lines[0]), 'the drawing and the site');
ok(html.includes('Kelt: 2026. 11. 21.'), 'dated by the phone');
// the same as the Desktop would print for the same inputs (one renderer)
const desk = R.html(R.model(kit, S, t, { now: NOW, roomName: id => (input.rooms.find(r => r.id === id) || {}).name || id, photoUrl: c => input.photos[c.id] || null,
  planSvg: input.planSvg, siteSvg: input.siteSvg, siteLines: input.siteLines, withheld: c => c.id === 'C2' }));
ok(/C2 \(nincs csatolva\)/.test(R.html(R.model(kit, S, t, { now: NOW }))), 'on the Desktop an unattached photo is only "nincs csatolva"');
ok(desk === html, 'report-phone.js prints what report.js prints on the Desktop');
// in the WebView: VRGIn bridge
const got = {}; const root = { VRGIn: { input: () => JSON.stringify(input), done: h => { got.html = h; }, fail: m => { got.err = m; } }, VRGFieldKit: FK, VRGReport: R };
const vm = require('vm'); vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'lib', 'report-phone.js'), 'utf8') + '\nself.VRGReportPhone.run();', { self: root, VRGIn: root.VRGIn });
ok(got.html === html && !got.err, 'run() through the bridge: ' + (got.err || ''));
const bad = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'lib', 'report-phone.js'), 'utf8') + '\nself.VRGReportPhone.run();',
  { self: { VRGIn: { input: () => '{"catalog":{}}', done: h => { bad.html = h; }, fail: m => { bad.err = m; } }, VRGFieldKit: FK, VRGReport: R } });
ok(!bad.html && /not a field kit/.test(bad.err || ''), 'a broken input answers fail()');
// the asset list the APK bundles (feature-sketch/build.gradle.kts) is these files, and they are the ones here
const gradle = fs.readFileSync(path.join(ROOT, 'Mobile/android/feature-sketch/build.gradle.kts'), 'utf8');
const m = /REPORT_ASSETS\s*=\s*listOf\(([^)]*)\)/.exec(gradle);
const list = m ? m[1].split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean) : [];
ok(JSON.stringify(list) === JSON.stringify(['fieldkit.js', 'report.js', 'report-phone.js']), 'the APK bundles fieldkit.js, report.js, report-phone.js: ' + list);
ok(list.every(f => fs.existsSync(path.join(__dirname, '..', 'lib', f))), 'every bundled file is in Sketcher/lib');
ok(/sketcher\/report\//.test(gradle), 'into assets sketcher/report/');

console.log(fail ? fail + ' FAILED, ' + pass + ' passed' : 'ALL PASS (' + pass + ')');
process.exit(fail ? 1 : 0);
