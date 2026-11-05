// preload.js — the dashboard page's only door to the shell. The page gets window.vrg and nothing else:
// it can ask for an act id to be run, read the port states, refresh the data and move its own window.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// IPC v2 (API.md): one object payload per call, validated in main. A channel main does not know comes back as bad-request.
const BAD = { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' };
const call = async (ns, fn, payload) => {
  if (!/^[a-z][a-z0-9]{0,19}$/.test(String(ns)) || !/^[a-zA-Z][a-zA-Z0-9]{0,29}$/.test(String(fn))) return { ...BAD };
  try { return await ipcRenderer.invoke('vrg2:' + ns + '.' + fn, payload === undefined ? {} : payload); }
  catch (e) {                                                       // main has no such channel: log it page-side (DESK-Q18), never loop
    if (!(ns === 'app' && fn === 'log')) ipcRenderer.invoke('vrg2:app.log', { level: 'warn', msg: 'unknown channel ' + ns + '.' + fn }).catch(() => {});
    return { ...BAD };
  }
};
const on = (ns, type, cb) => {
  if (typeof cb !== 'function') return () => {};
  const h = (e, m) => { if (m && m.ns === ns && m.type === type) cb(m); };
  ipcRenderer.on('vrg2:evt', h);
  return () => ipcRenderer.removeListener('vrg2:evt', h);
};

contextBridge.exposeInMainWorld('vrg', {
  call, on,
  app: {
    info: () => call('app', 'info', {}),
    mode: p => call('app', 'mode', p),
    toggleOverlay: () => call('app', 'toggleOverlay', {}),
    autostart: p => call('app', 'autostart', p),
    log: (level, msg) => call('app', 'log', { level, msg: String(msg).slice(0, 500) }),
    setting: (k, v) => call('app', 'setting', v === undefined ? { k } : { k, v }),
  },
  layout: {
    get: () => call('layout', 'get', {}),
    set: tree => call('layout', 'set', { tree }),
    bounds: (viewId, rect) => call('layout', 'bounds', { viewId, rect }),
    palette: p => call('layout', 'palette', p === undefined ? {} : p),          // { open: bool } hides / shows the web views
    run: cmdId => call('layout', 'run', { cmdId }),
  },
  jobs: {
    list: () => call('jobs', 'list', {}),
    cancel: job => call('jobs', 'cancel', { job }),
    answer: (job, choice, all) => call('jobs', 'answer', all === undefined ? { job, choice } : { job, choice, all }),
  },
  fs: {
    roots: () => call('fs', 'roots', {}),
    list: (dir, o) => call('fs', 'list', { dir, ...(o && typeof o === 'object' ? { sort: o.sort, filter: o.filter } : {}) }),
    stat: h => call('fs', 'stat', { h }),
    copy: (src, dst, policy) => call('fs', 'copy', { src, dst, policy: policy || 'ask' }),
    move: (src, dst, policy) => call('fs', 'move', { src, dst, policy: policy || 'ask' }),
    rename: (h, name) => call('fs', 'rename', { h, name }),
    mkdir: (dir, name) => call('fs', 'mkdir', { dir, name }),
    trash: h => call('fs', 'trash', { h }),
    answer: (job, choice, all) => call('fs', 'answer', all === undefined ? { job, choice } : { job, choice, all }),
    read: (h, o) => call('fs', 'read', { h, ...(o && typeof o === 'object' ? { max: o.max, fetch: o.fetch } : {}) }),
    open: h => call('fs', 'open', { h }),
    reveal: h => call('fs', 'reveal', { h }),
    edit: h => call('fs', 'edit', { h }),
    copyPath: h => call('fs', 'copyPath', { h }),
  },
  term: {
    profiles: () => call('term', 'profiles', {}),
    open: (prof, at) => call('term', 'open', at === undefined ? { prof } : { prof, at }),
    write: (term, data) => call('term', 'write', { term, data }),
    resize: (term, cols, rows) => call('term', 'resize', { term, cols, rows }),
    kill: term => call('term', 'kill', { term }),
  },
  web: {                                                                         // events: vrg.on('web', 'state' | 'ask' | 'download', cb)
    open: (target, o) => call('web', 'open', o && typeof o === 'object' && typeof o.newTab === 'boolean' ? { target, newTab: o.newTab } : { target }),
    nav: (view, cmd) => call('web', 'nav', { view, cmd }),
    close: view => call('web', 'close', { view }),
    answer: (ask, allow) => call('web', 'answer', { ask, allow }),
  },
  act: id => ipcRenderer.invoke('vrg:act', String(id)),
  ports: () => ipcRenderer.invoke('vrg:ports'),
  onPorts: cb => ipcRenderer.on('vrg:ports', (e, p) => cb(p)),
  onMax: cb => ipcRenderer.on('vrg:max', (e, m) => cb(m)),
  refresh: () => ipcRenderer.invoke('vrg:refresh'),
  win: cmd => ipcRenderer.send('vrg:win', String(cmd)),
});
