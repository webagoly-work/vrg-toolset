// WP-50 (one feature list for both apps, the Founder's ask of 2026-11-20): launcher/vrg-parity.json says how every Desktop unit
// is on the phone and every phone feature on the Desktop; tools/parity.js checks it and writes Dashboard/config/phone-cards.json;
// lib/catalog.js turns those cards into "phone:<feature>" items whose click shows a description card ({ do:'card' }).
// Reads the real files (read only); the catalog side runs on a small fake catalog, so it needs no registry or H: drive.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createCatalog, phoneItems } = require('../shell/lib/catalog.js');
const D = require('../shell/lib/desk.js');
const parity = require('../../tools/parity.js');

const REPO = path.resolve(__dirname, '..', '..');
const CARDS = path.join(REPO, 'Dashboard', 'config', 'phone-cards.json');
const P = JSON.parse(fs.readFileSync(path.join(REPO, 'launcher', 'vrg-parity.json'), 'utf8'));

test('parity.js --check: every Desktop unit and every phone feature has one valid line, the written files are current', () => {
  const out = execFileSync(process.execPath, [path.join(REPO, 'tools', 'parity.js'), '--check'], { encoding: 'utf8' });
  assert.match(out, /Rendben/);
});

test('the list covers both catalogs exactly', () => {
  const data = parity.load();
  assert.deepEqual(parity.check(data), []);
  assert.deepEqual(Object.keys(P.desk).sort(), data.units.map(u => u.id).sort());
  assert.deepEqual(Object.keys(P.phone).sort(), data.feats.map(f => f.id).sort());
  assert.ok(data.units.some(u => u.level === 'dev') && data.units.some(u => u.level === 'all'), 'every level, not only User');
});

test('grey is the Founder\'s list on both sides', () => {
  const greyPhone = Object.entries(P.desk).filter(([, e]) => e.phone === 'grey').map(([id]) => id).sort();
  assert.deepEqual(greyPhone, ['backup', 'desktop-exe', 'programs', 'toolbox', 'vscode', 'zen']);
  const greyDesk = Object.entries(P.phone).filter(([, e]) => e.desk === 'grey').map(([id]) => id).sort();
  assert.deepEqual(greyDesk, ['airdeck', 'net', 'pager', 'photo', 'screen']);
});

test('the check catches a missing line, a bad target and a gap without its work package', () => {
  const data = parity.load();
  const bad = JSON.parse(JSON.stringify(data.parity));
  delete bad.desk.planner;
  bad.desk.map = { phone: 'native', to: 'nope' };
  bad.phone.pager = { desk: 'gap', plan: 'x' };
  bad.phone.claude = { desk: 'full', to: 'not-a-unit' };
  const err = parity.check({ ...data, parity: bad }).join('\n');
  assert.match(err, /"planner".*has no line/);
  assert.match(err, /desk\.map: native to "nope"/);
  assert.match(err, /phone\.pager: gap without wp/);
  assert.match(err, /phone\.claude: full to "not-a-unit"/);
});

test('phone-cards.json: the grey and gap phone features, each with its text', () => {
  const j = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
  const want = Object.entries(P.phone).filter(([, e]) => e.desk !== 'full').map(([id]) => 'phone:' + id).sort();
  assert.deepEqual(j.cards.map(c => c.id).sort(), want);
  for (const c of j.cards) {
    assert.ok(c.hu && c.about && c.glyph, c.id);
    if (c.state === 'grey') assert.ok(c.why && !c.wp, c.id);
    else assert.ok(c.plan && /^WP-\d+$/.test(c.wp) && c.wpHu, c.id);
  }
});

test('the catalog shows them as tiles that open a card, never a window or an act', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wp50-'));
  const file = path.join(dir, 'cat.json');
  fs.writeFileSync(file, JSON.stringify({
    types: { application: {}, 'phone feature': { hu: 'Telefonos funkció', en: 'Phone feature' } },
    groups: { alkalmazasok: { hu: 'Alkalmazások', en: 'Applications', subs: { telefon: 'A telefonról' } } },
    sections: { telefon: { hu: 'A telefon funkciói', en: 'Phone features', level: 'user' } },
    items: [{ id: 'a', title: { hu: 'A', en: 'A' }, type: 'application', level: 'user', group: 'alkalmazasok', status: 'live', launch: {} }],
  }));
  const cat = createCatalog({ file, cards: CARDS });
  cat.load();
  assert.deepEqual(cat.errors(), [], 'the cards never reach validate');
  const list = cat.listFor('user');
  const pager = list.find(i => i.id === 'phone:pager');
  assert.ok(pager, 'Csipogó is on the Desktop');
  assert.equal(pager.card, 'grey');
  assert.equal(pager.opens, true, 'clickable: it opens its card');
  assert.equal(pager.win, false);
  assert.match(pager.label, /^Phone feature · VRG Mobile M33/);
  const r = cat.resolve('phone:pager');
  assert.equal(r.do, 'card');
  assert.equal(r.card.state, 'grey');
  assert.ok(r.card.about && r.card.why);
  const pulse = cat.resolve('phone:pulse');
  assert.equal(pulse.card.state, 'gap');
  assert.equal(pulse.card.wp, 'WP-51');
  assert.equal(cat.appTarget('phone:pager', { repo: REPO, expand: s => s }), null);
  const secs = D.sections(list, 'user', { telefon: { hu: 'A telefon funkciói', en: 'Phone features', level: 'user' } }, {});
  assert.ok(secs.find(s => s.id === 'telefon').items.includes('phone:pager'));
  const tree = D.suiTree(list, 'user', { alkalmazasok: { hu: 'Alkalmazások', en: 'Applications', subs: { telefon: 'A telefonról' } } });
  const leaves = D.leaves(tree);
  assert.equal(leaves.find(l => l.id === 'phone:pager').card, 'grey', 'the ◣ menu marks it');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a broken or missing cards file adds nothing and breaks nothing', () => {
  assert.deepEqual(phoneItems(''), []);
  assert.deepEqual(phoneItems(path.join(os.tmpdir(), 'no-such-vrg-cards.json')), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrg-wp50b-'));
  const f = path.join(dir, 'c.json');
  fs.writeFileSync(f, JSON.stringify({ cards: [{ id: '../x', state: 'grey' }, { id: 'phone:ok', state: 'weird' }, { id: 'phone:good', state: 'gap', hu: 'G' }] }));
  assert.deepEqual(phoneItems(f).map(i => i.id), ['phone:good']);
  fs.rmSync(dir, { recursive: true, force: true });
});
