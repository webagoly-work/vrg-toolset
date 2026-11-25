// Sketcher/lib/roombox-gl.js — draws a Szobadoboz room (lib/roombox.js) with WebGL 1: walls, floor and ceiling, each
// fragment coloured by projecting it back into the photos that see it (projective texturing). No library, works
// offline from file://. Up to 8 photos per room (the texture units WebGL 1 guarantees).
(function (root) {
  'use strict';
  const RB = root.VRGRoomBox, N = RB ? RB.MAX_SHOTS : 8;
  const VS = 'attribute vec3 aP; uniform mat4 uM; varying vec3 vP; void main(){ vP = aP; gl_Position = uM * vec4(aP, 1.0); }';
  const FS = (() => {
    let s = 'precision highp float; varying vec3 vP; uniform vec3 uC[' + N + ']; uniform vec3 uR[' + N + ']; uniform vec3 uU[' + N + ']; uniform vec3 uF[' + N + '];' +
      'uniform vec2 uT[' + N + ']; uniform float uOn[' + N + ']; uniform vec3 uBase; uniform float uShade; uniform float uFlat; uniform float uHi;';
    for (let i = 0; i < N; i++) s += 'uniform sampler2D uS' + i + ';';
    s += 'void main(){ if (uFlat > 0.5) { gl_FragColor = vec4(uBase, 1.0); return; } vec4 acc = vec4(0.0);';
    for (let i = 0; i < N; i++) {
      s += '{ vec3 d = vP - uC[' + i + ']; float z = dot(d, uF[' + i + ']); if (uOn[' + i + '] > 0.5 && z > 1.0) {' +
        ' vec2 q = vec2(dot(d, uR[' + i + ']), dot(d, uU[' + i + '])) / z / uT[' + i + '];' +
        ' if (abs(q.x) < 1.0 && abs(q.y) < 1.0) { float e = 1.0 - max(abs(q.x), abs(q.y)); float w = (e * e + 0.0005) * (z / length(d)) * (uHi == ' + i + '.0 ? 40.0 : 1.0);' +
        ' acc += vec4(texture2D(uS' + i + ', vec2(0.5 + 0.5 * q.x, 0.5 - 0.5 * q.y)).rgb * w, w); } } }';
    }
    return s + ' vec3 c = acc.a > 0.0 ? acc.rgb / acc.a : uBase; gl_FragColor = vec4(c * uShade, 1.0); }';
  })();

  function create(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const U = n => gl.getUniformLocation(prog, n), aP = gl.getAttribLocation(prog, 'aP');
    const loc = { M: U('uM'), C: U('uC'), R: U('uR'), Up: U('uU'), F: U('uF'), T: U('uT'), On: U('uOn'), Base: U('uBase'), Shade: U('uShade'), Flat: U('uFlat'), Hi: U('uHi') };
    for (let i = 0; i < N; i++) gl.uniform1i(U('uS' + i), i);
    const buf = gl.createBuffer();
    const blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([90, 90, 90, 255]));
    const texCache = new Map();                    // file name -> texture (kept while the page lives)

    function texture(file, src) {
      if (!src) return null;
      const old = texCache.get(file); if (old && old.src === src) return old.t;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (old) gl.deleteTexture(old.t);
      texCache.set(file, { t, src });
      return t;
    }

    /** room = RB.scene(...)[i]; images(file) → a canvas / image (oriented) or null; v = the view; opts.hi = shot index to emphasise. */
    function draw(room, images, v, opts) {
      const o = opts || {}, w = canvas.clientWidth | 0, h = canvas.clientHeight | 0, dpr = Math.min(2, root.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.07, 0.09, 0.11, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      if (!room) return null;
      const vw = RB.view(room, v, canvas.width / Math.max(1, canvas.height));
      gl.uniformMatrix4fv(loc.M, false, new Float32Array(vw.m));
      const S = room.shots, C = [], R = [], Up = [], F = [], T = [];
      const have = [];
      for (let i = 0; i < N; i++) {
        const s = S[i];
        C.push(...(s ? s.pos : [0, 0, 0])); R.push(...(s ? s.basis.r : [1, 0, 0])); Up.push(...(s ? s.basis.up : [0, 1, 0])); F.push(...(s ? s.basis.fwd : [0, 0, 1])); T.push(...(s ? [s.tanH, s.tanV] : [1, 1]));
        const t = s ? texture(s.file, images(s.file)) : null;
        have.push(!!t);
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t || blank);
      }
      gl.uniform3fv(loc.C, new Float32Array(C)); gl.uniform3fv(loc.R, new Float32Array(R)); gl.uniform3fv(loc.Up, new Float32Array(Up));
      gl.uniform3fv(loc.F, new Float32Array(F)); gl.uniform2fv(loc.T, new Float32Array(T));
      gl.uniform1f(loc.Hi, o.hi == null ? -1 : o.hi);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      const put = (tris, mask, base, shade, flat, mode) => {
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tris), gl.DYNAMIC_DRAW);
        gl.uniform1fv(loc.On, new Float32Array(mask)); gl.uniform3fv(loc.Base, new Float32Array(base)); gl.uniform1f(loc.Shade, shade); gl.uniform1f(loc.Flat, flat ? 1 : 0);
        gl.drawArrays(mode == null ? gl.TRIANGLES : mode, 0, tris.length / 3);
      };
      const all = have.map(x => x ? 1 : 0);
      const H = room.h;
      // floor and ceiling (the ceiling only when standing in the room)
      const flat = []; room.tris.forEach(t => t.forEach(i => flat.push(room.poly[i][0], 0, room.poly[i][1])));
      put(flat, all, [0.30, 0.28, 0.25], 0.92, false);
      if (vw.stand) { const ce = []; room.tris.forEach(t => t.forEach(i => ce.push(room.poly[i][0], H, room.poly[i][1]))); put(ce, all, [0.85, 0.85, 0.82], 1, false); }
      // walls: each with the photos that can see it
      const shown = [];
      room.walls.forEach((wl, wi) => {
        if (!vw.stand && !RB.wallShown(wl, vw.eye)) return;
        shown.push(wi);
        const a = wl.a, b = wl.b, q = [a[0], 0, a[1], b[0], 0, b[1], b[0], H, b[1], a[0], 0, a[1], b[0], H, b[1], a[0], H, a[1]];
        const mask = all.map((x, i) => x && room.wallSeen[wi][i] > 0 ? 1 : 0);
        put(q, mask, room.cover[wi] ? [0.55, 0.55, 0.55] : [0.42, 0.36, 0.30], 1, false);
      });
      // outline: the floor's edges and the tops of the walls drawn, for reading the shape from above
      if (!vw.stand) {
        const ln = [];
        room.walls.forEach(wl => { ln.push(wl.a[0], 2, wl.a[1], wl.b[0], 2, wl.b[1]); });
        shown.forEach(wi => { const wl = room.walls[wi]; ln.push(wl.a[0], H, wl.a[1], wl.b[0], H, wl.b[1], wl.a[0], 0, wl.a[1], wl.a[0], H, wl.a[1], wl.b[0], 0, wl.b[1], wl.b[0], H, wl.b[1]); });
        gl.disable(gl.DEPTH_TEST); put(ln, all.map(() => 0), [0.15, 0.76, 0.69], 1, true, gl.LINES); gl.enable(gl.DEPTH_TEST);
        // the photo points: a short vertical tick at eye height
        const pt = []; room.shots.forEach(s => { pt.push(s.pos[0], 0, s.pos[2], s.pos[0], s.pos[1], s.pos[2], s.pos[0], s.pos[1], s.pos[2], s.pos[0] + s.basis.fwd[0] * 400, s.pos[1], s.pos[2] + s.basis.fwd[2] * 400); });
        if (pt.length) { gl.disable(gl.DEPTH_TEST); put(pt, all.map(() => 0), [0.16, 0.55, 0.86], 1, true, gl.LINES); gl.enable(gl.DEPTH_TEST); }
      }
      return { eye: vw.eye, shown, textured: have.filter(Boolean).length };
    }
    return { draw, gl };
  }
  root.VRGRoomBoxGL = { create };
})(typeof self !== 'undefined' ? self : this);
