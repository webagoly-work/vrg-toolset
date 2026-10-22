// 15-follow.js — Követés: follow one author or one agent through the city (God's Eye View's
// click-to-track with a fading trail). Each of their commits up to the shown one becomes a stop on
// the roof of the file it changed most; the last 40 stops are joined, old ones fading, the newest
// marked. Play the replay and the trail walks.

const follow = { who: null, obj: null };   // who = { kind: 'a' | 'g', idx }
const TRAIL_MAX = 40;

function followOptions() {
  const c = current.city, sel = $('follow');
  sel.innerHTML = '<option value="">Követés: —</option>'
    + c.authors.map((a, i) => `<option value="a${i}">${esc(a)}</option>`).join('')
    + c.agents.map((a, i) => `<option value="g${i}">${esc(a)} (ügynök)</option>`).join('');
  sel.value = '';
  follow.who = null;
}

function followStops() {
  const c = current.city.commits, who = follow.who, stops = [];
  for (let ci = 0; ci <= replay.T && ci < c.length; ci++) {
    const k = c[ci];
    if (who.kind === 'a' ? k[1] !== who.idx : k[2] !== who.idx) continue;
    let best = -1, size = -1;   // the file this commit changed most that still stands
    for (let j = 0; j < k[5].length; j += 3) {
      const n = k[5][j + 1] + k[5][j + 2];
      if (n > size && roofOf(k[5][j])) { size = n; best = k[5][j]; }
    }
    if (best >= 0) stops.push(roofOf(best).add(new THREE.Vector3(0, 3, 0)));
  }
  return stops.slice(-TRAIL_MAX);
}

function followRefresh() {
  if (follow.obj) { scene.remove(follow.obj); follow.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); follow.obj = null; }
  if (!follow.who || !current) { requestRender(); return; }
  const stops = followStops();
  if (!stops.length) { requestRender(); return; }
  const tint = new THREE.Color(follow.who.kind === 'g' ? 0x7dff9a : 0xffcf5a), pos = [], col = [];
  stops.forEach((p, n) => {
    const a = 0.15 + 0.85 * (n + 1) / stops.length;   // fade: oldest dim, newest bright
    pos.push(p.x, p.y, p.z); col.push(tint.r * a, tint.g * a, tint.b * a);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const group = new THREE.Group();
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const dots = new THREE.Points(geo.clone(), new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
  const head = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos.slice(-3), 3)),
    new THREE.PointsMaterial({ size: 13, sizeAttenuation: false, color: tint, depthWrite: false }));
  for (const o of [line, dots, head]) { o.raycast = () => {}; group.add(o); }
  follow.obj = group;
  scene.add(group);
  requestRender();
}

$('follow').onchange = e => {
  const v = e.target.value;
  follow.who = v ? { kind: v[0], idx: +v.slice(1) } : null;
  followRefresh(); writeHashSoon();
};
