// 08-roads.js — relations drawn as arcs between roofs (SEE / CodeCharta edges):
//   amber = files the selected one imports · cyan = files that import it · violet = change together.
// U toggles every import road at once, faintly. "Szomszédok" (God's Eye View's contacts panel):
// the files that most often change in the same commit as the selected one.

const ROAD_COLORS = { out: 0xffb547, in: 0x5ad0e6, co: 0xc58bff, all: 0x8fa6d8 };
const roads = { group: new THREE.Group(), all: false, importers: [] };
scene.add(roads.group);

function roadsPrepare(model) {
  roads.importers = model.city.files.map(() => []);
  model.city.files.forEach((f, i) => (f.imp || []).forEach(j => roads.importers[j].push(i)));
}

const roofOf = i => {
  const f = current.city.files[i], { x, z, w, h } = f.rect, bh = stateAt(f, i, replay.T)[0];
  return bh > 0 ? new THREE.Vector3(x + w / 2, f.base + bh, z + h / 2) : null;
};
// one arc per pair, as line segments: a parabola lifted in proportion to its length
function arcs(pairs, color, opacity) {
  const pts = [], SEG = 20;
  for (const [a, b] of pairs) {
    const p = roofOf(a), q = roofOf(b);
    if (!p || !q) continue;
    const lift = Math.max(p.y, q.y) + p.distanceTo(q) * 0.3 + 2;
    let prev = p;
    for (let s = 1; s <= SEG; s++) {
      const t = s / SEG, x = p.x + (q.x - p.x) * t, z = p.z + (q.z - p.z) * t;
      const y = (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * lift + t * t * q.y;
      pts.push(prev.x, prev.y, prev.z, x, y, z);
      prev = new THREE.Vector3(x, y, z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  line.raycast = () => {};
  return line;
}

function roadsRefresh() {
  for (const o of [...roads.group.children]) { roads.group.remove(o); o.geometry.dispose(); o.material.dispose(); }
  if (!current) return;
  const files = current.city.files;
  if (roads.all) {
    const all = [];
    files.forEach((f, i) => (f.imp || []).forEach(j => all.length < 4000 && all.push([i, j])));
    roads.group.add(arcs(all, ROAD_COLORS.all, 0.22));
  }
  const f = shownFile;
  if (f) {
    roads.group.add(arcs((f.imp || []).map(j => [f.i, j]), ROAD_COLORS.out, 0.9));
    roads.group.add(arcs(roads.importers[f.i].map(j => [j, f.i]), ROAD_COLORS.in, 0.9));
    roads.group.add(arcs(neighboursOf(f.i).map(([j]) => [f.i, j]), ROAD_COLORS.co, 0.6));
  }
  requestRender();
}

function toggleRoads() {
  roads.all = !roads.all;
  $('roads-btn').classList.toggle('on', roads.all);
  roadsRefresh();
  writeHashSoon();
}

// the extra panel section for a file: road counts and the neighbour list (click = fly there)
function roadsPanelHtml(f) {
  const nb = neighboursOf(f.i), files = current.city.files;
  const sw = c => `<i style="background:#${c.toString(16).padStart(6, '0')}"></i>`;
  const rows = nb.map(([j, n, s]) => `<li data-path="${esc(files[j].p)}" title="${esc(files[j].p)}">${esc(files[j].name)} <span class="dim">${n}× · ${Math.round(s * 100)} %</span></li>`).join('');
  return `<div class="roads">${sw(ROAD_COLORS.out)}importál: ${(f.imp || []).length} · ${sw(ROAD_COLORS.in)}importálják: ${roads.importers[f.i].length}</div>`
    + `<h4>${sw(ROAD_COLORS.co)}Szomszédok <span class="dim">— együtt változnak</span></h4>`
    + (rows ? `<ol class="nb">${rows}</ol>` : '<div class="dim">nincs (legalább 2 közös commit kell)</div>');
}

// fly the orbit target to a building (and close in, if far out)
function flyTo(f) {
  const { x, z, w, h } = f.rect, to = new THREE.Vector3(x + w / 2, 0, z + h / 2), from = orbit.target.clone();
  const r0 = orbit.r, r1 = Math.min(r0, Math.max(60, Math.sqrt(w * h) * 6)), t0 = performance.now();
  const step = () => {   // performance.now(), not the rAF stamp: the two clocks can disagree
    const k = Math.min(1, Math.max(0, (performance.now() - t0) / 450)), e = k * (2 - k);
    orbit.target.lerpVectors(from, to, e); orbit.r = r0 + (r1 - r0) * e;
    placeCamera();
    if (k < 1) flyCamera.raf = requestAnimationFrame(step);
  };
  // one flight at a time: Home (or any other fly) pressed mid-flight wins, the old flight stops
  cancelAnimationFrame(flyCamera.raf);
  flyCamera.raf = requestAnimationFrame(step);
}

$('panel').addEventListener('click', e => {
  const li = e.target.closest('li[data-path]');
  if (!li) return;
  const f = current.city.files.find(x => x.p === li.dataset.path);
  if (f) { showFile(f); flyTo(f); }
});
$('roads-btn').onclick = toggleRoads;
addEventListener('keydown', e => {
  if (!current || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea')) return;
  if (e.key === 'u' || e.key === 'U') toggleRoads();
});
