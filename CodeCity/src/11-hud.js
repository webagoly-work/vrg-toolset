// 11-hud.js — one HUD line that rewrites itself as you move (God's Eye View's HUD summary and
// its "NEAR <landmark>" locality): the district under the camera's aim, how many files it holds
// at the shown commit, how many are hot, and the nearest landmark (the most-imported files).

let landmarks = [];
function hudPrepare() {
  landmarks = roads.importers.map((im, i) => [i, im.length]).filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1]).slice(0, 24).map(([i]) => i);
}

function districtAt(x, z) {
  let d = current.root;
  for (;;) {
    const next = [...d.dirs.values()].find(c => { const r = c.rect; return x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.h; });
    if (!next) return d;
    d = next;
  }
}

function hudUpdate() {
  if (!current) return;
  const t = orbit.target, d = districtAt(t.x, t.z), files = current.city.files;
  const heat = heatCounts(), hotMin = Math.max(2, Math.max(1, ...heat) * 0.5);
  let n = 0, hot = 0;
  (function walk(x) {
    for (const f of x.files) if (stateAt(f, f.i, replay.T)[0] > 0) { n++; if (heat[f.i] >= hotMin) hot++; }
    x.dirs.forEach(walk);
  })(d);
  // nearest landmark that exists now, within a fifth of the city of the aim point
  let near = null, best = current.side * 0.2;
  for (const i of landmarks) {
    if (stateAt(files[i], i, replay.T)[0] <= 0) continue;
    const { x, z, w, h } = files[i].rect, dist = Math.hypot(x + w / 2 - t.x, z + h / 2 - t.z);
    if (dist < best) { best = dist; near = files[i]; }
  }
  $('hud').dataset.aim = `${t.x.toFixed(1)},${t.z.toFixed(1)}`;   // for headless checks
  $('hud').textContent = `KÖRZET ${(d.path || current.city.repo.name)}/ · ${hu(n)} fájl · ${hu(hot)} forró` + (near ? ` · NEAR ${near.name}` : '');
}
// a throttle, not a debounce: while frames keep coming (a fly, a replay) a debounce never fires
let hudTimer = 0;
function hudSoon() { if (!hudTimer) hudTimer = setTimeout(() => { hudTimer = 0; hudUpdate(); }, 150); }
afterRender = () => { drawBrackets(); hudSoon(); };
