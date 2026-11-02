// Text lockups of the original Varler mark. Every line is exactly as wide as the mark's widest line (the globe),
// sits on top of the mark and covers only the bottom of the E27 cap; the whole lockup's width : height snaps to a
// classic ratio (phi, 3:2, sqrt 2). Type: Poppins (the original wordmark is Poppins Bold with extra tracking).
const ot = require('opentype.js'), fs = require('fs'), path = require('path');
const BOLD = ot.loadSync(path.join(__dirname, 'fonts/Poppins-700.ttf')), SEMI = ot.loadSync(path.join(__dirname, 'fonts/Poppins-600.ttf'));
const C = require('../logo.json').contours;
const PHI = (1 + Math.sqrt(5)) / 2;
const X0 = 312.3, X1 = 687.2, W = X1 - X0, CX = (X0 + X1) / 2, TOP = 74.9; // the globe: widest line of the mark, and its top
const CAP0 = 554.8, CAP1 = 593.0; // the E27 base's lowest part
const COVER = 10; // how far the text's main line reaches up into the cap (its x-height or cap height)
const WORD = 0.12; // extra word space, em
const RATIOS = [['φ', PHI], ['3:2', 1.5], ['√2', Math.SQRT2]];
const f1 = v => +v.toFixed(1);

const poly = q => 'M' + q.map(p => p[0] + ' ' + p[1]).join('L') + 'Z';
const MARK = [0, 1, 2, 3, 4].map(i => poly(C[i].q)).join('');

function glyphs(font, text, size, track) { // laid out at x=0 baseline 0: paths + ink box
  const u = font.unitsPerEm, gs = font.stringToGlyphs(text); let x = 0; const parts = [];
  let b = { x1: 1e9, x2: -1e9, y1: 1e9, y2: -1e9 };
  gs.forEach((g, i) => {
    if (g.unicode !== 32) { const p = g.getPath(x, 0, size), q = p.getBoundingBox(); parts.push(p); b = { x1: Math.min(b.x1, q.x1), x2: Math.max(b.x2, q.x2), y1: Math.min(b.y1, q.y1), y2: Math.max(b.y2, q.y2) }; }
    x += g.advanceWidth * size / u + (g.unicode === 32 ? WORD * size : 0); if (i < gs.length - 1) x += track * size + font.getKerningValue(g, gs[i + 1]) * size / u;
  });
  return { parts, b };
}
// size and tracking so the ink is exactly W wide; `lead` is the line's main height per unit size (cap or x-height)
function fit(font, text, size) {
  const n = font.stringToGlyphs(text).length - 1, w0 = glyphs(font, text, size, 0).b; const iw = w0.x2 - w0.x1;
  return { font, text, size, track: (W - iw) / n / size };
}
function line(spec, baseline) {
  const g = glyphs(spec.font, spec.text, spec.size, spec.track), dx = X0 - g.b.x1;
  const d = g.parts.map(p => p.commands.map(c => {
    const t = (x, y) => f1(x + dx) + ' ' + f1(y + baseline);
    return c.type === 'M' ? 'M' + t(c.x, c.y) : c.type === 'L' ? 'L' + t(c.x, c.y) : c.type === 'Q' ? 'Q' + t(c.x1, c.y1) + ' ' + t(c.x, c.y) : c.type === 'C' ? 'C' + t(c.x1, c.y1) + ' ' + t(c.x2, c.y2) + ' ' + t(c.x, c.y) : 'Z';
  }).join('')).join('');
  return { d, top: baseline + g.b.y1, bottom: baseline + g.b.y2 };
}
const lead = (font, text) => (/[A-Z]/.test(text) ? font.tables.os2.sCapHeight : font.tables.os2.sxHeight) / font.unitsPerEm;
const desc = (font, text) => /[gpqy]/.test(text) ? -font.charToGlyph('g').getBoundingBox().y1 / font.unitsPerEm : 0;

// one line: try each ratio, best = the cover closest to COVER with a sane tracking
function single(text) {
  const font = BOLD, L = lead(font, text), Dn = desc(font, text);
  const best = [];
  for (const [name, r] of RATIOS) {
    const bottom = TOP + r * W; // the lockup's lowest ink
    // size from the cover: main-line top at CAP1 - COVER, ink bottom at `bottom`
    const size = (bottom - (CAP1 - COVER)) / (L + Dn);
    const s = fit(font, text, size), lower = /[a-z]/.test(text) ? -0.02 : 0, upper = /[a-z]/.test(text) ? 0.17 : 0.45;
    best.push({ name, r, size, track: s.track, ok: s.track >= lower && s.track <= upper });
  }
  let pick = best.find(b => b.ok), spec;
  if (pick) spec = fit(font, text, pick.size);
  else { // no ratio reaches the cover with sane tracking: set the line at zero tracking, keep the ratio that still touches the cap
    const s0 = glyphs(font, text, 100, 0).b, size = 100 * W / (s0.x2 - s0.x1);
    pick = RATIOS.map(([name, r]) => ({ name, r, size, cover: CAP1 - (TOP + r * W - (L + Dn) * size) })).filter(p => p.cover >= 0).sort((a, b) => a.cover - b.cover)[0];
    spec = { font, text, size, track: 0 };
  }
  const bottom = TOP + pick.r * W, base = bottom - Dn * spec.size, l0 = line(spec, base);
  return { ratio: pick.name, r: pick.r, lines: [line(spec, base + bottom - l0.bottom)], specs: [spec], tried: best }; // ink bottom exactly on the ratio
}
// VRG over a small subline; the subline is the monogram's size / phi^2, the gap the subline's cap height / phi
function stacked(sub) {
  const r = PHI, bottom = TOP + r * W, top = CAP1 - COVER;
  const L = lead(BOLD, 'VRG'), Ls = lead(SEMI, sub), Ds = desc(SEMI, sub), k = 1 / (PHI * PHI);
  // block = size*(L + gap + sub main + sub descender), gap = k*size*Ls/PHI
  const size = (bottom - top) / (L + k * Ls / PHI + k * (Ls + Ds));
  const big = fit(BOLD, 'VRG', size), small = fit(SEMI, sub, size * k);
  const b1 = top + L * size, b2 = bottom - Ds * size * k;
  const l2 = line(small, b2);
  return { ratio: 'φ', r, lines: [line(big, b1), line(small, b2 + bottom - l2.bottom)], specs: [big, small] };
}

// ids are case-free: Windows file names ignore case
const VARIANTS = [
  ['caps', () => single('VARLER')], ['lower', () => single('varler')],
  ['group-caps', () => single('VARLER GROUP')], ['group-lower', () => single('varler group')],
  ['vrg', () => single('VRG')], ['vrg-sub-lower', () => stacked('varler group')], ['vrg-sub-caps', () => stacked('VARLER GROUP')]
];
const out = VARIANTS.map(([id, make]) => {
  const v = make(), text = v.lines.map(l => l.d).join(''), bottom = Math.max(...v.lines.map(l => l.bottom));
  return { id, ratio: v.ratio, box: [f1(X0), f1(TOP), f1(W), f1(bottom - TOP)], measured: +((bottom - TOP) / W).toFixed(4),
    cover: f1(CAP1 - Math.min(...v.lines.map(l => l.top))), specs: v.specs.map(s => ({ text: s.text, size: f1(s.size), track: +s.track.toFixed(3), weight: s.font === BOLD ? 700 : 600 })), mark: MARK, text,
    tried: v.tried && v.tried.map(t => t.name + ' ' + t.track.toFixed(3) + (t.ok ? '' : ' x')).join(', ') };
});
fs.writeFileSync(path.join(__dirname, 'lockups.json'), JSON.stringify(out));
for (const o of out) console.log(o.id.padEnd(18), o.ratio.padEnd(4), 'h/w', o.measured, 'top', o.cover, JSON.stringify(o.specs), o.tried || '');
