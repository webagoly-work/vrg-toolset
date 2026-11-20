#!/usr/bin/env node
// ---------------------------------------------------------------------------
// workflow-seal.js — the Varler Workflow Kit's jobs, sealed for the owner's phone (VRG Mobile WP M42, D-50 = C).
//
//   node tools/workflow-seal.js status                 jobs found (codes only), phone keys, who is trusted
//   node tools/workflow-seal.js trust <ID> <CODE>      trust a phone's key: CODE is the 6 characters its
//                                                      Workflow Kit screen shows (checked by eye, once)
//   node tools/workflow-seal.js untrust <ID>           stop sealing to that phone (its sealed file is removed)
//   node tools/workflow-seal.js seal [--dry] [--force] pack the jobs, seal one copy per trusted phone, push
//
//   --jobs=<dir>        the job folders (default: VRG_JOBS_DIR, else Full\jobs next to the repo)
//   --trust-file=<f>    the trusted keys (default: Full\_admin\keys\workflow-recipients.json, outside Git)
//   --devices=<f>       Mobile/trust/devices.json (default: the repo's)
//   --keys=<dir> --out=<dir>   tests: read keys/ from a folder and write sealed/ to a folder instead of git
//
// What is sealed (per job folder <CODE>_<anything> in jobs\): the Kit's steps that have a file, offer.json's priced
// variants (labour, material, hours, days, m2), the address (decisions.json / answers_r1.json), the job's own .md
// texts (up to 64 KB each, 768 KB a job) and its file list (names and sizes). No PDF content, no other client's files.
//
// The crypto is WebCrypto: P-256 ECDH with a fresh key per seal, the raw shared secret as the AES-256-GCM key (what
// kit-core DeviceTrust / Workflow use), a 12-byte IV, the phone's id as additional data, gzip inside.
// Only sealed/<ID>.json and the phones' own keys/<ID>.json are ever on the `workflow-sealed` branch. A commit is made
// with git plumbing (a private index, commit-tree, push of that commit): the working tree and the current branch are
// never touched, and the push is never forced.
//
// Console output stays ASCII and names job codes only.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const C = crypto.webcrypto;

const REPO = path.resolve(__dirname, '..');
const FULL = path.dirname(REPO);
const BRANCH = 'workflow-sealed';
const MAX_PLAIN = 8 * 1024 * 1024;
const DOC_MAX = 64 * 1024, DOCS_MAX = 768 * 1024;
const STEPS = ['funnel', 'takeoff', 'price', 'offer', 'doc'];

const argv = process.argv.slice(2);
const opt = k => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const flag = k => argv.includes('--' + k);
const pos = argv.filter(a => !a.startsWith('--'));
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const ascii = s => String(s).replace(/[^\x20-\x7E]/g, '?');
const b64u = b => Buffer.from(b).toString('base64url');
const norm = id => String(id || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
/** the Eszközök code: SHA-256 over "<id>.<x>.<y>", first 6 hex digits, upper case (DeviceTrust.code) */
const codeOf = (id, pub) => sha256(`${id}.${pub.x}.${pub.y}`).slice(0, 6).toUpperCase();

// ---------------------------------------------------------------- the jobs
function jobsDir() {
  if (opt('jobs')) return path.resolve(opt('jobs'));
  if (process.env.VRG_JOBS_DIR) return path.resolve(process.env.VRG_JOBS_DIR);
  return path.join(FULL, 'jobs');
}
function walk(dir, depth, out = []) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth > 0 && !/^(node_modules|\.git|\.cache)$/.test(e.name)) walk(p, depth - 1, out); }
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const DOC_ORDER = [/AJANLAT|ARAJANLAT/i, /TERVEZET|KOLTSEG/i, /MENNYISEG/i, /FELADAT|FELMERES/i, /PIACI/i, /WORKLOG/i];
const docRank = n => { const i = DOC_ORDER.findIndex(r => r.test(n)); return i < 0 ? DOC_ORDER.length : i; };
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);

/** offer.json's priced variants: every top-level object with labour.total or material.total (A, B, ...) */
function variants(offer) {
  const out = [];
  for (const [k, v] of Object.entries(offer || {})) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const labour = num(v.labour && v.labour.total), material = num(v.material && v.material.total);
    if (labour == null && material == null) continue;
    const dur = v.dur || {};
    const days = [num(dur.x), num(dur.y)].filter(d => d != null);
    out.push({ key: k, labour, material, total: num(v.total) != null ? v.total : (labour || 0) + (material || 0),
      hours: num(dur.emberora), days, m2: num(offer[k + '_M2']) });
  }
  return out;
}
function readJob(dir, folder, code) {
  const files = walk(dir, 3);
  const rel = f => path.relative(dir, f).split(path.sep).join('/');
  const has = re => files.some(f => re.test(rel(f)));
  const job = path.join(dir, 'job');
  const steps = {
    funnel: has(/(^|\/)funnel\/|answers_r\d+\.json$/i),
    takeoff: has(/_takeoff\.json$|MENNYISEGEK\.md$/i),
    price: has(/(^|\/)price\.json$/i),
    offer: has(/(^|\/)offer\.json$/i),
    doc: has(/\.pdf$/i),
  };
  let address = null;
  for (const f of [path.join(job, 'funnel', 'decisions.json'), path.join(job, 'answers_r1.json')]) {
    if (address || !isFile(f)) continue;
    try { const a = readJson(f); const v = a.address || (a.answers && a.answers.address); if (typeof v === 'string' && v.trim()) address = v.trim(); } catch { /* skipped */ }
  }
  let vs = [];
  const offerFile = isFile(path.join(job, 'offer.json')) ? path.join(job, 'offer.json') : files.find(f => /(^|[\\/])offer\.json$/i.test(f));
  if (offerFile) { try { vs = variants(readJson(offerFile)); } catch { /* a broken offer.json gives no variants */ } }
  const mds = files.filter(f => /\.md$/i.test(f)).sort((a, b) => docRank(path.basename(a)) - docRank(path.basename(b)) || rel(a).localeCompare(rel(b)));
  const docs = []; let total = 0;
  for (const f of mds) {
    const size = fs.statSync(f).size;
    if (size > DOC_MAX || total + size > DOCS_MAX) continue;
    docs.push({ name: rel(f), text: fs.readFileSync(f, 'utf8').replace(/^﻿/, '') });
    total += size;
  }
  let updated = 0;
  for (const f of files) { try { updated = Math.max(updated, fs.statSync(f).mtimeMs); } catch { /* gone */ } }
  return {
    code, folder, title: folder.slice(code.length + 1).replace(/_/g, ' ').trim() || code,
    updated: updated ? new Date(updated).toISOString() : '', address, steps, variants: vs, docs,
    files: files.map(f => ({ name: rel(f), size: fs.statSync(f).size })).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 400),
  };
}
function readJobs(dir) {
  let dirs = []; try { dirs = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { return []; }
  const out = [];
  for (const d of dirs.sort()) {
    const m = /^([A-Z]{1,3}\d{1,3})_/.exec(d);
    if (m) out.push(readJob(path.join(dir, d), d, m[1]));
  }
  return out;
}
function pack(jobs) {
  return { t: 'vrg-wk-pack', v: 1, made: new Date().toISOString(), from: ascii(os.hostname()), jobs };
}

// ---------------------------------------------------------------- the seal
async function seal(plain, to, pub, made, jobs) {
  const raw = Buffer.from(plain, 'utf8');
  if (raw.length > MAX_PLAIN) throw new Error('pack too big: ' + raw.length + ' bytes');
  const eph = await C.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const pk = await C.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const aes = await C.subtle.deriveKey({ name: 'ECDH', public: pk }, eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = C.getRandomValues(new Uint8Array(12));
  const ct = await C.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: Buffer.from('vrg-wk-sealed/1/' + norm(to)) }, aes, zlib.gzipSync(raw));
  const e = await C.subtle.exportKey('jwk', eph.publicKey);
  return { t: 'vrg-wk-sealed', v: 1, to: norm(to), epub: { kty: 'EC', crv: 'P-256', x: e.x, y: e.y }, iv: b64u(iv), ct: b64u(ct), z: 'gzip', made, jobs };
}
/** the reverse, for the tests (the phone does it in kit-core Workflow.open) */
async function open(sealed, myId, privPkcs8) {
  const priv = await C.subtle.importKey('pkcs8', Buffer.from(privPkcs8, 'base64url'), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  const pk = await C.subtle.importKey('jwk', sealed.epub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const aes = await C.subtle.deriveKey({ name: 'ECDH', public: pk }, priv, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const z = await C.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(sealed.iv, 'base64url'), additionalData: Buffer.from('vrg-wk-sealed/1/' + norm(myId)) },
    aes, Buffer.from(sealed.ct, 'base64url'));
  return zlib.gunzipSync(Buffer.from(z)).toString('utf8');
}

// ---------------------------------------------------------------- keys, trust, the device list
function trustFile() { return path.resolve(opt('trust-file') || path.join(FULL, '_admin', 'keys', 'workflow-recipients.json')); }
function readTrust() { const f = trustFile(); return isFile(f) ? readJson(f) : { about: 'VRG Mobile WP M42: phones the Workflow Kit is sealed to. Outside Git.', recipients: {} }; }
function writeTrust(t) { const f = trustFile(); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(t, null, 2) + '\n'); }
function readDevices() {
  const f = path.resolve(opt('devices') || path.join(REPO, 'Mobile', 'trust', 'devices.json'));
  try { return (readJson(f).devices || []).map(d => norm(d.id)); } catch { return []; }
}
function git(args, input, env) {
  return execFileSync('git', args, { cwd: REPO, input, env: Object.assign({}, process.env, env || {}), stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}
/** the branch's head after a fetch, or null when it does not exist yet (the phone creates it with its key) */
function branchHead() {
  try { git(['fetch', '-q', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]); } catch { return null; }
  try { return git(['rev-parse', `refs/remotes/origin/${BRANCH}`]); } catch { return null; }
}
/** keys/<ID>.json on the branch (or in --keys=<dir>), parsed and checked */
function readKeys(head) {
  const out = {};
  const take = (name, text) => {
    try {
      const k = JSON.parse(text);
      const id = norm(k.id);
      if (k.t !== 'vrg-wk-key' || !k.pub || !k.pub.x || !k.pub.y || id + '.json' !== name) return;
      out[id] = { id, name: ascii(k.name || ''), pub: { x: k.pub.x, y: k.pub.y }, code: codeOf(id, k.pub), at: k.at || '' };
    } catch { /* a broken key file is ignored */ }
  };
  if (opt('keys')) {
    const d = path.resolve(opt('keys'));
    for (const n of (isDir(d) ? fs.readdirSync(d) : [])) if (n.endsWith('.json')) take(n, fs.readFileSync(path.join(d, n), 'utf8'));
  } else if (head) {
    let names = []; try { names = git(['ls-tree', '--name-only', head, 'keys/']).split('\n').filter(Boolean); } catch { /* no keys */ }
    for (const p of names) take(path.basename(p), git(['show', `${head}:${p}`]));
  }
  return out;
}

// ---------------------------------------------------------------- commands
async function cmdStatus() {
  const jobs = readJobs(jobsDir());
  console.log(`jobs: ${jobs.length} in ${ascii(jobsDir())}`);
  for (const j of jobs) console.log(`  ${j.code}  ${STEPS.filter(s => j.steps[s]).join(' > ') || '-'}  variants ${j.variants.length}  docs ${j.docs.length}`);
  const head = opt('keys') ? null : branchHead();
  if (!opt('keys')) console.log(head ? `branch ${BRANCH}: ${head.slice(0, 10)}` : `branch ${BRANCH}: not yet (the phone creates it: Workflow Kit -> Kulcs kozzetetele)`);
  const keys = readKeys(head), trust = readTrust().recipients || {}, dev = readDevices();
  const ids = [...new Set([...Object.keys(keys), ...Object.keys(trust)])].sort();
  if (!ids.length) console.log('phones: none yet');
  for (const id of ids) {
    const k = keys[id], t = trust[id];
    const state = !k ? 'trusted, but its key is gone from the branch' : !dev.includes(id) ? 'not on Mobile/trust/devices.json' :
      !t ? `waiting: node tools/workflow-seal.js trust ${id} <code on the phone>` :
      (t.x !== k.pub.x || t.y !== k.pub.y) ? 'KEY CHANGED since it was trusted: trust it again' : 'trusted';
    console.log(`  ${id}  ${k ? k.name : ''}  ${state}`);
  }
}
async function cmdTrust(id, code) {
  id = norm(id);
  if (!id || !code) { console.error('usage: workflow-seal.js trust <ID> <CODE>'); process.exit(2); }
  const k = readKeys(opt('keys') ? null : branchHead())[id];
  if (!k) { console.error(`no key for ${id} on ${BRANCH}: on the phone, Workflow Kit -> Kulcs kozzetetele first`); process.exit(1); }
  if (!readDevices().includes(id)) { console.error(`${id} is not on Mobile/trust/devices.json: approve the phone in Eszkozok first`); process.exit(1); }
  if (k.code !== String(code).trim().toUpperCase()) { console.error(`the code does not match (the key on the branch gives a different one): not trusted`); process.exit(1); }
  const t = readTrust(); t.recipients = t.recipients || {};
  t.recipients[id] = { name: k.name, x: k.pub.x, y: k.pub.y, code: k.code, trusted: new Date().toISOString() };
  writeTrust(t);
  console.log(`trusted ${id} (${k.name}); now: node tools/workflow-seal.js seal`);
}
async function cmdUntrust(id) {
  id = norm(id);
  const t = readTrust();
  if (!t.recipients || !t.recipients[id]) { console.log(`${id} was not trusted`); return; }
  delete t.recipients[id]; writeTrust(t);
  console.log(`untrusted ${id}; the next seal removes its sealed file`);
}
async function cmdSeal() {
  const dry = flag('dry'), force = flag('force');
  const jobs = readJobs(jobsDir());
  const p = pack(jobs);
  const plain = JSON.stringify(p);
  const plainSha = sha256(JSON.stringify(Object.assign({}, p, { made: '' })));
  console.log(`pack: ${jobs.length} jobs, ${plain.length} bytes (${jobs.map(j => j.code).join(' ') || '-'})`);
  const head = opt('keys') ? null : branchHead();
  const keys = readKeys(head), t = readTrust(), dev = readDevices();
  const rec = t.recipients || {};
  const sealed = {}, drop = [];
  for (const [id, r] of Object.entries(rec)) {
    const k = keys[id];
    if (!k) { console.log(`  ${id}: skipped, its key is not on the branch`); continue; }
    if (k.pub.x !== r.x || k.pub.y !== r.y) { console.log(`  ${id}: skipped, KEY CHANGED since it was trusted (trust it again)`); continue; }
    if (!dev.includes(id)) { console.log(`  ${id}: skipped, not on Mobile/trust/devices.json any more`); drop.push(id); continue; }
    if (!force && r.lastSha === plainSha) { console.log(`  ${id}: unchanged since the last seal`); continue; }
    sealed[id] = await seal(plain, id, k.pub, p.made, jobs.length);
    r.lastSha = plainSha; r.lastSeal = p.made;
    console.log(`  ${id}: sealed, ${JSON.stringify(sealed[id]).length} bytes`);
  }
  if (head && !opt('out')) {
    let have = []; try { have = git(['ls-tree', '--name-only', head, 'sealed/']).split('\n').filter(Boolean).map(s => norm(path.basename(s, '.json'))); } catch { /* none */ }
    for (const id of have) if (!rec[id] && !drop.includes(id)) drop.push(id);
  }
  if (!Object.keys(sealed).length && !drop.length) { console.log('nothing to write'); return; }
  if (dry) { console.log('dry run: nothing written'); return; }

  if (opt('out')) {
    const d = path.resolve(opt('out'), 'sealed'); fs.mkdirSync(d, { recursive: true });
    for (const [id, s] of Object.entries(sealed)) fs.writeFileSync(path.join(d, id + '.json'), JSON.stringify(s) + '\n');
    for (const id of drop) { try { fs.unlinkSync(path.join(d, id + '.json')); } catch { /* not there */ } }
    writeTrust(t);
    console.log(`wrote ${Object.keys(sealed).length} sealed file(s) to ${ascii(d)}`);
    return;
  }
  if (!head) { console.log(`branch ${BRANCH} does not exist yet: publish the phone's key first`); return; }
  const idx = path.join(os.tmpdir(), `vrg-wk-index-${process.pid}`);
  const env = { GIT_INDEX_FILE: idx };
  try {
    git(['read-tree', head], null, env);
    for (const [id, s] of Object.entries(sealed)) {
      const blob = git(['hash-object', '-w', '--stdin'], JSON.stringify(s) + '\n');
      git(['update-index', '--add', '--cacheinfo', `100644,${blob},sealed/${id}.json`], null, env);
    }
    for (const id of drop) { try { git(['update-index', '--force-remove', `sealed/${id}.json`], null, env); } catch { /* not there */ } }
    const tree = git(['write-tree'], null, env);
    if (tree === git(['rev-parse', `${head}^{tree}`])) { console.log('nothing changed on the branch'); writeTrust(t); return; }
    const msg = `workflow-sealed: ${Object.keys(sealed).length} sealed, ${drop.length} removed (WP M42)`;
    const commit = git(['-c', 'user.name=VRG workflow-seal', '-c', 'user.email=workflow-seal@vrg.invalid', 'commit-tree', tree, '-p', head, '-m', msg]);
    git(['push', '-q', 'origin', `${commit}:refs/heads/${BRANCH}`]);
    writeTrust(t);
    console.log(`pushed ${commit.slice(0, 10)} to ${BRANCH}`);
  } catch (e) {
    console.error('git failed: ' + ascii(String(e.stderr || e.message).split('\n')[0]) + ' (if the branch moved, run seal again)');
    process.exitCode = 1;
  } finally { try { fs.unlinkSync(idx); } catch { /* gone */ } }
}

if (require.main === module) {
  const cmd = pos[0] || 'status';
  const run = { status: cmdStatus, trust: () => cmdTrust(pos[1], pos[2]), untrust: () => cmdUntrust(pos[1]), seal: cmdSeal }[cmd];
  if (!run) { console.error('usage: workflow-seal.js status | trust <ID> <CODE> | untrust <ID> | seal [--dry] [--force]'); process.exit(2); }
  run().catch(e => { console.error(ascii(e.message || e)); process.exit(1); });
}
module.exports = { readJobs, readJob, variants, pack, seal, open, codeOf, norm };
