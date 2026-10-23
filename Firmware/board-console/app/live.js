// live.js - Board Console phase 3a: the live link to a board running the board agent (VrgAgent.h).
//
// Opens the board's serial port (or "tcp:host:port" for a test agent), reads lines, keeps the
// agent's view (HELLO, USES, PINS, values) and a log of every line. The page polls /api/live.
// The firmware jobs need the same port: release() closes it and gives back a function that
// reopens it after the job.

'use strict';
const net = require('net');

function createLive({ log }) {
  let SerialPort = null;
  try { ({ SerialPort } = require('serialport')); } catch (e) { log('serialport is not installed: run npm install in app/ (live link off)'); }

  const S = {
    want: null,          // {port, baud} the user asked for
    open: false, since: null, error: null, lastLineAt: 0,
    hello: null, uses: [], pins: {}, values: {}, ver: 0,
    log: [], seq: 0
  };
  let conn = null, rx = '', retry = null;

  function reset() { S.hello = null; S.uses = []; S.pins = {}; S.values = {}; S.ver++; }
  function push(line, dir) {
    S.seq++;
    S.log.push({ seq: S.seq, t: Date.now(), dir: dir || 'in', line });
    if (S.log.length > 2000) S.log.splice(0, S.log.length - 2000);
  }

  // ---- the agent protocol
  function parse(line) {
    S.lastLineAt = Date.now();
    const m = /^#(\w+)\s*(.*)$/.exec(line);
    if (!m) return;
    const [, kind, rest] = m;
    if (kind === 'HELLO') {
      const kv = {};
      for (const t of rest.split(/\s+/)) { const i = t.indexOf('='); if (i > 0) kv[t.slice(0, i)] = t.slice(i + 1); }
      S.hello = { agent: rest.split(/\s+/)[0], fw: kv.fw, ver: kv.ver, chip: kv.chip, mac: kv.mac, setup: kv.setup && kv.setup !== '-' ? kv.setup.replace(/_/g, ' ') : '', at: Date.now() };
      S.ver++;
    } else if (kind === 'USES') {
      S.uses = rest.trim() === '-' ? [] : rest.split(/[\s,]+/).filter(Boolean); S.ver++;
    } else if (kind === 'PINS') {
      const pins = {};
      for (const t of rest.split(/\s+/)) { const [g, mode] = t.split(':'); if (/^\d+$/.test(g) && mode) pins[g] = mode; }
      S.pins = pins; S.ver++;
    } else if (kind === 'P' || kind === 'A' || kind === 'D') {
      for (const t of rest.split(/\s+/)) {
        const [g, v] = t.split('=');
        if (/^\d+$/.test(g) && /^-?\d+$/.test(v)) S.values[g] = { kind, v: +v, at: Date.now() };
      }
      S.ver++;
    }
  }
  function feed(buf) {
    rx += buf.toString('utf8');
    let i;
    while ((i = rx.search(/\r?\n/)) >= 0) {
      const line = rx.slice(0, i).replace(/\r$/, '');
      rx = rx.slice(rx[i] === '\r' ? i + 2 : i + 1);
      if (!line) continue;
      // agent value lines arrive 20 times a second: keep them out of the log, it stays readable
      if (!/^#[PAD] /.test(line)) push(line);
      parse(line);
    }
    if (rx.length > 4096) rx = '';
  }

  // ---- connect / disconnect
  function connect() {
    clearTimeout(retry);
    const w = S.want;
    if (!w || conn) return;
    rx = '';
    const fail = e => {
      S.open = false; S.error = e.message || String(e); conn = null; S.ver++;
      if (S.want === w) retry = setTimeout(connect, 2000);   // the board may come back (USB reset, reflash)
    };
    if (/^tcp:/i.test(w.port)) {
      const [host, port] = w.port.slice(4).split(':');
      const c = net.connect(+port, host || '127.0.0.1');
      conn = { kind: 'tcp', c, write: s => c.write(s), close: () => c.destroy() };
      c.on('connect', () => { S.open = true; S.since = Date.now(); S.error = null; S.ver++; push(`[connected ${w.port}]`, 'sys'); c.write('?\n'); });
      c.on('data', feed);
      c.on('error', fail);
      c.on('close', () => { if (S.open) push('[closed]', 'sys'); S.open = false; conn = null; S.ver++; if (S.want === w) retry = setTimeout(connect, 2000); });
      return;
    }
    if (!SerialPort) return fail(new Error('serialport is not installed'));
    // hupcl off and DTR/RTS low: opening the port must not reset or hold the board (same as the CYD bridge)
    const p = new SerialPort({ path: w.port, baudRate: w.baud || 115200, autoOpen: false, hupcl: false });
    conn = { kind: 'serial', p, write: s => p.write(s), close: () => new Promise(r => p.isOpen ? p.close(() => r()) : r()) };
    p.open(err => {
      if (err) return fail(new Error(/Access denied|busy|being used/i.test(err.message) ? `${w.port} foglalt · busy (bridge, monitor or a flash job?)` : err.message));
      p.set({ dtr: false, rts: false }, () => {});
      S.open = true; S.since = Date.now(); S.error = null; S.ver++;
      push(`[connected ${w.port} @ ${w.baud || 115200}]`, 'sys');
      setTimeout(() => { if (p.isOpen) p.write('?\n'); }, 300);
    });
    p.on('data', feed);
    p.on('error', e => fail(e));
    p.on('close', () => { if (S.open) push('[closed]', 'sys'); S.open = false; conn = null; S.ver++; if (S.want === w) retry = setTimeout(connect, 2000); });
  }

  async function close() {
    clearTimeout(retry);
    const c = conn; conn = null;
    S.open = false; S.ver++;
    if (c) await c.close();
  }

  return {
    available: !!SerialPort,
    open(port, baud) {
      if (!/^(COM\d{1,3}|tcp:[\w.-]*:\d{2,5})$/i.test(String(port || ''))) throw new Error('pick a port');
      const b = [9600, 57600, 115200, 230400, 460800, 921600].includes(+baud) ? +baud : 115200;
      const w = { port: /^com/i.test(port) ? port.toUpperCase() : port, baud: b };
      return (async () => {
        if (S.want && (S.want.port !== w.port || S.want.baud !== w.baud)) { S.want = null; await close(); reset(); }
        S.want = w; S.error = null; connect();
      })();
    },
    async stop() { S.want = null; await close(); reset(); push('[disconnected]', 'sys'); },
    send(line) {
      const s = String(line || '').replace(/[\r\n]/g, '').slice(0, 200);
      if (!conn || !S.open) throw new Error('not connected');
      conn.write(s + '\n'); push(s, 'out');
    },
    // A firmware job needs this port: close it now, reopen afterwards (returns the reopen function).
    async release(port) {
      if (!S.want || S.want.port !== String(port).toUpperCase()) return () => {};
      const w = S.want;
      S.want = null; await close();
      push(`[released ${w.port} for a firmware job]`, 'sys');
      return () => { if (!S.want) { reset(); S.want = w; connect(); } };
    },
    view(since) {
      const s = +since || 0;
      return {
        want: S.want, open: S.open, since: S.since, error: S.error, lastLineAt: S.lastLineAt, now: Date.now(),
        hello: S.hello, uses: S.uses, pins: S.pins, values: S.values, ver: S.ver,
        seq: S.seq, log: S.log.filter(l => l.seq > s).slice(-500)
      };
    }
  };
}

module.exports = { createLive };
