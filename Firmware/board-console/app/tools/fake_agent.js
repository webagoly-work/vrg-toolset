#!/usr/bin/env node
// fake_agent.js - stands in for a board running enc_test + VrgAgent, for testing the Board
// Console's live link without hardware (the seed of the phase 3b simulator).
//
//   node fake_agent.js [port]          TCP server (default 7801); connect the Console to tcp:127.0.0.1:7801
//   node fake_agent.js 7801 --uses "ENC-1,Q0-A" --extra 5     also report GPIO 5 as an output (a pin on no
//                                                              ENC connector, to test the warnings)
//
// It speaks the agent protocol (see VrgAgent.h): HELLO, USES, PINS, then #P changes at up to 20 Hz.
// Every 1.5 s it turns the "knob" one click (a CLK/DT quadrature sequence) and prints "pos N";
// every 5th click it presses the button. '?' resends everything.

'use strict';
const net = require('net');
const argv = process.argv.slice(2);
const port = Number(argv.find(a => /^\d+$/.test(a)) || 7801);
const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const USES = opt('uses') || 'ENC-1';
const EXTRA = opt('extra');

net.createServer(sock => {
  const pins = { 39: 1, 40: 1, 41: 1 };
  if (EXTRA) pins[EXTRA] = 0;
  let pos = 0, timers = [];
  const send = l => { if (!sock.destroyed) sock.write(l + '\n'); };
  const hello = () => {
    send('#HELLO vrg-agent 1 fw=enc_test ver=1.1 chip=ESP32-S3 mac=f4:12:fa:00:be:ef setup=Encoder_teszt');
    send(`#USES ${USES}`);
    send(`#PINS 39:IN_PU 40:IN_PU 41:IN_PU${EXTRA ? ` ${EXTRA}:OUT` : ''}`);
    send('#P ' + Object.entries(pins).map(([g, v]) => `${g}=${v}`).join(' '));
  };
  const set = (g, v) => { pins[g] = v; send(`#P ${g}=${v}`); };
  console.log('Console connected');
  send('enc_test ready: turn or press the knob');
  hello();
  // one detent: 11 -> 01 -> 00 -> 10 -> 11 on CLK/DT, 50 ms apart
  timers.push(setInterval(() => {
    const seq = [[0, 1], [0, 0], [1, 0], [1, 1]];
    seq.forEach(([c, d], i) => timers.push(setTimeout(() => { set(39, c); set(40, d); }, i * 50)));
    timers.push(setTimeout(() => {
      pos++; send(`pos ${pos}`);
      if (EXTRA) set(EXTRA, pos % 2);
      if (pos % 5 === 0) { set(41, 0); send('press'); timers.push(setTimeout(() => { set(41, 1); send('release'); }, 400)); }
    }, 220));
  }, 1500));
  let rx = '';
  sock.on('data', b => {
    rx += b.toString();
    let i;
    while ((i = rx.indexOf('\n')) >= 0) {
      const l = rx.slice(0, i).trim(); rx = rx.slice(i + 1);
      if (l === '?') hello(); else if (l) send(`echo: ${l}`);
    }
  });
  const end = () => { timers.forEach(t => { clearInterval(t); clearTimeout(t); }); console.log('Console disconnected'); };
  sock.on('close', end);
  sock.on('error', () => {});
}).listen(port, '127.0.0.1', () => console.log(`fake agent on tcp:127.0.0.1:${port}`));
