// hud-preload.js — the answer window's only bridge (WP-56): it can receive a message, nothing else. No vrg API, no channel back to main.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hud', { on: cb => { ipcRenderer.on('hud', (e, m) => { try { cb(m); } catch (x) {} }); } });
