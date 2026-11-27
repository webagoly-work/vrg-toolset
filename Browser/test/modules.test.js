// modules.test.js — T8: Browser/modules.json, the parts as plugins. The manifest is checked against the files (what they
// call, open and keep), a build leaves a plugin out cleanly, and the app refuses a route no part declared.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const M = require('../lib/modules.js');
const B = require('../build.js');

const SRC = path.join(__dirname, '..', 'src');

test('modules.json: checked, every source file in one part, the load order unchanged', () => {
  const m = M.load();
  const r = M.resolve(m);
  assert.deepEqual(r.order, B.ORDER);
  assert.deepEqual(new Set(r.order), new Set(M.sources(path.join(__dirname, '..'))), 'every file under src/ is built');
  assert.equal(r.order[r.order.length - 1], 'app/main.js', 'main boots last');
  assert.ok(r.mods.parts.filter(p => p.kind === 'plugin').length >= 4);
  // what reaches the network: a short list, each with its hosts
  const net = r.mods.parts.filter(p => p.needs.includes('net')).map(p => p.id).sort();
  assert.deepEqual(net, ['app.context', 'app.omnibox', 'app.views', 'core.sync', 'knowledge', 'work']);
  assert.deepEqual(r.mods.parts.filter(p => p.hosts.includes('*')).map(p => p.id), ['core.host'], 'only the host opens any page');
  assert.deepEqual(r.mods.parts.filter(p => p.needs.includes('storage')).map(p => p.id).sort(), ['app.main', 'core.store', 'knowledge', 'work']);
});

test('the check: each rule catches its mistake', () => {
  const files = { 'a.js': 'fetch("/api/x")', 'b.js': 'window.open(u)', 'c.js': 'root.localStorage', 'd.js': '// fetch( in a comment\nconst x = 1;', 'e.js': "post('/api/y')" };
  const read = f => { if (!(f in files)) throw new Error('no'); return files[f]; };
  const base = () => ({ format: M.FORMAT, v: 1, parts: [
    { id: 'core.a', kind: 'core', hu: 'A', files: ['d.js'], needs: [], nav: [{ route: '', hu: 'Kezdőlap', icon: 'home', view: 'home', at: 0 }] }] });
  const one = part => { const m = base(); m.parts.push(part); return M.check(m, read); };
  assert.deepEqual(M.check(base(), read), [], 'a comment is not code');
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['a.js'], needs: [] }).join(), /calls fetch\( but the part does not need net/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['a.js'], needs: ['net'], hosts: ['self'] }).join(), /calls \/api\/x, which neither/);
  assert.deepEqual(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['a.js'], needs: ['net'], hosts: ['self'], api: ['/api/x'] }), []);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['b.js'], needs: [] }).join(), /opens pages but the part does not need web/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['c.js'], needs: [] }).join(), /localStorage but the part does not need storage/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['a.js'], needs: ['net'], hosts: ['*'], api: ['/api/x'] }).join(), /\* is for web/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['b.js'], needs: ['web'] }).join(), /net \/ web name their hosts/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['zz.js'], needs: [] }).join(), /zz\.js does not exist/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['d.js'], needs: [] }).join(), /d\.js is already in core\.a/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', files: ['e.js'], needs: [] }).join(), /says what it is/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['e.js'], needs: ['camera'] }).join(), /need camera/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['e.js'], needs: [], requires: ['later'] }).join(), /requires later/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['e.js'], needs: [], nav: [{ route: 'x', hu: 'X', icon: 'x', view: 'x', at: 0 }] }).join(), /at is a free whole number/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['e.js'], needs: [], switches: [{ id: 's', hu: 'S', desc: 'd', on: 'yes' }] }).join(), /on is true or false/);
  assert.match(one({ id: 'p', kind: 'plugin', hu: 'P', desc: 'd', files: ['e.js'], needs: [], nav: [{ route: 'x', hu: 'X', icon: 'x', view: 'x', at: 5, module: 'nope' }] }).join(), /module nope is not a switch/);
  assert.deepEqual(M.check({ format: 'x', v: 1, parts: [] }, read), ['format is not vrg.browser-modules']);
  assert.deepEqual(M.check({ format: M.FORMAT, v: 2, parts: [] }, read), ['v 2 is not 1']);
});

test('resolve: a plugin leaves with its files, switches, nav and routes; core stays', () => {
  const m = M.load();
  const r = M.resolve(m, ['work', 'knowledge']);
  assert.ok(!r.order.includes('app/work.js') && !r.order.includes('app/knowledge.js'));
  assert.ok(!r.mods.switches.some(s => ['jobs', 'parts', 'research', 'watch'].includes(s.id)));
  assert.ok(!r.mods.nav.some(n => ['munkak', 'alkatreszek', 'kutatas', 'figyeles'].includes(n.route)));
  assert.ok(!('/api/jobs' in r.mods.api) && !('/api/research' in r.mods.api) && !('/__vrg/claude' in r.mods.api));
  assert.deepEqual(r.mods.without, ['knowledge', 'work']);
  assert.throws(() => M.resolve(m, ['core.store']), /core and is always built/);
  assert.throws(() => M.resolve(m, ['nope']), /no part nope/);
  const html = B.build({ without: ['answers', 'qr'] });
  assert.ok(!html.includes('/* ---- src/core/answers.js') && !html.includes('/* ---- src/vendor/qr.js'));
  assert.ok(html.includes('/* ---- src/app/work.js'));
});

// the runtime gate, in a VM with the core scripts (no DOM needed for context.create)
function vmCtx(without) {
  const calls = [];
  const sandbox = { console, URL, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, AbortController,
    fetch: async (u, init) => { calls.push(String(u)); return { ok: true, status: 200, json: async () => ({ ok: true, hits: [], list: [] }) }; } };
  sandbox.globalThis = sandbox; sandbox.window = undefined;
  vm.createContext(sandbox);
  for (const f of ['core/engine.js', 'core/url.js', 'core/links.js', 'core/store.js', 'core/host.js', 'app/context.js'])
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });
  const data = Object.assign(B.data(), { mods: M.resolve(M.load(), without).mods });
  const st = sandbox.VB.store.create(null);
  const ctx = sandbox.VB.context.create({ store: st, data, kind: 'served' });
  return { ctx, st, calls };
}
test('the app refuses a route no built part declares, and one whose module is off', async () => {
  const { ctx, st, calls } = vmCtx([]);
  assert.equal((await ctx.api('/api/secret')).code, 'module');
  assert.equal((await ctx.post('/api/secret', {})).code, 'module');
  assert.equal((await ctx.api('/api/suggest', { q: 'x' })).code, 'off', 'Webes javaslatok is off by default');
  assert.equal(calls.length, 0, 'nothing was sent');
  assert.equal((await ctx.api('/api/docs', { q: 'x' })).ok, true);
  assert.deepEqual(calls, ['/api/docs?q=x']);
  st.setModule('docs', false);
  assert.equal((await ctx.api('/api/docs', { q: 'x' })).code, 'off');
  assert.equal((await ctx.api('/api/jobs/AB12/export')).ok, true, 'a sub-route of a declared route');
  const w = vmCtx(['work']);
  assert.equal((await w.ctx.api('/api/jobs')).code, 'module', 'the route left with its part');
  assert.equal(w.ctx.on('jobs'), false);
  assert.equal(w.ctx.built('work'), false);
  assert.equal(w.ctx.built('core.store'), true);
});
