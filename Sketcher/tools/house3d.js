#!/usr/bin/env node
// Sketcher/tools/house3d.js — Ház 3D (dev line skcam, stage K5): photos taken while walking around a house (or along a
// room's walls) → <name>.house3d.json, a point cloud the Desktop Sketcher page opens (🏠 Ház 3D), sets to scale and
// measures on. The reconstruction is COLMAP's (BSD licence), run as a separate program; lib/house3d.js reads its result.
//
//   node Sketcher/tools/house3d.js <photo folder> [--out <file>] [--name <name>] [--dense auto|on|off]
//                                  [--matcher exhaustive|sequential] [--colmap <path>] [--work <folder>] [--keep]
//   node Sketcher/tools/house3d.js            (START P → 3) every subfolder of {full}/inbox/haz3d with ≥ 8 photos and no
//                                              result newer than its photos: one folder per house, its name the result's
//
// COLMAP is looked for in this order: --colmap, %VRG_COLMAP%, {full}/tools/colmap (COLMAP.bat, bin/colmap.exe, colmap),
// then `colmap` on PATH. Without a CUDA graphics card COLMAP runs on the CPU (sparse points: the shape and the size
// of a house, a few minutes for 30–80 photos); with one, --dense auto also makes the dense cloud (stereo_fusion).
// Taking the photos: walk around at 1–2 m steps, every photo facing the house, neighbours sharing 60–80 % of the view,
// the 1× lens; corners from two sides; no people or cars in front of the walls.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const H3 = require(path.join(__dirname, '..', 'lib', 'house3d.js'));
const REPO = path.join(__dirname, '..', '..'), FULL = path.dirname(REPO);

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--keep') a.keep = true;
    else if (k.startsWith('--')) a[k.slice(2)] = argv[++i];
    else a._.push(k);
  }
  return a;
}

/** The COLMAP command: [exe, prefix args, shell?]. */
function findColmap(given) {
  const win = process.platform === 'win32';
  const cand = [given, process.env.VRG_COLMAP,
    path.join(FULL, 'tools', 'colmap', 'COLMAP.bat'), path.join(FULL, 'tools', 'colmap', 'bin', 'colmap.exe'), path.join(FULL, 'tools', 'colmap', 'colmap')].filter(Boolean);
  for (const c of cand) if (fs.existsSync(c)) return { exe: c, shell: win && /\.bat$/i.test(c) };
  const r = spawnSync(win ? 'where' : 'which', ['colmap'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) return { exe: r.stdout.trim().split(/\r?\n/)[0], shell: false };
  return null;
}
/** Version and CUDA from `colmap help`. */
function about(col) {
  const r = spawnSync(col.exe, ['help'], { encoding: 'utf8', shell: col.shell });
  const t = (r.stdout || '') + (r.stderr || '');
  const m = /COLMAP\s+(\d+)\.(\d+)(?:\.(\d+))?/.exec(t);
  return { text: t.split(/\r?\n/).slice(0, 2).join(' ').trim(), major: m ? +m[1] : 0, minor: m ? +m[2] : 0, cuda: /with CUDA/i.test(t) && !/without CUDA/i.test(t) };
}
/** Runs one COLMAP step; on an option the version does not know, tries the other spelling once. */
function step(col, name, opts, alt, log) {
  const run = o => {
    const list = [name]; Object.entries(o).forEach(([k, v]) => list.push('--' + k, String(v)));
    log('colmap ' + list.join(' '));
    return spawnSync(col.exe, list, { encoding: 'utf8', shell: col.shell, maxBuffer: 1 << 28 });
  };
  let r = run(opts);
  if (r.status !== 0 && alt && /unrecognised|unrecognized|unknown option/i.test((r.stderr || '') + (r.stdout || ''))) r = run(alt);
  if (r.status !== 0) throw new Error('COLMAP ' + name + ' hiba (' + r.status + '): ' + ((r.stderr || r.stdout || '').trim().split(/\r?\n/).slice(-4).join(' | ')));
  return r;
}

/** The drop folder START uses: {full}/inbox/haz3d, one subfolder per house. */
const INBOX = path.join(FULL, 'inbox', 'haz3d');
const photosIn = d => fs.readdirSync(d).filter(f => /\.(jpe?g|png)$/i.test(f));
/** The subfolders waiting: ≥ 8 photos and no .house3d.json newer than the newest photo. */
function waiting(base) {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(base, e.name)).filter(d => {
    const ph = photosIn(d); if (ph.length < 8) return false;
    const newest = Math.max(...ph.map(f => fs.statSync(path.join(d, f)).mtimeMs));
    return !fs.readdirSync(d).some(f => /\.house3d\.json$/.test(f) && fs.statSync(path.join(d, f)).mtimeMs > newest);
  });
}

function main() {
  const a = args(process.argv.slice(2)), log = m => console.log('[house3d] ' + m);
  if (!a._[0]) {                                   // START: everything waiting in the drop folder
    fs.mkdirSync(INBOX, { recursive: true });
    const list = waiting(INBOX);
    if (!list.length) { console.log('Nincs feldolgozandó: tedd a ház fotóit egy almappába ide: ' + INBOX + ' (házanként egy mappa, legalább 8 fotó).'); return null; }
    const outs = [];
    list.forEach(d => { log('— ' + path.basename(d)); outs.push(one(Object.assign({}, a, { _: [d] }), log)); });
    return outs;
  }
  return one(a, log);
}

function one(a, log) {
  const dir = a._[0];
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.log('Használat: node Sketcher/tools/house3d.js <fotómappa> [--out fájl] [--name név] [--dense auto|on|off] [--matcher exhaustive|sequential] [--colmap útvonal]');
    process.exit(2);
  }
  const photos = photosIn(dir).sort();
  if (photos.length < 8) { console.log('Legalább 8 fotó kell (most ' + photos.length + ').'); process.exit(2); }
  const col = findColmap(a.colmap);
  if (!col) {
    console.log('A COLMAP nincs meg. Telepítsd ide: ' + path.join(FULL, 'tools', 'colmap') + ' (a hivatalos kiadás ZIP-je), vagy add meg: --colmap / VRG_COLMAP.');
    process.exit(3);
  }
  const info = about(col);
  log(info.text || 'COLMAP');
  const v4 = info.major >= 4, gpu = info.cuda ? 1 : 0;
  const work = a.work || fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-house3d-'));
  const db = path.join(work, 'database.db'), sparse = path.join(work, 'sparse');
  fs.mkdirSync(sparse, { recursive: true });
  const t0 = Date.now();

  // 1. features (one camera model shared by all: the photos come from one phone)
  const fe = { database_path: db, image_path: dir, 'ImageReader.single_camera': 1, 'ImageReader.camera_model': 'SIMPLE_RADIAL' };
  step(col, 'feature_extractor', Object.assign({}, fe, { [v4 ? 'FeatureExtraction.use_gpu' : 'SiftExtraction.use_gpu']: gpu }),
    Object.assign({}, fe, { [v4 ? 'SiftExtraction.use_gpu' : 'FeatureExtraction.use_gpu']: gpu }), log);
  // 2. matching: every pair up to 150 photos, else neighbours in name (= time) order
  const matcher = a.matcher || (photos.length <= 150 ? 'exhaustive' : 'sequential');
  step(col, matcher + '_matcher', { database_path: db, [v4 ? 'FeatureMatching.use_gpu' : 'SiftMatching.use_gpu']: gpu },
    { database_path: db, [v4 ? 'SiftMatching.use_gpu' : 'FeatureMatching.use_gpu']: gpu }, log);
  // 3. the incremental mapper
  step(col, 'mapper', { database_path: db, image_path: dir, output_path: sparse }, null, log);
  const models = fs.readdirSync(sparse).filter(d => fs.existsSync(path.join(sparse, d, 'images.bin')) || fs.existsSync(path.join(sparse, d, 'images.txt')));
  if (!models.length) throw new Error('A COLMAP nem tudott modellt építeni: kevés a közös rész a fotók között.');
  // the largest model (the most photos placed)
  let best = null;
  for (const m of models) {
    const txt = path.join(work, 'txt-' + m); fs.mkdirSync(txt, { recursive: true });
    step(col, 'model_converter', { input_path: path.join(sparse, m), output_path: txt, output_type: 'TXT' }, null, log);
    const model = { cameras: fs.readFileSync(path.join(txt, 'cameras.txt'), 'utf8'), images: fs.readFileSync(path.join(txt, 'images.txt'), 'utf8'), points: fs.readFileSync(path.join(txt, 'points3D.txt'), 'utf8') };
    const n = H3.parseImages(model.images).length;
    if (!best || n > best.n) best = { n, model, id: m };
  }
  log('modell ' + best.id + ': ' + best.n + ' / ' + photos.length + ' fotó elhelyezve');

  const name = a.name || path.basename(path.resolve(dir));
  let house = H3.build(best.model, { name, images: photos.length, tool: { colmap: info.text, dense: false, matcher } });
  // 4. the dense cloud, only with CUDA (COLMAP's stereo needs it)
  const dense = a.dense || 'auto';
  if (dense === 'on' || (dense === 'auto' && info.cuda)) {
    if (!info.cuda) log('a sűrű felhőhöz CUDA kell: kihagyva');
    else {
      const dd = path.join(work, 'dense');
      step(col, 'image_undistorter', { image_path: dir, input_path: path.join(sparse, best.id), output_path: dd, output_type: 'COLMAP' }, null, log);
      step(col, 'patch_match_stereo', { workspace_path: dd, workspace_format: 'COLMAP', 'PatchMatchStereo.geom_consistency': 'true' }, null, log);
      const ply = path.join(dd, 'fused.ply');
      step(col, 'stereo_fusion', { workspace_path: dd, workspace_format: 'COLMAP', input_type: 'geometric', output_path: ply }, null, log);
      const pts = H3.parsePly(fs.readFileSync(ply));
      house = H3.withDense(house, best.model, pts);
      house.tool.dense = true;
      log('sűrű felhő: ' + house.report.points + ' pont');
    }
  }
  const out = a.out || path.join(dir, name.replace(/[^\w.-]+/g, '-') + '.house3d.json');
  fs.writeFileSync(out, JSON.stringify(house));
  log('kész (' + Math.round((Date.now() - t0) / 1000) + ' s): ' + out + ' · ' + house.report.points + ' pont, ' + house.report.registered + ' fotó');
  if (!a.keep && !a.work) fs.rmSync(work, { recursive: true, force: true });
  return out;
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('[house3d] ' + e.message); process.exit(1); }
}
module.exports = { findColmap, about, args, waiting, INBOX };
