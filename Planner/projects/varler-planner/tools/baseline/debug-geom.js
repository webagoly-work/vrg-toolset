// debug-geom.js — draws faces (wall / open), the sketch-derived allowed intervals and the off-wall segments
'use strict';
const fs = require('fs'), path = require('path');
const geom = require('./geom'), sheet = require('./sheet');
const [, , inFile, outDir] = process.argv;
const doc = JSON.parse(fs.readFileSync(inFile, 'utf8')), G = geom.load(doc);
const { allowed, offWall } = geom.allowedFromSketch(G, G.D.paths);
let s = sheet.base(G);
// allowed intervals: thick green along the wall axis
Object.entries(allowed).forEach(([wid, iv]) => { const w = G.wallById[wid];
  iv.forEach(([a, b]) => { const mx = (w.x0 + w.x1) / 2, my = (w.y0 + w.y1) / 2;
    s += w.axis === 'x' ? `<line x1="${a}" y1="${my}" x2="${b}" y2="${my}" stroke="#2e9e5b" stroke-width="90" stroke-opacity=".7"/>`
                        : `<line x1="${mx}" y1="${a}" x2="${mx}" y2="${b}" stroke="#2e9e5b" stroke-width="90" stroke-opacity=".7"/>`; }); });
// faces: blue = on a wall, red = open
G.rooms.forEach(r => r.faces.forEach(f => { const k = 40 * f.inward, c = f.wall ? '#2f6fb0' : '#d1493f';
  s += f.horiz ? `<line x1="${f.lo}" y1="${f.fix + k}" x2="${f.hi}" y2="${f.fix + k}" stroke="${c}" stroke-width="22"/>`
               : `<line x1="${f.fix + k}" y1="${f.lo}" x2="${f.fix + k}" y2="${f.hi}" stroke="${c}" stroke-width="22"/>`; }));
offWall.forEach(o => { s += `<line x1="${o.a[0]}" y1="${o.a[1]}" x2="${o.b[0]}" y2="${o.b[1]}" stroke="#e6a800" stroke-width="40" stroke-dasharray="120 80"/>`; });
fs.mkdirSync(outDir, { recursive: true });
sheet.write(path.join(outDir, 'debug-geom.png'), s, [300, 1900, 10500, 7700]);
console.log('allowed walls:', Object.entries(allowed).map(([k, v]) => k + ' ' + v.map(x => x.map(Math.round).join('–')).join(',')).join(' | '));
console.log('off-wall segments:', offWall.length, offWall.map(o => o.path).join(' '));
G.rooms.forEach(r => console.log(r.id, r.faces.map(f => (f.wall || 'OPEN') + '[' + Math.round(f.lo) + '–' + Math.round(f.hi) + ']').join(' ')));
