// fake-claude.js — stands in for Claude Code in tests (VRG_CLAUDE_BIN).
// Plain mode (WP-16): prints its argv and CLAUDE_CONFIG_DIR, exits 0.
// With `--output-format stream-json` (WP-23): reads stdin, then prints stream-sample.jsonl line by line with 20 ms gaps; the first 20 chars of
// stdin go into the first text delta; `--resume X` keeps session_id X. Env: FAKE_CLAUDE_FAIL=auth → stderr "Please run /login", exit 1;
// FAKE_CLAUDE_SLEEP=<ms> → wait that long before the first line; FAKE_CLAUDE_LOG=<file> → write {argv, stdin, configDir} as JSON there.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);

if (!argv.includes('stream-json')) {
  console.log('FAKE_CLAUDE ' + argv.join('|'));
  console.log('CLAUDE_CONFIG_DIR=' + (process.env.CLAUDE_CONFIG_DIR || ''));
  process.exit(0);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', async () => {
  if (process.env.FAKE_CLAUDE_LOG) {
    fs.writeFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ argv, stdin: input, configDir: process.env.CLAUDE_CONFIG_DIR || null, hasConfigDir: 'CLAUDE_CONFIG_DIR' in process.env }));
  }
  if (process.env.FAKE_CLAUDE_FAIL === 'auth') { process.stderr.write('Please run /login\n'); process.exit(1); }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (process.env.FAKE_CLAUDE_SLEEP) await wait(Number(process.env.FAKE_CLAUDE_SLEEP) || 0);
  const i = argv.indexOf('--resume');
  const session = i >= 0 ? argv[i + 1] : null;
  const echo = input.slice(0, 20);
  const lines = fs.readFileSync(path.join(__dirname, 'stream-sample.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean);
  for (const l of lines) {
    let out = l.split('@@ECHO@@').join(JSON.stringify(echo).slice(1, -1));
    if (session) out = out.split('sess-demo-1').join(session);
    process.stdout.write(out + '\n');
    await wait(20);
  }
  process.exit(0);
});
