import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { createStore } from '../src/core/store.js';
import { createUserData, sanitize, USERDATA_VERSION } from '../src/core/userdata.js';
import { createLists } from '../src/core/lists.js';
import { createProjects } from '../src/core/projects.js';
import * as pi from '../src/core/plannerimport.js';
import * as dg from '../src/core/diagram.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const raw = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'vrg-inventory.json'), 'utf8'));

/** The real Planner export that lives in the repo. */
const PLAN_FILE = path.join(ROOT, '..', 'Calculator', 'P33_vplan_updated.json');
const planJson = () => JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));

function setup() {
  const store = createStore(raw());
  const userdata = createUserData();
  store.setUserData(userdata);
  const lists = createLists({ userdata, store });
  const projects = createProjects({ userdata, lists });
  return { store, userdata, lists, projects };
}

// -------------------------------------------------------------- the real file
test('the real Planner export parses', () => {
  const plan = pi.parsePlan(planJson());
  assert.equal(plan.forras, 'varler-planner');
  assert.equal(plan.nev, 'P33');
  assert.equal(plan.osszegzes.eszkoz, 84);
  assert.equal(plan.osszegzes.helyiseg, 11);
  assert.ok(plan.igenyek.length > 0);
});

test('device counts match the drawing exactly', () => {
  const plan = pi.parsePlan(planJson());
  const by = Object.fromEntries(plan.igenyek.map(i => [i.kulcs, i.mennyiseg]));
  // counted straight out of the file: 36 sockets, 26 lights, 15 switches, 5 boxes, 2 junctions
  assert.equal(by['dev:socket'], 36);
  assert.equal(by['dev:light'], 26);
  assert.equal(by['dev:switch'], 15);
  assert.equal(by['dev:box'], 5);
  assert.equal(by['dev:junction'], 2);
  const devTotal = plan.igenyek.filter(i => i.kulcs.startsWith('dev:')).reduce((a, i) => a + i.mennyiseg, 0);
  assert.equal(devTotal, 84, 'every device in the drawing is accounted for');
});

test('cable runs become metres, by build type', () => {
  const plan = pi.parsePlan(planJson());
  const paths = plan.igenyek.filter(i => i.kulcs.startsWith('path:'));
  assert.ok(paths.length >= 1);
  const total = paths.reduce((a, i) => a + i.mennyiseg, 0);
  assert.ok(Math.abs(total - plan.osszegzes.nyomvonal_fm) < 0.05, 'the per-build metres add up to the total');
  assert.ok(total > 0 && total < 1000, 'a plausible length in metres, not millimetres');
});

test('a 3-D section length uses height as well as plan distance', () => {
  const flat = pi.segLength({ x: 0, y: 0, h: 0 }, { x: 3000, y: 4000, h: 0 });
  assert.equal(flat, 5000);
  const withRise = pi.segLength({ x: 0, y: 0, h: 0 }, { x: 0, y: 0, h: 2700 });
  assert.equal(withRise, 2700);
});

test('a file that is not a Planner export is refused', () => {
  assert.throws(() => pi.parsePlan({ format: 'something-else' }), /Nem Planner mentés/);
  assert.throws(() => pi.parsePlan('szöveg'), /nem érvényes JSON objektum/);
});

test('an unrecognised device type is reported, never dropped', () => {
  const doc = planJson();
  doc.project.data.devices.push({ type: 'hőszivattyú', level: 'ground', id: 'X1' });
  const plan = pi.parsePlan(doc);
  const odd = plan.igenyek.find(i => i.kulcs === 'dev:hőszivattyú');
  assert.ok(odd, 'it still appears as a requirement');
  assert.equal(odd.ismeretlen, true);
  assert.deepEqual(odd.kategoriak, [], 'with no category, because we do not know one');
  assert.ok(plan.warnings.some(w => /ismeretlen fajta/.test(w)));
  const devTotal = plan.igenyek.filter(i => i.kulcs.startsWith('dev:')).reduce((a, i) => a + i.mennyiseg, 0);
  assert.equal(devTotal, 85, 'the unknown one is still counted');
});

// ------------------------------------------------------------------ progress
test('progress counts only items whose category answers the requirement', () => {
  const { store, lists } = setup();
  const plan = pi.parsePlan(planJson());
  lists.create('P33');

  const socket = store.items.find(i => i.kategoria.al === 'Csatlakozóaljzatok');
  const cable = store.items.find(i => (i.kategoria.al || '').startsWith('Erősáramú'));
  lists.setQty(socket.vrg_id, 10);
  lists.setQty(cable.vrg_id, 50);

  const prog = pi.progress(plan, lists.rows());
  const sockets = prog.sorok.find(r => r.kulcs === 'dev:socket');
  assert.equal(sockets.van, 10, 'the sockets count');
  assert.equal(sockets.hianyzik, 26);
  assert.equal(sockets.kesz, false);
  assert.ok(!sockets.tetelek.some(t => t.vrg_id === cable.vrg_id), 'a cable does not tick off a socket');
});

test('a requirement is finished when the quantity is met, and surplus is reported', () => {
  const { store, lists } = setup();
  const plan = pi.parsePlan(planJson());
  lists.create('P33');
  const box = store.items.find(i => i.kategoria.al === 'Süllyesztett kötődobozok és fedelek');
  lists.setQty(box.vrg_id, 40);

  const prog = pi.progress(plan, lists.rows());
  const boxes = prog.sorok.find(r => r.kulcs === 'dev:box');
  assert.equal(boxes.kesz, true);
  assert.equal(boxes.hianyzik, 0);
  assert.ok(boxes.tobblet > 0);
});

// ------------------------------------------------------------------ autofill
test('autofill prefers a favourite, and says why', () => {
  const { store, userdata, lists } = setup();
  const plan = pi.parsePlan(planJson());
  lists.create('P33');

  const sockets = store.items.filter(i => i.kategoria.al === 'Csatlakozóaljzatok');
  assert.ok(sockets.length > 1, 'more than one candidate, so the choice is meaningful');
  const pick = sockets[sockets.length - 1];
  userdata.set(pick.vrg_id, 'kedvenc', true);
  store.remergeAll();

  const prog = pi.progress(plan, lists.rows());
  const filled = pi.autofillPlan(prog, store);
  const s = filled.javaslatok.find(j => j.igeny.kulcs === 'dev:socket');
  assert.equal(s.item.vrg_id, pick.vrg_id, 'the favourite wins');
  assert.equal(s.miert, 'kedvenc');
  assert.equal(s.mennyiseg, 36);
});

test('with no favourite, autofill takes the most frequently ordered', () => {
  const { store, lists } = setup();
  const plan = pi.parsePlan(planJson());
  lists.create('P33');
  const prog = pi.progress(plan, lists.rows());
  const filled = pi.autofillPlan(prog, store);
  const s = filled.javaslatok.find(j => j.igeny.kulcs === 'dev:socket');
  assert.equal(s.miert, 'leggyakrabban rendelt');
  const best = store.items
    .filter(i => i.kategoria.al === 'Csatlakozóaljzatok')
    .sort((a, b) => b.felhasznalas.rendelesek_szama - a.felhasznalas.rendelesek_szama)[0];
  assert.equal(s.item.felhasznalas.rendelesek_szama, best.felhasznalas.rendelesek_szama);
});

test('autofill proposes but does not write', () => {
  const { store, lists } = setup();
  const plan = pi.parsePlan(planJson());
  const l = lists.create('P33');
  pi.autofillPlan(pi.progress(plan, lists.rows()), store);
  assert.equal(Object.keys(lists.get(l.id).sorok).length, 0, 'planning an autofill changes nothing');
});

test('autofill reports the requirements it cannot answer', () => {
  const { store, lists } = setup();
  const plan = pi.parsePlan(planJson());
  lists.create('P33');
  const filled = pi.autofillPlan(pi.progress(plan, lists.rows()), store);
  // an unclassified requirement can never be autofilled
  const unknown = plan.igenyek.filter(i => i.ismeretlen);
  for (const u of unknown) {
    assert.ok(!filled.javaslatok.some(j => j.igeny.kulcs === u.kulcs));
  }
  for (const n of filled.nincs) assert.ok(n.ok, 'every refusal gives a reason');
});

// -------------------------------------------------- the DoD, end to end
test('importing the real plan, then autofilling, drives the counters to zero', () => {
  const { store, userdata, lists, projects } = setup();
  const plan = pi.parsePlan(planJson());

  const p = projects.create({
    nev: plan.projekt.megnevezes || plan.nev,
    cim: plan.projekt.cim,
    terv: { forras: plan.forras, nev: plan.nev, mentve: plan.mentve, igenyek: plan.igenyek }
  });
  const l = projects.ensureList(p.id);
  assert.ok(l, 'a project gets a list on demand');

  const before = pi.progress(p.terv, projects.rows(p.id));
  assert.equal(before.kesz, 0, 'nothing chosen yet');
  assert.ok(before.hianyzo_fajta > 0);

  // apply the autofill for real
  const filled = pi.autofillPlan(before, store);
  assert.ok(filled.javaslatok.length > 0);
  for (const j of filled.javaslatok) lists.add(j.item.vrg_id, j.mennyiseg, l.id);

  const after = pi.progress(p.terv, projects.rows(p.id));
  const answerable = after.sorok.filter(r => !r.ismeretlen &&
    store.items.some(it => pi.itemAnswers(it, r)));
  assert.ok(answerable.length > 0);
  for (const r of answerable) {
    assert.equal(r.hianyzik, 0, `${r.cimke} should be satisfied, still short ${r.hianyzik}`);
    assert.equal(r.kesz, true);
  }
  assert.ok(after.kesz > before.kesz);
});

// ------------------------------------------------------------- persistence
test('a project and its plan survive an export/import round-trip', () => {
  const { userdata, lists, projects, store } = setup();
  const plan = pi.parsePlan(planJson());
  const p = projects.create({ nev: 'P33', cim: 'Peterdy 33', terv: { forras: plan.forras, nev: plan.nev, mentve: plan.mentve, igenyek: plan.igenyek } });
  const l = projects.ensureList(p.id);
  lists.setQty(store.items[0].vrg_id, 3, l.id);

  const file = JSON.parse(JSON.stringify(userdata.serialize()));
  const store2 = createStore(raw());
  const { doc, warnings } = sanitize(file, id => !!store2.get(id));
  assert.deepEqual(warnings, []);
  const ud2 = createUserData(doc);
  store2.setUserData(ud2);
  const lists2 = createLists({ userdata: ud2, store: store2 });
  const projects2 = createProjects({ userdata: ud2, lists: lists2 });

  const p2 = projects2.all()[0];
  assert.equal(p2.nev, 'P33');
  assert.equal(p2.cim, 'Peterdy 33');
  assert.equal(p2.terv.igenyek.length, plan.igenyek.length);
  assert.equal(p2.listaId, l.id, 'the project still points at its list');
  assert.equal(lists2.qty(store.items[0].vrg_id, p2.listaId), 3);
});

test('a project pointing at a list that no longer exists is repaired on import', () => {
  const { userdata, projects } = setup();
  projects.create({ nev: 'Árva', listaId: 'nincs-ilyen' });
  const { doc } = sanitize(JSON.parse(JSON.stringify(userdata.serialize())));
  assert.equal(Object.values(doc.projects)[0].listaId, null);
});

test('deleting a project can keep or remove its list', () => {
  const { lists, projects } = setup();
  const a = projects.create({ nev: 'A' });
  const la = projects.ensureList(a.id);
  projects.remove(a.id, false);
  assert.ok(lists.get(la.id), 'the list is kept by default');

  const b = projects.create({ nev: 'B' });
  const lb = projects.ensureList(b.id);
  projects.remove(b.id, true);
  assert.equal(lists.get(lb.id), null, 'or removed when asked');
});

test('a userdata document from Phase 8 migrates and gains projects', () => {
  const old = {
    schema: 'vrg-userdata', schema_version: '1.3.0',
    created: 'x', updated: 'x', items: {}, lists: {}, activeList: null,
    exportProfiles: [], vendorData: {}, financeLog: [], saveLog: [], ui: {}
  };
  const ud = createUserData(old);
  assert.equal(ud.doc.schema_version, USERDATA_VERSION);
  assert.deepEqual(ud.doc.projects, {});
  assert.equal(ud.doc.activeProject, null);
});

test('no two REQUIREMENTS from a plan share a category', () => {
  // Rules MAY share a category — flush conduit and surface conduit are both
  // conduit. parsePlan merges those into one requirement, and it is the merged
  // set that must be disjoint: otherwise one purchase ticks off two
  // requirements and the progress reads as twice the material on the list.
  const plan = pi.parsePlan(planJson());
  const owner = new Map();
  for (const ig of plan.igenyek) {
    for (const cat of ig.kategoriak) {
      assert.equal(owner.get(cat), undefined,
        `"${cat}" is claimed by both ${owner.get(cat)} and ${ig.kulcs}`);
      owner.set(cat, ig.kulcs);
    }
  }
});

test('kinds answered by the same categories merge into one requirement', () => {
  const doc = planJson();
  // add a surface-conduit run alongside the flush one already in the drawing
  doc.project.data.paths.push({
    nodes: [{ x: 0, y: 0, h: 0 }, { x: 4000, y: 0, h: 0 }],
    sections: [{ build: 'fk_gege' }]
  });
  const plan = pi.parsePlan(doc);
  const conduit = plan.igenyek.filter(i => i.kategoriak.includes('Gégecsövek'));
  assert.equal(conduit.length, 1, 'one conduit requirement, not two');
  assert.ok(conduit[0].mennyiseg > 4, 'the metres are summed: 1.88 flush + 4 surface');
  assert.match(conduit[0].cimke, /Gégecső/);
});

test('one item cannot satisfy two different requirements', () => {
  const { store, lists } = setup();
  const plan = pi.parsePlan(planJson());
  lists.create('P33');
  const box = store.items.find(i => i.kategoria.al === 'Süllyesztett kötődobozok és fedelek');
  lists.setQty(box.vrg_id, 5);

  const prog = pi.progress(plan, lists.rows());
  const counted = prog.sorok.filter(r => r.tetelek.some(t => t.vrg_id === box.vrg_id));
  assert.equal(counted.length, 1, 'exactly one requirement claims it');
  assert.equal(counted[0].kulcs, 'dev:box');
});

// ------------------------------------------------------------------ diagram
test('the drawing survives the import with its geometry', () => {
  const plan = pi.parsePlan(planJson());
  const r = plan.rajz;
  assert.deepEqual(r.szintek, ['ground']);
  assert.equal(r.helyisegek.length, 11);
  assert.equal(r.eszkozok.length, 84, 'every device keeps a position');
  assert.equal(r.nyilasok.length, 13);
  assert.ok(r.hatar.maxX > r.hatar.minX && r.hatar.maxY > r.hatar.minY);
  for (const e of r.eszkozok) {
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'no NaN coordinates');
  }
});

test('a drawing with no geometry reports itself instead of rendering nothing', () => {
  const d = dg.buildDiagram({ rajz: null, progress: { sorok: [] } });
  assert.equal(d.ures, true);
  assert.ok(d.ok);
  const d2 = dg.buildDiagram({ rajz: { szintek: [], helyisegek: [], eszkozok: [], nyilasok: [], hatar: null }, progress: { sorok: [] } });
  assert.equal(d2.ures, true);
});

test('THE DoD: every symbol’s state equals its requirement’s state', () => {
  const { store, lists } = setup();
  const plan = pi.parsePlan(planJson());
  lists.create('P33');
  // satisfy exactly one requirement, and part of another
  const socket = store.items.find(i => i.kategoria.al === 'Csatlakozóaljzatok');
  const sw = store.items.find(i => i.kategoria.al === 'Kapcsolók');
  lists.setQty(socket.vrg_id, 36);
  lists.setQty(sw.vrg_id, 5);

  const prog = pi.progress(plan, lists.rows());
  const d = dg.buildDiagram({ rajz: plan.rajz, progress: prog });

  assert.equal(d.jelek.length, 84);
  for (const j of d.jelek) {
    const req = prog.sorok.find(r => r.kulcs === j.igenyKulcs);
    assert.ok(req, `${j.tipus} has no requirement`);
    const expected = req.ismeretlen ? 'ismeretlen' : (req.kesz ? 'kesz' : (req.van > 0 ? 'reszben' : 'nincs'));
    assert.equal(j.allapot, expected, `${j.tipus} symbol disagrees with its requirement`);
  }
  assert.equal(d.osszegzes.kesz, 36, 'all 36 socket symbols are green');
  assert.equal(d.osszegzes.reszben, 15, 'all 15 switch symbols are amber');
  assert.equal(d.osszegzes.nincs, 84 - 36 - 15);
});

test('the diagram holds no state of its own — same inputs, same output', () => {
  const { store, lists } = setup();
  const plan = pi.parsePlan(planJson());
  lists.create('P33');
  const socket = store.items.find(i => i.kategoria.al === 'Csatlakozóaljzatok');
  lists.setQty(socket.vrg_id, 10);

  const prog = pi.progress(plan, lists.rows());
  const a = dg.buildDiagram({ rajz: plan.rajz, progress: prog });
  const b = dg.buildDiagram({ rajz: plan.rajz, progress: prog });
  assert.deepEqual(a, b);

  // and changing the list changes the diagram, with nothing to "refresh"
  lists.setQty(socket.vrg_id, 36);
  const c = dg.buildDiagram({ rajz: plan.rajz, progress: pi.progress(plan, lists.rows()) });
  assert.notDeepEqual(a.osszegzes, c.osszegzes);
  assert.equal(c.osszegzes.kesz, 36);
});

test('highlighting marks only the symbols the selected item could answer', () => {
  const plan = pi.parsePlan(planJson());
  const prog = pi.progress(plan, []);
  const d = dg.buildDiagram({
    rajz: plan.rajz, progress: prog, kiemeltKategoriak: ['Csatlakozóaljzatok']
  });
  const hi = d.jelek.filter(j => j.kiemelt);
  assert.equal(hi.length, 36);
  assert.ok(hi.every(j => j.tipus === 'socket'));
});

test('the legend counts match the symbols on the level', () => {
  const plan = pi.parsePlan(planJson());
  const d = dg.buildDiagram({ rajz: plan.rajz, progress: pi.progress(plan, []) });
  const total = d.jelmagyarazat.reduce((a, r) => a + r.darab, 0);
  assert.equal(total, d.jelek.length);
  const sockets = d.jelmagyarazat.find(r => r.tipus === 'socket');
  assert.equal(sockets.darab, 36);
  assert.equal(sockets.kell, 36);
});

test('a merged requirement still owns its symbols', () => {
  const doc = planJson();
  doc.project.data.paths.push({ nodes: [{ x: 0, y: 0, h: 0 }, { x: 4000, y: 0, h: 0 }], sections: [{ build: 'fk_gege' }] });
  const plan = pi.parsePlan(doc);
  const d = dg.buildDiagram({ rajz: plan.rajz, progress: pi.progress(plan, []) });
  // every symbol still resolves to a requirement even after the merge renamed keys
  assert.ok(d.jelek.every(j => j.igenyKulcs), 'no symbol lost its requirement');
});

test('the drawing survives an export/import round-trip', () => {
  const { userdata, projects, store } = setup();
  const plan = pi.parsePlan(planJson());
  projects.create({ nev: 'P33', terv: { forras: plan.forras, nev: plan.nev, mentve: plan.mentve, igenyek: plan.igenyek, rajz: plan.rajz } });

  const { doc } = sanitize(JSON.parse(JSON.stringify(userdata.serialize())), id => !!store.get(id));
  const r = Object.values(doc.projects)[0].terv.rajz;
  assert.equal(r.eszkozok.length, 84);
  assert.equal(r.helyisegek.length, 11);
  assert.deepEqual(r.hatar, plan.rajz.hatar);
});

test('a hand-edited drawing cannot smuggle in junk geometry', () => {
  const { userdata, projects } = setup();
  projects.create({
    nev: 'Rossz',
    terv: {
      forras: 'varler-planner', nev: 'x', mentve: '', igenyek: [],
      rajz: {
        szintek: ['ground'],
        helyisegek: [{ szint: 'ground', pontok: [[0, 0], ['a', 'b'], [1, 1]] }, { szint: 'g', pontok: [[0, 0]] }],
        eszkozok: [{ tipus: 'socket', x: 'nem szám', y: 5 }, { tipus: 'socket', x: 1, y: 2 }],
        nyilasok: [], hatar: { minX: 'x', maxX: 1, minY: 0, maxY: 1 }
      }
    }
  });
  const { doc } = sanitize(JSON.parse(JSON.stringify(userdata.serialize())));
  const r = Object.values(doc.projects)[0].terv.rajz;
  assert.equal(r.eszkozok.length, 1, 'the non-numeric device is dropped');
  assert.equal(r.helyisegek.length, 0, 'a polygon left with < 3 valid points is dropped');
  assert.equal(r.hatar, null, 'a malformed bound is dropped, not half-used');
});
