// VRG Stack — the layer text (S8 of research/STRINGS-PLAN.md §6.1): every layer written out as bytes, so the Stack
// Viewer (viewer.html, Rétegverem) can draw the layer as the particles it is made of, one particle per byte.
//
//   build(nodes, opts) → { L: { buf, idx: [[id, start, end, hash]] } }     pure: the same nodes give the same bytes
//   diff(prevIdx, idx) → { changed, added, removed }                       by each node's own hash
//   timeline(events, nodes) → { days, born, ev }                         the Viewer's time scrubber (S10), from data/events.jsonl
//   write({ graph, facts, out, repo, events }) → { msg, layers }           out/layertext/<L>.bin · .idx · .js + index.js + time.js
//
// What a node's bytes are (UTF-8, in id order inside the layer):
//   § <id>\n <title>\n <brief>\n <kind · t · state · lane · tier · path>\n <own keys>\n
//   G (documents): then the document's own text (STK-Q23 = whole documents; capped at DOC_CAP)
//   C (folders):   then the folder's own files, one `name  bytes` line each (the code itself is not copied; S10
//                  streams it on demand)
// Deterministic: no times of the build go in, nodes are sorted by id, so a node that did not change keeps its bytes
// and its hash; diff() names the ones that did (the Viewer glows them).
//
// Files (out/ is git-ignored: the layer text quotes client codes and document contents, it never leaves the PC as
// text; the phone bundle carries only each particle's byte class, see Mobile/stack/publish-stack.js):
//   <L>.bin   the bytes                       <L>.idx   JSON { layer, bytes, nodes: [[id, start, end, hash]] }
//   <L>.js    LAYERTEXT_LOAD('<L>', idx, base64)  for file://, where fetch() of a .bin is refused
//   index.js  window.LAYERTEXT_INDEX = { generated, layers: { L: { bytes, nodes } }, diff: { L: {...} } }
//   time.js   window.LAYERTEXT_TIME = { days: ['YYYY-MM-DD' …], born: { id: day index }, ev: [[day index, id, op]] }
'use strict';

const fs = require('fs');
const path = require('path');

const DOC_CAP = 512 * 1024;                // one document's text at most (a longer one is cut, and says so)
const TEXT_EXT = /\.(md|txt|html?|json|csv|ya?ml|js|cjs|mjs|ts|ps1|cmd|bat|css|kt|xml|ini|toml)$/i;
const ORDER = ['F', 'N', 'I', 'T', 'Q', 'L', 'A', 'U', 'R', 'C', 'G', 'E'];

// FNV-1a, 32 bit, over the bytes: the node's fingerprint between builds
function hash(buf, start = 0, end = buf.length) {
  let h = 0x811c9dc5;
  for (let i = start; i < end; i++) { h ^= buf[i]; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const clean = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n');

function head(n) {
  const fields = [n.kind, n.t, n.state, n.lane, n.tier, n.path].map(x => clean(x).replace(/\n/g, ' ')).join(' · ');
  return `§ ${n.id}\n${clean(n.title)}\n${clean(n.brief)}\n${fields}\n${(n.own || []).join(' ')}\n`;
}

// opts.doc(path) → the document's text or null; opts.files(folder) → [[name, bytes]] of the folder's own files
function build(nodes, opts = {}) {
  const by = {};
  for (const n of nodes) if (n && n.id && n.layer) (by[n.layer] = by[n.layer] || []).push(n);
  const out = {};
  const rank = L => (ORDER.includes(L) ? ORDER.indexOf(L) : 99);
  for (const L of Object.keys(by).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1))) {
    const list = by[L].slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const parts = [], idx = [];
    let at = 0;
    for (const n of list) {
      let s = head(n);
      if (L === 'G' && opts.doc && n.path) {
        const t = opts.doc(n.path);
        if (t != null) s += '\n' + (t.length > DOC_CAP ? t.slice(0, DOC_CAP) + `\n… (${t.length - DOC_CAP} more characters not in the layer text)\n` : t) + '\n';
      }
      if (L === 'C' && opts.files && n.path) {
        const f = opts.files(n.path) || [];
        if (f.length) s += f.map(([name, b]) => `${name}  ${b}`).join('\n') + '\n';
      }
      const b = Buffer.from(s, 'utf8');
      parts.push(b); idx.push([n.id, at, at + b.length, hash(b)]); at += b.length;
    }
    out[L] = { buf: Buffer.concat(parts, at), idx };
  }
  return out;
}

function diff(prev, idx) {
  const before = new Map((prev || []).map(r => [r[0], r[3]]));
  const now = new Set();
  const changed = [], added = [];
  for (const [id, , , h] of idx) { now.add(id); if (!before.has(id)) added.push(id); else if (before.get(id) !== h) changed.push(id); }
  const removed = [...before.keys()].filter(id => !now.has(id));
  return { changed, added, removed };
}

// the facts a real build has: documents read from the repo (text only), each folder's own files with their sizes
function sources(repo, facts) {
  const byDir = new Map();
  for (const f of (facts && facts.paths) || []) {
    const i = f.lastIndexOf('/'), d = i < 0 ? '' : f.slice(0, i);
    (byDir.get(d) || byDir.set(d, []).get(d)).push(f);
  }
  const inside = p => { const a = path.resolve(repo, p); return a.startsWith(path.resolve(repo) + path.sep) ? a : null; };
  return {
    doc(p) {
      if (!TEXT_EXT.test(p)) return null;
      const a = inside(p); if (!a) return null;
      try { return fs.readFileSync(a, 'utf8').replace(/\r\n?/g, '\n'); } catch { return null; }
    },
    files(dir) {
      return (byDir.get(dir) || []).slice().sort().map(f => {
        let b = 0; try { const a = inside(f); if (a) b = fs.statSync(a).size; } catch { b = 0; }
        return [f.slice(dir.length + 1), b];
      });
    },
  };
}

// When each node appeared and what happened to it, by day. A node is born on the work's own date of its first `node+`
// event (`valid`, e.g. a commit's date), else the day the stack first saw it; one the log never names is born on its
// own date `t`, and one with no date at all is always there. A `state` or `edit` event is a pulse on its day.
const DAY = /^\d{4}-\d\d-\d\d$/;
function timeline(events, nodes) {
  const day = s => String(s || '').slice(0, 10), when = r => DAY.test(day(r.valid)) ? day(r.valid) : day(r.seen);
  const ids = new Set(nodes.map(n => n.id)), born = new Map(), pulses = [];
  for (const r of events || []) {
    if (!r || !r.id || !ids.has(r.id)) continue;
    const d = when(r); if (!DAY.test(d)) continue;
    if (r.op === 'node+') { if (!born.has(r.id) || d < born.get(r.id)) born.set(r.id, d); }
    else if (r.op === 'state' || r.op === 'edit') pulses.push([d, r.id, r.op]);
  }
  for (const n of nodes) if (!born.has(n.id) && DAY.test(day(n.t))) born.set(n.id, day(n.t));
  const days = [...new Set([...born.values(), ...pulses.map(p => p[0])])].sort();
  const at = new Map(days.map((d, i) => [d, i]));
  const B = {}; for (const id of [...born.keys()].sort()) B[id] = at.get(born.get(id));
  const ev = pulses.map(([d, id, op]) => [at.get(d), id, op]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
  return { days, born: B, ev };
}

function writeAtomic(file, data) {
  const tmp = file + '.tmp' + process.pid;
  fs.writeFileSync(tmp, data); fs.renameSync(tmp, file);
}

// only: rewrite just these layers (the incremental build), the others keep their files and their index entries.
// note: what this build was ({ kind, layers, ids }), passed on to the live channel (serve.js /api/events)
function write({ graph, facts, out, repo, events, only = null, note = null }) {
  const dir = path.join(out, 'layertext');
  fs.mkdirSync(dir, { recursive: true });
  const S = sources(repo, facts);
  const keep = only ? new Set(only) : null;
  const layers = build(keep ? graph.nodes.filter(n => keep.has(n.layer)) : graph.nodes, S);
  const index = { generated: new Date().toISOString(), layers: {}, diff: {}, build: note || { kind: 'full' } };
  if (keep) {
    // the layers not rewritten: their last index entries, read from their own .idx (no diff: they did not change)
    let old = null; try { const box = { window: {} }; require('vm').runInNewContext(fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), box); old = box.window.LAYERTEXT_INDEX; } catch { old = null; }
    for (const L of Object.keys((old && old.layers) || {})) if (!keep.has(L)) index.layers[L] = old.layers[L];
  }
  let total = 0;
  for (const [L, { buf, idx }] of Object.entries(layers)) {
    let prev = null;
    try { prev = JSON.parse(fs.readFileSync(path.join(dir, L + '.idx'), 'utf8')).nodes; } catch { prev = null; }
    const body = { layer: L, bytes: buf.length, nodes: idx };
    writeAtomic(path.join(dir, L + '.bin'), buf);
    writeAtomic(path.join(dir, L + '.idx'), JSON.stringify(body));
    writeAtomic(path.join(dir, L + '.js'), `// generated by stack.js build (lib/layertext.js)\nLAYERTEXT_LOAD(${JSON.stringify(L)}, ${JSON.stringify(body)}, "${buf.toString('base64')}");\n`);
    index.layers[L] = { bytes: buf.length, nodes: idx.length };
    if (prev) index.diff[L] = diff(prev, idx);
    total += buf.length;
  }
  // a layer that is gone takes its files with it (a full build only: an incremental one leaves the others alone)
  if (!keep) for (const f of fs.readdirSync(dir)) { const m = /^([A-Z])\.(bin|idx|js)$/.exec(f); if (m && !layers[m[1]]) fs.unlinkSync(path.join(dir, f)); }
  const time = timeline(events || [], graph.nodes);
  writeAtomic(path.join(dir, 'time.js'), '// generated by stack.js build (lib/layertext.js)\nwindow.LAYERTEXT_TIME = ' + JSON.stringify(time) + ';\n');
  // index.js last: the server's live channel (serve.js /api/events) watches it as the sign that a build finished
  writeAtomic(path.join(dir, 'index.js'), '// generated by stack.js build (lib/layertext.js)\nwindow.LAYERTEXT_INDEX = ' + JSON.stringify(index) + ';\n');
  const ch = Object.values(index.diff).reduce((a, d) => a + d.changed.length + d.added.length, 0);
  return { layers: index.layers, msg: `layer text: ${Object.keys(layers).length} layers, ${(total / 1048576).toFixed(1)} MB, ${ch} nodes changed or new since the last build` };
}

module.exports = { build, diff, write, sources, timeline, hash, head, DOC_CAP };
