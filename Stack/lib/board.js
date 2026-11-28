// VRG Stack — Füzértábla, the String Board (S4 of research/STRINGS-PLAN.md §2): the Thread Board as the E layer's page.
// Every thread is a pillar; the page takes nothing by hand except what only the Founder knows.
//
//   out/board-data.js   window.BOARD = { build, schema, generated, scale, classes, layers, now, waiting, areas, other, dupes, counts }
//
// Kept by hand (read here, never written):
//   notes/devlog/threads.js   per thread: name n, note, read list, go, the curated not-yet items t, the built list d, the
//                              beta list b, its DevLog lines; the board-level NOW and WAITING notes
//   Stack/entities.json       per pillar: area, and the hand status of a pillar with no F row (STK-Q20, narrow A)
// Computed from the built stack:
//   the string of the thread's pillar (lib/strings.js): reach mask, class, pulse; the status (F tier, else the hand status)
//   and its drift against the string (lib/todo.js drift); the DevLog lines' states and quiet days (lines.js + sessions);
//   the built items (F rows in tier 1–2 on the string, beside the hand list); the open work as T nodes, "looks done" ones
//   with their evidence (S3).
// No field kept twice (§2.3): where threads.js still holds an area or a status that entities.json (or an F row) now owns,
// the build lists it in `dupes` and HEALTH, and the board shows the owner's value.
//
//   write({ graph }) → { msg, data }        build(graph, threads, lines, entities?) → data (pure, for the tests)
//   exportPublic({ map }) → { file, n }      out/board-public.html: one self-contained file, job codes swapped by
//                                            tools/anonymise.map.json, then checked by tools/anonymise.js --check
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const C = require('./common');
const X = require('./fsx');
const S = require('./strings');
const TODO = require('./todo');

const SCALE0 = { op: ['Operational', 5, 'in use or delivered'], high: ['High dev', 4, 'built, in BETA or awaiting sign-off'], mid: ['Mid dev', 3, 'partly built'],
  low: ['Low dev', 2, 'first pieces or a scaffold'], out: ['Outlined', 1, 'a written plan or pack, nothing built'], idea: ['Idea only', 0, 'mentioned or noted only'] };
const CLASSES = { program: ['Teljes program', 'Program'], build: ['Fejlesztés alatt', 'In build'], quiet: ['Kész, csendes', 'Built, quiet'],
  planned: ['Tervezett', 'Planned'], spark: ['Szikra', 'Spark'], orphan: ['Árva', 'Orphan'], loose: ['Laza', 'Loose'] };
const LINE_WORD = { active: ['●', 'Active'], waiting: ['◐', 'Waiting'], recurring: ['↻', 'Recurring'], parked: ['◌', 'Parked'], personal: ['◇', 'Personal'],
  ended: ['◼', 'Ended'], absorbed: ['⤳', 'Absorbed'], overruled: ['✕', 'Overruled'] };
const TIER_WORD = { 1: 'op', 2: 'high', 3: 'mid', 4: 'out', 5: 'idea' };
const item = x => { const it = TODO.item(x); return it && it.label ? it : null; };
const day = t => String(t || '').slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

function build(graph, threads, lines, { today = new Date().toISOString().slice(0, 10), stringOpts = CFG.strings || {} } = {}) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const edges = (graph.edges || []).map(e => Array.isArray(e) ? { a: e[0], b: e[1], rel: e[2], v: e[3] } : e);
  const ix = S.prepare(graph.nodes, edges);
  const pillarOf = new Map((graph.entities || []).filter(e => e.thread).map(e => [e.thread, e]));
  const drift = new Map(TODO.drift({ ...graph, edges }, S, stringOpts).map(c => [c.pillar, c]));
  const LINES = new Map(((lines && lines.LINES) || []).map(l => [l.id, l]));
  // a line's last move: its newest session (on-line), else its newest milestone
  const lastOf = new Map();
  for (const e of edges) if (e.rel === 'on-line') { const s = byId.get(e.a), l = e.b.slice(2); if (s && s.t && (!lastOf.has(l) || s.t > lastOf.get(l))) lastOf.set(l, day(s.t)); }
  const T = graph.nodes.filter(n => n.layer === 'T');
  const todoOf = th => T.filter(n => (n.from || []).includes('thread ' + th));
  const dupes = [];
  const used = new Set();
  const lineState = id => {
    const l = LINES.get(id), n = byId.get('L:' + id); used.add(id);
    if (!l && !n) return { id, missing: true };
    const ms = (l && l.milestones) || [], lastMs = ms.length ? '2026-' + ms[ms.length - 1][0] : '';
    const last = [lastOf.get(id) || '', lastMs].sort().pop() || '';
    const st = (l && l.status) || (n && n.state) || '';
    return { id, name: (l && l.name) || (n && n.title) || id, status: st, icon: (LINE_WORD[st] || ['·'])[0], word: (LINE_WORD[st] || ['', st])[1],
      last, quiet: last ? daysBetween(last, today) : null, next: (l && l.nextStep) || '', remaining: (l && l.remaining) || [], brief: (l && l.brief) || '' };
  };
  const areas = [], areaIx = new Map();
  for (const a of (threads && threads.AREAS) || []) for (const r of a.rows || []) {
    const p = pillarOf.get(r.id);
    const area = (p && p.area) || a.area || a.name || '—';
    if (p && p.area && (a.area || a.name) && p.area !== (a.area || a.name)) dupes.push({ thread: r.id, field: 'area', kept: 'entities.json', also: `threads.js "${a.area || a.name}"`, value: p.area });
    const s = p ? S.string(ix, 'E:' + p.id, stringOpts) : null;
    const fRows = s ? s.members.map(m => byId.get(m.id)).filter(n => n && n.layer === 'F' && +n.tier >= 1) : [];
    const best = fRows.length ? fRows.reduce((x, y) => (+x.tier <= +y.tier ? x : y)) : null;
    const status = best ? TIER_WORD[+best.tier] : (p && p.status) || '';
    const statusFrom = best ? `F tier ${best.tier}: ${best.title}` : p && p.status ? 'entities.json' : '';
    if (r.s && best) dupes.push({ thread: r.id, field: 'status', kept: `F tier ${best.tier}`, also: `threads.js s "${r.s}"`, value: status });
    else if (r.s && p && p.status && r.s !== p.status) dupes.push({ thread: r.id, field: 'status', kept: 'entities.json', also: `threads.js s "${r.s}"`, value: p.status });
    const builtF = fRows.filter(n => +n.tier <= 2).map(n => ({ id: n.id, title: n.title, tier: +n.tier }));
    const row = {
      id: r.id, n: r.n || (p && p.name) || r.id, pillar: p ? 'E:' + p.id : '', area,
      status, statusFrom, cls: s ? s.cls : '', mask: s ? s.mask : '', reach: s ? s.reach : [], pulse: s ? s.pulse : '',
      quiet: s && s.pulse ? daysBetween(s.pulse, today) : null, drift: p && drift.has(p.id) ? drift.get(p.id) : null,
      dl: (r.lines || []).map(lineState), built: builtF, d: (r.d || []).map(x => (item(x) || {}).label).filter(Boolean), b: (r.b || []).map(x => (item(x) || {}).label).filter(Boolean),
      t: todoOf(r.id).map(n => ({ id: n.id, l: n.title, orig: (n.labels && n.labels[r.id]) || n.title, h: n.brief || '', state: n.state, evidence: n.evidence || [], also: (n.from || []).filter(f => f !== 'thread ' + r.id) })),
      note: r.note || '', read: r.read || [], go: r.go || '',
    };
    if (!areaIx.has(area)) { areaIx.set(area, areas.length); areas.push({ area, rows: [] }); }
    areas[areaIx.get(area)].rows.push(row);
  }
  // the lines no thread names: the board's "other" list
  const other = [...LINES.values()].filter(l => !used.has(l.id)).map(l => lineState(l.id));
  const rows = areas.flatMap(a => a.rows);
  const pick = x => (Array.isArray(x) ? x : [x]);
  return {
    about: 'VRG Stack — Füzértábla (String Board) data. Generated by Stack/lib/board.js on every stack build; never edit by hand. Quotes job codes: stays in out/.',
    build: (graph && graph.build) || null, schema: (graph && graph.schema) || null,   // the page contract (S7): the build stamp
    generated: graph.generated || new Date().toISOString(), today,
    scale: (threads && threads.SCALE) || SCALE0, classes: CLASSES, layers: S.ORDER.split(''),
    now: ((threads && threads.NOW) || []).map(String), waiting: ((threads && threads.WAITING) || []).map(x => pick(x).map(String)),
    areas, other, dupes,
    counts: { threads: rows.length, open: rows.reduce((a, r) => a + r.t.length, 0), looksDone: rows.reduce((a, r) => a + r.t.filter(t => t.state === 'looks done').length, 0),
      drift: rows.filter(r => r.drift).length, noPillar: rows.filter(r => !r.pillar).length, dupes: dupes.length },
  };
}

function read(f) { try { delete require.cache[require.resolve(f)]; return require(f); } catch { return null; } }

function write({ graph } = {}) {
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const notes = CFG.sources.notes;
  const threads = read(notes + '/devlog/threads.js'), lines = read(notes + '/devlog/lines.js');
  if (!threads) throw new Error('notes/devlog/threads.js could not be read');
  const data = build(g, threads, lines);
  X.writeAtomic(path.join(CFG.out, 'board-data.js'), '// generated by stack.js build (lib/board.js)\nwindow.BOARD = ' + JSON.stringify(data) + ';\n');
  const k = data.counts;
  return { data, msg: `board: ${k.threads} threads, ${k.open} open items (${k.looksDone} look done), ${k.drift} status drifts, ${k.dupes} fields kept twice, ${k.noPillar} threads with no pillar → out/board-data.js` };
}

/* ---- the anonymised copy for claude.ai (replaces board.js --public): the page with its data and styles inlined, every
   job code swapped by the map, then checked by the anonymiser itself; no map, no copy (fail closed) */
function swapper(map) {
  const codes = [];
  for (const c of map.codes || []) { codes.push(c); if (c.from.toLowerCase() !== c.from) codes.push({ from: c.from.toLowerCase(), to: c.to.toLowerCase() }); }
  codes.sort((a, b) => b.from.length - a.from.length);
  const by = Object.fromEntries(codes.map(c => [c.from, c.to]));
  const rx = codes.length ? new RegExp(codes.map(c => c.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
  return s => {
    for (const l of map.literals || []) s = s.split(l.from).join(l.to);
    return rx ? s.replace(rx, (m, i, str) => (/[A-Za-z]/.test(str[i - 1] || '') || /[0-9]/.test(str[i + m.length] || '') ? m : by[m])) : s;
  };
}
function exportPublic({ mapFile = path.join(C.REPO, 'tools', 'anonymise.map.json'), out = path.join(CFG.out, 'board-public.html') } = {}) {
  if (!fs.existsSync(mapFile)) throw Object.assign(new Error(`no ${mapFile}: copy tools/anonymise.map.example.json and fill it in (no map, no public copy)`), { code: 2 });
  const swap = swapper(JSON.parse(fs.readFileSync(mapFile, 'utf8')));
  const root = path.join(__dirname, '..');
  let html = fs.readFileSync(path.join(root, 'board.html'), 'utf8');
  const data = fs.readFileSync(path.join(CFG.out, 'board-data.js'), 'utf8');
  const js = s => s.replace(/<\/(script)/gi, '<\\/$1');
  // every stylesheet inlined; the font files stay behind (the page falls back to system fonts)
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
    if (/fonts\.css$/.test(href)) return '';
    const f = path.resolve(root, href); let css = ''; try { css = fs.readFileSync(f, 'utf8'); } catch { return ''; }
    return `<style>/* ${href} */\n${css.replace(/<\/(style)/gi, '<\\/$1')}\n</style>`;
  });
  html = html.replace('<script src="out/board-data.js"></script>', () => `<script>window.STACK_BUNDLE = true; window.BOARD_PUBLIC = true;\n${js(swap(data))}</script>`);
  html = html.replace('<script src="lib/editdialog.js"></script>', '');   // the public copy is read-only
  html = html.replace('<script src="lib/live.js"></script>', () => `<script>/* lib/live.js */\n${js(fs.readFileSync(path.join(root, 'lib', 'live.js'), 'utf8'))}</script>`);
  if (/<script src=|<link rel="stylesheet"/.test(html)) throw new Error('board.html: something external is still linked');
  X.writeAtomic(out, html);
  const r = require('child_process').spawnSync(process.execPath, [path.join(C.REPO, 'tools', 'anonymise.js'), '--check', out, '--map', mapFile], { encoding: 'utf8' });
  if (r.status !== 0) { try { fs.unlinkSync(out); } catch {} throw new Error('the anonymiser still finds a code in the public copy; nothing written:\n' + (r.stdout || '') + (r.stderr || '')); }
  return { file: out, bytes: Buffer.byteLength(html) };
}

module.exports = { build, write, exportPublic, swapper, CLASSES, SCALE0 };
