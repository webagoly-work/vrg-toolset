// sheet.js — tiny SVG sheet builder + PNG render through the repo's portable headless Chrome
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
// a worktree has no tools folder next to it — fall back to the main checkout's portable Chrome
const CHROME = [path.resolve(__dirname, '../../../../../../tools/chrome-headless-shell/chrome-headless-shell.exe'),
  'H:/VRG/Full/tools/chrome-headless-shell/chrome-headless-shell.exe', process.env.CHROME || '']
  .find(p => p && fs.existsSync(p)) || '';

// rooms, walls and openings. With opt.lp (a labels.js placer) the room names and opening ids go through it, so no
// later label can land on them and they never sit on each other.
function base(G, opt = {}) {
  let s = ''; const lp = opt.lp;
  G.rooms.forEach(r => { s += `<polygon points="${r.poly.map(p => p.join(',')).join(' ')}" fill="${opt.roomFill || '#f4f1ea'}"/>`; });
  G.walls.forEach(w => { s += `<rect x="${w.x0}" y="${w.y0}" width="${w.x1 - w.x0}" height="${w.y1 - w.y0}" fill="${opt.wallFill || '#bdb6a8'}"/>`; });
  (G.D.openings || []).filter(o => o.level === G.level).forEach(o => { const w = o.w || (o.type === 'door' ? 900 : 1200), v = Math.abs(Math.sin(o.ang || 0)) > .5;
    s += `<rect x="${o.x - (v ? 160 : w / 2)}" y="${o.y - (v ? w / 2 : 160)}" width="${v ? 320 : w}" height="${v ? w : 320}" fill="${o.type === 'door' ? '#fff' : '#d6ecf7'}" stroke="#777" stroke-width="12"/>`;
    if (lp) { lp.blockRect(o.x - (v ? 160 : w / 2), o.y - (v ? w / 2 : 160), o.x + (v ? 160 : w / 2), o.y + (v ? w / 2 : 160)); // a window's id goes to the end of its rectangle: the shutter point sits at its middle
      const e = o.type === 'window' ? w / 2 - 130 : 0; lp.fixed({ x: o.x + (v ? 0 : e), y: o.y + (v ? e : 0), text: o.id, size: opt.opSize || 80, color: '#456' }); }
    else s += `<text x="${o.x}" y="${o.y + 40}" font-size="110" text-anchor="middle" fill="#456">${o.id}</text>`; });
  G.rooms.forEach(r => { const c = roomCentre(r), t = `${r.id} ${r.name}`;
    // the name fits its room: a narrow room gets a smaller one (a wide name would be pushed into the next room)
    const fit = Math.max(70, Math.min(opt.roomSize || 150, (c.w * .9) / (t.length * .6 * 1.08)));
    if (lp) lp.add({ x: c[0], y: c[1], text: t, size: Math.round(fit), color: '#bdb4a3', weight: 600, r: 0, pri: 100, center: true });
    else s += `<text x="${c[0]}" y="${c[1]}" font-size="200" fill="#c9c2b4" text-anchor="middle">${t}</text>`; });
  return s;
}
// a point well inside the room: the centre of the largest axis-aligned cell of its outline grid
function roomCentre(r) {
  const xs = [...new Set(r.poly.map(p => p[0]))].sort((a, b) => a - b), ys = [...new Set(r.poly.map(p => p[1]))].sort((a, b) => a - b);
  const inP = (x, y) => { let c = false; const P = r.poly; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  let best = null;
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) { const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2, A = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
    if (inP(cx, cy) && (!best || A > best.A)) best = { A, c: Object.assign([cx, cy], { w: xs[i + 1] - xs[i] }) }; }
  return best ? best.c : Object.assign([...r.poly[0]], { w: 1000 });
}
function write(file, body, view, opt = {}) {
  const [X, Y, W, H] = view, px = opt.px || 2400;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${X} ${Y} ${W} ${H}" width="${px}" height="${Math.round(px * H / W)}" font-family="Segoe UI,Arial">` +
    `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="#fff"/>${body}</svg>`;
  fs.writeFileSync(file.replace(/\.png$/, '.svg'), svg);
  if (/\.png$/.test(file) && fs.existsSync(CHROME)) {
    const html = file.replace(/\.png$/, '.tmp.html');
    fs.writeFileSync(html, `<!doctype html><meta charset=utf-8><body style="margin:0">${svg}`);
    try { execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      `--window-size=${px},${Math.round(px * H / W)}`, `--screenshot=${path.resolve(file)}`, 'file:///' + path.resolve(html).replace(/\\/g, '/')], { stdio: 'ignore' }); }
    finally { fs.unlinkSync(html); }
  }
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
module.exports = { base, write, esc, roomCentre };
