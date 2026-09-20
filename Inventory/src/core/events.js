// Minimal event bus. Features talk to core directly, but never to each other —
// they meet here, and app.js is the only place that subscribes across features.

function createBus() {
  const handlers = new Map();

  function on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => off(type, fn);
  }

  function off(type, fn) {
    const set = handlers.get(type);
    if (set) set.delete(fn);
  }

  function emit(type, payload) {
    const set = handlers.get(type);
    if (!set) return 0;
    // copy: a handler may unsubscribe itself while we iterate
    for (const fn of [...set]) fn(payload);
    return set.size;
  }

  function types() {
    return [...handlers.keys()].filter(t => handlers.get(t).size);
  }

  return { on, off, emit, types };
}

export { createBus };
