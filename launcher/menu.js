// ---------------------------------------------------------------------------
// menu.js — launcher/vrg-menu.json for the Node side (Kapu build, Kodvaros segéd, check-start).
//
// The registry is the one list of tools and local servers since re-root phase 3.2; before it these
// programs read Planner/START.cmd's T<n>_ and LH<n>_ lines. The shapes below are the ones they
// built from those lines, so nothing downstream changes:
//
//   tools()   -> [{ n, key, name, path, dir }]                 path relative to the repo, forward slashes
//   servers() -> [{ n, key, id, name, port, path, js, args, bat, self }]   js / bat relative to the repo
//   resolve(s) -> an absolute path, with the same tokens as vrg-ui.ps1
//   reload()   -> the registry read again (the relay's Indítópult, WP M11, reads it on every list)
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const FULL = path.dirname(REPO);
const FILE = path.join(__dirname, 'vrg-menu.json');

let cache = null;
function load() {
  if (!cache) cache = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));
  return cache;
}

function resolve(s) {
  const short = load().paths || {};
  for (let i = 0; i < 3 && s.includes('{'); i++) for (const k of Object.keys(short)) s = s.split('{' + k + '}').join(short[k]);
  return path.normalize(s.split('{repo}').join(REPO).split('{full}').join(FULL).split('{vrg}').join(path.dirname(FULL)));
}
const rel = s => path.relative(REPO, resolve(s)).split(path.sep).join('/');

function tools() {
  // A served tool (no "path", a "server" + its "page") also carries the url it really runs at.
  const srv = id => (load().servers || []).find(s => s.id === id);
  return (load().start.tools || []).filter(t => t.path || t.page).map((t, i) => {
    const p = rel(t.path || t.page);
    const s = !t.path && t.server ? srv(t.server) : null;
    const out = { n: i + 1, key: t.key, name: t.name, path: p, dir: p.split('/').slice(0, -1).join('/') || '.' };
    if (s) out.url = 'http://localhost:' + s.port + (s.open || '/');
    return out;
  });
}

function servers() {
  return (load().servers || []).map((s, i) => ({
    n: i + 1, key: s.key, id: s.id, name: s.name, port: s.port, path: s.open || '/',
    js: s.js ? rel(s.js) : null, args: s.args || [], bat: s.bat ? rel(s.bat) : null, self: !!s.self
  }));
}

/** Forget the cached registry, so a long-running reader (the phone relay, WP M11) sees edits to it. */
function reload() { cache = null; return load(); }

module.exports = { FILE, REPO, load, reload, resolve, tools, servers };
