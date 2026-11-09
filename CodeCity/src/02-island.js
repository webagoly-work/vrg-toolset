// 02-island.js — K2-02: the island the grown city stands on (docs/city/v2/README.md §6). DOM-free (the spec runs it
// in Node); 02-grow.js calls growIsland at the end of growCity, and growMeshes draws what it returns.
//
// - The town is the built blob (every plot and road plus a margin, flat at the plate height). Around it the island is
//   about twice the built area: its coastline is the blob pushed outwards with seeded low-frequency noise, scaled until
//   the area ratio is ISLE.area.
// - Hills: one behind the castle (Domoszló, the founding story), one behind the BRIDGE villas (the hill suburb), a few
//   small ones from the seed. They rise only outside the town and fall to a beach at the coast.
// - Fields and woods fill the land between: woods where a noise field is high or the ground climbs, fields elsewhere.
// - Three sites for the outward links (K2-07 gives them meaning): the harbour where the town comes closest to the sea,
//   the lighthouse on the most prominent headland, the airport's runway across the widest free land.
// Everything comes from the same seed as the layout: the same repo always gets the same island.

const ISLE = {
  rays: 180,          // coastline resolution
  area: 2.0,          // island area / built area
  noise: 0.22,        // coastline noise (share of the land band)
  margin: 14,         // the narrowest land beyond the town
  beach: 7,           // beach width
  trees: 2800,        // at most
};

// smooth value noise on the plane (integer hash, no strings: it runs per vertex)
function isleHash(i, j, s) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(s, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function isleNoise(x, z, s) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = isleHash(i, j, s), b = isleHash(i + 1, j, s), c = isleHash(i, j + 1, s), d = isleHash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function isleFbm(x, z, s) { return (isleNoise(x, z, s) * 0.55 + isleNoise(x * 2.1, z * 2.1, s + 1) * 0.3 + isleNoise(x * 4.3, z * 4.3, s + 2) * 0.15) * 2 - 1; }

// a radius per ray, read at any angle (linear between rays)
function isleAt(rad, a) {
  const N = rad.length, t = ((a / (2 * Math.PI)) % 1 + 1) % 1 * N, i = Math.floor(t) % N, f = t - Math.floor(t);
  return rad[i] * (1 - f) + rad[(i + 1) % N] * f;
}
const isleSmooth = (x0, x1, x) => { const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0))); return t * t * (3 - 2 * t); };
const isleAngDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// ctx: { built: rays of the town blob, cx, cz, castle: [x, z], villas: [x, z] | null, seed, PL }
function growIsland(ctx) {
  const N = ISLE.rays, { cx, cz, PL } = ctx, seed = ctx.seed >>> 0, rnd = growRng(seed ^ 0x51ab1e);
  const built = Array.from({ length: N }, (_, i) => isleAt(ctx.built, i / N * 2 * Math.PI));
  const area = rad => rad.reduce((s, r) => s + r * r, 0) * Math.PI / rad.length;   // Σ r² / 2 · dθ
  const builtArea = area(built), meanR = Math.sqrt(builtArea / Math.PI);
  // the raw coast: the town pushed out by a noisy band (periodic in the angle, so it closes)
  const ph = [rnd(), rnd(), rnd(), rnd(), rnd()].map(p => p * 2 * Math.PI);
  const wave = a => 0.45 * Math.sin(2 * a + ph[0]) + 0.3 * Math.sin(3 * a + ph[1]) + 0.2 * Math.sin(5 * a + ph[2]) + 0.12 * Math.sin(9 * a + ph[3]) + 0.07 * Math.sin(14 * a + ph[4]);
  const band = built.map((r, i) => Math.max(0.15, 1 + ISLE.noise * 2.2 * wave(i / N * 2 * Math.PI)));
  // scale the band until the island is ISLE.area times the town (bisection on the band's length)
  let lo = 0, hi = meanR * 4, coast = built;
  for (let it = 0; it < 40; it++) {
    const s = (lo + hi) / 2;
    coast = built.map((r, i) => r + ISLE.margin + s * band[i]);
    if (area(coast) > builtArea * ISLE.area) hi = s; else lo = s;
  }
  for (let pass = 0; pass < 2; pass++) { const c = coast.slice(); for (let i = 0; i < N; i++) coast[i] = Math.max(built[i] + ISLE.margin, (c[(i + N - 1) % N] + 2 * c[i] + c[(i + 1) % N]) / 4); }

  const polar = (x, z) => [Math.atan2(z - cz, x - cx), Math.hypot(x - cx, z - cz)];
  const ray = (a, r) => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
  const landBand = a => [isleAt(built, a), isleAt(coast, a)];

  // hills: behind the castle, behind the villas, and a few small ones; each sits in the land band on its ray
  const hills = [];
  const hillOn = (a, h, share) => {
    const [rb, rc] = landBand(a), d = rc - rb, [x, z] = ray(a, rb + d * share);
    hills.push({ x, z, a, h, s: Math.max(14, d * 0.32) });
  };
  hillOn(polar(...ctx.castle)[0], 16, 0.5);
  if (ctx.villas) hillOn(polar(...ctx.villas)[0], 11, 0.5);
  for (let k = 0; k < 3; k++) hillOn(rnd() * 2 * Math.PI, 4 + rnd() * 5, 0.35 + rnd() * 0.35);

  // the runway: across the widest free land, away from the two big hills, tangential so it stays in the band
  let runway = null;
  {
    let best = -1, bestA = 0;
    for (let i = 0; i < N; i++) {
      const a = i / N * 2 * Math.PI;
      if (hills.slice(0, 2).some(h => isleAngDist(a, h.a) < 0.7)) continue;
      const d = coast[i] - built[i]; if (d > best) { best = d; bestA = a; }
    }
    if (best > 30) {
      const [rb] = landBand(bestA), r = rb + best * 0.5, [x, z] = ray(bestA, r), ang = bestA + Math.PI / 2;
      for (let L = 80; L >= 30; L -= 5) {
        const ends = [-1, 1].map(s => [x + Math.cos(ang) * L / 2 * s, z + Math.sin(ang) * L / 2 * s]);
        if (ends.every(([ex, ez]) => { const [ea, er] = polar(ex, ez), [b, c] = landBand(ea); return er > b + 8 && er < c - ISLE.beach - 4; })) {
          runway = { x, z, a: ang, len: L, w: 5, ray: bestA }; break;
        }
      }
    }
  }
  const runwayDist = (x, z) => {   // distance to the runway's rectangle (Infinity without one)
    if (!runway) return Infinity;
    const dx = x - runway.x, dz = z - runway.z, c = Math.cos(runway.a), s = Math.sin(runway.a);
    const u = Math.abs(dx * c + dz * s) - runway.len / 2, v = Math.abs(-dx * s + dz * c) - runway.w / 2;
    return Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0);
  };

  // the harbour: where the town comes closest to the sea (not on the runway's side)
  let harbour = null;
  {
    let best = Infinity, bestI = 0;
    for (let i = 0; i < N; i++) {
      const a = i / N * 2 * Math.PI;
      if (runway && isleAngDist(a, runway.ray) < 0.6) continue;
      if (hills.length && isleAngDist(a, hills[0].a) < 0.4) continue;
      const d = coast[i] - built[i]; if (d < best) { best = d; bestI = i; }
    }
    const a = bestI / N * 2 * Math.PI, [x, z] = ray(a, coast[bestI]);
    harbour = { x, z, a, i: bestI };
  }
  // the lighthouse: the ray that stands out most from its neighbours, away from the harbour and the runway
  let lighthouse = null;
  {
    let best = -Infinity, bestI = 0;
    for (let i = 0; i < N; i++) {
      const a = i / N * 2 * Math.PI;
      if (isleAngDist(a, harbour.a) < 0.8 || (runway && isleAngDist(a, runway.ray) < 0.5)) continue;
      let m = 0; for (let k = -10; k <= 10; k++) m += coast[(i + k + N) % N]; m /= 21;
      const p = coast[i] - m + coast[i] * 0.02; if (p > best) { best = p; bestI = i; }
    }
    const a = bestI / N * 2 * Math.PI, [x, z] = ray(a, coast[bestI] - 4);
    lighthouse = { x, z, a, i: bestI };
  }
  const nearSite = (x, z, d) => (Math.hypot(x - harbour.x, z - harbour.z) < d) || (Math.hypot(x - lighthouse.x, z - lighthouse.z) < d * 0.6);

  // access roads: from the nearest town street to each site, in a gentle curve; a start whose way would brush a plot is
  // skipped for the next nearest. The ground along them is levelled (height) and kept free of trees.
  const access = [];
  {
    const town = [];
    for (const r of ctx.roads || []) for (const p of r) town.push(p);
    const plots = ctx.plots || [];
    const targets = [[harbour.x - Math.cos(harbour.a) * 2, harbour.z - Math.sin(harbour.a) * 2]];
    if (runway) targets.push([runway.x - Math.cos(runway.ray) * 19, runway.z - Math.sin(runway.ray) * 19]);
    targets.push([lighthouse.x - Math.cos(lighthouse.a) * 3, lighthouse.z - Math.sin(lighthouse.a) * 3]);
    for (const [tx, tz] of targets) {
      const cands = town.map(p => [p, Math.hypot(p[0] - tx, p[1] - tz)]).sort((a, b) => a[1] - b[1]).slice(0, 60);
      for (const [[sx, sz], len] of cands) {
        const n = Math.max(2, Math.ceil(len / 3)), bend = (rnd() - 0.5) * Math.min(14, len * 0.15), nx = -(tz - sz) / len, nz = (tx - sx) / len;
        const pts = [];
        for (let k = 0; k <= n; k++) { const t = k / n, o = Math.sin(t * Math.PI) * bend; pts.push([sx + (tx - sx) * t + nx * o, sz + (tz - sz) * t + nz * o]); }
        // the first metres run along the town street's end, so only the way out is checked
        const clear = pts.every(([x, z], k) => k < 1 || plots.every(([px, pz, pr]) => Math.hypot(x - px, z - pz) > pr + 2.2));
        if (clear) { access.push({ pts, w: 2.6 }); break; }
      }
    }
  }
  // a coarse lookup first: cells of 8 within ~16 of an access road; anywhere else is simply far
  const nearCells = new Set();
  for (const r of access) for (const [x, z] of r.pts) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) nearCells.add((Math.floor(x / 8) + i) + ':' + (Math.floor(z / 8) + j));
  const accessDist = (x, z) => {
    if (!nearCells.has(Math.floor(x / 8) + ':' + Math.floor(z / 8))) return 40;
    let d = 40;   // only near distances matter (levelling, trees); a cap lets the box test skip far segments
    for (const r of access) for (let k = 1; k < r.pts.length; k++) {
      const [x0, z0] = r.pts[k - 1], [x1, z1] = r.pts[k], vx = x1 - x0, vz = z1 - z0;
      if (Math.min(x0, x1) - d > x || Math.max(x0, x1) + d < x || Math.min(z0, z1) - d > z || Math.max(z0, z1) + d < z) continue;
      const t = Math.max(0, Math.min(1, ((x - x0) * vx + (z - z0) * vz) / (vx * vx + vz * vz || 1)));
      d = Math.min(d, Math.hypot(x - x0 - vx * t, z - z0 - vz * t));
    }
    return d;
  };

  // the ground's height: flat town, hills and rolling land outside it, a beach falling to the water
  const S = 1 / 38;   // noise scale
  function height(x, z) {
    const [a, r] = polar(x, z), [rb, rc] = landBand(a);
    if (r > rc) return 0;
    const inland = isleSmooth(rb + 2, rb + 24, r);
    const shore = isleSmooth(rc, rc - ISLE.beach * 1.8, r);
    let up = 2.4 * (isleFbm(x * S, z * S, seed) + 0.6);
    for (const h of hills) { const d2 = (x - h.x) ** 2 + (z - h.z) ** 2; up += h.h * Math.exp(-d2 / (2 * h.s * h.s)); }
    up *= isleSmooth(2, 12, runwayDist(x, z)) * isleSmooth(2.5, 9, accessDist(x, z));   // the airfield and the roads are level
    if (nearSite(x, z, 16)) up *= isleSmooth(6, 16, Math.hypot(x - harbour.x, z - harbour.z));
    const base = 0.12 + (PL - 0.12) * isleSmooth(rc, rc - ISLE.beach, r);
    return base + Math.max(0, up) * inland * shore;
  }
  // what the land is used for (the ground's colour): town, beach, field, wood, hill
  function use(x, z) {
    const [a, r] = polar(x, z), [rb, rc] = landBand(a);
    if (r <= rb + 2) return 'town';
    if (r > rc - ISLE.beach) return 'beach';
    if (runwayDist(x, z) < 6) return 'field';
    const hgt = height(x, z) - PL;
    if (hgt > 7) return 'hill';
    return isleFbm(x * S * 1.7 + 11, z * S * 1.7 - 7, seed + 9) > 0.08 || hgt > 3.5 ? 'wood' : 'field';
  }

  // trees: on wood land, jittered, never in the town, on the beach, the airfield or the harbour
  const trees = [];
  {
    const step = 4.2, xs = [cx - Math.max(...coast), cx + Math.max(...coast)], zs = [cz - Math.max(...coast), cz + Math.max(...coast)];
    for (let gx = xs[0]; gx < xs[1]; gx += step) for (let gz = zs[0]; gz < zs[1]; gz += step) {
      const x = gx + (isleHash(Math.round(gx), Math.round(gz), seed + 3) - 0.5) * step * 0.9, z = gz + (isleHash(Math.round(gz), Math.round(gx), seed + 4) - 0.5) * step * 0.9;
      const [a, r] = polar(x, z), [rb, rc] = landBand(a);
      if (r < rb + 4 || r > rc - ISLE.beach - 1 || runwayDist(x, z) < 9 || nearSite(x, z, 14) || accessDist(x, z) < 4.5) continue;
      if (use(x, z) !== 'wood') continue;
      trees.push({ x, z, y: height(x, z), s: 0.75 + isleHash(Math.round(x * 3), Math.round(z * 3), seed + 5) * 0.7 });
    }
    // over the cap: thin evenly (a stable hash per tree), never by scan order
    if (trees.length > ISLE.trees) { const keep = ISLE.trees / trees.length; trees.splice(0, trees.length, ...trees.filter(t => isleHash(Math.round(t.x * 7), Math.round(t.z * 7), seed + 6) < keep)); }
  }

  return { rays: N, cx, cz, built, coast, hills, runway, harbour, lighthouse, trees, access, height, use, runwayDist, accessDist,
    area: area(coast) / builtArea, coastPts: coast.map((r, i) => ray(i / N * 2 * Math.PI, r)) };
}

// ---- drawing (page only): the terrain, the woods, the airfield, the harbour, the lighthouse. Low-poly, flat-shaded,
// night colours; the lights on them are 50-mood's.
function islandMeshes(I, PL) {
  const g = new THREE.Group(), c = new THREE.Color();
  const COL = {
    town: () => c.setHSL(0.57, 0.28, 0.075),
    beach: () => c.setHSL(0.11, 0.22, 0.15),
    wood: () => c.setHSL(0.36, 0.35, 0.05),
    hill: (h) => c.setHSL(0.1, 0.1, 0.08 + Math.min(0.06, h * 0.004)),
    field: (h, i, j) => { const k = isleHash(i >> 1, j >> 1, 77); return c.setHSL(0.15 + k * 0.1, 0.32, 0.065 + 0.035 * isleHash(i >> 1, j >> 1, 78) + ((i + j) & 1) * 0.006); },
  };
  // the terrain: a polar grid from the centre out to the coast, then a skirt down into the water
  const N = I.rays, rings = [0, 0.5, 1];
  for (let k = 1; k <= 26; k++) rings.push(1 + Math.pow(k / 26, 0.85));   // 1..2 = town edge .. coast
  const P = (i, t) => {
    const a = i / N * 2 * Math.PI, rb = I.built[i % N], rc = I.coast[i % N];
    const r = t <= 1 ? rb * t : rb + (rc - rb) * (t - 1), x = I.cx + Math.cos(a) * r, z = I.cz + Math.sin(a) * r;
    return [x, t <= 1 ? PL : I.height(x, z), z];
  };
  const pos = [], col = [];
  const quad = (p, cc) => { for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...p[k]); col.push(cc.r, cc.g, cc.b); } };
  for (let i = 0; i < N; i++) for (let j = 0; j < rings.length - 1; j++) {
    const p = [P(i, rings[j]), P(i + 1, rings[j]), P(i + 1, rings[j + 1]), P(i, rings[j + 1])];
    const mx = (p[0][0] + p[2][0]) / 2, mz = (p[0][2] + p[2][2]) / 2, u = rings[j + 1] <= 1 ? 'town' : I.use(mx, mz);
    quad(p, COL[u](I.height(mx, mz) - PL, i, j));
  }
  for (let i = 0; i < N; i++) {   // the skirt: the island's edge going down into the sea
    const a = P(i, 2), b = P(i + 1, 2);
    quad([a, [a[0], -3, a[2]], [b[0], -3, b[2]], b], c.setHSL(0.1, 0.18, 0.07));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  ground.name = 'island';
  g.add(ground);

  // the woods: one instanced low-poly cone per tree
  const m = new THREE.Matrix4();
  if (I.trees.length) {
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), new THREE.MeshLambertMaterial(), I.trees.length);
    I.trees.forEach((t, k) => {
      m.makeScale(1.15 * t.s, 3.3 * t.s, 1.15 * t.s).setPosition(t.x, t.y - 0.15, t.z);
      trees.setMatrixAt(k, m);
      const h = isleHash(k, 3, 11);
      trees.setColorAt(k, c.setHSL(0.31 + h * 0.08, 0.4, 0.06 + h * 0.05));
    });
    g.add(trees);
  }
  const box = (w, h, d, x, y, z, a, color, basic) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
      basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(x, y, z); mesh.rotation.y = -a; g.add(mesh); return mesh;
  };
  // the airfield: a runway with a centre line, an apron, a terminal and a hangar on the town side
  if (I.runway) {
    const R = I.runway, y = PL, inx = -Math.cos(R.ray), inz = -Math.sin(R.ray);   // towards the town
    box(R.len, 0.06, R.w, R.x, y, R.z, R.a, 0x1b2329);
    for (let s = -R.len / 2 + 4; s < R.len / 2 - 3; s += 5) box(2.2, 0.08, 0.25, R.x + Math.cos(R.a) * s, y, R.z + Math.sin(R.a) * s, R.a, 0x6d7a80);
    const ax = R.x + inx * 9, az = R.z + inz * 9;
    box(R.len * 0.45, 0.05, 7, ax, y, az, R.a, 0x151c21);
    box(12, 3.2, 5, ax + inx * 6, y, az + inz * 6, R.a, 0x3c4d57);              // terminal
    box(9, 4.5, 8, ax + inx * 6 + Math.cos(R.a) * 14, y, az + inz * 6 + Math.sin(R.a) * 14, R.a, 0x2c3a42);   // hangar
    box(1.4, 7, 1.4, ax + inx * 6 - Math.cos(R.a) * 10, y, az + inz * 6 - Math.sin(R.a) * 10, 0, 0x4a5a63);   // tower
  }
  // the harbour: a pier out into the water with a T-head, a warehouse ashore, a few boats moored
  {
    const H = I.harbour, ox = Math.cos(H.a), oz = Math.sin(H.a), tx = -oz, tz = ox, deck = 0.55;
    const at = (s, t) => [H.x + ox * s + tx * t, H.z + oz * s + tz * t];
    let [x, z] = at(7, 0); box(22, 0.25, 3, x, deck, z, H.a, 0x3a2e24);                 // the pier
    [x, z] = at(18, 0); box(3, 0.25, 16, x, deck, z, H.a, 0x3a2e24);                    // the head
    [x, z] = at(-9, 0); box(10, 3.4, 7, x, I.height(x, z), z, H.a, 0x3b4650);           // the warehouse
    for (const [s, t, w, col] of [[10, 3.2, 4, 0x6b3b2a], [14, -3.4, 5, 0x2f5160], [21, 6, 3.5, 0x7a6a3a]]) {
      [x, z] = at(s, t); box(w, 0.9, 1.5, x, 0.05, z, H.a, col);
      box(w * 0.35, 0.8, 1.0, x, 0.95, z, H.a, 0x9aa5ab);                             // cabin
    }
  }
  // the lighthouse: a banded tower on the headland with a lantern (its beam is 50-mood's)
  {
    const L = I.lighthouse, y0 = I.height(L.x, L.z);
    for (let k = 0; k < 4; k++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.3 - (k + 1) * 0.12, 1.3 - k * 0.12, 2.6, 10).translate(0, 1.3, 0),
        new THREE.MeshLambertMaterial({ color: k & 1 ? 0x8a3a32 : 0xb9c0c2 }));
      t.position.set(L.x, y0 + k * 2.6, L.z); g.add(t);
    }
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 10).translate(0, 0.6, 0), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
    lantern.position.set(L.x, y0 + 10.4, L.z); g.add(lantern);
    L.top = [L.x, y0 + 11, L.z];
  }
  g.traverse(o => { o.raycast = () => {}; });   // scenery: never picked
  return g;
}
