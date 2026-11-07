/* VRG Stack pages: touch gestures for the 3D canvases (connectome.html, orb.html; VRG Mobile WP M17).
   Mouse input stays with each page's own handlers; this file takes only pointerType 'touch'.
     one finger drag  -> orbit (h.orbit(dx, dy))
     tap              -> pick (h.tap(x, y)); a second tap within 300 ms -> h.dbl(x, y) (reset the view)
     long press 0.5 s -> h.long(x, y) (select and show the card)
     two fingers      -> pinch = h.zoom(factor), twist = h.twist(radians), parallel vertical move = h.tilt(dy)
     two-finger swipe -> h.swipe(+1 | -1) once per gesture (left = +1): a long horizontal move with little pinch
   The canvas needs `touch-action: none`, so the browser never scrolls or zooms the page under the gesture.
   Plain script (no modules), so it works from file:// and inlined in the phone bundle. */
(function () {
  'use strict';
  function attach(el, h) {
    const pts = new Map();
    let mode = null, moved = false, longT = null, lastTap = 0, g = null, lastXY = [0, 0];
    const rel = (x, y) => { const r = el.getBoundingClientRect(); return [x - r.left, y - r.top]; };
    const pair = () => { const [a, b] = [...pts.values()]; return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) }; };
    const busy = on => { if (h.dragging) h.dragging(on); };
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      e.preventDefault(); e.stopImmediatePropagation();
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      clearTimeout(longT);
      if (pts.size === 1) {
        mode = 'one'; moved = false; lastXY = [e.clientX, e.clientY];
        longT = setTimeout(() => {
          if (mode === 'one' && !moved && pts.size === 1) { mode = 'done'; if (h.long) h.long(...rel(...lastXY)); if (navigator.vibrate) navigator.vibrate(12); }
        }, 500);
      } else if (pts.size === 2) {
        if (moved) busy(false);
        mode = 'two'; const p = pair(); g = { ...p, sx: p.cx, sy: p.cy, d0: p.d, a0: p.ang, swiped: false }; busy(true);
      } else mode = 'many';
    }, { passive: false, capture: true });
    el.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (mode === 'one') {
        if (!moved && Math.hypot(p.x - p.x0, p.y - p.y0) < 8) return;   // still a tap
        if (!moved) { moved = true; clearTimeout(longT); busy(true); }
        if (h.orbit) h.orbit(dx, dy);
      } else if (mode === 'two' && pts.size === 2) {
        const q = pair();
        if (g.d > 4 && q.d > 4 && h.zoom) h.zoom(g.d / q.d);
        let da = q.ang - g.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        if (h.twist) h.twist(da);
        if (h.tilt) h.tilt(q.cy - g.cy);
        if (!g.swiped && h.swipe && Math.abs(q.cx - g.sx) > 120 && Math.abs(q.cx - g.sx) > 2 * Math.abs(q.cy - g.sy) && Math.abs(q.d - g.d0) < 70) {
          g.swiped = true; h.swipe(q.cx < g.sx ? 1 : -1);
        }
        Object.assign(g, q);
      }
    }, { passive: false, capture: true });
    const end = e => {
      const p = pts.get(e.pointerId); if (!p) return;
      e.stopImmediatePropagation();
      pts.delete(e.pointerId); clearTimeout(longT);
      if (mode === 'one' && pts.size === 0 && !moved && e.type === 'pointerup') {
        const now = performance.now(), [x, y] = rel(e.clientX, e.clientY);
        if (now - lastTap < 300) { lastTap = 0; if (h.dbl) h.dbl(x, y); } else { lastTap = now; if (h.tap) h.tap(x, y); }
      }
      if (pts.size === 0) { if (mode !== 'one' || moved) busy(false); mode = null; }
      else mode = 'settle';   // one finger left after a pinch: wait for a fresh touch, never jump into an orbit
    };
    el.addEventListener('pointerup', end, { capture: true });
    el.addEventListener('pointercancel', end, { capture: true });
    el.addEventListener('contextmenu', e => { if (pts.size) e.preventDefault(); });
  }
  window.StackTouch = { attach };
})();
