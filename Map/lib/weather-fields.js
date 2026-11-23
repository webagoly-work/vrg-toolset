// weather-fields.js — the drawing half of the VRG Térkép "W" layer: decoding the fields, sampling them in space and
// time, the colour ramps, the field canvases (MapLibre canvas sources) and the wind particles.
// No library, no network: data comes from weather-layer.js, which owns the map, the panel and the timeline.
//
// Colours are chosen against the VRG Terep basemap (light paper, yellow/orange roads, green parks, blue water):
// translucent, so streets and labels stay readable underneath; cold is a steel blue, warm a burnt orange, rain a
// saturated blue-violet, cloud a cool grey veil, gust bands follow the alert levels (amber / orange / red).

const MERC = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const UNMERC = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;

// ---------------------------------------------------------------- decoding and sampling
export function decode(payload) {
  const toF = (b64, sc) => {
    if (!b64) return null;
    const bin = atob(b64), q = new Int16Array(bin.length / 2);
    for (let i = 0; i < q.length; i++) { const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); q[i] = v > 32767 ? v - 65536 : v; }
    const f = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) f[i] = q[i] === -32768 ? NaN : q[i] * sc;
    return f;
  };
  const vars = {};
  for (const [v, list] of Object.entries(payload.vars)) vars[v] = list.map(b => toF(b, payload.scale[v] || 0.1));
  return { ...payload, times: payload.times.map(t => Date.parse(t)), vars };
}

// fractional frame index for time t (ms); clamped to the range
export function frameAt(times, t) {
  if (!times.length) return 0;
  if (t <= times[0]) return 0;
  if (t >= times[times.length - 1]) return times.length - 1;
  let i = 0; while (times[i + 1] < t) i++;
  return i + (t - times[i]) / (times[i + 1] - times[i]);
}

function bilinear(f, g, x, y) {
  if (x < 0 || y < 0 || x > g.nx - 1 || y > g.ny - 1) return NaN;
  const i = Math.min(Math.floor(x), g.nx - 2), j = Math.min(Math.floor(y), g.ny - 2), fx = x - i, fy = y - j, k = j * g.nx + i;
  return (f[k] * (1 - fx) + f[k + 1] * fx) * (1 - fy) + (f[k + g.nx] * (1 - fx) + f[k + g.nx + 1] * fx) * fy;
}
// value of var v at lon/lat and fractional frame index fi (both interpolated)
export function sample(F, v, lon, lat, fi) {
  const frames = F.vars[v]; if (!frames) return NaN;
  const g = F.grid, x = (lon - g.lon0) / g.dlon, y = (lat - g.lat0) / g.dlat;
  const a = Math.floor(fi), b = Math.min(a + 1, frames.length - 1), w = fi - a;
  const fa = frames[a], fb = frames[b] || fa;
  if (!fa) return NaN;
  const va = bilinear(fa, g, x, y);
  return w && fb !== fa ? va * (1 - w) + bilinear(fb, g, x, y) * w : va;
}

// ---------------------------------------------------------------- colour ramps: value -> [r, g, b, a] (0-255)
function ramp(stops) {
  return v => {
    if (Number.isNaN(v)) return null;
    if (v <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
      const [v0, c0] = stops[i - 1], [v1, c1] = stops[i], t = (v - v0) / (v1 - v0);
      return c0.map((c, k) => c + (c1[k] - c) * t);
    }
    return stops[stops.length - 1][1];
  };
}
export const RAMPS = {
  t2m: { unit: '°C', ticks: [-15, -5, 0, 5, 15, 25, 35], domain: [-25, 42], fn: ramp([
    [-20, [62, 54, 140, 150]], [-10, [52, 104, 186, 140]], [-2, [86, 154, 208, 120]], [0, [150, 200, 222, 100]], [4, [214, 226, 214, 70]],
    [10, [242, 226, 170, 80]], [16, [242, 186, 110, 110]], [24, [226, 120, 50, 140]], [32, [196, 58, 34, 160]], [40, [128, 22, 40, 175]]]) },
  precip: { unit: 'mm/h', ticks: [0.2, 1, 2, 5, 10], scale: 'sqrt', domain: [0, 20], fn: ramp([
    [0.05, [120, 170, 230, 0]], [0.2, [110, 165, 235, 120]], [0.8, [56, 120, 220, 170]], [2, [36, 82, 200, 200]], [4, [96, 52, 196, 215]],
    [8, [176, 40, 170, 225]], [15, [220, 30, 110, 235]]]) },
  cloud: { unit: '%', ticks: [20, 50, 80, 100], domain: [0, 140], fn: ramp([[10, [96, 108, 124, 0]], [40, [104, 116, 132, 40]], [75, [96, 106, 122, 95]], [100, [84, 92, 108, 140]]]) },
  // the alert limits of Weather/config/rules.json: 7.6 ladder / tower, 10 roof, 12.5 MEWP (EN 280)
  gust: { unit: 'm/s', ticks: [7.6, 10, 12.5, 17], bands: true, domain: [0, 30], fn: v => (Number.isNaN(v) || v < 7.6 ? null
    : v < 10 ? [232, 182, 60, 70] : v < 12.5 ? [228, 128, 40, 92] : v < 17 ? [206, 52, 40, 128] : [140, 20, 60, 150]) },
};
export const css = c => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(c[3] / 255).toFixed(2)})`;

// ---------------------------------------------------------------- tileable value noise, for cloud and rain texture
function noiseTexture(n = 128, seed = 7) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const oct = (cells) => {
    const g = Array.from({ length: cells * cells }, r), out = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const gx = x / n * cells, gy = y / n * cells, i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
      const sm = t => t * t * (3 - 2 * t), a = g[(j % cells) * cells + (i % cells)], b = g[(j % cells) * cells + ((i + 1) % cells)];
      const c = g[((j + 1) % cells) * cells + (i % cells)], d = g[((j + 1) % cells) * cells + ((i + 1) % cells)];
      out[y * n + x] = (a * (1 - sm(fx)) + b * sm(fx)) * (1 - sm(fy)) + (c * (1 - sm(fx)) + d * sm(fx)) * sm(fy);
    }
    return out;
  };
  const o1 = oct(4), o2 = oct(8), o3 = oct(16), out = new Float32Array(n * n);
  for (let i = 0; i < out.length; i++) out[i] = o1[i] * 0.55 + o2[i] * 0.3 + o3[i] * 0.15;
  return { n, data: out };
}
const NOISE = noiseTexture();

// ---------------------------------------------------------------- a field canvas (one MapLibre canvas source)
// Rows are laid out in Web Mercator, so the image drapes onto the map without the north-south stretch a plain
// lon/lat image would have. Each render samples the field at (x, y, t) with bilinear space and linear time
// interpolation and maps it through the ramp; cloud and rain get a drifting noise texture so they read as
// weather rather than as a smooth gradient. Fast path: the grid cell and weights of every pixel are computed once,
// the ramp is a 1024-entry table of packed RGBA, and pixels are written as 32-bit words.
const LUTS = new Map();
function lut(R) {
  if (LUTS.has(R)) return LUTS.get(R);
  const [lo, hi] = R.domain, n = 1024, t = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const c = R.fn(lo + (hi - lo) * i / (n - 1));
    t[i] = c && c[3] ? ((c[3] & 255) << 24 | (c[2] & 255) << 16 | (c[1] & 255) << 8 | (c[0] & 255)) >>> 0 : 0;
  }
  const o = { t, lo, k: (n - 1) / (hi - lo), n };
  LUTS.set(R, o);
  return o;
}
export class FieldCanvas {
  constructor(bbox, width = 520) {
    const [w, s, e, n] = bbox;
    this.bbox = bbox;
    const my0 = MERC(s), my1 = MERC(n), mxSpan = (e - w) * Math.PI / 180;
    const height = Math.max(64, Math.round(width * (my1 - my0) / mxSpan));
    this.canvas = document.createElement('canvas');
    this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(width, height);
    this.px = new Uint32Array(this.img.data.buffer);
    this.lon = new Float32Array(width); this.lat = new Float32Array(height);
    for (let x = 0; x < width; x++) this.lon[x] = w + (x + 0.5) / width * (e - w);
    for (let y = 0; y < height; y++) this.lat[y] = UNMERC(my1 - (y + 0.5) / height * (my1 - my0));
    this.coordinates = [[w, n], [e, n], [e, s], [w, s]];
    this.g = null;
  }
  prepare(g) {
    if (this.g && this.g.nx === g.nx && this.g.ny === g.ny && this.g.lon0 === g.lon0 && this.g.lat0 === g.lat0 && this.g.dlon === g.dlon) return;
    this.g = g;
    const W = this.canvas.width, H = this.canvas.height;
    this.ix = new Int32Array(W); this.fx = new Float32Array(W); this.iy = new Int32Array(H); this.fy = new Float32Array(H);
    for (let x = 0; x < W; x++) { const gx = (this.lon[x] - g.lon0) / g.dlon; const i = Math.max(0, Math.min(g.nx - 2, Math.floor(gx))); this.ix[x] = gx < 0 || gx > g.nx - 1 ? -1 : i; this.fx[x] = gx - i; }
    for (let y = 0; y < H; y++) { const gy = (this.lat[y] - g.lat0) / g.dlat; const j = Math.max(0, Math.min(g.ny - 2, Math.floor(gy))); this.iy[y] = gy < 0 || gy > g.ny - 1 ? -1 : j; this.fy[y] = gy - j; }
  }
  /* draw var v of field F at fractional frame fi; drift = [dx, dy] noise offset in pixels (animated by the caller) */
  render(F, v, fi, drift = [0, 0]) {
    const R = RAMPS[v], frames = F.vars[v], px = this.px, W = this.canvas.width, H = this.canvas.height, g = F.grid;
    px.fill(0);
    const a = Math.floor(fi), b = Math.min(a + 1, frames ? frames.length - 1 : 0), wt = fi - a;
    const fa = frames && frames[a], fb = (frames && frames[b]) || fa;
    if (!R || !fa) { this.ctx.putImageData(this.img, 0, 0); return; }
    this.prepare(g);
    const L = lut(R), T = L.t, lo = L.lo, k = L.k, top = L.n - 1, nx = g.nx, mix = wt > 0 && fb !== fa, hatch = v === 'gust';
    const textured = v === 'cloud' || v === 'precip', amp = v === 'cloud' ? [0.55, 0.9] : [0.45, 1.1];
    const N = NOISE.n, ND = NOISE.data, ox = drift[0] | 0, oy = drift[1] | 0, ix = this.ix, fxA = this.fx;
    for (let y = 0; y < H; y++) {
      const j = this.iy[y]; if (j < 0) continue;
      const fy = this.fy[y], r0 = j * nx, r1 = r0 + nx, row = y * W, nrow = ((y + oy) & (N - 1)) * N;
      for (let x = 0; x < W; x++) {
        const i = ix[x]; if (i < 0) continue;
        const fx = fxA[x], k00 = r0 + i, k10 = r1 + i;
        let val = (fa[k00] * (1 - fx) + fa[k00 + 1] * fx) * (1 - fy) + (fa[k10] * (1 - fx) + fa[k10 + 1] * fx) * fy;
        if (mix) val = val * (1 - wt) + ((fb[k00] * (1 - fx) + fb[k00 + 1] * fx) * (1 - fy) + (fb[k10] * (1 - fx) + fb[k10 + 1] * fx) * fy) * wt;
        if (val !== val) continue;                  // NaN
        if (textured) val *= amp[0] + amp[1] * ND[nrow + ((x + ox) & (N - 1))];
        // the MEWP band (gust >= 12.5 m/s, EN 280) is hatched: it reads as "do not", not as another shade
        if (hatch && val >= 12.5 && ((x + y) & 7) > 3) continue;
        let q = ((val - lo) * k) | 0; if (q < 0) q = 0; else if (q > top) q = top;
        px[row + x] = T[q];
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}

// ---------------------------------------------------------------- wind particles (a 2D canvas over the map)
// Particles live in lon/lat and move in screen space with the wind at their place and time, so their speed on the
// screen reads the same at every zoom. The canvas keeps a fading trail; a map move clears it.
export class Particles {
  constructor(map, canvas) {
    this.map = map; this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.list = []; this.F = null; this.fi = 0; this.on = false;
    this.speed = 0.22;   // pixels per frame per m/s
    this.resize();
  }
  resize() {
    const r = window.devicePixelRatio || 1, c = this.map.getCanvas();
    this.canvas.width = c.clientWidth * r; this.canvas.height = c.clientHeight * r;
    this.canvas.style.width = c.clientWidth + 'px'; this.canvas.style.height = c.clientHeight + 'px';
    this.ratio = r; this.clear();
  }
  clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  target() { const c = this.map.getCanvas(); return Math.round(Math.min(2200, Math.max(400, c.clientWidth * c.clientHeight / 950))); }
  spawn(p) {
    const b = this.map.getBounds(), g = this.F.grid;
    const w = Math.max(b.getWest(), g.lon0), e = Math.min(b.getEast(), g.lon0 + g.dlon * (g.nx - 1));
    const s = Math.max(b.getSouth(), g.lat0), n = Math.min(b.getNorth(), g.lat0 + g.dlat * (g.ny - 1));
    if (w >= e || s >= n) { p.dead = true; return p; }
    p.lon = w + Math.random() * (e - w); p.lat = s + Math.random() * (n - s); p.age = Math.random() * 80 | 0; p.max = 60 + (Math.random() * 60 | 0); p.dead = false;
    return p;
  }
  set(F, fi) { this.F = F; this.fi = fi; }
  step() {
    if (!this.on || !this.F || !this.F.vars.u) return;
    const ctx = this.ctx, r = this.ratio, m = this.map;
    const want = this.target();
    while (this.list.length < want) this.list.push(this.spawn({}));
    if (this.list.length > want) this.list.length = want;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.93)'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.3 * r; ctx.lineCap = 'round';
    const buckets = [[], [], [], []];                 // drawn by speed class: one stroke() per colour
    for (const p of this.list) {
      if (p.dead || ++p.age > p.max) { this.spawn(p); continue; }
      const u = sample(this.F, 'u', p.lon, p.lat, this.fi), v = sample(this.F, 'v', p.lon, p.lat, this.fi);
      if (Number.isNaN(u) || Number.isNaN(v)) { this.spawn(p); continue; }
      const a = m.project([p.lon, p.lat]);
      const bx = a.x + u * this.speed, by = a.y - v * this.speed;
      const ll = m.unproject([bx, by]);
      p.lon = ll.lng; p.lat = ll.lat;
      const spd = Math.hypot(u, v);
      buckets[spd < 3 ? 0 : spd < 7 ? 1 : spd < 11 ? 2 : 3].push(a.x * r, a.y * r, bx * r, by * r);
    }
    const COL = ['rgba(31,29,26,.22)', 'rgba(31,29,26,.45)', 'rgba(194,106,18,.8)', 'rgba(176,36,30,.9)'];
    buckets.forEach((seg, k) => {
      if (!seg.length) return;
      ctx.strokeStyle = COL[k]; ctx.beginPath();
      for (let i = 0; i < seg.length; i += 4) { ctx.moveTo(seg[i], seg[i + 1]); ctx.lineTo(seg[i + 2], seg[i + 3]); }
      ctx.stroke();
    });
  }
}

// ---------------------------------------------------------------- small geometry helpers
export function circlePolygon(lon, lat, km, n = 72) {
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const a = i / n * 2 * Math.PI;
    ring.push([lon + km / (111.32 * Math.cos(lat * Math.PI / 180)) * Math.cos(a), lat + km / 110.57 * Math.sin(a)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}
export const compass = d => ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'][Math.round(((d % 360) + 360) % 360 / 45) % 8];
// u/v (towards) -> the direction the wind comes FROM, degrees
export const fromDir = (u, v) => (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
