// Sketcher/test/house-scene.js — a known house for the Ház 3D tests (skcam K5), and a tiny PNG writer. The house is
// 10 m (x) × 8 m (z) with 6 m high walls, its middle at the origin; each façade carries an aperiodic block pattern and
// windows (features for COLMAP), the ground a random-tiled pattern, the sky a plain gradient. The photos are taken on
// a ring around it at eye height, each facing the house: what a walk round the building gives. Node only.
'use strict';
const zlib = require('zlib');
const HOUSE = { w: 10000, d: 8000, h: 6000 };            // mm
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

/** The four façades as vertical rectangles: a, b corners at ground level (x, z), outward normal. */
const WALLS = (() => {
  const x = HOUSE.w / 2, z = HOUSE.d / 2;
  return [[[-x, -z], [x, -z], [0, -1]], [[x, -z], [x, z], [1, 0]], [[x, z], [-x, z], [0, 1]], [[-x, z], [-x, -z], [-1, 0]]]
    .map(([a, b, n]) => ({ a, b, n, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }));
})();

/** The camera ring: [count] photos at [radius] mm, [eye] mm up, each looking at the house's middle 2.5 m up. */
function ring(count, radius, eye) {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count * 2 * Math.PI, c = [Math.cos(t) * radius, eye, Math.sin(t) * radius];
    return { name: 'haz_' + String(i).padStart(2, '0') + '.png', c };
  });
}

/** Renders one photo: camera at [c] looking at [at], 35 mm-equivalent [f35], W × H → { w, h, data } RGBA. */
function render(c, at, f35, W, H) {
  const fw = norm([at[0] - c[0], at[1] - c[1], at[2] - c[2]]), rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
  const d35 = Math.hypot(36, 24), dg = Math.hypot(W, H), tanH = (d35 * W / dg) / 2 / f35, tanV = (d35 * H / dg) / 2 / f35;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const qx = (2 * (i + 0.5) / W - 1) * tanH, qy = (1 - 2 * (j + 0.5) / H) * tanV;
    const d = [fw[0] + rt[0] * qx + up[0] * qy, fw[1] + rt[1] * qx + up[1] * qy, fw[2] + rt[2] * qx + up[2] * qy];
    let best = Infinity, col = null;
    WALLS.forEach((w, wi) => {
      const den = d[0] * w.n[0] + d[2] * w.n[1]; if (den >= -1e-9) return;              // only the side facing the camera
      const t = ((w.a[0] - c[0]) * w.n[0] + (w.a[1] - c[2]) * w.n[1]) / den; if (t <= 0 || t >= best) return;
      const px = c[0] + d[0] * t, py = c[1] + d[1] * t, pz = c[2] + d[2] * t;
      if (py < 0 || py > HOUSE.h) return;
      const u = ((px - w.a[0]) * (w.b[0] - w.a[0]) + (pz - w.a[1]) * (w.b[1] - w.a[1])) / w.len;
      if (u < 0 || u > w.len) return;
      best = t; col = facade(wi, u, py);
    });
    if (d[1] < 0) { const t = -c[1] / d[1]; if (t < best) { best = t; const gx = c[0] + d[0] * t, gz = c[2] + d[2] * t; const r = hash(9, Math.floor(gx / 400), Math.floor(gz / 400)); col = [80 + 90 * r, 100 + 60 * r, 60 + 40 * hash(7, Math.floor(gx / 400), Math.floor(gz / 400))]; } }
    if (!col) col = [150 + 60 * qy, 185 + 40 * qy, 230];
    const k = (j * W + i) * 4; data[k] = col[0]; data[k + 1] = col[1]; data[k + 2] = col[2]; data[k + 3] = 255;
  }
  return { w: W, h: H, data };
}
function facade(wi, u, y) {
  const bu = Math.floor(u / 250), by = Math.floor(y / 250), r = hash(wi + 1, bu, by);
  // windows: 1.2 × 1.4 m, every 2.5 m, sills at 1 m and 4 m
  const wu = u % 2500, wy = y < 3000 ? y - 1000 : y - 4000;
  if (wu > 650 && wu < 1850 && wy > 0 && wy < 1400) { const edge = wu < 720 || wu > 1780 || wy < 70 || wy > 1330; return edge ? [240, 240, 235] : [40 + 40 * r, 60 + 40 * r, 80 + 50 * r]; }
  const base = [[200, 170, 140], [185, 190, 170], [210, 185, 160], [175, 165, 185]][wi];
  return base.map((v, k) => Math.max(0, Math.min(255, v * (0.65 + 0.6 * r) + (k === wi % 3 ? 25 * hash(wi, bu * 3, by * 5) : 0))));
}
const norm = v => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---- PNG -----------------------------------------------------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type, 'latin1'), body]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
}
/** An RGB PNG of { w, h, data (RGBA) }. */
function png(img) {
  const raw = Buffer.alloc((img.w * 3 + 1) * img.h);
  for (let y = 0; y < img.h; y++) { raw[y * (img.w * 3 + 1)] = 0; for (let x = 0; x < img.w; x++) { const s = (y * img.w + x) * 4, d = y * (img.w * 3 + 1) + 1 + x * 3; raw[d] = img.data[s]; raw[d + 1] = img.data[s + 1]; raw[d + 2] = img.data[s + 2]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(img.w, 0); ih.writeUInt32BE(img.h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { HOUSE, WALLS, ring, render, png, crc32 };
