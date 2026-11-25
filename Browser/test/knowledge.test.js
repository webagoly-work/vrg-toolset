// knowledge.test.js — Phase 3: the research note (Kutatás), the notebooks in the store, the page watches in the Asztal's feed
// registry (lib/watch.js), and serve.js's /api/watch and /api/research.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const R = require('../src/core/research.js');
const store = require('../src/core/store.js');
const { createWatch } = require('../lib/watch.js');

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('research: quotes and sources numbered once per page, the sources list closes the note', () => {
  const nb = { title: 'Túlfeszültség-védelem', question: 'Kell-e T1?', job: '', items: [
    { kind: 'quote', text: 'T1 kell, ha van villámvédelem.\nMásodik sor.', url: 'https://a.example/', title: 'Cikk [A]', at: Date.UTC(2026, 10, 20) },
    { kind: 'note', text: 'Nálunk nincs LPS.' },
    { kind: 'quote', text: 'T2 elég.', url: 'https://b.example/', title: 'Adatlap B', at: Date.UTC(2026, 10, 21) },
    { kind: 'source', url: 'https://a.example/', title: 'Cikk A újra' }] };
  const md = R.markdown(nb, { now: Date.UTC(2026, 10, 23) });
  assert.match(md, /^# Túlfeszültség-védelem\n\n\*\*Kérdés:\*\* Kell-e T1\?\n\n\*2026-11-23 · VRG Böngésző, Kutatás · 2 forrás\*/);
  assert.match(md, /> T1 kell, ha van villámvédelem\.\n> Második sor\.\n> — \[1\]/);
  assert.match(md, /> T2 elég\.\n> — \[2\]/);
  assert.match(md, /- Forrás: Cikk A újra \[1\]/, 'the same page keeps its number');
  assert.match(md, /## Források\n\n1\. \[Cikk \\\[A\\\]\]\(https:\/\/a\.example\/\) — olvasva 2026-11-20\n2\. \[Adatlap B\]\(https:\/\/b\.example\/\) — olvasva 2026-11-21/);
  assert.match(R.forClaude(nb), /^Ez a kutatási jegyzetem/);
});
test('store: notebooks keep quotes, notes and sources; only web sources; they travel in the export', () => {
  const s = store.create(mem());
  const nb = s.addNotebook({ title: 'Kábel', job: 't07' });
  assert.equal(nb.job, 'T07');
  assert.equal(s.settings().notebook, nb.id, 'the last notebook is offered first');
  assert.ok(s.addToNotebook(nb.id, { kind: 'quote', text: 'idézet', url: 'https://a.example/', title: 'A' }));
  assert.equal(s.addToNotebook(nb.id, { kind: 'source', url: 'javascript:alert(1)' }), null);
  assert.equal(s.addToNotebook(nb.id, { kind: 'quote', text: '   ' }), null);
  assert.ok(s.addToNotebook(nb.id, { kind: 'note', text: 'jegyzet' }));
  assert.ok(s.moveInNotebook(nb.id, 1, -1));
  assert.deepEqual(s.notebook(nb.id).items.map(i => i.kind), ['note', 'quote']);
  const doc = JSON.parse(JSON.stringify(s.exportAll()));
  assert.equal(doc['x-bongeszo'].research[0].title, 'Kábel');
  const t = store.create(mem());
  t.importAll(doc);
  assert.equal(t.notebooks()[0].items.length, 2);
  s.removeNotebook(nb.id);
  assert.equal(s.notebooks().length, 0);
});

function desk() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-desk-'));
  fs.writeFileSync(path.join(d, 'presets.json'), JSON.stringify({ allowHosts: ['example.org'], presets: [{ id: 'rss1', kind: 'rss', url: 'https://example.org/f.xml' }] }));
  return d;
}
test('watch: added into the Asztal registry with its host; the last result from the cache; removed with the host it brought', () => {
  const d = desk();
  const w = createWatch({ dir: d, check: u => ({ ok: /^https:\/\//.test(u) && !/127\.0\.0\.1|localhost/.test(u) }) });
  const a = w.add({ url: 'https://njt.example/jogszabaly', hu: 'Jogszabály', every: 5 });
  assert.equal(a.ok, true);
  const reg = JSON.parse(fs.readFileSync(path.join(d, 'presets.json'), 'utf8'));
  const p = reg.presets.find(x => x.kind === 'page-watch');
  assert.deepEqual([p.url, p.every, p.hu], ['https://njt.example/jogszabaly', 60, 'Jogszabály'], 'at least hourly');
  assert.deepEqual(reg.allowHosts, ['example.org', 'njt.example']);
  assert.ok(reg.presets.some(x => x.id === 'rss1'), 'the other presets are kept');
  fs.mkdirSync(path.join(d, 'cache'));
  fs.writeFileSync(path.join(d, 'cache', 'presets.json'), JSON.stringify({ [p.id]: { pre: p.id, at: 5, items: [{ hu: 'Változott: Jogszabály', detail: '+ 1 új sor' }], state: { lines: ['x'], changedAt: 5 } } }));
  const l = w.list();
  assert.deepEqual(l.watches[0].last, { at: 5, hu: 'Változott: Jogszabály', detail: '+ 1 új sor', error: '', changedAt: 5 });
  assert.equal(w.add({ url: 'http://127.0.0.1:8808/' }).ok, false, 'this PC is not watched');
  w.add({ url: 'https://example.org/oldal' });
  w.remove(p.id);
  const reg2 = JSON.parse(fs.readFileSync(path.join(d, 'presets.json'), 'utf8'));
  assert.deepEqual(reg2.allowHosts, ['example.org'], 'njt.example leaves with its watch; example.org was there before');
  assert.equal(w.remove('nincs').ok, false);
  assert.equal(createWatch({ dir: path.join(d, 'nincs') }).list().code, 'no-desk');
});

test('serve: /api/watch and /api/research keep the write rules and the places', async () => {
  const { createServer } = require('../serve.js');
  const { createDocs } = require('../lib/docs.js');
  const d = desk();
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-repo-'));
  fs.mkdirSync(path.join(repo, 'docs'));
  const jobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-jobs-'));
  fs.mkdirSync(path.join(jobsDir, 'T07_Kitalalt')); fs.mkdirSync(path.join(jobsDir, '_elozmenyek'));
  const docs = createDocs({ repo });
  const { server } = createServer({ port: 18820, repo, docs, deskDir: d, jobsDir, linksFile: '', guard: { check: u => ({ ok: /^https:/.test(u) }) }, suggest: { get: async () => [], sources: () => [] } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const req = (method, p, headers, body) => new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, headers: Object.assign({ host: '127.0.0.1:18820' }, headers) }, rr => {
      let b = ''; rr.on('data', c => (b += c)); rr.on('end', () => res({ status: rr.statusCode, json: b ? JSON.parse(b) : null }));
    });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
  const own = { origin: 'http://127.0.0.1:18820', 'content-type': 'application/json' };
  try {
    assert.equal((await req('POST', '/api/watch', { 'content-type': 'application/json' }, '{"url":"https://a.example/"}')).status, 403, 'no origin');
    assert.equal((await req('POST', '/api/watch', { origin: 'https://evil.example', 'content-type': 'application/json' }, '{"url":"https://a.example/"}')).status, 403);
    const w = await req('POST', '/api/watch', own, JSON.stringify({ url: 'https://a.example/x', hu: 'A' }));
    assert.equal(w.json.ok, true);
    assert.equal((await req('GET', '/api/watch', {})).json.watches.length, 1);
    assert.equal((await req('POST', '/api/watch', own, JSON.stringify({ remove: w.json.added }))).json.watches.length, 0);
    const md = '# Túlfeszültség\n\nT2 elég [1]\n\n## Források\n\n1. [A](https://a.example/)\n';
    const r1 = await req('POST', '/api/research', own, JSON.stringify({ title: 'Túlfeszültség-védelem', md }));
    assert.equal(r1.json.ok, true);
    assert.match(r1.json.where, /^docs\/research\/web\/\d{4}-\d{2}-\d{2}_tulfeszultseg-vedelem\.md$/);
    assert.equal(fs.readFileSync(path.join(repo, r1.json.where), 'utf8'), md);
    const r2 = await req('POST', '/api/research', own, JSON.stringify({ title: 'Túlfeszültség-védelem', md: md + 'más\n' }));
    assert.match(r2.json.where, /_tulfeszultseg-vedelem-2\.md$/, 'a different note never overwrites');
    assert.deepEqual(docs.search('tulfeszultseg', 5).map(h => h.path).sort(), [r1.json.where, r2.json.where].sort(), 'searchable at once');
    const r3 = await req('POST', '/api/research', own, JSON.stringify({ title: 'Munka jegyzet', md: '# x\n', job: 'T07' }));
    assert.match(r3.json.where, /^T07\\web\\kutatas\\.*_munka-jegyzet\.md$/, 'a job note goes to the job, the reply names the code');
    assert.equal(fs.readdirSync(path.join(jobsDir, 'T07_Kitalalt', 'web', 'kutatas')).length, 1);
    assert.equal((await req('POST', '/api/research', own, JSON.stringify({ title: 'x', md: '# x', job: 'T99' }))).json.code, 'no-folder');
    const leak = await req('POST', '/api/research', own, JSON.stringify({ title: 'Ház', md: '# Ház\n\nA T07-es háznál nincs LPS.\n' }));
    assert.equal(leak.json.code, 'job-code', 'a note naming one of the PC\'s jobs never goes into the repo');
    assert.equal(leak.json.job, 'T07');
    assert.equal((await req('POST', '/api/research', own, JSON.stringify({ title: 'Csavar', md: '# M8 T070 csavar\n' }))).json.ok, true, 'T070 is not T07');
    assert.equal((await req('POST', '/api/research', own, JSON.stringify({ title: '', md: '# x' }))).json.ok, false);
  } finally { server.close(); }
});
