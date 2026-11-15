// phonelink.js — the VRG Asztal's Telefon panel (WP-49, 2026-11-14): one click finds this PC's radios (Wi-Fi, a Mobile hotspot,
// Bluetooth, and the wired LAN a phone on the same router reaches too), starts every local server for the phone, and hands back a QR
// per server. The QR comes from the phone relay (Planner/projects/varler-planner/tools, GET /share/<port>.json, this PC only): a link
// to the relay's /p/<port>/ proxy with a 5-minute ticket, so the phone's camera or VRG Mobile's QR button opens that one server without
// pairing. Most servers listen on 127.0.0.1 only; the relay (one port, one firewall rule) is the way in. It must run with --ports.
//   const pl = createPhoneLink({ R, ports, srvHost, settings, exec, httpGet, ifaces, platform, log, dry });
//   pl.radios({ fresh })       → { ok, wifi:[…], hotspot:[…], bt:{ present, on, radios, pan }, eth:[…], addresses:[{ address, name, kind }], wireless }
//   pl.servers()               → [{ id, name, port, path, up, relay? }]   the registry servers the panel starts (config/phone.json exclude)
//   pl.relay()                 → { up, ports, port, id }                   the relay's /whoami
//   pl.startAll()              → { ok, started:[id], already:[id], failed:[{ id, hu }], relay:{ … } }
//   pl.qr(id, ip)              → { ok, url, svg, ttl, address, addresses } | { ok:false, hu }
//   pl.pair(ip)                → the pairing QR (VRG Mobile M2) the same way
//   pl.app(ip)                 → a QR to the relay's VRG Mobile download page (WP-49b; the APK built on this PC), + { apk }
//   pl.clear()                 → every shared ticket and cookie revoked
// Pure, for the tests: parseNetsh(text), classify({ adapters, pnp, ssids, ifaces }), RADIO_PS.
'use strict';
const path = require('path');

const RELAY_ID = 'gyro';
// one PowerShell call, -Command (a fresh -File script is what Avast stops): the adapters, the Bluetooth radios, netsh's Wi-Fi state.
// Get-NetAdapter's PhysicalMediaType / Status are not translated on a Hungarian Windows; netsh's keys are, so only "SSID" is read there.
const RADIO_PS = [
  '$ErrorActionPreference="SilentlyContinue"',
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8',
  '$a=@(Get-NetAdapter | Select-Object Name,InterfaceDescription,PhysicalMediaType,Status,Virtual)',
  '$b=@(Get-PnpDevice -Class Bluetooth -PresentOnly | Select-Object FriendlyName,Status,InstanceId)',
  '$s=(netsh wlan show interfaces) -join "`n"',
  '[pscustomobject]@{a=$a;b=$b;s=$s} | ConvertTo-Json -Depth 3 -Compress',
].join(';');

const VIRTUAL_RE = /virtualbox|vmware|hyper-v|vethernet|loopback|tailscale|zerotier|wsl|docker|tap-|tap adapter|wan miniport|kernel debug|npcap/i;
const WIFI_RE = /wi-?fi|wireless|wlan|802\.11|wl\d/i;
const DIRECT_RE = /wi-?fi direct|hosted network/i;
const BT_RE = /bluetooth/i;

// netsh wlan show interfaces → { <adapter name>: ssid }. Each interface is one block; its first "key : value" line is the name
// ("Name" / "Név" …), its "SSID" line (never translated) the network. "BSSID" is a different line.
function parseNetsh(text) {
  const out = {};
  for (const block of String(text || '').replace(/\r/g, '').split(/\n\s*\n/)) {
    const rows = block.split('\n').map(l => /^\s*([^:]+?)\s*:\s*(.*)$/.exec(l)).filter(Boolean);
    if (!rows.length) continue;
    const name = rows[0][2].trim();
    const ss = rows.find(r => r[1].trim() === 'SSID');
    if (name && ss && ss[2].trim()) out[name] = ss[2].trim();
  }
  return out;
}

const arr = v => (Array.isArray(v) ? v : v ? [v] : []);
const ipv4 = (ifaces, name) => (ifaces[name] || []).filter(i => (i.family === 'IPv4' || i.family === 4) && !i.internal).map(i => i.address);

// adapters = Get-NetAdapter rows (or [] off Windows: then the interface names alone decide), pnp = Get-PnpDevice Bluetooth rows,
// ssids = parseNetsh(), ifaces = os.networkInterfaces()
function classify({ adapters, pnp, ssids, ifaces }) {
  adapters = arr(adapters); ifaces = ifaces || {}; ssids = ssids || {};
  const rows = adapters.length ? adapters.map(a => ({ name: String(a.Name || ''), desc: String(a.InterfaceDescription || ''), media: String(a.PhysicalMediaType || ''),
    up: /^up$/i.test(String(a.Status || '')), virtual: a.Virtual === true }))
    : Object.keys(ifaces).map(n => ({ name: n, desc: n, media: '', up: ipv4(ifaces, n).length > 0, virtual: false }));
  const wifi = [], hotspot = [], pan = [], eth = [];
  for (const r of rows) {
    const ips = ipv4(ifaces, r.name), both = r.name + ' ' + r.desc;
    const row = { name: r.name, desc: r.desc, up: r.up, ips };
    if (DIRECT_RE.test(both) || ips.some(a => a.startsWith('192.168.137.'))) { if (ips.length) hotspot.push(row); continue; }   // Windows' Mobile hotspot
    if (/bluetooth/i.test(r.media) || BT_RE.test(both)) { pan.push(row); continue; }
    if (VIRTUAL_RE.test(both) || r.virtual) continue;
    if (/802\.11/.test(r.media) || WIFI_RE.test(both)) { wifi.push({ ...row, ssid: ssids[r.name] || '' }); continue; }
    if (/802\.3/.test(r.media) || /ethernet|gbe|realtek pcie|intel.*connection/i.test(both)) eth.push(row);
  }
  // the Bluetooth radio itself: a USB / PCI device of the Bluetooth class (paired phones and headsets are BTHENUM\ / BTHLE\ children)
  const radios = arr(pnp).filter(d => /^(usb|pci|acpi)\\/i.test(String(d.InstanceId || ''))).map(d => ({ name: String(d.FriendlyName || ''), on: /^ok$/i.test(String(d.Status || '')) }));
  const bt = { present: radios.length > 0 || pan.length > 0, on: radios.some(r => r.on), radios, pan };
  const addresses = [];
  const add = (list, kind) => { for (const r of list) for (const a of r.ips) if (!addresses.some(x => x.address === a)) addresses.push({ address: a, name: r.name, kind, ssid: r.ssid || '' }); };
  add(wifi.filter(w => w.up), 'wifi'); add(hotspot, 'hotspot'); add(eth.filter(e => e.up), 'eth'); add(pan.filter(p => p.up), 'bt');
  return { ok: true, wifi, hotspot, bt, eth, addresses, wireless: addresses.some(a => a.kind === 'wifi' || a.kind === 'hotspot' || a.kind === 'bt') };
}

function createPhoneLink({ R, ports, srvHost, exec, httpGet, ifaces, platform = process.platform, log = () => {}, dry = false, config = null }) {
  let cache = null, cacheAt = 0;
  const cfg = () => {
    if (config) return config;
    try { return JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', '..', 'config', 'phone.json'), 'utf8')); } catch (e) { return {}; }
  };
  const all = () => (R.C && R.C.menu && R.C.menu.servers) || [];
  const relayEntry = () => all().find(s => s.id === (cfg().relay || RELAY_ID)) || null;
  const relayArgs = () => (Array.isArray(cfg().relayArgs) ? cfg().relayArgs : ['--ports']).filter(a => /^--[a-z]+$/.test(a));

  async function radios(o) {
    if (cache && !(o && o.fresh) && Date.now() - cacheAt < 15000) return cache;
    let raw = { a: [], b: [], s: '' };
    if (platform === 'win32' && exec) {
      try {
        const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        const out = await exec(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', RADIO_PS]);
        const j = JSON.parse(String(out || '').trim().replace(/^\uFEFF/, '') || '{}');
        raw = { a: arr(j.a), b: arr(j.b), s: String(j.s || '') };
      } catch (e) { log('phone radios: powershell', e.message); }
    }
    cache = classify({ adapters: raw.a, pnp: raw.b, ssids: parseNetsh(raw.s), ifaces: ifaces() });
    cacheAt = Date.now();
    return cache;
  }

  function servers() {
    const ex = new Set(Array.isArray(cfg().exclude) ? cfg().exclude : []);
    const rid = (relayEntry() || {}).id;
    return all().filter(s => !ex.has(s.id)).map(s => ({ id: s.id, name: s.name, port: s.port, path: s.open || '/', up: !!ports.ports[s.port], relay: s.id === rid }));
  }

  async function relay() {
    const s = relayEntry();
    if (!s) return { up: false, ports: false, id: '', port: 0, hu: 'A registryben nincs relé (gyro).' };
    try {
      const j = JSON.parse(await httpGet(s.port, '/whoami'));
      return { up: true, ports: j.ports === true, share: j.share === true, port: j.port || s.port, id: s.id, clients: j.clients | 0 };
    } catch (e) { return { up: false, ports: false, port: s.port, id: s.id }; }
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function upWithin(port, ms) { for (let t = 0; t < ms; t += 500) { if (await ports.up(port)) return true; await wait(500); } return false; }

  // the relay first, with --ports: a relay already running without it is restarted when the shell owns it; otherwise it is said so
  async function ensureRelay() {
    const s = relayEntry();
    if (!s) return { ok: false, hu: 'A registryben nincs relé (gyro).' };
    let st = await relay();
    if (st.up && st.ports) return { ok: true, already: true, ...st };
    if (dry) return { ok: true, dry: true, ...st };
    if (st.up && !st.ports) {
      const mine = srvHost && srvHost.list().some(x => x.id === s.id && x.running);
      if (!mine) return { ok: false, ...st, hu: 'A relé fut, de --ports nélkül (nem az Asztal indította): állítsd le, és nyomd meg újra.' };
      srvHost.stop(s.id);
      for (let i = 0; i < 10 && await ports.up(s.port); i++) await wait(300);
    }
    const err = ports.startServer(s, relayArgs());
    if (err) return { ok: false, hu: err };
    await upWithin(s.port, 8000);
    st = await relay();
    return st.up && st.ports ? { ok: true, started: true, ...st } : { ok: false, ...st, hu: 'A relé nem válaszolt --ports módban.' };
  }

  async function startAll() {
    const r = await ensureRelay();
    const started = [], already = [], failed = [];
    if (r.started) started.push(r.id); else if (r.already) already.push(r.id); else if (!r.ok) failed.push({ id: r.id || RELAY_ID, hu: r.hu });
    for (const s of servers().filter(x => !x.relay)) {
      if (await ports.up(s.port)) { already.push(s.id); continue; }
      if (dry) { started.push(s.id); continue; }
      const e = ports.startServer(R.server(s.id));
      if (e) failed.push({ id: s.id, hu: e }); else started.push(s.id);
    }
    log('phone startAll', started.length, 'started,', already.length, 'up,', failed.length, 'failed');
    setTimeout(() => ports.pollPorts(), 1500);
    return { ok: !failed.length, started, already, failed, relay: r };
  }

  async function relayJson(p, method) {
    const s = relayEntry();
    if (!s) return { ok: false, hu: 'A registryben nincs relé (gyro).' };
    try { return JSON.parse(await httpGet(s.port, p, method)); }
    catch (e) { return { ok: false, err: 'relay', hu: 'A relé nem fut: nyomd meg a „Mind indítása” gombot.' }; }
  }
  const ipq = ip => (typeof ip === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? 'ip=' + ip : '');

  async function qr(id, ip) {
    const s = R.server(id);
    if (!s) return { ok: false, err: 'not-found', hu: 'Nincs ilyen szerver.' };
    if (relayEntry() && s.id === relayEntry().id) return pair(ip);
    const q = [ipq(ip), 'path=' + encodeURIComponent(s.open || '/')].filter(Boolean).join('&');
    const j = await relayJson('/share/' + s.port + '.json?' + q);
    if (j.ok === false && j.ports === false) return { ...j, hu: 'A relé --ports nélkül fut: nyomd meg a „Mind indítása” gombot.' };
    return j.ok ? { ok: true, id: s.id, url: j.url, svg: j.svg, ttl: j.ttl, address: j.address, addresses: j.addresses } : { ok: false, hu: j.hu || j.reason || 'Nincs QR.' };
  }
  async function pair(ip) {
    const j = await relayJson('/pair/code.json' + (ipq(ip) ? '?' + ipq(ip) : ''));
    return j.ok ? { ok: true, pair: true, url: j.link, svg: j.svg, ttl: j.ttl, address: j.address, addresses: j.addresses } : { ok: false, hu: j.hu || j.reason || 'Nincs párosító QR.' };
  }
  // WP-49b: a QR to the relay's VRG Mobile download page, for a phone that has no app yet (needs the relay, not --ports)
  async function app(ip) {
    const j = await relayJson('/share/app.json' + (ipq(ip) ? '?' + ipq(ip) : ''));
    return j.ok ? { ok: true, app: true, url: j.url, svg: j.svg, ttl: j.ttl, address: j.address, apk: j.apk } : { ok: false, hu: j.hu || j.reason || 'Nincs letöltő QR.' };
  }
  async function clear() { const j = await relayJson('/share/clear', 'POST'); return j.ok ? { ok: true, cleared: j.cleared | 0, hu: 'Megosztások visszavonva.' } : { ok: false, hu: j.hu || 'Nem sikerült.' }; }

  return { radios, servers, relay, startAll, qr, pair, app, clear };
}

module.exports = { createPhoneLink, classify, parseNetsh, RADIO_PS, RELAY_ID };
