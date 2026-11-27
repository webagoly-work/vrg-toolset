// WP-58 Kéz: the hands over a fake PowerShell helper that speaks act-host.ps1's protocol. Nothing here touches a real window.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { EventEmitter } = require('events');
const H = require('../hands.js');
const { createHands, classify, matchTarget, RULES, parsePhrase } = H;

// ------------------------------------------------------------ the fake helper
const WIN = {
  100: { hwnd: 100, pid: 500, process: 'chrome', title: 'Beállítások - Google Chrome', state: 'normal' },
  200: { hwnd: 200, pid: 600, process: 'Code', title: 'main.js - Planner_VRG_U100 - Visual Studio Code', state: 'normal' },
  300: { hwnd: 300, pid: 700, process: 'TOTALCMD64', title: 'Total Commander', state: 'normal' },
  400: { hwnd: 400, pid: 800, process: 'KeePassXC', title: 'Passwords.kdbx - KeePassXC', state: 'normal' },
  500: { hwnd: 500, pid: 999, process: 'VRG Desktop', title: 'VRG Asztal', state: 'normal' },
  600: { hwnd: 600, pid: 1000, process: 'mmc', title: 'Rendszergazda: Számítógép-kezelés', state: 'normal', elevated: true },
  700: { hwnd: 700, pid: 1100, process: 'setup-x64', title: 'Telepítő', state: 'normal' },
};
function items100() {
  const b = (rid, name, role, pat, extra) => ({ rid, role, name, aid: '', enabled: true, pw: false, off: false, focus: false, pat, toggle: '', expand: '', selected: null, vscroll: -1, window: '', rect: [0, 0, 80, 24], ...extra });
  return [
    b('1', 'Beállítások - Google Chrome', 'Window', ['window'], { window: 'normal' }),
    b('2', 'Mentés', 'Button', ['invoke']), b('3', 'Mentés másként', 'Button', ['invoke']), b('4', 'OK', 'Button', ['invoke']),
    b('5', 'Mégse', 'Button', ['invoke']), b('6', 'Törlés', 'Button', ['invoke']), b('7', 'Küldés', 'Button', ['invoke']),
    b('8', 'Emlékezz rám', 'CheckBox', ['toggle'], { toggle: 'off' }),
    b('9', 'Általános', 'TabItem', ['select'], { selected: true }), b('10', 'Speciális', 'TabItem', ['select'], { selected: false }), b('11', 'Biztonság', 'TabItem', ['select'], { selected: false }),
    b('12', 'Súgó', 'Hyperlink', ['invoke']), b('13', 'Fájl', 'MenuItem', ['expand', 'invoke'], { expand: 'collapsed' }),
    b('14', 'Tartalom', 'Pane', ['scroll'], { vscroll: 0, rect: [0, 0, 900, 700], focus: true }), b('15', 'Oldalsáv', 'Pane', ['scroll'], { vscroll: 0, rect: [0, 0, 200, 700] }),
    b('16', 'Értesítések bekapcsolása', 'CheckBox', ['toggle'], { toggle: 'on', enabled: false }),
    b('17', 'Jelszó mentése', 'Button', ['invoke'], { pw: true }),
    b('18', 'Nyomtatás beállítása', 'Button', ['invoke']), b('19', 'Nyomtatás előnézete', 'Button', ['invoke']),
  ];
}
function fakeEnv(opts = {}) {
  const st = { fg: 100, items: items100(), windows: JSON.parse(JSON.stringify(WIN)), reqs: [], spawns: 0, hang: null, kills: 0 };
  const spawn = () => {
    st.spawns++;
    const p = new EventEmitter();
    p.stdout = new EventEmitter(); p.stderr = new EventEmitter();
    p.kill = () => { st.kills++; setImmediate(() => p.emit('exit', 1)); };
    const reply = (id, body) => setImmediate(() => p.stdout.emit('data', Buffer.from(JSON.stringify({ id, ...body }) + '\n')));
    p.stdin = { write: line => {
      const r = JSON.parse(line); st.reqs.push(r);
      if (st.hang && st.hang(r)) return true;
      const win = h => (h ? st.windows[h] : st.windows[st.fg]);
      if (r.op === 'ping') return reply(r.id, { ok: true, pong: true });
      if (r.op === 'quit') return reply(r.id, { ok: true, bye: true });
      if (r.op === 'windows') return reply(r.id, { ok: true, fg: st.fg, windows: Object.values(st.windows).map(w => ({ hwnd: w.hwnd, pid: w.pid, process: w.process, title: w.title, min: w.state === 'minimized' })) });
      if (r.op === 'find') {
        const w = win(r.hwnd);
        if (!w) return reply(r.id, { ok: false, err: 'no-window' });
        if (w.elevated) return reply(r.id, { ok: false, err: 'elevated', msg: 'access denied' });
        const items = w.hwnd === 100 ? st.items : [{ rid: 'w' + w.hwnd, role: 'Window', name: w.title, pat: ['window'], enabled: true, pw: false, window: w.state, rect: [0, 0, 1, 1] }];
        return reply(r.id, { ok: true, win: { hwnd: w.hwnd, pid: w.pid, process: w.process, title: w.title, state: w.state }, fg: st.fg, items, truncated: false, ms: 30 });
      }
      if (r.op === 'do') {
        const w = st.windows[r.hwnd];
        if (!w) return reply(r.id, { ok: false, err: 'stale' });
        if (r.verb === 'focus-window') { const before = st.fg; st.fg = r.hwnd; return reply(r.id, { ok: true, before: { fg: before }, after: { fg: st.fg }, ms: 20 }); }
        if (r.fg && st.fg !== r.hwnd) return reply(r.id, { ok: false, err: 'stale' });
        if (r.verb === 'window') {
          const before = { window: w.state, exists: true };
          if (r.arg === 'close') { delete st.windows[r.hwnd]; return reply(r.id, { ok: true, before, after: { exists: false }, ms: 20 }); }
          w.state = { minimize: 'minimized', maximize: 'maximized', restore: 'normal' }[r.arg];
          return reply(r.id, { ok: true, before, after: { exists: true, window: w.state }, ms: 20 });
        }
        const el = st.items.find(i => i.rid === r.rid);
        if (!el) return reply(r.id, { ok: false, err: 'gone' });
        if (el.pw) return reply(r.id, { ok: false, err: 'password' });
        const snap = () => ({ exists: true, toggle: el.toggle, expand: el.expand, selected: el.selected, vscroll: el.vscroll });
        const before = snap();
        if (r.verb === 'toggle') el.toggle = el.toggle === 'on' ? 'off' : 'on';
        if (r.verb === 'select') { st.items.filter(i => i.role === 'TabItem').forEach(i => { i.selected = false; }); el.selected = true; }
        if (r.verb === 'expand') el.expand = 'expanded';
        if (r.verb === 'collapse') el.expand = 'collapsed';
        if (r.verb === 'scroll') el.vscroll = Math.min(100, el.vscroll + 10);
        const after = r.verb === 'invoke' && opts.invokeRemoves ? { exists: false } : snap();
        return reply(r.id, { ok: true, before, after, ms: 25 });
      }
      return reply(r.id, { ok: false, err: 'bad-request' });
    } };
    return p;
  };
  let t = 1_000_000;
  const appended = [];
  const hands = createHands({ spawn, powershell: 'powershell.exe', ownPids: () => [999], now: () => t, timeoutMs: opts.timeoutMs || 300, append: e => appended.push(e), policy: opts.policy });
  return { st, hands, tick: ms => { t += ms; }, appended };
}

// ------------------------------------------------------------ matchTarget
test('matchTarget: ≥ 25 spoken phrases, hu + en, misrecognitions, ordinals, ambiguity', () => {
  const items = items100().filter(i => i.role !== 'Window');
  const pick = (said, o) => { const m = matchTarget(items, said, o); return m.ok ? m.item.name : m.err + (m.choices ? ':' + m.choices.join('|') : ''); };
  const cases = [
    ['kattints a mentésre', 'Mentés'], ['nyomd meg a mentés gombot', 'Mentés'], ['kattints a nyomtatásra', 'ambiguous:Nyomtatás beállítása|Nyomtatás előnézete'],
    ['Mentés', 'Mentés'], ['mentés másként', 'Mentés másként'], ['kattints a mentés másként-re', 'Mentés másként'],
    ['nyomd meg az OK-t', 'OK'], ['click OK', 'OK'], ['ok gomb', 'OK'], ['mégse', 'Mégse'], ['kattints a megse gombra', 'Mégse'],
    ['pipáld be az emlékezz rám-ot', 'Emlékezz rám'], ['emlekezz ram', 'Emlékezz rám'], ['tick remember me', 'not-found'],
    ['a második fül', 'Speciális'], ['az első fül', 'Általános'], ['az utolsó fül', 'Biztonság'], ['menj a speciális fülre', 'Speciális'],
    ['válaszd a biztonság fület', 'Biztonság'], ['kattints a súgóra', 'Súgó'], ['nyisd ki a fájl menüt', 'Fájl'],
    ['spécialis', 'Speciális'], ['bizonság', 'Biztonság'], ['altalanos', 'Általános'], ['click the save button', 'not-found'],
    ['kattints a nemlétező gombra', 'not-found'], ['', 'not-found'], ['a', 'not-found'], ['törlés gomb', 'Törlés'], ['töröld', 'not-found'],
  ];
  assert.ok(cases.length >= 25);
  for (const [said, want] of cases) assert.strictEqual(pick(said), want, said);
  // a role narrows: "mentés" among buttons only
  assert.strictEqual(pick('első', { role: 'tab' }), 'Általános');
  assert.deepStrictEqual(parsePhrase('kattints a második gombra'), { words: [], role: 'button', ordinal: 2 });
  // windows by app name and title ("VS Code" is the friendly name of 'Code')
  const wins = [{ name: 'Chrome Beállítások - Google Chrome', role: 'Window' }, { name: 'VS Code main.js - Planner_VRG_U100 - Visual Studio Code', role: 'Window' }, { name: 'Total Commander Total Commander', role: 'Window' }];
  assert.strictEqual(matchTarget(wins, 'válts a VS Code-ra', { role: 'window' }).item.name, wins[1].name);
  assert.strictEqual(matchTarget(wins, 'total commander', { role: 'window' }).item.name, wins[2].name);
  assert.strictEqual(matchTarget(wins, 'hozd előre a chromeot', { role: 'window' }).item.name, wins[0].name);
});

// ------------------------------------------------------------ classify
test('classify: own and elevated first; password fields, blocked apps and names win over every verb class', () => {
  const t = (name, extra) => ({ verb: 'invoke', app: 'chrome', target: { name, role: 'Button' }, ...extra });
  assert.strictEqual(classify(t('OK', { own: true })).risk, 'own');
  assert.strictEqual(classify(t('OK', { elevated: true })).risk, 'elevated');
  assert.strictEqual(classify({ verb: 'scroll', app: 'chrome', target: { name: 'Jelszó', role: 'Edit', pw: true } }).risk, 'blocked');
  for (const app of ['consent', 'KeePassXC', 'msiexec', 'setup-x64', 'Uninstall_Tool', 'mmc', 'powershell']) assert.strictEqual(classify({ verb: 'scroll', app, target: { name: 'x' } }).risk, 'blocked', app);
  for (const name of ['Törlés', 'Kosár törlése', 'Delete', 'Remove', 'Küldés', 'Elküldés', 'Send', 'Submit', 'Fizetés', 'Pay now', 'Megrendelés', 'Átutalás', 'Jóváhagyás',
    'Elfogadom', 'Accept all', 'Engedélyezés', 'Allow', 'Kijelentkezés', 'Sign out', 'Visszaállítás alapra', 'Reset', 'Telepítés', 'Install', 'Formázás', 'Discard changes', 'Force push'])
    assert.strictEqual(classify(t(name)).risk, 'blocked', name);
  for (const name of ['OK', 'Mentés', 'Mégse', 'Bezárás', 'Posta', 'Beállítások', 'Border style', 'Jelölés'])
    assert.strictEqual(classify(t(name)).risk, 'confirm', name);
  assert.strictEqual(classify({ verb: 'scroll', app: 'chrome', target: { name: 'Tartalom' } }).risk, 'reversible');
  assert.strictEqual(classify({ verb: 'select', app: 'chrome', target: { name: 'Speciális', role: 'TabItem' } }).risk, 'reversible');
  assert.strictEqual(classify({ verb: 'invoke', app: 'chrome', target: { name: 'Speciális', role: 'TabItem' } }).risk, 'reversible');
  assert.strictEqual(classify({ verb: 'toggle', app: 'chrome', target: { name: 'Emlékezz rám', role: 'CheckBox' } }).risk, 'confirm');
  assert.strictEqual(classify({ verb: 'window', arg: 'close', app: 'chrome', target: { name: 'Chrome' } }).risk, 'confirm');
  assert.strictEqual(classify({ verb: 'window', arg: 'minimize', app: 'chrome', target: { name: 'Chrome' } }).risk, 'reversible');
  assert.strictEqual(classify({ verb: 'focus-window', app: 'Code', target: { name: 'VS Code' } }).risk, 'reversible');
  assert.strictEqual(classify({ verb: 'type', app: 'chrome', target: { name: 'x' } }).risk, 'blocked');
  assert.ok(RULES.blockedNames.includes('torl') && RULES.verbs.window.close === 'confirm');
});

// ------------------------------------------------------------ plan → act
test('plan → act: invoke, toggle (verified), select a tab, expand, scroll, window state, focus-window; the log holds names only', async () => {
  const { hands, st, appended } = fakeEnv();
  let r = await hands.plan({ verb: 'invoke', target: 'nyomd meg az OK-t' });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual([r.plan.risk, r.plan.say, r.plan.app, r.plan.target], ['confirm', 'Rákattintsak: OK?', 'chrome', { name: 'OK', role: 'Button' }]);
  let a = await hands.act(r.plan.id);
  assert.deepStrictEqual([a.ok, a.say, a.verified], [true, 'Kész: OK.', null]);
  r = await hands.plan({ verb: 'toggle', target: 'emlékezz rám' });
  a = await hands.act(r.plan.id);
  assert.deepStrictEqual([a.ok, a.verified, st.items.find(i => i.rid === '8').toggle], [true, true, 'on']);
  r = await hands.plan({ verb: 'select', target: 'a második fül', role: 'tab' });
  assert.deepStrictEqual([r.plan.risk, r.plan.say], ['reversible', 'Kiválasztás: Speciális.']);
  assert.strictEqual((await hands.act(r.plan.id)).verified, true);
  r = await hands.plan({ verb: 'expand', target: 'fájl menü' });
  assert.strictEqual((await hands.act(r.plan.id)).verified, true);
  r = await hands.plan({ verb: 'scroll', arg: 'page-down' });
  assert.deepStrictEqual([r.plan.target.name, r.plan.say], ['Tartalom', 'Görgetés egy oldalt le.']);
  assert.strictEqual((await hands.act(r.plan.id)).verified, true);
  r = await hands.plan({ verb: 'window', arg: 'maximize' });
  assert.strictEqual(r.plan.risk, 'reversible');
  assert.deepStrictEqual([(await hands.act(r.plan.id)).verified, st.windows[100].state], [true, 'maximized']);
  r = await hands.plan({ verb: 'focus-window', window: 'válts a VS Code-ra' });
  assert.deepStrictEqual([r.ok, r.plan.risk, r.plan.say], [true, 'reversible', 'Előre: VS Code.']);
  assert.deepStrictEqual([(await hands.act(r.plan.id)).verified, st.fg], [true, 200]);
  r = await hands.plan({ verb: 'window', arg: 'close' });
  assert.deepStrictEqual([r.plan.risk, r.plan.say], ['confirm', 'Bezárjam: VS Code?']);
  assert.strictEqual((await hands.act(r.plan.id)).verified, true);
  assert.ok(!st.windows[200]);
  const log = hands.log();
  assert.strictEqual(log.length, 8);
  assert.deepStrictEqual(Object.keys(log[0]).sort(), ['app', 'at', 'ok', 'risk', 'target', 'verb', 'verified']);
  assert.ok(log.every(e => typeof e.target === 'string' && e.target.length <= 60));
  assert.strictEqual(appended.length, 8);
  assert.ok(!JSON.stringify(log).includes('Beállítások - Google'), 'no window titles or screen text in the log, only the target name');
});

test('plan refusals: blocked, denied, own, elevated, ambiguous with choices, disabled, password, bad requests', async () => {
  const { hands, st } = fakeEnv();
  assert.strictEqual((await hands.plan({ verb: 'invoke', target: 'törlés' })).err, 'blocked');
  assert.strictEqual((await hands.plan({ verb: 'invoke', target: 'küldés' })).err, 'blocked');
  assert.strictEqual((await hands.plan({ verb: 'invoke', target: 'jelszó mentése' })).err, 'blocked');
  const amb = await hands.plan({ verb: 'invoke', target: 'nyomtatás' });
  assert.deepStrictEqual([amb.err, amb.choices], ['ambiguous', ['Nyomtatás beállítása', 'Nyomtatás előnézete']]);
  assert.match((await hands.plan({ verb: 'toggle', target: 'értesítések bekapcsolása' })).hu, /nem elérhető/);
  st.fg = 400; assert.strictEqual((await hands.plan({ verb: 'scroll' })).err, 'denied');                 // KeePassXC: the screen reader's deny list
  st.fg = 500; assert.strictEqual((await hands.plan({ verb: 'window', arg: 'minimize' })).err, 'own');  // the VRG Asztal itself
  st.fg = 600; assert.strictEqual((await hands.plan({ verb: 'scroll' })).err, 'elevated');
  st.fg = 700; assert.strictEqual((await hands.plan({ verb: 'window', arg: 'close' })).err, 'blocked'); // an installer
  st.fg = 100;
  assert.strictEqual((await hands.plan({ verb: 'focus-window', window: 'keepass' })).err, 'denied');
  for (const bad of [{}, { verb: 'type', target: 'x' }, { verb: 'invoke' }, { verb: 'window', arg: 'explode' }, { verb: 'scroll', arg: 'sideways' }, { verb: 'invoke', target: 'OK', role: 'slider' }, { verb: 'focus-window' }])
    assert.strictEqual((await hands.plan(bad)).err, 'bad-request', JSON.stringify(bad));
  // a custom policy: allow only VS Code → Chrome is denied
  const only = fakeEnv({ policy: () => ({ allow: ['code'] }) });
  assert.strictEqual((await only.hands.plan({ verb: 'scroll' })).err, 'denied');
});

test('act refusals: stale (another window in front, element gone), expired, a second act, stop mid-act, a hanging helper', async () => {
  let e = fakeEnv();
  let r = await e.hands.plan({ verb: 'invoke', target: 'OK' });
  e.st.fg = 300;                                                                            // the user clicked elsewhere meanwhile
  assert.strictEqual((await e.hands.act(r.plan.id)).err, 'stale');
  e.st.fg = 100;
  r = await e.hands.plan({ verb: 'invoke', target: 'mégse' });
  e.st.items = e.st.items.filter(i => i.name !== 'Mégse');
  assert.strictEqual((await e.hands.act(r.plan.id)).err, 'stale');
  r = await e.hands.plan({ verb: 'invoke', target: 'OK' });
  e.tick(RULES.planTtlMs + 1);
  assert.strictEqual((await e.hands.act(r.plan.id)).err, 'expired');
  r = await e.hands.plan({ verb: 'invoke', target: 'OK' });
  assert.strictEqual((await e.hands.act(r.plan.id)).ok, true);
  assert.strictEqual((await e.hands.act(r.plan.id)).err, 'expired');                       // a plan runs once
  // a new plan replaces the pending one
  const p1 = await e.hands.plan({ verb: 'invoke', target: 'OK' }), p2 = await e.hands.plan({ verb: 'invoke', target: 'súgó' });
  assert.strictEqual((await e.hands.act(p1.plan.id)).err, 'expired');
  assert.strictEqual((await e.hands.act(p2.plan.id)).ok, true);
  // stop() before act cancels the plan
  r = await e.hands.plan({ verb: 'invoke', target: 'OK' });
  e.hands.stop();
  assert.strictEqual((await e.hands.act(r.plan.id)).err, 'expired');
  // stop() while the helper hangs on `do`: cut off at once, the helper killed, never retried; the next plan starts a fresh helper
  e = fakeEnv({ timeoutMs: 5000 });
  r = await e.hands.plan({ verb: 'invoke', target: 'OK' });
  e.st.hang = q => q.op === 'do';
  const t0 = Date.now();
  const running = e.hands.act(r.plan.id);
  setTimeout(() => e.hands.stop(), 30);
  const res = await running;
  assert.deepStrictEqual([res.err, Date.now() - t0 < 1000, e.st.kills >= 1], ['stopped', true, true]);
  assert.strictEqual(e.st.reqs.filter(q => q.op === 'do').length, 1);
  e.st.hang = null;
  assert.strictEqual((await e.hands.plan({ verb: 'scroll' })).ok, true);
  assert.strictEqual(e.st.spawns, 2);
  // a `do` that times out: the outcome is unknown, said so, and not retried
  e = fakeEnv({ timeoutMs: 120 });
  r = await e.hands.plan({ verb: 'invoke', target: 'OK' });
  e.st.hang = q => q.op === 'do';
  const t = await e.hands.act(r.plan.id);
  assert.deepStrictEqual([t.err, /Nem tudom, megtörtént-e/.test(t.hu)], ['unknown', true]);
  assert.strictEqual(e.st.reqs.filter(q => q.op === 'do').length, 1);
  // a hanging `find` is retried once on a fresh helper (reading is safe to repeat)
  e = fakeEnv({ timeoutMs: 100 });
  let first = true;
  e.st.hang = q => { if (q.op === 'find' && first) { first = false; return true; } return false; };
  assert.strictEqual((await e.hands.plan({ verb: 'scroll' })).ok, true);
  assert.strictEqual(e.st.spawns, 2);
  e.hands.close();
});

// ------------------------------------------------------------ the script itself
test('act-host.ps1: ASCII only, no text entry or input synthesis of any kind, only the allowed patterns', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'act-host.ps1'), 'utf8');
  assert.ok(/^[\x00-\x7F]*$/.test(src), 'non-ASCII in act-host.ps1');
  for (const bad of ['SetValue', 'Value.SetValue', 'ValuePattern', 'SendKeys', 'SendInput', 'keybd_event', 'mouse_event', 'Clipboard', 'SetCursorPos', 'PostMessage', 'SendMessage', 'TextPattern', 'SetFocus'])
    assert.ok(!src.includes(bad), 'act-host.ps1 must not contain ' + bad);
  for (const ok of ['InvokePattern', 'TogglePattern', 'SelectionItemPattern', 'ExpandCollapsePattern', 'ScrollPattern', 'WindowPattern', 'SetForegroundWindow'])
    assert.ok(src.includes(ok), ok);
  assert.match(src, /IsPassword/);
  assert.match(src, /'elevated'|"elevated"/);
  // the JS side never asks for a text verb either
  const js = fs.readFileSync(path.join(__dirname, '..', 'hands.js'), 'utf8');
  assert.deepStrictEqual(H.VERBS, ['invoke', 'toggle', 'select', 'expand', 'collapse', 'scroll', 'focus-window', 'window']);
  assert.ok(!/['"](type|setvalue|keys|paste)['"]/i.test(js.replace(/\/\/.*$/gm, '')));
});
