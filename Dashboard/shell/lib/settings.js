// settings.js — per-user settings in <userDir>/settings.json, whitelisted keys only, written atomically (.tmp, rename).
//   settings.get('win.mode');  settings.set('win.mode', 'munka');   unknown key or wrong type → throws
// Later WPs add their keys to KEYS.
'use strict';
const fs = require('fs'), path = require('path');
const paths = require('./paths.js');
const layout = require('./layout.js');
const desk = require('./desk.js');
const sheets = require('./sheets.js');

const rect = v => !!v && typeof v === 'object' && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(v[k])) && v.width > 0 && v.height > 0;

const PERMS = ['media', 'clipboard-sanitized-write'];
const permsOk = v => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const origins = Object.keys(v);
  if (origins.length > 200) return false;
  return origins.every(o => o.length <= 200 && v[o] && typeof v[o] === 'object' && !Array.isArray(v[o])
    && Object.keys(v[o]).every(p => PERMS.includes(p) && typeof v[o][p] === 'boolean'));
};

// key → { type: v => bool, def: default }
const KEYS = {
  'win.mode':          { type: v => ['ablak', 'munka', 'overlay'].includes(v), def: 'ablak' },
  'win.display':       { type: v => v === null || Number.isInteger(v), def: null },
  'win.bounds':        { type: v => v === null || rect(v), def: null },
  'term.embedClaude':  { type: v => typeof v === 'boolean', def: true },            // WP-16: s:C/*, cont:, go: open in a term pane
  'claude.account':    { type: v => v === 'A' || v === 'B', def: 'A' },
  'chat.keepText':     { type: v => typeof v === 'boolean', def: false },           // WP-23/24, DESK-Q60 A + Q63 B: off = no chat text on disk
  'ws.openWithLine':   { type: v => typeof v === 'boolean', def: true },            // WP-34, DESK-Q91 A (WP-35a): a DevLog line opens its saved workspace
  'web.history.days':  { type: v => Number.isInteger(v) && v >= 0 && v <= 3650, def: 90 },
  'web.perms':         { type: permsOk, def: {} },                                        // WP-17: { origin: { 'media': bool, 'clipboard-sanitized-write': bool } }
  'ui.lang':          { type: v => v === 'hu' || v === 'en', def: 'hu' },
  'layout.tree':       { type: v => v === null || layout.validate(v).ok, def: null },   // WP-07; null = the default tree
  'desk.level':        { type: v => desk.LEVELS.includes(v), def: 'user' },             // WP-41: User / Dev / All (DESKU-Q04)
  'desk.view':         { type: v => desk.VIEWS.includes(v), def: 'dashboard' },         // WP-41: the last primary view, the boot target
  'desk.top':          { type: v => v === null || desk.validTop(v), def: null },       // WP-42: the top strip's ids in order; null = the default
  'desk.dock':         { type: v => desk.validDock(v), def: null },                     // WP-42: pinned dock ids; null = the catalog's surfaces.dock
  'desk.sheets':       { type: v => v === null || sheets.validate(v).ok, def: null },   // WP-46: the Lapok (sheets) of the workspace; null = none yet
  'auth.enabled':      { type: v => typeof v === 'boolean', def: false },               // WP-43: the Kapu gate in the boot flow (off until Kapu auth is ready)
};

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const known = k => typeof k === 'string' && has(KEYS, k);
const file = () => path.join(paths.userDir(), 'settings.json');

function readAll() {
  try {
    const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch (e) { return {}; }
}

function get(k) {
  if (!known(k)) throw new Error('settings: unknown key');
  const all = readAll();
  return has(all, k) && KEYS[k].type(all[k]) ? all[k] : KEYS[k].def;
}

function set(k, v) {
  if (!known(k)) throw new Error('settings: unknown key');
  if (!KEYS[k].type(v)) throw new Error('settings: bad value for ' + k);
  const all = readAll();
  all[k] = v;
  const f = file(), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(all, null, 1));
  fs.renameSync(tmp, f);
  return v;
}

module.exports = { KEYS, get, set, has: known };
