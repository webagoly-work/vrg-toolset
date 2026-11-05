// innersearch.js — "Belső keresés" (WP-20): the VRG Stack (stack.js q) and the code index (tools/vrg-ctx.js q) in one answer.
//   const is = createInnerSearch({ execFile, node, full, repo, issue, statusFile });
//   is.inner({ q, layers, budget }) → { stack:[hit], code:[hit], codeErr?, updated? }     is.node(id) → { text }     is.openHit(i) → { handle, name, line }
// The stack dir comes from {full}\notes\stack, never from the page. The query is always ONE argv item (no shell); `index` is never run here.
// Electron stays out: execFile and the handle issuer are passed in, so node --test can load this file.
'use strict';
const path = require('path'), fs = require('fs');

const Q_MAX = 300;
const LAYERS_RE = /^[FIQLARCGE]+$/;
const NO_INDEX = { ok: false, err: 'no-index', hu: 'Nincs kódindex. Futtasd: node tools/vrg-ctx.js index' };
const bad = hu => ({ ok: false, err: 'bad-request', hu });

// control characters out, leading dashes out (so a query can never read as an option of stack.js / vrg-ctx.js), ≤ 300 chars
function cleanQuery(q) {
  return String(q == null ? '' : q).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^-+/, '').trim().slice(0, Q_MAX);
}
// "FIQ" or "F,I,Q" → 'F,I,Q' (stack.js wants a comma list); '' for none; null when it is not made of the layer letters
function cleanLayers(layers) {
  if (layers == null || layers === '') return '';
  const s = String(layers).replace(/[\s,]/g, '');
  if (!LAYERS_RE.test(s)) return null;
  return [...new Set(s.split(''))].join(',');
}
const clampInt = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);

function stackArgs(stackJs, q, { layers, budget, n } = {}) {
  const a = [stackJs, 'q', q, '-n', String(clampInt(n, 1, 50, 8)), '--budget', String(clampInt(budget, 100, 4000, 900)), '--json'];
  if (layers) a.push('--layer', layers);
  return a;
}
function codeArgs(ctxJs, q, { n } = {}) {
  return [ctxJs, 'q', q, '-n', String(clampInt(n, 1, 50, 8)), '--json'];
}

// stack.js q --json → [{ id, layer, kind, title, brief, state, t, vertical:[{ id, rel, title }] }]
function parseStack(out) {
  let j; try { j = JSON.parse(out); } catch (e) { return null; }
  if (!Array.isArray(j)) return null;
  const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  return j.filter(h => h && typeof h.id === 'string').slice(0, 50).map(h => ({
    id: s(h.id, 160), layer: s(h.layer, 2), kind: s(h.kind, 40), title: s(h.title, 300), brief: s(h.brief, 400), state: s(h.state, 80), t: s(h.t, 40),
    vertical: (Array.isArray(h.vertical) ? h.vertical : []).slice(0, 12).map(v => ({ id: s(v && v.id, 160), rel: s(v && v.rel, 40), title: s(v && v.title, 200) })),
  }));
}
// vrg-ctx.js q --json → [{ path, line, title, snippet }]
function parseCode(out) {
  let j; try { j = JSON.parse(out); } catch (e) { return null; }
  if (!Array.isArray(j)) return null;
  return j.filter(h => h && typeof h.path === 'string' && Number.isInteger(h.line)).slice(0, 200).map(h => ({
    path: h.path.slice(0, 400), line: h.line, title: typeof h.title === 'string' ? h.title.slice(0, 200) : '', snippet: typeof h.snippet === 'string' ? h.snippet.slice(0, 600) : '',
  }));
}

// "Generated 2026-11-04 05:43 by build.js" in out/STATUS.md → '2026-11-04 05:43' ('' when unknown)
function buildTime(text) {
  const m = /Generated\s+(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?)/.exec(String(text || ''));
  return m ? m[1] : '';
}

// a repo-relative path from the code index → an absolute path inside the repo, or null
function repoFile(repo, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel) || rel.split(/[\\/]/).includes('..')) return null;
  const abs = path.resolve(repo, rel);
  const base = path.resolve(repo).toLowerCase().replace(/[\\/]+$/, '') + path.sep;
  return abs.toLowerCase().startsWith(base) ? abs : null;
}

function createInnerSearch({ execFile, node = 'node', full, repo, issue = () => null, statusFile = '' }) {
  const stackDir = path.join(full, 'notes', 'stack');
  const stackJs = path.join(stackDir, 'stack.js');
  const ctxJs = path.join(repo, 'tools', 'vrg-ctx.js');
  let lastCode = [];

  // execFile with an argument array, never a shell string
  const run = (args, cwd, timeout) => new Promise(res => {
    try { execFile(node, args, { cwd, timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => res({ err, stdout: String(stdout || ''), stderr: String(stderr || '') })); }
    catch (e) { res({ err: e, stdout: '', stderr: '' }); }
  });

  async function stack(q, opt = {}) {
    const query = cleanQuery(q), layers = cleanLayers(opt.layers);
    if (!query) return bad('Üres keresés.');
    if (layers === null) return bad('Érvénytelen réteg.');
    const r = await run(stackArgs(stackJs, query, { ...opt, layers }), stackDir, 15000);
    if (r.err) return { ok: false, err: 'failed', hu: 'A Rétegverem keresés nem sikerült.' };
    const hits = parseStack(r.stdout);
    return hits ? { ok: true, hits } : { ok: false, err: 'failed', hu: 'A Rétegverem válasza nem olvasható.' };
  }

  async function code(q, opt = {}) {
    const query = cleanQuery(q);
    if (!query) return bad('Üres keresés.');
    const r = await run(codeArgs(ctxJs, query, opt), repo, 15000);
    if (r.err) return /no index/i.test(r.stderr + r.stdout) ? { ...NO_INDEX } : { ok: false, err: 'failed', hu: 'A kódkeresés nem sikerült.' };
    const hits = parseCode(r.stdout);
    return hits ? { ok: true, hits } : { ok: false, err: 'failed', hu: 'A kódkeresés válasza nem olvasható.' };
  }

  async function inner({ q, layers, budget } = {}) {
    const query = cleanQuery(q), l = cleanLayers(layers);
    if (!query) return bad('Üres keresés.');
    if (l === null) return bad('Érvénytelen réteg.');
    const [s, c] = await Promise.all([stack(query, { layers: l, budget }), code(query, {})]);
    lastCode = c.ok ? c.hits : [];
    const out = { stack: s.ok ? s.hits : [], code: lastCode, updated: '' };
    if (!s.ok) out.stackErr = s.err;
    if (!c.ok) { out.codeErr = c.err; out.codeHu = c.hu; }
    try { if (statusFile) out.updated = buildTime(fs.readFileSync(statusFile, 'utf8')); } catch (e) {}
    return out;
  }

  // stack.js node <id> → the text card (WP-21 adds JSON)
  async function nodeCard(id) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9:_./ -]{1,160}$/.test(id) || id.startsWith('-')) return bad('Érvénytelen azonosító.');
    const r = await run([stackJs, 'node', id], stackDir, 15000);
    if (r.err) return { ok: false, err: 'not-found', hu: 'Nincs ilyen elem.' };
    return { ok: true, text: r.stdout.slice(0, 20000) };
  }

  // code hit i of the last reply → a handle for the viewer; main maps the repo-relative path, the page only names the index
  function openHit(i) {
    const h = Number.isInteger(i) ? lastCode[i] : null;
    if (!h) return { ok: false, err: 'not-found', hu: 'Nincs ilyen találat.' };
    const abs = repoFile(repo, h.path);
    const handle = abs && issue(abs);
    if (!handle) return { ok: false, err: 'not-found', hu: 'A fájl nem nyitható meg.' };
    return { ok: true, handle, name: path.basename(abs), line: h.line };
  }

  return { stack, code, inner, node: nodeCard, openHit };
}

module.exports = { createInnerSearch, cleanQuery, cleanLayers, stackArgs, codeArgs, parseStack, parseCode, buildTime, repoFile, Q_MAX, NO_INDEX };
