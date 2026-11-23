// Sketcher/lib/pano.js — Körkép (dev line skcam, stage K4): the 360° view of a photo point. Pure maths on plain
// images ({ w, h, data: RGBA }), no DOM, no library, so the Desktop page, the phone's WebView and Node tests share it.
//
// All the shots of one Fotópont are taken from the same spot, and lib/roombox.js already knows each one's direction,
// tilt and field of view (the lens from the phone's camera, K1b). So no feature matching is needed to put them
// together: every direction of the sphere is looked up in the photos that see it ("known-pose stitching"). What the
// poses get wrong (the swipe's 90° rounding, a phone held a little tilted) is fixed by aligning neighbouring photos where
// they overlap (align): the corrections go into the survey's `box` key, the same ones the Szobadoboz uses, so the 3D
// view gets better too. Overlap needs the 0.5× lens or more shots; four 1× shots leave gaps (research §1.1).
//
// Directions: lon 0 = É (up on the plan), growing toward K (clockwise seen from above); lat up. The world is
// lib/roombox.js's: X = plan x, Y = up, Z = plan y.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGPano = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;

  /** The world direction of (lon, lat) in degrees. */
  function dirOf(lon, lat) { const a = lon * RAD, b = lat * RAD; return [Math.sin(a) * Math.cos(b), Math.sin(b), -Math.cos(a) * Math.cos(b)]; }
  /** A camera basis (roombox.js basis): right, up, forward. */
  function basis(yawDeg, pitchDeg) {
    const y = yawDeg * RAD, p = (pitchDeg || 0) * RAD, f0 = [Math.sin(y), 0, -Math.cos(y)];
    return { r: [Math.cos(y), 0, Math.sin(y)], fwd: [f0[0] * Math.cos(p), Math.sin(p), f0[2] * Math.cos(p)], up: [-f0[0] * Math.sin(p), Math.cos(p), -f0[2] * Math.sin(p)] };
  }
  /** Where a direction lands in a camera ({basis, tanH, tanV}): [qx, qy] in −1…1 across the frame, or null. */
  function q(cam, d) {
    const B = cam.basis, z = d[0] * B.fwd[0] + d[1] * B.fwd[1] + d[2] * B.fwd[2];
    if (z <= 1e-6) return null;
    const x = (d[0] * B.r[0] + d[1] * B.r[1] + d[2] * B.r[2]) / z / cam.tanH, y = (d[0] * B.up[0] + d[1] * B.up[1] + d[2] * B.up[2]) / z / cam.tanV;
    return Math.abs(x) <= 1 && Math.abs(y) <= 1 ? [x, y] : null;
  }
  /** Bilinear colour at (u, v) in 0…1 of an image (v down) into [out]. */
  function sample(img, u, v, out) {
    const x = Math.min(img.w - 1.001, Math.max(0, u * img.w - 0.5)), y = Math.min(img.h - 1.001, Math.max(0, v * img.h - 0.5));
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, w = img.w, D = img.data;
    const i00 = (y0 * w + x0) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
    for (let c = 0; c < 3; c++) out[c] = (D[i00 + c] * (1 - fx) + D[i10 + c] * fx) * (1 - fy) + (D[i01 + c] * (1 - fx) + D[i11 + c] * fx) * fy;
    return out;
  }

  /**
   * The equirectangular panorama (W × H, W = 2 H) of [shots] (roombox.js scene shots of one photo point: basis, tanH,
   * tanV, file) from [images] (file → { w, h, data }). Where photos overlap they blend toward their middles; where none
   * sees, the pixel is dark. → { w, h, data, covered } (covered = the share of the sphere some photo sees).
   */
  function equirect(shots, images, W, H) {
    const data = new Uint8ClampedArray(W * H * 4), cams = shots.filter(s => images[s.file]), c = [0, 0, 0];
    let seen = 0;
    for (let j = 0; j < H; j++) {
      const lat = 90 - (j + 0.5) * 180 / H;
      for (let i = 0; i < W; i++) {
        const d = dirOf((i + 0.5) * 360 / W, lat);
        let r = 0, g = 0, b = 0, wsum = 0;
        for (const s of cams) {
          const p = q(s, d); if (!p) continue;
          const e = 1 - Math.max(Math.abs(p[0]), Math.abs(p[1])), w = e * e + 1e-4;
          sample(images[s.file], 0.5 + 0.5 * p[0], 0.5 - 0.5 * p[1], c);
          r += c[0] * w; g += c[1] * w; b += c[2] * w; wsum += w;
        }
        const k = (j * W + i) * 4;
        if (wsum > 0) { data[k] = r / wsum; data[k + 1] = g / wsum; data[k + 2] = b / wsum; seen++; }
        else { data[k] = 28; data[k + 1] = 32; data[k + 2] = 36; }
        data[k + 3] = 255;
      }
    }
    return { w: W, h: H, data, covered: seen / (W * H) };
  }

  // ---- aligning neighbours ------------------------------------------------------------------------------------------
  /** A grey copy at most [max] px wide, for matching. */
  function grey(img, max) {
    const k = Math.min(1, max / img.w), w = Math.max(8, Math.round(img.w * k)), h = Math.max(8, Math.round(img.h * k));
    const data = new Float32Array(w * h), c = [0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { sample(img, (x + 0.5) / w, (y + 0.5) / h, c); data[y * w + x] = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
    return { w, h, data };
  }
  function greyAt(g, u, v) {
    const x = Math.min(g.w - 1.001, Math.max(0, u * g.w - 0.5)), y = Math.min(g.h - 1.001, Math.max(0, v * g.h - 0.5));
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, D = g.data, i = y0 * g.w + x0;
    return (D[i] * (1 - fx) + D[i + 1] * fx) * (1 - fy) + (D[i + g.w] * (1 - fx) + D[i + g.w + 1] * fx) * fy;
  }
  const halfH = s => Math.atan(s.tanH) / RAD, halfV = s => Math.atan(s.tanV) / RAD;
  const wrap = a => ((a % 360) + 540) % 360 - 180;

  /**
   * The overlap of two neighbouring shots A (left) and B (right, its yaw larger): the directions both see, as a grid
   * of (lon, lat). Null when they overlap less than [minDeg].
   */
  function overlap(A, B, minDeg) {
    const gap = wrap(B.yaw - A.yaw);                        // B's yaw seen from A's, −180…180
    const from = gap - halfH(B), to = halfH(A);              // in A's frame: B's left edge … A's right edge
    if (to - from < (minDeg || 3)) return null;
    const v = Math.min(halfV(A) + (A.pitch || 0), halfV(B) + (B.pitch || 0)) * 0.8, lo = -Math.min(halfV(A) - (A.pitch || 0), halfV(B) - (B.pitch || 0)) * 0.8;
    return { lon0: A.yaw + from, lon1: A.yaw + to, lat0: lo, lat1: v, width: to - from };
  }
  /** Zero-mean normalised cross-correlation of two equal arrays (−1…1); null when either is flat. */
  function ncc(a, b) {
    const n = a.length; let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
    return saa > 1e-6 && sbb > 1e-6 ? sab / Math.sqrt(saa * sbb) : null;
  }
  /** The best (dyaw, dpitch) for B relative to A over their overlap: a coarse grid, then a finer one around the best. */
  function pair(A, B, ga, gb, opts) {
    const o = opts || {}, ov = overlap(A, B, o.minOverlap); if (!ov) return null;
    const NX = 36, NY = 30, grid = [];
    for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
      const lon = ov.lon0 + (ix + 0.5) / NX * (ov.lon1 - ov.lon0), lat = ov.lat0 + (iy + 0.5) / NY * (ov.lat1 - ov.lat0);
      grid.push(dirOf(lon, lat));
    }
    const camA = { basis: basis(A.yaw, A.pitch), tanH: A.tanH, tanV: A.tanV };
    const va = [], keep = [];
    grid.forEach((d, k) => { const p = q(camA, d); if (p) { va.push(greyAt(ga, 0.5 + 0.5 * p[0], 0.5 - 0.5 * p[1])); keep.push(k); } });
    const score = (dy, dp) => {
      const camB = { basis: basis(B.yaw + dy, (B.pitch || 0) + dp), tanH: B.tanH, tanV: B.tanV }, a = [], b = [];
      keep.forEach((k, n) => { const p = q(camB, grid[k]); if (p) { a.push(va[n]); b.push(greyAt(gb, 0.5 + 0.5 * p[0], 0.5 - 0.5 * p[1])); } });
      return a.length > grid.length * 0.4 ? ncc(a, b) : null;
    };
    const R = o.range || 10, P = o.pitchRange || 6;
    let best = { dy: 0, dp: 0, s: -2 };
    const scan = (y0, y1, ys, p0, p1, ps) => { for (let dy = y0; dy <= y1 + 1e-9; dy += ys) for (let dp = p0; dp <= p1 + 1e-9; dp += ps) { const s = score(dy, dp); if (s != null && s > best.s) best = { dy, dp, s }; } };
    scan(-R, R, 1, -P, P, 1);
    const c = best; scan(c.dy - 1, c.dy + 1, 0.25, c.dp - 1, c.dp + 1, 0.25);
    const f = best; scan(f.dy - 0.25, f.dy + 0.25, 0.05, f.dp - 0.25, f.dp + 0.25, 0.05);
    return best.s > -2 ? { dyaw: Math.round(best.dy * 100) / 100, dpitch: Math.round(best.dp * 100) / 100, score: best.s, overlap: ov.width } : null;
  }

  /**
   * Aligns the shots of one photo point: each neighbour pair (by yaw) is matched where they overlap, the first shot
   * stays where it is, the others follow along the ring; a closed ring's leftover is shared out. → { fixes: { key:
   * {dyaw, dpitch} }, pairs: [...], ring } — dyaw / dpitch to ADD to each shot's current correction.
   */
  function align(shots, images, opts) {
    const o = opts || {}, list = shots.filter(s => images[s.file]).slice().sort((a, b) => ((a.yaw % 360) + 360) % 360 - ((b.yaw % 360) + 360) % 360);
    const fixes = {}, pairs = [];
    if (list.length < 2) return { fixes, pairs, ring: false };
    const greys = list.map(s => grey(images[s.file], o.px || 360));
    const n = list.length, closed = n >= 3;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const A = list[i], B = list[(i + 1) % n];
      const r = pair(A, B, greys[i], greys[(i + 1) % n], o);
      pairs.push({ a: A.key, b: B.key, ok: !!(r && r.score >= (o.minScore || 0.5)), ...(r || {}) });
    }
    const good = pairs.map(p => p.ok);
    // walk the ring from the first shot; stop at the first pair that did not match
    let cy = 0, cp = 0, reach = 0;
    fixes[list[0].key] = { dyaw: 0, dpitch: 0 };
    for (let i = 1; i < n; i++) {
      const p = pairs[i - 1]; if (!good[i - 1]) break;
      cy += p.dyaw; cp += p.dpitch; fixes[list[i].key] = { dyaw: cy, dpitch: cp }; reach = i;
    }
    const ring = closed && reach === n - 1 && good[n - 1];
    if (ring) {                                              // the loop's leftover, shared out along it
      const ly = cy + pairs[n - 1].dyaw, lp = cp + pairs[n - 1].dpitch;
      for (let i = 1; i < n; i++) { fixes[list[i].key].dyaw -= ly * i / n; fixes[list[i].key].dpitch -= lp * i / n; }
    }
    Object.values(fixes).forEach(f => { f.dyaw = Math.round(f.dyaw * 100) / 100; f.dpitch = Math.round(f.dpitch * 100) / 100; });
    return { fixes, pairs, ring };
  }

  // ---- the 360° file ----------------------------------------------------------------------------------------------
  /** The Photo Sphere XMP (GPano) that makes viewers show an equirectangular JPEG as a 360° view. */
  function xmp(W, H, heading) {
    return '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/" GPano:ProjectionType="equirectangular" GPano:UsePanoramaViewer="True"' +
      ' GPano:CroppedAreaImageWidthPixels="' + W + '" GPano:CroppedAreaImageHeightPixels="' + H + '" GPano:FullPanoWidthPixels="' + W + '" GPano:FullPanoHeightPixels="' + H + '"' +
      ' GPano:CroppedAreaLeftPixels="0" GPano:CroppedAreaTopPixels="0" GPano:PoseHeadingDegrees="' + (heading || 0) + '"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  }
  /** A JPEG's bytes with an XMP block inserted right after its start marker. */
  function withXmp(jpeg, packet) {
    const b = jpeg instanceof Uint8Array ? jpeg : new Uint8Array(jpeg);
    if (b[0] !== 0xFF || b[1] !== 0xD8) throw new Error('nem JPEG');
    const head = 'http://ns.adobe.com/xap/1.0/\u0000', body = utf8(head + packet), len = body.length + 2;
    if (len > 65535) throw new Error('az XMP túl hosszú');
    const out = new Uint8Array(b.length + 4 + body.length);
    out[0] = 0xFF; out[1] = 0xD8; out[2] = 0xFF; out[3] = 0xE1; out[4] = len >> 8; out[5] = len & 255;
    out.set(body, 6); out.set(b.subarray(2), 6 + body.length);
    return out;
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    const a = []; for (const ch of unescape(encodeURIComponent(s))) a.push(ch.charCodeAt(0)); return new Uint8Array(a);
  }

  /** The survey's `box` corrections with align()'s fixes added (yaw / pitch per shot); a new object. */
  function applyFixes(box, fixes) {
    const b = JSON.parse(JSON.stringify(box || {}));
    b.shots = b.shots || {};
    Object.entries(fixes || {}).forEach(([k, f]) => {
      const o = Object.assign({}, b.shots[k]);
      const y = Math.round(((+o.yaw || 0) + f.dyaw) * 100) / 100, p = Math.round(((+o.pitch || 0) + f.dpitch) * 100) / 100;
      if (y) o.yaw = y; else delete o.yaw;
      if (p) o.pitch = p; else delete o.pitch;
      if (Object.keys(o).length) b.shots[k] = o; else delete b.shots[k];
    });
    if (!Object.keys(b.shots).length) delete b.shots;
    return b;
  }
  /** One line for the user: what the alignment did, or why it could not. */
  function report(al, label) {
    const ok = al.pairs.filter(p => p.ok);
    if (!al.pairs.length) return 'Ehhez legalább két fotó kell ennél a pontnál.';
    if (!ok.length) return al.pairs.some(p => p.overlap) ? 'A szomszédos képek nem illeszthetők (kevés közös rajzolat).' : 'Nincs átfedés a képek között: 0,5× objektívvel fotózz (vagy több irányba).';
    const f = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace('.', ',') + '°';
    const parts = Object.entries(al.fixes).filter(([, x]) => Math.abs(x.dyaw) >= 0.05 || Math.abs(x.dpitch) >= 0.05)
      .map(([k, x]) => (label ? label(k) : k) + ' ' + f(x.dyaw) + (Math.abs(x.dpitch) >= 0.05 ? ' / dőlés ' + f(x.dpitch) : ''));
    return 'Igazítva (' + ok.length + '/' + al.pairs.length + ' pár' + (al.ring ? ', körbe zárva' : '') + '): ' + (parts.length ? parts.join(', ') : 'nem kellett javítani') + '.';
  }

  return { dirOf, basis, q, sample, equirect, grey, overlap, ncc, pair, align, applyFixes, report, xmp, withXmp };
});
