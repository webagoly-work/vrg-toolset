// route.js — the VRG Térkép's offline router (WP M56, N2, D-129 A). Shared by the page
// (lib/route-layer.js), the builder (tools/build-roads.js) and the tests. Dependency-free; no network.
//
//   const R = require('./route.js')          // Node
//   window.VRGRoute                           // browser, after <script src="/lib/route.js">
//
//   R.decode(bytes)               Map/data/roads.bin (a Uint8Array) -> graph; the payload is raw deflate,
//                                 inflated by R.inflate (Node zlib, or the browser's DecompressionStream)
//   R.nearest(g, lon, lat, mode)  the closest junction the mode may leave -> node index | -1
//   R.route(g, from, to, mode)    from/to = { lon, lat } -> { coords, meters, seconds, snapped } | null
//   R.routeAsync(…)               the same, yielding to the page every few ten thousand steps
//   R.along(route, lon, lat)      where a position is on a route -> { off, done, left, leftSeconds }
//
// mode 'auto': car flags, the edge's speed; 'gyalog': foot flag at 4.8 km/h (steps 2.5). The cost is time
// (A* with the straight line at the fastest speed as the estimate, so the answer is the quickest route
// on this network). No traffic (D-130), no turn costs yet.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGRoute = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CAR_FWD = 1, CAR_BACK = 2, FOOT = 4, STEPS = 8, ROUNDABOUT = 16, LINK = 32, FAST = 64;
  /** Typical car speeds (km/h) per road class, when the way has no maxspeed. */
  const SPEED = { motorway: 110, motorway_link: 60, trunk: 80, trunk_link: 50, primary: 60, primary_link: 45, secondary: 50,
    secondary_link: 40, tertiary: 45, tertiary_link: 35, unclassified: 40, residential: 28, living_street: 10, service: 15, road: 30 };
  const WALK = 4.8 / 3.6, STAIRS = 2.5 / 3.6, FASTEST = 130 / 3.6;

  const Rr = 6371008.8, rad = x => x * Math.PI / 180;
  function distance(lon1, lat1, lon2, lat2) {
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 2 * Rr * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // ---------------------------------------------------------------- reading roads.bin
  function header(bytes) {
    if (bytes[0] !== 86 || bytes[1] !== 82 || bytes[2] !== 71 || bytes[3] !== 82) throw new Error('not a VRG roads file');
    if (bytes[4] !== 1 && bytes[4] !== 2) throw new Error('roads file version ' + bytes[4]);
    const p = { i: 5 };
    const hl = varint(bytes, p);
    const h = JSON.parse(new TextDecoder().decode(bytes.subarray(p.i, p.i + hl)));
    return { h, payloadAt: p.i + hl, version: bytes[4] };
  }
  function varint(b, p) {
    let r = 0, m = 1, c;
    do { c = b[p.i++]; r += (c & 0x7f) * m; m *= 128; } while (c & 0x80);
    return r;
  }
  const zz = n => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);

  /** The raw-deflate payload inflated: Node's zlib, or the browser's DecompressionStream. */
  async function inflate(bytes) {
    const { payloadAt } = header(bytes);
    const body = bytes.subarray(payloadAt);
    if (typeof DecompressionStream === 'function') {
      const s = new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(s).arrayBuffer());
    }
    return new Uint8Array(require('zlib').inflateRawSync(body));
  }

  /** bytes: the whole file; payload: its inflated payload (inflate()), or null to inflate here in Node. */
  function decode(bytes, payload) {
    const { h, version } = header(bytes);
    const b = payload || new Uint8Array(require('zlib').inflateRawSync(bytes.subarray(header(bytes).payloadAt)));
    const p = { i: 0 };
    const n = varint(b, p);
    const lon = new Int32Array(n), lat = new Int32Array(n);
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) { x += zz(varint(b, p)); y += zz(varint(b, p)); lon[i] = x; lat[i] = y; }
    const names = [''];
    if (version >= 2) {
      const nn = varint(b, p), td = new TextDecoder();
      names.length = 0;
      for (let i = 0; i < nn; i++) { const l = varint(b, p); names.push(td.decode(b.subarray(p.i, p.i + l))); p.i += l; }
    }
    const e = varint(b, p);
    const nm = new Uint32Array(e);
    const ea = new Uint32Array(e), eb = new Uint32Array(e), fl = new Uint8Array(e), sp = new Uint8Array(e), dm = new Float32Array(e);
    const so = new Uint32Array(e + 1);
    let shLon = new Int32Array(Math.max(16, e)), shLat = new Int32Array(Math.max(16, e)), ns = 0;
    let a = 0;
    for (let i = 0; i < e; i++) {
      a += varint(b, p); ea[i] = a; eb[i] = a + zz(varint(b, p));
      fl[i] = varint(b, p); sp[i] = varint(b, p); dm[i] = varint(b, p) / 10;
      if (version >= 2) nm[i] = varint(b, p);
      const k = varint(b, p);
      so[i] = ns;
      let sx = lon[a], sy = lat[a];
      for (let j = 0; j < k; j++) {
        if (ns === shLon.length) { const L = new Int32Array(ns * 2); L.set(shLon); shLon = L; const T = new Int32Array(ns * 2); T.set(shLat); shLat = T; }
        sx += zz(varint(b, p)); sy += zz(varint(b, p)); shLon[ns] = sx; shLat[ns] = sy; ns++;
      }
    }
    so[e] = ns;
    // adjacency (CSR): every edge from both ends; the direction bit says which way it is walked
    const deg = new Uint32Array(n + 1);
    for (let i = 0; i < e; i++) { deg[ea[i]]++; deg[eb[i]]++; }
    const off = new Uint32Array(n + 1);
    for (let i = 0; i < n; i++) off[i + 1] = off[i] + deg[i];
    const fill = off.slice(0, n), adj = new Uint32Array(off[n]), rev = new Uint8Array(off[n]);
    for (let i = 0; i < e; i++) { adj[fill[ea[i]]] = i; rev[fill[ea[i]]++] = 0; adj[fill[eb[i]]] = i; rev[fill[eb[i]]++] = 1; }
    const g = { h, n, e, lon, lat, ea, eb, fl, sp, dm, so, shLon, shLat, off, adj, rev, names, nm };
    buildGrid(g);
    g.dist = new Float64Array(n); g.stamp = new Uint32Array(n); g.prev = new Int32Array(n); g.gen = 0;
    return g;
  }

  // ---------------------------------------------------------------- snapping
  const CELL = 1000;   // 0.01° cells (1e-5 units)
  const cellOf = (x, y) => Math.floor(x / CELL) * 100000 + Math.floor(y / CELL);
  function buildGrid(g) {
    const cells = new Map();
    for (let i = 0; i < g.n; i++) { const c = cellOf(g.lon[i], g.lat[i]); let l = cells.get(c); if (!l) cells.set(c, l = []); l.push(i); }
    g.grid = cells;
  }
  /** Can the mode leave node i along some edge? */
  function usable(g, i, mode) {
    for (let k = g.off[i]; k < g.off[i + 1]; k++) if (canGo(g, g.adj[k], g.rev[k], mode)) return true;
    return false;
  }
  function canGo(g, edge, reverse, mode) {
    const f = g.fl[edge];
    if (mode === 'gyalog') return (f & FOOT) !== 0;
    return (f & (reverse ? CAR_BACK : CAR_FWD)) !== 0;
  }
  function canArrive(g, i, mode) {      // some edge the mode may walk into node i
    for (let k = g.off[i]; k < g.off[i + 1]; k++) if (canGo(g, g.adj[k], 1 - g.rev[k], mode)) return true;
    return false;
  }
  function nearest(g, lon, lat, mode, arrive) {
    const x = Math.round(lon * 1e5), y = Math.round(lat * 1e5), cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    const k = Math.cos(rad(lat)) ** 2;
    let best = -1, bd = Infinity;
    for (let r = 0; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        for (const i of g.grid.get((cx + dx) * 100000 + (cy + dy)) || []) {
          const ddx = g.lon[i] - x, ddy = g.lat[i] - y, d = ddx * ddx * k + ddy * ddy;
          if (d < bd && (arrive ? canArrive(g, i, mode) : usable(g, i, mode))) { bd = d; best = i; }
        }
      }
      if (best >= 0 && Math.sqrt(bd) < r * CELL * 0.7) break;     // nothing in a further ring can be nearer
    }
    return best;
  }

  // ---------------------------------------------------------------- A*
  function edgeSeconds(g, edge, mode) {
    if (mode === 'gyalog') return g.dm[edge] / ((g.fl[edge] & STEPS) ? STAIRS : WALK);
    return g.dm[edge] / (g.sp[edge] / 3.6);
  }
  function* search(g, s, t, mode) {
    const vmax = mode === 'gyalog' ? WALK : FASTEST;
    const gen = ++g.gen;
    const tx = g.lon[t] / 1e5, ty = g.lat[t] / 1e5;
    const hOf = i => distance(g.lon[i] / 1e5, g.lat[i] / 1e5, tx, ty) / vmax;
    let hk = new Float64Array(1024), hv = new Int32Array(1024), hn = 0;
    const push = (key, v) => {
      if (hn === hk.length) { const a = new Float64Array(hn * 2); a.set(hk); hk = a; const b = new Int32Array(hn * 2); b.set(hv); hv = b; }
      let i = hn++;
      while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= key) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
      hk[i] = key; hv[i] = v;
    };
    const pop = () => {
      const v = hv[0], key = hk[--hn], last = hv[hn];
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= hn) break; if (c + 1 < hn && hk[c + 1] < hk[c]) c++; if (hk[c] >= key) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; }
      hk[i] = key; hv[i] = last;
      return v;
    };
    g.stamp[s] = gen; g.dist[s] = 0; g.prev[s] = -1;
    push(hOf(s), s);
    let steps = 0;
    while (hn) {
      const fkey = hk[0], u = pop();
      if (fkey - hOf(u) > g.dist[u] + 1e-9) continue;        // a stale entry
      if (u === t) return true;
      for (let k = g.off[u]; k < g.off[u + 1]; k++) {
        const edge = g.adj[k], r = g.rev[k];
        if (!canGo(g, edge, r, mode)) continue;
        const v = r ? g.ea[edge] : g.eb[edge];
        const nd = g.dist[u] + edgeSeconds(g, edge, mode);
        if (g.stamp[v] !== gen || nd < g.dist[v]) { g.stamp[v] = gen; g.dist[v] = nd; g.prev[v] = k; push(nd + hOf(v), v); }
      }
      if (++steps % 40000 === 0) yield steps;
      if (steps > 4e6) return false;
    }
    return false;
  }

  function result(g, s, t, mode, from, to) {
    const parts = [];
    let v = t, meters = 0;
    while (v !== s) {
      const k = g.prev[v], edge = g.adj[k], r = g.rev[k];
      parts.push([edge, r]); meters += g.dm[edge];
      v = r ? g.eb[edge] : g.ea[edge];
    }
    parts.reverse();
    const coords = [[g.lon[s] / 1e5, g.lat[s] / 1e5]];
    // legs: one per edge, for the guidance (lib/guide.js): its name, flags, length, coordinate span, and at its
    // start the number of other edges the mode could have taken instead (0 = no choice there)
    const legs = [];
    let came = -1;                                      // the edge we arrived on: going back along it is not a choice
    for (const [edge, r] of parts) {
      const inner = [];
      for (let q = g.so[edge]; q < g.so[edge + 1]; q++) inner.push([g.shLon[q] / 1e5, g.shLat[q] / 1e5]);
      if (r) inner.reverse();
      const startNode = r ? g.eb[edge] : g.ea[edge], end = r ? g.ea[edge] : g.eb[edge];
      let others = 0;
      for (let k = g.off[startNode]; k < g.off[startNode + 1]; k++) if (g.adj[k] !== edge && g.adj[k] !== came && canGo(g, g.adj[k], g.rev[k], mode)) others++;
      came = edge;
      const from = coords.length - 1;
      coords.push(...inner, [g.lon[end] / 1e5, g.lat[end] / 1e5]);
      legs.push({ name: g.names[g.nm[edge]] || '', flags: g.fl[edge], meters: g.dm[edge], from, to: coords.length - 1, others });
    }
    // the walk from the position to the road and from the road to the destination, at walking pace by car too
    const a = distance(from.lon, from.lat, coords[0][0], coords[0][1]), b = distance(to.lon, to.lat, coords[coords.length - 1][0], coords[coords.length - 1][1]);
    return { coords, legs, meters: meters + a + b, seconds: g.dist[t] + (a + b) / WALK, snapped: [a, b], mode, edges: parts.length };
  }
  function ends(g, from, to, mode) {
    const s = nearest(g, from.lon, from.lat, mode, false), t = nearest(g, to.lon, to.lat, mode, true);
    return s < 0 || t < 0 ? null : [s, t];
  }
  function route(g, from, to, mode) {
    const st = ends(g, from, to, mode);
    if (!st) return null;
    if (st[0] === st[1]) {           // both ends on the same junction: walk there and on (the snap distances are real)
      const x = g.lon[st[0]] / 1e5, y = g.lat[st[0]] / 1e5;
      const a = distance(from.lon, from.lat, x, y), b = distance(to.lon, to.lat, x, y);
      return { coords: [[from.lon, from.lat], [x, y], [to.lon, to.lat]], legs: [], meters: a + b, seconds: (a + b) / WALK, snapped: [a, b], mode, edges: 0 };
    }
    const it = search(g, st[0], st[1], mode);
    let r;
    do { r = it.next(); } while (!r.done);
    return r.value ? result(g, st[0], st[1], mode, from, to) : null;
  }
  async function routeAsync(g, from, to, mode) {
    const st = ends(g, from, to, mode);
    if (!st) return null;
    if (st[0] === st[1]) return route(g, from, to, mode);
    const it = search(g, st[0], st[1], mode);
    let r;
    for (;;) { r = it.next(); if (r.done) break; await new Promise(res => setTimeout(res, 0)); }
    return r.value ? result(g, st[0], st[1], mode, from, to) : null;
  }

  // ---------------------------------------------------------------- following a route
  /** off: metres from the route; done: metres along it to the nearest point; left: metres and seconds still to go. */
  function along(rt, lon, lat) {
    const c = rt.coords, k = Math.cos(rad(lat));
    let best = Infinity, at = 0, run = 0, doneM = 0;
    for (let i = 0; i < c.length - 1; i++) {
      const ax = (c[i][0] - lon) * k, ay = c[i][1] - lat, bx = (c[i + 1][0] - lon) * k, by = c[i + 1][1] - lat;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px, py);
      const seg = distance(c[i][0], c[i][1], c[i + 1][0], c[i + 1][1]);
      if (d < best) { best = d; at = i; doneM = run + seg * t; }
      run += seg;
    }
    const off = best * 111195;
    if (c.length < 2) return { off: distance(lon, lat, c[0][0], c[0][1]), done: 0, left: rt.meters, leftSeconds: rt.seconds, at: 0 };
    const total = run, frac = total ? Math.max(0, 1 - doneM / total) : 0;
    return { off, done: doneM, left: rt.meters * frac, leftSeconds: rt.seconds * frac, at };
  }

  return { CAR_FWD, CAR_BACK, FOOT, STEPS, ROUNDABOUT, LINK, FAST, SPEED, distance, header, inflate, decode, nearest, route, routeAsync, along };
});
