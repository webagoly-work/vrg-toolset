// roots.js — the file roots (config/roots.json + machine.json rows). Main defines them; everything the page sees is inside one.
//   const roots = createRoots({ configFile, repo, full, getPath, machineFile, env });
//   roots.load() → [{ id, hu, kind, abs, real }]   (missing roots are skipped)      roots.rootOf(absPath) → root id | null
// Electron's app.getPath is passed in as getPath, so node --test can load this file.
'use strict';
const fs = require('fs'), path = require('path');

const real = p => { try { return fs.realpathSync.native(p); } catch (e) { return null; } };
const key = p => String(p).replace(/[\\/]+$/, '').toLowerCase() + '\\';          // trailing separator: H:\VRG\FullX is not inside H:\VRG\Full

function createRoots({ configFile, repo, full, getPath = () => { throw new Error('no getPath'); }, machineFile = '', env = process.env }) {
  let table = [];

  function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
  function sub(p) { return String(p).replace(/\{repo\}/g, repo).replace(/\{full\}/g, full); }
  function resolveRow(r) {
    if (r.path) return sub(r.path);
    if (Array.isArray(r.env)) { for (const k of r.env) if (env[k]) return env[k]; return null; }
    if (r.known) { try { return getPath(r.known); } catch (e) { return null; } }
    return null;
  }

  function load() {
    const base = readJson(configFile);
    const rows = Array.isArray(base) ? base.slice() : [];
    const ids = new Set(rows.map(r => r.id));
    const m = machineFile ? readJson(machineFile) : null;                          // may add rows, never redefine one
    const extra = Array.isArray(m) ? m : (m && Array.isArray(m.roots) ? m.roots : []);
    for (const r of extra) {
      if (!r || typeof r.id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(r.id) || ids.has(r.id)) continue;
      if (typeof r.hu !== 'string' || typeof r.path !== 'string' || !path.isAbsolute(r.path)) continue;
      ids.add(r.id);
      rows.push({ id: r.id, hu: r.hu, path: r.path });
    }
    table = [];
    for (const r of rows) {
      const abs = resolveRow(r);
      const rp = abs && real(abs);
      if (!rp) continue;
      try { if (!fs.statSync(rp).isDirectory()) continue; } catch (e) { continue; }
      table.push({ id: r.id, hu: r.hu, kind: r.id === 'shared' ? 'shared' : (r.kind === 'onedrive' ? 'onedrive' : 'local'), abs, real: rp });
    }
    return table.slice();
  }

  function rootOf(absPath) {
    if (typeof absPath !== 'string' || !absPath) return null;
    const rp = real(absPath);
    if (!rp) return null;
    const k = key(rp);
    let best = null;                                                                // the longest root wins (shared sits inside OneDrive)
    for (const r of table) {
      const rk = key(r.real);
      if (k.startsWith(rk) && (!best || rk.length > best.len)) best = { id: r.id, len: rk.length };
    }
    return best ? best.id : null;
  }

  return { load, rootOf, list: () => table.slice(), get: id => table.find(r => r.id === id) || null };
}

module.exports = { createRoots, real };
