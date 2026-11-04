// preload.js — the dashboard page's only door to the shell. The page gets window.vrg and nothing else:
// it can ask for an act id to be run, read the port states, refresh the data and move its own window.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// IPC v2 (API.md): one object payload per call, validated in main. A channel main does not know comes back as bad-request.
const BAD = { ok: false, err: 'bad-request', hu: 'Érvénytelen kérés.' };
const call = async (ns, fn, payload) => {
  if (!/^[a-z][a-z0-9]{0,19}$/.test(String(ns)) || !/^[a-zA-Z][a-zA-Z0-9]{0,29}$/.test(String(fn))) return { ...BAD };
  try { return await ipcRenderer.invoke('vrg2:' + ns + '.' + fn, payload === undefined ? {} : payload); }
  catch (e) { return { ...BAD }; }
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
  },
  act: id => ipcRenderer.invoke('vrg:act', String(id)),
  ports: () => ipcRenderer.invoke('vrg:ports'),
  onPorts: cb => ipcRenderer.on('vrg:ports', (e, p) => cb(p)),
  onMax: cb => ipcRenderer.on('vrg:max', (e, m) => cb(m)),
  refresh: () => ipcRenderer.invoke('vrg:refresh'),
  win: cmd => ipcRenderer.send('vrg:win', String(cmd)),
});
