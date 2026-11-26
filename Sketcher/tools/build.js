#!/usr/bin/env node
// Sketcher/tools/build.js — builds Sketcher/dist/vrg-sketcher.html from src/ + lib/fieldkit.js + lib/takeoff.js + lib/report.js + lib/features.js + lib/roombox.js + lib/roombox-gl.js + lib/roombox-snap.js + lib/pano.js + lib/plane.js + lib/plane-ui.js + lib/house3d.js + lib/house3d-ui.js + ../Map/lib/site-math.js + catalog + variants.
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
  const features = JSON.parse(rd('catalog', 'features.json'));   // M51: the feature registry
  const data = '<script>window.VRG_FIELDKIT = ' + lit(kit) + ';\nwindow.VRG_VARIANTS = ' + lit(variants) + ';\nwindow.VRG_TAKEOFF_RULES = ' + lit(rules) + ';\nwindow.VRG_FEATURES = ' + lit(features) + ';</script>\n' +
    '<script>\n' + script(rd('lib', 'features.js')) + '\n</script>\n' +
    '<script>\n' + script(rd('lib', 'fieldkit.js')) + '\n</script>\n<script>\n' + script(rd('lib', 'takeoff.js')) + '\n</script>\n' +
    // F5: the Felmérési jegyzőkönyv
    '<script>\n' + script(rd('lib', 'report.js')) + '\n</script>\n' +
    // skcam K1: the Szobadoboz (the room in 3D with its Fotópont photos)
    '<script>\n' + script(rd('lib', 'roombox.js')) + '\n</script>\n<script>\n' + script(rd('lib', 'roombox-gl.js')) + '\n</script>\n' +
    '<script>\n' + script(rd('lib', 'roombox-snap.js')) + '\n</script>\n' +
    // skcam K4: the Körkép (aligning a photo point's neighbours, the 360° image)
    '<script>\n' + script(rd('lib', 'pano.js')) + '\n</script>\n' +
    // skcam K5: the Ház 3D viewer (a house3d.json point cloud, scale and measures)
    '<script>\n' + script(rd('lib', 'house3d.js')) + '\n</script>\n<script>\n' + script(rd('lib', 'house3d-ui.js')) + '\n</script>\n' +
    // skcam K3: the Síkmérés (measuring on a plane in one photo)
    '<script>\n' + script(rd('lib', 'plane.js')) + '\n</script>\n<script>\n' + script(rd('lib', 'plane-ui.js')) + '\n</script>\n' +
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
