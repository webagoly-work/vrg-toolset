#!/usr/bin/env node
// claude-stub.js — stands in for `claude` in Mobile/tests/relay-claude.js (VRG_CLAUDE_BIN). Never the real CLI.
// `remote-control --name <n>`: after a short pause prints a fake session link (with ANSI colour, as a terminal would get), then
// waits until it is killed. Anything else, or STUB_FAIL=1: prints an error and exits 1. The env it saw goes to the first line.
'use strict';
const a = process.argv.slice(2);
console.log('stub cwd=' + process.cwd() + ' config=' + (process.env.CLAUDE_CONFIG_DIR || '-') + ' args=' + JSON.stringify(a));
if (a[0] !== 'remote-control' || a[1] !== '--name' || !a[2] || process.env.STUB_FAIL === '1') {
  console.error('Error: Remote Control is not enabled for this account');
  process.exit(1);
}
setTimeout(() => {
  const id = 'session_01STUB' + process.pid;
  process.stdout.write('\x1b[1mRemote Control\x1b[0m ready: \x1b[36mhttps://claude.ai/code/' + id + '?name=' + encodeURIComponent(a[2]) + '\x1b[0m\n');
}, 300);
setInterval(() => {}, 1 << 30);
