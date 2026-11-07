// VRG Stack — entity pillars (layer E): one real thing across every layer.
// The list is by hand (entities.js). A node joins a pillar by path, by a whole title word, or by
// explicit id. Member → pillar links carry v = 2, so counts can tell evidence (v = 1) from list (v = 2).
'use strict';

const C = require('./common');
const { fold } = C;

function pillars(nodes, edges, list) {
  const entities = list.map(([id, name, words, paths, ids]) => {
    const rx = words.map(w => new RegExp('(^|[^a-z0-9])' + fold(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])'));
    const under = paths.map(p => C.normPath(p));
    const members = [];
    for (const n of nodes.values()) {
      const ownP = n.own.filter(k => k.startsWith('p:')).map(k => k.slice(2));
      const byPath = ownP.some(p => under.some(u => p === u || p.startsWith(u + '/')));
      const byWord = n.kind !== 'commit' && n.kind !== 'run' && rx.some(r => r.test(fold(n.title)));
      if (byPath || byWord || ids.includes(n.id)) members.push(n.id);
    }
    for (const m of members) (nodes.get(m).ent = nodes.get(m).ent || []).push(id);
    const per = {}; for (const m of members) { const l = nodes.get(m).layer; per[l] = (per[l] || 0) + 1; }
    return { id, name, words, paths, members, per };
  });
  for (const e of entities) {
    nodes.set('E:' + e.id, {
      id: 'E:' + e.id, layer: 'E', kind: 'pillar', title: e.name, own: [], t: '', state: `${e.members.length} nodes`,
      brief: `Same thing across layers: ${Object.entries(e.per).map(([l, c]) => l + ' ' + c).join(', ')}.`, text: e.name + ' ' + e.words.join(' '),
    });
    for (const m of e.members) edges.push({ a: m, b: 'E:' + e.id, rel: 'pillar', v: 2 });
  }
  return entities;
}

module.exports = { pillars };
