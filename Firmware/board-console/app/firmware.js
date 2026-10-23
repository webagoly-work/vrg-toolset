// firmware.js - Board Console phase 2: the firmware library, devices, backups and flashing.
//
// Flashing uses the esptool.exe that the Arduino ESP32 core already installed under
// _libs/arduino-cli (offline, nothing to download). One job runs at a time; the page polls
// /api/job for its log and progress.
//
// Folders (all under data/, kept out of git):
//   library/<id>/<version>/manifest.json + the .bin parts
//   backups/<chip>_<mac>_<YYYYMMDD-HHMM>.bin + .json
//   devices.json   every board seen: chip, MAC, flash size, and what was done to it
//
// manifest.json is a superset of the esp-web-tools manifest ({name, version, builds:[{chipFamily,
// parts:[{path, offset}]}]}) plus our fields: id, description, notes, uses (connector ids),
// source, added, sizes / sha256 per part.
//
// Safety rule: a board is backed up before it is flashed unless its current content is known,
// i.e. the last thing that happened to it (by MAC) was a flash from this library.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const CHIP_BY_ID = { 0: 'ESP32', 2: 'ESP32-S2', 5: 'ESP32-C3', 9: 'ESP32-S3', 12: 'ESP32-C2', 13: 'ESP32-C6', 16: 'ESP32-H2', 18: 'ESP32-P4', 20: 'ESP32-C61', 23: 'ESP32-C5' };
const ESPTOOL_CHIP = { 'ESP32': 'esp32', 'ESP32-S2': 'esp32s2', 'ESP32-S3': 'esp32s3', 'ESP32-C3': 'esp32c3', 'ESP32-C2': 'esp32c2', 'ESP32-C6': 'esp32c6', 'ESP32-H2': 'esp32h2', 'ESP32-P4': 'esp32p4' };
const hex = n => '0x' + n.toString(16);
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); };

function createFirmware(opts) {
  const { dataDir, libsDir, log } = opts;
  const LIB = path.join(dataDir, 'library'), BAK = path.join(dataDir, 'backups'), DEVF = path.join(dataDir, 'devices.json');

  // ---------------------------------------------------------------- esptool
  function findEsptool() {
    if (opts.esptool) return opts.esptool;
    const base = path.join(libsDir, 'arduino-cli/data/packages/esp32/tools/esptool_py');
    try {
      const v = fs.readdirSync(base).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
      for (const x of v) { const f = path.join(base, x, 'esptool.exe'); if (fs.existsSync(f)) return f; }
    } catch (e) {}
    return null;
  }
  const ESPTOOL = findEsptool();
  log(ESPTOOL ? `esptool: ${ESPTOOL}` : 'esptool.exe not found: flashing is off (pass --esptool <path>)');

  // ---------------------------------------------------------------- image facts
  // The chip an image was built for: byte 12-13 of the extended header, after the 0xE9 magic
  // (at 0x0, or at 0x1000 for an ESP32 / ESP32-S2 merged image).
  function imageChip(buf) {
    for (const off of [0, 0x1000]) if (buf.length > off + 16 && buf[off] === 0xE9) {
      const id = buf.readUInt16LE(off + 12);
      if (CHIP_BY_ID[id]) return CHIP_BY_ID[id];
    }
    return null;
  }
  // What a single .bin is, and where it belongs:
  //   merged     a full image (partition table magic at 0x8000)          -> 0x0
  //   bootloader a small 0xE9 image                                        -> 0x0 / 0x1000
  //   app        any other 0xE9 image (needs a bootloader + partitions)   -> 0x10000
  function classify(buf) {
    const chip = imageChip(buf);
    if (buf.length > 0x8002 && buf.readUInt16LE(0x8000) === 0x50AA) return { kind: 'merged', offset: 0, chip };
    if (buf[0] === 0xE9 && buf.length < 0x10000) return { kind: 'bootloader', offset: ['ESP32', 'ESP32-S2'].includes(chip) ? 0x1000 : 0, chip };
    if (buf[0] === 0xE9) return { kind: 'app', offset: 0x10000, chip };
    return { kind: 'unknown', offset: 0, chip };
  }
  const KIND_NOTE = {
    merged: 'Teljes kép: a beállítás-területet (NVS) is felülírja · full image: also overwrites the settings area (NVS).',
    app: 'Csak az alkalmazás (0x10000): a lapon már kell lennie bootloadernek és partíciós táblának · app only: the board must already have a bootloader and partition table.',
    bootloader: 'Csak a bootloader · bootloader only.'
  };

  // First app partition (factory or ota_0) from a partition table image.
  function appOffset(buf) {
    for (let i = 0; i + 32 <= buf.length; i += 32) {
      if (buf.readUInt16LE(i) !== 0x50AA) break;
      if (buf[i + 2] === 0x00) return buf.readUInt32LE(i + 4);
    }
    return 0x10000;
  }

  // ---------------------------------------------------------------- library
  function manifestPath(id, version) { return path.join(LIB, slug(id), slug(version), 'manifest.json'); }
  function list() {
    if (!fs.existsSync(LIB)) return [];
    const out = [];
    for (const id of fs.readdirSync(LIB)) {
      const dir = path.join(LIB, id);
      if (!fs.statSync(dir).isDirectory()) continue;
      const versions = fs.readdirSync(dir).map(v => readJson(path.join(dir, v, 'manifest.json'), null)).filter(Boolean)
        .sort((a, b) => String(b.added).localeCompare(String(a.added)));
      if (versions.length) out.push({ id, name: versions[0].name, versions });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  }
  function get(id, version) {
    const m = readJson(manifestPath(id, version), null);
    if (!m) throw new Error(`no firmware ${id} ${version}`);
    return m;
  }

  // Store parts [{name, buf, offset}] as a new library version.
  function store(meta, parts) {
    const id = slug(meta.id || meta.name), version = slug(meta.version || stamp());
    if (!id) throw new Error('a firmware needs a name');
    const dir = path.join(LIB, id, version);
    if (fs.existsSync(path.join(dir, 'manifest.json')) && !meta.overwrite) throw new Error(`${id} ${version} already exists: give it a new version`);
    fs.mkdirSync(dir, { recursive: true });
    const chip = meta.chipFamily || parts.map(p => imageChip(p.buf)).find(Boolean) || 'ESP32-S3';
    const ps = parts.map(p => {
      const file = path.basename(p.name).replace(/[^\w.-]+/g, '_');
      fs.writeFileSync(path.join(dir, file), p.buf);
      return { path: file, offset: p.offset, size: p.buf.length, sha256: sha256(p.buf) };
    });
    const m = {
      schema: 'vrg-fw/1', id, name: String(meta.name || id).slice(0, 80), version, chipFamily: chip,
      description: String(meta.description || '').slice(0, 2000), notes: String(meta.notes || '').slice(0, 4000),
      uses: Array.isArray(meta.uses) ? meta.uses.filter(x => /^[A-Z0-9-]{1,12}$/.test(x)) : [],
      source: meta.source || {}, added: new Date().toISOString(),
      builds: [{ chipFamily: chip, parts: ps.map(p => ({ path: p.path, offset: p.offset })) }],
      parts: ps
    };
    writeJson(path.join(dir, 'manifest.json'), m);
    log(`Library: added ${id} ${version} (${chip}, ${ps.length} part${ps.length > 1 ? 's' : ''})`);
    return m;
  }

  // A folder from arduino-cli (bootloader + partitions + app, boot_app0 from the build or the
  // core), or a single .bin (merged image at 0x0 unless an offset is given).
  function importPath(p, meta) {
    p = path.resolve(String(p || '').replace(/^"|"$/g, ''));
    if (!fs.existsSync(p)) throw new Error('not found: ' + p);
    if (fs.statSync(p).isFile()) {
      const buf = fs.readFileSync(p), c = classify(buf);
      if (c.kind === 'unknown' && !meta.force) throw new Error('not an ESP image (no 0xE9 header)');
      return store(Object.assign({ name: path.basename(p, '.bin'), description: KIND_NOTE[c.kind] || '', source: { kind: 'file', path: p, image: c.kind } }, meta),
        [{ name: path.basename(p), buf, offset: meta.offset ?? c.offset }]);
    }
    const files = fs.readdirSync(p);
    const app = files.find(f => /\.ino\.bin$/.test(f)) || files.find(f => /\.bin$/.test(f) && !/bootloader|partitions|merged|boot_app0|_flashed/.test(f));
    const boot = files.find(f => /\.ino\.bootloader\.bin$/.test(f)), part = files.find(f => /\.ino\.partitions\.bin$/.test(f));
    if (!app || !boot || !part) {
      const merged = files.find(f => /\.merged\.bin$/.test(f));
      if (merged) throw new Error(`${p}: only a merged image here; import the .merged.bin file itself (it also erases the settings area)`);
      throw new Error(`${p}: no Arduino build here (needs *.ino.bin, *.ino.bootloader.bin, *.ino.partitions.bin)`);
    }
    const bootBuf = fs.readFileSync(path.join(p, boot)), partBuf = fs.readFileSync(path.join(p, part)), appBuf = fs.readFileSync(path.join(p, app));
    const chip = imageChip(bootBuf) || imageChip(appBuf);
    const parts = [
      { name: boot, buf: bootBuf, offset: ['ESP32', 'ESP32-S2'].includes(chip) ? 0x1000 : 0x0 },
      { name: part, buf: partBuf, offset: 0x8000 }
    ];
    let ba = path.join(p, 'boot_app0.bin');
    if (!fs.existsSync(ba)) {
      const hw = path.join(libsDir, 'arduino-cli/data/packages/esp32/hardware/esp32');
      try { const v = fs.readdirSync(hw).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]; ba = path.join(hw, v, 'tools/partitions/boot_app0.bin'); } catch (e) {}
    }
    if (fs.existsSync(ba)) parts.push({ name: 'boot_app0.bin', buf: fs.readFileSync(ba), offset: 0xe000 });
    parts.push({ name: app, buf: appBuf, offset: appOffset(partBuf) });
    const sketch = app.replace(/\.ino\.bin$/, '');
    return store(Object.assign({ name: sketch, chipFamily: chip, source: { kind: 'arduino-build', path: p, built: fs.statSync(path.join(p, app)).mtime.toISOString() } }, meta), parts);
  }

  // Build folders worth offering: arduino-cli build paths and Firmware/*/firmware.
  function knownBuilds(dirs) {
    const out = [];
    for (const base of dirs) {
      if (!fs.existsSync(base)) continue;
      for (const d of fs.readdirSync(base)) {
        const p = path.join(base, d);
        try {
          if (!fs.statSync(p).isDirectory()) continue;
          const files = fs.readdirSync(p), app = files.find(f => /\.ino\.bin$/.test(f));
          if (app && files.some(f => /\.ino\.bootloader\.bin$/.test(f))) {
            const st = fs.statSync(path.join(p, app));
            const boot = fs.readFileSync(path.join(p, files.find(f => /\.ino\.bootloader\.bin$/.test(f))));
            out.push({ path: p, sketch: app.replace(/\.ino\.bin$/, ''), built: st.mtime.toISOString(), size: st.size, chip: imageChip(boot) });
          }
        } catch (e) {}
      }
    }
    // the same build copied by --output-dir: one entry (same sketch, same app size, built within 2 minutes)
    const uniq = [];
    for (const b of out.sort((a, b) => b.built.localeCompare(a.built)))
      if (!uniq.some(u => u.sketch === b.sketch && u.size === b.size && Math.abs(Date.parse(u.built) - Date.parse(b.built)) < 120000)) uniq.push(b);
    return uniq;
  }

  function update(id, version, fields) {
    const f = manifestPath(id, version), m = readJson(f, null);
    if (!m) throw new Error('no such firmware');
    for (const k of ['name', 'description', 'notes']) if (typeof fields[k] === 'string') m[k] = fields[k].slice(0, k === 'name' ? 80 : 4000);
    if (Array.isArray(fields.uses)) m.uses = fields.uses.filter(x => /^[A-Z0-9-]{1,12}$/.test(x));
    if (fields.chipFamily && ESPTOOL_CHIP[fields.chipFamily]) { m.chipFamily = fields.chipFamily; m.builds.forEach(b => b.chipFamily = fields.chipFamily); }
    writeJson(f, m);
    return m;
  }
  function remove(id, version) {
    const dir = path.dirname(manifestPath(id, version));
    if (!dir.startsWith(LIB) || !fs.existsSync(dir)) throw new Error('no such firmware');
    fs.rmSync(dir, { recursive: true, force: true });
    const top = path.dirname(dir);
    if (fs.existsSync(top) && !fs.readdirSync(top).length) fs.rmdirSync(top);
    log(`Library: removed ${id} ${version}`);
  }

  // ---------------------------------------------------------------- devices + backups
  const devices = () => readJson(DEVF, {});
  function remember(info, event) {
    const d = devices(), k = info.mac;
    if (!k) return;
    const r = d[k] || { mac: k, firstSeen: new Date().toISOString(), history: [] };
    Object.assign(r, { chip: info.chip, chipFull: info.chipFull, flashSize: info.flashSize, port: info.port, lastSeen: new Date().toISOString() });
    if (event) r.history.push(Object.assign({ at: new Date().toISOString() }, event));
    r.history = r.history.slice(-50);
    d[k] = r;
    writeJson(DEVF, d);
    return r;
  }
  // What the board should still hold: the last flash from the library, or the last backup.
  function reference(mac) {
    const r = devices()[mac];
    const last = r && r.history.filter(h => ['flash', 'backup', 'seen-foreign'].includes(h.action)).pop();
    if (!last || last.action === 'seen-foreign') return null;
    if (last.action === 'flash') {
      try {
        const m = get(last.fw.id, last.fw.version), dir = path.dirname(manifestPath(m.id, m.version));
        return { label: `${m.name} ${m.version}`, pairs: m.parts.map(p => [p.offset, path.join(dir, p.path)]) };
      } catch (e) { return null; }   // the firmware was deleted from the library
    }
    const f = path.join(BAK, last.file);
    return fs.existsSync(f) ? { label: `mentés · backup ${last.file}`, pairs: [[0, f]] } : null;
  }
  const contentKnown = mac => !!reference(mac);   // a first guess for the page; the flash job verifies
  function backups() {
    if (!fs.existsSync(BAK)) return [];
    return fs.readdirSync(BAK).filter(f => f.endsWith('.json')).map(f => readJson(path.join(BAK, f), null)).filter(Boolean)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  // ---------------------------------------------------------------- jobs
  let job = null, jobSeq = 0;
  const jobView = () => job && { id: job.id, kind: job.kind, title: job.title, state: job.state, step: job.step, progress: job.progress, log: job.log.slice(-300), result: job.result, error: job.error, started: job.started, ended: job.ended };

  function runEsptool(args, onLine) {
    return new Promise((resolve, reject) => {
      if (!ESPTOOL) return reject(new Error('esptool.exe not found'));
      job.log.push('> esptool ' + args.join(' '));
      const p = spawn(ESPTOOL, args, { windowsHide: true });
      job.proc = p;
      let out = '', buf = '';
      const feed = s => {
        buf += s;
        const parts = buf.split(/\r\n|\n|\r/);
        buf = parts.pop();
        for (const l of parts) {
          const line = l.trimEnd();
          if (!line) continue;
          out += line + '\n';
          const pm = /(\d{1,3}(?:\.\d+)?)\s?%/.exec(line);
          if (pm) job.progress = Math.min(100, +pm[1]);
          // keep progress lines from flooding the log: replace the previous one
          if (pm && job.log.length && /%/.test(job.log[job.log.length - 1])) job.log[job.log.length - 1] = line; else job.log.push(line);
          if (onLine) onLine(line);
        }
      };
      p.stdout.on('data', b => feed(b.toString('utf8')));
      p.stderr.on('data', b => feed(b.toString('utf8')));
      p.on('error', reject);
      p.on('close', code => {
        if (buf.trim()) feed('\n');
        job.proc = null;
        if (code === 0) resolve(out);
        else {
          const busy = /could not open port|PermissionError|Access is denied|being used by another/i.test(out);
          reject(new Error(busy ? 'A port foglalt (fut a CYD bridge / makropad vagy egy soros monitor?) · The port is busy (a bridge or serial monitor has it open)' : `esptool exit ${code}: ${(out.trim().split('\n').pop() || '').slice(0, 200)}`));
        }
      });
    });
  }

  function startJob(kind, title, fn) {
    if (job && job.state === 'running') throw new Error('egy művelet már fut · a job is already running');
    job = { id: ++jobSeq, kind, title, state: 'running', step: '', progress: 0, log: [], started: new Date().toISOString() };
    const my = job;
    Promise.resolve().then(() => fn(my)).then(r => { my.result = r; my.state = 'done'; my.step = 'kész · done'; my.progress = 100; },
      e => { my.error = e.message; my.state = my.cancelled ? 'cancelled' : 'error'; my.log.push('HIBA · ERROR: ' + e.message); })
      .finally(() => { my.ended = new Date().toISOString(); log(`Job ${my.kind}: ${my.state}${my.error ? ' - ' + my.error : ''}`); });
    return jobView();
  }
  function cancel() {
    if (!job || job.state !== 'running') return jobView();
    job.cancelled = true;
    if (job.proc) try { job.proc.kill(); } catch (e) {}
    return jobView();
  }

  const BAUDS = [115200, 230400, 460800, 921600];
  const base = (port, baud) => ['--port', port, '--baud', String(BAUDS.includes(+baud) ? +baud : 921600)];
  async function chipInfo(port, baud) {
    job.step = 'chip · flash-id';
    const out = await runEsptool([...base(port, baud), 'flash-id']);
    const chipFull = (/Chip type:\s*(.+)/.exec(out) || /Chip is (.+)/.exec(out) || [])[1] || '';
    const fam = Object.keys(ESPTOOL_CHIP).sort((a, b) => b.length - a.length).find(c => chipFull.toUpperCase().replace(/\s/g, '').startsWith(c.replace('-', '')) || chipFull.toUpperCase().startsWith(c));
    const info = {
      port, chipFull: chipFull.trim(), chip: fam || chipFull.split(' ')[0],
      mac: ((/MAC:\s*([0-9a-f:]{17})/i.exec(out) || [])[1] || '').toLowerCase(),
      flashSize: (/Detected flash size:\s*(\S+)/.exec(out) || [])[1] || '',
      features: ((/Features:\s*(.+)/.exec(out) || [])[1] || '').trim(),
      crystal: ((/Crystal (?:frequency|is):?\s*(.+)/.exec(out) || [])[1] || '').trim()
    };
    if (!info.mac) throw new Error('no MAC in the esptool output');
    const known = devices()[info.mac];
    info.known = !!known;
    info.contentKnown = contentKnown(info.mac);
    info.lastFlash = known ? (known.history.filter(h => h.action === 'flash').pop() || null) : null;
    remember(info, known ? null : { action: 'seen-foreign', note: 'first time seen: content unknown' });
    return info;
  }
  const sizeBytes = s => { const m = /^(\d+)\s*(KB|MB)$/i.exec(String(s || '')); return m ? +m[1] * (m[2].toUpperCase() === 'MB' ? 1 << 20 : 1 << 10) : 0; };

  async function backup(port, baud, info) {
    const size = sizeBytes(info.flashSize);
    if (!size) throw new Error('unknown flash size');
    fs.mkdirSync(BAK, { recursive: true });
    const name = `${slug(info.chip)}_${info.mac.replace(/:/g, '')}_${stamp()}`;
    const file = path.join(BAK, name + '.bin');
    job.step = `mentés · backup ${info.flashSize}`; job.progress = 0;
    await runEsptool([...base(port, baud), 'read-flash', '0', String(size), file]);
    const buf = fs.readFileSync(file);
    const meta = { file: name + '.bin', at: new Date().toISOString(), mac: info.mac, chip: info.chip, chipFull: info.chipFull, flashSize: info.flashSize, size: buf.length, sha256: sha256(buf), imageChip: imageChip(buf) };
    writeJson(path.join(BAK, name + '.json'), meta);
    remember(info, { action: 'backup', file: meta.file });
    job.log.push(`Mentve · saved: ${file}`);
    return meta;
  }

  // ---------------------------------------------------------------- the jobs the page can start
  return {
    esptool: ESPTOOL,
    list, get, update, remove, importPath, knownBuilds, backups, devices, classify,
    upload(buf, meta) {
      if (!buf.length) throw new Error('empty file');
      const c = classify(buf);
      if (c.kind === 'unknown' && !(buf.length > 0x1000 && buf[0x1000] === 0xE9) && !meta.force) throw new Error('not an ESP image (no 0xE9 header at 0x0 / 0x1000)');
      return store(Object.assign({ description: KIND_NOTE[c.kind] || '', source: { kind: 'upload', file: meta.file, image: c.kind } }, meta),
        [{ name: meta.file || 'firmware.bin', buf, offset: meta.offset ?? c.offset }]);
    },
    fromBackup(file) {
      const meta = backups().find(b => b.file === file);
      if (!meta) throw new Error('no such backup');
      const buf = fs.readFileSync(path.join(BAK, file));
      return store({ id: `backup-${meta.mac.replace(/:/g, '')}`, name: `Mentés · backup ${meta.chip} ${meta.mac}`, version: file.replace(/\.bin$/, '').split('_').pop(),
        chipFamily: meta.chip, description: `Full flash image read ${meta.at}`, source: { kind: 'backup', file, mac: meta.mac } }, [{ name: file, buf, offset: 0 }]);
    },
    job: jobView,
    cancel,
    startInfo(port, baud) { return startJob('info', 'Chip infó · chip info', () => chipInfo(port, baud)); },
    startBackup(port, baud) {
      return startJob('backup', 'Teljes mentés · full backup', async () => { const info = await chipInfo(port, baud); return { info, backup: await backup(port, baud, info) }; });
    },
    startFlash(o) {
      const m = get(o.id, o.version);
      return startJob('flash', `Írás · flash: ${m.name} ${m.version}`, async my => {
        const info = await chipInfo(o.port, o.baud);
        if (m.chipFamily && info.chip && m.chipFamily !== info.chip && !o.force) throw new Error(`a firmware ${m.chipFamily}-re készült, a lap ${info.chip} · built for ${m.chipFamily}, the board is ${info.chip}`);
        // Is what is on the board already saved? Check it on the chip (verify-flash compares
        // checksums, no full read): the last library flash, or the last backup.
        let saved = false;
        const ref = reference(info.mac);
        if (ref) {
          my.step = 'ellenőrzés · verify'; my.progress = 0;
          try {
            await runEsptool([...base(o.port, o.baud), 'verify-flash', ...ref.pairs.flatMap(([off, f]) => [hex(off), f])]);
            saved = true; my.log.push(`A lap tartalma egyezik ezzel · content matches: ${ref.label}`);
          } catch (e) { my.log.push(`Nem egyezik ezzel · does not match: ${ref.label}`); }
        }
        let bak = null;
        if (!saved && !o.skipBackup) { my.log.push('A lap tartalma nincs elmentve: előbb teljes mentés · content not saved: backing up first'); bak = await backup(o.port, o.baud, info); }
        else if (!saved) my.log.push('FIGYELEM: mentés kihagyva · WARNING: backup skipped');
        const dir = path.dirname(manifestPath(m.id, m.version));
        for (const p of m.parts) {
          const f = path.join(dir, p.path);
          if (sha256(fs.readFileSync(f)) !== p.sha256) throw new Error(`${p.path}: the file changed since it was added (sha256)`);
        }
        if (o.erase) { my.step = 'törlés · erase'; my.progress = 0; await runEsptool([...base(o.port, o.baud), 'erase-flash']); }
        my.step = 'írás · write'; my.progress = 0;
        const args = [...base(o.port, o.baud), '--chip', ESPTOOL_CHIP[info.chip] || 'auto', 'write-flash'];
        for (const p of m.parts) args.push(hex(p.offset), path.join(dir, p.path));
        await runEsptool(args);
        remember(info, { action: 'flash', fw: { id: m.id, version: m.version, name: m.name }, erase: !!o.erase, backup: bak && bak.file });
        return { info, firmware: { id: m.id, version: m.version, name: m.name }, backup: bak };
      });
    }
  };
}

module.exports = { createFirmware };
