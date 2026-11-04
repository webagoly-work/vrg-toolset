// WP-05: START key D opens the Irányítópult. Reads the real registry (read only).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const build = require('../build.js');

const MENU_FILE = path.resolve(__dirname, '..', '..', 'launcher', 'vrg-menu.json');
const menu = () => JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));

test('the menu parses and start.dev exists', () => {
  assert.ok(Array.isArray(menu().start.dev));
});

test('exactly one start.dev item has key D, and it runs the Irányítópult .cmd', () => {
  const ds = menu().start.dev.filter(i => i.key === 'D');
  assert.strictEqual(ds.length, 1);
  assert.strictEqual(ds[0].name, 'Irányítópult');
  assert.strictEqual(ds[0].exe, '{repo}\\Dashboard\\VRG Irányítópult.cmd');
});

test('D comes right after C in start.dev', () => {
  const keys = menu().start.dev.map(i => i.key);
  assert.strictEqual(keys.indexOf('D'), keys.indexOf('C') + 1);
});

test('no other START group uses D as a top-level key', () => {
  const st = menu().start;
  for (const [g, items] of Object.entries(st)) {
    if (!Array.isArray(items) || g === 'dev') continue;
    assert.ok(!items.some(i => i && i.key === 'D'), 'group ' + g + ' uses D');
  }
});

test('collect().startActs has s:D', () => {
  const acts = build.collect().startActs;
  assert.ok(acts['s:D']);
  assert.strictEqual(acts['s:D'].name, 'Irányítópult');
});

test('the launcher .cmd exists', () => {
  assert.ok(fs.existsSync(path.resolve(__dirname, '..', 'VRG Irányítópult.cmd')));
});
