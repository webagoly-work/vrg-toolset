// render.js — turns a Rajztár record into SVG. Works in Node (require) and in a page (window.Rajztar).
// The future document engine uses the same functions, so the catalog shows exactly what prints.
(function (root) {
  'use strict';

  // Pen widths on paper (mm). Schematic symbols use the schematic line group, plan symbols the
  // plan group (formats.json lines.groups). 'w' doubles the pen, as the 1:2 group rule says.
  const SCHEMATIC = { conn: 1, sw: 1, meas: 1, src: 1 };
  function penFor(sym, formats) {
    const g = formats && formats.lines && formats.lines.groups;
    if (SCHEMATIC[sym.cat]) return g ? g.schematic.narrow : 0.25;
    return g ? g.plan.wide : 0.35;
  }

  // Map the body's classes to attributes so the SVG stands alone (no page CSS needed in a PDF).
  function inlineClasses(body, pen) {
    return body
      .replace(/<(path|rect|circle|ellipse|line|polygon)([^>]*?)class='f'([^>]*?)\/>/g, `<$1$2 fill='currentColor' stroke='none'$3/>`)
      .replace(/class='w'/g, `stroke-width='${+(pen * 2).toFixed(3)}'`)
      .replace(/class='dot'/g, `stroke-dasharray='${+(pen * 1.6).toFixed(2)} ${+(pen * 2.4).toFixed(2)}'`)
      .replace(/<text class='t'/g, `<text fill='currentColor' stroke='none' font-family='Bahnschrift, DIN, Arial, sans-serif'`);
  }

  // opts: { px: pixels per mm (default 1 = output in mm units), color, formats, ports: bool, pad }
  function symbolToSvg(sym, opts) {
    opts = opts || {};
    const pad = opts.pad == null ? 1 : opts.pad;
    const pen = opts.pen || penFor(sym, opts.formats);
    const W = sym.w + pad * 2, H = sym.h + pad * 2, k = opts.px || 1;
    let s = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${-pad} ${-pad} ${W} ${H}' width='${+(W * k).toFixed(2)}${k === 1 ? 'mm' : ''}' height='${+(H * k).toFixed(2)}${k === 1 ? 'mm' : ''}'` +
      ` style='color:${opts.color || 'currentColor'}'><g fill='none' stroke='currentColor' stroke-width='${pen}' stroke-linecap='round' stroke-linejoin='round'>` +
      inlineClasses(sym.body, pen) + `</g>`;
    if (opts.ports) {
      for (const p of sym.ports || []) s += `<circle cx='${p.x}' cy='${p.y}' r='${pen * 2.2}' fill='#d23' stroke='none'/>`;
      if (sym.anchor) s += `<path d='M${sym.anchor[0] - 0.8} ${sym.anchor[1]} h1.6 M${sym.anchor[0]} ${sym.anchor[1] - 0.8} v1.6' stroke='#2f6fc0' stroke-width='${pen * 0.6}'/>`;
      if (sym.wall === 'bottom') s += `<line x1='${-pad}' y1='${sym.h}' x2='${sym.w + pad}' y2='${sym.h}' stroke='#9b9389' stroke-width='${pen * 0.6}' stroke-dasharray='0.6 0.6'/>`;
    }
    return s + `</svg>`;
  }

  // The same drawing as a <g>, for placing many symbols on one sheet (a nested <svg> cannot take a
  // transform reliably). Coordinates stay the symbol's own; the caller wraps it in its transform.
  function symbolToGroup(sym, opts) {
    opts = opts || {};
    const pen = opts.pen || penFor(sym, opts.formats);
    return `<g fill='none' stroke='currentColor' stroke-width='${pen}' stroke-linecap='round' stroke-linejoin='round'>` + inlineClasses(sym.body, pen) + `</g>`;
  }

  // A title block drawn from a formats.json layout. values: {field: text}; labels from mandatoryFields.
  function titleBlockToSvg(layout, fields, values, opts) {
    opts = opts || {};
    const k = opts.px || 1, lab = {};
    for (const f of fields) lab[f.key] = f.label;
    lab.logo = 'Logó';
    const L = layout.lines || { outer: 0.7, inner: 0.25 };
    let s = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-1 -1 ${layout.w + 2} ${layout.h + 2}' width='${(layout.w + 2) * k}' height='${(layout.h + 2) * k}'>` +
      `<g fill='none' stroke='currentColor' font-family='Bahnschrift, DIN, Arial, sans-serif'>`;
    for (const c of layout.cells) {
      s += `<rect x='${c.x}' y='${c.y}' width='${c.w}' height='${c.h}' stroke-width='${L.inner}'/>`;
      const n = c.split || 1;
      for (let i = 0; i < n; i++) {
        const cx = c.x + (c.w / n) * i;
        if (i) s += `<line x1='${cx}' y1='${c.y}' x2='${cx}' y2='${c.y + c.h}' stroke-width='${L.inner}'/>`;
        const label = n > 1 ? ['Felelős tervező', 'Tervező munkatárs', 'Szerkesztette', 'Ellenőrizte'][i] || lab[c.field] : lab[c.field] || c.field;
        s += `<text x='${cx + 1}' y='${c.y + 2.4}' font-size='1.8' fill='currentColor' stroke='none' opacity='.62'>${esc(label)}</text>`;
        const v = values && values[c.field + (n > 1 ? '.' + i : '')];
        if (v) s += `<text x='${cx + 1}' y='${c.y + Math.min(c.h - 1.2, 2.6 + (c.vh || 2.5) + 0.8)}' font-size='${c.vh || 2.5}' fill='currentColor' stroke='none'>${esc(v)}</text>`;
      }
    }
    s += `<rect x='0' y='0' width='${layout.w}' height='${layout.h}' stroke-width='${L.outer}'/></g></svg>`;
    return s;
  }

  function esc(t) { return String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  const api = { symbolToSvg, symbolToGroup, titleBlockToSvg, penFor, inlineClasses };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Rajztar = api;
})(typeof window !== 'undefined' ? window : globalThis);
