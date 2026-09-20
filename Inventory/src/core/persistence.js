// Storage adapter.
//
// Every failure mode here is real and has been seen in the wild: storage
// disabled by the browser, a private window that throws on write, a full
// quota, and a half-written value from a tab that was closed mid-save. None
// of them may take the app down — a catalogue that cannot save is still a
// usable catalogue, so every operation reports failure instead of throwing.

const PREFIX = 'vrg.inventory.';

function detect() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    const probe = PREFIX + '__probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch (e) {
    return null;                              // disabled, or a throwing private window
  }
}

function createStorage(opts) {
  const backend = (opts && opts.storage !== undefined) ? opts.storage : detect();
  const prefix = (opts && opts.prefix) || PREFIX;
  const onError = (opts && opts.onError) || (() => { });
  const available = !!backend;

  function key(k) { return prefix + k; }

  function read(k, fallback) {
    if (!available) return fallback === undefined ? null : fallback;
    let raw;
    try {
      raw = backend.getItem(key(k));
    } catch (e) {
      onError({ op: 'read', key: k, error: e });
      return fallback === undefined ? null : fallback;
    }
    if (raw == null) return fallback === undefined ? null : fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      // corrupt value: keep a copy so nothing is silently destroyed, then move on
      onError({ op: 'parse', key: k, error: e, raw });
      try { backend.setItem(key(k + '.corrupt.' + Date.now()), raw); } catch (_) { }
      try { backend.removeItem(key(k)); } catch (_) { }
      return fallback === undefined ? null : fallback;
    }
  }

  function write(k, value) {
    if (!available) return { ok: false, reason: 'unavailable' };
    let json;
    try {
      json = JSON.stringify(value);
    } catch (e) {
      onError({ op: 'serialize', key: k, error: e });
      return { ok: false, reason: 'serialize', error: e };
    }
    try {
      backend.setItem(key(k), json);
      return { ok: true, bytes: json.length };
    } catch (e) {
      const quota = /quota|exceeded|NS_ERROR_DOM_QUOTA/i.test(String(e && (e.name + ' ' + e.message)));
      onError({ op: 'write', key: k, error: e, quota });
      return { ok: false, reason: quota ? 'quota' : 'write', error: e };
    }
  }

  function remove(k) {
    if (!available) return false;
    try { backend.removeItem(key(k)); return true; } catch (e) { onError({ op: 'remove', key: k, error: e }); return false; }
  }

  /** Every key this app owns, without the prefix. */
  function keys() {
    if (!available) return [];
    const out = [];
    try {
      for (let i = 0; i < backend.length; i++) {
        const k = backend.key(i);
        if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
      }
    } catch (e) { onError({ op: 'keys', error: e }); }
    return out;
  }

  function clearAll() {
    for (const k of keys()) remove(k);
  }

  return { available, read, write, remove, keys, clearAll, prefix };
}

/**
 * Coalesce rapid changes into one write. Typing a note should not hit storage
 * on every keystroke, but closing the tab must not lose the last one either —
 * hence flush().
 */
function createAutosave(storage, k, getState, opts) {
  const delay = (opts && opts.delay) != null ? opts.delay : 400;
  const onSave = (opts && opts.onSave) || (() => { });
  let timer = null;
  let pending = false;

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!pending) return null;
    pending = false;
    const result = storage.write(k, getState());
    onSave(result);
    return result;
  }

  function schedule() {
    pending = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = false;
  }

  return { schedule, flush, cancel, isPending: () => pending };
}

export { createStorage, createAutosave, PREFIX };
