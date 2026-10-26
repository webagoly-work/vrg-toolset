'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { KP_ACT, KP_WHY, kpStartPrompt } = require('../src/js/40-actions.js');
const SEED = require('../data/topology.json');

// the RCO block of 03_UI §5, one label per line; "A  /  B" is one toggle entry
function specLabels() {
  const ui = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'hub', '03_UI.md'), 'utf8');
  const sec = ui.slice(ui.indexOf('## 5. RCO'));
  const block = sec.slice(sec.indexOf('```') + 3, sec.indexOf('```', sec.indexOf('```') + 3));
  return block.split('\n').map(l => l.trim()).filter(l => l && !/^─+$/.test(l))
    .map(l => { const parts = l.split(/\s{2,}/); return parts[1] === '/' ? { label: parts[0], alt: parts[2] } : { label: parts[0] }; });
}

module.exports = [
  { name: 'every RCO label of 03_UI §5 is in KP_ACT, in order, string-exact', fn() {
    const spec = specLabels();
    const rco = KP_ACT.filter(a => a.at.includes('rco'));
    assert.strictEqual(spec.length, 13);
    assert.deepStrictEqual(rco.map(a => a.label), spec.map(s => s.label));
    for (const s of spec.filter(s => s.alt)) assert.strictEqual(rco.find(a => a.label === s.label).alt, s.alt);
  } },
  { name: 'Claude Code submenu: helyi | web | indító prompt másolása', fn() {
    assert.deepStrictEqual(KP_ACT.find(a => a.id === 'claude').sub.map(s => s.label), ['helyi', 'web', 'indító prompt másolása']);
  } },
  { name: 'companion actions carry the reason text of §5', fn() {
    assert.strictEqual(KP_WHY.companion, 'Ehhez fusson a Kapu segéd — indítsd a VRG Kapu.cmd-vel');
    for (const id of ['folder', 'term']) assert.strictEqual(KP_ACT.find(a => a.id === id).need, 'companion');
  } },
  { name: 'start prompt: a program hands out its agent init, its GO node the codephrase', fn() {
    const prog = SEED.programs.find(p => p.id === 'planner');
    assert.strictEqual(kpStartPrompt({ node: { kind: 'program' }, prog }),
      'Olvasd el a `docs/hub/agents/planner.md`-t, aztán dolgozzunk ezen: Varler Planner.');
    const go = prog.agent.find(a => a.go);
    assert.strictEqual(kpStartPrompt({ node: { kind: 'go', src: go }, prog }),
      '`GO R1018` — olvasd el a `GO-R1018.md`-t és csináld, amit ír.');
  } },
  { name: 'every live/dev program with a repo path has an agent init as its first AI doc', fn() {
    const want = SEED.programs.filter(p => /^(live|dev)$/.test(p.status) && ((p.open && p.open.repo) || ((p.git && p.git.paths) || []).length));
    assert.ok(want.length >= 24, String(want.length));
    for (const p of want) {
      assert.strictEqual(p.agent[0].repo, 'docs/hub/agents/' + p.id + '.md', p.id);
      assert.ok(fs.existsSync(path.join(__dirname, '..', '..', p.agent[0].repo)), p.id);
    }
  } }
];
