// chunk.js — VRG Kocka: a 200 m cube of the world as a point cloud. Pure and UMD, so the page, the tests and later the
// Térkép (phase K3) share it.
//
//   const C = require('./chunk.js')            // Node
//   window.VRGKocka                             // browser
//
//   C.cube(lat, lon, ground, { size, below })  -> { center, size, below, ground, zBase, zTop, half }
//        the chunk: centred on the point, its floor `below` m (20) under the ground at the point, `size` m (200) tall.
//   C.frame(lat)                               -> { kx, ky }  metres per degree (local equirectangular)
//   C.terrainSampler(terrain)                  -> (x, y) => metres above sea level (bilinear on the chunk's grid)
//   C.buildingHeight(b)                        -> { h, minH, src: 'tagged'|'floors'|'class'|'size', floors }
//   C.cloud(chunk, { density, seed })          -> { n, pos: Float32Array(3n), kind: Uint8Array(n),
//                                                   feat: Uint16Array(n), seed: Float32Array(n), features, stats }
//        pos is local metres: x east, y north, z above the cube's floor (0 … size). feat is a 1-based index into
//        features (0 = none); kind is one of C.KIND.
//
// Chunk source format: tools/fetch-chunk.py (vrg-kocka/1). What is measured and what is assumed is kept apart:
// a building with no height tag and no floor count is drawn from the class / size model below and flagged.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGKocka = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KIND = {
    SOIL: 0, GROUND: 1, ROAD: 2, GREEN: 3, WATER: 4, WALL: 5, WALL_EST: 6, ROOF: 7, SLAB: 8, TREE: 9,
    POWER: 10, ASSET: 11, RAIL: 12, WIRE: 13, SECTION: 14, BARRIER: 15, ROAD_EDGE: 16, GLASS: 17, MARK: 18,
  };
  const KIND_NAMES = ['talaj', 'terep', 'út', 'zöld', 'víz', 'fal', 'fal (becsült)', 'tető', 'födém', 'fa',
    'villamos eszköz', 'utcabútor', 'sín', 'felsővezeték', 'metszet', 'kerítés, támfal', 'útszél', 'ablak', 'nullpont'];

  const R_EARTH = 6371008.8, RAD = Math.PI / 180;
  const FLOOR_M = 3.4;            // storey height used for floor counts (Budapest tenements run 3.4-4 m, panels 2.8 m)
  const CLASS_H = {               // metres, when neither a height nor a floor count is known
    apartments: 17, residential: 17, dormitory: 17, hotel: 18, house: 7.5, detached: 7.5, semidetached_house: 7.5,
    terrace: 9, bungalow: 4.5, office: 16, commercial: 12, retail: 9, supermarket: 7, industrial: 9, warehouse: 8,
    shelter: 3, roof: 4, carport: 3, garage: 3, garages: 3, shed: 2.5, hut: 2.5, kiosk: 3, toilets: 3,
    church: 22, chapel: 9, religious: 15, school: 13, kindergarten: 6, university: 16, hospital: 18, civic: 12,
    public: 12, transportation: 6, train_station: 10, parking: 10, service: 4, sports_hall: 10,
  };
  const ROAD_W = {
    motorway: 22, trunk: 18, primary: 16, secondary: 14, tertiary: 10, residential: 7, unclassified: 6,
    living_street: 6, service: 4, pedestrian: 6, footway: 2.5, sidewalk: 2.5, cycleway: 2, steps: 2.4, path: 1.6,
    track: 3, bridleway: 2,
  };
  const CAR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service']);
  const GREEN = new Set(['park', 'grass', 'forest', 'garden', 'pitch', 'dog_park', 'meadow', 'scrub', 'wood', 'cemetery', 'playground', 'flowerbed', 'village_green', 'recreation_ground', 'crop', 'golf_course']);
  const POWER = new Set(['street_lamp', 'traffic_signals', 'power_pole', 'power_tower', 'transformer', 'substation', 'charging_station', 'utility_pole', 'cable_distribution_cabinet', 'mobile_phone_tower', 'communication_tower']);
  const SKIP_ASSET = new Set(['crossing', 'kerb', 'give_way', 'stop', 'turning_circle', 'traffic_calming', 'speed_camera', 'motorway_junction']);

  function frame(lat) {
    return { kx: Math.cos(lat * RAD) * R_EARTH * RAD, ky: R_EARTH * RAD };
  }

  function cube(lat, lon, ground, opt) {
    const o = opt || {}, size = o.size || 200, below = o.below == null ? 20 : o.below;
    const zBase = ground - below;
    return { center: { lat, lon }, size, below, ground, zBase, zTop: zBase + size, half: size / 2 };
  }

  function terrainSampler(t) {
    const { x0, y0, step, nx, ny, cm } = t;
    return function (x, y) {
      let fx = (x - x0) / step, fy = (y - y0) / step;
      fx = Math.max(0, Math.min(nx - 1.000001, fx));
      fy = Math.max(0, Math.min(ny - 1.000001, fy));
      const i = Math.floor(fx), j = Math.floor(fy), ax = fx - i, ay = fy - j;
      const a = cm[j][i], b = cm[j][i + 1], c = cm[j + 1][i], d = cm[j + 1][i + 1];
      return ((a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + d * ax) * ay) / 100;
    };
  }

  function area(ring) {
    let s = 0;
    for (let i = 0, n = ring.length; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n]; s += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(s) / 2;
  }

  function buildingHeight(b) {
    const minH = b.minHeight != null ? b.minHeight : (b.minFloor != null ? b.minFloor * FLOOR_M : 0);
    if (b.height != null && b.height > 0) return { h: b.height, minH, src: 'tagged', floors: b.floors || Math.max(1, Math.round((b.height - minH) / FLOOR_M)) };
    if (b.floors != null && b.floors > 0) return { h: b.floors * FLOOR_M + 1.2, minH, src: 'floors', floors: b.floors };
    const byClass = CLASS_H[b.cls] || CLASS_H[b.sub];
    if (byClass) return { h: byClass, minH, src: 'class', floors: Math.max(1, Math.round(byClass / FLOOR_M)) };
    const a = area(b.ring || []);
    const h = a < 25 ? 3 : a < 80 ? 6 : a < 300 ? 12 : 16;
    return { h, minH, src: 'size', floors: Math.max(1, Math.round(h / FLOOR_M)) };
  }

  function pointInRing(x, y, r) {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function pointInPoly(x, y, p) {
    if (!pointInRing(x, y, p.ring)) return false;
    if (p.holes) for (const h of p.holes) if (pointInRing(x, y, h)) return false;
    return true;
  }
  function bboxOf(ring) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
    return [a, b, c, d];
  }
  function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + t * dx - px, ey = ay + t * dy - py;
    return ex * ex + ey * ey;
  }

  function rng(seed) {   // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** A growable point buffer. */
  function sink(size, half) {
    let cap = 1 << 16, n = 0;
    let pos = new Float32Array(cap * 3), kind = new Uint8Array(cap), feat = new Uint16Array(cap);
    const stats = {};
    function grow() {
      cap *= 2;
      const p = new Float32Array(cap * 3); p.set(pos); pos = p;
      const k = new Uint8Array(cap); k.set(kind); kind = k;
      const f = new Uint16Array(cap); f.set(feat); feat = f;
    }
    return {
      add(x, y, z, k, f) {
        if (z < 0 || z > size || x < -half || x > half || y < -half || y > half) return false;
        if (n === cap) grow();
        pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; kind[n] = k; feat[n] = f || 0;
        stats[k] = (stats[k] || 0) + 1;
        n++;
        return true;
      },
      done(r) {
        const seed = new Float32Array(n);
        for (let i = 0; i < n; i++) seed[i] = r();
        return { n, pos: pos.slice(0, n * 3), kind: kind.slice(0, n), feat: feat.slice(0, n), seed, stats };
      },
    };
  }

  function walk(line, step, fn) {        // calls fn(x, y, dirX, dirY, distance) every `step` metres along a polyline
    let carry = 0, dist = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1];
      const L = Math.hypot(bx - ax, by - ay);
      if (!L) continue;
      const ux = (bx - ax) / L, uy = (by - ay) / L;
      for (let s = carry; s < L; s += step) fn(ax + ux * s, ay + uy * s, ux, uy, dist + s);
      carry = (carry - L) % step; if (carry < 0) carry += step;
      dist += L;
    }
  }

  function cloud(chunk, opt) {
    const o = opt || {}, d = o.density || 1, r = rng(o.seed || 20261125);
    const C = cube(chunk.center.lat, chunk.center.lon, chunk.ground, { size: chunk.size, below: chunk.below });
    const H = C.half, Z0 = C.zBase;
    const ground = terrainSampler(chunk.terrain);
    const gz = (x, y) => ground(x, y) - Z0;
    const out = sink(C.size, H + 1e-6), add = out.add;
    const features = [];
    const jit = s => (r() - 0.5) * s;

    // --- buildings first: their footprints mask the ground
    const blds = (chunk.buildings || []).map(b => {
      const m = buildingHeight(b);
      let base = Infinity;
      for (const [x, y] of b.ring) base = Math.min(base, gz(Math.max(-H, Math.min(H, x)), Math.max(-H, Math.min(H, y))));
      const bb = bboxOf(b.ring);
      const f = { type: 'building', name: b.name || null, cls: b.cls || b.sub || null, h: m.h, minH: m.minH, src: m.src,
        floors: m.floors, base: base + Z0, top: base + Z0 + m.h, area: Math.round(area(b.ring)), from: b.src || [],
        cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2, part: !!b.part };
      features.push(f);
      return { b, m, base, bb, fi: features.length, f };
    });

    for (const { b, m, base, fi } of blds) {
      const z0 = base + m.minH, z1 = base + m.h;
      const est = m.src === 'class' || m.src === 'size';
      const fh = (m.h - m.minH) / Math.max(1, m.floors);
      const cut = new Set(b.cut || []);
      const ring = b.ring, step = 1 / Math.sqrt(d);
      const rings = [ring].concat(b.holes || []);
      rings.forEach((rg, ri) => {
        for (let i = 0; i < rg.length; i++) {
          const [ax, ay] = rg[i], [bx, by] = rg[(i + 1) % rg.length];
          const L = Math.hypot(bx - ax, by - ay);
          if (L < 0.2) continue;
          const isCut = ri === 0 && cut.has(i);
          const hs = isCut ? step * 1.6 : step;
          for (let s = hs / 2; s < L; s += hs) {
            const t = s / L, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
            const ze = isCut ? z0 : Math.min(z0, gz(x, y));     // walls reach the slope
            for (let z = ze + hs / 2; z < z1; z += hs) {
              const zr = z - z0;
              if (isCut) { add(x + jit(.15), y + jit(.15), z, KIND.SECTION, fi); continue; }
              // stylised facade: windows on every floor above the ground floor when the block is tall enough
              if (m.h >= 6 && zr > fh) {
                const inFloor = zr % fh, along = s % 3.0;
                if (inFloor > 0.9 && inFloor < 2.3 && along > 0.8 && along < 2.2) {
                  if (r() < 0.18) add(x, y, z, KIND.GLASS, fi);
                  continue;
                }
              }
              add(x + jit(.08), y + jit(.08), z + jit(.08), est ? KIND.WALL_EST : KIND.WALL, fi);
            }
            // floor slabs, edge lines (denser), on cut faces too
            for (let k = 1; k < m.floors; k++) add(x, y, z0 + k * fh, KIND.SLAB, fi);
            add(x, y, z1, KIND.ROOF, fi);
          }
          // a second, denser pass of the slab lines along the edge
          for (let s = 0.4; s < L; s += 0.8) {
            const t = s / L, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
            for (let k = 1; k < m.floors; k++) add(x, y, z0 + k * fh, KIND.SLAB, fi);
            add(x, y, z1 + 0.05, KIND.ROOF, fi);
          }
        }
      });
      // roof fill (and the floor slabs inside a cut building, so the section reads as storeys)
      const bb = bboxOf(ring), rs = 1.6 / Math.sqrt(d), hasCut = cut.size > 0;
      for (let y = bb[1] + rs / 2; y < bb[3]; y += rs) {
        for (let x = bb[0] + rs / 2; x < bb[2]; x += rs) {
          const px = x + jit(rs * .6), py = y + jit(rs * .6);
          if (!pointInPoly(px, py, b)) continue;
          add(px, py, z1, KIND.ROOF, fi);
          if (hasCut && r() < 0.35) for (let k = 1; k < m.floors; k++) add(px, py, z0 + k * fh, KIND.SLAB, fi);
        }
      }
    }

    // --- ground classes
    const water = (chunk.water || []).filter(w => w.ring);
    const areas = (chunk.areas || []).filter(a => a.kind !== 'land_cover');   // land_cover is 10 m satellite classes: too coarse here
    const greens = areas.filter(a => GREEN.has(a.cls));
    const roads = (chunk.roads || []).map(rd => ({ rd, w: ROAD_W[rd.cls] || 4, bb: bboxOf(rd.line) }));
    const inAny = (list, x, y) => list.some(p => { const bb = p._bb || (p._bb = bboxOf(p.ring)); return x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3] && pointInPoly(x, y, p); });
    const onRoad = (x, y) => {
      for (const { rd, w, bb } of roads) {
        const hw = w / 2;
        if (x < bb[0] - hw || x > bb[2] + hw || y < bb[1] - hw || y > bb[3] + hw) continue;
        const l = rd.line;
        for (let i = 0; i + 1 < l.length; i++) if (segDist2(x, y, l[i][0], l[i][1], l[i + 1][0], l[i + 1][1]) < hw * hw) return true;
      }
      return false;
    };
    const inBuilding = (x, y) => blds.some(({ b, bb }) => x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3] && pointInPoly(x, y, b));

    const gs = 1.5 / Math.sqrt(d);
    for (let y = -H + gs / 2; y < H; y += gs) {
      for (let x = -H + gs / 2; x < H; x += gs) {
        const px = x + jit(gs * .7), py = y + jit(gs * .7);
        if (inBuilding(px, py)) continue;
        let k = KIND.GROUND;
        if (inAny(water, px, py)) k = KIND.WATER;
        else if (onRoad(px, py)) k = KIND.ROAD;
        else if (inAny(greens, px, py)) k = KIND.GREEN;
        add(px, py, gz(px, py), k);
      }
    }

    // --- road edges and centre dashes
    for (const { rd, w } of roads) {
      if (!CAR_ROADS.has(rd.cls)) continue;
      walk(rd.line, 0.6, (x, y, ux, uy, s) => {
        for (const sg of [-1, 1]) {
          const ex = x - uy * sg * w / 2, ey = y + ux * sg * w / 2;
          if (Math.abs(ex) <= H && Math.abs(ey) <= H) add(ex, ey, gz(ex, ey) + 0.15, KIND.ROAD_EDGE);
        }
        if (w >= 10 && s % 6 < 3) add(x, y, gz(x, y) + 0.05, KIND.ROAD_EDGE);
      });
    }

    // --- rails, and the tram's overhead line (the electrical part of the street)
    for (const rl of chunk.rails || []) {
      walk(rl.line, 0.4, (x, y, ux, uy) => {
        for (const sg of [-0.72, 0.72]) add(x - uy * sg, y + ux * sg, gz(x, y) + 0.18, KIND.RAIL);
      });
      if (rl.cls === 'tram' || rl.cls === 'light_rail') {
        walk(rl.line, 0.7, (x, y) => add(x, y, gz(x, y) + 6, KIND.WIRE));
        walk(rl.line, 30, (x, y, ux, uy) => {
          const px = x - uy * 4.5, py = y + ux * 4.5;
          for (let z = 0; z < 7.5; z += 0.3) add(px, py, gz(px, py) + z, KIND.WIRE);
        });
      }
    }

    // --- trees: OSM single trees, tree rows, forest areas
    const tree = (x, y, sc) => {
      const g = gz(x, y), rad = 2.6 * sc, cz = g + 6.5 * sc, n = Math.round(70 * d * sc * sc);
      for (let z = 0; z < 4.2 * sc; z += 0.35) add(x, y, g + z, KIND.TREE);
      for (let i = 0; i < n; i++) {
        const u = r() * 2 - 1, ph = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = rad * (0.75 + 0.25 * r());
        add(x + rr * s * Math.cos(ph), y + rr * s * Math.sin(ph), cz + rr * 1.15 * u, KIND.TREE);
      }
    };
    for (const [x, y] of chunk.trees || []) tree(x, y, 0.9 + 0.3 * r());
    for (const line of chunk.treeRows || []) walk(line, 8, (x, y) => tree(x, y, 0.8 + 0.3 * r()));
    for (const a of areas.filter(a => a.cls === 'forest' || a.cls === 'wood')) {
      const bb = bboxOf(a.ring);
      for (let y = bb[1]; y < bb[3]; y += 7) for (let x = bb[0]; x < bb[2]; x += 7) {
        const px = x + jit(4), py = y + jit(4);
        if (pointInPoly(px, py, a) && !inBuilding(px, py)) tree(px, py, 0.8 + 0.5 * r());
      }
    }

    // --- street furniture; the electrical ones stand out
    for (const a of chunk.assets || []) {
      if (SKIP_ASSET.has(a.cls)) continue;
      const g = gz(a.x, a.y);
      if (POWER.has(a.cls)) {
        const top = a.cls === 'traffic_signals' ? 4 : a.cls === 'street_lamp' ? 7.5 : a.cls === 'transformer' || a.cls === 'cable_distribution_cabinet' ? 2 : /tower/.test(a.cls) ? 18 : 9;
        features.push({ type: 'asset', cls: a.cls, name: a.name || null, cx: a.x, cy: a.y, base: g + Z0, top: g + Z0 + top });
        const fi = features.length;
        for (let z = 0; z < top; z += 0.2) add(a.x, a.y, g + z, KIND.POWER, fi);
        for (let i = 0; i < 40; i++) add(a.x + jit(0.9), a.y + jit(0.9), g + top + jit(0.5), KIND.POWER, fi);
      } else {
        for (let z = 0; z < 1.1; z += 0.18) add(a.x + jit(0.2), a.y + jit(0.2), g + z, KIND.ASSET);
      }
    }
    for (const bar of chunk.barriers || []) {
      const top = bar.cls === 'retaining_wall' ? 2.2 : bar.cls === 'wall' ? 2 : 1.4;
      walk(bar.line, 0.5, (x, y) => { for (let z = 0.25; z < top; z += 0.5) add(x, y, gz(x, y) + z, KIND.BARRIER); });
    }

    // --- the soil block: the cube's four sides under the ground, and its floor
    const ss = 1.5 / Math.sqrt(d);
    const side = (x, y) => { const top = gz(x, y); for (let z = ss / 2; z < top; z += ss) add(x, y, z + jit(ss * .5), KIND.SOIL); };
    for (let s = -H; s <= H; s += ss) { side(s, -H); side(s, H); side(-H, s); side(H, s); }
    for (let y = -H; y <= H; y += 5) for (let x = -H; x <= H; x += 5) add(x + jit(1), y + jit(1), 0, KIND.SOIL);

    // --- the picked point: a column from the floor to 30 m above the ground
    for (let z = 0; z < C.below + 30; z += 0.25) add(0, 0, z, KIND.MARK);

    const res = out.done(r);
    res.features = features;
    res.cube = C;
    return res;
  }

  return { KIND, KIND_NAMES, CLASS_H, ROAD_W, FLOOR_M, frame, cube, terrainSampler, buildingHeight, area, pointInPoly, cloud, rng };
});
