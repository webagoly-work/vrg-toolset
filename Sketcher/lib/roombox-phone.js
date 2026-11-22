// Sketcher/lib/roombox-phone.js — Szobadoboz on the phone (dev line skcam, stage K1b, WP M59).
//
// The room box is the Desktop's (lib/roombox.js does the maths, lib/roombox-gl.js draws, WP M57). On the phone the
// three files are bundled into the APK (feature-sketch/build.gradle.kts, ROOMBOX_ASSETS) and run in a WebView; this
// file is the touch UI around them. The phone hands over one input (sketch-core RoomBox.input: the plan in mm, the
// corrections, the level's height, the photos as data: URLs under their board names) through the VRGBox bridge, and
// gets the corrections back when the user taps Kész:
//
//   VRGBox.input()      → the input JSON (text)
//   VRGBox.save(json)   ← the corrections ({h, eye, shots}), the same `box` key the Desktop writes
//   VRGBox.close()      ← leave without saving
//
// One finger: rotate (Felülről) or look around (A fotópontból); two fingers: zoom / field of view.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGRoomBoxPhone = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const CSS = [
    'html,body{margin:0;height:100%;background:#0a141c;color:#e8f0f6;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent}',
    '#rb{display:flex;flex-direction:column;height:100%}',
    '#rbtop{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#121c24;border-bottom:1px solid rgba(232,240,246,.15);flex-wrap:wrap}',
    '#rbtop select{flex:1;min-width:0;background:#17232c;color:#e8f0f6;border:1px solid rgba(232,240,246,.34);padding:6px;font:inherit}',
    'button{font:inherit;color:#e8f0f6;background:#17232c;border:1px solid #6c7880;padding:7px 11px;border-radius:0}',
    'button.on{border-color:#2a8cdb;color:#93d3e6}button.ok{background:#93d3e6;color:#071318;border-color:#93d3e6}',
    '#rbc{flex:1;min-height:0;width:100%;display:block;touch-action:none}',
    '#rbhint{position:absolute;left:8px;right:8px;margin-top:-30px;font-size:12px;color:#a6afb7;pointer-events:none;text-shadow:0 0 3px #000}',
    '#rbsheet{background:#121c24;border-top:1px solid rgba(232,240,246,.15);max-height:44%;overflow-y:auto;padding:6px 10px 10px}',
    '#rbsheet.shut{max-height:none}#rbsheet.shut .body{display:none}',
    '.kv{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#a6afb7;margin:4px 0}.kv b{color:#e8f0f6;font-weight:600}',
    '.f{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0;font-size:14px}',
    '.f input{width:84px;background:#17232c;color:#e8f0f6;border:1px solid rgba(232,240,246,.34);padding:6px;font:inherit}',
    '.shot{border:1px solid rgba(232,240,246,.15);background:#17232c;padding:6px 8px;margin:8px 0}.shot.hi{border-color:#2a8cdb}',
    '.shot .row{display:flex;align-items:center;gap:6px}.shot .row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#a6afb7}',
    '.shot label{display:block;font-size:12px;color:#a6afb7;margin-top:6px}.shot input[type=range]{width:100%;accent-color:#2a8cdb;height:28px}',
    '.shot input[type=number]{width:84px;background:#0a141c;color:#e8f0f6;border:1px solid rgba(232,240,246,.34);padding:5px;font:inherit}',
    '.note{font-size:12px;color:#a6afb7;margin:6px 0}.warn{color:#e3be7b}',
  ].join('\n');

  const f1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };
  const SRC = { kezi: 'kézi', lencse: 'a kamerától', exif: 'EXIF', alap: 'alapérték' };

  function start(input, opts) {
    const o = opts || {}, RB = o.RB || root.VRGRoomBox, GL = o.GL || root.VRGRoomBoxGL, io = o.io || root.VRGBox || null, doc = o.document || root.document;
    const inp = typeof input === 'string' ? JSON.parse(input) : input || (io ? JSON.parse(io.input()) : {});
    let box = JSON.parse(JSON.stringify(inp.box || {}));
    const images = inp.images || {}, meta = {}, canv = {};
    const ui = { room: '', mode: 'orbit', az: 30, el: 55, zoom: 2.6, yaw: 0, pitch: 0, fov: 75, point: '', hi: null, open: true, dirty: false };
    const st = doc.createElement('style'); st.textContent = CSS; doc.head.appendChild(st);
    doc.body.innerHTML = '<div id="rb"><div id="rbtop"><select id="rbroom"></select><button data-a="mode" data-m="orbit">Felülről</button><button data-a="mode" data-m="stand">A pontból</button>' +
      '<button data-a="close" aria-label="Bezár">✕</button><button class="ok" data-a="save">✓ Kész</button></div>' +
      '<canvas id="rbc"></canvas><div id="rbhint"></div><div id="rbsheet"><div class="kv" id="rbkv"></div><div class="body" id="rbbody"></div></div></div>';
    const $ = id => doc.getElementById(id), c = $('rbc');
    let gl = null; try { gl = GL.create(c); } catch (e) { gl = null; }

    const metaOf = file => meta[file] || null;
    const scene = () => RB.scene(inp.plan, box, metaOf, inp.level);
    const room = () => scene().find(r => r.id === ui.room) || null;

    // the photos: drawn onto canvases (upright, at most 2048 px) once each is decoded
    Object.keys(images).forEach(name => {
      const img = new root.Image();
      img.onload = () => {
        const k = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight)), cv = doc.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        canv[name] = cv; meta[name] = { w: img.naturalWidth, h: img.naturalHeight };
        draw(true);
      };
      img.src = images[name];
    });

    function draw(side) {
      const r = room();
      doc.querySelectorAll('[data-a="mode"]').forEach(b => b.classList.toggle('on', b.dataset.m === ui.mode));
      if (side) panel(r);
      const hint = $('rbhint');
      if (!gl) { hint.textContent = 'Ez a telefon nem tud WebGL-t: a 3D nézet nem rajzolható.'; return null; }
      const out = gl.draw(r, f => canv[String(f).split(/[\\/]/).pop()] || null,
        { mode: ui.mode, az: ui.az, el: ui.el, zoom: ui.zoom, yaw: ui.yaw, pitch: ui.pitch, fov: ui.fov, point: ui.point }, { hi: ui.hi });
      hint.textContent = !r ? '' : ui.mode === 'orbit' ? 'Egy ujj: forgatás · két ujj: nagyítás' : 'Egy ujj: körülnézés · két ujj: látószög ' + Math.round(ui.fov) + '°';
      doc.body.dataset.drawn = out ? String(out.textured) : '0';
      return out;
    }

    function panel(r) {
      const rooms = scene();
      $('rbroom').innerHTML = rooms.map(x => '<option value="' + esc(x.id) + '"' + (x.id === ui.room ? ' selected' : '') + '>' + esc(x.name) + (x.shots.length ? ' · ' + x.shots.length + ' kép' : '') + '</option>').join('');
      if (!r) { $('rbkv').innerHTML = ''; $('rbbody').innerHTML = '<p class="note">Nincs helyiség méretekkel: előbb Rendezés (a vázlat megoldása).</p>'; return; }
      $('rbkv').innerHTML = '<span><b>' + f1(r.area) + ' m²</b> alapterület</span><span><b>' + f1(r.perimeter) + ' m</b> kerület</span><span><b>' +
        r.cover.filter(Boolean).length + ' / ' + r.walls.length + '</b> fal képpel</span>';
      let h = '<div class="f">Belmagasság (cm) <input type="number" inputmode="numeric" min="180" max="600" data-b="h" value="' + Math.round(r.h / 10) + '"></div>' +
        '<div class="f">Szemmagasság a fotónál (cm) <input type="number" inputmode="numeric" min="60" max="220" data-b="eye" value="' + Math.round(r.eye / 10) + '"></div>';
      if (!r.shots.length) h += '<p class="note">Ebben a helyiségben nincs Fotópont: a doboz a méretekből áll, kép nélkül.</p>';
      else h += '<p class="note">Ha egy kép sarka nem a doboz sarkára esik: Irány; ha a kép túl nagy vagy kicsi a falon: Látószög (0,5× ≈ 13–16 mm, 1× ≈ 24–28 mm).</p>';
      const missing = r.shots.filter(x => !canv[String(x.file).split(/[\\/]/).pop()]).length;
      if (missing) h += '<p class="note warn">' + missing + ' kép még töltődik vagy hiányzik a telefonról.</p>';
      r.shots.forEach((x, i) => {
        h += '<div class="shot' + (ui.hi === i ? ' hi' : '') + '"><div class="row"><button data-a="hi" data-i="' + i + '">' + esc(x.side || x.deg + '°') + '</button><span class="nm">' +
          esc(x.file) + '</span><button data-a="stand" data-p="' + esc(x.point) + '" data-deg="' + x.yaw + '" aria-label="Nézd innen">👁</button></div>' +
          '<label>Irány ' + (x.fix.yaw >= 0 ? '+' : '') + f1(x.fix.yaw) + '°<input type="range" min="-30" max="30" step="0.5" data-b="yaw" data-key="' + esc(x.key) + '" value="' + x.fix.yaw + '"></label>' +
          '<label>Dőlés ' + (x.pitch >= 0 ? '+' : '') + f1(x.pitch) + '°<input type="range" min="-25" max="25" step="0.5" data-b="pitch" data-key="' + esc(x.key) + '" value="' + x.pitch + '"></label>' +
          '<label>Látószög ' + Math.round(x.fovH) + '° · ' + f1(x.f35) + ' mm (' + (SRC[x.f35src] || x.f35src) + ') <input type="number" inputmode="decimal" min="8" max="80" step="0.5" data-b="f35" data-key="' +
          esc(x.key) + '" placeholder="auto" value="' + (x.fix.f35 || '') + '"></label></div>';
      });
      $('rbbody').innerHTML = h;
    }

    function set(fn, live) {
      const b = JSON.parse(JSON.stringify(box)); fn(b);
      ['h', 'shots'].forEach(k => { if (b[k] && !Object.keys(b[k]).length) delete b[k]; });
      box = b; ui.dirty = true; draw(!live);
    }
    function onInput(e, done) {
      const t = e.target, k = t.dataset.b;
      if (t.id === 'rbroom') { if (done) { ui.room = t.value; ui.hi = null; ui.point = ''; draw(true); } return; }
      if (!k) return;
      const v = num(t.value), r = room();
      if (k === 'h') { if (done && r) set(b => { b.h = b.h || {}; if (v > 0) b.h[r.id] = Math.round(v * 10); else delete b.h[r.id]; }); return; }
      if (k === 'eye') { if (done) set(b => { if (v > 0) b.eye = Math.round(v * 10); else delete b.eye; }); return; }
      const key = t.dataset.key;
      set(b => {
        b.shots = b.shots || {}; const x = Object.assign({}, b.shots[key]);
        if (k === 'f35') { if (v > 0) x.f35 = v; else delete x.f35; } else if (v) x[k] = v; else delete x[k];
        if (Object.keys(x).length) b.shots[key] = x; else delete b.shots[key];
      }, !done);
      if (!done && k !== 'f35') { const lab = t.closest('label'); if (lab) lab.firstChild.textContent = (k === 'yaw' ? 'Irány ' : 'Dőlés ') + ((v || 0) >= 0 ? '+' : '') + f1(v || 0) + '°'; }
    }
    function onClick(e) {
      const t = e.target.closest('[data-a]'); if (!t) return;
      const a = t.dataset.a;
      if (a === 'mode') {
        ui.mode = t.dataset.m;
        if (ui.mode === 'stand') { const r = room(), s = r && (r.shots.find(x => x.point === ui.point) || r.shots[0]); if (s) { ui.point = s.point; ui.yaw = s.yaw; ui.pitch = 0; } }
        draw();
      } else if (a === 'stand') { ui.mode = 'stand'; ui.point = t.dataset.p; ui.yaw = +t.dataset.deg; ui.pitch = 0; draw(); }
      else if (a === 'hi') { const i = +t.dataset.i; ui.hi = ui.hi === i ? null : i; draw(true); }
      else if (a === 'save') { if (io && io.save) io.save(JSON.stringify(box)); ui.open = false; }
      else if (a === 'close') { if (io && io.close) io.close(); ui.open = false; }
    }

    // touch: one finger rotates / looks, two fingers zoom / change the field of view (pointer events cover mouse and pen)
    const ptrs = new Map(); let pinch = 0;
    c.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); try { c.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ } if (ptrs.size === 2) pinch = spread(); });
    c.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size >= 2) {
        ptrs.set(e.pointerId, [e.clientX, e.clientY]); const d = spread(); if (!pinch || !d) { pinch = d; return; }
        const k = pinch / d; pinch = d;
        if (ui.mode === 'orbit') ui.zoom = Math.max(1.1, Math.min(8, ui.zoom * k)); else ui.fov = Math.max(30, Math.min(110, ui.fov * k));
      } else {
        const dx = e.clientX - p[0], dy = e.clientY - p[1]; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ui.mode === 'orbit') { ui.az -= dx * 0.4; ui.el = Math.max(8, Math.min(89, ui.el + dy * 0.3)); }
        else { ui.yaw -= dx * 0.2; ui.pitch = Math.max(-80, Math.min(80, ui.pitch + dy * 0.2)); }
      }
      draw();
    });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    function spread() { const v = Array.from(ptrs.values()); return v.length < 2 ? 0 : Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); }

    doc.addEventListener('click', onClick);
    doc.addEventListener('input', e => onInput(e, false));
    doc.addEventListener('change', e => onInput(e, true));
    root.addEventListener && root.addEventListener('resize', () => draw());

    const rooms = scene();
    ui.room = (rooms.find(r => r.shots.length) || rooms[0] || {}).id || '';
    draw(true);
    return { ui, box: () => box, scene, draw, images: name => canv[name] || null };
  }

  /** In the WebView: reads the input from the bridge and starts; an error goes to VRGBox.fail when the bridge has it. */
  function run() {
    try { return start(null); } catch (e) { const io = root.VRGBox; if (io && io.fail) io.fail(String(e && e.stack || e)); else throw e; }
  }
  return { start, run };
});
