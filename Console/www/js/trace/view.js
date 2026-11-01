/* Draws the trace graph into one SVG. Nodes keep their place from first use; an edge draws itself
   once, then only its width and brightness change. The page's node list is the equal of tapping here. */
import { t } from '../core/i18n.js';
import { callout, drawLine, el, pol, reticle, ring } from '../ring.js';
import { heatOf } from './model.js';

const SIZE = 800;
const MID = SIZE / 2;
const RINGS = { root: 0, agent: 120, skill: 225, mcp: 225, tool: 225, file: 330 };
const GOLDEN = 2.399963;
const FILL = { root: 'var(--cyan)', agent: 'var(--amber)', skill: 'var(--alert)', mcp: 'var(--alert)', tool: 'var(--cyan)', file: 'var(--dim)' };
const LABEL_MIN_PX = 11;

export const labelOf = (n) => (n.type === 'root' ? t('trace.root') : n.sub ? `${n.label}/${n.sub}` : n.label);

export function createTraceView(host, { onPick }) {
  const svg = el('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'trace-svg', role: 'img', 'aria-label': t('trace.graph') });
  host.append(svg);
  for (const r of [120, 225, 330]) ring(svg, { cx: MID, cy: MID, r, dash: '2 7' });
  const edgeLayer = el('g', {}, svg);
  const nodeLayer = el('g', {}, svg);
  const overlay = el('g', {}, svg);
  const places = new Map();
  const perRing = new Map();
  const lines = new Map();
  const dots = new Map();
  let overlayKey = '';
  let zoom = 1;

  function place(n) {
    let p = places.get(n.id);
    if (p) return p;
    const r = RINGS[n.type] ?? 225;
    const i = perRing.get(r) ?? 0;
    perRing.set(r, i + 1);
    p = r ? pol(MID, MID, r + (i % 3) * 16, i * GOLDEN - Math.PI / 2) : [MID, MID];
    places.set(n.id, p);
    return p;
  }

  function dot(n) {
    let d = dots.get(n.id);
    if (d) return d;
    const [x, y] = place(n);
    const g = el('g', { class: 'tn' }, nodeLayer);
    el('circle', { cx: x, cy: y, r: 30, fill: 'transparent' }, g);
    const c = el('circle', { cx: x, cy: y, r: 7, fill: FILL[n.type] ?? 'var(--cyan)', class: 'r-fade' }, g);
    const label = el('text', { x, y: y - 14, 'text-anchor': 'middle', class: 'tl' }, g);
    label.textContent = labelOf(n);
    g.addEventListener('click', () => onPick(n.id));
    d = { g, c, label, x, y };
    dots.set(n.id, d);
    return d;
  }

  function lineFor(e, a, b) {
    let p = lines.get(e.id);
    if (p) return p;
    const knee = [a[0] + (b[0] - a[0]) * 0.7, a[1] + (b[1] - a[1]) * 0.95];
    p = drawLine(edgeLayer, [a, knee, b]);
    lines.set(e.id, p);
    return p;
  }

  /* hide labels that would touch a hotter one, so nothing overlaps */
  function fitLabels(nodes, warmth, selected, font) {
    const taken = [];
    const order = [...nodes].sort((a, b) => (b.id === selected) - (a.id === selected) || (b.type === 'root') - (a.type === 'root') || (warmth.get(b.id) ?? 0) - (warmth.get(a.id) ?? 0));
    for (const n of order) {
      const d = dots.get(n.id);
      const w = d.label.textContent.length * font * 0.6;
      const box = { x0: d.x - w / 2, x1: d.x + w / 2, y0: d.y - 14 - font, y1: d.y - 12 };
      const clash = taken.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0);
      d.label.setAttribute('font-size', font);
      d.label.setAttribute('y', d.y - 14);
      d.label.style.display = clash ? 'none' : '';
      if (!clash) taken.push(box);
    }
  }

  function paintOverlay({ selected, pending }) {
    const key = selected + '|' + pending.map((p) => p.callId).join();
    if (key === overlayKey) return;
    overlayKey = key;
    overlay.replaceChildren();
    if (selected && dots.get(selected)) {
      const d = dots.get(selected);
      reticle(overlay, { cx: d.x, cy: d.y, r: 24, gap: 6, reach: 40 });
    }
    pending.forEach((p, i) => {
      const d = p.target && dots.get(p.target.id);
      if (d) callout(overlay, { x: d.x, y: d.y, dx: d.x > MID ? -60 : 60, dy: -50 - i * 8, title: t('trace.waits'), sub: p.tool });
    });
  }

  function viewBox(selected) {
    const span = SIZE / zoom;
    const d = selected && dots.get(selected);
    const clamp = (v) => Math.max(0, Math.min(SIZE - span, v));
    const x = d ? clamp(d.x - span / 2) : (SIZE - span) / 2;
    const y = d ? clamp(d.y - span / 2) : (SIZE - span) / 2;
    svg.setAttribute('viewBox', `${x} ${y} ${span} ${span}`);
  }

  return {
    setZoom(z) { zoom = z; },
    render({ nodes, edges, metric, now, selected, pending }) {
      const shown = new Set(nodes.map((n) => n.id));
      nodes.forEach(dot);
      const peak = Math.max(1e-9, ...edges.map((e) => heatOf(e, metric, now)));
      const warmth = new Map();
      const on = new Set();
      for (const e of edges) {
        const a = dots.get(e.from);
        const b = dots.get(e.to);
        if (!a || !b) continue;
        const heat = Math.sqrt(heatOf(e, metric, now) / peak);
        warmth.set(e.to, Math.max(warmth.get(e.to) ?? 0, heat));
        const p = lineFor(e, [a.x, a.y], [b.x, b.y]);
        on.add(e.id);
        p.style.display = '';
        p.setAttribute('stroke-width', (1 + Math.log2(1 + e.count) * 0.7 + heat * 5).toFixed(2));
        p.setAttribute('opacity', (0.28 + heat * 0.72).toFixed(2));
        p.setAttribute('stroke', e.errors ? 'var(--amber)' : 'var(--cyan)');
      }
      for (const [id, p] of lines) if (!on.has(id)) p.style.display = 'none';
      for (const [id, d] of dots) d.g.style.display = shown.has(id) ? '' : 'none';
      viewBox(selected);
      const px = (svg.clientWidth || SIZE) / (SIZE / zoom);
      fitLabels(nodes, warmth, selected, Math.round(LABEL_MIN_PX / Math.min(px, 1)));
      paintOverlay({ selected, pending });
      return warmth;
    },
  };
}
