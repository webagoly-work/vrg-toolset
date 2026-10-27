// preload.js — the only bridge between the overlay page and the shell (sandboxed, context-isolated): two messages out,
// nothing in. solid(true|false) = the pointer is over something the page wants to catch; hide() = dismiss the overlay.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kvShell', {
  solid: s => ipcRenderer.send('kv-solid', !!s),
  hide: () => ipcRenderer.send('kv-hide'),
});
