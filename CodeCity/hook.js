#!/usr/bin/env node
// hook.js — Claude Code hook for VRG Kódváros (live workspace P4, KV-10; CITY-D11 A). Registered as a
// PreToolUse / PostToolUse command hook in the gitignored .claude/settings.local.json (only after the user
// said yes). It reads the hook's JSON from stdin, keeps ONLY the session id, the tool's kind and the paths it
// names (sessions.js callPaths — no prompt, no file content, no search pattern, no command), and POSTs that
// to the Kódváros segéd on 127.0.0.1. Then it exits 0, silently, whatever happened: with the city closed
// the POST fails in a few ms and Claude goes on as if there were no hook. It never blocks (CITY-D16 A).
//
//   node CodeCity/hook.js pre|post            (stdin: the hook input JSON)
//   KV_HOOK_PORT=8797 (default) · KV_HOOK_DEBUG=1 prints what it would send and why it did not
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');

const phase = process.argv[2] === 'post' ? 'post' : 'pre';
const PORT = Number(process.env.KV_HOOK_PORT || 8797);
const DEBUG = process.env.KV_HOOK_DEBUG === '1';
const done = why => { if (DEBUG && why) process.stderr.write('kodvaros hook: ' + why + '\n'); process.exit(0); };
setTimeout(() => done('timeout'), 1500).unref();   // never hold Claude up

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; if (raw.length > 4 << 20) done('input too big'); });
process.stdin.on('end', () => {
  let h;
  try { h = JSON.parse(raw); } catch (e) { return done('not JSON'); }
  let calls;
  try { calls = require('./sessions.js').callPaths({ name: h.tool_name, input: h.tool_input || {} }); } catch (e) { return done('filter: ' + e.message); }
  if (!calls || !calls.length) return done('not a path tool');
  const cwd = typeof h.cwd === 'string' ? h.cwd : process.cwd();
  const body = JSON.stringify({ sid: String(h.session_id || '').slice(0, 8), event: phase, kind: calls[0].kind,
    paths: calls.slice(0, 20).map(c => path.resolve(cwd, c.p)) });
  let token;
  try { token = fs.readFileSync(path.join(__dirname, '.companion-token'), 'utf8').trim(); } catch (e) { return done('no token (the segéd never ran)'); }
  if (DEBUG) process.stderr.write('kodvaros hook: ' + body + '\n');
  const r = http.request({ host: '127.0.0.1', port: PORT, method: 'POST', path: '/api/hook', timeout: 800,
    headers: { Host: '127.0.0.1:' + PORT, 'Content-Type': 'application/json', 'X-Kodvaros-Token': token } },
  res => { res.resume(); res.on('end', () => done(res.statusCode === 200 ? '' : 'segéd said ' + res.statusCode)); });
  r.on('timeout', () => { r.destroy(); done('segéd timeout'); });
  r.on('error', () => done('segéd not running'));
  r.end(body);
});
