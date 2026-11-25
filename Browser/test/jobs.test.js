// jobs.test.js — T3 and T4 on the server: the jobs list (codes only), a job's web material written into its folder
// (links.json, INDEX.md, the saved pages, the datasheet PDFs), and the routes' rules. INVENTED jobs (T03, T07), as the
// Map's own fixtures (Map/test/make-fixture-jobs.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { createJobs, slug } = require('../lib/jobs.js');
const links = require('../src/core/links.js');
const { makePdf } = require('./make-pdf.js');

function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-jobs-'));
  fs.mkdirSync(path.join(d, 'T07_Kitalalt Ugyfel'), { recursive: true });
  fs.mkdirSync(path.join(d, '_elozmenyek', 'T03'), { recursive: true });
  fs.mkdirSync(path.join(d, 'NEM_MUNKA'));
  fs.writeFileSync(path.join(d, '_elozmenyek', 'helyek.json'), JSON.stringify({ jobs: [
    { code: 'T07', status: 'folyamatban', from: '2026-11-01', to: '2026-11-20', label: 'KITALÁLT címke', lat: 47.5, lon: 19.0 },
    { code: 'T03', status: 'befejezett', from: '2025-01-01', to: '2025-02-01', label: 'Másik címke', lat: 47.4, lon: 19.1 }] }));
  return d;
}
const guard = { get: async url => (url.includes('bad') ? { status: 404, body: Buffer.from('') } : { status: 200, url, type: 'application/pdf', body: makePdf([['KITALALT adatlap']]) }) };

test('jobs: the list carries codes, status and period only, and the read is logged', () => {
  const d = fixture();
  const r = createJobs({ dir: d }).list();
  assert.equal(r.ok, true);
  assert.deepEqual(r.jobs, [{ code: 'T07', status: 'folyamatban', from: '2026-11-01', to: '2026-11-20' }, { code: 'T03', status: 'befejezett', from: '2025-01-01', to: '2025-02-01' }]);
  assert.doesNotMatch(JSON.stringify(r), /Ugyfel|címke|47\./, 'no folder name, label or coordinate');
  const log = fs.readFileSync(path.join(d, '_elozmenyek', 'helyek-log.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(log[0].via, 'bongeszo'); assert.equal(log[0].n, 2);
  assert.equal(createJobs({ dir: path.join(d, 'nincs') }).list().code, 'no-jobs');
});
test('jobs: the folder of a code; nothing outside the jobs', () => {
  const d = fixture();
  const j = createJobs({ dir: d });
  assert.equal(j.folderOf('T07'), path.join(d, 'T07_Kitalalt Ugyfel'));
  assert.equal(j.folderOf('T03'), path.join(d, '_elozmenyek', 'T03'));
  for (const bad of ['T99', '../T07', 'T07/../..', 't07', 'NEM']) assert.equal(j.folderOf(bad), null, bad);
});
test('jobs: export writes links.json (v1), INDEX.md, the saved pages and the datasheet PDFs into <job>\\web', async () => {
  const d = fixture();
  const j = createJobs({ dir: d, guard });
  const r = await j.exportTo('T07', {
    bookmarks: [{ url: 'https://tme.eu/hu/', title: 'TME', tags: ['beszerzés'], note: 'kábel', added: 5 }, { url: 'javascript:alert(1)', title: 'x' }],
    reading: [{ url: 'https://pelda.hu/cikk', title: 'Kábelméretezés', text: '# Feszültségesés\nA határ 4 %.', saved: Date.UTC(2026, 10, 23) },
      { url: 'https://gyarto.example/t01.pdf', title: 'T-01 adatlap', kind: 'pdf', part: 'VRG-0001', text: '## 1. oldal\nKITALALT' },
      { url: 'https://gyarto.example/bad.pdf', title: 'Hibás', kind: 'pdf' }],
    pdfs: true });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.where, 'T07\\web', 'the reply names the code, never the folder');
  assert.equal(r.pdf.saved, 1); assert.deepEqual(r.pdf.failed, ['Hibás']);
  const web = path.join(d, 'T07_Kitalalt Ugyfel', 'web');
  const l = links.read(fs.readFileSync(path.join(web, 'links.json'), 'utf8'));
  assert.deepEqual(l.bookmarks.map(b => b.url), ['https://tme.eu/hu/']);
  assert.equal(l.ext.meta['https://tme.eu/hu/'].job, 'T07');
  assert.equal(l.ext.reading.length, 3);
  const md = fs.readdirSync(path.join(web, 'olvaso'));
  assert.equal(md.length, 2);
  assert.match(fs.readFileSync(path.join(web, 'olvaso', slug('Kábelméretezés', 'https://pelda.hu/cikk') + '.md'), 'utf8'), /^# Kábelméretezés\n\nForrás: https:\/\/pelda\.hu\/cikk {2}\nMentve: 2026-11-23/);
  assert.equal(fs.readdirSync(path.join(web, 'adatlapok')).length, 1);
  const index = fs.readFileSync(path.join(web, 'INDEX.md'), 'utf8');
  assert.match(index, /^# T07 · webes anyagok/);
  assert.match(index, /\[TME\]\(https:\/\/tme\.eu\/hu\/\) · #beszerzés — kábel/);
  assert.match(index, /adatlapok\/t-01-adatlap-[0-9a-f]{6}\.pdf\) · VRG-0001/);
  assert.match(index, /nem töltődött le: Hibás/);
  assert.ok(!fs.readdirSync(web).some(f => f.endsWith('.tmp')));
  const again = await j.exportTo('T07', { bookmarks: [], reading: [] });
  assert.equal(again.ok, true, 'a second export overwrites the generated files');
  assert.equal((await j.exportTo('T99', {})).code, 'no-folder');
  assert.equal((await j.exportTo('../x', {})).code, 'bad-code');
});

test('serve: /api/jobs and the export route keep the write rules', async () => {
  const { createServer } = require('../serve.js');
  const { createDocs } = require('../lib/docs.js');
  const d = fixture();
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-repo-'));
  const { server } = createServer({ port: 18817, jobsDir: d, linksFile: '', guard: Object.assign({ check: () => ({ ok: false }) }, guard), docs: createDocs({ repo }), suggest: { get: async () => [], sources: () => [] } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const req = (method, p, headers, body) => new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, headers: Object.assign({ host: '127.0.0.1:18817' }, headers) }, rr => {
      let b = ''; rr.on('data', c => (b += c)); rr.on('end', () => res({ status: rr.statusCode, headers: rr.headers, json: b ? JSON.parse(b) : null }));
    });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
  try {
    assert.deepEqual((await req('GET', '/api/jobs', {})).json.jobs.map(j => j.code), ['T07', 'T03']);
    const body = JSON.stringify({ bookmarks: [{ url: 'https://a.hu/', title: 'A' }], reading: [] });
    assert.equal((await req('POST', '/api/jobs/T07/export', { 'content-type': 'application/json' }, body)).status, 403, 'no origin');
    assert.equal((await req('POST', '/api/jobs/T07/export', { origin: 'https://evil.example', 'content-type': 'application/json' }, body)).status, 403);
    assert.equal((await req('POST', '/api/jobs/t07/export', { origin: 'http://127.0.0.1:18817', 'content-type': 'application/json' }, body)).status, 405, 'only a job code fits the write route');
    const pre = await req('OPTIONS', '/api/jobs/T07/export', { origin: 'vrg-app://browser', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers['access-control-allow-origin'], 'vrg-app://browser', 'the Asztal app may export');
    assert.match(pre.headers['access-control-allow-headers'], /content-type/);
    const ok = await req('POST', '/api/jobs/T07/export', { origin: 'vrg-app://browser', 'content-type': 'application/json' }, body);
    assert.equal(ok.json.ok, true);
    assert.ok(fs.existsSync(path.join(d, 'T07_Kitalalt Ugyfel', 'web', 'INDEX.md')));
  } finally { server.close(); }
});
