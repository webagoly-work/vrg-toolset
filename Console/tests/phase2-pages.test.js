import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { evaluate } from '../www/js/core/expr.js';
import { convert } from '../www/js/core/units.js';
import { sunTimes } from '../www/js/core/sun.js';
import { createBridge, runArg } from '../www/js/core/bridge.js';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '../www/data');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('calculator: precedence, brackets, functions, comma', () => {
  assert.equal(evaluate('2+3*4'), 14);
  assert.equal(evaluate('(2+3)*4'), 20);
  assert.equal(evaluate('2^3^2'), 512);
  assert.equal(evaluate('-2^2'), -4);
  assert.equal(evaluate('50%*200'), 100);
  assert.equal(evaluate('1,5+1,5'), 3);
  near(evaluate('sin(90)'), 1);
  near(evaluate('sqrt(16)'), 4);
  near(evaluate('2π'), 2 * Math.PI);
  assert.equal(evaluate('6÷2×3'), 9);
});

test('calculator: typed text can never run as code', () => {
  for (const bad of ['alert(1)', 'constructor', '2+', '(1', 'process.exit()', '1;2']) assert.throws(() => evaluate(bad));
});

test('unit conversion', () => {
  near(convert(1, 'length', 'm', 'mm'), 1000);
  near(convert(1, 'energy', 'kWh', 'J'), 3.6e6);
  near(convert(100, 'temperature', '°C', '°F'), 212);
  near(convert(0, 'temperature', '°C', 'K'), 273.15);
});

test('the offline ServiceKit data is complete', () => {
  const load = (name) => {
    const window = {};
    vm.runInNewContext(fs.readFileSync(path.join(DATA, name + '.js'), 'utf8'), { window });
    return window;
  };
  assert.equal(load('commands').KIT_COMMANDS.commands.length, 329);
  assert.equal(load('sugo').KIT_SUGO.entries.length, 48);
  assert.equal(load('playbooks').KIT_PLAYBOOKS.playbooks.length, 12);
});

class FakeWs {
  constructor() { this.readyState = 1; this.sent = []; FakeWs.last = this; }
  send(line) { this.sent.push(line.trim()); }
  close() { this.onclose?.(); }
  feed(line) { this.onmessage({ data: line + '\n' }); }
}

test('bridge: open connection, capabilities, macros, ack', async () => {
  const b = createBridge(FakeWs);
  b.connect({ host: '127.0.0.1', port: 47814 });
  const ws = FakeWs.last;
  ws.feed('HELLO|PC|1|open');
  ws.feed('CAPS|1|win');
  ws.feed('MAC|a|Egy|0|net');
  ws.feed('MAC|b|Ket|1|sys');
  ws.feed('MACEND');
  assert.equal(b.state.status, 'on');
  assert.equal(b.state.allowRun, true);
  assert.deepEqual(b.state.macros.map((m) => m.danger), [false, true]);
  assert.ok(ws.sent.includes('MACROS'));
  const done = b.runMacro('b', true);
  assert.equal(ws.sent.at(-1), 'MACRO|b|1|c1');
  ws.feed('ACK|c1|1|0');
  assert.deepEqual(await done, { ok: true, detail: '0' });
});

test('bridge: a token is needed off-loopback and a wrong one is reported', () => {
  const b = createBridge(FakeWs);
  b.connect({ host: '10.0.0.2', port: 47814 });
  FakeWs.last.feed('HELLO|PC|1|auth');
  assert.equal(b.state.status, 'auth');
  b.connect({ host: '10.0.0.2', port: 47814, pairing: '123456' });
  FakeWs.last.feed('HELLO|PC|1|auth');
  assert.equal(FakeWs.last.sent.at(-1), 'AUTH|123456');
  FakeWs.last.feed('AUTHFAIL');
  assert.equal(b.state.status, 'auth');
  assert.equal(b.state.last, 'authfail');
});

test('bridge: a dropped connection clears run rights', () => {
  const b = createBridge(FakeWs);
  b.connect({ host: 'h', port: 1 });
  FakeWs.last.feed('HELLO|PC|1|open');
  FakeWs.last.feed('CAPS|1|win');
  FakeWs.last.close();
  assert.equal(b.state.status, 'off');
  assert.equal(b.state.allowRun, false);
});

test('run argument matches what the bridge parses', () => {
  const arg = runArg('dir "C:\\é"', 'ps');
  const b64 = arg.match(/b64:(.*)$/)[1];
  assert.equal(Buffer.from(b64, 'base64').toString('utf8'), 'dir "C:\\é"');
  assert.match(arg, /^kind:ps;confirm:1;b64:/);
});

test('sun times: Budapest midsummer, a polar day and night', () => {
  const s = sunTimes(new Date(2026, 5, 21, 12), 47.5, 19.04);
  const utc = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();
  assert.ok(Math.abs(utc(s.rise) - 166) < 6, 'rise ' + s.rise.toISOString());
  assert.ok(Math.abs(utc(s.set) - 1125) < 6, 'set ' + s.set.toISOString());
  assert.equal(sunTimes(new Date(2026, 5, 21, 12), 78, 15).polar, 'day');
  assert.equal(sunTimes(new Date(2026, 11, 21, 12), 78, 15).polar, 'night');
});
