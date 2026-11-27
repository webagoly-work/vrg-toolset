// docs.js — "Helyi dokumentumok": the repo's own Markdown (docs/, every README, GO-*.md, BRIDGE/, the WP files) in the
// VRG Böngésző's search engine (src/core/engine.js), so a search for "feszültségesés" or "M21" finds the documents beside the
// web. Only files git would carry are walked (no Vendor/, no Planner/apps|home|data, no node_modules, no dist, no jobs), and
// only the files in the index can be opened (/api/doc?path= names an index entry, never a free path).
//   const d = createDocs({ repo }); d.build(); d.search('kábel', 10) → [{ path, title, snippet, score }]; d.doc(path) → { title, blocks }
'use strict';
const fs = require('fs');
const path = require('path');
const engine = require('../src/core/engine.js');
const reader = require('./reader.js');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'Vendor', 'dist', 'build', '.cache', 'data', 'apps', 'home', 'jobs', 'out', '.gradle', '.idea', 'files', 'fixtures', 'gallery']);
const MAX_FILE = 600 * 1024;
const MAX_FILES = 4000;

function createDocs(opts) {
  const repo = path.resolve(opts.repo);
  const ix = engine.createIndex({ fields: { title: 3, heads: 2, path: 1.5, text: 1 } });
  const files = new Map();                       // rel path → { abs, title, size, mtime }
  let built = 0;

  function walk(dir, depth, out) {
    if (depth > 8 || out.length >= MAX_FILES) return;
    let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const d of list) {
      if (d.name.startsWith('.') && d.name !== '.github') continue;
      const abs = path.join(dir, d.name);
      if (d.isDirectory()) { if (!SKIP_DIRS.has(d.name)) walk(abs, depth + 1, out); continue; }
      if (d.isFile() && /\.md$/i.test(d.name)) out.push(abs);
    }
  }

  function build() {
    ix.clear(); files.clear();
    const list = [];
    walk(repo, 0, list);
    for (const abs of list) {
      let st, src;
      try { st = fs.statSync(abs); if (st.size > MAX_FILE) continue; src = fs.readFileSync(abs, 'utf8'); } catch (e) { continue; }
      const rel = path.relative(repo, abs).split(path.sep).join('/');
      const md = reader.markdown(src, path.basename(abs, '.md'));
      const heads = md.blocks.filter(b => b.t[0] === 'h').map(b => b.text).join(' · ');
      files.set(rel, { abs, title: md.title, size: st.size, mtime: st.mtimeMs });
      ix.add({ id: rel, title: md.title, heads, path: rel.replace(/[/_.-]/g, ' '), text: md.text.slice(0, 120000), boost: /(^|\/)(README|GO-[A-Z]+)\.md$/.test(rel) ? 1.3 : 1 });
    }
    built = Date.now();
    return files.size;
  }

  function search(q, limit) {
    if (!built) build();
    return ix.search(q, { limit: limit || 10 }).map(h => {
      const f = files.get(h.id);
      return { path: h.id, title: f.title, score: Math.round(h.score * 100) / 100, snippet: engine.snippet(h.doc.text, q, 180) };
    });
  }

  function doc(rel) {
    if (!built) build();
    const f = typeof rel === 'string' && files.get(rel);
    if (!f) return null;
    let src;
    try { src = fs.readFileSync(f.abs, 'utf8'); } catch (e) { return null; }
    const md = reader.markdown(src, path.basename(rel, '.md'));
    return { path: rel, title: md.title, blocks: md.blocks, words: md.words, mtime: new Date(f.mtime).toISOString() };
  }

  return { build, search, doc, size: () => files.size, built: () => built };
}

module.exports = { createDocs };
