// WP-02: lib/acts.js loads without Electron; the id grammar and the dry plans are unchanged.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os'), path = require('path');
const build = require('../build.js');
const { createRegistry } = require('../shell/lib/registry.js');
const { createRunner } = require('../shell/lib/runbat.js');
const { createPorts } = require('../shell/lib/ports.js');
const { createActs } = require('../shell/lib/acts.js');

const fakeShell = { openPath() { throw new Error('opened for real'); }, openExternal() { throw new Error('opened for real'); } };
const R = createRegistry({ build });
R.load();
const run = createRunner({ R, shell: fakeShell, tmp: path.join(os.tmpdir(), 'VRG', 'desk-test-wp02') });
const ports = createPorts({ R, run });
const acts = createActs({ R, run, ports });

test("lookup('s:C/1') resolves", () => {
  const hit = acts.lookup('s:C/1');
  assert.ok(hit && hit.item);
});

test('bad ids are refused', async () => {
  const bad = ['../../Windows/System32/calc.exe', 'f:p1:99', 's:Q', 's:S', 'srv:nope', 'line:../x', 'x'.repeat(81), 'x', 42, null];
  for (const id of bad) {
    assert.strictEqual(acts.lookup(id), null, 'lookup ' + String(id));
    run.dry = [];
    const r = await acts.runAct(id);
    assert.strictEqual(r.ok, false, 'runAct ' + String(id));
    assert.strictEqual(run.dry.length, 0, 'plan for ' + String(id));
    run.dry = null;
  }
});

test('runAct srv:planner plans a bat or a url in dry mode', async () => {
  const hit = acts.lookup('srv:planner');
  assert.ok(hit && hit.item.server === 'planner');
  run.dry = [];
  const s = R.server('planner');
  const r = await acts.runAct('srv:planner');
  const plan = run.dry; run.dry = null;
  assert.strictEqual(r.ok, true);
  assert.strictEqual(plan.length >= 1, true);
  const p = plan[0];
  if (p.url) assert.strictEqual(p.url, R.serverUrl(s));
  else {
    assert.deepStrictEqual(Object.keys(p).sort(), ['bat', 'cwd', 'lines', 'mode']);
    assert.strictEqual(p.mode, 'min');
    assert.strictEqual(p.bat, String(s.port));
    assert.ok(Array.isArray(p.lines) && p.lines.length >= 1);
  }
});

test('runBat in dry mode collects the plan and strips title metacharacters', () => {
  run.dry = [];
  run.runBat('a&b|c', 'C:\\x', ['echo hi'], 'start');
  const plan = run.dry; run.dry = null;
  assert.deepStrictEqual(plan, [{ bat: 'abc', mode: 'start', cwd: 'C:\\x', lines: ['echo hi'] }]);
});
