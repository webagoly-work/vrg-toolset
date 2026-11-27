// Sketcher/lib/roombox-snap.js — 📐 Sarok (dev line skcam, K1 polish): a Fotópont photo full screen with the room's
// corners drawn where the box puts them (dashed). Drag a corner's line onto the corner seen in the photo: one corner
// fixes the photo's direction, two or more fix the direction and the field of view (lib/roombox.js snap). The lines
// move to show the result; ✓ Alkalmaz hands { yaw, f35? } back. The Desktop page and the phone's WebView
// (lib/roombox-phone.js) open the same screen. DOM only, no library.
//
//   const s = VRGRoomBoxSnap.open({ RB, room, shot, image, document, onApply(fix), onClose() })
//   s.setMark(i, u) · s.marks() · s.result() · s.apply() · s.close() · s.lines()
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VRGRoomBoxSnap = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const CSS = '.rbsnap{position:fixed;inset:0;z-index:60;background:#0a141c;color:#e8eef2;display:grid;grid-template-rows:auto 1fr auto;font:14px system-ui,sans-serif}' +
    '.rbsnap .hd{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#13212c;border-bottom:1px solid #263744}.rbsnap .hd b{flex:1}' +
    '.rbsnap button{min-height:40px;min-width:44px;padding:0 12px;border:1px solid #3a4d5c;border-radius:8px;background:#17293a;color:#e8eef2;font:inherit}' +
    '.rbsnap button.ok{background:#1f6fb2;border-color:#1f6fb2}.rbsnap button:disabled{opacity:.45}' +
    '.rbsnap .stage{position:relative;overflow:hidden;touch-action:none;display:flex;align-items:center;justify-content:center}' +
    '.rbsnap .wrap{position:relative}.rbsnap canvas,.rbsnap svg{display:block}.rbsnap svg{position:absolute;inset:0;width:100%;height:100%}' +
    '.rbsnap .ft{padding:8px 10px 12px;background:#13212c;border-top:1px solid #263744;font-size:13px;line-height:1.4}.rbsnap .ft .r{color:#7fd1c7;font-weight:600}';
  const f1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const LETTER = i => String.fromCharCode(65 + (i % 26));

  function open(o) {
    const RB = o.RB || root.VRGRoomBox, doc = o.document || root.document, room = o.room, shot = o.shot, image = o.image;
    if (!doc.getElementById('rbsnap-css')) { const st = doc.createElement('style'); st.id = 'rbsnap-css'; st.textContent = CSS; doc.head.appendChild(st); }
    const el = doc.createElement('div'); el.className = 'rbsnap';
    el.innerHTML = '<div class="hd"><b>📐 Sarok · ' + (shot.side || shot.deg + '°') + '</b><button data-s="reset" title="A húzások törlése">↺</button>' +
      '<button data-s="close" aria-label="Bezár">✕</button><button class="ok" data-s="apply" disabled>✓ Alkalmaz</button></div>' +
      '<div class="stage"><div class="wrap"><canvas></canvas><svg preserveAspectRatio="none"></svg></div></div>' +
      '<div class="ft"></div>';
    doc.body.appendChild(el);
    const stage = el.querySelector('.stage'), wrap = el.querySelector('.wrap'), cv = el.querySelector('canvas'), svg = el.querySelector('svg'), ft = el.querySelector('.ft');
    const aspect = shot.tanH / shot.tanV;          // the photo's width / height
    const marks = new Map();                       // corner index -> u the user dragged it to
    let res = null, drag = null, W = 0, H = 0;

    /** The shot as the result would make it (direction and lens), to draw the lines where they will land. */
    const tried = () => {
      if (!res) return shot;
      const yaw = shot.deg + res.yaw, fv = res.f35 ? RB.fov(res.f35, aspect, 1) : { tanH: shot.tanH, tanV: shot.tanV };
      return Object.assign({}, shot, { yaw, basis: RB.basis(yaw, shot.pitch), tanH: fv.tanH, tanV: fv.tanV });
    };
    const lines = () => RB.cornerLines(room, tried());

    function layout() {
      const sw = stage.clientWidth || 800, sh = stage.clientHeight || 600;
      W = Math.min(sw, sh * aspect); H = W / aspect;
      wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
      const k = (root.devicePixelRatio || 1);
      cv.width = Math.round(W * k); cv.height = Math.round(H * k); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const g = cv.getContext('2d');
      if (image) g.drawImage(image, 0, 0, cv.width, cv.height); else { g.fillStyle = '#26323c'; g.fillRect(0, 0, cv.width, cv.height); }
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      paint();
    }
    function paint() {
      const L = lines();
      let s = '';
      L.forEach(l => {
        const m = marks.has(l.i), x = l.u * W;
        const b = l.bottom ? [l.bottom[0] * W, l.bottom[1] * H] : [x, H], t = l.top ? [l.top[0] * W, l.top[1] * H] : [x, 0];
        // the box's corner (dashed; solid green once it sits on a dragged mark)
        s += '<line x1="' + b[0] + '" y1="' + b[1] + '" x2="' + t[0] + '" y2="' + t[1] + '" stroke="' + (m ? '#3fd28b' : '#ffb347') + '" stroke-width="' + (m ? 3 : 2.5) + '"' + (m ? '' : ' stroke-dasharray="10 7"') + '/>';
        s += '<circle cx="' + x + '" cy="' + (H / 2) + '" r="16" fill="' + (m ? '#3fd28b' : '#ffb347') + '" fill-opacity="0.85"/>' +
          '<text x="' + x + '" y="' + (H / 2 + 5) + '" text-anchor="middle" font-size="15" font-weight="700" fill="#0a141c">' + LETTER(l.i) + '</text>';
      });
      // where the user dragged each corner (a thin white guide)
      marks.forEach((u, i) => { s += '<line x1="' + u * W + '" y1="0" x2="' + u * W + '" y2="' + H + '" stroke="#fff" stroke-opacity="0.55" stroke-width="1"/>'; });
      svg.innerHTML = s;
      el.querySelector('[data-s="apply"]').disabled = !res;
      ft.innerHTML = !L.length ? 'Ebből a pontból egy sarok sem látszik ebben az irányban.'
        : !marks.size ? 'Húzd a narancs vonalat oldalra, a fotón látható sarokra. Egy sarok az irányt javítja, kettő az irányt és a látószöget is.'
        : res ? '<span class="r">Irány ' + (res.yaw >= 0 ? '+' : '') + f1(res.yaw) + '°' + (res.f35 ? ' · látószög ' + f1(res.f35) + ' mm' : '') + '</span>' +
          (marks.size === 1 ? ' · húzz még egy sarkot a látószöghöz is' : '') + ' · ✓ Alkalmaz'
        : 'Ezek a sarkak így nem férnek egy képbe (talán felcserélődtek): húzd újra.';
    }
    function recompute() { res = marks.size ? RB.snap(room, shot, [...marks].map(([i, u]) => ({ i, u }))) : null; paint(); }

    // dragging: the nearest corner line within 28 px of the finger, sideways only
    const at = e => { const r = wrap.getBoundingClientRect(); return [(e.clientX - r.left), (e.clientY - r.top)]; };
    stage.addEventListener('pointerdown', e => {
      const [x] = at(e); let best = null;
      lines().forEach(l => { const d = Math.abs(l.u * W - x); if (d < 28 && (!best || d < best.d)) best = { i: l.i, d, off: l.u * W - x }; });
      if (!best) return;
      drag = best; try { stage.setPointerCapture(e.pointerId); } catch (x2) { /* synthetic */ }
      e.preventDefault();
    });
    stage.addEventListener('pointermove', e => {
      if (!drag) return;
      const [x] = at(e); marks.set(drag.i, Math.max(-0.2, Math.min(1.2, (x + drag.off) / W)));
      res = null; paint();
    });
    const end = () => { if (drag) { drag = null; recompute(); } };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-s]'); if (!a) return;
      if (a.dataset.s === 'reset') { marks.clear(); res = null; paint(); }
      else if (a.dataset.s === 'close') api.close();
      else if (a.dataset.s === 'apply') api.apply();
    });
    const onResize = () => layout();
    root.addEventListener && root.addEventListener('resize', onResize);

    const api = {
      el,
      setMark(i, u) { marks.set(i, u); recompute(); return res; },
      marks: () => [...marks].map(([i, u]) => ({ i, u })),
      result: () => res,
      lines,
      apply() { if (!res) return false; const fix = { yaw: res.yaw }; if (res.f35) fix.f35 = res.f35; if (o.onApply) o.onApply(fix); api.close(); return true; },
      close() { if (!el.parentNode) return; el.remove(); root.removeEventListener && root.removeEventListener('resize', onResize); if (o.onClose) o.onClose(); },
    };
    layout();
    return api;
  }
  return { open };
});
