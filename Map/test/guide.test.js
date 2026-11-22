// lib/guide.js on routes of an invented town (tools/build-roads.js on a .pbf from test/pbf-writer.js, lib/route.js).
//
//                 P2
//                 |  Kossuth utca                 N1
//   W1 ---------- J1 ---------- E1                |  Arany utca (meets Petőfi at E1, no other way: a bend)
//     Petőfi utca |              \________________/
//                 P0
//                 |  Rákóczi út (meets Kossuth at P0 end to end)
//                 R1                   the roundabout, counter-clockwise R1 -> R4 -> R3 -> R2 -> R1
//      Nyugati  R4    R2  Keleti
//                 R3
//                 |  Déli út
//                 D
'use strict';
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const R = require('../lib/route.js');
const G = require('../lib/guide.js');
const { buildRoads } = require('../tools/build-roads.js');
const { writePbf } = require('./pbf-writer.js');

const m = (x, y) => [19 + x / 75200, 47.5 + y / 111200];       // metres east / north of a point near Budapest
const P = { P0: m(0, 0), J1: m(0, 300), P2: m(0, 600), W1: m(-300, 300), E1: m(300, 300), N1: m(300, 600),
  R1: m(0, -200), R4: m(-40, -240), R3: m(0, -280), R2: m(40, -240), WW: m(-300, -240), D: m(0, -500), EE: m(300, -240) };
const ids = Object.fromEntries(Object.keys(P).map((k, i) => [k, i + 1]));
const at = k => ({ lon: P[k][0], lat: P[k][1] });

function town() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-guide-')), file = path.join(dir, 't.osm.pbf');
  const w = (id, ks, tags) => ({ id, refs: ks.map(k => ids[k]), tags });
  writePbf(file, { nodes: Object.keys(P).map(k => ({ id: ids[k], lon: P[k][0], lat: P[k][1] })), ways: [
    w(1, ['P0', 'J1', 'P2'], { highway: 'residential', name: 'Kossuth utca' }),
    w(2, ['W1', 'J1', 'E1'], { highway: 'residential', name: 'Petőfi utca' }),
    w(3, ['E1', 'N1'], { highway: 'residential', name: 'Arany utca' }),
    w(4, ['P0', 'R1'], { highway: 'secondary', name: 'Rákóczi út' }),
    w(5, ['R1', 'R4', 'R3', 'R2', 'R1'], { highway: 'secondary', junction: 'roundabout' }),
    w(6, ['R4', 'WW'], { highway: 'residential', name: 'Nyugati út' }),
    w(7, ['R3', 'D'], { highway: 'residential', name: 'Déli út' }),
    w(8, ['R2', 'EE'], { highway: 'residential', name: 'Keleti út' }),
  ] });
  const bin = buildRoads(file);
  fs.rmSync(dir, { recursive: true, force: true });
  return R.decode(new Uint8Array(bin));
}

module.exports = t => {
  const g = town();
  const plan = (a, b, mode = 'auto') => R.route(g, at(a), at(b), mode);

  t('the file keeps the street names (format 2)', () => {
    assert.ok(g.names.includes('Petőfi utca') && g.names.includes('Déli út'));
    const r = plan('P2', 'W1');
    assert.deepStrictEqual([...new Set(r.legs.map(l => l.name))], ['Kossuth utca', 'Petőfi utca']);
  });

  t('a crossroads: heading south, west is a right turn onto Petőfi utca', () => {
    const s = G.steps(plan('P2', 'W1'), 'Próba bolt');
    assert.deepStrictEqual(s.map(x => x.kind), ['depart', 'turn', 'arrive']);
    assert.strictEqual(s[0].text, 'Induljon el dél felé – Kossuth utca');
    assert.strictEqual(s[1].text, 'Forduljon jobbra – Petőfi utca');
    assert.strictEqual(s[1].icon, '↱');
    assert.ok(Math.abs(s[1].offset - 300) < 3, 'at the crossroads, 300 m in: ' + s[1].offset);
    assert.strictEqual(s[2].text, 'Megérkezett: Próba bolt');
  });

  t('a forced bend with a new name is not announced; the left turn before it is', () => {
    const s = G.steps(plan('P2', 'N1'));
    assert.deepStrictEqual(s.map(x => x.kind + (x.mod ? ':' + x.mod : '')), ['depart', 'turn:balra', 'arrive']);
    assert.strictEqual(s[1].name, 'Petőfi utca');
  });

  t('the roundabout: one step, the 2nd exit (Nyugati út passed), onto Déli út; Kossuth -> Rákóczi end to end is silent', () => {
    const s = G.steps(plan('P2', 'D'));
    assert.deepStrictEqual(s.map(x => x.kind), ['depart', 'roundabout', 'arrive']);
    assert.strictEqual(s[1].exit, 2);
    assert.strictEqual(s[1].text, 'A körforgalomban a 2. kijáraton hajtson ki – Déli út');
    const e = G.steps(plan('P2', 'EE'));
    assert.strictEqual(e[1].exit, 3, 'Keleti út is the 3rd');
    const w = G.steps(plan('P2', 'WW'));
    assert.strictEqual(w[1].exit, 1);
  });

  t('on foot the roundabout is worded for walking', () => {
    const s = G.steps(plan('P2', 'D', 'gyalog'));
    const r = s.find(x => x.kind === 'roundabout');
    assert.ok(!r || /menjen tovább/.test(r.text), r && r.text);
  });

  t('spoken: distances rounded, "Most" at the turn, kilometres', () => {
    const turn = G.steps(plan('P2', 'W1'))[1];
    assert.strictEqual(G.spoken(turn, 320), '300 méter múlva forduljon jobbra – Petőfi utca');
    assert.strictEqual(G.spoken(turn, 134), '130 méter múlva forduljon jobbra – Petőfi utca');
    assert.strictEqual(G.spoken(turn, 20), 'Forduljon jobbra – Petőfi utca');
    assert.strictEqual(G.spoken(turn, 1260), '1,3 kilométer múlva forduljon jobbra – Petőfi utca');
    assert.deepStrictEqual(G.cues('auto'), [700, 250, 50]);
  });

  t('next: the step ahead for the metres done', () => {
    const s = G.steps(plan('P2', 'W1'));
    assert.strictEqual(G.next(s, 0), 1);
    assert.strictEqual(G.next(s, 295), 1, 'just before the turn');
    assert.strictEqual(G.next(s, 320), 2, 'after it: the arrival');
    assert.strictEqual(G.modOf(30), 'enyhén jobbra'); assert.strictEqual(G.modOf(-90), 'balra'); assert.strictEqual(G.modOf(175), 'vissza');
  });
};
