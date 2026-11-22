// Sketcher/test/raycast.js — a tiny ray caster for the Szobadoboz browser tests (skcam K1 / K1b). It "photographs" a
// known room from a photo point: each wall its own colour with 50 cm stripes, a dark band at 1 m, a checker floor and a
// pale ceiling. Written independently of lib/roombox.js on purpose: when the 3D view seen from the photo point matches
// these photos, the projection is right. Runs in the page (window.VRGRaycast.photo); no dependencies.
(function (root) {
  'use strict';
  const HUES = [[220, 70, 60], [60, 160, 220], [90, 190, 90], [230, 190, 60], [170, 90, 200], [60, 200, 190]];
  /**
   * room = a lib/roombox.js scene room (walls, h); at = [x, y] plan mm; deg = facing (0 = up on the plan); f35 = the lens;
   * W × H pixels; eye = camera height (mm). Returns a canvas.
   */
  function photo(room, at, deg, f35, W, H, eye) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), im = g.createImageData(W, H);
    const d35 = Math.hypot(36, 24), dg = Math.hypot(W, H);
    const tanH = (d35 * W / dg) / 2 / f35, tanV = (d35 * H / dg) / 2 / f35;
    const y = deg * Math.PI / 180, fw = [Math.sin(y), 0, -Math.cos(y)], rt = [Math.cos(y), 0, Math.sin(y)];
    const C = [at[0], eye, at[1]];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const qx = (2 * (i + 0.5) / W - 1) * tanH, qy = (1 - 2 * (j + 0.5) / H) * tanV;
      const d = [fw[0] + rt[0] * qx, qy, fw[2] + rt[2] * qx];
      let best = Infinity, col = [0, 0, 0];
      room.walls.forEach((w, wi) => {
        const ex = w.b[0] - w.a[0], ez = w.b[1] - w.a[1], den = d[0] * ez - d[2] * ex; if (Math.abs(den) < 1e-9) return;
        const t = ((w.a[0] - C[0]) * ez - (w.a[1] - C[2]) * ex) / den, u = ((w.a[0] - C[0]) * d[2] - (w.a[1] - C[2]) * d[0]) / den;
        const hy = C[1] + d[1] * t; if (t <= 0 || u < 0 || u > 1 || hy < 0 || hy > room.h || t >= best) return;
        best = t; const hue = HUES[wi % HUES.length], stripe = Math.floor(u * w.len / 500) % 2;
        col = Math.abs(hy - 1000) < 40 ? [20, 20, 20] : hue.map(v => stripe ? v : v * 0.55);
      });
      if (d[1] < 0) { const t = -C[1] / d[1]; if (t < best) { best = t; const x = C[0] + d[0] * t, z = C[2] + d[2] * t; col = (Math.floor(x / 300) + Math.floor(z / 300)) % 2 ? [200, 200, 200] : [70, 70, 70]; } }
      if (d[1] > 0) { const t = (room.h - C[1]) / d[1]; if (t < best) col = [240, 236, 220]; }
      const k = (j * W + i) * 4; im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  /** Mean colour difference (0…255) and the share of clearly wrong pixels between two canvases, both scaled to 80 × 60. */
  function compare(a, b) {
    const pix = cv => { const x = document.createElement('canvas'); x.width = 80; x.height = 60; x.getContext('2d').drawImage(cv, 0, 0, 80, 60); return x.getContext('2d').getImageData(0, 0, 80, 60).data; };
    const A = pix(a), B = pix(b);
    let sum = 0, n = 0, bad = 0;
    for (let k = 0; k < A.length; k += 4) { const e = (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2])) / 3; sum += e; n++; if (e > 60) bad++; }
    return { mean: sum / n, bad: bad / n };
  }
  root.VRGRaycast = { photo, compare };
})(typeof self !== 'undefined' ? self : this);
