/* Varler divergence ring. Canvas 2D, no dependencies. Generative: every stratum is computed live
   around the real bulb outline. VarlerDivergence.mount(canvas, opts) -> { set(opts), replay(), destroy(), points() }
   Two forms share every stratum, event and glow: form 'logo' (the bulb outline + mark) and form 'ring'
   (the original divergence ring, a full circle with a thin bright band). morph 0..1 overrides form:
   0 = ring, 1 = logo; every sample has the same index in both, so any value in between is a valid shape. */
var VIEWS = { full: [-110, -150, 1220, 1220], mark: [130, -70, 740, 740], icon: [200, 44, 600, 600] };
var RC = 187.26, RING_W = 8; // the ring form: the globe circle of the logo, and its band width
var THEMES = {
  dark:  { bg: '#16181A', eclipse: '#030405', logo: '#F4FAFC', word: '#D6E4EA', ink: [226, 236, 241], hot: [255, 255, 255], low: [176, 190, 198], blend: 'lighter' },
  light: { bg: '#E9EDEF', eclipse: '#FFFFFF', logo: '#000000', word: '#000000', ink: [70, 84, 94], hot: [0, 0, 0], low: [176, 188, 195], blend: 'source-over' }
};
var LAYERS = 7, LOOP = 40; // seconds; every time term below is a whole harmonic of the loop, so it is seamless
var TAU = Math.PI * 2, DEG = Math.PI / 180;
var TH0 = -158, TH1 = 91, STEP = 0.5, N = Math.round((TH1 - TH0) / STEP) + 1; // ring span, degrees clockwise from top
var EVENTS = [ // one per divergence: centre, wander, width, rate, phase, weight
  { c: -8,  d: 16, s: 24, n: 1, p: 0.05, a: 1.0,  rc: -20 }, // rc: where the event sits on the full ring
  { c: 46,  d: 12, s: 20, n: 2, p: 0.55, a: 0.82, rc: 72 },
  { c: -62, d: 15, s: 22, n: 1, p: 0.52, a: 0.92, rc: -118 },
  { c: 24,  d: 20, s: 15, n: 3, p: 0.30, a: 0.55, rc: 158 },
  { c: -104, d: 9, s: 16, n: 2, p: 0.15, a: 0.6,  rc: 118 },
  { c: -34, d: 22, s: 12, n: 3, p: 0.75, a: 0.5,  rc: -66 }
];
var perm = new Uint8Array(512);
(function () { var s = 20261102, p = [], i, j, k; for (i = 0; i < 256; i++) p[i] = i; for (i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; j = s % (i + 1); k = p[i]; p[i] = p[j]; p[j] = k; } for (i = 0; i < 512; i++) perm[i] = p[i & 255]; })();
function fade(x) { return x * x * (3 - 2 * x); }
function sstep(a, b, x) { x = (x - a) / (b - a); return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }
function rnd(x, y, z) { return perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255; }
function noise3(x, y, z) {
  var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  function l(a, b, t) { return a + (b - a) * t; }
  return l(l(l(rnd(xi, yi, zi), rnd(xi + 1, yi, zi), u), l(rnd(xi, yi + 1, zi), rnd(xi + 1, yi + 1, zi), u), v),
           l(l(rnd(xi, yi, zi + 1), rnd(xi + 1, yi, zi + 1), u), l(rnd(xi, yi + 1, zi + 1), rnd(xi + 1, yi + 1, zi + 1), u), v), w);
}
function ridged(x, y, z) { // sharp crests, the mountain-range edge of a stratum
  var f = 1, a = 0.56, s = 0, i, n;
  for (i = 0; i < 4; i++) { n = 1 - Math.abs(noise3(x * f, y * f + i * 7.1, z * f + i * 3.3) * 2 - 1); s += n * n * a; f *= 2.15; a *= 0.56; }
  return s;
}
function radius(i) { var v = (i * STEP + TH0 + 180) * 2; var k = Math.floor(v), f = v - k; return LUT[k % 720] + (LUT[(k + 1) % 720] - LUT[k % 720]) * f; }
function wrap(a) { a = (a + 180) % 360; return (a < 0 ? a + 360 : a) - 180; }
function per(th, fn) { // angle-periodic noise: past 150 deg it fades into its own value one turn back, so a full ring has no seam
  return th <= 150 ? fn(th) : fn(th) + (fn(th - 360) - fn(th)) * sstep(150, 180, th);
}
function mix(a, b, t) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; }

function mount(canvas, opts) {
  var o = { theme: 'dark', lockup: 'full', amp: 1, speed: 1, glow: 1, intro: true, still: null, mark: 'orig', ring: true, form: 'logo', morph: null, events: null };
  var ctx = canvas.getContext('2d'), raf = 0, visible = true, start = 0, clock = 0, last = 0, W = 0, H = 0, S = 1, dead = false;
  var tips = [], mat = null, dpr = 1, cache = {}, layer = document.createElement('canvas'), lc = layer.getContext('2d'), soft = document.createElement('canvas'), softer = document.createElement('canvas'), sc = soft.getContext('2d'), wc = softer.getContext('2d');
  var P = { bulb: new Path2D(DATA.bulb), leaf: new Path2D(DATA.leaf), base: new Path2D(DATA.base), word: new Path2D(DATA.word) };
  var TH = new Float32Array(N), R = new Float32Array(N), X = new Float32Array(N), Y = new Float32Array(N), hs = [], env = new Float32Array(N), i, j, M = -1;
  for (j = 0; j < LAYERS; j++) hs.push(new Float32Array(N));
  function shape(m) { // m 1 = the bulb outline, 0 = the full circle; sample i is the same point of the ring in both
    M = m;
    for (var i = 0; i < N; i++) {
      var tl = TH0 + i * STEP, tr = -180 + i * 360 / (N - 1), th = tr + (tl - tr) * m;
      TH[i] = th; R[i] = RC + (radius(i) - RC) * m; X[i] = Math.sin(th * DEG); Y[i] = -Math.cos(th * DEG);
      // the logo's ring only breathes where it is a free arc; it dies into the neck and into the open end by the leaf,
      // and the top of the bulb gets the most. The full ring breathes all round.
      var el = sstep(TH0 + 2, -116, tl) * (1 - sstep(62, 89, tl)) * (0.5 + 0.5 * Math.cos(tl * 0.85 * DEG));
      env[i] = 0.9 + (el - 0.9) * m;
    }
  }
  function morph() { return o.morph != null ? Math.max(0, Math.min(1, o.morph)) : o.form === 'ring' ? 0 : 1; }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function size() {
    var r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || r.width, h = canvas.clientHeight || r.height;
    dpr = d; W = Math.max(2, Math.round(w * d)); H = Math.max(2, Math.round(h * d));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    layer.width = W; layer.height = H;
    soft.width = Math.ceil(W / 5); soft.height = Math.ceil(H / 5);
    softer.width = Math.ceil(W / 18); softer.height = Math.ceil(H / 18);
  }
  function view(c, cw) { // map logo units onto a canvas of width cw, centred; the ring form centres on its circle
    var v = VIEWS[o.lockup] || VIEWS.full, cH = c.canvas.height, s = Math.min(cw / v[2], cH / v[3]);
    var dy = o.lockup !== 'full' ? (1 - M) * (DATA.cy - v[1] - v[3] / 2) : 0;
    c.setTransform(s, 0, 0, s, (cw - v[2] * s) / 2 - v[0] * s, (cH - v[3] * s) / 2 - (v[1] + dy) * s);
    return s;
  }
  function field(t, front) {
    var best = 0, bestA = 0, i, k, e, l;
    var F = new Float32Array(N);
    var q = [];
    var EV = o.events || EVENTS; // o.events: caller-placed divergences (a board's signals); hold = never fades out
    for (k = 0; k < EV.length; k++) {
      e = EV[k];
      var n1 = e.n || 1, p1 = e.p || 0, a = 0.5 + 0.5 * Math.sin(TAU * (t * n1 + p1)); a = a * a * a * (3 - 2 * a);
      a = e.hold ? e.a * (0.8 + 0.2 * a) : a * e.a;
      q.push({ c: e.rc + ((e.c != null ? e.c : e.rc) - e.rc) * M + (e.d || 0) * Math.sin(TAU * (t + p1 * 2)), s: e.s, a: a });
    }
    tips = q;
    for (i = 0; i < N; i++) {
      var th = TH[i], f = 0;
      for (k = 0; k < q.length; k++) { var d = Math.abs(wrap(th - q[k].c)) / q[k].s; f = Math.max(f, q[k].a * Math.exp(-Math.pow(d, 1.35) * 1.5)); }
      F[i] = f;
      var v = f * env[i]; if (v > best) { best = v; bestA = th; }
    }
    var cx = Math.cos(TAU * t), sx = Math.sin(TAU * t);
    for (l = 0; l < LAYERS; l++) {
      var lf = l / (LAYERS - 1), arr = hs[l], up = hs[l - 1], freq = 5.5 + l * 1.7;
      for (i = 0; i < N; i++) {
        var th2 = TH[i], n = per(th2, function (a) { return ridged(a * DEG * freq + l * 5.3, cx * 1.05 + l, sx * 1.05); });
        var rev = 1 - sstep(front - 26, front, th2);
        if (!l) { // the rear stratum sets the silhouette, each one in front is a jagged fraction of it
          var calm = (4 + 9 * n + (1 - M) * (7 + 13 * n)) * Math.min(1, env[i] * 2.4); // the full ring keeps a standing band all round
          arr[i] = (calm * Math.min(1, o.amp * 1.1) + 114 * o.amp * Math.pow(F[i], 1.15) * env[i] * (0.5 + 0.85 * n)) * rev;
        } else arr[i] = up[i] * (0.56 + 0.34 * n);
      }
    }
    return bestA;
  }
  function edge(c, arr, cx, cy, grow) {
    for (var i = 0; i < N; i++) { var r = R[i] + arr[i] + (grow || 0); c.lineTo(cx + X[i] * r, cy + Y[i] * r); }
  }
  function close(c, cx, cy, inset) {
    for (var i = N - 1; i >= 0; i--) { var r = R[i] - inset; c.lineTo(cx + X[i] * r, cy + Y[i] * r); }
    c.closePath();
  }
  function fan(c, cx, cy, a0, a1) { // wedge clip for the ring drawing itself on
    c.beginPath(); c.moveTo(cx, cy);
    for (var a = a0; a <= a1 + 0.01; a += 4) c.lineTo(cx + Math.sin(a * DEG) * 900, cy - Math.cos(a * DEG) * 900);
    c.closePath();
  }
  function draw(ms) {
    if (dead) return;
    var T = THEMES[o.theme] || THEMES.dark, cx = DATA.cx, cy = DATA.cy, intro = o.intro && o.still == null && !reduce;
    var age = intro ? (ms - start) / 1000 : 99, d = Math.max(0, Math.min(0.1, (ms - last) / 1000)); last = ms;
    clock += d * o.speed;
    var t = o.still != null ? o.still : (reduce ? 0.21 : 0.13 + clock / LOOP) % 1;
    var ramp = sstep(0, 2.4, age), front = -190 + ramp * 340, sweep = -180 + ramp * 400;
    var grow = sstep(1.2, 3.8, age);
    var m = morph(); if (m !== M) shape(m);
    var keep = o.amp; o.amp = keep * (0.04 + 0.96 * grow);
    var bestA = field(t, front); o.amp = keep;
    var i, l, H0 = hs[0], s;
    tips = tips.map(function (e) { // where each divergence peaks, for callouts and hit tests
      var b = 0, bd = 1e9; for (var k = 0; k < N; k++) { var dd = Math.abs(wrap(TH[k] - e.c)); if (dd < bd) { bd = dd; b = k; } }
      var r = R[b] + H0[b]; return { angle: e.c, level: e.a, ux: DATA.cx + X[b] * r, uy: DATA.cy + Y[b] * r, bx: DATA.cx + X[b] * R[b], by: DATA.cy + Y[b] * R[b] };
    });

    // eclipse: the bulb interior is the black disc, darker than the ground
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    s = view(ctx, W); mat = ctx.getTransform();
    if (o.ring) {
    ctx.beginPath(); for (i = 0; i < 720; i++) { var a = (i / 2 - 180) * DEG, r = RC + (LUT[i] - RC) * m - 4; ctx.lineTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r); } ctx.closePath();
    ctx.globalAlpha = sstep(0, 1.4, age); ctx.fillStyle = T.eclipse; ctx.fill(); ctx.globalAlpha = 1;

    // bloom source, low resolution: silhouette, a hot crescent turned toward the strongest divergence, faint rays
    sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, soft.width, soft.height);
    view(sc, soft.width);
    var ink = mix(T.hot, T.hot, 0); sc.imageSmoothingEnabled = true;
    sc.fillStyle = ink; sc.strokeStyle = ink; sc.lineCap = 'round';
    sc.save(); fan(sc, cx, cy, -180, sweep); sc.clip();
    sc.beginPath(); edge(sc, H0, cx, cy); close(sc, cx, cy, 2); sc.globalAlpha = 0.8; sc.fill();
    var rw = o.mark !== 'orig' && DATA.marks[o.mark] ? DATA.marks[o.mark].rw : 24; rw = RING_W + (rw - RING_W) * m;
    sc.lineWidth = rw; sc.lineJoin = 'round'; sc.globalAlpha = 0.25 + 0.3 * Math.min(1, rw / 18); sc.beginPath(); // the arc glows; neck and leaf stay clean
    var g0 = Math.round(60 * m), g1 = N - 1 - Math.round(16 * m);
    for (i = g0; i <= g1; i = i < g1 && i + 4 > g1 ? g1 : i + 4) { var ra = R[i] - rw / 2; sc.lineTo(cx + X[i] * ra, cy + Y[i] * ra); } sc.stroke();
    for (i = 0; i < N - 8; i += 8) {
      var w = Math.max(0, Math.cos(wrap(TH[i] - bestA) * DEG * 1.05)); w = w * w * w * ramp;
      if (w < 0.01) continue;
      for (var ri = 0; ri < 2; ri++) { // inner crescent eats into the eclipse, outer flare lifts off the ring
        var r0 = R[i] - (ri ? 0 : 25), r1 = R[i + 8] - (ri ? 0 : 25);
        sc.globalAlpha = ri ? w * 0.7 : w * 0.6; sc.lineWidth = 8 + (ri ? 24 : 16) * w;
        sc.beginPath(); sc.moveTo(cx + X[i] * r0, cy + Y[i] * r0); sc.lineTo(cx + X[i + 8] * r1, cy + Y[i + 8] * r1); sc.stroke();
      }
    }
    sc.lineWidth = 1;
    for (i = 0; i < N; i += 3) {
      var nr = noise3(i * 0.19, Math.cos(TAU * t) * 1.4, Math.sin(TAU * t) * 1.4), rl = (14 + 74 * nr * nr) * env[i] * (0.3 + H0[i] / 70) * grow;
      if (rl < 4) continue;
      var r2 = R[i] + H0[i] * 0.7;
      sc.globalAlpha = 0.38 * nr;
      sc.beginPath(); sc.moveTo(cx + X[i] * r2, cy + Y[i] * r2); sc.lineTo(cx + X[i] * (r2 + rl), cy + Y[i] * (r2 + rl)); sc.stroke();
    }
    sc.restore(); sc.globalAlpha = 1;
    wc.setTransform(1, 0, 0, 1, 0, 0); wc.clearRect(0, 0, softer.width, softer.height);
    wc.imageSmoothingEnabled = true; wc.imageSmoothingQuality = 'high'; wc.drawImage(soft, 0, 0, softer.width, softer.height);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = T.blend;
    var bl = o.theme === 'light' ? 0.55 : 1;
    ctx.globalAlpha = Math.min(1, 1 * o.glow * bl); ctx.drawImage(softer, 0, 0, W, H); ctx.drawImage(softer, 0, 0, W, H);
    ctx.globalAlpha = Math.min(1, 0.55 * o.glow * bl); ctx.drawImage(soft, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    view(ctx, W);

    // strata, back to front, each one a tone step closer to the hot ring
    ctx.save(); fan(ctx, cx, cy, -180, sweep); ctx.clip();
    ctx.lineJoin = 'round';
    for (l = 0; l < LAYERS; l++) {
      var lf = l / (LAYERS - 1);
      ctx.beginPath(); edge(ctx, hs[l], cx, cy); close(ctx, cx, cy, 2);
      ctx.fillStyle = mix(T.low, T.ink, Math.pow(lf, 1.1)); ctx.fill();
      if (l === LAYERS - 1) { ctx.fillStyle = mix(T.ink, T.hot, 0.8); ctx.fill(); }
      // fold shadow: a thin dark crease just inside the next edge up
      if (l) { ctx.beginPath(); for (i = 0; i < N; i++) { var rf = R[i] + hs[l][i] + Math.min(1.2, hs[l][i] * 0.12); ctx.lineTo(cx + X[i] * rf, cy + Y[i] * rf); } for (i = N - 1; i >= 0; i--) { var rr = R[i] + hs[l][i]; ctx.lineTo(cx + X[i] * rr, cy + Y[i] * rr); } ctx.closePath(); ctx.fillStyle = T.eclipse; ctx.globalAlpha = 0.2; ctx.fill(); ctx.globalAlpha = 1; }
    }
    // shading rings: slow wobbling contour lines cut across the strata
    ctx.save(); ctx.beginPath(); edge(ctx, H0, cx, cy); close(ctx, cx, cy, 0); ctx.clip();
    ctx.strokeStyle = T.eclipse; ctx.lineWidth = 0.9;
    for (l = 0; l < 3; l++) {
      ctx.globalAlpha = 0.34 - l * 0.07; ctx.beginPath();
      for (i = 0; i < N; i += 2) {
        var off = 13 + l * 21 + 5 * (per(TH[i], function (a) { return noise3((a - TH0) * 0.032 + l * 4, Math.cos(TAU * t) * 0.8, Math.sin(TAU * t) * 0.8); }) - 0.5) * 2.4, r3 = R[i] + off;
        ctx.lineTo(cx + X[i] * r3, cy + Y[i] * r3);
      }
      ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.restore();

    }
    // the mark: one layer, so cuts erase only the mark and never what lies under it
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1; lc.clearRect(0, 0, W, H);
    view(lc, W);
    var ops = markOps(o.mark), fa = sstep(1.4, 2.4, age);
    lc.fillStyle = T.logo; lc.strokeStyle = T.logo;
    for (i = 0; i < ops.length; i++) {
      var op = ops[i], cut = op.op === 'cut' || op.op === 'cutstroke';
      lc.save();
      if (op.g === 'bulb' && sweep < 220) { fan(lc, cx, cy, -180, sweep); lc.clip(); }
      if (op.g !== 'bulb' && !cut) lc.globalAlpha = fa;
      lc.globalCompositeOperation = cut ? 'destination-out' : 'source-over';
      if (op.op === 'fill' || op.op === 'cut') lc.fill(op.p, op.rule || 'nonzero');
      else { lc.lineWidth = op.w; lc.lineCap = op.cap || 'butt'; lc.lineJoin = op.join || 'miter'; lc.stroke(op.p); }
      lc.restore();
    }
    if (o.lockup === 'full' && o.mark === 'orig') { lc.globalAlpha = sstep(2.2, 3.4, age); lc.fillStyle = T.word; lc.fill(P.word, 'evenodd'); lc.globalAlpha = 1; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = m; if (m > 0) ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1;
    if (m < 1) { // the ring form's own band: the same samples as the strata, so it bends into the bulb as m rises
      view(ctx, W); ctx.save();
      if (sweep < 220) { fan(ctx, cx, cy, -180, sweep); ctx.clip(); }
      ctx.globalAlpha = 1 - m; ctx.strokeStyle = T.logo; ctx.lineWidth = RING_W; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); for (i = 0; i < N; i++) { var rb = R[i] - RING_W / 2; ctx.lineTo(cx + X[i] * rb, cy + Y[i] * rb); }
      if (m === 0) ctx.closePath(); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  function markOps(k) {
    if (cache[k]) return cache[k];
    var src = k !== 'orig' && DATA.marks[k] ? DATA.marks[k].ops : [{ op: 'fill', d: DATA.bulb, g: 'bulb', rule: 'evenodd' }, { op: 'fill', d: DATA.leaf, g: 'leaf', rule: 'evenodd' }, { op: 'fill', d: DATA.base, g: 'base', rule: 'evenodd' }];
    return (cache[k] = src.map(function (x) { var y = {}; for (var q in x) y[q] = x[q]; y.p = new Path2D(x.d); return y; }));
  }
  function tick(ms) { raf = 0; if (dead) return; if (visible) draw(ms); schedule(); }
  function schedule() { if (!raf && !dead && !reduce && o.still == null && o.ring) raf = requestAnimationFrame(tick); }
  var ro = window.ResizeObserver ? new ResizeObserver(function () { size(); var i = o.intro; o.intro = false; clock += 0; draw(performance.now()); o.intro = i; }) : null;
  if (ro) ro.observe(canvas);
  var io = window.IntersectionObserver ? new IntersectionObserver(function (e) { visible = e[e.length - 1].isIntersecting; }) : null;
  if (io) io.observe(canvas);
  var api = {
    set: function (n) { var was = o.intro; for (var k in n) if (n[k] != null || k === 'still') o[k] = n[k]; size(); if (n.intro && !was) start = performance.now(); if (reduce || o.still != null) draw(performance.now()); else schedule(); },
    replay: function () { o.intro = true; start = performance.now(); schedule(); },
    points: function () { // CSS px within the canvas: tip = the top of the peak, base = where it leaves the ring
      if (!mat) return [];
      return tips.map(function (p) {
        var a = mat.transformPoint({ x: p.ux, y: p.uy }), b = mat.transformPoint({ x: p.bx, y: p.by });
        return { angle: p.angle, level: p.level, x: a.x / dpr, y: a.y / dpr, baseX: b.x / dpr, baseY: b.y / dpr };
      });
    },
    destroy: function () { dead = true; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect(); }
  };
  for (var k in opts || {}) if (opts[k] != null) o[k] = opts[k];
  size(); last = start = performance.now();
  var wi = o.intro; o.intro = false; draw(last); o.intro = wi; // a finished frame first, for thumbnails and stalled tabs
  schedule();
  return api;
}
window.VarlerDivergence = { mount: mount };
