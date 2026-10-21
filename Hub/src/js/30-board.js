// Board renderer + camera. Geometry comes from kpLayout; this file only draws and listens.

const KP_ICON = { program: '▣', third: '⧉', folder: '☁', local: '📁', agent: '🤖', go: '▶', git: '⎇', branch: '⎇', summary: '▸', slot: '○' };
const KP_STATUS_HU = { live: 'használatban', dev: 'fejlesztés alatt', idea: 'tervezett', v2: 'jövőkép' };
const KP_STATUS_DOT = { live: '●', dev: '◐', idea: '○', v2: '◌' };
const KP_ZOOM = { min: 0.05, max: 3, descOff: 0.5, cardsOff: 0.3, step: 1.25 };
const KP_LABEL_X = -24;

const kpBoard = {
  view: 'now', layers: {}, collapsed: [], expanded: [], focus: null,
  cam: { x: 0, y: 0, k: 1 }, layout: null, fitted: false
};

function kpBoardLoad() {
  kpBoard.view = kpStore.get('view', 'now') === 'vision' ? 'vision' : 'now';
  kpBoard.layers = Object.assign({ L1: true, L2: true, L3: true, L4: true, L5: true, L6: true }, kpStore.get('layers', {}));
  kpBoard.collapsed = kpStore.get('collapsed', []);
}

function kpBoardRender() {
  const topo = kpData.topology;
  const svg = document.getElementById('kpBoard');
  if (!topo) { svg.replaceChildren(); return; }
  let cols = kpVisible(kpApplyLive(kpResolveRefs(kpViewTopology()), kpLive()), kpBoard.view);
  if (kpBoard.focus) cols = cols.filter(c => c.dept.id === kpBoard.focus);
  const lay = kpLayout(cols, { layers: kpBoard.layers, collapsed: kpBoard.focus ? [] : kpBoard.collapsed, expanded: kpBoard.expanded, en: true });
  kpBoard.layout = lay;

  const g = kpEl('g', { id: 'kpCam' });
  const gEdges = kpEl('g', { class: 'kp-edges' });
  const gNodes = kpEl('g', { class: 'kp-nodes' });
  for (const e of lay.edges) gEdges.append(kpEdgeEl(e));
  for (const n of lay.nodes) gNodes.append(kpNodeEl(n));
  g.append(kpLayerLabels(lay), kpOverviewAreas(lay), gEdges, gNodes, kpEl('g', { id: 'kpOverview', class: 'kp-overview' }));
  svg.replaceChildren(g);
  kpRenderChrome();
  if (!kpBoard.fitted) { kpFit(); kpBoard.fitted = true; } else kpApplyCam();
}

function kpHue(h) { return 'hue-' + (h || 'gray'); }

function kpEdgeEl(e) {
  const [[x1, y1], [x2, y2]] = e.pts;
  const cls = 'kp-edge kp-edge-' + e.kind + ' ' + kpHue(e.hue);
  if (e.kind === 'curve') {
    const my = (y1 + y2) / 2;
    return kpEl('path', { class: cls, d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}` });
  }
  return kpEl('line', { class: cls, x1, y1, x2, y2 });
}

function kpText(x, y, lines, cls, lh) {
  const t = kpEl('text', { x, y, class: cls });
  lines.forEach((s, i) => t.append(kpEl('tspan', { x, dy: i ? lh : 0 }, s)));
  return t;
}

function kpNodeEl(n) {
  const L = KP_LAYOUT;
  const g = kpEl('g', { class: 'kp-node kp-' + n.kind + ' ' + kpHue(n.hue) + (n.status ? ' st-' + n.status : ''), 'data-id': n.id });
  if (n.full && n.full !== n.title.join(' ')) g.append(kpEl('title', {}, n.full));

  if (n.kind === 'origin') {
    g.append(kpEl('rect', { class: 'kp-card', x: n.x, y: n.y, width: n.w, height: n.h, rx: 10 }),
      kpEl('text', { class: 'kp-origin-t', x: n.x + n.w / 2, y: n.y + n.h / 2 + 6 }, 'VRG'));
    return g;
  }
  if (n.kind === 'dept') {
    const maxC = Math.max(8, Math.floor((n.w - 40) / 7.6));
    const t = kpWrap(n.title[0], maxC, 2);
    g.append(kpEl('rect', { class: 'kp-card', x: n.x, y: n.y, width: n.w, height: n.h, rx: 8 }),
      kpEl('rect', { class: 'kp-dept-bar', x: n.x, y: n.y, width: n.w, height: 4, rx: 2 }),
      kpText(n.x + 12, n.y + (t.length > 1 ? 20 : 27), t, 'kp-dept-t', 15),
      kpEl('text', { class: 'kp-dept-n', x: n.x + n.w - 10, y: n.y + 27 }, (n.collapsed ? '▸ ' : '▾ ') + n.count));
    g.addEventListener('click', () => kpHeaderClick(n.dept));
    g.addEventListener('dblclick', () => kpHeaderDbl(n.dept));
    return g;
  }
  if (n.kind === 'roadmap') {
    const cx = n.x - L.cardX + L.spineX;
    g.append(kpEl('circle', { class: 'kp-rm-dot', cx, cy: n.y + 8, r: 4 }),
      kpEl('text', { class: 'kp-rm-date', x: n.x, y: n.y + 12 }, kpFmtDate(n.date)),
      kpEl('text', { class: 'kp-rm-t', x: n.x, y: n.y + 26 }, n.title[0]));
    return g;
  }
  if (n.kind === 'band') {
    g.append(kpEl('rect', { class: 'kp-band-r', x: n.x, y: n.y, width: n.w, height: n.h, rx: 8 }),
      kpEl('text', { class: 'kp-band-t', x: n.x + 16, y: n.y + 26 }, (n.layer === 'L5' ? '★ ' : '📁 ') + n.layer + ' · ' + n.title[0]),
      kpEl('text', { class: 'kp-band-s', x: n.x + 16, y: n.y + 46 }, 'Csak te látod — még üres.'));
    return g;
  }
  if (n.kind === 'more') {
    g.append(kpEl('rect', { class: 'kp-chip', x: n.x, y: n.y, width: n.w, height: n.h, rx: n.h / 2 }),
      kpEl('text', { class: 'kp-chip-t', x: n.x + n.w / 2, y: n.y + 15 }, n.title[0]));
    g.addEventListener('click', () => { kpBoard.expanded.push(n.cell); kpBoardRender(); });
    return g;
  }

  // cards: program / summary / slot / folder / local / agent / go / git
  const big = n.kind === 'program' || n.kind === 'summary' || n.kind === 'slot';
  g.append(kpEl('rect', { class: 'kp-card' + (big ? '' : ' kp-sub'), x: n.x, y: n.y, width: n.w, height: n.h, rx: big ? 8 : 6 }));
  const icon = KP_ICON[n.kind] || '▣';
  if (big) {
    g.append(kpEl('text', { class: 'kp-icon', x: n.x + 10, y: n.y + 19 }, icon),
      kpText(n.x + 28, n.y + 19, n.title, 'kp-title', 15));
    if (n.kind === 'program') {
      const open = kpL1Open();
      g.classList.toggle('kp-locked', !open);
      g.append(kpEl('text', { class: 'kp-lock' + (open ? ' open' : ''), x: n.x + n.w - 8, y: n.y + n.h - 9 }, open ? '🔓' : '⛔'));
    }
    const dirty = n.kind === 'program' && kpDirty.has(n.progId);
    if (dirty) g.append(kpEl('text', { class: 'kp-status kp-dirty-t', x: n.x + 28, y: n.y + n.h - 9 }, '✎ nem mentett'));
    else if (n.status) {
      g.append(kpEl('text', { class: 'kp-status', x: n.x + 28, y: n.y + n.h - 9 }, KP_STATUS_DOT[n.status] + ' ' + KP_STATUS_HU[n.status]));
    }
    g.classList.toggle('kp-dirty', dirty);
    const claim = n.kind === 'program' && n.src && n.src.claim;
    if (claim) {
      const old = claim.until < kpToday();
      g.append(kpEl('text', { class: 'kp-claim-b' + (old ? ' old' : ''), x: n.x + n.w, y: n.y - 5 },
        '⚑ ' + claim.by + '-ig ' + String(claim.until).slice(5), kpEl('title', {}, (claim.note || '') + (old ? ' (lejárt — a következő mentés törli)' : ''))));
    }
  } else {
    g.append(kpEl('text', { class: 'kp-icon', x: n.x + 9, y: n.y + 21 }, icon),
      kpEl('text', { class: 'kp-sub-t', x: n.x + 28, y: n.y + 21 }, n.title[0]));
    // a branch is unreleased program code: it opens like layer 1 (allowed list), not like layer 4
    const lock = n.kind === 'branch' ? (kpL1Open() ? null : '⛔') : kpLayerLock(n.layer) ? '🔒' : null;
    g.classList.toggle('kp-locked', !!lock);
    g.append(kpEl('text', { class: 'kp-lock' + (lock ? '' : ' open'), x: n.x + n.w - 8, y: n.y + 21 }, lock || '🔓'));
    if (n.decisions) g.append(kpEl('text', { class: 'kp-chip-dec', x: n.x + n.w - 26, y: n.y + 21 }, '? ' + n.decisions,
      kpEl('title', {}, n.decisions + ' döntési / kérdés fájl ebben a mappában')));
  }
  if (n.text) {
    const desc = kpEl('g', { class: 'kp-desc' });
    if (n.lines.length) desc.append(kpText(n.text.x, n.text.y + 11, n.lines, 'kp-d', L.lineH));
    if (n.en.length) desc.append(kpText(n.text.x, n.text.y + 11 + n.lines.length * L.lineH, n.en, 'kp-den', L.lineH));
    g.append(desc);
  }
  return g;
}

// Far out only the branches remain; each department becomes an area as tall as its content,
// with a label kept at screen size (kpOverviewLabels, redrawn on zoom).
function kpOverviewAreas(lay) {
  const g = kpEl('g', { class: 'kp-areas' });
  for (const h of lay.nodes.filter(n => n.kind === 'dept')) {
    const own = lay.nodes.filter(n => n.dept === h.dept && n.kind !== 'dept');
    const bottom = Math.max(h.y + h.h + 40, ...own.map(n => n.y + n.h + (n.text ? n.text.h + KP_LAYOUT.descGap : 0)));
    g.append(kpEl('rect', { class: 'kp-area ' + kpHue(h.hue), x: h.x, y: h.y, width: h.w, height: bottom - h.y, rx: 10, 'data-dept': h.dept }));
  }
  return g;
}

function kpOverviewLabels() {
  const g = document.getElementById('kpOverview');
  if (!g) return;
  const k = kpBoard.cam.k;
  if (k >= KP_ZOOM.cardsOff) { g.replaceChildren(); return; }
  const fs = 13 / k, lh = 16 / k, pad = 8 / k;
  const out = [];
  for (const r of document.querySelectorAll('#kpCam .kp-area')) {
    const x = +r.getAttribute('x'), y = +r.getAttribute('y'), w = +r.getAttribute('width'), h = +r.getAttribute('height');
    const d = kpBoard.layout.nodes.find(n => n.dept === r.dataset.dept && n.kind === 'dept');
    const name = d.title[0], count = d.count + ' program';
    const perLine = Math.floor((w * k - 16) / 7.4);
    if (perLine >= 12) {
      const lines = kpWrap(name, perLine, 3);
      out.push(kpText(x + pad, y + pad + fs, lines, 'kp-ov-t', lh), kpEl('text', { class: 'kp-ov-n', x: x + pad, y: y + pad + fs + lines.length * lh + 2 / k }, count));
      out[out.length - 2].setAttribute('font-size', fs); out[out.length - 1].setAttribute('font-size', fs * 0.85);
    } else {
      const t = kpEl('text', { class: 'kp-ov-t', 'font-size': fs, transform: 'translate(' + (x + w / 2 + fs * 0.35) + ',' + (y + pad) + ') rotate(90)' }, kpCut(name, Math.floor(((kpBoard.layout.height - y) * k - 16) / 7.4)));
      out.push(t);
    }
  }
  g.replaceChildren(...out);
}

function kpLayerLabels(lay) {
  const g = kpEl('g', { class: 'kp-layer-labels' });
  const add = (y, t) => g.append(kpEl('text', { class: 'kp-layer-l', x: KP_LABEL_X, y: y + 18 }, t));
  for (const l of ['L1', 'L2', 'L3', 'L4']) if (lay.rows[l]) add(lay.rows[l].y, l + ' · ' + KP_LAYER_NAMES[l]);
  if (lay.rows.roadmap && lay.rows.roadmap.h) add(lay.rows.roadmap.y, 'Ütemterv ↓');
  return g;
}

// ---- header click = collapse, double-click = focus (click waits so a double-click is not two toggles)
let kpClickTimer = null;
function kpHeaderClick(dept) {
  clearTimeout(kpClickTimer);
  kpClickTimer = setTimeout(() => {
    if (kpBoard.focus) return;
    const c = kpBoard.collapsed;
    kpBoard.collapsed = c.includes(dept) ? c.filter(d => d !== dept) : c.concat(dept);
    kpStore.set('collapsed', kpBoard.collapsed);
    kpBoardRender();
  }, 250);
}
function kpHeaderDbl(dept) {
  clearTimeout(kpClickTimer);
  kpBoard.focus = kpBoard.focus === dept ? null : dept;
  kpBoard.fitted = false;
  kpBoardRender();
}

// ---- chrome: rail, view toggle, focus note
function kpRenderChrome() {
  for (const b of document.querySelectorAll('#kpRail button')) b.classList.toggle('on', kpBoard.layers[b.dataset.layer] !== false);
  for (const b of document.querySelectorAll('#kpView button')) b.classList.toggle('on', b.dataset.view === kpBoard.view);
  const f = document.getElementById('kpFocus');
  if (kpBoard.focus) {
    const d = kpData.topology.departments.find(x => x.id === kpBoard.focus);
    f.textContent = 'Fókusz: ' + (d ? d.t : kpBoard.focus) + ' — Esc: vissza';
    f.hidden = false;
  } else f.hidden = true;
}

function kpSetView(v) {
  kpBoard.view = v;
  kpStore.set('view', v);
  kpBoard.fitted = false;
  kpBoardRender();
}

function kpToggleLayer(l) {
  kpBoard.layers[l] = kpBoard.layers[l] === false;
  kpStore.set('layers', kpBoard.layers);
  kpBoardRender();
}

// ---- camera
function kpApplyCam() {
  const c = kpBoard.cam;
  const g = document.getElementById('kpCam');
  if (g) g.setAttribute('transform', `translate(${c.x},${c.y}) scale(${c.k})`);
  const svg = document.getElementById('kpBoard');
  svg.classList.toggle('lod-desc', c.k < KP_ZOOM.descOff);
  svg.classList.toggle('lod-cards', c.k < KP_ZOOM.cardsOff);
  kpOverviewLabels();
}

function kpFit() {
  const lay = kpBoard.layout;
  const svg = document.getElementById('kpBoard');
  const r = svg.getBoundingClientRect();
  if (!lay || !r.width) return;
  const pad = 24, minX = KP_LABEL_X - 150;
  const w = lay.width - minX, h = lay.height;
  const k = Math.max(KP_ZOOM.min, Math.min(KP_ZOOM.max, Math.min((r.width - 2 * pad) / w, (r.height - 2 * pad) / h)));
  kpBoard.cam = { k, x: (r.width - w * k) / 2 - minX * k, y: pad };
  kpApplyCam();
}

function kpZoomAt(mx, my, factor) {
  const c = kpBoard.cam;
  const k = Math.max(KP_ZOOM.min, Math.min(KP_ZOOM.max, c.k * factor));
  kpBoard.cam = { k, x: mx - (mx - c.x) * k / c.k, y: my - (my - c.y) * k / c.k };
  kpApplyCam();
}

// put a board point at screen point (used by tests / later "jump to node")
function kpCenterOn(bx, by, k) {
  const r = document.getElementById('kpBoard').getBoundingClientRect();
  kpBoard.cam = { k, x: r.width / 2 - bx * k, y: r.height / 2 - by * k };
  kpApplyCam();
}

function kpBoardInit() {
  kpBoardLoad();
  const svg = document.getElementById('kpBoard');
  let drag = null, space = false;

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    kpZoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  svg.addEventListener('pointerdown', e => {
    if (e.button === 1 || (e.button === 0 && space)) {
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, cx: kpBoard.cam.x, cy: kpBoard.cam.y };
      svg.setPointerCapture(e.pointerId);
      svg.classList.add('panning');
    }
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    kpBoard.cam.x = drag.cx + e.clientX - drag.x;
    kpBoard.cam.y = drag.cy + e.clientY - drag.y;
    kpApplyCam();
  });
  const end = () => { drag = null; svg.classList.remove('panning'); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

  window.addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const r = svg.getBoundingClientRect();
    if (e.code === 'Space') { space = true; svg.classList.add('space'); e.preventDefault(); }
    else if (e.key === '0') kpFit();
    else if (e.key === '+' || e.key === '=') kpZoomAt(r.width / 2, r.height / 2, KP_ZOOM.step);
    else if (e.key === '-') kpZoomAt(r.width / 2, r.height / 2, 1 / KP_ZOOM.step);
    else if (e.key === 'Escape' && kpBoard.focus) { kpBoard.focus = null; kpBoard.fitted = false; kpBoardRender(); }
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') { space = false; svg.classList.remove('space'); } });
  window.addEventListener('resize', () => kpApplyCam());

  for (const b of document.querySelectorAll('#kpView button')) b.addEventListener('click', () => kpSetView(b.dataset.view));
  document.getElementById('kpFit').addEventListener('click', kpFit);
  kpBoardRender();
}
