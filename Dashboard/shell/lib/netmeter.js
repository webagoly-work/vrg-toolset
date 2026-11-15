// netmeter.js — the samples behind the title bar's corner metrics (WP-49b). main asks sample() every ~2 s while the row is shown;
// nothing runs when it is hidden. All sources are cheap and need no admin rights:
//   ping / jitter / loss   a TCP connect to 1.1.1.1:443 (else 8.8.8.8:443) timed in Node: no ping.exe, no translated output;
//                          loss and jitter over the last 20 tries
//   wifi / link            netsh wlan show interfaces (every 5 s): the "NN%" line and the two "(Mbps)" lines, by value, not by the
//                          translated key; the SSID line's key is never translated
//   down / up              netstat -e (every sample): the first row with two counters is bytes received / sent, the difference per s
//   dns                    a lookup through the system's resolvers (every 10 s), timed
//   cpu / ram              os.cpus() between two samples, os.freemem() / os.totalmem()
//   const nm = createNetMeter({ exec, connect, resolve, cpus, mem, now, platform });   nm.sample() → { at, values:{…}, ssid, target }
// Pure, for the tests: parseNetstatE(text), parseWlan(text).
'use strict';
const path = require('path');

function parseNetstatE(text) {
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^\s*\S.*?\s(\d+)\s+(\d+)\s*$/.exec(line);
    if (m) return { rx: Number(m[1]), tx: Number(m[2]) };
  }
  return null;
}

// netsh wlan show interfaces → the connected interface { name, ssid, signal, rx, tx } or null
function parseWlan(text) {
  for (const block of String(text || '').replace(/\r/g, '').split(/\n\s*\n/)) {
    const rows = block.split('\n').map(l => /^\s*([^:]+?)\s*:\s*(.*?)\s*$/.exec(l)).filter(Boolean);
    if (!rows.length) continue;
    const sig = rows.find(r => /^\d{1,3}\s?%$/.test(r[2]));
    if (!sig) continue;
    const rates = rows.filter(r => /\(\s*(mbps|mb\/s|mbit\/s)\s*\)/i.test(r[1])).map(r => parseFloat(r[2].replace(',', '.'))).filter(n => isFinite(n));
    const ss = rows.find(r => r[1] === 'SSID');
    return { name: rows[0][2], ssid: ss ? ss[2] : '', signal: parseInt(sig[2], 10), rx: rates[0], tx: rates[1] };
  }
  return null;
}

function createNetMeter({ exec, connect, resolve, cpus, mem, now = Date.now, platform = process.platform, targets, dnsName = 'example.com' }) {
  const T = targets || [{ host: '1.1.1.1', port: 443 }, { host: '8.8.8.8', port: 443 }];
  const tries = [];                                   // last 20 connect times (ms) or null for a miss
  let wlan = { at: -Infinity, v: null }, dns = { at: -Infinity, v: null }, bytes = null, cpuPrev = null, busy = null;
  const sys = n => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', n);

  async function pingOnce() {
    for (const t of T) { const ms = await connect(t.host, t.port, 1500).catch(() => null); if (ms !== null && ms !== undefined) return { ms, target: t.host }; }
    return { ms: null, target: '' };
  }
  function cpuPct() {
    const c = cpus(); if (!c || !c.length) return null;
    const sum = c.reduce((a, x) => { const t = x.times; a.idle += t.idle; a.total += t.user + t.nice + t.sys + t.idle + t.irq; return a; }, { idle: 0, total: 0 });
    const prev = cpuPrev; cpuPrev = sum;
    if (!prev || sum.total <= prev.total) return null;
    return Math.max(0, Math.min(100, 100 * (1 - (sum.idle - prev.idle) / (sum.total - prev.total))));
  }

  async function run() {
    const t = now(), values = {};
    const p = await pingOnce();
    tries.push(p.ms); if (tries.length > 20) tries.shift();
    values.ping = p.ms;
    const ok = tries.filter(x => x !== null);
    values.loss = 100 * (tries.length - ok.length) / tries.length;
    values.jitter = ok.length >= 2 ? ok.slice(1).reduce((a, x, i) => a + Math.abs(x - ok[i]), 0) / (ok.length - 1) : null;
    if (platform === 'win32' && exec) {
      if (t - wlan.at >= 5000) { wlan = { at: t, v: parseWlan(await exec(sys('netsh.exe'), ['wlan', 'show', 'interfaces']).catch(() => '')) }; }
      const b = parseNetstatE(await exec(sys('netstat.exe'), ['-e']).catch(() => ''));
      if (b && bytes && t > bytes.at && b.rx >= bytes.rx && b.tx >= bytes.tx) {
        const dt = (t - bytes.at) / 1000;
        values.down = (b.rx - bytes.rx) * 8 / dt; values.up = (b.tx - bytes.tx) * 8 / dt;
      }
      if (b) bytes = { ...b, at: t };
    }
    values.wifi = wlan.v ? wlan.v.signal : null;
    values.link = wlan.v && isFinite(wlan.v.rx) ? Math.max(wlan.v.rx, isFinite(wlan.v.tx) ? wlan.v.tx : 0) : null;
    if (resolve && t - dns.at >= 10000) {
      const s = now();
      const okd = await resolve(dnsName).then(() => true).catch(() => false);
      dns = { at: t, v: okd ? now() - s : null };
    }
    values.dns = dns.v;
    values.cpu = cpuPct();
    const m = mem && mem();
    values.ram = m && m.total ? 100 * (1 - m.free / m.total) : null;
    return { at: t, values, ssid: wlan.v ? wlan.v.ssid : '', target: p.target };
  }
  function sample() { if (!busy) busy = run().finally(() => { busy = null; }); return busy; }
  return { sample };
}

// a TCP connect, timed: resolves the milliseconds, rejects on error / timeout (main passes this as `connect`)
function tcpConnect(net, now = () => Number(process.hrtime.bigint() / 1000n) / 1000) {
  return (host, port, timeout) => new Promise((res, rej) => {
    const s = now();
    const k = net.connect({ host, port });
    k.setTimeout(timeout, () => { k.destroy(); rej(new Error('timeout')); });
    k.once('connect', () => { const ms = now() - s; k.destroy(); res(ms); });
    k.once('error', e => { k.destroy(); rej(e); });
  });
}

module.exports = { createNetMeter, parseNetstatE, parseWlan, tcpConnect };
