// VRG Stack — N · Belépők (lib/entry.js, S11). Run:  node --test test/entry.test.js
// On the repo's own registries: every START key, server, program, catalog item and Mobile feature is a node.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const N = require('../lib/entry');
const S = require('../lib/strings');

const ROOT = path.join(__dirname, '..', '..');
const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'launcher', 'vrg-menu.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'launcher', 'vrg-catalog.json'), 'utf8'));
const mobile = fs.readFileSync(path.join(ROOT, 'Mobile', 'android', 'kit-core', 'src', 'main', 'kotlin', 'hu', 'vrg', 'mobile', 'core', 'Feature.kt'), 'utf8');
const L = N.layer({ menu, catalog, mobile });
const byId = new Map(L.nodes.map(n => [n.id, n]));

test('every START key, server, program, catalog item and Mobile feature is a node, once', () => {
  const keys = [];
  const walk = (items, prefix) => { for (const it of items || []) { const k = prefix ? prefix + '/' + it.key : it.key; keys.push(k); if (it.menu) walk(it.menu.items, k); } };
  for (const part of ['tools', 'projects', 'dev', 'bottom']) walk(menu.start[part], '');
  for (const k of keys) assert.ok(byId.has('N:start.' + k), 'START ' + k);
  for (const s of menu.servers) assert.equal(byId.get('N:server.' + s.id).extra.port, s.port);
  for (const p of menu.programs) assert.ok(byId.has('N:start.A/' + p.key), 'program ' + p.name);
  for (const it of catalog.items) assert.ok(byId.has('N:cat.' + it.id), 'catalog ' + it.id);
  const feats = [...mobile.matchAll(/val \w+ = FeatureInfo\(\s*"([^"]+)"/g)].map(m => m[1]);
  assert.ok(feats.length >= 30); for (const f of feats) assert.ok(byId.has('N:mob.' + f), 'mobile ' + f);
  assert.equal(new Set(L.nodes.map(n => n.id)).size, L.nodes.length, 'unique ids');
  assert.ok(L.nodes.every(n => n.layer === 'N'));
});

test('paths resolve into the repo, so the join links them to their folders; every catalog act lands on a START node', () => {
  assert.equal(byId.get('N:start.R/7').extra.path, 'Stack/viewer.html');
  assert.ok(byId.get('N:start.R/L').text.includes('Stack/board.html'));
  assert.equal(byId.get('N:server.stack').extra.js, 'Stack/serve.js');
  assert.ok(byId.get('N:start.1').text.includes('Planner/projects/varler-planner/dist/varler_planner.html'), '{planner} through the paths table');
  assert.ok(byId.get('N:start.A/1').extra.exe.startsWith('{full}/'), 'a program outside the repo keeps its H: form, no repo key');
  const acts = catalog.items.filter(i => i.launch && /^s:/.test(i.launch.act || ''));
  for (const i of acts) assert.ok(byId.has('N:start.' + i.launch.act.slice(2)), `catalog ${i.id} → START ${i.launch.act}`);
  assert.ok(L.edges.some(e => e.a === 'N:cat.threadboard' && e.b === 'N:start.R/L' && e.rel === 'launches'));
  assert.ok(L.edges.some(e => e.a === 'N:start.R' && e.b === 'N:start.R/7' && e.rel === 'contains'), 'a submenu holds its items');
  const r = N.resolver({ planner: '{repo}\\Planner\\projects\\varler-planner' });
  assert.deepEqual(r('{planner}\\dist\\x.html'), { repo: 'Planner/projects/varler-planner/dist/x.html' });
  assert.deepEqual(r('{full}\\tools\\node\\node.exe'), { outside: '{full}/tools/node/node.exe' });
});

test('unreachable: a pillar with code and no entry point is listed, one with an entry point is not', () => {
  const nodes = [{ id: 'E:a', layer: 'E', kind: 'pillar', title: 'A', own: [] }, { id: 'C:A', layer: 'C', title: 'A', own: [] }, { id: 'F:a', layer: 'F', title: 'A', tier: 2, own: [] },
    { id: 'E:b', layer: 'E', kind: 'pillar', title: 'B', own: [] }, { id: 'C:B', layer: 'C', title: 'B', own: [] }, { id: 'N:start.9', layer: 'N', title: 'B', own: [] }];
  const edges = [['C:A', 'E:a', 'pillar', 2], ['F:a', 'E:a', 'pillar', 2], ['C:B', 'E:b', 'pillar', 2], ['N:start.9', 'E:b', 'pillar', 2]];
  const u = N.unreachable({ nodes, edges, entities: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }, S, {});
  assert.deepEqual(u.map(x => x.pillar), ['a']);
  // a pillar whose folder sits inside one an entry point opens is reached through it
  nodes.push({ id: 'C:A/sub', layer: 'C', title: 'A sub', own: [] }, { id: 'N:start.1', layer: 'N', title: 'A tool', own: [] });
  const u2 = N.unreachable({ nodes, edges: [...edges, ['C:A/sub', 'E:a', 'pillar', 2], ['N:start.1', 'C:A', 'ref:p', 1]], entities: [{ id: 'a', name: 'A' }] }, S, {});
  assert.deepEqual(u2, [], 'C:A/sub is inside C:A, which START 1 opens');
  assert.match(u[0].mask, /^F · · · · · · · · · · C · · ·$/);
});
