// Map/lib/site-math.js — the sketch on the building (VRG Sketcher Helyszín ↔ Térkép, WP M48): pure maths, no DOM.
// The same rules as the phone's sketch-core SitePlace.kt; Sketcher/test/fixtures/site.json is written from this file
// (node Sketcher/tools/make-fixture.js) and replayed by the JVM test, so the two cannot drift.
//
// Frames: lat/lon on the map; "local" = metres east (x) and south (y) of a reference point (equirectangular: fine for
// one building); "plan" = the solved sketch in metres, y down (south when the plan is not turned).
// A placement {lat, lon, rot} puts the plan's box centre at lat/lon, turned rot degrees clockwise.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VrgSiteMath = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const R = 6371008.8, D = Math.PI / 180;

  const local = (lat0, lon0, lat, lon) => [(lon - lon0) * D * R * Math.cos(lat0 * D), -(lat - lat0) * D * R];
  const toLatLon = (lat0, lon0, x, y) => [lat0 - y / R / D, lon0 + x / (R * Math.cos(lat0 * D)) / D];
  const turn = (p, deg) => { const c = Math.cos(deg * D), s = Math.sin(deg * D); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
  const norm180 = a => { let x = ((a % 360) + 360) % 360; if (x > 180) x -= 360; return x; };
  const fold90 = a => { let x = ((a % 90) + 90) % 90; if (x > 45) x -= 90; return x; };
  const round = (v, k) => Math.round(v * k) / k;

  function insidePoly(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  /** How far [p] is outside [poly] (0 inside). */
  function outside(p, poly) {
    if (insidePoly(p, poly)) return 0;
    let d = Infinity;
    for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length]));
    return d;
  }

  function extent(pts, a) {
    const c = Math.cos(a * D), s = Math.sin(a * D);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of pts) { const x = q[0] * c + q[1] * s, y = -q[0] * s + q[1] * c; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { a, x0, x1, y0, y1, area: (x1 - x0) * (y1 - y0) };
  }
  /**
   * The smallest-area box over [pts]: centre, long side w, short side d and the long side's direction (degrees
   * clockwise from east, 0..180). Searched in 0.5° steps, then refined in 0.05° steps.
   */
  function obox(pts) {
    if (!pts || pts.length < 3) return null;
    let best = null;
    for (let i = 0; i < 180; i++) { const e = extent(pts, i * 0.5); if (!best || e.area < best.area - 1e-9) best = e; }
    const a0 = best.a;
    for (let i = -10; i <= 10; i++) { const e = extent(pts, a0 + i * 0.05); if (e.area < best.area - 1e-9) best = e; }
    const wx = best.x1 - best.x0, wy = best.y1 - best.y0, mx = (best.x0 + best.x1) / 2, my = (best.y0 + best.y1) / 2;
    const c = Math.cos(best.a * D), s = Math.sin(best.a * D);
    let axis = wx >= wy ? best.a : best.a + 90;
    axis = ((axis % 180) + 180) % 180;
    return { cx: mx * c - my * s, cy: mx * s + my * c, w: Math.max(wx, wy), d: Math.min(wx, wy), axis };
  }

  /** The plan's rooms ({name, poly: [[x, y] m]}) placed in the local frame of (lat0, lon0). */
  function placed(rooms, place, lat0, lon0) {
    const pb = obox([].concat(...rooms.map(r => r.poly)));
    if (!pb || !place) return [];
    const at = local(lat0, lon0, place.lat, place.lon);
    return rooms.map(r => ({ name: r.name, poly: r.poly.map(p => { const q = turn([p[0] - pb.cx, p[1] - pb.cy], place.rot); return [q[0] + at[0], q[1] + at[1]]; }) }));
  }
  /** The same, as [lon, lat] rings for the map. */
  function placedLngLat(rooms, place) {
    if (!place) return [];
    return placed(rooms, place, place.lat, place.lon).map(r => ({ name: r.name, ring: r.poly.map(p => { const ll = toLatLon(place.lat, place.lon, p[0], p[1]); return [ll[1], ll[0]]; }) }));
  }

  const ref = outline => [outline.reduce((a, p) => a + p[0], 0) / outline.length, outline.reduce((a, p) => a + p[1], 0) / outline.length];

  function samples(a, b, step) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)), out = [];
    for (let i = 0; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
    return out;
  }
  /** Sum of how far the placed walls stick out of the outline (a fit score: lower is better). */
  function stickScore(rooms, poly) {
    let s = 0;
    for (const r of rooms) for (let i = 0; i < r.poly.length; i++) for (const q of samples(r.poly[i], r.poly[(i + 1) % r.poly.length], 0.25)) s += outside(q, poly);
    return s;
  }

  /**
   * The first placement: the plan turned to the building's walls (4 candidates, a quarter turn apart) and centred on
   * the building's box; the candidate whose walls stick out least wins, a smaller turn on a tie.
   */
  function autoFit(rooms, outline) {
    if (!rooms.length || !outline || outline.length < 3) return null;
    const [lat0, lon0] = ref(outline), poly = outline.map(p => local(lat0, lon0, p[0], p[1]));
    const fb = obox(poly), pb = obox([].concat(...rooms.map(r => r.poly)));
    if (!fb || !pb) return null;
    const at = toLatLon(lat0, lon0, fb.cx, fb.cy);
    let best = null;
    for (let k = 0; k < 4; k++) {
      const rot = round(norm180(fb.axis - pb.axis + k * 90), 100);
      const place = { lat: at[0], lon: at[1], rot };
      const score = round(stickScore(placed(rooms, place, lat0, lon0), poly), 1000);
      if (!best || score < best.score - 1e-6 || (Math.abs(score - best.score) <= 1e-6 && Math.abs(rot) < Math.abs(best.place.rot))) best = { score, place };
    }
    return { lat: round(best.place.lat, 1e7), lon: round(best.place.lon, 1e7), rot: best.place.rot, auto: true };
  }

  const DIRS = [['É', 'északi'], ['ÉK', 'északkeleti'], ['K', 'keleti'], ['DK', 'délkeleti'], ['D', 'déli'], ['DNy', 'délnyugati'], ['Ny', 'nyugati'], ['ÉNy', 'északnyugati']];
  /** Compass sector of a local vector (x east, y south). */
  const sector = (x, y) => Math.round((((Math.atan2(x, -y) / D) + 360) % 360) / 45) % 8;

  /**
   * How the placed sketch sits on the building: the turn between their walls (folded to ±45°), the distance of the two
   * box centres and its direction, and every wall that sticks out more than [tol] m.
   */
  function report(rooms, outline, place, tol) {
    tol = tol == null ? 0.25 : tol;
    if (!rooms.length || !outline || outline.length < 3 || !place) return null;
    const [lat0, lon0] = ref(outline), poly = outline.map(p => local(lat0, lon0, p[0], p[1]));
    const pr = placed(rooms, place, lat0, lon0);
    const fb = obox(poly), pb = obox([].concat(...pr.map(r => r.poly)));
    const turnDeg = round(fold90(pb.axis - fb.axis), 10);
    const ox = pb.cx - fb.cx, oy = pb.cy - fb.cy, off = round(Math.hypot(ox, oy), 100);
    const walls = [];
    let n = 0, inside = 0;
    pr.forEach((r, ri) => {
      const p = r.poly;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        let worst = 0;
        const sm = samples(a, b, 0.1);
        // a wall is judged on its middle 80 %: a wall that is only too long shows on the walls at its ends instead
        sm.forEach((q, k) => { const o = outside(q, poly); n++; if (o === 0) inside++; const t = k / (sm.length - 1); if (t >= 0.1 - 1e-9 && t <= 0.9 + 1e-9 && o > worst) worst = o; });
        if (worst > tol) {
          const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
          let nx = dy / l, ny = -dx / l;
          const mid = [(a[0] + b[0]) / 2 + nx * 0.01, (a[1] + b[1]) / 2 + ny * 0.01];
          if (insidePoly(mid, p)) { nx = -nx; ny = -ny; }
          walls.push({ room: ri, name: rooms[ri].name || '', edge: i, dir: DIRS[sector(nx, ny)][0], out: round(worst, 100) });
        }
      }
    });
    const verdict = walls.length ? 'kilog' : Math.abs(turnDeg) > 3 ? 'elforgatva' : off > 1 ? 'eltolva' : 'rendben';
    return { turn: turnDeg, offset: off, offsetDir: off < 0.05 ? '' : DIRS[sector(ox, oy)][0], walls, inside: n ? round(inside / n, 1000) : 0, verdict };
  }

  const m1 = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
  const ADJ = Object.fromEntries(DIRS);
  /** The report in the field's words (the phone shows the same lines). */
  function reportLines(r) {
    if (!r) return [];
    const out = [];
    out.push(r.verdict === 'rendben' ? 'A vázlat a körvonalon belül van, a falak párhuzamosak.' :
      r.verdict === 'elforgatva' ? 'A vázlat falai ' + m1(Math.abs(r.turn)) + '°-kal elfordulnak az épületéhez képest.' :
      r.verdict === 'eltolva' ? 'A vázlat a körvonalon belül van, de nem középen.' : 'A vázlat ' + r.walls.length + ' fala kilóg a körvonalból.');
    out.push('Elfordulás: ' + m1(r.turn) + '° · középpont eltérése: ' + m1(r.offset) + ' m' + (r.offsetDir ? ' ' + r.offsetDir : ''));
    r.walls.slice(0, 8).forEach(w => out.push('· ' + (w.name || 'Helyiség') + ', ' + ADJ[w.dir] + ' fal: ' + m1(w.out) + ' m-rel kilóg'));
    if (r.walls.length > 8) out.push('· … és még ' + (r.walls.length - 8));
    return out;
  }

  /** The building's oriented size from a lat/lon outline (= SiteMath.footprint on the phone). */
  function footprint(outline) {
    if (!outline || outline.length < 3) return null;
    const [lat0, lon0] = ref(outline), poly = outline.map(p => local(lat0, lon0, p[0], p[1]));
    const b = obox(poly);
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; a += poly[i][0] * q[1] - q[0] * poly[i][1]; }
    return { w: round(b.w, 100), d: round(b.d, 100), area: round(Math.abs(a) / 2, 10), axis: round(b.axis, 10) };
  }

  /** The solved plan's rooms in metres from the Planner package's floors (mm) or a sketch's solved rooms. */
  const roomsFromMm = list => (list || []).filter(r => r.poly && r.poly.length >= 3).map(r => ({ name: r.name || '', poly: r.poly.map(p => [p[0] / 1000, p[1] / 1000]) }));

  return { local, toLatLon, turn, obox, placed, placedLngLat, autoFit, report, reportLines, footprint, roomsFromMm, outside, insidePoly, fold90, norm180 };
});
