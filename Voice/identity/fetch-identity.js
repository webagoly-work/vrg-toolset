#!/usr/bin/env node
// fetch-identity.js — WP-59 Hangazonosítás: download the speaker-embedding model of Voice/voice-manifest.json `identity` into
// <Full>/tools/voice/identity. Zero dependencies; the download helper is Voice/fetch.js's (sha256 while streaming; a mismatch deletes
// the file and stops). The model runs on the sherpa-onnx-node addon Voice/tts installs: `node Voice/tts/fetch-tts.js addon`.
//   node Voice/identity/fetch-identity.js --list        what is pinned, what is installed
//   node Voice/identity/fetch-identity.js               the default model (CAM++ VoxCeleb)
//   node Voice/identity/fetch-identity.js <model id>…   these (e.g. wespeaker-resnet34)
//   --full <dir>                                        the Full folder (default: the repo's parent, or VRG_FULL)
//   layout: identity/<model file>   identity/installed.json { model: <file of the active model>, models: { id: { file, sha256 } } }
'use strict';
const fs = require('fs'), path = require('path');
const F = require('../fetch.js');

const MANIFEST = path.join(__dirname, '..', 'voice-manifest.json');
const ROOT = path.join(F.ROOT, 'identity');
const ADDON = path.join(F.ROOT, 'tts', 'node', 'node_modules', 'sherpa-onnx-node');
const manifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).identity;
const installed = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'installed.json'), 'utf8')); } catch (e) { return { model: null, models: {} }; } };
function save(inst) { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(path.join(ROOT, 'installed.json'), JSON.stringify(inst, null, 1)); }

async function fetchModel(m, makeActive) {
  console.log('model ' + m.id + ' (' + m.sizeMB + ' MB) ← ' + m.url);
  console.log('  licence: ' + m.license);
  const dest = path.join(ROOT, m.file);
  const d = await F.download(m.url, dest);
  if (d.sha256 !== m.sha256) { fs.rmSync(d.part, { force: true }); throw new Error('sha256 mismatch for ' + m.id + ': got ' + d.sha256); }
  fs.renameSync(d.part, dest);
  const inst = installed();
  inst.models = inst.models || {};
  inst.models[m.id] = { file: m.file, sha256: d.sha256 };
  if (makeActive || !inst.model) inst.model = m.file;
  save(inst);
  console.log('  ok: ' + m.file + (inst.model === m.file ? ' (active)' : ''));
}

module.exports = { ROOT, ADDON, manifest, installed };

if (require.main === module) {
  const argv = process.argv.slice(2).filter((a, i, l) => a !== '--full' && l[i - 1] !== '--full');
  (async () => {
    const m = manifest(), inst = installed();
    if (argv.includes('--list')) {
      for (const x of m.models) console.log((x.default ? '* ' : '  ') + x.id.padEnd(20) + (inst.models && inst.models[x.id] ? 'installed' : '-').padEnd(11) + x.file + (inst.model === x.file ? '  (active)' : ''));
      console.log('addon  ' + (fs.existsSync(ADDON) ? 'installed' : 'missing: node Voice/tts/fetch-tts.js addon'));
      return;
    }
    const ids = argv.filter(a => !a.startsWith('--'));
    const want = ids.length ? ids.map(id => { const x = m.models.find(y => y.id === id); if (!x) throw new Error('unknown model ' + id + ' (pinned: ' + m.models.map(y => y.id).join(', ') + ')'); return x; }) : m.models.filter(x => x.default);
    for (const x of want) await fetchModel(x, ids.length === 1 || x.default);
    if (!fs.existsSync(ADDON)) console.log('\nThe sherpa-onnx-node addon is not installed yet: node Voice/tts/fetch-tts.js addon');
  })().catch(e => { console.error('fetch-identity: ' + e.message); process.exit(1); });
}
