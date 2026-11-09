// 50-mood.js — K2-09 Hangulat: life and atmosphere without models. Everything here is a trick on the boxes and
// roads that already exist: no textures to download, no new geometry per building.
//
// Always on (static, costs nothing once drawn):
// - a soft shadow under every building, leaning away from the moon, a little longer for a taller one (moodShadows,
//   called by 05-replay's writeInstances, so it follows the replay and the P flight);
// - street lamps along every road of the grown plan: a post, a glowing head, a warm pool of light on the street;
// - the shore: a glowing band where the island meets the water, and a wide faint halo around it;
// - (03-scene's building shader) floor lines, dark feet, lighter parapets and roof rims, warm and cool window tints.
// The moving life (H, the "Hangulat" button in the lens bar, #mood=0|1, remembered in kv.mood; default on):
// - residents on the pavements and carts on the roads. Where they walk follows the data: an area's streets get
//   people in proportion to how much of it changed recently (07-lens's Hő window, at the shown commit), and the
//   whole town is busier when the repo is busy. The replay moves them with it;
// - one window in eight switching on and off on its own slow clock; the shore shimmers; the sea breathes a little
//   (38-sea's uAmb). A wave on click (38-sea, R3) is still the only motion that answers you.
// - a tilt-shift blur at the top and bottom of the view (CSS backdrop-filter, #mood-fx), the miniature-town look.
// Costs and limits (R11, 37-look): the moving life renders continuously, so it runs only in the city view, only when
// the city is close enough to see it (landLevel 'city'), never in the wallpaper (KV_WALL: one still frame) or with
// prefers-reduced-motion, and pauses in a hidden tab. On the mid / low quality tiers it runs at 30 fps with fewer
// people; the auto tier step-down (37-look) watches these frames like any other motion.

const MOOD_PEOPLE = { high: 2600, mid: 1400, low: 500 };
const mood = { on: true, built: null, raf: 0, t0: performance.now(), last: 0, frame: 0, T: -1, tier: '' };
{
  const q = new URLSearchParams(location.hash.slice(1)).get('mood');
  let saved = null;
  try { saved = localStorage.getItem('kv.mood'); } catch (e) { /* file:// */ }
  mood.on = q === '0' ? false : q === '1' ? true : saved !== '0';
}
const moodMotionOk = () => !KV_WALL && !matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- textures, drawn once
function moodTexture(kind) {
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a;
    if (kind === 'blob') {             // a soft rounded rectangle: the core is the inner 36 px, 14 px of falloff
      const dx = Math.max(Math.abs(x + 0.5 - N / 2) - 18, 0), dy = Math.max(Math.abs(y + 0.5 - N / 2) - 18, 0);
      a = Math.max(0, 1 - Math.hypot(dx, dy) / 14); a = a * a * (3 - 2 * a);
    } else {                           // a round glow
      const d = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
      a = Math.max(0, 1 - d); a = a * a;
    }
    const o = (y * N + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- building
function moodBuild(model) {
  if (mood.built) for (const o of mood.built.dispose) { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }
  const all = model.city.files, flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const tex = mood.tex || (mood.tex = { blob: moodTexture('blob'), dot: moodTexture('dot') });
  const shadows = new THREE.InstancedMesh(flat, new THREE.MeshBasicMaterial({ map: tex.blob, color: 0x01060a, transparent: true, opacity: 0.62, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), all.length);
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shadows.renderOrder = 1;
  shadows.raycast = () => {};
  world.group.add(shadows);
  const b = { shadows, dispose: [shadows], lampMat: null, poolMat: null, coast: [], people: null };
  mood.built = b;
  if (world.grow) moodTown(model, b, tex);
  mood.T = -1;
  moodGlow();
  moodApply();
}

// lamps, light pools and the shore: children of the grown plan's group, so they share its visibility
function moodTown(model, b, tex) {
  const gw = model.grow, PL = typeof PLATE === 'number' ? PLATE : 0.5, heads = [], posts = [];
  for (const r of gw.roads) {
    const cum = [0];
    for (let i = 1; i < r.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]));
    r.cum = cum; r.len = cum[cum.length - 1];
    const gap = r.w > 2.5 ? 6 : 7.5;
    let side = (r.pts.length & 1) ? 1 : -1, i = 1;
    for (let s = gap * 0.5; s < r.len - 1; s += gap, side = -side) {
      while (i < cum.length - 1 && cum[i] < s) i++;
      const [x0, z0] = r.pts[i - 1], [x1, z1] = r.pts[i], t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      const a = Math.atan2(z1 - z0, x1 - x0), o = (r.w / 2 + 0.35) * side;
      const x = x0 + (x1 - x0) * t - Math.sin(a) * o, z = z0 + (z1 - z0) * t + Math.cos(a) * o;
      heads.push(x, PL + 1.7, z);
      posts.push(x, PL, z, x, PL + 1.6, z);
    }
  }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(heads, 3));
  const lampMat = new THREE.PointsMaterial({ map: tex.dot, color: 0xffd79a, size: 1.5, sizeAttenuation: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending });
  const lamps = new THREE.Points(hg, lampMat); lamps.raycast = () => {};
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(posts, 3));
  const postLines = new THREE.LineSegments(pg, new THREE.LineBasicMaterial({ color: 0x2a3a44 })); postLines.raycast = () => {};
  // the pools: one flat glow per lamp, on the street
  const n = heads.length / 3, poolMat = new THREE.MeshBasicMaterial({ map: tex.dot, color: 0xff9a40, transparent: true, opacity: 0.16,
    depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, n);
  const m = new THREE.Matrix4();
  for (let k = 0; k < n; k++) { m.makeScale(5, 1, 5).setPosition(heads[k * 3], PL + 0.06, heads[k * 3 + 2]); pools.setMatrixAt(k, m); }
  pools.raycast = () => {};
  world.grow.add(postLines, pools, lamps);
  b.lampMat = lampMat; b.poolMat = poolMat; b.lamps = n;
  b.dispose.push(lamps, postLines, pools);
  // the shore: a bright band and a wide faint halo, both fading outwards from the coastline
  for (const [w, a, y, foam] of [[5, 0.75, 0.06, 1], [26, 0.18, 0.03, 0]]) {
    const ring = moodShore(gw.coast, w, a, y, foam);
    world.grow.add(ring); b.coast.push(ring); b.dispose.push(ring);
  }
  moodSites(gw.island, PL, b, tex);
  b.people = moodPeopleBuild(model, PL);
  world.grow.add(b.people.points); b.dispose.push(b.people.points);
}

// K2-02's sites: runway edge lights (blue-white, green and red at the ends), lamps on the pier, the lighthouse's
// lantern and its beam (the beam turns while the moving life runs; still, it points out to sea)
function moodSites(I, PL, b, tex) {
  if (!I) return;
  const pos = [], col = [], c = new THREE.Color(), put = (x, y, z, hex) => { pos.push(x, y, z); c.setHex(hex); col.push(c.r, c.g, c.b); };
  if (I.runway) {
    const R = I.runway, ux = Math.cos(R.a), uz = Math.sin(R.a), vx = -uz, vz = ux;
    for (let s = -R.len / 2; s <= R.len / 2 + 0.01; s += 5) for (const t of [-1, 1]) {
      const end = Math.abs(Math.abs(s) - R.len / 2) < 0.1;
      put(R.x + ux * s + vx * t * (R.w / 2 + 0.3), PL + 0.35, R.z + uz * s + vz * t * (R.w / 2 + 0.3), end ? (s < 0 ? 0x5dff8a : 0xff4a3a) : 0xa9d8ff);
    }
  }
  const H = I.harbour, ox = Math.cos(H.a), oz = Math.sin(H.a);
  for (const s of [0, 6, 12, 18]) put(H.x + ox * s, 1.9, H.z + oz * s, 0xffd79a);
  for (const t of [-7, 7]) put(H.x + ox * 18 - oz * t, 1.9, H.z + oz * 18 + ox * t, 0xffd79a);
  const L = I.lighthouse;
  if (L.top) put(L.top[0], L.top[1], L.top[2], 0xfff0c8);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const lights = new THREE.Points(g, new THREE.PointsMaterial({ map: tex.dot, size: 2.2, vertexColors: true, sizeAttenuation: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending }));
  lights.raycast = () => {};
  world.grow.add(lights); b.dispose.push(lights);
  if (L.top) {
    // the beam: an open cone with its tip in the lantern, fading out with distance
    const cone = new THREE.ConeGeometry(7, 90, 20, 1, true).translate(0, -45, 0).rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(cone, new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0.22 } },
      vertexShader: 'varying float vD; void main() { vD = position.x / 90.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA; varying float vD; void main() { float a = (1.0 - vD) * (1.0 - vD) * uA; gl_FragColor = vec4(vec3(1.0, 0.92, 0.72) * a, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    beam.position.set(...L.top); beam.rotation.y = -L.a; beam.raycast = () => {};
    world.grow.add(beam); b.dispose.push(beam); b.beam = beam; b.beamA = -L.a;
  }
}

function moodShore(coast, width, alpha, y, foam) {
  const n = coast.length, pos = [], v = [], along = [], idx = [];
  let cx = 0, cz = 0; for (const [x, z] of coast) { cx += x / n; cz += z / n; }
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const p = coast[i % n], a = coast[(i - 1 + n) % n], b = coast[(i + 1) % n];
    let nx = -(b[1] - a[1]), nz = b[0] - a[0];
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    if (nx * (p[0] - cx) + nz * (p[1] - cz) < 0) { nx = -nx; nz = -nz; }   // outwards
    if (i) s += Math.hypot(p[0] - coast[(i - 1) % n][0], p[1] - coast[(i - 1) % n][1]);
    pos.push(p[0] - nx * 0.4, y, p[1] - nz * 0.4, p[0] + nx * width, y, p[1] + nz * width);
    v.push(0, 1); along.push(s, s);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aV', new THREE.Float32BufferAttribute(v, 1));
  g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: alpha }, uColor: { value: new THREE.Color(SEA_ICE) }, uFoam: { value: foam } },
    vertexShader: `attribute float aV; attribute float aAlong; varying float vV; varying float vA;
void main() { vV = aV; vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uAlpha; uniform vec3 uColor; uniform float uFoam; varying float vV; varying float vA;
void main() {
  float f = 1.0 - vV; float a = f * f * (uFoam > 0.5 ? f : 1.0);
  // foam: slow swells running along the shore, and a thin bright line that comes and goes
  float swell = 0.62 + 0.38 * sin(vA * 0.21 - uTime * 0.9) * sin(vA * 0.057 + uTime * 0.31);
  float line = uFoam * smoothstep(0.08, 0.0, abs(vV - 0.25 - 0.08 * sin(vA * 0.4 + uTime * 1.3)));
  gl_FragColor = vec4(uColor * (a * mix(1.0, swell, uFoam) + line * 0.6) * uAlpha, 1.0);
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.raycast = () => {};
  return mesh;
}

// ---- the people and the carts
function moodPeopleBuild(model, PL) {
  const N = MOOD_PEOPLE.high, roads = model.grow.roads, rnd = growRng(growHash('mood:' + model.city.repo.name));
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  const road = new Int32Array(N), seg = new Int32Array(N), s = new Float32Array(N), v = new Float32Array(N), off = new Float32Array(N), cart = new Uint8Array(N);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    cart[i] = rnd() < 0.28 ? 1 : 0;
    const speed = cart[i] ? 2.4 + rnd() * 2.2 : 0.55 + rnd() * 0.6;
    v[i] = rnd() < 0.5 ? speed : -speed;
    off[i] = rnd();                      // side and lane are decided per road (its width), from this
    if (cart[i]) c.setHSL(rnd() < 0.5 ? 0.11 : 0.02, 0.9, rnd() < 0.5 ? 0.78 : 0.62);
    else c.setHSL(rnd(), 0.35, 0.62 + rnd() * 0.18);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = cart[i] ? 1.35 : 0.95;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 }, uGain: { value: 1 } },
    vertexShader: `attribute float aSize; varying vec3 vC; uniform float uScale;
void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; uniform float uGain;
void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; if (d > 1.0) discard; float a = 1.0 - d; gl_FragColor = vec4(vC * (0.7 * a + 1.3 * a * a * a * a) * uGain, 1.0); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(g, mat);
  points.raycast = () => {};
  points.frustumCulled = false;
  const roadOk = roads.map(r => r.len > 2 && r.pts.length > 1);
  return { points, N, road, seg, s, v, off, cart, size, base: size.slice(), roads, roadOk, rnd, PL, live: 0 };
}

// who walks where: each road's share follows its area's recent changes at the shown commit; the town's total
// follows how busy the whole repo was
function moodDistribute() {
  const P = mood.built && mood.built.people;
  if (!P || !current) return;
  const files = current.city.files, heat = heatCounts(), act = new Map();
  let total = 0, alive = 0;
  for (let i = 0; i < files.length; i++) {
    if (replay.cur[i * 3] <= 0) continue;
    alive++; total += heat[i];
    const k = files[i].areaG; if (k !== undefined) act.set(k, (act.get(k) || 0) + heat[i]);
  }
  const top = Math.max(1, ...act.values());
  const w = P.roads.map((r, j) => P.roadOk[j] ? r.len * (0.08 + (act.get(r.area) || 0) / top) : 0);
  const cum = []; let sum = 0; for (const x of w) cum.push(sum += x);
  const busy = Math.min(1, total / Math.max(1, alive * 0.25));
  const cap = MOOD_PEOPLE[look.tier] || MOOD_PEOPLE.high;
  P.live = Math.round(cap * (0.3 + 0.7 * busy));
  const rnd = growRng(replay.T + 7);
  for (let i = 0; i < P.N; i++) {
    if (i >= P.live || !sum) { P.size[i] = 0; continue; }
    const u = rnd() * sum; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < u) lo = mid + 1; else hi = mid; }
    P.road[i] = lo; P.seg[i] = 1; P.s[i] = rnd() * P.roads[lo].len; P.size[i] = P.base[i];
  }
  P.points.geometry.attributes.aSize.needsUpdate = true;
  mood.T = replay.T; mood.tier = look.tier;
}

function moodWalk(dt) {
  const P = mood.built.people, pos = P.points.geometry.attributes.position, a = pos.array;
  for (let i = 0; i < P.live; i++) {
    const r = P.roads[P.road[i]], cum = r.cum, n = cum.length;
    let s = P.s[i] + P.v[i] * dt;
    if (s < 0 || s > r.len) { P.v[i] = -P.v[i]; s = Math.max(0, Math.min(r.len, s)); }   // turn round at the road's end
    P.s[i] = s;
    let k = Math.min(Math.max(P.seg[i], 1), n - 1);
    while (k < n - 1 && cum[k] < s) k++;
    while (k > 1 && cum[k - 1] > s) k--;
    P.seg[i] = k;
    const [x0, z0] = r.pts[k - 1], [x1, z1] = r.pts[k], t = (s - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
    const ang = Math.atan2(z1 - z0, x1 - x0), dir = P.v[i] > 0 ? 1 : -1;
    // carts keep to the right of their way; people walk on either pavement
    const o = P.cart[i] ? -dir * r.w * 0.22 : (P.off[i] < 0.5 ? 1 : -1) * (r.w / 2 + 0.22 + 0.25 * (P.off[i] * 2 % 1));
    a[i * 3] = x0 + (x1 - x0) * t - Math.sin(ang) * o;
    a[i * 3 + 1] = P.PL + (P.cart[i] ? 0.45 : 0.4);
    a[i * 3 + 2] = z0 + (z1 - z0) * t + Math.cos(ang) * o;
  }
  pos.needsUpdate = true;
}

// ---- shadows (05-replay's writeInstances calls this with the values it just wrote)
const _mm = new THREE.Matrix4(), _mp = new THREE.Vector3(), _mq = new THREE.Quaternion(), _ms = new THREE.Vector3(), _mY = new THREE.Vector3(0, 1, 0);
function moodShadows(vals) {
  const b = mood.built;
  if (!b || !world) return;
  const sh = b.shadows, files = current.city.files, K = 64 / 36;   // the texture's core is 36 of its 64 px
  for (let i = 0; i < files.length; i++) {
    const h = vals[i * 3], s = vals[i * 3 + 1], f = files[i];
    if (h <= 0 || !f.rect) { sh.setMatrixAt(i, _mm.makeScale(0, 0, 0)); continue; }
    const { x, z, w, h: d } = f.rect, lean = Math.min(h * 0.18, 5);
    // away from the moon (03-scene: light from -x, +z): the shadow falls towards +x, -z
    _mp.set(x + w / 2 + lean * 0.5, f.base + 0.04, z + d / 2 - lean * 0.75);
    _mq.setFromAxisAngle(_mY, f.rot || 0);
    _ms.set((w * s + 0.5 + lean * 0.6) * K, 1, (d * s + 0.5 + lean * 0.6) * K);
    sh.setMatrixAt(i, _mm.compose(_mp, _mq, _ms));
  }
  sh.instanceMatrix.needsUpdate = true;
}

// low glow (37-look) dims the lamps, the pools, the shore and the people with the windows
function moodGlow() {
  const b = mood.built;
  if (!b) return;
  if (b.lampMat) { b.lampMat.opacity = lookGlow(1) < 1 ? 0.45 : 1; b.poolMat.opacity = lookGlow(0.16); }
  for (const r of b.coast) r.material.uniforms.uAlpha.value = lookGlow(r === b.coast[0] ? 0.75 : 0.18);
  if (b.people) b.people.points.material.uniforms.uGain.value = lookGlow(1) < 1 ? 0.5 : 1;
  requestRender();
}

// ---- the loop
const moodRunning = () => mood.on && moodMotionOk() && !!world && !!mood.built && vw.id !== 'homeland';
const moodFx = () => mood.on && !KV_OVERLAY && vw.id !== 'homeland';   // the tilt-shift (CSS), a still effect
function moodApply() {
  const run = moodRunning();
  document.documentElement.classList.toggle('mood', moodFx());
  const btn = document.getElementById('mood-btn'); if (btn) btn.classList.toggle('on', mood.on);
  if (mood.built && mood.built.people) mood.built.people.points.visible = run;
  if (world) world.buildings.material.userData.uniforms.uFlick.value = run ? 1 : 0;
  if (typeof sea !== 'undefined' && sea && sea.ok) { sea.amb = run ? 1 : 0; seaDraw(); }
  if (run && !mood.raf) { mood.last = 0; mood.raf = requestAnimationFrame(moodLoop); }
  requestRender();
}
function moodLoop(now) {
  mood.raf = 0;
  if (!moodRunning()) return moodApply();
  mood.raf = requestAnimationFrame(moodLoop);
  if (document.hidden) { mood.last = 0; return; }
  if (look.tier !== 'high' && (mood.frame++ & 1)) return;   // 30 fps on the lower tiers
  moodFrame(now);
}
function moodFrame(now) {
  const dt = mood.last ? Math.min(0.1, (now - mood.last) / 1000) : 0;
  mood.last = now;
  if (typeof landLevel === 'function' && landLevel() !== 'city') return;   // too far out to see anyone
  const t = (now - mood.t0) / 1000, b = mood.built;
  world.buildings.material.userData.uniforms.uTime.value = t;
  for (const r of b.coast) r.material.uniforms.uTime.value = t;
  if (b.beam) b.beam.rotation.y = b.beamA - t * 0.45;   // one sweep every ~14 s
  if (b.people && b.people.points.visible) {
    if (mood.T !== replay.T || mood.tier !== look.tier) moodDistribute();
    // a point's size in world units: pixels = size × (half the drawing height / tan(half the fov)) / distance
    b.people.points.material.uniforms.uScale.value = renderer.domElement.height / 2 / Math.tan(camera.fov * Math.PI / 360);
    moodWalk(dt);
  }
  if (typeof sea !== 'undefined' && sea && sea.ok && !sea.running) { sea.time = t; seaDraw(); }
  requestRender();
}
function moodSet(on) {
  mood.on = !!on;
  try { localStorage.setItem('kv.mood', mood.on ? '1' : '0'); } catch (e) { /* file:// */ }
  moodApply();
}
// the view can change under the loop (Gépország, a reduced-motion switch): look again now and then
setInterval(() => { if (!!mood.raf !== moodRunning() || document.documentElement.classList.contains('mood') !== moodFx()) moodApply(); }, 1000);
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea, select')) return;
  if (e.key === 'h' || e.key === 'H') moodSet(!mood.on);
});
// test hook: #moodtest=1 lets a headless check read the state (people alive, lamps, whether the loop runs)
if (new URLSearchParams(location.hash.slice(1)).get('moodtest')) window.kvMood = (raw) => {
  // raw: drive frames by hand (a hidden or headless page gets no animation frames)
  if (raw) return { mood, renderer, files: current && current.city.files, grow: current && current.grow, island: current && current.grow && current.grow.island, step(n = 1) { const t = performance.now(); for (let i = 0; i < n; i++) moodFrame(t + i * 33); renderer.render(scene, camera); afterRender(); } };
  const P = mood.built && mood.built.people;
  return { on: mood.on, running: !!mood.raf, lamps: mood.built ? mood.built.lamps || 0 : 0, live: P ? P.live : 0,
    visible: P ? P.points.visible : false, first: P ? Array.from(P.points.geometry.attributes.position.array.slice(0, 6)) : [] };
};
