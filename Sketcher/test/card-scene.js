// Sketcher/test/card-scene.js — a wall with the VRG mérőkártya, "photographed" by its own pinhole camera, for the
// mérőkártya tests (skcam K3 follow-up). Written independently of lib/marker.js and lib/plane.js on purpose: the card is
// drawn from the printed cell layout (codes passed in), the photo is anti-aliased (3 × 3 samples), unevenly lit and
// noisy, with a socket, a dark picture frame and a floor beside the card. Runs in a page (window.VRGCardScene) and in
// Node (require), no dependencies.
//
//   photo({ codes, id, S, cx, cy, rot, yaw, pitch, dist, x0, fov, W, H, noise, vignette, seed })
//     → { img: { width, height, data }, cam(wallPoint) → [u, v], truth: the card's printed corners [u, v] × 4, W, H }
//   wall mm: x right, y DOWN from the top of a 2600 mm wall (the floor below 2600). The card: side S at (cx, cy) top-left,
//   turned by `rot` quarter turns clockwise as it hangs.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGCardScene = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function photo(o) {
    const W = o.W || 1600, H = o.H || 1200, ASPECT = W / H, yaw = (o.yaw || 0) * Math.PI / 180, pitch = (o.pitch || 0) * Math.PI / 180;
    const dist = o.dist || 2400, eye = 1350, x0 = o.x0 || 1400, f = 1 / (2 * Math.tan((o.fov || 33) * Math.PI / 180));
    const S = o.S || 150, cx = o.cx || 1200, cy = o.cy || 1000, rot = o.rot || 0, code = o.codes[o.id || 0];
    // camera: turned by yaw about the vertical, tilted by pitch; z toward the wall
    const cam = p => {
      let X = p[0] - x0, Y = eye - p[1], Z = dist;
      let x = X * Math.cos(yaw) - Z * Math.sin(yaw), z = X * Math.sin(yaw) + Z * Math.cos(yaw);
      const y2 = Y * Math.cos(pitch) - z * Math.sin(pitch), z2 = Y * Math.sin(pitch) + z * Math.cos(pitch);
      return [0.5 + (f * x / z2) / ASPECT, 0.5 - f * y2 / z2];
    };
    const back = (u, v) => {
      const qx = (u - 0.5) * ASPECT / f, qy = (0.5 - v) / f;                 // camera ray (qx, qy, 1)
      const ry = qy * Math.cos(pitch) + Math.sin(pitch), rz = -qy * Math.sin(pitch) + Math.cos(pitch);   // undo the tilt
      const dx = qx * Math.cos(yaw) + rz * Math.sin(yaw), dz = -qx * Math.sin(yaw) + rz * Math.cos(yaw);  // undo the turn
      const t = dist / dz; return t > 0 ? [x0 + dx * t, eye - ry * t] : null;
    };
    const m = S / 6;
    const cardAt = (x, y) => {           // 1 = black, 0 = paper, -1 = not on the card's paper
      const qx = x - cx, qy = y - cy, pad = Math.max(m, 8);
      if (qx < -pad || qy < -pad || qx > S + pad || qy > S + pad + 22) return -1;
      if (qx < 0 || qy < 0 || qx >= S || qy >= S) return 0;
      let K = Math.floor(qx / m), R = Math.floor(qy / m);
      if (R === 0 || K === 0 || R === 5 || K === 5) return 1;
      // the card hangs turned: the photo cell (R, K) of the turned card is printed cell…
      let r = R - 1, k = K - 1;
      for (let i = 0; i < rot; i++) { const t = r; r = 3 - k; k = t; }    // undo a clockwise quarter turn
      return (code >> (r * 4 + k)) & 1;
    };
    const shade = (x, y) => {
      if (y > 2600) return ((Math.floor(x / 300) + Math.floor(y / 300)) % 2) ? 115 : 85;     // floor tiles
      const c = cardAt(x, y); if (c === 1) return 22; if (c === 0) return 238;
      if (Math.abs(x - 1800) < 40 && Math.abs(y - 2300) < 40) return 60;                         // the socket
      if (x > 300 && x < 800 && y > 700 && y < 1100) return (x < 330 || x > 770 || y < 730 || y > 1070) ? 40 : 170;   // a picture frame
      return 196;
    };
    const data = new Uint8ClampedArray(W * H * 4); let seed = o.seed || 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    const SS = 3;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let s = 0;
      for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) { const p = back((i + (b + 0.5) / SS) / W, (j + (a + 0.5) / SS) / H); s += p ? shade(p[0], p[1]) : 10; }
      const light = 1 - (o.vignette == null ? 0.35 : o.vignette) * (Math.hypot(i / W - 0.2, j / H - 0.3));   // uneven light
      const v = Math.max(0, Math.min(255, s / (SS * SS) * light + (rnd() - 0.5) * 2 * (o.noise == null ? 6 : o.noise)));
      const k = (j * W + i) * 4; data[k] = v; data[k + 1] = v * 0.97; data[k + 2] = v * 0.92; data[k + 3] = 255;
    }
    // the card's printed corners (top-left, top-right, bottom-right, bottom-left as printed) on the wall
    const sq = [[cx, cy], [cx + S, cy], [cx + S, cy + S], [cx, cy + S]];
    const printed = [0, 1, 2, 3].map(i => sq[(i + rot) % 4]);   // turned clockwise: the printed top-left moves to corner rot
    return { img: { width: W, height: H, data }, cam, truth: printed.map(cam), W, H };
  }
  return { photo };
});
