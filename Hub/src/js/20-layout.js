// Board layout: pure geometry from the visible topology. Every number lives in KP_LAYOUT.
// Rows start at the 03_UI §2 defaults and grow when a cell's stack needs more room:
// no label may ever overlap another.

const KP_LAYOUT = {
  colW: 200, colGap: 24, deptGap: 16,
  originW: 120, originH: 48, originGap: 60, headerH: 44,
  rowTop: 200, rowStep: 150, rowPad: 28,
  roadmapGap: 90, roadmapRow: 34, roadmapChars: 30,
  cardX: 12, cardW: 176, cardH: 52, cardH2: 66, titleChars: 22,
  subH: 32, subChars: 20,
  stackGap: 6, stackMax: 3, chipH: 22,
  descGap: 4, lineH: 15, descChars: 30, descLines: 3, subLines: 2, charW: 6.2,
  spineX: 4, bandGap: 48, bandH: 64
};

const KP_LAYER_NAMES = {
  L1: 'Programok', L2: 'Megosztott mappák', L3: 'AI dokumentumok', L4: 'Git és ütemterv',
  L5: 'Saját linkek', L6: 'Helyi célmappa'
};

// Word wrap to `max` chars per line, at most `lines` lines; the last kept line ends in … when cut.
function kpWrap(text, max, lines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (let w of words) {
    while (w.length > max) {
      if (cur) { out.push(cur); cur = ''; }
      out.push(w.slice(0, max - 1) + '-');
      w = w.slice(max - 1);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= max) cur += ' ' + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  let last = kept[lines - 1];
  if (last.length > max - 1) last = last.slice(0, max - 1);
  kept[lines - 1] = last.replace(/[\s,.;:·-]+$/, '') + '…';
  return kept;
}

function kpCut(text, max) {
  const s = String(text || '');
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+$/, '') + '…';
}

// opts: { layers: {L1..L6: bool}, collapsed: [deptId], expanded: [cellKey], en: bool }
function kpLayout(cols, opts) {
  const L = KP_LAYOUT;
  const o = Object.assign({ layers: {}, collapsed: [], expanded: [], en: true }, opts || {});
  const on = l => o.layers[l] !== false;
  const nodes = [], edges = [];

  // text block under a card: d, then dEn in italics (max lines each)
  function describe(n, d, dEn, max) {
    n.lines = d ? kpWrap(d, L.descChars, max) : [];
    n.en = o.en && dEn ? kpWrap(dEn, L.descChars, max) : [];
    const all = n.lines.concat(n.en);
    n.text = all.length ? {
      x: n.x, y: n.y + n.h + L.descGap,
      w: Math.ceil(Math.max(...all.map(s => s.length)) * L.charW), h: all.length * L.lineH
    } : null;
    return n;
  }
  const blockH = n => n.h + (n.text ? L.descGap + n.text.h : 0);

  // 1. columns
  const columns = [];
  const heads = [];
  let x = 0;
  for (const c of cols) {
    const d = c.dept;
    const collapsed = o.collapsed.includes(d.id);
    const kinds = collapsed ? [{ summary: c.programs.length }] : c.programs.length ? c.programs : [{ slot: true }];
    const w = kinds.length * L.colW + (kinds.length - 1) * L.colGap;
    heads.push({ dept: d, x, w, collapsed, count: c.programs.length });
    kinds.forEach((p, i) => columns.push({ dept: d, x: x + i * (L.colW + L.colGap), p }));
    x += w + L.colGap + L.deptGap;
  }
  const width = Math.max(0, x - L.colGap - L.deptGap);

  // 2. origin + headers
  const origin = { id: 'origin', kind: 'origin', x: width / 2 - L.originW / 2, y: 0, w: L.originW, h: L.originH, title: ['VRG'] };
  nodes.push(origin);
  const headY = L.originH + L.originGap;
  for (const h of heads) {
    const n = { id: 'dept:' + h.dept.id, kind: 'dept', x: h.x, y: headY, w: h.w, h: L.headerH, dept: h.dept.id,
      hue: h.dept.hue, title: [h.dept.t], collapsed: h.collapsed, count: h.count };
    nodes.push(n);
    edges.push({ from: origin.id, to: n.id, kind: 'curve', hue: h.dept.hue,
      pts: [[origin.x + L.originW / 2, origin.y + L.originH], [h.x + h.w / 2, headY]] });
  }

  // 3. cells: what each column holds per layer, before y is known
  const cardOf = (col) => {
    const p = col.p, d = col.dept;
    if (p.summary != null) return { kind: 'summary', title: ['▸ ' + p.summary + ' program'], d: 'Összecsukva — kattints a fejlécre.', status: null };
    if (p.slot) return { kind: 'slot', title: ['○ még üres'], d: 'Ebben az osztályban ebben a nézetben nincs program.', status: null };
    const t = kpWrap(p.t, L.titleChars, 2);
    return { kind: 'program', progId: p.id, title: t, status: p.status, d: p.d, dEn: p.dEn, src: p };
  };
  const subsOf = (col, layer) => {
    const p = col.p;
    if (p.summary != null || p.slot) return [];
    if (layer === 'L2') return (p.folders || []).map((f, i) => ({ kind: f.local && !f.url && !f.ref ? 'local' : 'folder',
      title: [kpCut(f.t || f.path || f.ref, L.subChars)], full: f.t || f.path || f.ref, d: f.d, dEn: f.dEn, src: f, key: 'f' + i }));
    if (layer === 'L3') return (p.agent || []).map((a, i) => ({ kind: a.go ? 'go' : 'agent',
      title: [kpCut(a.t, L.subChars)], full: a.t, d: a.d, dEn: a.dEn, src: a, key: 'a' + i }));
    if (layer === 'L4' && p.git) {
      const paths = p.git.paths || [];
      const last = (paths[0] || '').split('/').filter(Boolean).pop() || 'git';
      const dec = p.decisions || 0;
      return [{ kind: 'git', title: [kpCut(last, dec ? L.subChars - 4 : L.subChars)], full: paths.join(', '), decisions: dec,
        d: paths.join(' · ') + ' — ág: ' + (p.git.branch || 'main') + (dec ? ' · ' + dec + ' döntési fájl' : ''), src: p.git, key: 'g' }]
        .concat((p.branches || []).map((b, i) => ({ kind: 'branch', title: [kpCut(b, L.subChars)], full: b,
          d: 'fejlesztés alatt', dEn: 'in development', src: { branch: b, path: paths[0] || '' }, key: 'b' + i })));
    }
    return [];
  };

  // build one stacked cell at y; returns its height
  function placeCell(col, layer, y, items, layerKey) {
    const key = col.p.id + ':' + layerKey;
    let list = items;
    let more = 0;
    if (items.length > L.stackMax && !o.expanded.includes(key)) {
      list = items.slice(0, L.stackMax);
      more = items.length - L.stackMax;
    }
    let cy = y;
    const placed = [];
    for (const it of list) {
      const h = it.kind === 'program' ? (it.title.length > 1 ? L.cardH2 : L.cardH)
        : it.kind === 'summary' || it.kind === 'slot' ? L.cardH : L.subH;
      const n = describe({ id: (it.progId || col.p.id || 'slot:' + col.dept.id) + ':' + layerKey + (it.key ? ':' + it.key : ''),
        kind: it.kind, x: col.x + L.cardX, y: cy, w: L.cardW, h, layer, dept: col.dept.id, hue: col.dept.hue,
        progId: col.p.id, title: it.title, full: it.full, status: it.status || null, src: it.src || null, decisions: it.decisions || 0 }, it.d, it.dEn,
        h === L.subH ? L.subLines : L.descLines);
      nodes.push(n);
      placed.push(n);
      cy += blockH(n) + L.stackGap;
    }
    if (more) {
      const n = { id: key + ':more', kind: 'more', x: col.x + L.cardX, y: cy, w: 96, h: L.chipH, layer, dept: col.dept.id,
        hue: col.dept.hue, progId: col.p.id, title: ['+' + more + ' további'], cell: key, text: null };
      nodes.push(n);
      placed.push(n);
      cy += L.chipH + L.stackGap;
    }
    return { h: placed.length ? cy - L.stackGap - y : 0, placed };
  }

  // 4. rows, top to bottom; each row as tall as its tallest cell
  const placedBy = columns.map(() => []);
  let rowY = L.rowTop, prevY = null, prevH = 0;
  const rows = {};
  for (const layer of ['L1', 'L2', 'L3', 'L4']) {
    if (!on(layer)) continue;
    if (prevY != null) rowY = Math.max(prevY + L.rowStep, prevY + prevH + L.rowPad);
    let maxH = 0;
    columns.forEach((col, ci) => {
      const items = layer === 'L1' ? [cardOf(col)] : subsOf(col, layer);
      const r = placeCell(col, layer, rowY, items, layer);
      placedBy[ci].push(...r.placed);
      maxH = Math.max(maxH, r.h);
    });
    rows[layer] = { y: rowY, h: maxH };
    prevY = rowY; prevH = maxH;
  }

  // 5. roadmap under L4, newest first
  let bottom = prevY == null ? headY + L.headerH : prevY + prevH;
  if (on('L4')) {
    const r4 = rows.L4;
    const top = Math.max(r4.y + L.roadmapGap, r4.y + r4.h + L.rowPad);
    let maxN = 0;
    columns.forEach((col, ci) => {
      const rm = (col.p.roadmap || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      rm.forEach((e, i) => {
        const n = { id: col.p.id + ':rm:' + i, kind: 'roadmap', x: col.x + L.cardX, y: top + i * L.roadmapRow,
          w: L.colW - L.cardX, h: L.roadmapRow - 4, layer: 'L4', dept: col.dept.id, hue: col.dept.hue, progId: col.p.id,
          date: e.date, title: [kpCut(e.t, L.roadmapChars)], full: e.t, src: e, text: null };
        nodes.push(n);
        placedBy[ci].push(n);
      });
      maxN = Math.max(maxN, rm.length);
    });
    rows.roadmap = { y: top, h: maxN * L.roadmapRow };
    if (maxN) bottom = top + maxN * L.roadmapRow;
  }

  // 6. personal bands (filled by H8)
  const bands = ['L5', 'L6'].filter(on);
  if (bands.length) {
    const by = bottom + L.bandGap;
    const bw = bands.length === 2 ? (width - L.colGap) / 2 : width;
    bands.forEach((l, i) => nodes.push({ id: 'band:' + l, kind: 'band', layer: l, x: i * (bw + L.colGap), y: by, w: bw, h: L.bandH,
      title: [KP_LAYER_NAMES[l]], text: null }));
    bottom = by + L.bandH;
  }

  // 7. spines: header bottom down the left edge of each column, a tick into every node
  columns.forEach((col, ci) => {
    const list = placedBy[ci];
    if (!list.length) return;
    const sx = col.x + L.spineX;
    const last = list[list.length - 1];
    edges.push({ from: 'dept:' + col.dept.id, to: last.id, kind: 'spine', hue: col.dept.hue,
      pts: [[sx, headY + L.headerH], [sx, last.y + last.h / 2]] });
    for (const n of list) {
      if (n.kind === 'roadmap') continue;
      edges.push({ from: 'dept:' + col.dept.id, to: n.id, kind: 'tick', hue: col.dept.hue,
        pts: [[sx, n.y + n.h / 2], [n.x, n.y + n.h / 2]] });
    }
  });

  return { nodes, edges, width, height: bottom, rows };
}

// Pairwise overlap check over every card and text box (tests + a debug aid).
function kpOverlaps(layout) {
  const boxes = [];
  for (const n of layout.nodes) {
    if (n.kind === 'origin' || n.kind === 'band') continue;
    boxes.push({ id: n.id, part: 'card', x: n.x, y: n.y, w: n.w, h: n.h });
    if (n.text) boxes.push({ id: n.id, part: 'text', x: n.text.x, y: n.text.y, w: n.text.w, h: n.text.h });
  }
  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) hits.push([a.id + '/' + a.part, b.id + '/' + b.part]);
    }
  }
  return hits;
}

if (typeof module !== 'undefined') module.exports = { KP_LAYOUT, KP_LAYER_NAMES, kpWrap, kpCut, kpLayout, kpOverlaps };
