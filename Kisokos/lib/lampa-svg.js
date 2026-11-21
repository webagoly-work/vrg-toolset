// VRG Kisokos — the one drawing of a light fixture type, shared like vonal-svg.js: Kisokos/kisokos.js
// (vilagitotestek/svg/<id>.svg, KISOKOS.md) and Stack/lib/kisokos.js (the 3D page's card panel).
//
//   card(c) → SVG string: a polar light-distribution curve (fényeloszlás) on the usual luminaire plot, 0° straight
//             down, 180° straight up, left and right half the two sides; next to it the type's key figures
//             (fényáram, színhőmérséklet, színvisszaadás, sugárzási szög, védettség, foglalat).
// The curve is GENERIC per distribution type (decision VT3), not a measured LDT / IES file of a product:
//   lambert   diffuse downward (opal cover, panel)          wide · narrow   rotationally symmetric beam of `angle`°
//   general   all round (bare lamp, globe, chandelier)      updown          a narrow beam up and one down
//   direct-indirect  mostly down, some up (pendant, sconce) asym            one side only (wall washer, picture light)
//   batwing   peak off-axis, low glare below (office panel)
// The beam angle is where the intensity falls to half (FWHM). Plain functions: Node and browser (window.KisokosLampaSvg).
(function (root) {
  'use strict';
  const BG = '#0a141c', PANEL = '#121c24', LINE = 'rgba(232,240,246,.16)', TEXT = '#e8f0f6', DIM = '#a6afb7', FAINT = '#6f7880';
  const CURVE = '#f2dc8c', UP = '#93d3e6';
  const MONO = 'Cascadia Mono, Consolas, ui-monospace, monospace', SANS = 'Segoe UI, system-ui, sans-serif';
  const TYPES = { lambert: 'diffúz, lefelé', wide: 'széles nyaláb', narrow: 'keskeny nyaláb', general: 'minden irányba', updown: 'fel és le', 'direct-indirect': 'főleg le, részben fel', asym: 'aszimmetrikus', batwing: 'denevérszárny (batwing)' };
  const FAM = { 1: 'Mennyezeti', 2: 'Fali', 3: 'Rejtett és vonali', 4: 'Bútor és beépített', 5: 'Dugaszolós', 6: 'Nedves helyiség', 7: 'Kültéri', 8: 'Biztonsági és jelző', 9: 'Kereskedelmi és ipari', 10: 'Niche' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const R = Math.PI / 180;
  const beam = (t, a) => { if (t >= 90) return 0; const n = Math.log(0.5) / Math.log(Math.cos(Math.min(a, 170) / 2 * R)); return Math.pow(Math.cos(t * R), n); };

  // intensity (0..1) at angle t from nadir (0 = down, 180 = up), on the left (s = -1) or right (s = +1) side
  function intensity(d, t, s) {
    const a = d.angle || 90;
    switch (d.type) {
      case 'lambert': return t < 90 ? Math.cos(t * R) : 0;
      case 'wide': case 'narrow': return beam(t, a);
      case 'general': return (0.72 + 0.28 * Math.cos(t * R)) * (t > 160 ? Math.max(0.25, 1 - (t - 160) / 26) : 1);
      case 'updown': return Math.max(beam(t, a), beam(180 - t, a));
      case 'direct-indirect': return Math.max(t < 90 ? Math.pow(Math.cos(t * R), 1.4) : 0, t > 90 ? (d.up || 0.35) * Math.pow(Math.cos((180 - t) * R), 1.4) : 0);
      case 'batwing': return t < 90 ? Math.pow(Math.sin(2 * t * R), 0.9) * 0.75 + Math.cos(t * R) * 0.35 : 0;
      case 'asym': return s > 0 ? (t < 95 ? Math.pow(Math.max(0, Math.sin((t + 12) * R)), 1.6) * (t < 80 ? 1 : (95 - t) / 15) : 0) : (t < 40 ? 0.18 * Math.cos(t * 2 * R) : 0);
      default: return t < 90 ? Math.cos(t * R) : 0;
    }
  }

  function polar(d, cx, cy, rad) {
    let o = '';
    for (const k of [0.25, 0.5, 0.75, 1]) o += `<circle cx="${cx}" cy="${cy}" r="${(rad * k).toFixed(1)}" fill="none" stroke="${k === 1 ? 'rgba(232,240,246,.22)' : LINE}"/>`;
    for (let g = 0; g < 180; g += 30) { const x = Math.sin(g * R) * rad, y = Math.cos(g * R) * rad; o += `<line x1="${(cx - x).toFixed(1)}" y1="${(cy - y).toFixed(1)}" x2="${(cx + x).toFixed(1)}" y2="${(cy + y).toFixed(1)}" stroke="${LINE}"/>`; }
    const lab = (g, txt, dx = 0, dy = 0) => { const x = cx + Math.sin(g * R) * (rad + 14) + dx, y = cy + Math.cos(g * R) * (rad + 14) + dy; return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="${MONO}" font-size="10" fill="${FAINT}">${txt}</text>`; };
    o += lab(0, '0°', 0, 6) + lab(180, '180°', 0, 4) + lab(90, '90°', 6, 3) + lab(-90, '90°', -6, 3) + lab(45, '45°', 4, 4) + lab(-45, '45°', -4, 4);
    // sample both halves, normalise to the maximum
    const pts = [], N = 180;
    let mx = 0;
    for (const s of [-1, 1]) for (let i = 0; i <= N; i++) { const v = intensity(d, i, s); if (v > mx) mx = v; }
    mx = mx || 1;
    const path = s => { const p = []; for (let i = 0; i <= N; i++) { const t = s < 0 ? i : N - i, v = intensity(d, t, s) / mx * rad; p.push([cx + s * Math.sin(t * R) * v, cy + Math.cos(t * R) * v]); } return p; };
    const left = path(-1), right = path(1);
    const all = [...left, ...right];
    const dstr = all.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ') + ' Z';
    o += `<path d="${dstr}" fill="${CURVE}" fill-opacity=".13" stroke="${CURVE}" stroke-width="2" stroke-linejoin="round"/>`;
    // the half-intensity beam edges for beam types
    if ((d.type === 'wide' || d.type === 'narrow') && d.angle) for (const s of [-1, 1]) {
      const g = d.angle / 2, x = cx + s * Math.sin(g * R) * rad, y = cy + Math.cos(g * R) * rad;
      o += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${UP}" stroke-dasharray="3 3" opacity=".7"/>`;
    }
    o += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${TEXT}"/>`;
    void pts;
    return o;
  }

  function wrap(text, max) { const w = String(text || '').split(/\s+/), L = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > max) { if (cur) L.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); } if (cur) L.push(cur); return L; }

  function card(c) {
    const W = 760, d = c.distribution || { type: 'lambert' }, ph = c.photometry || {}, pr = c.protection || {};
    let o = '';
    o += `<text x="24" y="30" font-family="${SANS}" font-size="19" font-weight="600" fill="${TEXT}">${esc(c.title)}</text>`;
    o += `<text x="${W - 24}" y="30" text-anchor="end" font-family="${MONO}" font-size="11" fill="${FAINT}">${esc((FAM[c.family] || '').toUpperCase())}</text>`;
    const mt = String(c.mounting || ''), mline = mt.length > 104 ? mt.slice(0, 103) + '…' : mt;
    o += `<text x="24" y="50" font-family="${MONO}" font-size="11" fill="${DIM}">${esc(mline)}</text>`;
    const top = 64, gh = 270;
    o += `<rect x="24" y="${top}" width="290" height="${gh}" fill="${PANEL}" stroke="${LINE}"/>`;
    o += polar(d, 169, top + 120, 92);
    o += `<text x="36" y="${top + gh - 10}" font-family="${MONO}" font-size="10.5" fill="${FAINT}">fényeloszlás: ${esc(TYPES[d.type] || d.type)}${d.angle ? ' · ' + d.angle + '°' : ''} · sematikus</text>`;
    const rows = [['FÉNYÁRAM', ph.lm], ['SZÍNHŐMÉRSÉKLET', ph.cct], ['SZÍNVISSZAADÁS', ph.cri], ['SUGÁRZÁSI SZÖG', ph.beam],
      ['VÉDETTSÉG', [pr.ip, pr.ik, pr.class].filter(Boolean).join(' · ')], ['FÉNYFORRÁS', c.sources]].filter(r => r[1]);
    let ry = top + 12;
    for (const [k, v] of rows) {
      o += `<text x="336" y="${ry}" font-family="${MONO}" font-size="10" fill="${FAINT}" letter-spacing="1.2">${k}</text>`;
      const lines = wrap(v, 56).slice(0, 2);
      lines.forEach((l, i) => { o += `<text x="336" y="${ry + 15 + i * 14}" font-family="${SANS}" font-size="12.5" fill="${k === 'FÉNYÁRAM' ? CURVE : TEXT}">${esc(l)}</text>`; });
      ry += 20 + lines.length * 14;
    }
    const H = Math.max(top + gh + 20, ry + 6);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(c.title)}: ${esc(TYPES[d.type] || '')}">` +
      `<rect width="${W}" height="${H}" fill="${BG}"/>` + o + '</svg>';
  }

  const api = { card, intensity, TYPES, FAM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KisokosLampaSvg = api;
})(typeof window !== 'undefined' ? window : this);
