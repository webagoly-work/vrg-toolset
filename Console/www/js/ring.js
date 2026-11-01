/* Varler SUI primitives: ticks, sector, callout, reticle, branchTree, radar, vitals.
   Plain data in, SVG or DOM out. Colours are CSS tokens, so both themes work. There is no demo
   data and no fixed label here: the caller passes every string, already translated.
   Styles live in css/ring.css. Hit areas are 48 units tall; keep the SVG at 1:1 or larger. */
const NS = 'http://www.w3.org/2000/svg';
export const MIN_TARGET = 48;

export const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

export const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

const text = (attrs, parent, value) => {
  const t = el('text', attrs, parent);
  t.textContent = value;
  return t;
};

/* Enter and Space act like a click on an SVG element with role=button. */
function pressable(g, label, onPress) {
  g.setAttribute('tabindex', 0);
  g.setAttribute('role', 'button');
  g.setAttribute('aria-label', label);
  g.addEventListener('click', onPress);
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress(e); }
  });
}

export function ring(g, { cx, cy, r, stroke = 'var(--line)', w = 1, dash }) {
  return el('circle', { cx, cy, r, fill: 'none', stroke, 'stroke-width': w, ...(dash ? { 'stroke-dasharray': dash } : {}) }, g);
}

export function ticks(g, { cx, cy, r, n = 120, len = 5, every = 10, majorLen = 11, stroke = 'var(--dim)' }) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI;
    const l = i % every ? len : majorLen;
    const [x1, y1] = pol(cx, cy, r, a);
    const [x2, y2] = pol(cx, cy, r + l, a);
    d += `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return el('path', { d, stroke, 'stroke-width': 1, fill: 'none', class: 'r-stroke' }, g);
}

export function sector(cx, cy, r0, r1, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = pol(cx, cy, r1, a0);
  const [x1, y1] = pol(cx, cy, r1, a1);
  const [x2, y2] = pol(cx, cy, r0, a1);
  const [x3, y3] = pol(cx, cy, r0, a0);
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

/* A leader line that draws itself; --len sets the dash for css .r-draw. */
export function drawLine(g, pts, stroke = 'var(--cyan)') {
  const d = 'M' + pts.map((p) => p.join(',')).join('L');
  const p = el('path', { d, fill: 'none', stroke, 'stroke-width': 1.5, class: 'r-draw' }, g);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  p.style.setProperty('--len', len);
  return p;
}

/* actions: [{ label, onPress }]. Each is a real 48-unit button. */
export function callout(g, { x, y, r = 18, dx = 60, dy = -50, title, sub, actions = [] }) {
  const c = el('g', {}, g);
  const lock = el('circle', { cx: x, cy: y, r, fill: 'none', stroke: 'var(--cyan)', 'stroke-width': 1.5, class: 'r-draw' }, c);
  lock.style.setProperty('--len', 2 * Math.PI * r);
  el('circle', { cx: x, cy: y, r: 3, fill: 'var(--cyan)' }, c);
  el('path', { d: `M${x},${y - r - 8}l-6,-9h12z`, fill: 'var(--alert)', class: 'r-fade' }, c);
  const side = Math.sign(dx) || 1;
  const [ex, ey] = pol(x, y, r, Math.atan2(dy, dx));
  const kx = x + dx;
  const ky = y + dy;
  const tx = kx + side * 16;
  drawLine(c, [[ex, ey], [kx, ky], [tx, ky]]);
  const lab = el('g', { class: 'r-fade' }, c);
  const w = Math.max(150, title.length * 9 + 28);
  const bx = side > 0 ? tx : tx - w;
  el('rect', { x: bx, y: ky - 15, width: w, height: 30, fill: 'var(--ground)', stroke: 'var(--cyan)', 'stroke-width': 1 }, lab);
  text({ x: bx + 12, y: ky + 5, class: 'r-lbl' }, lab, title);
  if (sub) text({ x: bx + 12, y: ky + 32, class: 'r-mono' }, lab, sub);
  actions.forEach((a, i) => {
    const ay = ky + 42 + i * (MIN_TARGET + 4);
    const b = el('g', { class: 'r-act' }, lab);
    el('rect', { x: bx, y: ay, width: w, height: MIN_TARGET, fill: 'var(--panel)', stroke: 'var(--line)' }, b);
    text({ x: bx + 12, y: ay + 29, class: 'r-lbl-s' }, b, a.label);
    pressable(b, a.label, a.onPress);
  });
  return c;
}

/* Fixed centering lines, drawn on a layer that never pans. */
export function reticle(g, { cx, cy, r = 70, gap = 14, reach = 600, label }) {
  const attrs = { stroke: 'var(--cyan)', 'stroke-opacity': 0.32 };
  [[cx - gap, cy, cx - reach, cy], [cx + gap, cy, cx + reach, cy], [cx, cy - gap, cx, cy - reach], [cx, cy + gap, cx, cy + reach]]
    .forEach(([x1, y1, x2, y2]) => el('line', { x1, y1, x2, y2, ...attrs, 'stroke-width': 1, 'stroke-dasharray': '2 6' }, g));
  el('path', { d: sector(cx, cy, r, r + 1, -2.6, -0.55) + sector(cx, cy, r, r + 1, 0.55, 2.6), fill: 'var(--cyan)', 'fill-opacity': 0.32 }, g);
  ticks(g, { cx, cy, r: r + 6, n: 72, len: 3, every: 18, majorLen: 8, stroke: 'var(--cyan)' }).setAttribute('stroke-opacity', 0.32);
  if (label) text({ x: cx + r + 14, y: cy - 6, class: 'r-mono' }, g, label);
}

const shortHash = (s) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7);
};

const commit = (c, key) => (typeof c === 'string' ? { label: c, hash: shortHash(key + c) } : c);

/* main: commits; branches: [{ name, fork, commits, ahead, behind, dirty }].
   A commit is a string or { label, hash }.
   labels: { main, dirty, aheadBehind(branch) }. onPick gets what was selected. */
export function branchTree(svg, main, branches, { labels, onPick, initial } = {}) {
  svg.replaceChildren();
  const W = 104, H = 26, X = (c) => 30 + c * 126, MY = 46, RY = (r) => MY + (r + 1) * 76;
  const cols = Math.max(main.length, ...branches.map((b) => b.fork + 1 + b.commits.length));
  svg.setAttribute('viewBox', `0 0 ${X(cols) + 60} ${RY(branches.length) + 10}`);
  const nodes = {}, edges = {};
  const eg = el('g', {}, svg), ng = el('g', {}, svg);
  const picks = {};

  const node = (key, x, y, c, isMain) => {
    const g = el('g', { class: 'r-node' }, ng);
    el('rect', { x: x - 11, y: y - 11, width: W + 22, height: MIN_TARGET, fill: 'transparent' }, g);
    el('rect', { x, y, width: W, height: H, class: 'r-box', fill: 'var(--ground)', stroke: isMain ? 'var(--dim)' : 'var(--line)' }, g);
    text({ x: x + W / 2, y: y + 17, 'text-anchor': 'middle', class: 'r-lbl r-lbl-node' }, g, c.label);
    text({ x: x + W / 2, y: y + H + 13, 'text-anchor': 'middle', class: 'r-chip' }, g, c.hash);
    nodes[key] = g;
    pressable(g, c.label, () => pick(key));
  };
  const edge = (key, d) => { edges[key] = el('path', { d, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1.2 }, eg); };

  if (labels?.main) text({ x: 30, y: MY - 12, class: 'r-lbl-s' }, svg, labels.main);
  main.forEach((m, i) => {
    const c = commit(m, 'm' + i);
    node('m' + i, X(i), MY, c, true);
    if (i) edge('m' + i, `M${X(i - 1) + W},${MY + H / 2}H${X(i)}`);
    const path = [];
    for (let k = 0; k <= i; k++) path.push('m' + k);
    picks['m' + i] = { path, info: { kind: 'main', ...c } };
  });
  branches.forEach((b, r) => {
    const y = RY(r), fx = X(b.fork) + W / 2;
    text({ x: X(b.fork + 1), y: y - 10, class: 'r-lbl-s r-accent' }, svg, b.name);
    b.commits.forEach((raw, j) => {
      const c = commit(raw, `b${r}_${j}`);
      const key = `b${r}_${j}`;
      node(key, X(b.fork + 1 + j), y, c);
      edge(key, j ? `M${X(b.fork + j) + W},${y + H / 2}H${X(b.fork + 1 + j)}` : `M${fx},${MY + H + 18}V${y + H / 2 - 8}q0,8 8,8H${X(b.fork + 1)}`);
      const path = [];
      for (let k = 0; k <= b.fork; k++) path.push('m' + k);
      for (let k = 0; k <= j; k++) path.push(`b${r}_${k}`);
      picks[key] = { path, info: { kind: 'branch', ...c, branch: b.name, index: j + 1, total: b.commits.length, ahead: b.ahead, behind: b.behind, dirty: !!b.dirty } };
    });
    const lx = X(b.fork + b.commits.length) + W + 10;
    if (labels?.aheadBehind) text({ x: lx, y: y + 12, class: 'r-chip' }, svg, labels.aheadBehind(b));
    if (b.dirty && labels?.dirty) text({ x: lx, y: y + 26, class: 'r-chip r-attn' }, svg, labels.dirty);
  });

  function pick(key) {
    Object.values(nodes).forEach((n) => n.classList.remove('on'));
    Object.values(edges).forEach((e) => e.classList.remove('r-edge-on'));
    picks[key].path.forEach((k) => { nodes[k].classList.add('on'); edges[k]?.classList.add('r-edge-on'); });
    onPick?.(picks[key].info);
  }
  if (initial) pick(initial);
  return { pick };
}

let radarId = 0;

/* A 10-level attribute matrix. base is the dashed ghost of the starting build. */
export function radar(svg, { axes, values, base, max = 20, cx = 280, cy = 262, r = 140, caption, showTotal = true }) {
  svg.replaceChildren();
  const n = axes.length;
  const ang = (i) => -Math.PI / 2 + i / n * 2 * Math.PI;
  const id = 'r-glow-' + (++radarId);
  const defs = el('defs', {}, svg);
  const f = el('filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  el('feGaussianBlur', { stdDeviation: 3, result: 'b' }, f);
  const m = el('feMerge', {}, f);
  el('feMergeNode', { in: 'b' }, m);
  el('feMergeNode', { in: 'SourceGraphic' }, m);
  for (let l = 1; l <= 10; l++) ring(svg, { cx, cy, r: r * l / 10, stroke: 'var(--dim)', w: l % 5 ? 0.4 : 1 });
  ticks(svg, { cx, cy, r: r + 3, n: n * 5, len: 3, every: 5, majorLen: 7 });
  const poly = (v) => v.map((x, i) => pol(cx, cy, r * x / max, ang(i)).map((z) => z.toFixed(1)).join(',')).join(' ');
  axes.forEach((a, i) => {
    const [x, y] = pol(cx, cy, r, ang(i));
    el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--dim)', 'stroke-opacity': 0.5 }, svg);
    const [lx, ly] = pol(cx, cy, r + 20, ang(i));
    const c = Math.cos(ang(i)), s = Math.sin(ang(i));
    const anchor = Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end';
    const t = el('text', { x: lx, y: ly + (s > 0.5 ? 10 : s < -0.5 ? -2 : 4), 'text-anchor': anchor, class: 'r-lbl-s r-accent' }, svg);
    el('tspan', { class: 'r-axis-value' }, t).textContent = `[${values[i]}] `;
    el('tspan', {}, t).textContent = a;
  });
  if (base) el('polygon', { points: poly(base), fill: 'none', stroke: 'var(--dim)', 'stroke-dasharray': '3 4' }, svg);
  el('polygon', { points: poly(values), fill: 'var(--cyan-soft)', stroke: 'var(--cyan)', 'stroke-width': 1.6, filter: `url(#${id})`, 'stroke-linejoin': 'round', class: 'r-glow' }, svg);
  values.forEach((v, i) => {
    const [x, y] = pol(cx, cy, r * v / max, ang(i));
    el('circle', { cx: x, cy: y, r: 3.2, fill: 'var(--cyan)' }, svg);
  });
  if (showTotal) {
    ring(svg, { cx, cy, r: 16, stroke: 'var(--cyan)' });
    text({ x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'r-mono r-strong' }, svg, String(values.reduce((a, b) => a + b, 0)));
  }
  if (caption) text({ x: 24, y: cy + r + 98, class: 'r-mono' }, svg, caption);
}

/* metrics: [{ key, label, unit, lo, hi, value }]. update({ key: number }) adds one point.
   format(value, metric) keeps numbers in the viewer's locale. */
export function vitals(container, metrics, { points = 24, format = (v) => String(v) } = {}) {
  const items = metrics.map((m) => {
    const box = document.createElement('div');
    box.className = 'r-vit';
    const name = document.createElement('b');
    name.textContent = m.label;
    const figure = document.createElement('span');
    const svg = el('svg', { viewBox: '0 0 70 20', 'aria-hidden': 'true' });
    const line = el('polyline', { fill: 'none', stroke: 'var(--cyan)', 'stroke-width': 1.2 }, svg);
    box.append(name, figure, svg);
    container.appendChild(box);
    return { m, figure, line, h: Array(points).fill(m.value ?? m.lo) };
  });
  const paint = (it) => {
    const { m, h } = it;
    const span = m.hi - m.lo || 1;
    it.figure.textContent = format(h[h.length - 1], m) + (m.unit ? ' ' + m.unit : '');
    it.line.setAttribute('points', h.map((v, i) => `${(i / (points - 1) * 70).toFixed(1)},${(18 - (v - m.lo) / span * 16).toFixed(1)}`).join(' '));
  };
  items.forEach(paint);
  return {
    update(values) {
      for (const it of items) {
        if (!(it.m.key in values)) continue;
        it.h.push(values[it.m.key]);
        it.h.shift();
        paint(it);
      }
    },
  };
}
