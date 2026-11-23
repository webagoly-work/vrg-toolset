// jobs.js — the work context (T3): which jobs exist, and a job's web material written into its own folder.
// The jobs root is H:\VRG\Full\jobs next to the repo (as Map/serve.js and Weather find it) or VRG_JOBS_DIR. Client data
// lives there: this module answers JOB CODES ONLY (code, status, dates), never a folder name, label or address, and
// writes only into an existing job's folder, under web\.
//   const j = createJobs({ dir?, guard? }); j.list() → { ok, jobs: [{ code, status, from, to }] }
//   await j.exportTo(code, { bookmarks, reading, pdfs }) → { ok, where: '<CODE>\\web', files, pdf: { saved, failed } }
// Where a job's folder is: the one jobs\<CODE>_* folder (a Workflow Kit job), else jobs\_elozmenyek\<CODE> (a past job).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const links = require('../src/core/links');

const CODE_RE = /^[A-Z]{1,3}\d{1,3}$/;            // the toolset's job code (Map/tools/build-jobs.js, desktop.mapJob)
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };

function findJobsDir() {
  if (process.env.VRG_JOBS_DIR) return path.resolve(process.env.VRG_JOBS_DIR);
  const repo = path.resolve(__dirname, '..', '..');
  for (let d = repo; path.dirname(d) !== d; d = path.dirname(d)) {
    const j = path.join(path.dirname(d), 'jobs');
    if (isDir(path.join(j, '_elozmenyek'))) return j;
  }
  return null;
}

const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function slug(title, url) {
  const base = fold(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'oldal';
  return base + '-' + crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 6);
}
const oneLine = s => String(s == null ? '' : s).replace(/[\r\n|]+/g, ' ').trim();

function createJobs(o) {
  const opt = o || {};
  const root = () => (opt.dir !== undefined ? opt.dir : findJobsDir());

  function list() {
    const dir = root();
    if (!dir || !isDir(dir)) return { ok: false, code: 'no-jobs', hu: 'Ezen a gépen nincs munkamappa (H:\\VRG\\Full\\jobs).' };
    const by = new Map();
    const put = (code, x) => { if (CODE_RE.test(code)) by.set(code, Object.assign({ code, status: '', from: null, to: null }, by.get(code) || {}, x)); };
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) {}
    for (const d of ents) { const m = d.isDirectory() && /^([A-Z]{1,3}\d{1,3})_/.exec(d.name); if (m) put(m[1], { status: 'folyamatban' }); }
    try { for (const d of fs.readdirSync(path.join(dir, '_elozmenyek'), { withFileTypes: true })) if (d.isDirectory() && CODE_RE.test(d.name)) put(d.name, by.has(d.name) ? {} : { status: 'előzmény' }); } catch (e) {}
    // the Map's job layer, when built: status and period per code (its access rule: one log line per read)
    const hf = path.join(dir, '_elozmenyek', 'helyek.json');
    if (fs.existsSync(hf)) {
      let n = 0;
      try {
        for (const j of JSON.parse(fs.readFileSync(hf, 'utf8')).jobs || []) { if (j && CODE_RE.test(j.code)) { put(j.code, { status: String(j.status || ''), from: j.from || null, to: j.to || null }); n++; } }
      } catch (e) { /* a broken file: folders only */ }
      try { fs.appendFileSync(path.join(dir, '_elozmenyek', 'helyek-log.jsonl'), JSON.stringify({ t: new Date().toISOString(), via: 'bongeszo', ok: true, n }) + '\n'); } catch (e) {}
    }
    const order = { folyamatban: 0, 'előzmény': 2 };
    const jobs = [...by.values()].map(j => ({ code: j.code, status: j.status, from: j.from, to: j.to }))
      .sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1) || String(b.to || '').localeCompare(String(a.to || '')) || a.code.localeCompare(b.code));
    return { ok: true, jobs };
  }

  function folderOf(code) {
    const dir = root();
    if (!dir || !CODE_RE.test(code)) return null;
    let kit = [];
    try { kit = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith(code + '_')).map(d => d.name).sort(); } catch (e) {}
    if (kit.length) return path.join(dir, kit[0]);
    const past = path.join(dir, '_elozmenyek', code);
    return isDir(past) ? past : null;
  }

  async function exportTo(code, payload) {
    if (!CODE_RE.test(String(code))) return { ok: false, code: 'bad-code', hu: 'Ismeretlen munkaszám.' };
    const home = folderOf(code);
    if (!home) return { ok: false, code: 'no-folder', hu: 'A ' + code + ' munkának nincs mappája a munkák között.' };
    const p = payload || {};
    const bms = (Array.isArray(p.bookmarks) ? p.bookmarks : []).slice(0, 500).filter(b => b && links.isWebUrl(b.url));
    const rds = (Array.isArray(p.reading) ? p.reading : []).slice(0, 300).filter(r => r && links.isWebUrl(r.url));
    const web = path.join(home, 'web');
    fs.mkdirSync(path.join(web, 'olvaso'), { recursive: true });
    const write = (f, data) => { const t = f + '.tmp'; fs.writeFileSync(t, data); fs.renameSync(t, f); };
    let files = 0;
    const meta = {};
    for (const b of bms) meta[b.url] = { tags: (b.tags || []).slice(0, 12), job: code, note: String(b.note || '').slice(0, 2000) };
    const reading = rds.map(r => ({ url: r.url, title: String(r.title || '').slice(0, 300), kind: r.kind === 'pdf' ? 'pdf' : '', part: String(r.part || '').slice(0, 12),
      saved: +r.saved || 0, excerpt: String(r.excerpt || '').slice(0, 400), text: '' }));
    write(path.join(web, 'links.json'), links.write({ bookmarks: bms.map(b => ({ url: b.url, title: String(b.title || ''), at: +b.added || 0 })), history: [] },
      { exported: new Date().toISOString(), ext: { meta, reading } }));
    files++;
    const saved = [];
    for (const r of rds) {
      if (typeof r.text !== 'string' || !r.text.trim()) continue;
      const name = slug(r.title, r.url) + '.md';
      const md = '# ' + oneLine(r.title || r.url) + '\n\n' + 'Forrás: ' + r.url + '  \n' + (r.saved ? 'Mentve: ' + new Date(+r.saved).toISOString().slice(0, 10) + '  \n' : '') +
        (r.part ? 'Cikk: ' + oneLine(r.part) + '  \n' : '') + '\n' + String(r.text).slice(0, 200000) + '\n';
      write(path.join(web, 'olvaso', name), md); files++;
      saved.push({ r, name });
    }
    const pdf = { saved: 0, failed: [] };
    const pdfRows = [];
    if (p.pdfs && opt.guard) {
      fs.mkdirSync(path.join(web, 'adatlapok'), { recursive: true });
      for (const r of rds.filter(x => x.kind === 'pdf').slice(0, 60)) {
        try {
          const g = await opt.guard.get(r.url, { maxBytes: 25 * 1024 * 1024, timeout: 30000, accept: 'application/pdf,*/*;q=0.5' });
          if (g.status >= 400 || g.body.slice(0, 5).toString('latin1') !== '%PDF-') throw new Error('nem PDF (' + g.status + ')');
          const name = slug(r.title, r.url) + '.pdf';
          write(path.join(web, 'adatlapok', name), g.body); files++; pdf.saved++;
          pdfRows.push({ r, name });
        } catch (e) { pdf.failed.push(oneLine(r.title || r.url).slice(0, 80)); }
      }
    }
    const day = new Date().toISOString().slice(0, 10);
    const lines = ['# ' + code + ' · webes anyagok', '', '*A VRG Böngésző írta ' + day + '-én (Munkák → Exportálás). A `links.json` vrg.web-links v1: a VRG Böngésző betölti.*', ''];
    lines.push('## Linkek (' + bms.length + ')', '', ...bms.map(b => '- [' + oneLine(b.title || b.url) + '](' + b.url + ')' + ((b.tags || []).length ? ' · #' + b.tags.join(' #') : '') + (b.note ? ' — ' + oneLine(b.note) : '')), '');
    lines.push('## Mentett oldalak (' + saved.length + ')', '', ...saved.map(x => '- [' + oneLine(x.r.title || x.r.url) + '](olvaso/' + x.name + ') · ' + x.r.url), '');
    if (pdfRows.length || pdf.failed.length) lines.push('## Adatlapok (' + pdfRows.length + ')', '', ...pdfRows.map(x => '- [' + oneLine(x.r.title || x.r.url) + '](adatlapok/' + x.name + ')' + (x.r.part ? ' · ' + x.r.part : '') + ' · ' + x.r.url), ...pdf.failed.map(t => '- nem töltődött le: ' + t), '');
    write(path.join(web, 'INDEX.md'), lines.join('\n') + '\n'); files++;
    return { ok: true, where: code + '\\web', files, pdf, hu: 'Kiírva a ' + code + ' munka mappájába (web): ' + files + ' fájl' + (pdf.saved ? ', ' + pdf.saved + ' adatlap PDF' : '') + (pdf.failed.length ? '; ' + pdf.failed.length + ' PDF nem töltődött le' : '') + '.' };
  }

  return { list, folderOf, exportTo, root };
}

module.exports = { createJobs, findJobsDir, CODE_RE, slug };
