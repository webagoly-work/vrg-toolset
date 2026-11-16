#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-jobs.js — the VRG Térkép job layer: where each job is, geocoded OFFLINE ONLY.
//
//   node Map/tools/build-jobs.js            write jobs\_elozmenyek\helyek.json
//   node Map/tools/build-jobs.js --check    list what it would write, write nothing
//   --jobs=<dir>  --data=<Map/data dir>  --out=<file>   (tests use fixtures)
//
// Reads (all outside Git, client data, see docs/map/JOBS-MAP.md):
//   jobs\<CODE>_*\job\funnel\decisions.json, ...\job\answers_r1.json   Workflow Kit jobs: `address`
//   jobs\_elozmenyek\REGISZTER.md      past jobs: code, status, folder, period (file dates)
//   jobs\_elozmenyek\helyszinek.json   drafted / confirmed addresses (code -> address and/or lat+lon),
//                                      each row `"vazlat": true` until the Founder confirms it (MAP-D3 A)
//   jobs\_elozmenyek\osszegek.csv      totals per job folder
//   Map\data\addresses.json            the offline address index (node Map/tools/fetch-data.js)
// Writes jobs\_elozmenyek\helyek.json: per job code, status, period, lon/lat, precision
// (cím / legközelebbi / utca / település / nincs), source. No written address goes into it.
//
// Never asks Nominatim or any other online service: a client address does not leave this PC.
// Console output stays ASCII and names job codes only, never an address.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('../lib/geocode.js');

const MAP = path.resolve(__dirname, '..');
const REPO = path.resolve(MAP, '..');
const args = process.argv.slice(2);
const arg = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const CHECK = args.includes('--check');
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const MAIN = /[\\/]\.claude[\\/]worktrees[\\/][^\\/]+$/.test(REPO) ? path.resolve(REPO, '..', '..', '..') : null;

function findJobs() {
  if (arg('jobs')) return path.resolve(arg('jobs'));
  if (process.env.VRG_JOBS_DIR) return path.resolve(process.env.VRG_JOBS_DIR);
  for (let d = REPO; path.dirname(d) !== d; d = path.dirname(d)) {
    const j = path.join(path.dirname(d), 'jobs');
    if (isDir(path.join(j, '_elozmenyek'))) return j;
  }
  return null;
}
function findData() {
  if (arg('data')) return path.resolve(arg('data'));
  if (process.env.VRG_MAP_DATA) return path.resolve(process.env.VRG_MAP_DATA);
  const own = path.join(MAP, 'data');
  return isFile(path.join(own, 'addresses.json')) || !MAIN ? own : path.join(MAIN, 'Map', 'data');
}
const ascii = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const day = t => new Date(t).toISOString().slice(0, 10);
const STATUS = new Set(['folyamatban', 'befejezett', 'meghiúsult']);

// ---------------------------------------------------------------- sources
/** REGISZTER.md table rows -> { code: { status, folder, from, to, note } } */
function readRegister(file) {
  const out = {};
  if (!isFile(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const c = line.split('|').map(s => s.trim());
    if (c.length < 8) continue;
    const m = /^\[?([A-Z]{1,3}\d{1,3})\]?/.exec(c[1]);
    if (!m) continue;
    const per = /(\d{4}-\d{2}-\d{2})\s*…\s*(\d{4}-\d{2}-\d{2})/.exec(c[4]) || [];
    out[m[1]] = { status: c[2], folder: c[3], from: per[1] || null, to: per[2] || null, note: c[7] || '' };
  }
  return out;
}
/** osszegek.csv -> { folderName: { total, date } } — the latest-dated file of each job, duplicate rows once */
function readTotals(file) {
  const out = {};
  if (!isFile(file)) return out;
  const rows = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).filter(Boolean)
    .map(l => l.split(';').map(s => s.replace(/^"|"$/g, '')));
  const byJob = {};
  const seen = new Set();
  for (const [date, , job, kind, amount, src] of rows) {
    const k = [date, job, kind, amount, src].join('|');
    if (seen.has(k)) continue; seen.add(k);
    const j = byJob[job] || (byJob[job] = {});
    const f = j[src || ''] || (j[src || ''] = { total: 0, date });
    f.total += Number(amount) || 0;
    if (date > f.date) f.date = date;
  }
  for (const [job, files] of Object.entries(byJob)) {
    const best = Object.values(files).sort((a, b) => b.date.localeCompare(a.date) || b.total - a.total)[0];
    out[job] = best;
  }
  return out;
}
/** the files' date span of a folder (3 levels deep, enough for a Workflow Kit job) */
function span(dir, depth) {
  let from = null, to = null;
  const walk = (d, n) => {
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (n > 0 && !/^(node_modules|\.git)$/.test(e.name)) walk(p, n - 1); continue; }
      let t; try { t = fs.statSync(p).mtimeMs; } catch { continue; }
      const s = day(t);
      if (!from || s < from) from = s;
      if (!to || s > to) to = s;
    }
  };
  walk(dir, depth);
  return { from, to };
}
/** Workflow Kit job folders: <CODE>_<anything> at the top of jobs\ */
function readKitJobs(jobs) {
  const out = {};
  let dirs = []; try { dirs = fs.readdirSync(jobs, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { return out; }
  for (const d of dirs) {
    const m = /^([A-Z]{1,3}\d{1,3})_/.exec(d);
    if (!m) continue;
    const code = m[1], dir = path.join(jobs, d);
    const j = out[code] || (out[code] = { folders: [], address: null, source: null });
    j.folders.push(d);
    for (const [rel, src] of [[['job', 'funnel', 'decisions.json'], 'kit:decisions'], [['job', 'answers_r1.json'], 'kit:answers_r1']]) {
      if (j.address) break;
      const f = path.join(dir, ...rel);
      if (!isFile(f)) continue;
      try { const a = readJson(f); const v = a.address || (a.answers && a.answers.address); if (typeof v === 'string' && v.trim()) { j.address = v.trim(); j.source = src; } } catch { /* a broken file is skipped */ }
    }
    const s = span(dir, 3);
    if (s.from && (!j.from || s.from < j.from)) j.from = s.from;
    if (s.to && (!j.to || s.to > j.to)) j.to = s.to;
  }
  return out;
}

// ---------------------------------------------------------------- build
function build(opts) {
  const jobs = opts.jobs, hist = path.join(jobs, '_elozmenyek');
  const reg = readRegister(path.join(hist, 'REGISZTER.md'));
  const totals = readTotals(path.join(hist, 'osszegek.csv'));
  const kit = readKitJobs(jobs);
  const overFile = path.join(hist, 'helyszinek.json');
  const over = isFile(overFile) ? (readJson(overFile).jobs || {}) : {};
  const idx = opts.index;

  const codes = [...new Set([...Object.keys(reg), ...Object.keys(kit), ...Object.keys(over)])].sort();
  const rows = [], warn = [];
  for (const code of codes) {
    const r = reg[code] || {}, k = kit[code] || {}, o = over[code] || {};
    const row = {
      code, kind: reg[code] ? 'elozmeny' : 'kit',
      status: STATUS.has(o.status) ? o.status : STATUS.has(r.status) ? r.status : 'folyamatban',
      from: o.from || r.from || k.from || null, to: o.to || r.to || k.to || null,
      label: o.cimke || r.folder || (k.folders || [])[0] || code,
      lon: null, lat: null, prec: 'nincs', source: null, vazlat: false,
    };
    // related codes: "BK2 előzménye" in the register, or helyszinek' kapcsolodik
    const rel = new Set([].concat(o.kapcsolodik || []));
    const em = /([A-Z]{1,3}\d{1,3}) előzménye/.exec(r.note || '');
    if (em) rel.add(em[1]);
    for (const [c2, r2] of Object.entries(reg)) if (new RegExp('\\b' + code + ' előzménye').test(r2.note || '')) rel.add(c2);
    if (rel.size) row.related = [...rel].sort();
    const tot = totals[r.folder];
    if (tot && tot.total) { row.total = tot.total; row.totalDate = tot.date; }

    if (typeof o.lat === 'number' && typeof o.lon === 'number') {
      Object.assign(row, { lon: o.lon, lat: o.lat, prec: o.pontossag || 'cím', source: 'kézi', vazlat: o.vazlat !== false });
    } else {
      const address = o.address || k.address || null;
      const source = o.address ? 'helyszinek' : k.address ? k.source : null;
      if (address) {
        const g = G.geocodeJob(idx, address);
        if (g) {
          Object.assign(row, { lon: +g.lon.toFixed(5), lat: +g.lat.toFixed(5), prec: g.prec, source });
          if (g.otherCity) { row.otherCity = g.otherCity; warn.push(code + ': the street was found in another settlement of the index (' + ascii(g.otherCity) + ')'); }
        } else { row.source = source; warn.push(code + ': address not found in the offline index'); }
        row.vazlat = o.address ? o.vazlat !== false : false;
      } else {
        if (over[code]) { row.vazlat = o.vazlat !== false; }
        warn.push(code + (over[code] ? ': helyszinek.json has a row but no address or lat+lon yet' : ': no address (no helyszinek.json row, no kit address field)'));
      }
    }
    if (over[code] && o.bizonytalan) row.bizonytalan = true;
    rows.push(row);
  }
  return { rows, warn };
}

// ---------------------------------------------------------------- main
if (require.main === module) {
  const JOBS = findJobs();
  if (!JOBS) { console.error('No jobs folder found (H:\\VRG\\Full\\jobs). Use --jobs=<dir>.'); process.exit(1); }
  const DATA = findData();
  const addrFile = path.join(DATA, 'addresses.json');
  if (!isFile(addrFile)) { console.error('Missing ' + addrFile + '. Run: node Map/tools/fetch-data.js'); process.exit(1); }
  const d = readJson(addrFile);
  const index = G.buildIndex(d);
  const { rows, warn } = build({ jobs: JOBS, index });
  const out = arg('out') ? path.resolve(arg('out')) : path.join(JOBS, '_elozmenyek', 'helyek.json');
  const doc = {
    _leiras: 'VRG Térkép munkák rétege. Ügyféladat: nem kerülhet Gitbe. Generálta: Map/tools/build-jobs.js; kézzel ne szerkeszd, a helyszinek.json-t javítsd.',
    built: new Date().toISOString(), index: d.built || null, count: rows.length,
    jobs: rows,
  };
  const n = p => rows.filter(r => r.prec === p).length;
  console.log('jobs ' + rows.length + ': cim ' + n('cím') + ', legkozelebbi ' + n('legközelebbi') + ', utca ' + n('utca') + ', telepules ' + n('település') + ', nincs ' + n('nincs') +
    ' | drafts (vazlat) ' + rows.filter(r => r.vazlat).length);
  for (const r of rows) console.log('  ' + r.code.padEnd(4) + ' ' + ascii(r.status).padEnd(12) + ' ' + ascii(r.prec).padEnd(13) + ' ' + ascii(r.source || '-').padEnd(15) + (r.vazlat ? ' VAZLAT' : '') + (r.bizonytalan ? ' BIZONYTALAN' : ''));
  for (const w of warn) console.log('WARN ' + w);
  if (CHECK) { console.log('--check: nothing written'); process.exit(0); }
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  console.log('wrote ' + out);
}

module.exports = { build, readRegister, readTotals, readKitJobs, span };
