// VRG Stack — M · Munkák (client jobs), S15 of research/STRINGS-PLAN.md (§5; by STK-Q5 the first of RULES §6a's
// layers after Futás): every job in the register and every Workflow Kit job folder, with its status, period and total,
// and which of our tools it used. The money path on a string: the Planner's string reaches the jobs that used it.
//
//   read(jobsDir) → [job]          outside Git (H:\VRG\Full\jobs, client data): the register and totals through the
//                                  Map's own readers (Map/tools/build-jobs.js), the Kit's job folders, the Planner's
//                                  project folders; then which tools each job's files show (TOOLS)
//   layer(jobs) → { nodes, edges } pure
//     M:job.<CODE>   kind 'job' (in the register) or 'kit job' (a Workflow Kit folder only); state = the register's
//                    status; t = the end of its period; own job:<CODE>, so any tracked text naming the code links here
//                    (lib/join.js knows the codes)
//     M → M          'related' (a register note naming another code: "BK2 előzménye")
//   The title is the code, the status and the tools ("BK2 · befejezett · Planner + Workflow Kit"): the tools' pillars
//   take the job in by their words, and the text names the Planner's folder, so the join links it to the code.
//
// What never goes in (CLAUDE.md, GO-TNT: "job codes only in tracked files"): a folder label, a register note's words,
// an address, a client name, a file name. Only codes, statuses, dates, totals, counts and tool names. out/ stays
// git-ignored all the same, and a job's total is money, so the phone bundle shows only its code (lib/connectome.js).
'use strict';

const fs = require('fs');
const path = require('path');

const CODE = /^[A-Z]{1,3}\d{1,3}$/;
const CODE_IN = /\b([A-Z]{1,3}\d{1,3})\b/g;

// a tool's footprint in a job folder: its own output files (names as the tool writes them)
const TOOLS = [
  { id: 'planner', name: 'Planner', path: 'Planner/projects/varler-planner',
    files: [/_aramkorok\.json$/i, /\.vrg-elo-presets\.json$/i, /^vrg-cabinet\.json$/i, /^igenylista-.*\.json$/i, /^feltoltes-.*\.json$/i, /^portalgraph-.*\.json$/i, /^fal_nezet\.json$/i, /^terv_A4(_grey)?\.png$/i] },
  { id: 'kit', name: 'Workflow Kit', path: 'Varler_Workflow_Kit',
    files: [/^offer\.json$/i, /^decisions\.json$/i, /^answers_r\d+\.json$/i, /^WORKLOG_.*\.md$/i, /^PIACI_OSSZEVETES\.md$/i] },
];

function walk(dir, depth, fn) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.isDirectory()) { if (depth > 0 && !/^(node_modules|\.git)$/.test(e.name)) walk(path.join(dir, e.name), depth - 1, fn); }
    else fn(e.name, path.join(dir, e.name));
  }
}
const toolsIn = (names) => TOOLS.filter(t => names.some(n => t.files.some(rx => rx.test(n)))).map(t => t.id);

function read(jobsDir, { mapJobs = null } = {}) {
  let M = mapJobs;
  if (!M) { try { M = require(path.join(__dirname, '..', '..', 'Map', 'tools', 'build-jobs.js')); } catch { M = null; } }
  const hist = path.join(jobsDir, '_elozmenyek');
  const reg = M ? M.readRegister(path.join(hist, 'REGISZTER.md')) : {};
  const totals = M ? M.readTotals(path.join(hist, 'osszegek.csv')) : {};
  const kit = M ? M.readKitJobs(jobsDir) : {};
  const jobs = new Map();
  const get = code => jobs.get(code) || jobs.set(code, { code, status: '', from: null, to: null, total: null, totalDate: null, tools: new Set(), related: new Set(), kinds: new Set(), files: 0 }).get(code);

  for (const [code, r] of Object.entries(reg)) {
    const j = get(code); j.kinds.add('register'); j.status = r.status || ''; j.from = r.from; j.to = r.to;
    const t = totals[r.folder]; if (t) { j.total = t.total; j.totalDate = t.date; }
    for (const m of String(r.note || '').matchAll(CODE_IN)) if (m[1] !== code && reg[m[1]]) j.related.add(m[1]);   // codes only, never the words
    for (const base of [path.join(jobsDir, '_tnt-tukor', r.folder || '\u0000'), path.join(jobsDir, r.folder || '\u0000')]) {
      const names = []; walk(base, 4, n => names.push(n));
      if (names.length) { j.files += names.length; for (const t of toolsIn(names)) j.tools.add(t); }
    }
  }
  for (const [code, k] of Object.entries(kit)) {
    const j = get(code); j.kinds.add('kit'); j.tools.add('kit');
    if (k.from && (!j.from || k.from < j.from)) j.from = k.from;
    if (k.to && (!j.to || k.to > j.to)) j.to = k.to;
    for (const f of k.folders || []) { const names = []; walk(path.join(jobsDir, f), 4, n => names.push(n)); j.files += names.length; for (const t of toolsIn(names)) j.tools.add(t); }
  }
  // the Planner's project folders (jobs\Planner_projektek_<date>\): a file that starts with a code belongs to that job
  let top = []; try { top = fs.readdirSync(jobsDir, { withFileTypes: true }).filter(d => d.isDirectory() && /^Planner_projektek/i.test(d.name)).map(d => d.name); } catch { top = []; }
  for (const d of top) walk(path.join(jobsDir, d), 3, n => { const m = /^([A-Z]{1,3}\d{1,3})[_\-. ]/.exec(n); if (m && jobs.has(m[1])) get(m[1]).tools.add('planner'); });

  return [...jobs.values()].filter(j => CODE.test(j.code)).sort((a, b) => (a.code < b.code ? -1 : 1))
    .map(j => ({ ...j, tools: [...j.tools].sort(), related: [...j.related].sort(), kinds: [...j.kinds].sort() }));
}

const ft = n => n == null ? '' : Math.round(n).toLocaleString('hu-HU').replace(/\s/g, ' ') + ' Ft';

function layer(jobs) {
  const nodes = [], edges = [], has = new Set(jobs.map(j => j.code));
  for (const j of jobs) {
    const tools = TOOLS.filter(t => j.tools.includes(t.id));   // in TOOLS' order: Planner, then the Kit
    const id = 'M:job.' + j.code;
    nodes.push({ id, layer: 'M', kind: j.kinds.includes('register') ? 'job' : 'kit job',
      title: [j.code, j.status, tools.map(t => t.name).join(' + ')].filter(Boolean).join(' · '),
      brief: [j.from || j.to ? `${j.from || '?'} … ${j.to || '?'}` : '', j.total != null ? ft(j.total) + (j.totalDate ? ` (${j.totalDate})` : '') : '', j.files ? j.files + (j.files === 1 ? ' file' : ' files') : '',
        j.related.length ? 'related ' + j.related.join(', ') : ''].filter(Boolean).join(' · '),
      state: j.status || (j.kinds.includes('kit') ? 'kit' : ''), t: j.to || j.from || '', tier: '', lane: j.status || 'kit', own: ['job:' + j.code],
      text: [j.code, ...tools.map(t => t.path), ...j.related].join('\n'),
      extra: { code: j.code, status: j.status, from: j.from, to: j.to, total: j.total, totalDate: j.totalDate, tools: j.tools, related: j.related, kinds: j.kinds, files: j.files } });
    for (const r of j.related) if (has.has(r) && j.code < r) edges.push({ a: id, b: 'M:job.' + r, rel: 'related' });
  }
  return { nodes, edges };
}

// a job the register calls running whose newest file is older than `days`: running on paper, quiet in fact (DRIFT §15)
const RUNNING = /^(folyamatban|fut|running|aktív|aktiv)/i;
function quiet(nodes, { today = new Date().toISOString().slice(0, 10), days = 30 } = {}) {
  const ago = d => d ? Math.round((Date.parse(today) - Date.parse(d)) / 864e5) : null;
  return nodes.filter(n => n.layer === 'M' && RUNNING.test(n.state || '') && ago(n.t) != null && ago(n.t) >= days)
    .map(n => ({ n, days: ago(n.t) })).sort((a, b) => b.days - a.days);
}

module.exports = { read, layer, quiet, TOOLS, CODE };
