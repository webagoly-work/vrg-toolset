// WP-49: 📱 Telefon — the radios this PC has, every local server started for the phone, a QR per server (lib/phonelink.js).
//  - classify(): Get-NetAdapter rows + Get-PnpDevice Bluetooth rows + netsh + os.networkInterfaces() → Wi-Fi / hotspot / Bluetooth / wired,
//    the addresses a phone can use (wireless first), virtual adapters left out;
//  - startAll(): the relay first with --ports (restarted only when the shell owns it), then every registry server that is down, minus
//    config/phone.json's exclude list; nothing is spawned here (a recording ports object);
//  - qr() / pair() / clear() ask the relay's /share and /pair (a fake httpGet) and never build a URL from the page's words.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs');
const { createPhoneLink, classify, parseNetsh, RADIO_PS } = require('../shell/lib/phonelink.js');
const settings = require('../shell/lib/settings.js');

const NETSH_HU = [
  '',
  'A rendszerben 1 csatoló található:',
  '',
  '    Név                    : Wi-Fi 2',
  '    Leírás                 : TP-Link Wireless USB Adapter',
  '    Állapot                : csatlakoztatva',
  '    SSID                   : Otthon 5G',
  '    BSSID                  : aa:bb:cc:dd:ee:ff',
  '    Rádió típusa           : 802.11ac',
  '',
  '    Hostolt hálózat állapota  : Nem érhető el',
].join('\r\n');

const ADAPTERS = [
  { Name: 'Ethernet', InterfaceDescription: 'Realtek PCIe GbE Family Controller', PhysicalMediaType: '802.3', Status: 'Up', Virtual: false },
  { Name: 'Wi-Fi 2', InterfaceDescription: 'TP-Link Wireless USB Adapter', PhysicalMediaType: 'Native 802.11', Status: 'Up', Virtual: false },
  { Name: 'Helyi kapcsolat* 12', InterfaceDescription: 'Microsoft Wi-Fi Direct Virtual Adapter #2', PhysicalMediaType: 'Native 802.11', Status: 'Up', Virtual: false },
  { Name: 'Bluetooth-hálózati kapcsolat', InterfaceDescription: 'Bluetooth Device (Personal Area Network)', PhysicalMediaType: 'BlueTooth', Status: 'Disconnected', Virtual: false },
  { Name: 'vEthernet (Default Switch)', InterfaceDescription: 'Hyper-V Virtual Ethernet Adapter', PhysicalMediaType: 'Unspecified', Status: 'Up', Virtual: true },
];
const PNP = [
  { FriendlyName: 'Intel(R) Wireless Bluetooth(R)', Status: 'OK', InstanceId: 'USB\\VID_8087&PID_0026\\5&1' },
  { FriendlyName: 'Microsoft Bluetooth Enumerator', Status: 'OK', InstanceId: 'BTH\\MS_BTHBRB\\7&1' },
  { FriendlyName: 'Galaxy Buds', Status: 'OK', InstanceId: 'BTHENUM\\{0000110b}\\8&2' },
];
const v4 = a => ({ family: 'IPv4', internal: false, address: a });
const IFACES = { 'Ethernet': [v4('192.168.0.10')], 'Wi-Fi 2': [v4('192.168.1.24')], 'Helyi kapcsolat* 12': [v4('192.168.137.1')], 'vEthernet (Default Switch)': [v4('172.20.0.1')], 'Loopback Pseudo-Interface 1': [{ family: 'IPv4', internal: true, address: '127.0.0.1' }] };

test('netsh: the SSID per adapter, whatever language the keys are in; BSSID is not the SSID', () => {
  assert.deepStrictEqual(parseNetsh(NETSH_HU), { 'Wi-Fi 2': 'Otthon 5G' });
  assert.deepStrictEqual(parseNetsh(''), {});
});

test('classify: Wi-Fi, the Mobile hotspot, Bluetooth and the wired LAN; virtual adapters left out; wireless addresses first', () => {
  const r = classify({ adapters: ADAPTERS, pnp: PNP, ssids: parseNetsh(NETSH_HU), ifaces: IFACES });
  assert.strictEqual(r.wifi.length, 1); assert.strictEqual(r.wifi[0].ssid, 'Otthon 5G'); assert.deepStrictEqual(r.wifi[0].ips, ['192.168.1.24']);
  assert.strictEqual(r.hotspot.length, 1); assert.deepStrictEqual(r.hotspot[0].ips, ['192.168.137.1']);
  assert.strictEqual(r.eth.length, 1);
  assert.strictEqual(r.bt.present, true); assert.strictEqual(r.bt.on, true);
  assert.deepStrictEqual(r.bt.radios.map(x => x.name), ['Intel(R) Wireless Bluetooth(R)'], 'only the radio, not the enumerator or a paired headset');
  assert.deepStrictEqual(r.addresses.map(a => a.kind + ' ' + a.address), ['wifi 192.168.1.24', 'hotspot 192.168.137.1', 'eth 192.168.0.10']);
  assert.ok(!r.addresses.some(a => a.address === '172.20.0.1'), 'Hyper-V is never offered to a phone');
  assert.strictEqual(r.wireless, true);
});

test('classify: wired only = no wireless (the panel says so) but the LAN address is still offered; nothing at all = no address', () => {
  const r = classify({ adapters: ADAPTERS.slice(0, 1), pnp: [], ssids: {}, ifaces: { Ethernet: [v4('192.168.0.10')] } });
  assert.strictEqual(r.wireless, false); assert.strictEqual(r.bt.present, false);
  assert.deepStrictEqual(r.addresses.map(a => a.address), ['192.168.0.10']);
  const n = classify({ adapters: [], pnp: [], ssids: {}, ifaces: {} });
  assert.strictEqual(n.addresses.length, 0); assert.strictEqual(n.wireless, false);
});

test('classify off Windows: the interface names decide (wlan0 is Wi-Fi)', () => {
  const r = classify({ adapters: [], pnp: [], ssids: {}, ifaces: { wlan0: [v4('10.0.0.5')], docker0: [v4('172.17.0.1')] } });
  assert.deepStrictEqual(r.addresses.map(a => a.kind + ' ' + a.address), ['wifi 10.0.0.5']);
});

test('the radio query is one -Command line that reads no translated text but the SSID key', () => {
  assert.ok(!/\n/.test(RADIO_PS));
  assert.ok(/Get-NetAdapter/.test(RADIO_PS) && /Get-PnpDevice -Class Bluetooth/.test(RADIO_PS) && /netsh wlan show interfaces/.test(RADIO_PS));
});

// ------------------------------------------------------------ startAll / qr against recording fakes
const SERVERS = [
  { id: 'mindmap', name: 'VRG MindMap', port: 8124, js: 'x.js' },
  { id: 'gyro', name: 'Gyro relay', port: 47291, js: 'relay.js' },
  { id: 'stack', name: 'Rétegverem', port: 8806, js: 's.js', open: '/stack-search.html' },
  { id: 'board', name: 'Board Console', port: 8790, bat: 'b.bat', self: true },
];
function rig(o = {}) {
  const up = new Set(o.up || []), started = [], stopped = [], calls = [];
  let relayPorts = o.relayPorts === true;
  const R = { C: { menu: { servers: SERVERS } }, server: id => SERVERS.find(s => s.id === id) || null };
  const ports = {
    ports: {}, up: async p => up.has(p), pollPorts: async () => ({}),
    startServer: (s, extra) => { started.push(s.id + (extra && extra.length ? ' ' + extra.join(' ') : '')); up.add(s.port); if (s.id === 'gyro') relayPorts = (extra || []).includes('--ports'); return o.fail === s.id ? 'hiányzik: ' + s.id : ''; },
  };
  const srvHost = { list: () => (o.owned ? [{ id: 'gyro', running: true }] : []), stop: id => { stopped.push(id); up.delete(47291); return { ok: true }; } };
  const httpGet = async (port, p, method) => {
    calls.push((method || 'GET') + ' ' + p);
    if (!up.has(port)) throw new Error('ECONNREFUSED');
    if (p === '/whoami') return JSON.stringify({ ok: true, port, ports: relayPorts, share: relayPorts, clients: 0 });
    if (p.startsWith('/share/clear')) return JSON.stringify({ ok: true, cleared: 3 });
    if (p.startsWith('/share/')) return JSON.stringify(relayPorts ? { ok: true, url: 'http://192.168.1.24:47291/p/8806/stack-search.html?vrg_s=' + 'a'.repeat(32), svg: '<svg/>', ttl: 300000, address: '192.168.1.24', addresses: [] } : { ok: false, ports: false, reason: 'off' });
    if (p.startsWith('/pair/code.json')) return JSON.stringify({ ok: true, link: 'vrg://pair?ws=x&c=' + 'b'.repeat(32), svg: '<svg/>', ttl: 120000, address: '192.168.1.24' });
    return '{}';
  };
  const pl = createPhoneLink({ R, ports, srvHost, httpGet, ifaces: () => IFACES, platform: 'linux', config: { relay: 'gyro', relayArgs: ['--ports'], exclude: ['board'] } });
  return { pl, started, stopped, calls, up };
}

test('startAll: the relay with --ports first, then every server that is down; excluded and running ones are left alone', async () => {
  const { pl, started } = rig({ up: [8124] });
  const r = await pl.startAll();
  assert.deepStrictEqual(started, ['gyro --ports', 'stack']);
  assert.deepStrictEqual(r.already, ['mindmap']);
  assert.strictEqual(r.ok, true);
  assert.ok(!pl.servers().some(s => s.id === 'board'), 'a self / hardware server is not in the phone list');
  assert.strictEqual(pl.servers().find(s => s.id === 'stack').path, '/stack-search.html');
});

test('startAll: a relay running without --ports is restarted only when the shell started it', async () => {
  const mine = rig({ up: [47291], owned: true });
  await mine.pl.startAll();
  assert.deepStrictEqual(mine.stopped, ['gyro']); assert.ok(mine.started.includes('gyro --ports'));
  const theirs = rig({ up: [47291], owned: false });
  const r = await theirs.pl.startAll();
  assert.deepStrictEqual(theirs.stopped, []); assert.ok(!theirs.started.some(s => s.startsWith('gyro')));
  assert.strictEqual(r.relay.ok, false); assert.match(r.relay.hu, /--ports/);
  assert.strictEqual(r.ok, false); assert.ok(r.started.includes('mindmap'), 'the other servers still start');
});

test('startAll: a server that cannot start is reported, the rest go on', async () => {
  const { pl } = rig({ up: [47291], relayPorts: true });
  const r = await rig({ up: [47291], relayPorts: true, fail: 'stack' }).pl.startAll();
  assert.deepStrictEqual(r.failed.map(f => f.id), ['stack']); assert.ok(r.started.includes('mindmap'));
  assert.ok(pl);
});

test('qr: the relay\'s /share for the server\'s own path and the chosen address; the relay row gives the pairing QR', async () => {
  const { pl, calls } = rig({ up: [47291], relayPorts: true });
  const q = await pl.qr('stack', '192.168.1.24');
  assert.strictEqual(q.ok, true); assert.match(q.url, /\/p\/8806\/stack-search\.html\?vrg_s=/);
  assert.ok(calls.includes('GET /share/8806.json?ip=192.168.1.24&path=%2Fstack-search.html'), calls.join(' | '));
  const p = await pl.qr('gyro', '192.168.1.24');
  assert.strictEqual(p.pair, true); assert.match(p.url, /^vrg:\/\/pair/);
  await pl.qr('stack', '1.2.3.4; rm -rf /');
  assert.ok(calls.includes('GET /share/8806.json?path=%2Fstack-search.html'), 'an address that is not an IPv4 is dropped, not passed on');
  assert.strictEqual((await pl.qr('nope')).ok, false);
  assert.deepStrictEqual(await pl.clear(), { ok: true, cleared: 3, hu: 'Megosztások visszavonva.' });
});

test('qr: the relay down or without --ports says what to press', async () => {
  const down = await rig({}).pl.qr('stack');
  assert.strictEqual(down.ok, false); assert.match(down.hu, /Mind indítása/);
  const off = await rig({ up: [47291], relayPorts: false }).pl.qr('stack');
  assert.strictEqual(off.ok, false); assert.match(off.hu, /--ports/);
});

test('wiring: the phone frame in the catalog, the setting, the page script, config/phone.json names real registry servers', () => {
  const DASH = path.resolve(__dirname, '..'), REPO = path.resolve(DASH, '..');
  const cat = JSON.parse(fs.readFileSync(path.join(REPO, 'launcher', 'vrg-catalog.json'), 'utf8'));
  const it = cat.items.find(i => i.id === 'phone');
  assert.ok(it && it.launch.frame === 'phone' && it.level === 'user');
  assert.ok(settings.has('phone.auto'));
  const html = fs.readFileSync(path.join(DASH, 'page', 'vrg-desktop.html'), 'utf8');
  assert.ok(html.indexOf('phone.js') > 0 && html.indexOf('phone.js') < html.indexOf('src="desk.js"'), 'phone.js loads before desk.js');
  const cfg = JSON.parse(fs.readFileSync(path.join(DASH, 'config', 'phone.json'), 'utf8'));
  const menu = JSON.parse(fs.readFileSync(path.join(REPO, 'launcher', 'vrg-menu.json'), 'utf8'));
  const ids = new Set(menu.servers.map(s => s.id));
  assert.ok(ids.has(cfg.relay)); for (const x of cfg.exclude) assert.ok(ids.has(x), x);
  assert.ok(menu.servers.filter(s => s.self).every(s => cfg.exclude.includes(s.id)), 'every server that opens its own window is excluded');
});

// ------------------------------------------------------------ WP-49b: the title bar's corner metrics, the VRG Mobile download QR
const G = require('../shell/lib/netgrade.js');
const { createNetMeter, parseNetstatE, parseWlan } = require('../shell/lib/netmeter.js');

test('netgrade: green / sand / coral by threshold, higher-is-better for signal and link, traffic has no judgement', () => {
  assert.deepStrictEqual(['wifi', 'wifi', 'wifi'].map((id, i) => G.grade(id, [80, 40, 20][i])), ['ok', 'warn', 'crit']);
  assert.deepStrictEqual([20, 100, 400].map(v => G.grade('ping', v)), ['ok', 'warn', 'crit']);
  assert.deepStrictEqual([0, 3, 30].map(v => G.grade('loss', v)), ['ok', 'warn', 'crit']);
  assert.strictEqual(G.grade('down', 5e6), 'info'); assert.strictEqual(G.grade('ping', null), 'none');
  assert.deepStrictEqual([G.fmt('wifi', 77.6), G.fmt('ping', 23.4), G.fmt('down', 1.44e6), G.fmt('up', 512), G.fmt('link', 866.7), G.fmt('dns', undefined)],
    ['78%', '23 ms', '1.4 Mb/s', '512 b/s', '867 Mb/s', '—']);
  assert.ok(G.validList(['ping', 'wifi']) && G.validList([]) && !G.validList(['ping', 'ping']) && !G.validList(['nope']) && !G.validList('ping'));
  assert.ok(G.validList(G.DEFAULT) && G.IDS.length === 10);
  assert.ok(settings.has('net.show') && settings.has('net.metrics'));
});

test('netmeter parsers: netstat -e bytes, netsh signal / rates / SSID by value (English and Hungarian keys)', () => {
  assert.deepStrictEqual(parseNetstatE('Interface Statistics\r\n\r\n   Received   Sent\r\n\r\nBytes   1633964104   1880572556\r\nUnicast packets  58001952  50241496\r\n'), { rx: 1633964104, tx: 1880572556 });
  assert.deepStrictEqual(parseNetstatE('Bájtok           12            34\n'), { rx: 12, tx: 34 });
  assert.strictEqual(parseNetstatE(''), null);
  const en = '\n    Name                   : Wi-Fi\n    State                  : connected\n    SSID                   : Otthon\n    BSSID                  : aa:bb\n    Receive rate (Mbps)    : 144.4\n    Transmit rate (Mbps)   : 72\n    Signal                 : 81%\n';
  assert.deepStrictEqual(parseWlan(en), { name: 'Wi-Fi', ssid: 'Otthon', signal: 81, rx: 144.4, tx: 72 });
  const hu = '\n    Név                    : Wi-Fi 2\n    SSID                   : Iroda\n    Fogadási sebesség (Mbps) : 300\n    Küldési sebesség (Mbps)  : 270\n    Jel                    : 46 %\n';
  assert.deepStrictEqual(parseWlan(hu), { name: 'Wi-Fi 2', ssid: 'Iroda', signal: 46, rx: 300, tx: 270 });
  assert.strictEqual(parseWlan('\n    Name : WiFi 4\n    State : disconnected\n'), null, 'no signal line = not connected');
});

test('netmeter: ping, loss and jitter over the tries; traffic per second from netstat; CPU between two samples; nothing for hidden sources', async () => {
  let clock = 0, misses = new Set([2]), n = 0, rx = 1000, tx = 500, idle = 100;
  const nm = createNetMeter({
    platform: 'win32', now: () => clock,
    connect: async () => { n++; if (misses.has(n)) throw new Error('timeout'); return [0, 20, 0, 30, 40][n] || 25; },
    exec: async (f, a) => (/netstat/i.test(f) ? `Bytes  ${rx}  ${tx}\n` : '\n    Name : Wi-Fi\n    SSID : X\n    Receive rate (Mbps) : 54\n    Signal : 30%\n'),
    resolve: async () => { clock += 12; return ['1.2.3.4']; },
    cpus: () => [{ times: { user: 100, nice: 0, sys: 0, idle: (idle += 50), irq: 0 } }], mem: () => ({ free: 25, total: 100 }),
    targets: [{ host: 'a', port: 1 }],
  });
  const a = await nm.sample();
  assert.strictEqual(a.values.ping, 20); assert.strictEqual(a.values.loss, 0); assert.strictEqual(a.values.wifi, 30); assert.strictEqual(a.values.link, 54);
  assert.strictEqual(a.values.ram, 75); assert.strictEqual(a.values.cpu, null, 'no CPU figure from one sample');
  assert.strictEqual(a.values.down, undefined, 'no traffic figure from one sample'); assert.strictEqual(a.values.dns, 12);
  clock += 2000; rx += 250000; tx += 25000;
  const b = await nm.sample();
  assert.strictEqual(b.values.ping, null); assert.strictEqual(b.values.loss, 50);
  assert.strictEqual(Math.round(b.values.down), Math.round(2e6 / 2.012)); assert.strictEqual(Math.round(b.values.up), Math.round(2e5 / 2.012));   // the fake DNS lookup moved the clock 12 ms
  assert.strictEqual(b.values.cpu, 0);
  clock += 2000; await nm.sample(); clock += 2000;
  const d = await nm.sample();
  assert.strictEqual(d.values.ping, 40); assert.strictEqual(Math.round(d.values.loss), 25); assert.strictEqual(d.values.jitter, 10);
  const off = createNetMeter({ platform: 'linux', now: () => 0, connect: async () => 5, cpus: () => [], mem: () => null });
  const o = await off.sample();
  assert.strictEqual(o.values.wifi, null); assert.strictEqual(o.values.down, undefined); assert.strictEqual(o.values.ram, null);
});

test('the VRG Mobile download QR comes from the relay\'s /share/app.json, with the APK it names', async () => {
  const calls = [];
  const R = { C: { menu: { servers: SERVERS } }, server: id => SERVERS.find(s => s.id === id) || null };
  const pl = createPhoneLink({ R, ports: { ports: {}, up: async () => true }, ifaces: () => ({}), platform: 'linux', config: { relay: 'gyro' },
    httpGet: async (port, p) => { calls.push(p); return JSON.stringify({ ok: true, url: 'http://192.168.1.24:47291/vrg-mobile?vrg_s=' + 'c'.repeat(32), svg: '<svg/>', ttl: 600000, apk: { kind: 'release', bytes: 5, mtime: 1 } }); } });
  const r = await pl.app('192.168.1.24');
  assert.strictEqual(r.ok, true); assert.strictEqual(r.app, true); assert.strictEqual(r.apk.kind, 'release');
  assert.deepStrictEqual(calls, ['/share/app.json?ip=192.168.1.24']);
});
