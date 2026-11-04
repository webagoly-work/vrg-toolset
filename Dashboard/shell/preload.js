// preload.js — the dashboard page's only door to the shell. The page gets window.vrg and nothing else:
// it can ask for an act id to be run, read the port states, refresh the data and move its own window.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vrg', {
  act: id => ipcRenderer.invoke('vrg:act', String(id)),
  ports: () => ipcRenderer.invoke('vrg:ports'),
  onPorts: cb => ipcRenderer.on('vrg:ports', (e, p) => cb(p)),
  onMax: cb => ipcRenderer.on('vrg:max', (e, m) => cb(m)),
  refresh: () => ipcRenderer.invoke('vrg:refresh'),
  win: cmd => ipcRenderer.send('vrg:win', String(cmd)),
});
