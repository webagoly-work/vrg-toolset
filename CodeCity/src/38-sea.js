// 38-sea.js — Mélyvíz (CITY-D26): the deep-water ground under the city. The CSS night sky is replaced by a ripple
// field on its own WebGL2 canvas (#sea, behind the transparent city canvas) that refracts a faint drafting grid.
// Rules it keeps:
// - R3 one animation, one meaning: the water moves only when YOU click empty water (a plain left click that hits no
//   building or plate). No rain, no idle motion — a wave means "you touched the ground here".
// - R11 render on demand: the simulation runs only while a wave is alive (~5 s after the last click), then draws one
//   final frame and stops. A quiet city costs nothing, as before. The wallpaper gets one still frame.
// - the look follows the lens: the water's horizon is the lens's fog colour, its highlights are the instrument's ice
//   (Alap, Tulaj, Nyelv) or the lens's own window light (Hő, Kor, Ügynök).
// - #mode=overlay: no water (the desktop is the ground), as the sky was transparent there.
// No WebGL2 / half-float targets: the canvas stays hidden and the CSS gradient in city.css shows instead.
// The style source: the Mélyvíz style lab (VRG dev-side style, 2026-10-27), docs/city/melyviz.md.

const SEA_ICE = 0x93d3e6;
const sea = (() => {
  const cv = document.getElementById('sea');
  if (!cv || KV_OVERLAY) { if (cv) cv.hidden = true; return null; }
  let gl = null;
  try { gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (e) {}
  if (!gl) { cv.hidden = true; return null; }
  gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_color_buffer_half_float');
  const VS = `#version 300 es
out vec2 vUv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const SIM = `#version 300 es
precision highp float;uniform sampler2D uS;uniform vec2 uTx;uniform float uDamp,uAsp;uniform vec4 uD[8];uniform int uN;in vec2 vUv;out vec4 o;
void main(){vec4 c=texture(uS,vUv);
float avg=(texture(uS,vUv+vec2(uTx.x,0.)).r+texture(uS,vUv-vec2(uTx.x,0.)).r+texture(uS,vUv+vec2(0.,uTx.y)).r+texture(uS,vUv-vec2(0.,uTx.y)).r)*.25;
c.g+=(avg-c.r)*2.;c.g*=uDamp;c.r+=c.g;c.r*=.998;
for(int i=0;i<8;i++){if(i>=uN)break;vec4 d=uD[i];vec2 q=(vUv-d.xy)*vec2(uAsp,1.);float k=max(0.,1.-length(q)/d.z);k=.5-cos(k*3.14159265)*.5;c.r+=k*d.w;}
o=c;}`;
  // the ground: horizon colour at ~70 % height, deep water above and below, a grid that fades towards the top (far),
  // refracted by the wave normals; light from the upper left adds the highlight colour on the wave fronts
  const REN = `#version 300 es
precision highp float;uniform sampler2D uS;uniform vec2 uTx;uniform vec3 uHor,uDeep,uLine,uHi;uniform float uLA,uCell,uGlow,uDpr;in vec2 vUv;out vec4 o;
void main(){vec2 uv=vUv;
float hx=texture(uS,uv+vec2(uTx.x,0.)).r-texture(uS,uv-vec2(uTx.x,0.)).r;
float hy=texture(uS,uv+vec2(0.,uTx.y)).r-texture(uS,uv-vec2(0.,uTx.y)).r;
vec3 n=normalize(vec3(-hx*5.,-hy*5.,1.));
vec2 px=gl_FragCoord.xy+n.xy*60.*uDpr;
float y=uv.y;
vec3 col=mix(uDeep,uHor,smoothstep(.0,.3,y));
col=mix(col,uDeep*.55,smoothstep(.32,1.,y));
float cell=uCell*uDpr;vec2 f=abs(fract(px/cell+.5)-.5)*cell;float ln=1.-smoothstep(0.,uDpr,min(f.x,f.y));
float C4=cell*4.;vec2 F=abs(fract(px/C4+.5)-.5)*C4;float mj=1.-smoothstep(0.,1.2*uDpr,min(F.x,F.y));
float cr=mj*step(max(F.x,F.y),6.*uDpr);
float far=1.-smoothstep(.25,.95,y);
col=mix(col,uLine,clamp((ln*.4+mj*.3+cr*1.1)*uLA*far,0.,1.));
vec3 L=normalize(vec3(-.35,.55,1.));float sh=dot(n,L)-L.z;vec3 H=normalize(L+vec3(0.,0.,1.));float sp=pow(max(dot(n,H),0.),140.);
float e=.35+uGlow*.95;
col+=uHi*(max(sh,0.)*2.4*e+sp*1.4*e);col*=1.-clamp(-sh,0.,1.)*.9;
o=vec4(col,1.);}`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(fs) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name.replace('[0]', '')] = gl.getUniformLocation(p, inf.name); }
    return { p, u };
  }
  const S = { gl, cv, drops: [], live: 0, running: false, ok: true, tex: null, fb: null, sw: 0, sh: 0, cur: 0, dpr: 1,
    hor: [0, 0, 0], deep: [0, 0, 0], line: [0.91, 0.94, 0.96], hi: [0, 0, 0], glow: 0.2, cell: 44 };
  try { S.sim = prog(SIM); S.ren = prog(REN); S.vao = gl.createVertexArray(); }
  catch (e) { console.warn('38-sea:', e); cv.hidden = true; return null; }
  return S;
})();

function seaTargets() {
  const gl = sea.gl, w = Math.max(1, sea.cv.clientWidth), h = Math.max(1, sea.cv.clientHeight);
  const sw = Math.min(512, Math.max(96, Math.round(w / 3))), shh = Math.max(64, Math.round(sw * h / w));
  if (sea.tex && sw === sea.sw && shh === sea.sh) return;
  if (sea.tex) { sea.tex.forEach(t => gl.deleteTexture(t)); sea.fb.forEach(f => gl.deleteFramebuffer(f)); }
  sea.tex = []; sea.fb = []; sea.sw = sw; sea.sh = shh;
  for (let i = 0; i < 2; i++) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, sw, shh, 0, gl.RGBA, gl.HALF_FLOAT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) sea.ok = false;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    sea.tex.push(t); sea.fb.push(f);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); sea.cur = 0;
  if (!sea.ok) { sea.cv.hidden = true; }
}

function seaSize() {
  if (!sea || !sea.ok) return;
  sea.dpr = Math.min(1, devicePixelRatio || 1);   // a soft background: never above 1, the city canvas carries the detail
  sea.cv.width = Math.max(1, Math.round(sea.cv.clientWidth * sea.dpr));
  sea.cv.height = Math.max(1, Math.round(sea.cv.clientHeight * sea.dpr));
  seaTargets();
  seaDraw();
}

function seaStep() {
  const gl = sea.gl, u = sea.sim.u;
  gl.bindVertexArray(sea.vao); gl.viewport(0, 0, sea.sw, sea.sh); gl.useProgram(sea.sim.p);
  gl.uniform2f(u.uTx, 1 / sea.sw, 1 / sea.sh); gl.uniform1f(u.uDamp, 0.985); gl.uniform1f(u.uAsp, sea.sw / sea.sh);
  for (let s = 0; s < 2; s++) {
    const flat = new Float32Array(32), n = s === 0 ? Math.min(8, sea.drops.length) : 0;
    for (let i = 0; i < n; i++) flat.set(sea.drops[i], i * 4);
    gl.uniform4fv(u.uD, flat); gl.uniform1i(u.uN, n);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sea.tex[sea.cur]); gl.uniform1i(u.uS, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sea.fb[1 - sea.cur]); gl.drawArrays(gl.TRIANGLES, 0, 3); sea.cur = 1 - sea.cur;
  }
  sea.drops.length = 0;
}

function seaDraw() {
  if (!sea || !sea.ok || !sea.tex) return;
  const gl = sea.gl, r = sea.ren.u;
  gl.bindVertexArray(sea.vao);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, sea.cv.width, sea.cv.height); gl.useProgram(sea.ren.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sea.tex[sea.cur]); gl.uniform1i(r.uS, 0);
  gl.uniform2f(r.uTx, 1 / sea.sw, 1 / sea.sh);
  gl.uniform3fv(r.uHor, sea.hor); gl.uniform3fv(r.uDeep, sea.deep); gl.uniform3fv(r.uLine, sea.line); gl.uniform3fv(r.uHi, sea.hi);
  gl.uniform1f(r.uLA, 0.11); gl.uniform1f(r.uCell, sea.cell); gl.uniform1f(r.uGlow, lookGlow(sea.glow)); gl.uniform1f(r.uDpr, sea.dpr);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function seaLoop() {
  if (!sea.live) { sea.running = false; seaDraw(); return; }
  sea.live--;
  seaStep(); seaDraw();
  requestAnimationFrame(seaLoop);
}

// a wave at a point of the stage (client pixels); r and s in the field's units (r = share of its height)
function seaDrop(clientX, clientY, r = 0.05, s = 0.9) {
  if (!sea || !sea.ok || KV_WALL) return;
  const b = sea.cv.getBoundingClientRect();
  if (sea.drops.length < 8) sea.drops.push([(clientX - b.left) / b.width, 1 - (clientY - b.top) / b.height, r, s]);
  sea.live = seaReduced() ? 1 : 300;   // ~5 s at 60 fps, then one last frame and stop
  if (!sea.running) { sea.running = true; requestAnimationFrame(seaLoop); }
}
function seaReduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

// 07-lens calls this: the water takes the lens's horizon and its highlight colour
function seaLens(l) {
  if (!sea || !sea.ok) return;
  const c = new THREE.Color(l.horizon), d = c.clone().multiplyScalar(0.42);
  const hi = new THREE.Color(['alap', 'tulaj', 'nyelv'].includes(l.id) ? SEA_ICE : l.win).multiplyScalar(0.55);
  // the canvas is sRGB: THREE.Color keeps linear values when colour management is on, so read them back as sRGB
  const srgb = x => { const o = {}; x.getRGB(o, THREE.SRGBColorSpace); return [o.r, o.g, o.b]; };
  sea.hor = srgb(c); sea.deep = srgb(d); sea.hi = srgb(hi);
  sea.glow = l.glow + 0.2;
  seaDraw();
}

// 13-card calls this: paint the water under the city on the PNG card (same task as the render, so the buffer is there)
function seaCardDraw(g, W, H) {
  if (!sea || !sea.ok || sea.cv.hidden) return false;
  seaDraw();
  const src = sea.cv, k = Math.max(W / src.width, H / src.height), sw = W / k, sh = H / k;
  g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, W, H);
  return true;
}

if (sea) {
  seaLens(lens);   // the default look's colours until a city loads (07-lens re-applies them per lens)
  new ResizeObserver(seaSize).observe(sea.cv);
  // a plain left click on empty water (no drag, no building, no plate, no modifier) sends a wave from that point
  let seaDown = null;
  canvas.addEventListener('pointerdown', e => { seaDown = e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey ? { x: e.clientX, y: e.clientY } : null; });
  canvas.addEventListener('pointerup', e => {
    const d = seaDown; seaDown = null;
    if (!d || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) >= 4 || pickAt(e)) return;
    seaDrop(e.clientX, e.clientY);
  });
  // #seatest=1 (headless check, like #cardtest): one wave in the open water on the left, as if clicked there, stepped 18 times
  // at once (headless virtual time barely ticks rAF), then held still
  if (new URLSearchParams(location.hash.slice(1)).get('seatest')) setTimeout(() => {
    const b = sea.cv.getBoundingClientRect();
    sea.drops.push([0.07, 1 - 0.56, 0.08, 1.2]);
    for (let i = 0; i < 18; i++) seaStep();
    seaDraw();
  }, 1200);
}
