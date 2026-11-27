// VRG Stack — J · Jelzések (signals), S14 of research/STRINGS-PLAN.md (§5, STK-Q24: T → N → P → K → J): every
// warning the stack already knows, as a node on what it is about. A string that holds a J node has trouble on it:
// the string "glows red", and the Viewer's J plane shows where the trouble sits.
//
//   detect(ctx) → { nodes, edges }      pure over what the build has; each detector reuses the check that already
//                                       writes the warning into a report, so J says nothing the reports do not:
//     test fail · test stale · no runner      P suites (lib/probe.js; DRIFT §12)
//     unverified · unreachable                pillars whose code no test reaches / nothing opens (DRIFT §12, §11)
//     looks done · status drift               T items with built evidence; hand status two steps from the string (§9, §10)
//     asked again                             K clusters asked in 2+ sessions with nothing landing (§13)
//     job quiet                               M jobs the register calls running, no file for 30+ days (§15)
//     contradiction · dark                    Solomon's signals not ruled yet (G:sig.*; DRIFT §5)
//     brief                                   a brief tools/brief-state.js calls stale or broken (Vezérlőterem)
//     health                                  a full build's own warnings and failures so far (HEALTH.md); an
//                                             incremental build carries them over (lib/pipeline.js)
//   J:<kind>.<about>   kind as above; state red / amber / info; title says it in one line, brief gives the evidence
//   J → the node it is about  rel 'warns' (a pillar-level signal warns the pillar, E:<id>)
//
// Ids name the thing, not the build: the same trouble keeps its id from build to build, so the event log says when it
// started (node+) and when it went away (node-), and the Viewer's time scrubber shows it.
'use strict';

const crypto = require('crypto');
const { clip } = require('./common');

const SEV = { red: 3, amber: 2, info: 1 };
const h8 = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8);

function detect(ctx = {}) {
  const { nodes = new Map(), edges = [], entities = [], S = null, sopts = {}, looksDone = [], checks = [], briefs = null } = ctx;
  const out = [], seen = new Set();
  const add = (kind, key, sev, title, brief, about) => {
    const id = `J:${kind}.${key}`; if (seen.has(id)) return; seen.add(id);
    out.push({ node: { id, layer: 'J', kind, title: clip(title, 140), brief: clip(brief || '', 300), state: sev, t: '', tier: '', lane: kind, own: [], text: `${title}\n${brief || ''}`, extra: { sev, about } }, about });
  };
  const list = [...nodes.values()];
  const name = n => (n && n.title) || '';

  /* P: the suites' last runs */
  for (const n of list) {
    if (n.layer !== 'P' || (n.kind !== 'test suite' && n.kind !== 'check')) continue;
    const x = n.extra || {}, l = x.last || {}, d = String(l.at || '').slice(0, 10);
    if (n.state === 'fail') add('test-fail', x.path || n.title, 'red', `${n.title} fails`, `last run ${d}${l.pass != null ? ', ' + l.pass + ' passed' : ''}${l.fail ? ', ' + l.fail + ' failed' : ''}${(x.keys || []).length ? '; run it again: START ' + x.keys.join(', ') : ''}`, [n.id]);
    else if (n.state === 'stale') add('test-stale', x.path || n.title, 'amber', `${n.title} passed, then its code changed`, `last passed ${d}; a commit since touched the suite or the code it requires`, [n.id]);
    else if (n.state === 'no runner') add('no-runner', x.path || n.title, 'amber', `nothing runs ${n.title}`, 'no START step, CI line, package.json or runner file names it', [n.id]);
  }

  /* strings: code no test reaches, code nothing opens, hand status far from the evidence */
  if (S && entities.length) {
    const graph = { nodes: list, edges, entities };
    const safe = f => { try { return f(); } catch { return []; } };
    for (const u of safe(() => require('./probe').unverified(graph, S, sopts)))
      add('unverified', u.pillar, 'amber', `${u.name}: code that no test reaches`, `the string ${u.mask} has C and no P; ${u.dirs.join(', ')}`, ['E:' + u.pillar]);
    for (const u of safe(() => require('./entry').unreachable(graph, S, sopts)))
      add('unreachable', u.pillar, 'amber', `${u.name}: code that nothing opens`, `the string ${u.mask} has C and no N; ${(u.dirs || []).join(', ')}`, ['E:' + u.pillar]);
    for (const c of safe(() => require('./todo').drift(graph, S, sopts)))
      add('status-drift', c.pillar, 'amber', `${c.name}: kept as ${c.hand}, the evidence says ${c.evidence}`, `${c.what || ''} ${c.mask || ''}`.trim(), ['E:' + c.pillar]);
  }

  /* T: open work that looks done */
  for (const t of looksDone) add('looks-done', t.id.slice(2), 'info', `“${name(t)}” looks done`, (t.evidence || []).map(e => e.text).slice(0, 3).join(' · '), [t.id]);

  /* K: asked again, nothing landed */
  for (const c of list) {
    if (c.layer !== 'K' || c.kind !== 'cluster' || c.state !== 'open' || ((c.extra || {}).sessions || 0) < 2) continue;
    add('asked-again', c.id.slice(2), 'amber', `asked in ${c.extra.sessions} sessions, nothing landed: ${c.title}`, c.brief, [c.id]);
  }

  /* M: a job running on paper, quiet in fact */
  for (const { n, days } of require('./jobs').quiet(list)) add('job-quiet', n.id.slice(6), 'amber', `${n.title.split(' · ')[0]} is running, its newest file is ${days} days old`, n.brief, [n.id]);

  /* Solomon: signals not ruled */
  for (const g of list) {
    if (g.layer !== 'G' || !/^signal\//.test(g.kind)) continue;
    const type = g.kind.slice(7), st = g.state || '';
    if (st === 'dismissed' || st === 'ruled' || !st || st === 'undefined') continue;
    const sev = type === 'contradiction' ? (st === 'confirmed' ? 'red' : 'amber') : 'info';
    add(type === 'contradiction' ? 'contradiction' : 'solomon', g.id.slice(6), sev, `${type} ${st}: ${g.title}`, g.brief, [g.id, ...edges.filter(e => e.a === g.id && e.rel === 'flags').map(e => e.b)]);
  }

  /* briefs: brief-state.js --check */
  for (const [id, probs] of Object.entries((briefs && briefs.problems) || {})) {
    const broken = probs.some(p => !/stale/.test(p));
    add('brief', id, broken ? 'red' : 'amber', `brief ${id} is ${broken ? 'broken' : 'stale'}`, probs.join(' · '), ['A:brief.' + id]);
  }

  /* the build's own health so far */
  for (const c of checks) {
    if (c.level !== 'warn' && c.level !== 'fail') continue;
    add('health', `${c.kind}.${h8(c.kind + ' ' + String(c.msg).replace(/\d+/g, '#'))}`, c.level === 'fail' ? 'red' : 'amber', `${c.kind}: ${c.msg}`, 'HEALTH.md', []);
  }

  const N = [], E = [];
  for (const { node, about } of out.sort((a, b) => SEV[b.node.state] - SEV[a.node.state] || (a.node.id < b.node.id ? -1 : 1))) {
    const to = about.filter(id => nodes.has(id));
    node.extra.about = to; N.push(node);
    for (const b of to) E.push({ a: node.id, b, rel: 'warns' });
  }
  return { nodes: N, edges: E };
}

// what each pillar's strings carry: the worst signal and the count (the DRIFT summary and the Viewer's glow)
function byPillar(graph) {
  const byId = new Map(graph.nodes.map(n => [n.id, n])), out = new Map();
  for (const e of graph.edges) {
    const [a, b, rel] = Array.isArray(e) ? e : [e.a, e.b, e.rel];
    if (rel !== 'warns') continue;
    const j = byId.get(a), t = byId.get(b); if (!j || !t) continue;
    const ps = t.layer === 'E' ? [t.id.slice(2)] : (t.ent || []);
    for (const p of ps) { const r = out.get(p) || out.set(p, { red: 0, amber: 0, info: 0, worst: 'info', ids: new Set() }).get(p); if (r.ids.has(j.id)) continue; r.ids.add(j.id); r[j.state]++; if (SEV[j.state] > SEV[r.worst]) r.worst = j.state; }
  }
  return out;   // a signal counts once per pillar, however many of the pillar's nodes it warns
}

module.exports = { detect, byPillar, SEV };
