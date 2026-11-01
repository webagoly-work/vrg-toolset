/* ring.js geometry and output, on a tiny DOM stand-in. The gallery covers real rendering. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

class Node {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.textContent = ''; this.className = ''; this.style = { setProperty() {} }; this.handlers = {}; this.classList = { add() {}, remove() {} }; }
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  replaceChildren() { this.children = []; }
  addEventListener(n, f) { this.handlers[n] = f; }
  all(pred, out = []) { for (const c of this.children) { if (pred(c)) out.push(c); c.all(pred, out); } return out; }
}

let R;
before(async () => {
  globalThis.document = { createElementNS: (ns, t) => new Node(t), createElement: (t) => new Node(t) };
  R = await import('../www/js/ring.js');
});

test('exports the seven primitives', () => {
  for (const name of ['ticks', 'sector', 'callout', 'reticle', 'branchTree', 'radar', 'vitals']) assert.equal(typeof R[name], 'function', name);
});

test('sector: an annular wedge with the large-arc flag when needed', () => {
  const small = R.sector(0, 0, 10, 20, 0, Math.PI / 2);
  assert.match(small, /^M20,0A20,20 0 0 1 /);
  assert.ok(small.endsWith('Z'));
  assert.match(R.sector(0, 0, 10, 20, 0, Math.PI * 1.5), /A20,20 0 1 1 /);
});

test('ticks: n segments', () => {
  const g = new Node('g');
  const path = R.ticks(g, { cx: 0, cy: 0, r: 10, n: 12, every: 3 });
  assert.equal(path.attrs.d.match(/M/g).length, 12);
});

test('callout: action buttons are real 48-unit targets and fire', () => {
  const g = new Node('g');
  let pressed = 0;
  R.callout(g, { x: 100, y: 100, title: 'A', actions: [{ label: 'B', onPress: () => pressed++ }] });
  const buttons = g.all((n) => n.attrs.role === 'button');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].attrs['aria-label'], 'B');
  assert.ok(buttons[0].children[0].attrs.height >= R.MIN_TARGET);
  buttons[0].handlers.click();
  buttons[0].handlers.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(pressed, 2);
});

test('branchTree: pick traces the path and reports it; hit areas reach 48 units', () => {
  const svg = new Node('svg');
  let info;
  const tree = R.branchTree(svg, ['a', 'b', 'c'], [{ name: 'x/y', fork: 1, commits: [{ label: 'one', hash: 'abc1234' }, 'two'], ahead: 2, behind: 1, dirty: true }], {
    labels: { main: 'M', dirty: 'D', aheadBehind: (b) => `+${b.ahead}` },
    onPick: (i) => { info = i; },
  });
  tree.pick('b0_0');
  assert.deepEqual([info.kind, info.label, info.hash, info.branch, info.index, info.total, info.dirty], ['branch', 'one', 'abc1234', 'x/y', 1, 2, true]);
  const hits = svg.all((n) => n.attrs.role === 'button');
  assert.equal(hits.length, 5);
  assert.ok(hits.every((n) => n.children[0].attrs.height >= R.MIN_TARGET));
  assert.match(svg.attrs.viewBox, /^0 0 \d+ \d+$/);
});

test('radar: one polygon, ghost when a base is given, and no fixed text', () => {
  const svg = new Node('svg');
  R.radar(svg, { axes: ['a', 'b', 'c'], values: [5, 10, 15], base: [1, 2, 3], showTotal: false });
  assert.equal(svg.all((n) => n.tag === 'polygon').length, 2);
  const svg2 = new Node('svg');
  R.radar(svg2, { axes: ['a', 'b', 'c'], values: [5, 10, 15] });
  assert.equal(svg2.all((n) => n.tag === 'polygon').length, 1);
});

test('vitals: shows the last value with its unit through the given formatter', () => {
  const box = new Node('div');
  const v = R.vitals(box, [{ key: 'cpu', label: 'CPU', unit: '%', lo: 0, hi: 100, value: 10 }], { format: (x) => `<${x}>` });
  v.update({ cpu: 42, other: 1 });
  assert.equal(box.children[0].children[1].textContent, '<42> %');
  assert.equal(box.children[0].children[2].children[0].attrs.points.split(' ').length, 24);
});
