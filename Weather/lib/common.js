// VRG Időjárás — paths, settings, small helpers shared by the CLI, the server and the tests.
//
// Env overrides (tests, worktrees): VRG_WEATHER_DATA (Weather/data), VRG_WEATHER_CONFIG (Weather/config),
// VRG_JOBS_DIR (the work root's jobs folder), VRG_WEATHER_NOW (a fixed "now" for tests and replays).
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const DATA = process.env.VRG_WEATHER_DATA ? path.resolve(process.env.VRG_WEATHER_DATA) : path.join(ROOT, 'data');
const CONFIG = process.env.VRG_WEATHER_CONFIG ? path.resolve(process.env.VRG_WEATHER_CONFIG) : path.join(ROOT, 'config');

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };

function merge(a, b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const o = { ...(a || {}) };
  for (const [k, v] of Object.entries(b)) o[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? merge(o[k], v) : v;
  return o;
}

function config() {
  const settings = merge(readJson(path.join(CONFIG, 'settings.json')),
    isFile(path.join(CONFIG, 'settings.local.json')) ? readJson(path.join(CONFIG, 'settings.local.json')) : {});
  return {
    settings,
    sources: readJson(path.join(CONFIG, 'sources.json')).sources,
    places: readJson(path.join(CONFIG, 'places.json')).places,
    rules: readJson(path.join(CONFIG, 'rules.json')),
    pipelines: readJson(path.join(CONFIG, 'pipelines.json')),
  };
}

const dbFile = () => path.join(DATA, 'weather.sqlite');
const now = () => (process.env.VRG_WEATHER_NOW ? new Date(process.env.VRG_WEATHER_NOW) : new Date());

// accents off, lower case: "Érd" ~ "erd", "Pest vármegye" contains "pest"
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// console output stays ASCII under the Windows console codepage (CLAUDE.md); VRG_UTF8=1 keeps accents
const ascii = s => (process.env.VRG_UTF8 === '1' ? String(s) : String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[őŐűŰ]/g, c => ({ ő: 'o', Ő: 'O', ű: 'u', Ű: 'U' })[c]).replace(/🔴/g, '[X]').replace(/🟠/g, '[!]').replace(/ℹ️?/g, '[i]').replace(/ ?°/g, ' ').replace(/·/g, '-').replace(/…/g, '...').replace(/[–—−]/g, '-')
  .replace(/[²]/g, '2').replace(/[³]/g, '3').replace(/µ/g, 'u').replace(/₂/g, '2').replace(/≥/g, '>=').replace(/≤/g, '<=')
  .replace(/[^\x00-\x7F]/g, '?'));

// does a warning area ("Pest vármegye", "Budapest") name this place area ("Pest")? Whole words only, so "Pest" is
// not found inside "Budapest"
function areaMatch(area, name) {
  const w = s => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
  const a = w(area), n = w(name);
  if (!a.length || !n.length) return false;
  return n.every(x => a.includes(x)) || a.every(x => n.includes(x));
}

function km(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function nearest(p, list, maxKm = Infinity) {
  let best = null;
  for (const s of list) { const d = km(p, s); if (d <= maxKm && (!best || d < best.km)) best = { ...s, km: d }; }
  return best;
}

// local time parts in the configured zone (Europe/Budapest), for the schedule, workday and daily stats
function local(d, tz = 'Europe/Budapest') {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d instanceof Date ? d : new Date(d)).map(x => [x.type, x.value]));
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute, wd, hm: `${p.hour}:${p.minute}` };
}
const addH = (isoStr, h) => new Date(new Date(isoStr).getTime() + h * 3600e3).toISOString().slice(0, 16) + 'Z';
const hourFloor = d => { const t = new Date(d); t.setUTCMinutes(0, 0, 0); return t.toISOString().slice(0, 16) + 'Z'; };

// arguments: positional words, --flag, --key value, --key=value
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--') && VALUED.has(a.slice(2))) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}
const VALUED = new Set(['place', 'day', 'hours', 'replay', 'var', 'out', 'kwp', 'angle', 'aspect', 'loss', 'name', 'lat', 'lon', 'elev', 'limit', 'activities', 'areas', 'jobs', 'level', 'format', 'sql', 'port']);

// "fetch met-no --place budapest" → ['fetch', 'met-no', '--place', 'budapest'] (quotes allowed)
function splitCmd(s) {
  const out = []; const re = /"([^"]*)"|(\S+)/g; let m;
  while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

module.exports = { ROOT, REPO, DATA, CONFIG, areaMatch, readJson, isFile, isDir, merge, config, dbFile, now, fold, ascii, km, nearest, local, addH, hourFloor, parseArgs, splitCmd };
