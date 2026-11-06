// city-touch.js — VRG Mobile, WP M5 (Kódváros online): touch for Kódváros inside the phone's WebView.
//
// Kódváros's camera (CodeCity/src/03-scene.js) is made for a mouse: left drag orbits, right drag pans, the
// wheel zooms, a click without movement picks. A finger is a left button there, so one finger already orbits
// and taps already pick, but a second finger only makes the orbit jump. This adapter sits in front of the
// canvas (window, capture phase) and turns real touches into those mouse gestures, so Kódváros itself needs
// no change:
//   one finger     -> held back until it moves 6 px (then left drag = orbit) or lifts (then a click = pick)
//   two fingers    -> right drag at their midpoint (pan) + wheel steps from the change in their distance (zoom)
//   a third finger -> ignored; after a two-finger gesture nothing happens until every finger is up
// Only trusted touch pointers that start on the canvas are taken; buttons, panels and every mouse are left
// alone. FeatureCity injects it when a page has loaded; Mobile/tests/city-touch.js tests it in headless Chrome.
(() => {
  if (window.__vrgTouch) return;
  const cv = document.getElementById('gl');
  if (!cv) return;
  window.__vrgTouch = { version: 1 };

  const SLOP = 6;                 // px a finger may wander and still be a tap
  const pts = new Map();          // touch pointerId -> {x, y}
  let mode = null;                // null | 'wait' | 'orbit' | 'two' | 'done'
  let first = null;               // the first finger: {id, x0, y0}
  let two = null;                 // {mx, my, d, moved}

  const fire = (type, x, y, button) => cv.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button,
    buttons: type === 'pointerup' ? 0 : (button === 2 ? 2 : 1),
    pointerId: first.id, pointerType: 'mouse', isPrimary: true,
  }));
  const wheel = (x, y, deltaY) => cv.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY, deltaMode: 0,
  }));
  const mid = () => {
    const [a, b] = [...pts.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const take = e => { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); };

  function startTwo() {
    const m = mid();
    two = { mx: m.x, my: m.y, d: m.d, moved: 0 };
    fire('pointerdown', m.x, m.y, 2);
    mode = 'two';
  }
  function endTwo() {
    // a right button let go without moving is Kódváros's context menu: move 4 px out and back first
    if (two.moved < 4) { fire('pointermove', two.mx + 2, two.my, 2); fire('pointermove', two.mx, two.my, 2); }
    fire('pointerup', two.mx, two.my, 2);
    two = null;
    mode = 'done';
  }

  addEventListener('pointerdown', e => {
    if (!e.isTrusted || e.pointerType !== 'touch') return;
    if (!pts.size && e.target !== cv) return;          // a finger on a panel or a button: not ours
    take(e);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { mode = 'wait'; first = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; return; }
    if (pts.size === 2 && (mode === 'wait' || mode === 'orbit')) {
      if (mode === 'orbit') { const p = pts.get(first.id); fire('pointerup', p.x, p.y, 0); }   // it moved > 6 px: no pick
      startTwo();
    }
  }, true);

  addEventListener('pointermove', e => {
    if (!e.isTrusted || !pts.has(e.pointerId)) return;
    take(e);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'wait') {
      if (Math.hypot(e.clientX - first.x0, e.clientY - first.y0) > SLOP) {
        fire('pointerdown', first.x0, first.y0, 0);
        fire('pointermove', e.clientX, e.clientY, 0);
        mode = 'orbit';
      }
    } else if (mode === 'orbit') {
      fire('pointermove', e.clientX, e.clientY, 0);
    } else if (mode === 'two' && pts.size >= 2 && !frame) {
      // the fingers' moves arrive one pointer at a time: read both once per frame, or a parallel drag
      // would look like a pinch for half an event
      frame = requestAnimationFrame(stepTwo);
    }
  }, true);

  let frame = 0;
  function stepTwo() {
    frame = 0;
    if (mode !== 'two' || pts.size < 2) return;
    const m = mid();
    two.moved += Math.abs(m.x - two.mx) + Math.abs(m.y - two.my);
    two.mx = m.x; two.my = m.y;
    fire('pointermove', m.x, m.y, 2);
    // 03-scene: r *= exp(deltaY * 0.001); fingers apart -> closer. Small changes add up until they count.
    if (two.d > 0 && m.d > 0) {
      const k = Math.log(m.d / two.d);
      if (Math.abs(k) > 0.004) { wheel(m.x, m.y, -k / 0.001); two.d = m.d; }
    }
  }

  const up = e => {
    if (!e.isTrusted || !pts.has(e.pointerId)) return;
    take(e);
    pts.delete(e.pointerId);
    const cancel = e.type === 'pointercancel';
    if (mode === 'wait' && !pts.size) {
      if (!cancel) { fire('pointerdown', first.x0, first.y0, 0); fire('pointerup', first.x0, first.y0, 0); }   // a tap: pick
    } else if (mode === 'orbit' && !pts.size) {
      fire('pointerup', e.clientX, e.clientY, 0);
    } else if (mode === 'two' && pts.size < 2) {
      if (frame) { cancelAnimationFrame(frame); frame = 0; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); stepTwo(); pts.delete(e.pointerId); }   // the last frame's move first
      endTwo();
    }
    if (!pts.size) { mode = null; first = null; }
  };
  addEventListener('pointerup', up, true);
  addEventListener('pointercancel', up, true);
})();
