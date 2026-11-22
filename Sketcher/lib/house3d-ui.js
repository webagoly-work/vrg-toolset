// Sketcher/lib/house3d-ui.js — the Ház 3D viewer (dev line skcam, stage K5): a <name>.house3d.json (made on the PC
// by Sketcher/tools/house3d.js from a walk round the house) as a point cloud, put to scale and measured on.
// WebGL 1, no library; the maths of the file is lib/house3d.js, the camera matrices lib/roombox.js's.
//
//   VRGHouse3dUI.open(host, { house, name, onSave(house) }) → handle
//
// ⟲ Nézet: drag to turn, wheel to zoom. 📏 Lépték: tap two points and type their true distance (a tape, the laser,
// the building's width): every measurement then reads in mm. ↔ Mérés: tap two points, the distance in mm.
// ⇩ Mentés hands back the file with the scale and the measurements (the Desktop page downloads it).
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGHouse3dUI = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const CSS = [
    '.h3{position:fixed;inset:0;z-index:9;display:flex;flex-direction:column;background:#0a141c;color:#e8f0f6;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.h3-top{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#121c24;border-bottom:1px solid rgba(232,240,246,.15);flex-wrap:wrap}',
    '.h3-top b{flex:1;min-width:140px}',
    '.h3 button{font:inherit;color:#e8f0f6;background:#17232c;border:1px solid #6c7880;padding:6px 10px;cursor:pointer}',
    '.h3 button.on{border-color:#8a5cd6;color:#c7a8f0}.h3 button.ok{background:#93d3e6;color:#071318;border-color:#93d3e6}',
    '.h3-body{flex:1;display:flex;min-height:0}.h3-c{flex:1;min-width:0;height:100%;display:block;touch-action:none;cursor:grab}',
    '.h3-side{flex:none;width:300px;max-width:45vw;overflow-y:auto;padding:10px 12px;background:#121c24;border-left:1px solid rgba(232,240,246,.15)}',
    '.h3-side .kv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:13px}.h3-side .kv b{color:#a6afb7;font-weight:400}',
    '.h3-hint{font-size:12.5px;color:#a6afb7;margin:6px 0}.h3-warn{color:#e3be7b}',
    '.h3-m{display:flex;align-items:center;gap:6px;margin:5px 0}.h3-m .v{font-weight:600;min-width:76px}.h3 input{background:#17232c;color:#e8f0f6;border:1px solid rgba(232,240,246,.34);padding:5px;font:inherit}',
    '.h3 input.lbl{flex:1;min-width:60px}.h3 input.mm{width:96px}',
    '@media (max-width:700px){.h3-body{flex-direction:column}.h3-side{width:auto;max-width:none;max-height:42vh;border-left:0;border-top:1px solid rgba(232,240,246,.15)}}',
  ].join('\n');
  const VS = 'attribute vec3 aP; attribute vec3 aC; uniform mat4 uM; uniform float uS; varying vec3 vC; void main(){ vC = aC; gl_Position = uM * vec4(aP, 1.0); gl_PointSize = clamp(uS / gl_Position.w, 1.5, 7.0); }';
  const FS = 'precision mediump float; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = mm => mm == null ? '—' : mm >= 1000 ? (Math.round(mm / 10) / 100).toString().replace('.', ',') + ' m' : Math.round(mm) + ' mm';

  function open(host, opts) {
    const H3 = opts.H3 || root.VRGHouse3d, RB = opts.RB || root.VRGRoomBox, doc = host.ownerDocument || root.document;
    let house = JSON.parse(JSON.stringify(opts.house));
    if (!doc.getElementById('h3-css')) { const st = doc.createElement('style'); st.id = 'h3-css'; st.textContent = CSS; doc.head.appendChild(st); }
    const el = doc.createElement('div'); el.className = 'h3';
    el.innerHTML = '<div class="h3-top"><b>🏠 Ház 3D · ' + esc(opts.name || house.name || '') + '</b>' +
      '<button data-h="mode" data-m="view">⟲ Nézet</button><button data-h="mode" data-m="scale">📏 Lépték</button><button data-h="mode" data-m="measure">↔ Mérés</button>' +
      '<button data-h="close" aria-label="Bezár">✕</button><button class="ok" data-h="save">⇩ Mentés</button></div>' +
      '<div class="h3-body"><canvas class="h3-c"></canvas><aside class="h3-side"></aside></div>';
    host.appendChild(el);
    const cv = el.querySelector('.h3-c'), side = el.querySelector('.h3-side');
    const P = house.pts, n = P.length / 3;
    // the view: orbit round the cloud's middle
    let ext = 1; for (let i = 0; i < P.length; i += 3) ext = Math.max(ext, Math.hypot(P[i], P[i + 1], P[i + 2]));
    const ys = []; for (let i = 1; i < P.length; i += 3) ys.push(P[i]); ys.sort((a, b) => a - b);
    const ui = { mode: house.scale ? 'measure' : 'scale', az: 35, el: 30, zoom: 2.2, at: [0, ys.length ? ys[Math.floor(ys.length / 2)] : 0, 0], pend: null, scaleA: null, scaleB: null, picks: [] };

    // ---- WebGL ----------------------------------------------------------------------------------------------------
    const gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    let prog = null, buf = {}, loc = {};
    if (gl) {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
      loc = { P: gl.getAttribLocation(prog, 'aP'), C: gl.getAttribLocation(prog, 'aC'), M: gl.getUniformLocation(prog, 'uM'), S: gl.getUniformLocation(prog, 'uS') };
      const col = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) col[i] = (house.rgb[i] || 180) / 255;
      buf.p = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf.p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
      buf.c = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf.c); gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);
      buf.x = gl.createBuffer(); buf.xc = gl.createBuffer();
    }
    function matrix() {
      const w = cv.clientWidth, h = cv.clientHeight, r = ext * ui.zoom, az = ui.az * Math.PI / 180, e = ui.el * Math.PI / 180;
      const eye = [ui.at[0] + r * Math.cos(e) * Math.sin(az), ui.at[1] + r * Math.sin(e), ui.at[2] + r * Math.cos(e) * Math.cos(az)];
      return RB.mul(RB.perspective(45, w / Math.max(1, h), ext * 0.02, ext * 20), RB.lookAt(eye, ui.at, [0, 1, 0]));
    }
    function project(M, p) {        // → [x, y] in CSS pixels and w, or null behind
      const x = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], y = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], w = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
      if (w <= 1e-9) return null;
      return [(x / w * 0.5 + 0.5) * cv.clientWidth, (0.5 - y / w * 0.5) * cv.clientHeight, w];
    }
    function draw() {
      if (!gl) return;
      const k = Math.min(2, root.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * k) || cv.height !== Math.round(h * k)) { cv.width = Math.round(w * k); cv.height = Math.round(h * k); }
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0.04, 0.07, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
      const M = matrix(); gl.uniformMatrix4fv(loc.M, false, new Float32Array(M)); gl.uniform1f(loc.S, ext * 0.35 * k);
      const bind = (b, l) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0); };
      bind(buf.p, loc.P); bind(buf.c, loc.C); gl.drawArrays(gl.POINTS, 0, n);
      // the cameras, the scale, the measurements and the picked points
      const xs = [], xc = [], add = (a, b, c) => { xs.push(...a, ...b); xc.push(...c, ...c); };
      house.cams.forEach(c => add(c.c, [c.c[0] + c.d[0] * ext * 0.06, c.c[1] + c.d[1] * ext * 0.06, c.c[2] + c.d[2] * ext * 0.06], [0.16, 0.55, 0.86]));
      if (house.scale) add(house.scale.a, house.scale.b, [0.54, 0.36, 0.84]);
      (house.measures || []).forEach(m => add(m.a, m.b, [0.88, 0.69, 0.13]));
      if (ui.pend) add(ui.pend, ui.pend, [1, 1, 1]);
      gl.disable(gl.DEPTH_TEST);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.x); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(xs), gl.DYNAMIC_DRAW); bind(buf.x, loc.P);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.xc); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(xc), gl.DYNAMIC_DRAW); bind(buf.xc, loc.C);
      gl.drawArrays(gl.LINES, 0, xs.length / 3); gl.drawArrays(gl.POINTS, 0, xs.length / 3);
    }
    /** The cloud point nearest the click on screen (within 12 px); of those within 2 px of the nearest, the front one. */
    function pick(x, y) {
      const M = matrix(), near = [];
      let dmin = Infinity;
      for (let i = 0; i < n; i++) {
        const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], s = project(M, p); if (!s) continue;
        const d = Math.hypot(s[0] - x, s[1] - y); if (d > 12) continue;
        near.push([d, s[2], p]); if (d < dmin) dmin = d;
      }
      let best = null, bw = Infinity;
      near.forEach(([d, w, p]) => { if (d <= dmin + 2 && w < bw) { bw = w; best = p; } });
      return best;
    }

    // ---- the side panel ---------------------------------------------------------------------------------------------
    function panel() {
      el.querySelectorAll('[data-h="mode"]').forEach(b => b.classList.toggle('on', b.dataset.m === ui.mode));
      const r = house.report || {}, sc = house.scale;
      let h = '<div class="kv"><b>Fotók</b><span>' + (r.registered || house.cams.length) + ' / ' + (r.images || house.cams.length) + ' elhelyezve</span><b>Pontok</b><span>' + n.toLocaleString('hu-HU') +
        (r.dense ? ' (sűrű)' : '') + '</span>' + (r.err != null ? '<b>Hiba</b><span>' + String(r.err).replace('.', ',') + ' px</span>' : '') + '</div>';
      h += '<h4>📏 Lépték</h4>' + (sc ? '<div class="h3-hint">' + fmt(sc.mm) + ' a két lila pont között · 1 egység = ' + fmt(sc.mmPerUnit) + '</div>'
        : '<div class="h3-hint h3-warn">Még nincs lépték: a felhőnek jó az alakja, de nincs mérete.</div>');
      if (ui.mode === 'scale') {
        h += '<div class="h3-hint">Koppints két pontra, amelyek valódi távolságát ismered (mérőszalag, lézer, az épület szélessége a térképről). ' +
          (ui.scaleA ? (ui.scaleB ? 'Két pont kijelölve.' : 'Még egy pont.') : '') + '</div>';
        if (ui.scaleA && ui.scaleB) h += '<div class="h3-m"><input class="mm" type="number" inputmode="numeric" data-h="scalemm" placeholder="mm" aria-label="valódi távolság mm"> mm <button data-h="setscale">Beállít</button></div>';
      }
      h += '<h4>↔ Mérések</h4>';
      if (ui.mode === 'measure') h += '<div class="h3-hint">' + (sc ? 'Két koppintás = egy távolság.' : 'Előbb a lépték (📏).') + '</div>';
      (house.measures || []).forEach((m, i) => h += '<div class="h3-m"><span>' + (i + 1) + '.</span><span class="v">' + fmt(H3.mm(house, m.a, m.b)) + '</span>' +
        '<input class="lbl" data-h="label" data-i="' + i + '" value="' + esc(m.label || '') + '" placeholder="Felirat"><button data-h="del" data-i="' + i + '" aria-label="Törlés">✕</button></div>');
      h += '<div class="h3-hint">Csak a fotókon látszó felületek kerülnek a felhőbe; a pontosság a lépték két pontjának pontosságán múlik.</div>';
      side.innerHTML = h;
    }

    // ---- input --------------------------------------------------------------------------------------------------------
    let drag = null;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ } });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
      if (drag.moved) { ui.az -= dx * 0.4; ui.el = Math.max(-10, Math.min(89, ui.el + dy * 0.3)); drag.x = e.clientX; drag.y = e.clientY; draw(); }
    });
    cv.addEventListener('pointerup', e => {
      const d = drag; drag = null; if (!d || d.moved) return;
      const r = cv.getBoundingClientRect(); tapAt(e.clientX - r.left, e.clientY - r.top);
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); ui.zoom = Math.max(0.3, Math.min(8, ui.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); draw(); }, { passive: false });
    function tapAt(x, y) {
      if (ui.mode === 'view') return;
      const p = pick(x, y); if (!p) return;
      if (ui.mode === 'scale') { if (!ui.scaleA || ui.scaleB) { ui.scaleA = p; ui.scaleB = null; ui.pend = p; } else { ui.scaleB = p; ui.pend = null; } }
      else if (ui.mode === 'measure') { if (!house.scale) return; if (!ui.pend) ui.pend = p; else { house.measures = (house.measures || []).concat([{ a: ui.pend, b: p }]); ui.pend = null; } }
      draw(); panel();
    }
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-h]'); if (!t) return;
      const a = t.dataset.h;
      if (a === 'mode') { ui.mode = t.dataset.m; ui.pend = null; draw(); panel(); }
      else if (a === 'setscale') { const v = parseFloat(String(el.querySelector('[data-h="scalemm"]').value).replace(',', '.')); if (v > 0) { house = H3.setScale(house, ui.scaleA, ui.scaleB, v); ui.scaleA = ui.scaleB = null; ui.mode = 'measure'; draw(); panel(); } }
      else if (a === 'del') { house.measures.splice(+t.dataset.i, 1); draw(); panel(); }
      else if (a === 'save') { if (opts.onSave) opts.onSave(house); }
      else if (a === 'close') { close(); if (opts.onClose) opts.onClose(); }
    });
    el.addEventListener('change', e => { const t = e.target; if (t.dataset.h === 'label') { const m = house.measures[+t.dataset.i]; if (m) m.label = t.value.trim(); } });
    const onResize = () => draw();
    root.addEventListener && root.addEventListener('resize', onResize);
    function close() { root.removeEventListener && root.removeEventListener('resize', onResize); el.remove(); }

    draw(); panel();
    return { el, ui, house: () => house, project: p => project(matrix(), p), tapAt, draw, close, gl: !!gl };
  }
  return { open };
});
