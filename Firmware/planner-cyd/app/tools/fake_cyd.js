#!/usr/bin/env node
// fake_cyd.js - stands in for the CYD while testing the bridge.
//
//   node fake_cyd.js [port]                       print every line the bridge sends (default port 7788)
//   node fake_cyd.js 7788 --script "2000:!P|0,3500:!T|0"   also press buttons: ms-after-connect:line
//   node fake_cyd.js 7788 --quit 6000             exit after 6 s (for scripted runs)
//
// Then: node ../bridge/bridge.js --demo --tcp 127.0.0.1:7788
// Typed lines (e.g. !C|undo) are sent to the bridge as button presses.

'use strict';
const net = require('net');
const argv = process.argv.slice(2);
const port = Number(argv.find(a => /^\d+$/.test(a)) || 7788);
const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const script = (opt('script') || '').split(',').filter(Boolean).map(s => {
  const i = s.indexOf(':');
  return { at: Number(s.slice(0, i)), line: s.slice(i + 1) };
});
const quit = Number(opt('quit') || 0);

const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
let sock = null;

net.createServer(s => {
  sock = s;
  console.log(`${stamp()}  [bridge connected]`);
  s.write('#HELLO planner_cyd 1 (fake)\n');
  script.forEach(x => setTimeout(() => { console.log(`${stamp()}  <<< ${x.line}`); s.write(x.line + '\n'); }, x.at));
  let rx = '';
  s.setEncoding('utf8');   // the bridge sends UTF-8 (Hungarian letters)
  s.on('data', b => {
    rx += b;
    let i;
    while ((i = rx.indexOf('\n')) >= 0) {
      const line = rx.slice(0, i);
      rx = rx.slice(i + 1);
      if (!/^L\|/.test(line) || argv.includes('--beats')) console.log(`${stamp()}  ${line}`);
    }
  });
  s.on('close', () => { console.log(`${stamp()}  [bridge gone]`); sock = null; });
  s.on('error', () => {});
}).listen(port, '127.0.0.1', () => console.log(`fake CYD listening on 127.0.0.1:${port}`));

process.stdin.on('data', d => { if (sock) d.toString().split(/\r?\n/).filter(Boolean).forEach(l => sock.write(l + '\n')); });
if (quit) setTimeout(() => process.exit(0), quit);
