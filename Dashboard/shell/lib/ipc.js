// ipc.js — IPC v2: a schema-checked channel registry (API.md, CONTRACT §3). Every check fails closed.
//   const ipc = createIpc({ ipcMain, audit, allowedUrls: () => [pageUrl, ...] });
//   ipc.register('app', 'info', {}, async (payload, event) => ({ ... }));    → channel 'vrg2:app.info'
// A type is a function (value) → true | false. Electron objects are passed in, so node --test can load this file.
'use strict';

const BAD = { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' };
const FAILED = { ok: false, err: 'error', hu: 'Hiba történt.' };

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = v => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;   // kept equal to lib/names.js (DESK-Q20; a test checks both)
function isName(s) {                                                // CONTRACT §3: a basename, never a path
  if (typeof s !== 'string' || !s.length || s.length > 200) return false;
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(s)) return false;
  if (s.includes('..') || /[. ]$/.test(s) || RESERVED.test(s)) return false;
  return true;
}
function isHttpUrl(s) {
  if (typeof s !== 'string' || !s.length || s.length > 4096) return false;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; }
}
function jsonSize(v, depth = 0) {                                   // -1 when v is not plain JSON
  if (depth > 12) return -1;
  if (v === null || typeof v === 'boolean') return 4;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).length : -1;
  if (typeof v === 'string') return v.length + 2;
  if (Array.isArray(v)) { let n = 2; for (const x of v) { const s = jsonSize(x, depth + 1); if (s < 0) return -1; n += s + 1; } return n; }
  if (isPlain(v)) {
    let n = 2;
    for (const k of Object.keys(v)) { if (k === '__proto__') return -1; const s = jsonSize(v[k], depth + 1); if (s < 0) return -1; n += k.length + 3 + s; }
    return n;
  }
  return -1;
}

const types = {
  id: v => typeof v === 'string' && /^[a-z0-9:_./-]{1,80}$/.test(v),
  handle: v => typeof v === 'string' && /^h:[A-Za-z0-9_-]{22}$/.test(v),
  name: isName,
  url: isHttpUrl,
  text: n => v => typeof v === 'string' && v.length <= n,
  int: (a, b) => v => Number.isInteger(v) && v >= a && v <= b,
  bool: v => typeof v === 'boolean',
  enum: (...vals) => v => typeof v === 'string' && vals.includes(v),
  arr: (t, max) => v => Array.isArray(v) && v.length <= max && v.every(t),
  // obj({ key: type }, { optional: ['key'] }): a plain object with exactly the schema keys (optional ones may be absent)
  obj: (shape, opts = {}) => {
    const optional = new Set(Array.isArray(opts) ? opts : opts.optional || []);
    return v => {
      if (!isPlain(v)) return false;
      const keys = Object.keys(v);
      if (keys.some(k => !has(shape, k))) return false;
      for (const k of Object.keys(shape)) {
        if (!has(v, k) || v[k] === undefined) { if (!optional.has(k)) return false; continue; }
        if (!shape[k](v[k])) return false;
      }
      return true;
    };
  },
  json: maxBytes => v => { const s = jsonSize(v); return s >= 0 && s <= maxBytes; },
};

// a schema is a map { key: type } (or a ready-made obj type); {} means "no payload"
function compile(schema, opts) {
  if (typeof schema === 'function') return schema;
  if (!isPlain(schema)) throw new Error('ipc: schema must be a map of types');
  for (const k of Object.keys(schema)) if (typeof schema[k] !== 'function') throw new Error('ipc: schema key ' + k + ' is not a type');
  return types.obj(schema, opts);
}

function createIpc({ ipcMain, audit, allowedUrls = () => [], log = () => {} }) {
  const channels = new Map();                                       // 'ns.fn' → { check }
  const w = entry => { try { audit && audit.write(entry); } catch (e) {} };
  const same = (a, b) => String(a).split('#')[0].toLowerCase() === String(b).split('#')[0].toLowerCase();
  const senderOk = e => {
    const url = e && e.senderFrame && e.senderFrame.url;
    return typeof url === 'string' && allowedUrls().some(u => same(u, url));
  };

  function register(ns, fn, schema, handler, opts) {
    if (!/^[a-z][a-z0-9]{0,19}$/.test(ns) || !/^[a-zA-Z][a-zA-Z0-9]{0,29}$/.test(fn)) throw new Error('ipc: bad channel name');
    if (typeof handler !== 'function') throw new Error('ipc: handler missing');
    const name = ns + '.' + fn;
    if (channels.has(name)) throw new Error('ipc: ' + name + ' already registered');
    const check = compile(schema, opts);
    channels.set(name, { check });
    ipcMain.handle('vrg2:' + name, async (event, payload) => {
      if (!senderOk(event)) {
        w({ ch: name, ok: false, err: 'forbidden', sender: String(event && event.senderFrame && event.senderFrame.url || '') });
        return { ...BAD };                                          // DESK-Q19: a refused sender learns no more than bad-request
      }
      let good = false;
      try { good = check(payload === undefined ? {} : payload) === true; } catch (e) { good = false; }
      if (!good) { w({ ch: name, ok: false, err: 'bad-request', payload }); return { ...BAD }; }
      try {
        const r = await handler(payload === undefined ? {} : payload, event);
        w({ ch: name, ok: !(r && r.ok === false) });
        return r && typeof r.ok === 'boolean' ? r : { ok: true, ...(r || {}) };
      } catch (e) {
        w({ ch: name, ok: false, err: 'error', message: String(e && e.message), stack: String(e && e.stack || '').split('\n').slice(0, 8) });
        log('ipc handler failed', name);
        return { ...FAILED };
      }
    });
  }

  // the D1 channels (vrg:act / ports / refresh / win) predate the registry: same sender check; refused → audit line, no action
  function legacy(kind, channel, handler) {
    const wrap = (event, ...args) => {
      if (!senderOk(event)) {
        w({ ch: channel, ok: false, err: 'forbidden', sender: String(event && event.senderFrame && event.senderFrame.url || '') });
        return kind === 'handle' ? { ...BAD } : undefined;
      }
      return handler(event, ...args);
    };
    if (kind === 'handle') ipcMain.handle(channel, wrap); else ipcMain.on(channel, wrap);
  }

  function emit(win, ns, type, data) {
    if (!win || win.isDestroyed()) return false;
    win.webContents.send('vrg2:evt', { ...(isPlain(data) ? data : {}), ns, type });
    return true;
  }

  const namespaces = () => [...new Set([...channels.keys()].map(n => n.split('.')[0]))];
  return { register, legacy, senderOk, emit, namespaces, has: name => channels.has(name) };
}

module.exports = { createIpc, types, compile, isPlain };
