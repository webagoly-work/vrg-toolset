// VRG Stack — the search index (out/stack.sqlite).
//
//   nodes   FTS5 over title · brief · body, one row per node                   (v1)
//   chunks  FTS5 over the body cut at its headings; each chunk starts with a context line written
//           by the script — "Layer › node title › heading › pillars" — so a chunk found alone
//           still says where it belongs (contextual retrieval, with no model)
//   emb     one bge-m3 vector per node, keyed by a hash of the text it was made from, so only
//           changed nodes are embedded again; vectors survive rebuilds
//   meta    schema version, build time, counts — health checks read it
// The file is built as stack.sqlite.tmp and renamed over the old one, so a failed build leaves the
// last good index in place.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const CFG = require('../config');
const { fold } = require('./common');
const EMB = require('./embed');

const FILE = path.join(CFG.out, 'stack.sqlite');
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

/* text → [{ heading, body }] at markdown headings, long sections split further */
function chunks(text, max = CFG.search.chunkChars) {
  const out = []; let head = '', buf = [];
  const flush = () => { const body = buf.join('\n').trim(); if (body) for (let i = 0; i < body.length; i += max) out.push({ heading: head, body: body.slice(i, i + max) }); buf = []; };
  for (const l of String(text || '').split(/\r?\n/)) { const h = /^#{1,4}\s+(.+)$/.exec(l); if (h) { flush(); head = h[1].trim(); } else buf.push(l); }
  flush();
  return out.slice(0, CFG.search.perNodeChunks);
}
const embedText = (n, lname) => `${lname} › ${n.title}\n${n.brief || ''}\n${String(n.text || '').slice(0, 1500)}`;

/* build the index from the full nodes (with text); returns { rows, chunks, embedQueue } */
function build(nodes, layerName) {
  const tmp = FILE + '.tmp';
  try { fs.unlinkSync(tmp); } catch {}
  const db = new DatabaseSync(tmp);
  db.exec(`
    CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
    CREATE VIRTUAL TABLE nodes USING fts5(id UNINDEXED, layer UNINDEXED, title, brief, body, tokenize = 'unicode61 remove_diacritics 2');
    CREATE VIRTUAL TABLE chunks USING fts5(id UNINDEXED, layer UNINDEXED, header, body, tokenize = 'unicode61 remove_diacritics 2');
    CREATE TABLE emb (id TEXT PRIMARY KEY, hash TEXT, vec BLOB);`);
  // keep the vectors of the old index whose text did not change
  let oldEmb = new Map();
  if (fs.existsSync(FILE)) {
    try { const o = new DatabaseSync(FILE, { readOnly: true }); for (const r of o.prepare('SELECT id, hash, vec FROM emb').all()) oldEmb.set(r.id, r); o.close(); } catch { oldEmb = new Map(); }
  }
  const insN = db.prepare('INSERT INTO nodes (id, layer, title, brief, body) VALUES (?, ?, ?, ?, ?)');
  const insC = db.prepare('INSERT INTO chunks (id, layer, header, body) VALUES (?, ?, ?, ?)');
  const insE = db.prepare('INSERT INTO emb (id, hash, vec) VALUES (?, ?, ?)');
  const queue = []; let nChunks = 0, kept = 0;
  db.exec('BEGIN');
  for (const n of nodes.values()) {
    insN.run(n.id, n.layer, fold(n.title + ' ' + n.id), fold((n.brief || '') + ' ' + (n.state || '') + ' ' + (n.kind || '')), fold(String(n.text || '').slice(0, 12000)));
    const ln = layerName(n.layer);
    const pill = (n.ent || []).join(', ');
    for (const c of chunks(n.text)) {
      insC.run(n.id, n.layer, fold(`${ln} › ${n.title}${c.heading ? ' › ' + c.heading : ''}${pill ? ' › ' + pill : ''}`), fold(c.body)); nChunks++;
    }
    const et = embedText(n, ln); const h = hash(et); const old = oldEmb.get(n.id);
    if (old && old.hash === h) { insE.run(n.id, h, old.vec); kept++; } else if (n.layer !== 'E') queue.push({ id: n.id, hash: h, text: et });
  }
  const meta = { schema: String(CFG.schema), built: new Date().toISOString(), nodes: String(nodes.size), chunks: String(nChunks) };
  for (const [k, v] of Object.entries(meta)) db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').run(k, v);
  db.exec('COMMIT'); db.close();
  require('./fsx').replace(tmp, FILE);
  return { rows: nodes.size, chunks: nChunks, embKept: kept, embedQueue: queue };
}

/* embed what changed, at most `max` nodes per build (the rest next time) */
async function embedMissing(queue, max = 2000, log = () => {}) {
  const P = EMB.provider();
  const chk = await P.check();
  if (!chk.ok) return { provider: P.name, ok: false, why: chk.why, done: 0, left: queue.length };
  const db = new DatabaseSync(FILE);
  const ins = db.prepare('INSERT OR REPLACE INTO emb (id, hash, vec) VALUES (?, ?, ?)');
  let done = 0;
  try {
    for (let i = 0; i < Math.min(queue.length, max); i += CFG.embed.batch) {
      const part = queue.slice(i, Math.min(i + CFG.embed.batch, max));
      const vecs = await P.embed(part.map(q => q.text));
      db.exec('BEGIN'); part.forEach((q, j) => ins.run(q.id, q.hash, EMB.toBlob(vecs[j]))); db.exec('COMMIT');
      done += part.length;
      if (done % 320 === 0) log(`embedded ${done}/${Math.min(queue.length, max)}`);
    }
  } finally { db.close(); }
  return { provider: P.name, ok: true, done, left: queue.length - done };
}

function open() { return new DatabaseSync(FILE, { readOnly: true }); }

function meta() {
  try { const db = open(); const m = Object.fromEntries(db.prepare('SELECT k, v FROM meta').all().map(r => [r.k, r.v])); m.emb = String(db.prepare('SELECT count(*) AS c FROM emb').get().c); db.close(); return m; }
  catch (e) { return { error: e.message }; }
}

module.exports = { build, embedMissing, open, meta, chunks, FILE };
