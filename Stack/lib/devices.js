// VRG Stack — D · Eszközök (devices), S16 of research/STRINGS-PLAN.md (§5; RULES §6a, by STK-Q5 after Munkák): the
// sketches, the firmware built from them and the boards they were flashed onto. The string goes from code to a
// physical board: C:Firmware/knobpad ← D:sketch.knobpad ← D:fw.knobpad ← D:board.a4cf12.
//
//   read({ repoFiles, dataDir }) → { sketches, firmware, boards }
//     sketches   every tracked Arduino sketch: a .ino named as its folder (Arduino's rule), or the only .ino in it
//     firmware   the Board Console's library (data/library/<id>/<version>/manifest.json, schema vrg-fw/1)
//     boards     the Board Console's data/devices.json: every board seen, by MAC, with its history
//                (data/ is git-ignored: per PC, like the recordings)
//   layer(r) → { nodes, edges }   pure
//     D:sketch.<name>   kind 'sketch'; text names its folder, so the join links it to the code (C)
//     D:fw.<id>         kind 'firmware'; state = the latest version; → D:sketch.<name> 'built-from' (an Arduino build's
//                       sketch name); extra.built = when its newest version was built, for the stale check
//     D:board.<mac6>    kind 'board'; title "<chip> · <last 6 of the MAC> · <the firmware it runs>"; state 'known' when its last flash or backup
//                       says what it holds, 'unknown' after a first sighting; → D:fw.<id> 'flashed' (w = how many times)
//   stale(nodes) → firmware whose sketch has a commit after the build (J 'fw-stale')
//   behind(nodes) → boards whose last flash is not the firmware's latest version (J 'board-behind')
'use strict';

const fs = require('fs');
const path = require('path');

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const mac6 = m => String(m || '').replace(/[^0-9a-f]/gi, '').slice(-6).toLowerCase();

function sketches(files) {
  const byDir = new Map();
  for (const f of files) if (/\.ino$/i.test(f) && !/^Vendor\//.test(f)) { const d = path.posix.dirname(f); (byDir.get(d) || byDir.set(d, []).get(d)).push(f); }
  const out = [];
  for (const [dir, inos] of byDir) {
    const folder = dir.split('/').pop(), main = inos.find(f => path.posix.basename(f, '.ino') === folder) || (inos.length === 1 ? inos[0] : null);
    if (!main) continue;
    out.push({ name: path.posix.basename(main, '.ino'), dir, main, files: inos.length, example: /\/examples\//.test(dir) });
  }
  return out.sort((a, b) => (a.dir < b.dir ? -1 : 1));
}

function read({ repoFiles = [], dataDir = '' } = {}) {
  const LIB = path.join(dataDir, 'library');
  const firmware = [];
  let ids = []; try { ids = fs.readdirSync(LIB); } catch { ids = []; }
  for (const id of ids) {
    let vs = []; try { vs = fs.readdirSync(path.join(LIB, id)); } catch { continue; }
    const versions = vs.map(v => readJson(path.join(LIB, id, v, 'manifest.json'), null)).filter(Boolean).sort((a, b) => String(b.added).localeCompare(String(a.added)));
    if (versions.length) firmware.push({ id, versions });
  }
  const dev = readJson(path.join(dataDir, 'devices.json'), {});
  let backups = 0; try { backups = fs.readdirSync(path.join(dataDir, 'backups')).filter(f => f.endsWith('.json')).length; } catch { backups = 0; }
  return { sketches: sketches(repoFiles), firmware: firmware.sort((a, b) => (a.id < b.id ? -1 : 1)), boards: Object.values(dev || {}).filter(b => b && b.mac), backups };
}

function layer({ sketches: sk = [], firmware = [], boards = [] } = {}) {
  const nodes = [], edges = [], byName = new Map(sk.map(s => [s.name.toLowerCase(), s]));
  for (const s of sk) nodes.push({ id: 'D:sketch.' + s.name, layer: 'D', kind: 'sketch', title: s.name, brief: `${s.dir}${s.files > 1 ? ` · ${s.files} .ino files` : ''}${s.example ? ' · example' : ''}`,
    state: s.example ? 'example' : '', t: '', tier: '', lane: 'sketches', own: ['sketch:' + s.name], text: [s.name, s.main, s.dir].join('\n'), extra: { path: s.dir, main: s.main } });

  const fwIds = new Set();
  for (const f of firmware) {
    const v = f.versions[0], src = v.source || {}, id = 'D:fw.' + f.id; fwIds.add(f.id);
    const sketch = src.kind === 'arduino-build' ? byName.get(String(v.name || '').toLowerCase()) || byName.get(path.basename(String(src.path || '')).toLowerCase()) : null;
    const sizes = (v.parts || []).reduce((a, p) => a + (p.size || 0), 0);
    nodes.push({ id, layer: 'D', kind: 'firmware', title: v.name || f.id, brief: [v.chipFamily, `${f.versions.length} version${f.versions.length > 1 ? 's' : ''}, latest ${v.version}`, sizes ? Math.round(sizes / 1024) + ' KB' : '',
      (v.uses || []).length ? 'uses ' + v.uses.join(', ') : '', src.kind ? 'from ' + src.kind : ''].filter(Boolean).join(' · '),
      state: v.version, t: String(v.added || '').slice(0, 10), tier: '', lane: 'firmware', own: ['fw:' + f.id], text: [v.name, v.description, sketch ? sketch.dir : ''].filter(Boolean).join('\n'),
      extra: { latest: v.version, versions: f.versions.map(x => x.version), chip: v.chipFamily, built: src.built || v.added || '', sketch: sketch ? sketch.dir : '', uses: v.uses || [] } });
    if (sketch) edges.push({ a: id, b: 'D:sketch.' + sketch.name, rel: 'built-from' });
  }

  for (const b of boards) {
    const m6 = mac6(b.mac), id = 'D:board.' + m6, hist = b.history || [];
    const last = hist.filter(h => ['flash', 'backup', 'seen-foreign'].includes(h.action)).pop();
    const flashes = hist.filter(h => h.action === 'flash' && h.fw), lastFlash = flashes[flashes.length - 1];
    const known = !!last && last.action !== 'seen-foreign';
    // the title names what it runs, so the firmware's pillar takes the board in by its words (as M's tools do)
    nodes.push({ id, layer: 'D', kind: 'board', title: [b.chip || 'board', m6, lastFlash ? (lastFlash.fw.name || lastFlash.fw.id) : ''].filter(Boolean).join(' · '),
      brief: [b.chipFull || '', b.flashSize ? 'flash ' + b.flashSize : '', `seen ${String(b.firstSeen || '').slice(0, 10)} … ${String(b.lastSeen || '').slice(0, 10)}`,
        lastFlash ? `last flash ${lastFlash.fw.name || lastFlash.fw.id} ${lastFlash.fw.version} (${String(lastFlash.at).slice(0, 10)})` : 'never flashed from the library',
        known ? '' : 'content unknown'].filter(Boolean).join(' · '),
      state: known ? 'known' : 'unknown', t: String(b.lastSeen || '').slice(0, 10), tier: '', lane: 'boards', own: ['board:' + m6], text: `${b.chip || ''} ${m6}`,
      extra: { chip: b.chip, flashSize: b.flashSize, lastFlash: lastFlash ? { id: lastFlash.fw.id, version: lastFlash.fw.version, at: lastFlash.at } : null, events: hist.length, known } });
    const n = new Map(); for (const f of flashes) n.set(f.fw.id, (n.get(f.fw.id) || 0) + 1);
    for (const [fid, w] of n) if (fwIds.has(fid)) edges.push({ a: id, b: 'D:fw.' + fid, rel: 'flashed', w });
  }
  return { nodes, edges };
}

// firmware built before its sketch's newest commit: the board runs code older than the repo (R nodes carry files)
function stale(list) {
  const newest = new Map();
  for (const n of list) if (n.layer === 'R' && n.extra && n.extra.date) for (const f of n.extra.files || []) {
    const d = String(n.extra.date); for (let x = f; x.includes('/'); x = x.slice(0, x.lastIndexOf('/'))) { const k = x.slice(0, x.lastIndexOf('/')); if (!newest.has(k) || newest.get(k) < d) newest.set(k, d); }
  }
  return list.filter(n => n.layer === 'D' && n.kind === 'firmware' && n.extra && n.extra.sketch && n.extra.built && newest.get(n.extra.sketch) > n.extra.built)
    .map(n => ({ n, commit: newest.get(n.extra.sketch) }));
}
// a board whose last flash is an older version than the library's latest of that firmware
function behind(list) {
  const fw = new Map(list.filter(n => n.layer === 'D' && n.kind === 'firmware').map(n => [n.id.slice(5), n]));
  return list.filter(n => n.layer === 'D' && n.kind === 'board' && n.extra && n.extra.lastFlash && fw.has(n.extra.lastFlash.id) && fw.get(n.extra.lastFlash.id).extra.latest !== n.extra.lastFlash.version)
    .map(n => ({ n, has: n.extra.lastFlash.version, latest: fw.get(n.extra.lastFlash.id).extra.latest, fw: fw.get(n.extra.lastFlash.id) }));
}

module.exports = { read, layer, sketches, stale, behind, mac6 };
