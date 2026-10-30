// 39-views.js — three ways to look at the same city (KV-28 scaffold, 2026-10-29).
//   Globális (global): everything as it was before KV-28 — the city, the Land around it, the GitWorld planet.
//   Város (city): the new default — only the city; the Land, the planet and their HUD stay out of the picture.
//     It is a scaffold: the City View spec (look, feel, function) lands here, in vwCity below.
//   Egyszerű (simple): a flat, colour-coded top-down diagram (SVG) of the same treemap — districts outlined,
//     files filled by language, only the files that exist at the shown commit; click opens the file or district panel.
// The view rides in the hash (#view=global|city|simple) and is remembered per viewer; V cycles, the bar switches.
// Every Land/World layer adds itself to world.group, often re-created, so the city view hides them each frame
// (scene.onBeforeRender) instead of chasing every redraw.

const VIEWS = [['city', 'Város', 'Csak a kódváros — az új alapnézet'], ['global', 'Globális', 'A város a Földdel és a GitWorld bolygóval, ahogy eddig'],
  ['simple', 'Egyszerű', 'Lapos, felülnézeti térkép: körzetek és fájlok nyelv szerinti színnel']];
const vw = { id: 'city', bar: null, svg: null, box: null, drag: null };

// layers that belong to the Land and above (29–36); the city view keeps them invisible
const vwOuter = () => [land.group, pw.group, fl.group, wd.group, ap.group, st.group, et.group].filter(Boolean);
scene.onBeforeRender = () => { if (vw.id !== 'global') for (const g of vwOuter()) g.visible = false; };

function setView(id, save = true) {
  if (!VIEWS.some(v => v[0] === id)) id = 'city';
  const was = vw.id;
  vw.id = id;
  document.body.dataset.view = id;
  if (vw.bar) for (const b of vw.bar.children) b.classList.toggle('on', b.dataset.view === id);
  if (id === 'global' && was !== 'global') for (const g of vwOuter()) g.visible = true;
  if (save) try { localStorage.setItem('kv-view', id); } catch { /* private window: the hash still carries it */ }
  if (id === 'simple') vwSimple(); else if (vw.svg) vw.svg.hidden = true;
  if (id === 'city' && current) vwCity();
  writeHashSoon();
  requestRender();
}

// ---- Város: the city alone. The camera stays below the Land's level (29-land: side × 1.9).
function vwCity() {
  if (orbit.r > current.side * 1.8) flyCamera([0, 0, orbit.theta, orbit.phi, current.side * 1.25], window.KV_INSTANT ? 0 : 500);
}
canvas.addEventListener('wheel', () => {
  if (vw.id !== 'city' || !current || orbit.r <= current.side * 1.8) return;
  orbit.r = current.side * 1.8; placeCamera();
}, { passive: true });
// Home in the city view frames the city instead of flying out to the Land (capture: before 29-land's handler)
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea, select')) return;
  if (e.key === 'v' || e.key === 'V') { const i = VIEWS.findIndex(v => v[0] === vw.id); setView(VIEWS[(i + 1) % VIEWS.length][0]); return; }
  if (e.key === 'Home' && !e.shiftKey && vw.id !== 'global' && current) {
    e.preventDefault(); e.stopImmediatePropagation();
    flyCamera([0, 0, 0.8, 0.95, current.side * 1.25], window.KV_INSTANT ? 0 : 600);
  }
}, true);

// ---- Egyszerű: the treemap as flat SVG, in world units (the root spans ±side/2), so it is the city seen from above
const SVG_NS = 'http://www.w3.org/2000/svg';
const vwHex = c => '#' + c.toString(16).padStart(6, '0');
function vwEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.append(el);
  return el;
}
function vwSimple() {
  if (!current) return;
  if (!vw.svg) {
    vw.svg = vwEl('svg', { id: 'simple', role: 'img', 'aria-label': 'A város felülnézeti térképe' });
    $('stage').append(vw.svg);
    vwPanZoom(vw.svg);
  }
  const s = current.side, svg = vw.svg;
  if (!vw.box || vw.box.side !== s) vw.box = { x: -s / 2 - s * 0.03, z: -s / 2 - s * 0.03, w: s * 1.06, side: s };
  svg.replaceChildren();
  svg.hidden = false;
  const langs = new Map();
  (function walk(d) {
    const { x, z, w, h } = d.rect;
    const g = vwEl('rect', { x, y: z, width: w, height: h, class: 'd d' + Math.min(d.depth, 5) }, svg);
    g.__dir = d;
    vwEl('title', {}, g).textContent = (d.path || current.city.repo.name) + '/';
    for (const f of d.files) {
      if (!(replay.cur[f.i * 3] > 0)) continue;   // not born yet / deleted at the shown commit
      const r = f.rect, el = vwEl('rect', { x: r.x, y: r.z, width: r.w, height: r.h, fill: vwHex(langColor(f.lang)), class: 'f' }, svg);
      el.__file = f;
      vwEl('title', {}, el).textContent = `${f.p} · ${hu(f.loc)} sor`;
      langs.set(f.lang, (langs.get(f.lang) || 0) + 1);
    }
    d.dirs.forEach(walk);
  })(current.root);
  // district names on the top levels, sized to their plate
  (function label(d) {
    if (d.depth > 2) return;
    const { x, z, w, h } = d.rect, fs = Math.min(w / Math.max(4, d.name.length) * 1.3, h * 0.12, s * 0.035);
    if (d.depth && fs > s * 0.006) vwEl('text', { x: x + w / 2, y: z + h / 2, 'font-size': fs, class: 'lbl' }, svg).textContent = d.name;
    d.dirs.forEach(label);
  })(current.root);
  vwBox();
  // legend: the languages that stand at this commit, most files first
  const lg = document.createElement('div'); lg.id = 'simple-legend';
  lg.innerHTML = [...langs].sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([l, n]) => `<span><i style="background:${vwHex(langColor(l))}"></i>${l} <small>${n}</small></span>`).join('');
  document.getElementById('simple-legend')?.remove();
  $('stage').append(lg);
}
function vwBox() { const b = vw.box; vw.svg.setAttribute('viewBox', `${b.x} ${b.z} ${b.w} ${b.w}`); }
function vwPanZoom(svg) {
  const toWorld = e => { const r = svg.getBoundingClientRect(), k = vw.box.w / Math.min(r.width, r.height);
    return { k, x: vw.box.x + (e.clientX - r.left - Math.max(0, r.width - r.height) / 2) * k, z: vw.box.z + (e.clientY - r.top - Math.max(0, r.height - r.width) / 2) * k }; };
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const p = toWorld(e), f = Math.exp(e.deltaY * 0.001), b = vw.box;
    b.w = Math.min(b.side * 3, Math.max(b.side * 0.01, b.w * f));
    b.x = p.x - (p.x - b.x) * f; b.z = p.z - (p.z - b.z) * f;
    vwBox();
  }, { passive: false });
  svg.addEventListener('pointerdown', e => { vw.drag = { x: e.clientX, y: e.clientY, moved: 0 }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', e => {
    if (!vw.drag) return;
    const { k } = toWorld(e), dx = e.clientX - vw.drag.x, dy = e.clientY - vw.drag.y;
    vw.drag.x = e.clientX; vw.drag.y = e.clientY; vw.drag.moved += Math.abs(dx) + Math.abs(dy);
    vw.box.x -= dx * k; vw.box.z -= dy * k; vwBox();
  });
  svg.addEventListener('pointerup', e => {
    const d = vw.drag; vw.drag = null;
    if (!d || d.moved >= 4) return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (t && t.__file) showFile(t.__file); else if (t && t.__dir) showDir(t.__dir); else closePanel();
  });
}
// 99-boot's onTimeChanged calls this: the diagram follows the replay
function vwRefresh() { if (vw.id === 'simple') vwSimple(); }

// ---- the switch in the bar
{
  vw.bar = document.createElement('div'); vw.bar.id = 'views'; vw.bar.setAttribute('role', 'group'); vw.bar.setAttribute('aria-label', 'Nézet');
  for (const [id, name, tip] of VIEWS) {
    const b = document.createElement('button'); b.className = 'btn'; b.dataset.view = id; b.textContent = name; b.title = tip + ' (V: váltás)';
    b.onclick = () => setView(id);
    vw.bar.append(b);
  }
  $('bar').insertBefore(vw.bar, $('dock-btn'));
  let saved = null;
  try { saved = localStorage.getItem('kv-view'); } catch { /* no storage: the default */ }
  setView(new URLSearchParams(location.hash.slice(1)).get('view') || saved || 'city', false);
}
