'use strict';
/* ================= Konnektóm-labor: shared core (WebGL points + lines, orbit camera, picking, UI helpers) */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash32(str, h = 2166136261) { for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
const mix32 = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ b; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };
const fib = (i, N) => { const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), ph = i * Math.PI * (3 - Math.sqrt(5)); return [r * Math.cos(ph), y, r * Math.sin(ph)]; };
const hsl = (h, s, l) => { const k = n => (n + h * 12) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0), f(8), f(4)]; };
const fmt = n => n.toLocaleString('hu-HU');
async function unz(b64) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const out = new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate')));
  return out.arrayBuffer();
}
async function zipStr(s) {
  const buf = await new Response(new Blob([new TextEncoder().encode(s)]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
  let b = '', u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unzipStr(s) {
  s = s.trim().replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return new TextDecoder().decode(await unz(s));
}
const b64of = u8 => { let b = ''; for (let i = 0; i < u8.length; i += 0x8000) b += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(b); };
const u8of = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } },
};

/* ---------- mat4 (column-major) */
const M4 = {
  persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  look(e, c, u) {
    let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], l = Math.hypot(...z); z = z.map(v => v / l);
    let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x) || 1; x = x.map(v => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
};

/* ---------- renderer */
const R = (() => {
  const cv = $('gl'), ov = $('ov'), ctx = ov.getContext('2d');
  const gl = cv.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false });
  if (!gl) { document.body.classList.add('nogl'); }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
  const WOB = `uniform float T; uniform float W;
    vec3 wob(vec3 p){ if(W<=0.)return p; float s=sin(T*1.3+p.y*5.+p.x*3.)*W, c=cos(T*1.1+p.z*4.+p.y*2.)*W; return p+vec3(s,c*.6,s*.8); }`;
  const PV = `precision mediump float; attribute vec3 p; attribute vec3 c; attribute float s; attribute float a;
    uniform mat4 M; uniform float PX; uniform vec3 H; uniform float B; uniform float K; ${WOB}
    varying vec3 vc; varying float va;
    void main(){ vec4 q=M*vec4(wob(p),1.); gl_Position=q; float t=clamp(a,0.,1.5);
      gl_PointSize=clamp(s*PX*(1.+t*1.2)/q.w,1.,64.); vc=mix(c,H,clamp(t,0.,1.)*.9); va=(B+t*1.4)*K; }`;
  const PF = `precision mediump float; varying vec3 vc; varying float va;
    void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d)*4.; if(r>1.)discard; float f=exp(-r*2.6)*(1.-r*.25); gl_FragColor=vec4(vc*va*f,1.); }`;
  const LV = `precision mediump float; attribute vec3 p; attribute vec4 c; uniform mat4 M; uniform float K; ${WOB} varying vec4 vc;
    void main(){ gl_Position=M*vec4(wob(p),1.); vc=vec4(c.rgb,c.a*K); }`;
  const LF = `precision mediump float; varying vec4 vc; void main(){ gl_FragColor=vec4(vc.rgb*vc.a,1.); }`;
  let P, L;
  if (gl) {
    P = prog(PV, PF); L = prog(LV, LF);
    P.loc = { p: gl.getAttribLocation(P, 'p'), c: gl.getAttribLocation(P, 'c'), s: gl.getAttribLocation(P, 's'), a: gl.getAttribLocation(P, 'a') };
    P.u = ['M', 'PX', 'H', 'B', 'K', 'T', 'W'].reduce((o, k) => (o[k] = gl.getUniformLocation(P, k), o), {});
    L.loc = { p: gl.getAttribLocation(L, 'p'), c: gl.getAttribLocation(L, 'c') };
    L.u = ['M', 'K', 'T', 'W'].reduce((o, k) => (o[k] = gl.getUniformLocation(L, k), o), {});
  }
  const buf = () => gl.createBuffer();
  const up = (b, arr, dyn) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); };
  class Points {
    constructor(n) { this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n).fill(1); this.act = new Float32Array(n);
      this.b = gl ? { p: buf(), c: buf(), s: buf(), a: buf() } : null; this.hot = [1, .85, .6]; this.base = .5; this.k = 1; this.wob = 0; this.on = true; this.count = n; }
    upload(which = 'pcsa') { if (!gl) return; if (which.includes('p')) up(this.b.p, this.pos, true); if (which.includes('c')) up(this.b.c, this.col, true); if (which.includes('s')) up(this.b.s, this.size); if (which.includes('a')) up(this.b.a, this.act, true); }
    upAct() { if (!gl) return; gl.bindBuffer(gl.ARRAY_BUFFER, this.b.a); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.act); }
  }
  class Lines {
    constructor(max) { this.max = max; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.n = 0; this.b = gl ? { p: buf(), c: buf() } : null; this.k = 1; this.wob = 0; this.on = true; }
    clear() { this.n = 0; }
    seg(a, b, c, al, c2, al2) { if (this.n + 2 > this.max) return; let i = this.n; this.pos.set(a, i * 3); this.pos.set(b, i * 3 + 3); this.col.set(c, i * 4); this.col[i * 4 + 3] = al; this.col.set(c2 || c, i * 4 + 4); this.col[i * 4 + 7] = al2 == null ? al : al2; this.n += 2; }
    poly(pts, c, al) { for (let i = 1; i < pts.length; i++) this.seg(pts[i - 1], pts[i], c, al); }
    upload() { if (!gl) return; up(this.b.p, this.pos.subarray(0, this.n * 3), true); up(this.b.c, this.col.subarray(0, this.n * 4), true); }
  }
  const cam = { yaw: 0, pitch: 0.1, dist: 3, tgt: [0, 0, 0], fov: 0.8, auto: 0, M: null, W: 1, H: 1, eye: [0, 0, 3] };
  const camTo = { on: false };
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ov.width = cv.width; ov.height = cv.height; cam.W = w; cam.H = h; cam.dpr = dpr;
    const side = document.getElementById('side'), narrow = w <= 760, folded = document.body.classList.contains('folded');
    cam.offX = side && !narrow ? side.offsetWidth + 16 : 0; cam.offY = side && narrow && !folded ? side.offsetHeight + 16 : 0;
  }
  function matrix() {
    const { yaw, pitch, dist, tgt } = cam, cp = Math.cos(pitch);
    cam.eye = [tgt[0] + dist * cp * Math.sin(yaw), tgt[1] + dist * Math.sin(pitch), tgt[2] + dist * cp * Math.cos(yaw)];
    cam.V = M4.look(cam.eye, tgt, [0, 1, 0]); cam.P = M4.persp(cam.fov, cam.W / cam.H, 0.02, 60); cam.M = M4.mul(cam.P, cam.V);
    const off = cam.offX ? -cam.offX / cam.W : 0, offY = cam.offY ? cam.offY / cam.H : 0; if (off || offY) for (let j = 0; j < 4; j++) { cam.M[j * 4] += off * cam.M[j * 4 + 3]; cam.M[j * 4 + 1] += offY * cam.M[j * 4 + 3]; }
  }
  // world -> css px (x, y, w); w <= 0 means behind the camera
  function project(x, y, z) {
    const m = cam.M, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(cx / cw * .5 + .5) * cam.W, (1 - (cy / cw * .5 + .5)) * cam.H, cw];
  }
  function pickPoints(ps, sx, sy, maxd = 14, filt) {
    let best = -1, bd = maxd * maxd; const m = cam.M, pos = ps.pos, W = cam.W, H = cam.H;
    for (let i = 0; i < ps.count; i++) {
      if (filt && !filt(i)) continue;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], cw = m[3] * x + m[7] * y + m[11] * z + m[15]; if (cw <= 0.01) continue;
      const px = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw * .5 + .5) * W - sx, py = (1 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / cw * .5 + .5)) * H - sy, d = px * px + py * py - (cw < cam.dist ? 4 : 0);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function draw(view, t) {
    if (!gl) return;
    matrix();
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(...(view.bg || [0.02, 0.045, 0.065]), 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (const s of view.sets) {
      if (!s.on || s.k <= 0.002) continue;
      if (s instanceof Lines) {
        if (!s.n) continue; gl.useProgram(L); gl.uniformMatrix4fv(L.u.M, false, cam.M); gl.uniform1f(L.u.K, s.k); gl.uniform1f(L.u.T, t); gl.uniform1f(L.u.W, s.wob);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.b.p); gl.enableVertexAttribArray(L.loc.p); gl.vertexAttribPointer(L.loc.p, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.b.c); gl.enableVertexAttribArray(L.loc.c); gl.vertexAttribPointer(L.loc.c, 4, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, s.n);
        gl.disableVertexAttribArray(L.loc.c);
      } else {
        gl.useProgram(P); gl.uniformMatrix4fv(P.u.M, false, cam.M); gl.uniform1f(P.u.PX, cam.dpr * cam.H / 520 * (view.px || 1)); gl.uniform3fv(P.u.H, s.hot); gl.uniform1f(P.u.B, s.base); gl.uniform1f(P.u.K, s.k); gl.uniform1f(P.u.T, t); gl.uniform1f(P.u.W, s.wob);
        const at = (b, l, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); };
        at(s.b.p, P.loc.p, 3); at(s.b.c, P.loc.c, 3); at(s.b.s, P.loc.s, 1); at(s.b.a, P.loc.a, 1);
        gl.drawArrays(gl.POINTS, 0, s.count);
        for (const k of ['c', 's', 'a']) gl.disableVertexAttribArray(P.loc[k]);
      }
    }
  }
  return { gl, cv, ov, ctx, Points, Lines, cam, camTo, resize, matrix, project, pickPoints, draw };
})();

/* ---------- input: orbit / pan / zoom with mouse and touch, tap = pick */
const Input = (() => {
  const cv = R.cv, cam = R.cam, ptr = new Map(); let down = null, moved = false, last = 0, pinch = null, hoverT = 0;
  const H = { onTap: null, onHover: null, onRight: null };
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 1) { down = { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey, t: performance.now() }; moved = false; }
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dist: cam.dist }; moved = true; }
    cam.auto = 0;
  });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    if (!ptr.has(e.pointerId)) { const n = performance.now(); if (H.onHover && n - hoverT > 50) { hoverT = n; H.onHover(e.clientX - r.left, e.clientY - r.top, e); } return; }
    const p = ptr.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 5) moved = true;
    if (ptr.size === 2 && pinch) {
      const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); cam.dist = clamp(pinch.dist * pinch.d / Math.max(10, d), 0.25, 14);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; pan(m[0] - pinch.m[0], m[1] - pinch.m[1]); pinch.m = m; return;
    }
    if (down.b === 2 || down.sh || e.shiftKey) pan(dx, dy);
    else { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.006, -1.5, 1.5); }
  });
  function pan(dx, dy) {
    const s = cam.dist * Math.tan(cam.fov / 2) * 2 / cam.H, cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const right = [cy, 0, -sy], up = [-Math.sin(cam.pitch) * sy, Math.cos(cam.pitch), -Math.sin(cam.pitch) * cy];
    for (let k = 0; k < 3; k++) cam.tgt[k] += (-dx * right[k] + dy * up[k]) * s;
  }
  const end = e => {
    if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null;
    if (ptr.size === 0 && down && !moved) {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
      if (down.b === 2) { H.onRight && H.onRight(x, y, e); }
      else if (now - last < 300 && H.onDouble) { H.onDouble(x, y, e); last = 0; }
      else { H.onTap && H.onTap(x, y, e); last = now; }
    }
    if (ptr.size === 0) down = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 0.25, 14); cam.auto = 0; }, { passive: false });
  return H;
})();

/* ---------- small UI kit for the side panel */
const UI = {
  panel: $('panel'), info: $('info'), read: $('read'), tip: $('tip'),
  set(html) { this.panel.innerHTML = html; },
  slider(id, label, min, max, step, val, fmtv) { return `<label class="sl" for="${id}"><span>${label}</span><b id="${id}-v">${fmtv ? fmtv(val) : val}</b><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`; },
  bind(id, fn, fmtv) { const el = $(id); if (!el) return; const v = $(id + '-v'); el.addEventListener('input', () => { const x = +el.value; if (v) v.textContent = fmtv ? fmtv(x) : x; fn(x); }); },
  chips(id, items, cur) { return `<div class="chips" id="${id}" role="group">${items.map(([k, l]) => `<button type="button" data-k="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`; },
  bindChips(id, fn) { const el = $(id); if (!el) return; el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.k); }); },
  toggle(id, label, on) { return `<label class="tg" for="${id}"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}</span></label>`; },
  bindToggle(id, fn) { const el = $(id); if (el) el.addEventListener('change', () => fn(el.checked)); },
  showTip(x, y, html) { const t = this.tip; if (!html) { t.hidden = true; return; } t.innerHTML = html; t.hidden = false; const w = t.offsetWidth, h = t.offsetHeight; t.style.left = clamp(x + 14, 4, R.cam.W - w - 4) + 'px'; t.style.top = clamp(y + 14, 4, R.cam.H - h - 4) + 'px'; },
  toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(this._tt); this._tt = setTimeout(() => t.hidden = true, 2600); },
};
function legend(items) { return `<div class="lg">${items.map(([c, l, n]) => `<span><i style="background:${c}"></i>${esc(l)}${n != null ? ` <em>${n}</em>` : ''}</span>`).join('')}</div>`; }
function spark(cv, series, opts = {}) {
  const c = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; c.scale(dpr, dpr); c.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  c.strokeStyle = css.getPropertyValue('--line'); c.lineWidth = 1; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, h * i / 4 + .5); c.lineTo(w, h * i / 4 + .5); c.stroke(); }
  for (const s of series) {
    const d = s.data, N = opts.n || d.length; if (d.length < 2) continue; const mx = opts.max || Math.max(1e-6, ...d.filter(v => !isNaN(v)));
    const X = i => i / (N - 1) * w, Y = v => h - 2 - Math.min(1, v / mx) * (h - 6);
    c.beginPath(); let pen = false, li = -1; d.forEach((v, i) => { if (isNaN(v)) { pen = false; return; } pen ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)); pen = true; li = i; });
    c.strokeStyle = s.col; c.lineWidth = s.w || 1.5; c.setLineDash(s.dash || []); c.stroke(); c.setLineDash([]);
    if (s.fill && li > 0 && !d.some(isNaN)) { c.lineTo(X(li), h); c.lineTo(0, h); c.closePath(); c.globalAlpha = .14; c.fillStyle = s.col; c.fill(); c.globalAlpha = 1; }
    if (li >= 0) { c.fillStyle = s.col; c.beginPath(); c.arc(X(li), Y(d[li]), 2.5, 0, 7); c.fill(); }
  }
}
function label(c, text, p, col) {
  const [x, y, w] = R.project(p[0], p[1], p[2]); if (w <= 0 || x < -50 || y < -20 || x > R.cam.W + 50 || y > R.cam.H + 20) return;
  const d = R.cam.dpr; c.save(); c.scale(d, d);
  c.font = `11px ${MONO}`; c.lineWidth = 3; c.strokeStyle = 'rgba(6,14,20,.85)'; c.fillStyle = col || 'rgba(214,224,232,.86)';
  c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); c.strokeText(text, x + 6, y - 5); c.fillText(text, x + 6, y - 5); c.restore();
}
const MONO = '"IBM Plex Mono", "Cascadia Mono", Consolas, ui-monospace, monospace';
