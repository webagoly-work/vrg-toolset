// VRG Kisokos — the one drawing of a communication line, shared by every place that shows one:
// Kisokos/kisokos.js (svg/<id>.svg next to the cards, KISOKOS.md) and Stack/lib/kisokos.js (the 3D page's card panel).
//
//   onePager(card, allCards) → SVG string: the line's bands lit on the common log scale 1 Hz … 1 PHz (all other lines
//                              faint behind it, visible light marked), the wavelength under it, the waveform glyph, and the
//                              four key numbers. Every line gets the same frame, so two drawings compare at a glance.
//   spectrum(allCards)       → SVG string: every line on one scale, one row each, coloured by waveform.
//   fmtF(hz) · fmtL(hz)       → "2,4 GHz" · "12,5 cm" (Hungarian number format)
// Plain functions, no DOM: works in Node and in the browser (window.KisokosSvg).
(function (root) {
  'use strict';
  const C = 299792458;
  const KCOL = { sine: '#a6afb7', dc: '#e3be7b', manchester: '#e3a3c4', baseband: '#8bcca1', diff: '#93d3e6', carrier: '#e8a873', ofdm: '#8fa8e8', light: '#e4877d' };
  const KNAME = { sine: 'szinusz', dc: 'egyenáramú jelszint', manchester: 'Manchester-kód', baseband: 'alapsávú', diff: 'differenciális', carrier: 'modulált vivő', ofdm: 'sokvivős (OFDM)', light: 'fényimpulzus' };
  const BG = '#0a141c', PANEL = '#121c24', LINE = 'rgba(232,240,246,.16)', TEXT = '#e8f0f6', DIM = '#a6afb7', FAINT = '#6f7880', ACC = '#93d3e6';
  const MONO = 'Cascadia Mono, Consolas, ui-monospace, monospace', SANS = 'Segoe UI, system-ui, sans-serif';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v, d) => { const s = String(+v.toPrecision(d || 3)); return s.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  const fmtF = f => f >= 1e12 ? num(f / 1e12) + ' THz' : f >= 1e9 ? num(f / 1e9, 4) + ' GHz' : f >= 1e6 ? num(f / 1e6, 4) + ' MHz' : f >= 1e3 ? num(f / 1e3) + ' kHz' : num(f) + ' Hz';
  const fmtL = f => { const l = C / f; return l >= 1e3 ? num(l / 1e3) + ' km' : l >= 1 ? num(l) + ' m' : l >= 1e-2 ? num(l * 100) + ' cm' : l >= 1e-3 ? num(l * 1e3) + ' mm' : l >= 1e-6 ? num(l * 1e6) + ' µm' : num(l * 1e9) + ' nm'; };
  const bandText = bands => !bands || !bands.length ? 'egyenáram (DC)' : bands.map(b => b[0] === b[1] ? fmtF(b[0]) : fmtF(b[0]) + ' – ' + fmtF(b[1])).join(' · ');
  const lambdaText = bands => !bands || !bands.length ? 'nincs (egyenáram)' : bands.map(b => b[0] === b[1] ? fmtL(b[0]) : fmtL(b[1]) + ' – ' + fmtL(b[0])).join(' · ');

  // the shared scale: x for a frequency between 1 Hz and 1 PHz; DC sits in its own slot left of 1 Hz
  function scale(x0, x1) { const dcW = 34; const a = x0 + dcW, w = x1 - a; return { dc: x0 + dcW / 2, x: f => a + Math.log10(Math.max(f, 1)) / 15 * w, a, b: x1 }; }
  function axis(S, y, h, opt) {
    let o = '';
    const vx1 = S.x(400e12), vx2 = S.x(790e12);
    o += `<rect x="${vx1.toFixed(1)}" y="${y}" width="${(vx2 - vx1).toFixed(1)}" height="${h}" fill="url(#vis)" opacity=".28"/>`;
    for (let d = 0; d <= 15; d++) {
      const x = S.x(Math.pow(10, d)).toFixed(1), major = d % 3 === 0;
      o += `<line x1="${x}" x2="${x}" y1="${y}" y2="${y + h}" stroke="${major ? 'rgba(232,240,246,.22)' : 'rgba(232,240,246,.07)'}"/>`;
      if (major && opt.labels) {
        const lab = ['1 Hz', '', '', '1 kHz', '', '', '1 MHz', '', '', '1 GHz', '', '', '1 THz', '', '', '1 PHz'][d];
        const anc = d === 0 ? 'start' : d === 15 ? 'end' : 'middle';
        o += `<text x="${x}" y="${y - 6}" text-anchor="${anc}" font-family="${MONO}" font-size="11" fill="${DIM}">${lab}</text>`;
        o += `<text x="${x}" y="${y + h + 15}" text-anchor="${anc}" font-family="${MONO}" font-size="11" fill="${DIM}">${fmtL(Math.pow(10, d))}</text>`;
      }
    }
    o += `<line x1="${S.dc}" x2="${S.dc}" y1="${y}" y2="${y + h}" stroke="rgba(232,240,246,.14)" stroke-dasharray="2 3"/>`;
    if (opt.labels) o += `<text x="${S.dc}" y="${y - 6}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${DIM}">DC</text>`;
    return o;
  }
  const defs = () => `<defs><linearGradient id="vis" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#c0392b"/><stop offset=".3" stop-color="#e6b422"/><stop offset=".55" stop-color="#3fa34d"/><stop offset=".8" stop-color="#2f6fd1"/><stop offset="1" stop-color="#7b3fbf"/></linearGradient></defs>`;
  function bandRects(S, card, y, h, col, alpha) {
    if (!card.bands || !card.bands.length) return `<rect x="${S.dc - 4}" y="${y}" width="8" height="${h}" fill="${col}" opacity="${alpha}"/>`;
    return card.bands.map(b => { const x1 = S.x(b[0]), x2 = Math.max(S.x(b[1]), x1 + 4); return `<rect x="${x1.toFixed(1)}" y="${y}" width="${(x2 - x1).toFixed(1)}" height="${h}" fill="${col}" opacity="${alpha}"/>`; }).join('');
  }

  // the waveform glyph, a schematic of the signal shape (not to scale in time)
  function glyph(type, x, y, W, H) {
    const m = y + H / 2, c = KCOL[type] || ACC, bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1];
    const P = pts => pts.map((p, i) => (i ? 'L' : 'M') + (x + p[0]).toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    let o = `<line x1="${x}" x2="${x + W}" y1="${m}" y2="${m}" stroke="rgba(232,240,246,.12)"/>`, d = '';
    const bw = W / bits.length, A = H * 0.36;
    if (type === 'sine') { const p = []; for (let i = 0; i <= W; i += 2) p.push([i, m - A * Math.sin(i / W * Math.PI * 4)]); d = P(p); }
    else if (type === 'dc') d = P([[0, m + A * .35], [W * .3, m + A * .35], [W * .3, m - A * .4], [W * .65, m - A * .4], [W * .65, m - A * .85], [W, m - A * .85]]);
    else if (type === 'baseband') { const p = []; bits.forEach((b, i) => { const v = b ? m - A : m + A * .4; p.push([i * bw, v], [(i + 1) * bw, v]); }); d = P(p); }
    else if (type === 'manchester') { const p = []; bits.forEach((b, i) => { const a = b ? m + A : m - A, z = b ? m - A : m + A; p.push([i * bw, a], [i * bw + bw / 2, a], [i * bw + bw / 2, z], [(i + 1) * bw, z]); }); d = P(p); }
    else if (type === 'diff') { const p = [], q = []; bits.forEach((b, i) => { const v = b ? A : A * .25; p.push([i * bw, m - v], [(i + 1) * bw, m - v]); q.push([i * bw, m + v], [(i + 1) * bw, m + v]); }); d = P(p); o += `<path d="${P(q)}" fill="none" stroke="${c}" stroke-width="2" opacity=".55" stroke-dasharray="5 3"/>`; }
    else if (type === 'carrier') { const p = []; for (let i = 0; i <= W; i++) { const env = 0.35 + 0.65 * bits[Math.floor(i / W * bits.length) % bits.length]; p.push([i, m - A * env * Math.sin(i / 3.1)]); } d = P(p); }
    else if (type === 'ofdm') { const p = []; for (let i = 0; i <= W; i++) { let v = 0; for (let k = 1; k <= 7; k++) v += Math.sin(i / (2 + k * 1.7) + k * 1.3) / 7; p.push([i, m - A * 2.2 * v]); } d = P(p); }
    else if (type === 'light') { bits.forEach((b, i) => { if (b) o += `<rect x="${(x + i * bw + 4).toFixed(1)}" y="${(m - A).toFixed(1)}" width="${(bw - 8).toFixed(1)}" height="${(2 * A).toFixed(1)}" fill="${c}" opacity=".18"/><rect x="${(x + i * bw + 9).toFixed(1)}" y="${(m - A * .7).toFixed(1)}" width="${(bw - 18).toFixed(1)}" height="${(1.4 * A).toFixed(1)}" fill="${c}" opacity=".85"/>`; }); d = P([[0, m + A * 1.15], [W, m + A * 1.15]]); }
    return o + `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`;
  }
  function wrap(text, max) { const w = String(text || '').split(/\s+/), L = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > max) { if (cur) L.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); } if (cur) L.push(cur); return L; }

  function onePager(card, all) {
    const W = 760, S = scale(24, W - 24), col = KCOL[card.waveform] || ACC;
    let o = '';
    o += `<text x="24" y="28" font-family="${SANS}" font-size="19" font-weight="600" fill="${TEXT}">${esc(card.title)}</text>`;
    o += `<text x="${W - 24}" y="28" text-anchor="end" font-family="${MONO}" font-size="11" fill="${FAINT}">${esc((card.group || '').toUpperCase())} · ${esc(KNAME[card.waveform] || '')}</text>`;
    const y = 64, h = 34;
    o += axis(S, y, h, { labels: true });
    for (const other of all || []) if (other.id !== card.id) o += bandRects(S, other, y + 12, 10, 'rgba(232,240,246,.5)', 0.22);
    o += bandRects(S, card, y + 4, h - 8, col, 0.95);
    o += `<text x="24" y="${y + h + 32}" font-family="${MONO}" font-size="10" fill="${FAINT}" letter-spacing="1.2">FREKVENCIA FENT · HULLÁMHOSSZ LENT (λ = c / f) · HALVÁNYAN A TÖBBI VONAL</text>`;
    // bottom: glyph panel + numbers
    const gy = 150, gh = 128;
    o += `<rect x="24" y="${gy}" width="300" height="${gh}" fill="${PANEL}" stroke="${LINE}"/>`;
    o += glyph(card.waveform, 36, gy + 14, 276, gh - 40);
    o += `<text x="36" y="${gy + gh - 10}" font-family="${MONO}" font-size="10.5" fill="${FAINT}">jelalak: ${esc(KNAME[card.waveform] || '')} · sematikus</text>`;
    const rows = [['SÁV', bandText(card.bands)], ['HULLÁMHOSSZ', lambdaText(card.bands)], ['SEBESSÉG', card.rate], ['TÁVOLSÁG', card.distance]];
    let ry = gy + 12;
    for (const [k, v] of rows) {
      o += `<text x="344" y="${ry}" font-family="${MONO}" font-size="10" fill="${FAINT}" letter-spacing="1.2">${k}</text>`;
      const mono = k === 'SÁV' || k === 'HULLÁMHOSSZ', lines = wrap(v, mono ? 50 : 60).slice(0, 3);
      lines.forEach((l, i) => { o += `<text x="344" y="${ry + 15 + i * 14}" font-family="${mono ? MONO : SANS}" font-size="12.5" fill="${k === 'SÁV' ? col : TEXT}">${esc(l)}</text>`; });
      ry += 18 + lines.length * 14;
    }
    const H = Math.max(gy + gh + 22, ry + 8);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(card.title)}: ${esc(bandText(card.bands))}">${defs()}` +
      `<rect width="${W}" height="${H}" fill="${BG}"/>` + o + '</svg>';
  }

  function spectrum(all) {
    const W = 1000, S = scale(20, W - 20), rowH = 24, top = 52;
    const list = all.slice().sort((a, b) => lo(a) - lo(b));
    const H = top + list.length * rowH + 44;
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="A kommunikációs vonalak egy skálán">${defs()}<rect width="${W}" height="${H}" fill="${BG}"/>`;
    o += axis(S, top - 6, list.length * rowH + 8, { labels: true });
    list.forEach((c, i) => {
      const y = top + i * rowH, col = KCOL[c.waveform] || ACC;
      o += bandRects(S, c, y + 4, rowH - 10, col, 0.9);
      const right = hi(c), tx = !c.bands.length || S.x(right) < S.a + (S.b - S.a) * 0.62;   // label right of the bar unless it would run off the edge
      const x = tx ? (c.bands.length ? S.x(right) + 8 : S.dc + 10) : (c.bands.length ? S.x(lo(c)) - 8 : S.dc + 10);
      o += `<text x="${x.toFixed(1)}" y="${y + rowH / 2 + 4}" text-anchor="${tx ? 'start' : 'end'}" font-family="${SANS}" font-size="12" fill="${TEXT}">${esc(c.title)}</text>`;
    });
    return o + '</svg>';
  }
  function lo(c) { return c.bands && c.bands.length ? Math.min(...c.bands.map(b => b[0])) : 0.5; }
  function hi(c) { return c.bands && c.bands.length ? Math.max(...c.bands.map(b => b[1])) : 0.5; }

  const api = { onePager, spectrum, glyph, fmtF, fmtL, bandText, lambdaText, KCOL, KNAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KisokosSvg = api;
})(typeof window !== 'undefined' ? window : this);
