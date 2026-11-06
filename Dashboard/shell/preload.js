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
    go: (view, input) => call('web', 'go', { view, input }),
    find: (view, q, dir) => call('web', 'find', dir === undefined ? { view, q } : { view, q, dir }),
    zoom: (view, z) => call('web', 'zoom', { view, z }),
    external: view => call('web', 'external', { view }),
    bookmarks: () => call('web', 'bookmarks', {}),
    bookmark: view => call('web', 'bookmark', { view }),
    history: q => call('web', 'history', q === undefined ? {} : { q }),
    clearHistory: () => call('web', 'clearHistory', {}),
    servers: () => call('web', 'servers', {}),
  },
  sel: {                                                                         // event: vrg.on('sel', 'pick', cb) → { action, text }
    menu: (text, origin, o) => call('sel', 'menu', o && o.dryRun === true ? { text, origin, dryRun: true } : { text, origin }),
  },
  search: {
    inner: (q, o) => call('search', 'inner', { q, ...(o && typeof o === 'object' ? Object.fromEntries(['layers', 'budget'].filter(k => o[k] !== undefined).map(k => [k, o[k]])) : {}) }),
    quick: input => call('search', 'quick', { input: String(input == null ? '' : input).slice(0, 500) }),   // event: vrg.on('quick', 'open', cb)
    openHit: (kind, i) => call('search', 'openHit', { kind, i }),
    node: id => call('search', 'node', { id }),
  },
  ctx: {
    expand: (ids, layers, depth) => call('ctx', 'expand', { ids, layers, depth }),
    pack: (ids, o) => call('ctx', 'pack', { ids, ...(o && typeof o === 'object' ? Object.fromEntries(['budget', 'withL0', 'withLines', 'note'].filter(k => o[k] !== undefined).map(k => [k, o[k]])) : {}) }),
    clusters: () => call('ctx', 'clusters', {}),
    saveCluster: (name, ids) => call('ctx', 'saveCluster', { name, ids }),
    deleteCluster: id => call('ctx', 'deleteCluster', { id }),
    sendToClaude: (packId, how) => call('ctx', 'sendToClaude', { packId, how }),
  },
  chat: {                                                                        // events: vrg.on('chat', 'delta' | 'tool' | 'done' | 'error', cb)
    start: o => call('chat', 'start', o && typeof o === 'object' ? Object.fromEntries(['account', 'prompt', 'attach', 'tools'].filter(k => o[k] !== undefined).map(k => [k, o[k]])) : {}),
    follow: (chat, prompt) => call('chat', 'follow', { chat, prompt }),
    stop: chat => call('chat', 'stop', { chat }),
    list: () => call('chat', 'list', {}),
    history: chat => call('chat', 'history', { chat }),
    toTerminal: chat => call('chat', 'toTerminal', { chat }),
  },
  note: {
    topics: () => call('note', 'topics', {}),
    save: n => call('note', 'save', n && typeof n === 'object' ? Object.fromEntries(['topic', 'title', 'text', 'source'].filter(k => n[k] !== undefined).map(k => [k, n[k]])) : {}),
  },
  mail: {                                                                        // WP-27; tokens never reach the page
    accounts: () => call('mail', 'accounts', {}),
    signIn: acc => call('mail', 'signIn', { acc }),
    signOut: acc => call('mail', 'signOut', { acc }),
    list: (acc, q, page) => call('mail', 'list', { acc, ...(q !== undefined ? { q } : {}), ...(page !== undefined ? { page } : {}) }),
    get: (acc, msg) => call('mail', 'get', { acc, msg }),
    saveAttachment: (acc, msg, att) => call('mail', 'saveAttachment', { acc, msg, att }),     // WP-28; events: vrg.on('mail', 'link', cb)
    render: (acc, msg, images) => call('mail', 'render', { acc, msg, images: images === true }),
    closeView: () => call('mail', 'closeView', {}),
  },
  feed: {                                                                        // WP-29; a job's end arrives as vrg.on('jobs', 'update', cb) with kind 'feed'
    presets: () => call('feed', 'presets', {}),
    run: pre => call('feed', 'run', { pre }),
    results: () => call('feed', 'results', {}),
    open: (pre, i) => call('feed', 'open', { pre, i }),
  },
  act: id => ipcRenderer.invoke('vrg:act', String(id)),
  ports: () => ipcRenderer.invoke('vrg:ports'),
  onPorts: cb => ipcRenderer.on('vrg:ports', (e, p) => cb(p)),
  onMax: cb => ipcRenderer.on('vrg:max', (e, m) => cb(m)),
  refresh: () => ipcRenderer.invoke('vrg:refresh'),
  win: cmd => ipcRenderer.send('vrg:win', String(cmd)),
});
