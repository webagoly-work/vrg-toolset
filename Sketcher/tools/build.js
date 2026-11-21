#!/usr/bin/env node
// Sketcher/tools/build.js — builds Sketcher/dist/vrg-sketcher.html from src/ + lib/fieldkit.js + lib/takeoff.js + ../Map/lib/site-math.js + catalog + variants.
//
//   node Sketcher/tools/build.js          write the dist page
//   node Sketcher/tools/build.js --check  exit 1 when the committed dist is stale
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const OUT = path.join(ROOT, 'dist', 'vrg-sketcher.html');

// a JSON literal that is safe inside <script>
const lit = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const script = code => { if (/<\/script/i.test(code)) throw new Error('"</script" inside inlined code'); return code; };

function build() {
  const kit = JSON.parse(rd('catalog', 'fieldkit.json'));
  const variants = fs.readdirSync(path.join(ROOT, 'variants')).filter(f => f.endsWith('.json')).sort()
    .map(f => JSON.parse(rd('variants', f)));
  const css = rd('src', 'app.css'), js = rd('src', 'app.js');
  const rules = JSON.parse(rd('catalog', 'takeoff.json'));
  const data = '<script>window.VRG_FIELDKIT = ' + lit(kit) + ';\nwindow.VRG_VARIANTS = ' + lit(variants) + ';\nwindow.VRG_TAKEOFF_RULES = ' + lit(rules) + ';</script>\n' +
    '<script>\n' + script(rd('lib', 'fieldkit.js')) + '\n</script>\n<script>\n' + script(rd('lib', 'takeoff.js')) + '\n</script>\n' +
    // F1: the sketch on the building, the same maths as the map page and the phone
    '<script>\n' + script(fs.readFileSync(path.join(ROOT, '..', 'Map', 'lib', 'site-math.js'), 'utf8')) + '\n</script>\n<script>\n' + script(js) + '\n</script>';
  const page = rd('src', 'page.html');
  if (!page.includes('<!--BUILD:css-->') || !page.includes('<!--BUILD:js-->')) throw new Error('page.html lacks its build markers');
  return page.replace('<!--BUILD:css-->', () => '<style>\n' + css + '\n</style>').replace('<!--BUILD:js-->', () => data);
}

const html = build();
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (cur !== html) { console.error('dist/vrg-sketcher.html is stale: run node Sketcher/tools/build.js'); process.exit(1); }
  console.log('dist/vrg-sketcher.html is current');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log('wrote dist/vrg-sketcher.html (' + html.length + ' bytes)');
}
