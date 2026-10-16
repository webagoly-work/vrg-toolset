// labels.js — non-overlapping labels for the sheets (the user's rule 2026-10-12: every number readable, nothing on top
// of anything). Greedy: labels in priority order, each tries rings of candidate spots around its anchor and takes the
// first one that touches no placed label and no registered marker; a label pushed away from its anchor gets a leader.
'use strict';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// average glyph widths of Segoe UI in em (close enough to keep a 15 % margin)
const GW = ch => /[0-9]/.test(ch) ? .56 : /[A-ZÁÉÍÓÖŐÚÜŰ]/.test(ch) ? .66 : /[mwMW]/.test(ch) ? .82 : /[ilj.,:;'|!·]/.test(ch) ? .28 : ch === ' ' ? .28 : /[×+=<>→←↑↓]/.test(ch) ? .62 : .54;
const textW = (t, size) => [...String(t)].reduce((a, c) => a + GW(c), 0) * size * 1.08;

function create(opt = {}) {
  const placed = [], blocks = [], items = [], bounds = opt.bounds || null; let fixedS = '';   // bounds [x0, y0, x1, y1]
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return {
    // a marker or anything else a label must not cover
    block(x, y, w, h) { blocks.push({ x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 }); },
    blockRect(x0, y0, x1, y1) { blocks.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) }); },
    // a drawn line a label must not sit on: axis-aligned segments become thin blocks, diagonal ones a chain of small
    // squares along the line (a ceiling run, a floor link)
    blockLine(poly, w = 40) { for (let k = 1; k < poly.length; k++) { const a = poly[k - 1], b = poly[k];
      if (Math.abs(a[0] - b[0]) < 1 || Math.abs(a[1] - b[1]) < 1) { blocks.push({ x0: Math.min(a[0], b[0]) - w / 2, y0: Math.min(a[1], b[1]) - w / 2, x1: Math.max(a[0], b[0]) + w / 2, y1: Math.max(a[1], b[1]) + w / 2 }); continue; }
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (w * .7)));
      for (let s = 0; s <= n; s++) { const x = a[0] + (b[0] - a[0]) * s / n, y = a[1] + (b[1] - a[1]) * s / n; blocks.push({ x0: x - w / 2, y0: y - w / 2, x1: x + w / 2, y1: y + w / 2 }); } } },
    // {x, y, text, size, color, weight, r: clearance around the anchor, pri: higher first, pref: preferred angles (deg),
    //  badge: a fill colour → white text on a rounded tag}
    add(o) { items.push(Object.assign({ size: 70, color: '#333', weight: 400, r: 60, pri: 0 }, o, { k: items.length })); },
    render() {
      items.sort((a, b) => b.pri - a.pri || a.k - b.k);
      let s = fixedS;
      items.forEach(it => {
        const w = textW(it.text, it.size) + it.size * .3, h = it.size * 1.2, pad = it.size * .12;
        const angs = (it.pref || [0, 180, 270, 90, 315, 45, 225, 135]).concat([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
        let best = null;
        const costOf = box => placed.reduce((t, p) => t + area(box, p), 0) * 4 + blocks.reduce((t, b) => t + area(box, b), 0);
        // a leader must not run through another label: the part of it outside the anchor's own clearance is sampled
        const lead = box => { const lx = Math.max(box.x0, Math.min(it.x, box.x1)), ly = Math.max(box.y0, Math.min(it.y, box.y1)), L = Math.hypot(lx - it.x, ly - it.y);
          let c = 0; if (L <= it.r) return 0; for (let t = it.r / L; t < 1; t += 25 / L) { const x = it.x + (lx - it.x) * t, y = it.y + (ly - it.y) * t;
            if (placed.some(p => x > p.x0 && x < p.x1 && y > p.y0 && y < p.y1)) c += 25 * it.size * 4; } return c; };
        if (it.center) { const box = { x0: it.x - w / 2, y0: it.y - h / 2, x1: it.x + w / 2, y1: it.y + h / 2 }; best = { box, cx: it.x, cy: it.y, cost: costOf(box), ring: 0 }; }
        for (let ring = 0; ring < 9 && !(best && best.cost === 0); ring++) {
          const d = it.r + pad + ring * it.size * .85;
          for (const a of angs) { const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
            const cx = it.x + c * (d + w / 2 * Math.abs(c)), cy = it.y + sn * (d + h / 2 * Math.abs(sn));
            const box = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
            if (bounds && (box.x0 < bounds[0] || box.y0 < bounds[1] || box.x1 > bounds[2] || box.y1 > bounds[3])) continue;
            const cost = costOf(box) + (ring > 0 || it.leader ? lead(box) : 0);
            if (!best || cost < best.cost - 1e-6) best = { box, cx, cy, cost, ring };
            if (cost === 0) break; } }
        if (!best) return;
        placed.push(best.box);
        if (best.ring > 0 || it.leader) {                                            // leader from the anchor to the label edge
          const lx = Math.max(best.box.x0, Math.min(it.x, best.box.x1)), ly = Math.max(best.box.y0, Math.min(it.y, best.box.y1));
          // later labels keep off this leader too
          const L = Math.hypot(lx - it.x, ly - it.y), n = Math.ceil(L / 40); for (let k = 1; k < n; k++) { const x = it.x + (lx - it.x) * k / n, y = it.y + (ly - it.y) * k / n; blocks.push({ x0: x - 12, y0: y - 12, x1: x + 12, y1: y + 12 }); }
          s += `<line x1="${it.x}" y1="${it.y}" x2="${lx}" y2="${ly}" stroke="${it.color}" stroke-width="${it.size * .09}" stroke-opacity=".7"/>`; }
        // halo as a separate stroke pass, then the fill (paint-order is ignored by some SVG exporters)
        const t = `x="${best.cx}" y="${best.cy}" font-size="${it.size}" font-weight="${it.weight}" text-anchor="middle" dominant-baseline="central"`;
        if (it.badge) { const b = best.box; s += `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" rx="${it.size * .35}" fill="${it.badge}" stroke="#fff" stroke-width="${it.size * .08}"/><text ${t} fill="#fff">${esc(it.text)}</text>`; return; }
        s += `<text ${t} fill="#fff" stroke="#fff" stroke-width="${it.size * .28}" stroke-linejoin="round">${esc(it.text)}</text><text ${t} fill="${it.color}">${esc(it.text)}</text>`; });
      return s; },
    // a label that must stay exactly where it is (an opening id inside its opening): drawn as given, others avoid it
    fixed(o) { const size = o.size || 70, w = textW(o.text, size) + size * .3, h = size * 1.2; placed.push({ x0: o.x - w / 2, y0: o.y - h / 2, x1: o.x + w / 2, y1: o.y + h / 2 });
      fixedS += `<text x="${o.x}" y="${o.y}" font-size="${size}" fill="${o.color || '#456'}" text-anchor="middle" dominant-baseline="central">${esc(o.text)}</text>`; },
    count: () => items.length
  };
}
module.exports = { create, textW };
