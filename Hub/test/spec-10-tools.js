'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { kpLoad } = require('./load');

const REPO = path.resolve(__dirname, '..', '..');
const DIST = path.join(REPO, 'Hub', 'dist', 'vrg-kapu.html');
const embedded = () => JSON.parse(fs.readFileSync(DIST, 'utf8').match(/id="kpTools">(.*?)<\/script>/)[1]);

// a gate context: GitHub state and the list verdict are set by hand
function gate(gh, l1) {
  const ctx = kpLoad(['00-core.js', '10-tools.js', '50-github.js', '60-access.js', '90-gate.js'], { localStorage: null });
  Object.assign(ctx.kpGh, gh);
  ctx.kpAccess.valid = l1;
  ctx.kpAccess.me = l1 ? { layers: ['L1'] } : null;
  return ctx;
}

module.exports = [
  { name: 'kpTools: every START.cmd entry up to TOOLCOUNT, with its menu key, and every path exists', fn() {
    const cmd = fs.readFileSync(path.join(REPO, 'Planner', 'START.cmd'), 'utf8');
    const count = +cmd.match(/^set "TOOLCOUNT=(\d+)"/m)[1];
    const tools = embedded();
    assert.strictEqual(tools.length, count);
    assert.deepStrictEqual(tools.map(t => t.key).slice(0, 11), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'K'].slice(0, count));
    for (const t of tools) {
      assert.ok(cmd.includes('set "T' + t.n + '_NAME=' + t.name + '"'), t.name);
      assert.ok(fs.existsSync(path.join(REPO, t.path)), t.path);
      assert.strictEqual(t.dir, path.posix.dirname(t.path));
    }
  } },
  { name: 'kpToolHref: two levels up from Hub/dist, each segment encoded', fn() {
    const { kpToolHref } = kpLoad(['10-tools.js']);
    assert.strictEqual(kpToolHref({ path: 'Planner/projects/a b/x.html' }), '../../Planner/projects/a%20b/x.html');
  } },
  { name: 'gate: no token -> login; token, no answer -> checking; on the list -> open; off it -> closed', fn() {
    assert.strictEqual(gate({ token: null }, false).kpGateState(), 'login');
    assert.strictEqual(gate({ token: 'ghp_x', login: null, error: null }, false).kpGateState(), 'checking');
    assert.strictEqual(gate({ token: 'ghp_x', login: null, error: 'A token lejárt vagy hibás' }, false).kpGateState(), 'login');
    assert.strictEqual(gate({ token: 'ghp_x', login: 'member-login' }, true).kpGateState(), 'open');
    assert.strictEqual(gate({ token: 'ghp_x', login: 'stranger' }, false).kpGateState(), 'closed');
  } }
];
