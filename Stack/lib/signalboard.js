// VRG Stack — Jelzéstábla (signal board): the J layer's own page (jelzesek.html), S14's "a trouble map: each pillar's
// signals as a column, red on top, with the one action that clears each" (lib/meta.js).
//
//   build(graph, hist) → { data, hist }   pure: the J nodes grouped by the pillars their warned nodes belong to, the
//                                    worst pillar first; each signal with what it warns, the action that clears it, the
//                                    day it first appeared; and the signals that went away in the last 14 days. hist is
//                                    out/signals-history.json ({ seen: { id: [kind, title, first day] }, cleared: […] }):
//                                    the event log names a removed node but not its title, so the board keeps its own
//   write({ graph }) → { data, msg }  out/signals-data.js, window.SIGNALS (every build, full or incremental: J is
//                                    recomputed on both)
//
// data = { build, schema, generated, counts: { red, amber, info, total, pillars },
//          kinds: { <kind>: { hu, en, sev, act } },
//          signals: [[id, kind, sev, title, brief, about[], pillars[], since]],
//          about: { <node id>: [layer, kind, title] },          the warned nodes, for the detail panel
//          pillars: [{ id, name, area, worst, red, amber, info, signals: [index …] }],   worst first; '' = no pillar
//          cleared: [[id, kind, title, day]] }                  went away in the last 14 days, newest first
'use strict';

const fs = require('fs');
const path = require('path');
const CFG = require('../config');
const X = require('./fsx');
const C = require('./common');

const SEV = { red: 3, amber: 2, info: 1 };
// each kind: its name, and the one thing that clears it; own: the signal's brief is that action for this case (the
// others' brief is evidence: the quoted lines, the commits, the session that says so)
const KINDS = {
  'test-fail': { hu: 'Bukó teszt', en: 'failing test', act: 'fix it, then run it again: node stack.js probe <suite>' , own: true },
  'test-stale': { hu: 'Elavult teszt', en: 'stale test', act: 'run it again: node stack.js probe <suite>' },
  'no-runner': { hu: 'Futtatatlan teszt', en: 'tests nothing runs', act: 'name it in a START step, a CI line or package.json' },
  unverified: { hu: 'Teszteletlen kód', en: 'code no test reaches', act: 'add a test suite for it' },
  unreachable: { hu: 'Elérhetetlen kód', en: 'code nothing opens', act: 'give it a START key (launcher/vrg-menu.json) or say why it needs none' },
  'status-drift': { hu: 'Állapot-eltérés', en: 'status drift', act: 'correct the hand status, or the work' },
  'looks-done': { hu: 'Késznek tűnik', en: 'looks done', act: 'mark it done on the Füzértábla (✓ Kész)' },
  'asked-again': { hu: 'Ismételt kérés', en: 'asked again', act: 'turn it into a line, or drop it' },
  'job-quiet': { hu: 'Csendes munka', en: 'quiet job', act: 'update the register: running, finished or failed' },
  'fw-stale': { hu: 'Régi firmware', en: 'stale firmware', act: 'rebuild it and add it to the Board Console library' , own: true },
  'board-behind': { hu: 'Lemaradt lap', en: 'board behind', act: 'flash the latest version from the Board Console' , own: true },
  'board-unknown': { hu: 'Ismeretlen lap', en: 'unknown board', act: 'take a full backup in the Board Console' , own: true },
  'look-drift': { hu: 'Látvány-eltérés', en: 'look drift', act: 'node tools/melyviz-sync.js, then rebuild a built app' , own: true },
  'kit-behind': { hu: 'Régi UI Kit', en: 'kit behind', act: 'node shared/vrg-ui-kit/inline.js --sync-app <page>' , own: true },
  'vendor-branch': { hu: 'Ágra kötött forrás', en: 'pinned to a branch', act: 'pin a tag in vendor-manifest.json (refType: "tag")' , own: true },
  copyleft: { hu: 'Copyleft a kódban', en: 'copyleft in use', act: 'replace it, or keep it as a reference only' },
  'licence-unknown': { hu: 'Ismeretlen licenc', en: 'licence unknown', act: 'check the licence before copying any of it' , own: true },
  'import-broken': { hu: 'Törött import', en: 'broken import', act: 'fix the path, or commit the file it needs' },
  'import-cycle': { hu: 'Körkörös import', en: 'import cycle', act: 'break the circle: move the shared part out' },
  'access-signature': { hu: 'Hozzáférés aláírása', en: 'access list signature', act: 'the owner re-signs it: node tools/hub-sign.js' , own: true },
  'seat-vacant': { hu: 'Üres szék', en: 'vacant seat', act: 'fill the seat, or leave it on purpose' },
  contradiction: { hu: 'Ellentmondás', en: 'contradiction', act: 'rule on it (Solomon: the Founder rules)' },
  solomon: { hu: 'Solomon-jelzés', en: 'Solomon signal', act: 'look at it in the Adatgömb' },
  brief: { hu: 'Brief', en: 'brief', act: 'node tools/brief-state.js, then update the brief' },
  health: { hu: 'Build-egészség', en: 'build health', act: 'see HEALTH.md' },
};

function build(graph, hist = {}, today = new Date().toISOString().slice(0, 10)) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const J = graph.nodes.filter(n => n.layer === 'J').sort((a, b) => (SEV[b.state] || 0) - (SEV[a.state] || 0) || (a.id < b.id ? -1 : 1));
  const warns = new Map();
  for (const e of graph.edges) { const [a, b, rel] = Array.isArray(e) ? e : [e.a, e.b, e.rel]; if (rel === 'warns' && a.startsWith('J:')) (warns.get(a) || warns.set(a, []).get(a)).push(b); }
  // when each signal first appeared, and which went away since the last build (kept for 14 days)
  const seenBefore = (hist && hist.seen) || {}, seen = {}, live = new Set(J.map(n => n.id));
  for (const n of J) seen[n.id] = [n.kind, C.clip(n.title, 140), (seenBefore[n.id] && seenBefore[n.id][2]) || today];
  const keep = new Date(Date.parse(today) - 14 * 864e5).toISOString().slice(0, 10);
  const cleared = [...Object.entries(seenBefore).filter(([id]) => !live.has(id)).map(([id, v]) => [id, v[0], v[1], today]),
    ...((hist && hist.cleared) || []).filter(c => !live.has(c[0]))]   // a signal that came back is no longer cleared
    .filter((c, i, a) => c[3] >= keep && a.findIndex(x => x[0] === c[0]) === i).sort((a, b) => (a[3] < b[3] ? 1 : a[3] > b[3] ? -1 : 0)).slice(0, 40);
  const ents = new Map((graph.entities || []).map(e => [e.id, e]));
  const about = {}, signals = [], perPillar = new Map();
  J.forEach((n, i) => {
    const to = warns.get(n.id) || n.about || [];
    const ps = new Set();
    for (const id of to) {
      const t = byId.get(id); if (!t) continue;
      about[id] = about[id] || [t.layer, t.kind, C.clip(t.title, 120)];
      if (t.layer === 'E') ps.add(id.slice(2)); else for (const p of t.ent || []) ps.add(p);
    }
    const pillars = [...ps].sort();
    signals.push([n.id, n.kind, n.state, n.title, n.brief || '', to, pillars, seen[n.id][2]]);
    for (const p of pillars.length ? pillars : ['']) {
      const r = perPillar.get(p) || perPillar.set(p, { red: 0, amber: 0, info: 0, signals: [] }).get(p);
      r.signals.push(i); r[n.state] = (r[n.state] || 0) + 1;
    }
  });
  const worst = r => r.red ? 'red' : r.amber ? 'amber' : 'info';
  const pillars = [...perPillar].map(([id, r]) => ({ id, name: id ? ((ents.get(id) || {}).name || id) : '', area: id ? ((ents.get(id) || {}).area || '') : '', worst: worst(r), red: r.red, amber: r.amber, info: r.info, signals: r.signals }))
    .sort((a, b) => (!a.id) - (!b.id) || SEV[b.worst] - SEV[a.worst] || b.red - a.red || b.amber - a.amber || b.info - a.info || (a.name < b.name ? -1 : 1));
  const kinds = {};
  for (const n of J) if (!kinds[n.kind]) kinds[n.kind] = Object.assign({ hu: n.kind, en: n.kind, act: '' }, KINDS[n.kind] || {}, { sev: n.state });
  const count = s => J.filter(n => n.state === s).length;
  const data = { build: (graph && graph.build) || null, schema: (graph && graph.schema) || null, generated: new Date().toISOString(),
    counts: { red: count('red'), amber: count('amber'), info: count('info'), total: J.length, pillars: pillars.filter(p => p.id).length },
    kinds, signals, about, pillars, cleared };
  return { data, hist: { seen, cleared } };
}

function write({ graph } = {}) {
  const g = graph || JSON.parse(fs.readFileSync(path.join(CFG.out, 'stack.json'), 'utf8'));
  const HF = path.join(CFG.out, 'signals-history.json');
  const { data, hist } = build(g, X.readJson(HF, {}));
  X.writeAtomic(HF, JSON.stringify(hist));
  X.writeAtomic(path.join(CFG.out, 'signals-data.js'), '// generated by stack.js build (lib/signalboard.js)\nwindow.SIGNALS = ' + JSON.stringify(data) + ';\n');
  const k = data.counts;
  return { data, msg: `signals: ${k.total} (${k.red} red, ${k.amber} amber, ${k.info} info) on ${k.pillars} pillars, ${data.cleared.length} cleared in 14 days → out/signals-data.js` };
}

module.exports = { build, write, KINDS };
