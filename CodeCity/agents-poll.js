#!/usr/bin/env node
// agents-poll.js — a helper process of CodeCity/companion.js (P4): runs `claude agents --json` (or the configured
// command) every <ms> and prints each answer as one JSON line on stdout. Why a separate process: on this machine
// starting claude.exe freezes the starting process for ~3 s (CreateProcess of a large binary), and the companion
// must not freeze — its terminal, stream and hook endpoint would stall with it. Exits when its parent goes.
//
//   node CodeCity/agents-poll.js <ms> <command> [args...]
'use strict';
const { execFile } = require('child_process');
const [every, exe, ...argv] = process.argv.slice(2);
function go() {
  execFile(exe, argv, { timeout: 20000, windowsHide: true, maxBuffer: 1 << 20 }, (err, out) => {
    if (!err) { try { process.stdout.write(JSON.stringify(JSON.parse(String(out))) + '\n'); } catch (e) { /* not JSON: skip */ } }
    setTimeout(go, Math.max(1000, +every || 6000));
  });
}
go();
process.stdin.on('end', () => process.exit(0));   // the companion closed our stdin, or died
process.stdin.resume();
