/* The page carousel. Only the current page and the one sliding in exist, so a catalogue of any
   size stays light and the wrap from last to first is one step, not a run across every page.
   Swiping is a shortcut: the arrows and dots in the page bar do the same thing. */
const SETTLE_MS = 340;
const EDGE_PX = 24;          // leave the OS back-gesture edges alone
const LOCK_PX = 8;
const IGNORE = 'input, textarea, select, button, a, label, summary, [data-noswipe]';

export const wrapIndex = (i, n) => ((i % n) + n) % n;

/* The shorter way round decides the slide direction. */
export function slideDirection(from, to, n) {
  const forward = wrapIndex(to - from, n);
  return forward <= n - forward ? 1 : -1;
}

export function createCarousel({ view, mountPage, onChange, reducedMotion }) {
  let pages = [];
  let index = 0;
  let current = null;        // { id, node, unmount }
  let incoming = null;
  let settle = null;         // finish function of a running slide
  let drag = null;

  const place = (slot, offset, px = 0) => { slot.node.style.transform = `translateX(calc(${offset}% + ${px}px))`; };

  function open(id, offset) {
    const slot = mountPage(id);
    view.append(slot.node);
    place(slot, offset);
    slot.node.inert = offset !== 0;
    return slot;
  }
  function close(slot) {
    slot.unmount?.();
    slot.node.remove();
  }
  function commit(target) {
    close(current);
    current = incoming;
    incoming = null;
    index = target;
    current.node.classList.remove('anim');
    current.node.inert = false;
    place(current, 0);
    onChange(index);
  }
  function animate(target, dir) {
    if (reducedMotion()) { commit(target); return; }
    const from = current;
    const to = incoming;
    to.node.getBoundingClientRect();
    from.node.classList.add('anim');
    to.node.classList.add('anim');
    place(from, -100 * dir);
    place(to, 0);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      settle = null;
      commit(target);
    };
    const timer = setTimeout(finish, SETTLE_MS);
    to.node.addEventListener('transitionend', finish, { once: true });
    settle = finish;
  }

  function go(target, dirHint) {
    settle?.();
    const n = pages.length;
    if (n < 2) return;
    const to = wrapIndex(target, n);
    if (to === index) return;
    const dir = dirHint ?? slideDirection(index, to, n);
    incoming = open(pages[to], 100 * dir);
    animate(to, dir);
  }

  /* swipe, with a direction lock so vertical scrolling inside a page still works */
  function onDown(e) {
    if (e.button !== 0 || pages.length < 2 || settle || e.target.closest(IGNORE)) return;
    if (e.pointerType === 'touch' && (e.clientX < EDGE_PX || e.clientX > innerWidth - EDGE_PX)) return;
    drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, lock: null, dir: 0, dx: 0 };
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.lock) {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      drag.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.lock === 'x') view.setPointerCapture?.(drag.id);
    }
    if (drag.lock !== 'x') return;
    const dir = dx < 0 ? 1 : -1;
    if (dir !== drag.dir) {
      if (incoming) close(incoming);
      incoming = open(pages[wrapIndex(index + dir, pages.length)], 100 * dir);
      drag.dir = dir;
    }
    drag.dx = dx;
    place(current, 0, dx);
    place(incoming, 100 * dir, dx);
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.lock !== 'x' || !incoming) return;
    const width = view.clientWidth;
    const fast = Math.abs(d.dx) / Math.max(1, e.timeStamp - d.t) > 0.5;
    const passed = Math.abs(d.dx) > width * 0.18 || (fast && Math.abs(d.dx) > 30);
    if (passed && e.type === 'pointerup') { animate(wrapIndex(index + d.dir, pages.length), d.dir); return; }
    close(incoming);
    incoming = null;
    place(current, 0);
  }
  view.addEventListener('pointerdown', onDown);
  view.addEventListener('pointermove', onMove);
  view.addEventListener('pointerup', onUp);
  view.addEventListener('pointercancel', onUp);

  return {
    get index() { return index; },
    get pageId() { return pages[index]; },
    go,
    next: () => go(index + 1, 1),
    prev: () => go(index - 1, -1),
    /* New page list, staying on the same page when it still exists. */
    setPages(ids, keepId) {
      settle?.();
      pages = ids.slice();
      const at = pages.indexOf(keepId);
      index = at < 0 ? 0 : at;
      if (current) close(current);
      current = open(pages[index], 0);
      onChange(index);
    },
    /* Re-render the visible page, after a language or density change. */
    refresh() {
      settle?.();
      if (current) close(current);
      current = open(pages[index], 0);
    },
  };
}
