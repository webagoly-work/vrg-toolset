#!/usr/bin/env node
// Board Console - local server for the universal dev board (ESP32-S3 + extension board +
// passive connector panel). Phase 1: board model + setups.
//
// Serves console.html and a small JSON API. The board model is NOT copied here: it is read
// from the generated files in the Topology_Starter folder (make_starter.js, make_connectors.js,
// make_panel.js), so those generators stay the single source.
//
//   node server.js                        http://localhost:8790
//   node server.js --port 8791            another port
//   node server.js --board-dir <folder>   where the DEVBOARD / TOPOLOGY / LAYOUT / MODULES files are
//   node server.js --no-open              do not open the browser
//
// Only this PC's browser can use it: it listens on 127.0.0.1 and ::1, checks the Host and
// Origin headers, and takes JSON only (the same rules as the CYD macropad settings page).

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n && !n.startsWith('--')) { args[a.slice(2)] = n; i++; } else args[a.slice(2)] = true;
}
const PORT = Number(args.port || 8790);
const BOARD_DIR = path.resolve(String(args['board-dir'] || 'H:/VRG_Visual_Base/01_Hardware/Topology_Starter'));
const DATA_DIR = path.resolve(String(args['data-dir'] || path.join(__dirname, '../data')));
const SETUP_DIR = path.join(DATA_DIR, 'setups');
const REPO = path.resolve(__dirname, '../../..');
const LIBS_DIR = path.resolve(String(args['libs-dir'] || path.join(REPO, '../_libs')));
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

// Phase 2: firmware library, devices, backups, flashing (firmware.js)
const FW = require('./firmware').createFirmware({ dataDir: DATA_DIR, libsDir: LIBS_DIR, esptool: args.esptool, log });
// Phase 3a: live link to a board running the agent (live.js)
const LIVE = require('./live').createLive({ log });
// A firmware job needs the port: release the live link first, reopen it when the job ends.
async function withPort(p, start) {
  const reopen = await LIVE.release(p);
  const r = start();
  const t = setInterval(() => { const j = FW.job(); if (!j || j.state !== 'running') { clearInterval(t); setTimeout(reopen, 1500); } }, 500);
  return r;
}
const BUILD_DIRS = [path.join(LIBS_DIR, 'arduino-cli/build'), ...['planner-cyd', 'knobpad', 'board-console'].map(d => path.join(REPO, 'Firmware', d))];

// Serial ports with their device names (no npm dependency: ask Windows).
function listPorts() {
  return new Promise(resolve => {
    const ps = "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | ForEach-Object { $_.Name + '|' + $_.PNPDeviceID }";
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 8000 }, (err, out) => {
      const ports = String(out || '').split(/\r?\n/).filter(Boolean).map(l => {
        const [name, id] = l.split('|'), port = (/\((COM\d+)\)/.exec(name) || [])[1];
        const vid = (/VID_([0-9A-F]{4})/i.exec(id || '') || [])[1], pid = (/PID_([0-9A-F]{4})/i.exec(id || '') || [])[1];
        const kind = /^303A$/i.test(vid || '') ? 'natív USB · native USB (Espressif)' : /^1A86$/i.test(vid || '') ? 'CH34x USB-UART' : /^10C4$/i.test(vid || '') ? 'CP210x USB-UART' : vid ? 'USB' : 'beépített · built-in';
        return { port, name: name.replace(/\s*\(COM\d+\)/, ''), vid, pid, kind, esp: !!vid };
      }).filter(p => p.port).sort((a, b) => b.esp - a.esp || a.port.localeCompare(b.port, undefined, { numeric: true }));
      resolve(ports);
    });
  });
}

// ---------------------------------------------------------------- board model

const FILES = {
  devboard: ['DEVBOARD_ESP32-S3_IO-Board.html', 'vrg-devboard'],
  connectors: ['TOPOLOGY_Connectors.html', 'vrg-devboard-connectors'],
  panel: ['LAYOUT_Panel.html', 'vrg-devboard-panel']
};
// Panel variants: B (150 x 80) is the primary since 2026-10-18; A (90 x 100) stacks on the dev board.
const PANELS = { B: 'LAYOUT_Panel_150x80.html', A: 'LAYOUT_Panel.html' };

function jsonBlock(file, id) {
  const s = fs.readFileSync(path.join(BOARD_DIR, file), 'utf8');
  const m = s.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`${file}: no #${id} block`);
  return JSON.parse(m[1]);
}

// The dev board picture: the pinout SVG inlined in the DEVBOARD file.
function devSvg() {
  const s = fs.readFileSync(path.join(BOARD_DIR, FILES.devboard[0]), 'utf8');
  const m = s.match(/<svg[\s\S]*?<\/svg>/);
  return m ? m[0] : '';
}

// MODULES_BuildTree.md -> [{id, name, qty, role, interface, pins, power, hook, caution}]
function modules() {
  const f = path.join(BOARD_DIR, 'MODULES_BuildTree.md');
  if (!fs.existsSync(f)) return [];
  const out = [];
  let role = '', cur = null;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    let m;
    if ((m = /^## (.+?)(?: \(\d+\))?$/.exec(line))) { role = m[1]; cur = null; continue; }
    if ((m = /^### `([^`]+)` - (.+) · (\d+) db$/.exec(line))) { cur = { id: m[1], name: m[2], qty: +m[3], role }; out.push(cur); continue; }
    if (cur && (m = /^- (Interface|Pins \(typical\)|Power|Dev board|Caution|Part): (.*)$/.exec(line))) {
      const k = { Interface: 'interface', 'Pins (typical)': 'pins', Power: 'power', 'Dev board': 'hook', Caution: 'caution', Part: 'part' }[m[1]];
      cur[k] = m[2];
    }
  }
  return out;
}

function board() {
  const b = { boardDir: BOARD_DIR, loadedAt: new Date().toISOString(), modules: modules(), devSvg: devSvg() };
  for (const [k, [file, id]] of Object.entries(FILES)) b[k] = jsonBlock(file, id);
  b.panels = {};
  for (const [v, file] of Object.entries(PANELS)) if (fs.existsSync(path.join(BOARD_DIR, file))) b.panels[v] = jsonBlock(file, 'vrg-devboard-panel');
  return b;
}

// ---------------------------------------------------------------- setups (one JSON file each)

const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function cleanSetup(s) {
  if (!s || typeof s !== 'object') throw new Error('not an object');
  const name = String(s.name || '').trim().slice(0, 80);
  if (!slug(name)) throw new Error('a setup needs a name');
  const active = {}, mods = {};
  for (const [k, v] of Object.entries(s.active || {})) if (v === true && /^[A-Z0-9-]{1,12}$/.test(k)) active[k] = true;
  for (const [k, v] of Object.entries(s.modules || {})) if (/^[A-Z0-9-]{1,12}$/.test(k) && /^[a-z0-9_]{1,24}$/.test(String(v))) mods[k] = String(v);
  return { schema: 'vrg-board-setup/1', name, notes: String(s.notes || '').slice(0, 2000), active, modules: mods, savedAt: new Date().toISOString() };
}

function listSetups() {
  if (!fs.existsSync(SETUP_DIR)) return [];
  return fs.readdirSync(SETUP_DIR).filter(f => f.endsWith('.json')).map(f => {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(SETUP_DIR, f), 'utf8'));
      return { file: f, name: s.name, savedAt: s.savedAt, active: Object.keys(s.active || {}).length };
    } catch (e) { return { file: f, name: f, error: e.message }; }
  }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'hu'));
}

function setupFile(name) {
  const s = slug(name);
  if (!s) throw new Error('bad name');
  return path.join(SETUP_DIR, s + '.json');
}

// ---------------------------------------------------------------- http

const port = d => { if (!/^COM\d{1,3}$/i.test(String(d.port || ''))) throw new Error('pick a COM port'); return String(d.port).toUpperCase(); };

const okHost = h => new RegExp(`^(localhost|127\\.0\\.0\\.1|\\[::1\\]):${PORT}$`).test(h || '');
function reply(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function handler(req, res) {
  if (!okHost(req.headers.host)) return reply(res, 403, { error: 'forbidden' });
  if (req.headers.origin && !okHost(req.headers.origin.replace(/^https?:\/\//, ''))) return reply(res, 403, { error: 'forbidden' });
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/console.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(path.join(__dirname, 'console.html')));
  }
  if (req.method === 'GET' && url.pathname === '/api/board') {
    try { return reply(res, 200, board()); }
    catch (e) { return reply(res, 500, { error: `board files in ${BOARD_DIR}: ${e.message}` }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/setups') return reply(res, 200, { setups: listSetups() });

  // ---- phase 2: firmware
  if (req.method === 'GET' && url.pathname === '/api/fw') {
    return reply(res, 200, { esptool: FW.esptool, library: FW.list(), backups: FW.backups(), devices: FW.devices(), builds: FW.knownBuilds(BUILD_DIRS), job: FW.job() });
  }
  if (req.method === 'GET' && url.pathname === '/api/ports') { listPorts().then(p => reply(res, 200, { ports: p })); return; }
  if (req.method === 'GET' && url.pathname === '/api/job') return reply(res, 200, { job: FW.job() });
  if (req.method === 'GET' && url.pathname === '/api/live') return reply(res, 200, LIVE.view(url.searchParams.get('since')));
  // A .bin from the page: raw bytes. The custom header makes a cross-site form unable to send it
  // (it would need a CORS preflight, which this server never answers).
  if (req.method === 'POST' && url.pathname === '/api/fw/upload') {
    if (req.headers['x-board-console'] !== '1' || !/^application\/octet-stream/.test(req.headers['content-type'] || '')) return reply(res, 415, { error: 'binary upload from the page only' });
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > 32 << 20) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      try {
        const q = url.searchParams;
        const m = FW.upload(Buffer.concat(chunks), { name: q.get('name') || '', version: q.get('version') || '', file: q.get('file') || 'firmware.bin',
          offset: q.get('offset') ? parseInt(q.get('offset'), 16) : undefined, chipFamily: q.get('chip') || undefined, force: q.get('force') === '1' });
        return reply(res, 200, { firmware: m, library: FW.list() });
      } catch (e) { return reply(res, 400, { error: e.message }); }
    });
    return;
  }
  const FW_POSTS = {
    '/api/fw/import': d => ({ firmware: FW.importPath(d.path, { name: d.name || undefined, version: d.version || undefined, offset: d.offset !== undefined && d.offset !== '' ? parseInt(d.offset, 16) : undefined }), library: FW.list() }),
    '/api/fw/update': d => ({ firmware: FW.update(d.id, d.version, d), library: FW.list() }),
    '/api/fw/delete': d => { FW.remove(d.id, d.version); return { library: FW.list() }; },
    '/api/fw/from-backup': d => ({ firmware: FW.fromBackup(d.file), library: FW.list() }),
    '/api/job/info': d => withPort(port(d), () => ({ job: FW.startInfo(port(d), d.baud) })),
    '/api/job/backup': d => withPort(port(d), () => ({ job: FW.startBackup(port(d), d.baud) })),
    '/api/job/flash': d => withPort(port(d), () => ({ job: FW.startFlash({ port: port(d), baud: d.baud, id: d.id, version: d.version, erase: !!d.erase, skipBackup: !!d.skipBackup, force: !!d.force }) })),
    '/api/live/open': async d => { await LIVE.open(d.port, d.baud); return LIVE.view(0); },
    '/api/live/stop': async () => { await LIVE.stop(); return LIVE.view(0); },
    '/api/live/send': d => { LIVE.send(d.line); return { ok: true }; },
    '/api/job/cancel': () => ({ job: FW.cancel() })
  };
  if (req.method === 'POST' && FW_POSTS[url.pathname]) {
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return reply(res, 415, { error: 'json only' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body || '{}'); } catch (e) { return reply(res, 400, { error: 'bad json' }); }
      Promise.resolve().then(() => FW_POSTS[url.pathname](data))
        .then(r => reply(res, 200, r), e => reply(res, 400, { error: e.message }));
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/setup') {
    try { return reply(res, 200, JSON.parse(fs.readFileSync(setupFile(url.searchParams.get('name')), 'utf8'))); }
    catch (e) { return reply(res, 404, { error: 'no such setup' }); }
  }
  if (req.method === 'POST' && ['/api/setup', '/api/setup/delete'].includes(url.pathname)) {
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return reply(res, 415, { error: 'json only' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e5) req.destroy(); });
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return reply(res, 400, { error: 'bad json' }); }
      try {
        if (url.pathname === '/api/setup/delete') {
          const f = setupFile(data.name);
          if (fs.existsSync(f)) fs.unlinkSync(f);
          log('Setup deleted:', data.name);
          return reply(res, 200, { setups: listSetups() });
        }
        const s = cleanSetup(data);
        fs.mkdirSync(SETUP_DIR, { recursive: true });
        fs.writeFileSync(setupFile(s.name), JSON.stringify(s, null, 2) + '\n');
        log(`Setup saved: ${s.name} (${Object.keys(s.active).length} connectors)`);
        return reply(res, 200, { setup: s, setups: listSetups() });
      } catch (e) { return reply(res, 400, { error: e.message }); }
    });
    return;
  }
  reply(res, 404, { error: 'not found' });
}

// "localhost" may resolve to ::1 or 127.0.0.1: listen on both
const v4 = http.createServer(handler);
v4.on('error', e => {
  if (e.code === 'EADDRINUSE') { log(`Port ${PORT} is busy: is the Board Console already running? Opening it.`); openBrowser(); setTimeout(() => process.exit(0), 500); }
  else log('Server error:', e.message);
});
v4.listen(PORT, '127.0.0.1', () => {
  log(`Board Console: http://localhost:${PORT}`);
  log(`Board files: ${BOARD_DIR}`);
  log(`Setups: ${SETUP_DIR}`);
  openBrowser();
});
const v6 = http.createServer(handler);
v6.on('error', () => {});
v6.listen(PORT, '::1');

function openBrowser() {
  if (args['no-open']) return;
  exec(`start "" "http://localhost:${PORT}/"`, { windowsHide: true });
}
