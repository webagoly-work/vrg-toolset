// logo.json + marks.js + engine.js -> divergence.js, the single dependency-free file every page loads.
// Run from anywhere: node shared/varler-logo/build.js
const fs = require('fs'); process.chdir(__dirname);
const L = JSON.parse(fs.readFileSync('logo.json', 'utf8')), C = L.contours;
const path = c => 'M' + c.q.map(p => p[0] + ' ' + p[1]).join('L') + 'Z';
const groups = { bulb: [0], leaf: [1], base: [2, 3, 4], word: [5, 6, 7, 8, 9, 10, 11, 12] };
const { MARKS } = require('./marks');
const data = { marks: MARKS }; for (const k in groups) data[k] = groups[k].map(i => path(C[i])).join('');
// fit the globe circle to the top arc of the bulb outline
const pts = C[0].q.filter(p => p[1] < 230);
let cx = 499.5, cy = 262, r = 187;
for (let it = 0; it < 200; it++) {
  let dx = 0, dy = 0, dr = 0;
  for (const [x, y] of pts) { const d = Math.hypot(x - cx, y - cy); if (d < r - 15) continue; const e = d - r; dx += e * (x - cx) / d; dy += e * (y - cy) / d; dr += e; }
  const n = pts.length; cx += dx / n; cy += dy / n; r += dr / n;
}
// outer radius per half degree, furthest crossing of the bulb outline on each ray, clockwise from straight down
const lut = [], Q = C[0].q;
for (let i = 0; i < 720; i++) {
  const a = (i / 2 - 180) * Math.PI / 180, ux = Math.sin(a), uy = -Math.cos(a); let best = 0;
  for (let k = 0; k < Q.length; k++) {
    const [x1, y1] = Q[k], [x2, y2] = Q[(k + 1) % Q.length], ex = x2 - x1, ey = y2 - y1, det = ux * -ey + ex * uy; if (Math.abs(det) < 1e-9) continue;
    const fx = x1 - cx, fy = y1 - cy, t = (fx * -ey + ex * fy) / det, s = (ux * fy - uy * fx) / det;
    if (s >= 0 && s <= 1 && t > best) best = t;
  }
  const deg = i / 2 - 180; if (deg > 90 && deg < 122) best = 178; // close the open end of the ring for the eclipse disc
  lut.push(+best.toFixed(1));
}
const head = `(function () {\n'use strict';\nvar DATA = ${JSON.stringify({ cx: +cx.toFixed(2), cy: +cy.toFixed(2), ...data })};\nvar LUT = ${JSON.stringify(lut)};\n`;
fs.writeFileSync('divergence.js', head + fs.readFileSync('engine.js', 'utf8') + '})();\n');
console.log({ cx, cy, r, size: fs.statSync('divergence.js').size, sample: lut.filter((_, i) => i % 60 === 0) });
