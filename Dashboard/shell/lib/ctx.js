// ctx.js — "Csomag" (WP-22): VRG Stack node clusters as context packs, and "send to Claude" (API.md vrg.ctx).
//   const ctx = createCtx({ execFile, node, stackDir, paths, claudeterm, repo, now });
//   ctx.expand(ids, layers, depth) → { ok, nodes, edges, tokens }          ctx.pack(ids, { budget, withL0, withLines, note }) → { ok, text, tokens, packId }
//   ctx.clusters() / saveCluster(name, ids) / deleteCluster(id)             ctx.sendToClaude(packId, 'term-A'|'term-B'|'chat')
// stack-json.js (WP-21) does the graph work: one execFile on {node}, the ids as ONE comma-joined argv item. The pack file lives under
// paths.packs(); packId → file stays in memory and no reply ever carries a path (CONTRACT §3, §4.8).
// Electron stays out: execFile, paths and claudeterm are passed in, so node --test can load this file.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const ID_RE = /^[A-Z]:[^\s,]{1,150}$/;
const LAYERS_RE = /^[FIQLARCGE]+$/;
const ORDER = 'FIQLARCGE';
const NOTE_MAX = 2000, NAME_MAX = 80, CLUSTERS_MAX = 200;
const tok = s => Math.ceil(String(s).length / 4);
const bad = hu => ({ ok: false, err: 'bad-request', hu });
const validId = v => typeof v === 'string' && ID_RE.test(v);
const validIds = (ids, max) => Array.isArray(ids) && ids.length >= 1 && ids.length <= max && ids.every(validId);

function defaultStackJs() { return path.join(__dirname, '..', '..', 'tools', 'stack-json.js'); }

const two = n => String(n).padStart(2, '0');
function stamp(d) { return '' + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + '-' + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds()); }
function slug(id) { return String(id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'pack'; }

function createCtx({ execFile, node = 'node', stackDir, paths, claudeterm, repo, stackJs = defaultStackJs(), now = () => new Date() }) {
  const packs = new Map();                                    // packId → file (main only)

  // execFile with an argument array, never a shell string; stack-json prints {"ok":false,"err"} on stdout and exits 2 on a stack error
  const run = args => new Promise(res => {
    const a = [stackJs, ...(stackDir ? ['--stack', stackDir] : []), ...args];
    try { execFile(node, a, { cwd: path.dirname(stackJs), timeout: 20000, windowsHide: true, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (err, stdout) => res({ err, stdout: String(stdout || '') })); }
    catch (e) { res({ err: e, stdout: '' }); }
  });
  const failed = { ok: false, err: 'failed', hu: 'A Rétegverem nem válaszolt.' };
  const notFound = { ok: false, err: 'not-found', hu: 'Nincs ilyen elem a Rétegvermben.' };

  async function expand(ids, layers, depth) {
    if (!validIds(ids, 50)) return bad('Érvénytelen azonosító.');
    const l = String(layers == null ? '' : layers).replace(/[\s,]/g, '');
    if (l && !LAYERS_RE.test(l)) return bad('Érvénytelen réteg.');
    if (depth !== 1 && depth !== 2) return bad('Érvénytelen mélység.');
    // stack-json keeps the seeds whatever their layer (DESK-Q58 C); the answer keeps the ticked layers plus the seeds
    const want = new Set(l || ORDER);
    const send = ORDER.split('').filter(c => want.has(c)).join('');
    const r = await run(['expand', ids.join(','), '--layers', send, '--depth', String(depth)]);
    let j = null; try { j = JSON.parse(r.stdout); } catch (e) {}
    if (j && j.ok === false) return { ...notFound };
    if (r.err || !j || !Array.isArray(j.nodes) || !Array.isArray(j.edges)) return { ...failed };
    const seeds = new Set(ids);
    const nodes = j.nodes.filter(n => n && validId(n.id) && (want.has(n.layer) || seeds.has(n.id)))
      .map(n => ({ id: n.id, layer: String(n.layer || n.id[0]), title: String(n.title || '').slice(0, 300), state: String(n.state || '').slice(0, 80), t: String(n.t || '').slice(0, 40) }));
    const keep = new Set(nodes.map(n => n.id));
    const edges = j.edges.filter(e => e && keep.has(e.a) && keep.has(e.b)).map(e => ({ a: e.a, b: e.b, rel: String(e.rel || '') }));
    return { ok: true, nodes, edges, tokens: nodes.reduce((s, n) => s + tok(`${n.id} ${n.title} ${n.state} ${n.t}`), 0) };
  }

  // note: free text of the selection menu (≤ 2 000 chars), put after stack-json's output and counted inside the budget
  async function pack(ids, opts = {}) {
    if (!validIds(ids, 80)) return bad('Érvénytelen azonosító.');
    const o = opts && typeof opts === 'object' ? opts : {};
    const budget = o.budget;
    if (!Number.isInteger(budget) || budget < 300 || budget > 20000) return bad('Érvénytelen keret.');
    let note = '';
    if (o.note !== undefined && o.note !== null) {
      if (typeof o.note !== 'string' || o.note.length > NOTE_MAX) return bad('A jegyzet túl hosszú.');
      note = o.note.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    }
    const block = note ? `\n\n## kézi jegyzet\n${note}\n` : '';
    const inner = budget - tok(block);
    if (inner < 1) return bad('A jegyzet nem fér a keretbe.');
    const r = await run(['pack', ids.join(','), '--budget', String(inner), ...(o.withL0 === true ? ['--l0'] : []), ...(o.withLines === true ? ['--lines'] : [])]);
    if (/^\s*\{"ok":false/.test(r.stdout)) return { ...notFound };
    if (r.err || !r.stdout.trim()) return { ...failed };
    const text = r.stdout.replace(/\s+$/, '') + block;
    const file = path.join(paths.packs(), stamp(now()) + '-' + slug(ids[0]) + '.md');
    try { fs.writeFileSync(file, text + '\n', 'utf8'); } catch (e) { return { ok: false, err: 'error', hu: 'A csomag nem menthető.' }; }
    const packId = 'p' + crypto.randomBytes(8).toString('hex');
    packs.set(packId, file);
    return { ok: true, text, tokens: tok(text), packId };
  }

  // saved clusters: [{ id, name, ids, at }] in <userDir>/clusters.json
  const clusterFile = () => path.join(paths.userDir(), 'clusters.json');
  function readClusters() {
    try {
      const j = JSON.parse(fs.readFileSync(clusterFile(), 'utf8'));
      return Array.isArray(j) ? j.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string' && validIds(c.ids, 80)) : [];
    } catch (e) { return []; }
  }
  const writeClusters = list => { fs.writeFileSync(clusterFile(), JSON.stringify(list, null, 1), 'utf8'); };
  const publicList = list => ({ ok: true, clusters: list.map(c => ({ id: c.id, name: c.name, ids: c.ids.slice(), at: c.at })) });

  function clusters() { return publicList(readClusters()); }
  function saveCluster(name, ids) {
    const n = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
    if (!n || n.length > NAME_MAX) return bad('Érvénytelen név.');
    if (!validIds(ids, 80)) return bad('Érvénytelen azonosító.');
    let list = readClusters();
    const same = list.find(c => c.name.toLowerCase() === n.toLowerCase());
    const entry = { id: same ? same.id : 'c' + crypto.randomBytes(6).toString('hex'), name: n, ids: [...new Set(ids)], at: now().toISOString() };
    list = same ? list.map(c => (c === same ? entry : c)) : [...list, entry];
    if (list.length > CLUSTERS_MAX) return bad('Túl sok mentett csomag.');
    try { writeClusters(list); } catch (e) { return { ok: false, err: 'error', hu: 'A csomag nem menthető.' }; }
    return { ...publicList(list), saved: entry.id };
  }
  function deleteCluster(id) {
    const list = readClusters();
    if (!list.some(c => c.id === id)) return { ...notFound, hu: 'Nincs ilyen mentett csomag.' };
    const rest = list.filter(c => c.id !== id);
    try { writeClusters(rest); } catch (e) { return { ok: false, err: 'error', hu: 'A csomag nem menthető.' }; }
    return publicList(rest);
  }

  // term-A / term-B open an embedded Claude Code primed with the pack file; chat hands the packId to the chat pane (WP-24)
  function sendToClaude(packId, how) {
    const file = typeof packId === 'string' ? packs.get(packId) : null;
    if (!file) return { ok: false, err: 'not-found', hu: 'Nincs ilyen csomag.' };
    if (how === 'chat') return { ok: true, packId };
    if (how !== 'term-A' && how !== 'term-B') return bad('Érvénytelen cél.');
    const r = claudeterm.open({
      account: how === 'term-B' ? 'B' : 'A', cwd: repo,
      firstPrompt: 'Read the context pack at ' + file + ' (the VRG Stack cluster I picked). Then wait for my question.',
    });
    if (!r || !r.term) return { ok: false, err: (r && r.err) || 'error', hu: (r && r.hu) || 'A terminál nem indult el.' };
    return { ok: true, term: r.term };
  }

  return { expand, pack, clusters, saveCluster, deleteCluster, sendToClaude, packFile: id => packs.get(id) || null };   // packFile: main-side only (WP-24)
}

module.exports = { createCtx, validId, validIds, ID_RE, NOTE_MAX };
