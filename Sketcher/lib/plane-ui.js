// Sketcher/lib/plane-ui.js — Síkmérés screen (dev line skcam, stage K3): measuring on a plane in one photo.
// The same screen runs on the Desktop page (an overlay over the Kamera front) and on the phone (a WebView, as the
// Szobadoboz does, through run() and the VRGPlaneIO bridge). The maths is lib/plane.js.
//
//   VRGPlaneUI.open(host, { image, title, record, onSave(record|null), onClose() }) → handle
//     image: a canvas or a decoded <img> (upright); record: the stored `planes` record of this photo, or null.
//   VRGPlaneUI.run()   in the phone's WebView: VRGPlaneIO.input() → {image (data: URL), title, record};
//                      ✓ Mentés → VRGPlaneIO.save(json), ✕ → VRGPlaneIO.close(), an error → VRGPlaneIO.fail(msg).
//
// The VRG mérőkártya (lib/marker.js, the K3 follow-up): when the photo has no reference yet, the screen looks for the
// printed card first; found, its corners and size fill ① by themselves (still draggable) and the screen goes on to ②.
// 🔍 Kártya looks again; opts.printCard (the Desktop) adds 🖨 Kártya nyomtatása.
//
// Steps: ① Referencia (the 4 corners of a known rectangle on the wall), ② Padló (two points on the floor line, for
// heights), ③ Távolság (two taps = one distance), ④ Magasság (one tap = the height above the floor line). Every point
// can be dragged (a loupe shows the pixels under the finger); the view zooms with the wheel / two fingers and pans with
// one finger on empty photo.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGPlaneUI = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const CSS = [
    '.pl{position:fixed;inset:0;z-index:9;display:flex;flex-direction:column;background:#0a141c;color:#e8f0f6;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.pl-top{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#121c24;border-bottom:1px solid rgba(232,240,246,.15);flex-wrap:wrap}',
    '.pl-top b{flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.pl button{font:inherit;color:#e8f0f6;background:#17232c;border:1px solid #6c7880;padding:6px 10px;border-radius:0;cursor:pointer}',
    '.pl button.on{border-color:#e0b020;color:#e0b020}.pl button.ok{background:#93d3e6;color:#071318;border-color:#93d3e6}',
    '.pl-steps{display:flex;gap:4px;flex-wrap:wrap;padding:6px 8px;background:#0f1920}',
    '.pl-c{flex:1;min-height:0;width:100%;display:block;touch-action:none;cursor:crosshair;background:#05090c}',
    '.pl-sheet{background:#121c24;border-top:1px solid rgba(232,240,246,.15);max-height:40%;overflow-y:auto;padding:6px 10px 10px}',
    '.pl-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0}',
    '.pl select,.pl input{background:#17232c;color:#e8f0f6;border:1px solid rgba(232,240,246,.34);padding:5px;font:inherit}',
    '.pl input[type=number]{width:78px}.pl input.lbl{flex:1;min-width:80px}',
    '.pl-note{color:#7fd1c7}.pl-hint{font-size:12.5px;color:#a6afb7;margin:4px 0}.pl-warn{color:#e3be7b}.pl-err{color:#e4877d}',
    '.pl-m{display:flex;align-items:center;gap:6px;margin:4px 0;font-size:13.5px}.pl-m .v{font-weight:600;min-width:72px}.pl-m .q{font-size:11.5px;color:#a6afb7}',
    '.pl-m .q.kozepes{color:#e3be7b}.pl-m .q.tavoli{color:#e4877d}',
  ].join('\n');
  const STEPS = [['ref', '① Referencia'], ['floor', '② Padló'], ['dist', '③ Távolság'], ['height', '④ Magasság']];
  const COL = { ref: '#27c2b0', floor: '#e8641c', dist: '#e0b020', height: '#3dae5a', pend: '#93d3e6' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function open(host, opts) {
    const P = opts.P || root.VRGPlane, MK = opts.M === undefined ? root.VRGMarker : opts.M, doc = host.ownerDocument || root.document, img = opts.image;
    const W = img.naturalWidth || img.width, Hh = img.naturalHeight || img.height;
    if (!doc.getElementById('pl-css')) { const st = doc.createElement('style'); st.id = 'pl-css'; st.textContent = CSS; doc.head.appendChild(st); }
    // the working record: points in 0…1 of the photo
    const r0 = opts.record || {};
    let rec = { aspect: W / Hh, ref: r0.ref ? JSON.parse(JSON.stringify(r0.ref)) : { kind: 'a4', w: 210, h: 297, pts: [] },
      floor: r0.floor ? r0.floor.slice() : [], lines: (r0.lines || []).map(l => Object.assign({}, l)), marks: (r0.marks || []).map(m => Object.assign({}, m)), at: r0.at };
    const ui = { step: rec.ref.pts.length === 4 ? (rec.floor.length === 2 ? 'height' : 'dist') : 'ref', pend: null, scale: 1, ox: 0, oy: 0, drag: null, loupe: null, note: null, found: null };

    const el = doc.createElement('div'); el.className = 'pl';
    el.innerHTML = '<div class="pl-top"><b>📏 ' + esc(opts.title || 'Mérés a fotón') + '</b><button data-p="close" aria-label="Bezár">✕</button><button class="ok" data-p="save">✓ Mentés</button></div>' +
      '<div class="pl-steps">' + STEPS.map(([k, l]) => '<button data-p="step" data-s="' + k + '">' + l + '</button>').join('') + '<button data-p="undo" title="Utolsó visszavonása">↶</button></div>' +
      '<canvas class="pl-c"></canvas><div class="pl-sheet"></div>';
    host.appendChild(el);
    const cv = el.querySelector('.pl-c'), sheet = el.querySelector('.pl-sheet'), g = cv.getContext('2d');

    // ---- geometry helpers -----------------------------------------------------------------------------------------
    const dpr = () => Math.min(2, root.devicePixelRatio || 1);
    function fit() {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      ui.scale = Math.min(w / W, h / Hh) * 0.98; ui.ox = (w - W * ui.scale) / 2; ui.oy = (h - Hh * ui.scale) / 2;
    }
    const toScreen = p => [ui.ox + p[0] * W * ui.scale, ui.oy + p[1] * Hh * ui.scale];
    const toPhoto = (x, y) => [(x - ui.ox) / (W * ui.scale), (y - ui.oy) / (Hh * ui.scale)];
    const frame = () => P.frame(rec.ref.pts.length === 4 ? rec : null);
    function handles() {      // every draggable point: [list, index or key, point]
      const out = [];
      rec.ref.pts.forEach((p, i) => out.push({ get: () => rec.ref.pts[i], set: q => { rec.ref.pts[i] = q; } }));
      rec.floor.forEach((p, i) => out.push({ get: () => rec.floor[i], set: q => { rec.floor[i] = q; } }));
      rec.lines.forEach(l => { out.push({ get: () => l.a, set: q => { l.a = q; } }); out.push({ get: () => l.b, set: q => { l.b = q; } }); });
      rec.marks.forEach(m => out.push({ get: () => m.p, set: q => { m.p = q; } }));
      return out;
    }
    function nearest(x, y, r) {
      let best = null, bd = r;
      handles().forEach(h => { const s = toScreen(h.get()), d = Math.hypot(s[0] - x, s[1] - y); if (d < bd) { bd = d; best = h; } });
      return best;
    }
    // the millimetres in place: a drag holds on to the very point objects, so they must stay the same objects
    function recompute() { const m = P.measure(rec); rec.lines.forEach((l, i) => { l.mm = m.lines[i].mm; }); rec.marks.forEach((x, i) => { x.mm = m.marks[i].mm; }); }

    // ---- drawing ------------------------------------------------------------------------------------------------
    function draw() {
      const w = cv.clientWidth, h = cv.clientHeight, k = dpr();
      if (cv.width !== Math.round(w * k) || cv.height !== Math.round(h * k)) { cv.width = Math.round(w * k); cv.height = Math.round(h * k); }
      g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, w, h);
      g.imageSmoothingEnabled = ui.scale < 2;
      g.drawImage(img, ui.ox, ui.oy, W * ui.scale, Hh * ui.scale);
      const f = frame();
      // reference
      const rp = rec.ref.pts.map(toScreen), ring = rp.length === 4 ? (P.order(rec.ref.pts) || rec.ref.pts).map(toScreen) : rp;
      if (rp.length) {
        g.strokeStyle = COL.ref; g.lineWidth = 2; g.beginPath(); ring.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
        if (rp.length === 4) g.closePath(); g.stroke();
        rp.forEach((p, i) => dot(p, COL.ref, String(i + 1)));
      }
      // floor line, drawn across the photo
      if (rec.floor.length) {
        const a = toScreen(rec.floor[0]);
        if (rec.floor.length === 2) {
          const b = toScreen(rec.floor[1]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
          g.strokeStyle = COL.floor; g.setLineDash([8, 6]); g.lineWidth = 2; g.beginPath();
          g.moveTo(a[0] - dx / L * 4000, a[1] - dy / L * 4000); g.lineTo(a[0] + dx / L * 4000, a[1] + dy / L * 4000); g.stroke(); g.setLineDash([]);
          dot(b, COL.floor);
        }
        dot(a, COL.floor);
      }
      // distances
      rec.lines.forEach((l, i) => {
        const a = toScreen(l.a), b = toScreen(l.b);
        g.strokeStyle = COL.dist; g.lineWidth = 2.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        dot(a, COL.dist); dot(b, COL.dist);
        label([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], (i + 1) + ': ' + (l.mm == null ? '—' : P.fmt(l.mm)), COL.dist);
      });
      // heights: a tick down to the floor line along the plane's vertical
      rec.marks.forEach((m, i) => {
        const p = toScreen(m.p);
        let foot = null;
        if (f && rec.floor.length === 2 && m.mm != null) {
          const Pp = P.toPlane(f, m.p), A = P.toPlane(f, rec.floor[0]), B = P.toPlane(f, rec.floor[1]);
          if (Pp && A && B) {         // the foot of the perpendicular on the plane, back into the photo
            const dx = B[0] - A[0], dy = B[1] - A[1], t = ((Pp[0] - A[0]) * dx + (Pp[1] - A[1]) * dy) / (dx * dx + dy * dy);
            foot = planeToPhoto(f, [A[0] + dx * t, A[1] + dy * t]);
          }
        }
        if (foot) { const q = toScreen(foot); g.strokeStyle = COL.height; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
        dot(p, COL.height); label([p[0] + 10, p[1] - 12], 'M' + (i + 1) + ': ' + (m.mm == null ? '—' : P.fmt(m.mm)), COL.height);
      });
      if (ui.pend) dot(toScreen(ui.pend), COL.pend);
      if (ui.loupe) loupe(ui.loupe);
    }
    function planeToPhoto(f, q) {
      const inv = invert(f.H); if (!inv) return null;
      const s = P.apply(inv, q); return s ? [s[0] / f.aspect, s[1]] : null;
    }
    function invert(m) {
      const [a, b, c, d, e, f2, gg, h, i] = m, A = e * i - f2 * h, B = -(d * i - f2 * gg), C = d * h - e * gg, det = a * A + b * B + c * C;
      if (Math.abs(det) < 1e-15) return null;
      return [A / det, -(b * i - c * h) / det, (b * f2 - c * e) / det, B / det, (a * i - c * gg) / det, -(a * f2 - c * d) / det, C / det, -(a * h - b * gg) / det, (a * e - b * d) / det];
    }
    function dot(p, c, t) {
      g.fillStyle = c; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(p[0], p[1], 6, 0, 6.2832); g.fill(); g.stroke();
      if (t) { g.font = '600 12px system-ui,sans-serif'; g.fillStyle = '#000'; g.fillText(t, p[0] - 3.5, p[1] + 4); }
    }
    function label(p, t, c) {
      g.font = '600 13px system-ui,sans-serif'; const w = g.measureText(t).width + 10;
      g.fillStyle = 'rgba(5,9,12,.82)'; g.fillRect(p[0] - w / 2, p[1] - 11, w, 20); g.fillStyle = c; g.fillText(t, p[0] - w / 2 + 5, p[1] + 4);
    }
    function loupe(p) {         // 3× around the dragged point, in the corner away from the finger
      const R = 56, s = toScreen(p), cx = s[0] < cv.clientWidth / 2 ? cv.clientWidth - R - 10 : R + 10, cy = R + 10, z = 3;
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.clip();
      g.fillStyle = '#000'; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      const sx = p[0] * W, sy = p[1] * Hh, half = R / (ui.scale * z);
      g.drawImage(img, sx - half, sy - half, half * 2, half * 2, cx - R, cy - R, 2 * R, 2 * R);
      g.restore();
      g.strokeStyle = '#93d3e6'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.stroke();
      g.beginPath(); g.moveTo(cx - 10, cy); g.lineTo(cx + 10, cy); g.moveTo(cx, cy - 10); g.lineTo(cx, cy + 10); g.stroke();
    }

    // ---- the sheet ----------------------------------------------------------------------------------------------
    function panel() {
      el.querySelectorAll('[data-p="step"]').forEach(b => b.classList.toggle('on', b.dataset.s === ui.step));
      const f = frame(), r = rec.ref;
      let h = ui.note ? '<div class="pl-hint pl-note">' + ui.note + '</div>' : '';
      if (ui.step === 'ref') {
        h += '<div class="pl-row"><select data-q="kind">' + P.REFS.map(x => '<option value="' + x.id + '"' + (x.id === r.kind ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select>' +
          '<input type="number" inputmode="numeric" data-q="w" value="' + r.w + '" aria-label="szélesség mm"> × <input type="number" inputmode="numeric" data-q="h" value="' + r.h + '" aria-label="magasság mm"> mm' +
          '<button data-p="turn" title="Fektetve / állítva">⇄</button>' +
          (MK ? '<button data-p="find" title="A nyomtatott VRG mérőkártya megkeresése a fotón">🔍 Kártya</button>' : '') +
          (opts.printCard ? '<button data-p="print" title="A VRG mérőkártya kinyomtatása (100 %)">🖨 Kártya nyomtatása</button>' : '') + '</div>';
        h += '<div class="pl-hint">' + (r.pts.length < 4 ? 'Koppints a ' + esc((P.ref(r.kind) || {}).label || 'téglalap') + ' négy sarkára (' + r.pts.length + '/4), bármilyen sorrendben. A pontok húzhatók.'
          : f ? 'Referencia kész: ' + f.w + ' × ' + f.h + ' mm. Ugyanazon a falon (síkon) mérj vele.' : '<span class="pl-err">A négy pont nem téglalap képe: húzd a sarkokat a helyükre.</span>') + '</div>';
      } else if (ui.step === 'floor') {
        h += '<div class="pl-hint">Koppints két pontra a padló és a fal találkozásán (a magassághoz). ' + (rec.floor.length === 2 ? 'Kész.' : rec.floor.length + '/2') + '</div>';
      } else if (ui.step === 'dist') {
        h += '<div class="pl-hint">' + (f ? 'Két koppintás = egy távolság a referencia síkján.' : '<span class="pl-warn">Előbb a referencia (①).</span>') + '</div>';
      } else {
        h += '<div class="pl-hint">' + (!f ? '<span class="pl-warn">Előbb a referencia (①).</span>' : rec.floor.length < 2 ? '<span class="pl-warn">Előbb a padlóvonal (②).</span>' : 'Koppints egy pontra: a magassága a padlótól.') + '</div>';
      }
      rec.lines.forEach((l, i) => h += row('l', i, (i + 1) + '.', l.mm, l.label, f ? P.quality(f, [l.a, l.b]) : null));
      rec.marks.forEach((m, i) => h += row('m', i, 'M' + (i + 1), m.mm, m.label, f ? P.quality(f, [m.p]) : null));
      if (f && (rec.lines.length || rec.marks.length)) h += '<div class="pl-hint">Pontosság: a referenciától távolodva csökken (jó ≤ 2×, közepes ≤ 5× a referencia mérete). Csak a referencia síkján mér: a falon, nem a bútoron.</div>';
      sheet.innerHTML = h;
    }
    function row(t, i, n, mm, lbl, q) {
      return '<div class="pl-m"><span>' + n + '</span><span class="v">' + (mm == null ? '—' : P.fmt(mm)) + '</span>' +
        (q ? '<span class="q ' + q.grade + '">' + esc(P.GRADES[q.grade]) + '</span>' : '') +
        '<input class="lbl" data-q="label" data-t="' + t + '" data-i="' + i + '" placeholder="Felirat (pl. dugalj)" value="' + esc(lbl || '') + '">' +
        '<button data-p="del" data-t="' + t + '" data-i="' + i + '" aria-label="Törlés">✕</button></div>';
    }
    const redraw = side => { recompute(); draw(); if (side) panel(); };

    // ---- input --------------------------------------------------------------------------------------------------
    const ptrs = new Map(); let gesture = null;
    function tap(x, y) {
      const p = toPhoto(x, y); if (p[0] < 0 || p[0] > 1 || p[1] < 0 || p[1] > 1) return;
      ui.note = null;                                              // the card's note has been read once the user goes on
      if (ui.step === 'ref') { if (rec.ref.pts.length < 4) rec.ref.pts.push(p); }
      else if (ui.step === 'floor') { if (rec.floor.length < 2) rec.floor.push(p); else rec.floor[1] = p; }
      else if (ui.step === 'dist') { if (!frame()) return; if (!ui.pend) ui.pend = p; else { rec.lines.push({ a: ui.pend, b: p }); ui.pend = null; } }
      else if (ui.step === 'height') { if (!frame() || rec.floor.length < 2) return; rec.marks.push({ p }); }
      redraw(true);
    }
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      ptrs.set(e.pointerId, [x, y]); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      if (ptrs.size === 2) { gesture = { kind: 'pinch', d: spread(), mid: mid() }; ui.loupe = null; return; }
      const h = nearest(x, y, 20);
      gesture = h ? { kind: 'handle', h, x, y, moved: false } : { kind: 'pan', x, y, sx: x, sy: y, t: Date.now(), moved: false };
    });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId) || !gesture) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; ptrs.set(e.pointerId, [x, y]);
      if (gesture.kind === 'pinch' && ptrs.size >= 2) {
        const d = spread(), m = mid(); if (!gesture.d) { gesture.d = d; return; }
        zoomAt(m[0], m[1], d / gesture.d); ui.ox += m[0] - gesture.mid[0]; ui.oy += m[1] - gesture.mid[1]; gesture.d = d; gesture.mid = m; draw(); return;
      }
      if (gesture.kind === 'handle') {
        if (Math.hypot(x - gesture.x, y - gesture.y) > 3) gesture.moved = true;
        if (gesture.moved) { const p = toPhoto(x, y).map(v => Math.max(0, Math.min(1, v))); gesture.h.set(p); ui.loupe = p; redraw(false); }
        return;
      }
      if (gesture.kind === 'pan') {
        if (Math.hypot(x - gesture.sx, y - gesture.sy) > 6) gesture.moved = true;
        if (gesture.moved) { ui.ox += x - gesture.x; ui.oy += y - gesture.y; gesture.x = x; gesture.y = y; draw(); }
      }
    });
    const up = e => {
      const had = gesture; ptrs.delete(e.pointerId);
      if (ptrs.size === 0) {
        gesture = null; ui.loupe = null;
        if (had && had.kind === 'pan' && !had.moved) tap(had.sx, had.sy);
        else if (had && had.kind === 'handle' && !had.moved) tap(had.x, had.y);
        else redraw(true);
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY > 0 ? 0.87 : 1.15); draw(); }, { passive: false });
    function zoomAt(x, y, k) {
      const s = Math.max(0.05, Math.min(40, ui.scale * k)); k = s / ui.scale;
      ui.ox = x - (x - ui.ox) * k; ui.oy = y - (y - ui.oy) * k; ui.scale = s;
    }
    function spread() { const v = Array.from(ptrs.values()); return v.length < 2 ? 0 : Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); }
    function mid() { const v = Array.from(ptrs.values()); return v.length < 2 ? v[0] : [(v[0][0] + v[1][0]) / 2, (v[0][1] + v[1][1]) / 2]; }

    el.addEventListener('click', e => {
      const t = e.target.closest('[data-p]'); if (!t) return;
      const a = t.dataset.p;
      if (a === 'step') { ui.step = t.dataset.s; ui.pend = null; redraw(true); }
      else if (a === 'find') find(true);
      else if (a === 'print') opts.printCard(ui.found ? ui.found.id : 0);
      else if (a === 'turn') { const r = rec.ref, f = frame(); r.turn = f ? !(f.w !== r.w) : !r.turn; redraw(true); }
      else if (a === 'del') { (t.dataset.t === 'l' ? rec.lines : rec.marks).splice(+t.dataset.i, 1); redraw(true); }
      else if (a === 'undo') {
        if (ui.pend) ui.pend = null;
        else if (ui.step === 'height' && rec.marks.length) rec.marks.pop();
        else if (ui.step === 'dist' && rec.lines.length) rec.lines.pop();
        else if (ui.step === 'floor' && rec.floor.length) rec.floor.pop();
        else if (ui.step === 'ref' && rec.ref.pts.length) rec.ref.pts.pop();
        redraw(true);
      }
      else if (a === 'save') { const out = P.clean(Object.assign({}, rec, { at: Date.now() })); close(); if (opts.onSave) opts.onSave(out); }
      else if (a === 'close') { close(); if (opts.onClose) opts.onClose(); }
    });
    el.addEventListener('change', e => {
      const t = e.target, q = t.dataset.q; if (!q) return;
      if (q === 'kind') { const x = P.ref(t.value); rec.ref.kind = t.value; if (x) { rec.ref.w = x.w; rec.ref.h = x.h; } delete rec.ref.turn; redraw(true); }
      else if (q === 'w' || q === 'h') { const v = parseFloat(String(t.value).replace(',', '.')); if (v > 0) { rec.ref[q] = v; if (rec.ref.kind === 'kartya') rec.ref.w = rec.ref.h = v; delete rec.ref.turn; } redraw(true); }
      else if (q === 'label') { const list = t.dataset.t === 'l' ? rec.lines : rec.marks, it = list[+t.dataset.i]; if (it) it.label = t.value.trim(); }
    });
    const onResize = () => { fit(); draw(); };
    root.addEventListener && root.addEventListener('resize', onResize);
    function close() { root.removeEventListener && root.removeEventListener('resize', onResize); el.remove(); }

    /** The printed card in the photo: its corners and size into ①. again = asked by 🔍 (replaces what is there). */
    function find(again) {
      if (!MK || (!again && rec.ref.pts.length)) return null;
      let found = [];
      try { found = MK.detect(MK.fromImage(img, doc, 1600)); } catch (e) { found = []; }
      if (!again && rec.ref.pts.length) return null;           // the user tapped a corner meanwhile: theirs wins
      const d = found[0];
      if (!d) {
        ui.found = null;
        ui.note = again ? '<span class="pl-warn">Nem találtam VRG mérőkártyát ezen a fotón: koppints a referencia négy sarkára.</span>' : null;
        redraw(true); return null;
      }
      const card = MK.card(d.id), keep = rec.ref.kind === 'kartya' && rec.ref.w > 0 && again ? rec.ref.w : d.mm;   // a size typed for this card stays
      rec.ref = { kind: 'kartya', w: keep, h: keep, pts: d.pts.map(p => p.slice()) };
      ui.found = d; ui.pend = null;
      ui.note = '🔍 Megtaláltam a mérőkártyát (' + (card ? card.label.replace(/ \(.*\)$/, '') : keep + ' mm') + '): a sarkai a helyükön, húzhatók. Ha a nyomat nem pontosan ' + keep + ' mm, ①-ben írd be a fekete négyzet valódi oldalát.';
      if (ui.step === 'ref') ui.step = rec.floor.length === 2 ? 'height' : 'floor';
      redraw(true);
      return d;
    }

    fit(); redraw(true);
    // look for the card once the screen is up (a phone photo takes a moment)
    if (MK && !rec.ref.pts.length) { ui.note = '🔍 Mérőkártyát keresek a fotón…'; panel(); setTimeout(() => { if (el.parentNode) { if (rec.ref.pts.length) { ui.note = null; panel(); } else find(false); } }, 30); }
    return { el, ui, record: () => rec, frame, find, tapAt: (u, v) => { const s = toScreen([u, v]); tap(s[0], s[1]); }, toScreen, redraw, close };
  }

  /** The phone: the photo and the record from the bridge, the result back through it. */
  function run() {
    const io = root.VRGPlaneIO;
    try {
      const inp = JSON.parse(io.input()), im = new root.Image();
      im.onload = () => {
        try {
          root.__plane = open(root.document.body, { image: im, title: inp.title, record: inp.record,
            onSave: r => io.save(JSON.stringify(r)), onClose: () => io.close() });
        } catch (e) { io.fail(String(e && e.stack || e)); }
      };
      im.onerror = () => io.fail('A fotó nem tölthető be.');
      im.src = inp.image;
    } catch (e) { if (io && io.fail) io.fail(String(e && e.stack || e)); else throw e; }
  }
  return { open, run };
});
