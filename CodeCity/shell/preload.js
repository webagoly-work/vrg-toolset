// preload.js — the only bridge between the overlay page and the shell (sandboxed, context-isolated). Out: solid(true|false)
// = the pointer is over something the page wants to catch; hide() = dismiss the overlay; handoff() = a window took the
// screen (KV-26); live(handles) = the windows to refresh every second. In: the capture sources (id, handle, thumbnail) and 'return' (Esc after a hand-off), data only.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kvShell', {
  solid: s => ipcRenderer.send('kv-solid', !!s),
  hide: () => ipcRenderer.send('kv-hide'),
  handoff: () => ipcRenderer.send('kv-handoff'),
  live: hs => ipcRenderer.send('kv-live', hs),
  onSources: cb => ipcRenderer.on('kv-sources', (e, list) => cb(list)),
  onReturn: cb => ipcRenderer.on('kv-return', () => cb()),
});
