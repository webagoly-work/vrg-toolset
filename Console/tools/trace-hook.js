#!/usr/bin/env node
/* Claude Code command hook for the Varler Console trace view. Reads the hook JSON from stdin, turns
   it into a trace event, scrubs it, appends it to traces/<session>.jsonl and tells the relay.
   It always exits 0 and never holds a session up: with the relay closed it only writes the file.
     node Console/tools/trace-hook.js                      observe only
     node Console/tools/trace-hook.js --gate=Bash,Write    those tools wait for Approve or Deny
   With no answer the hook says nothing and Claude Code's own permission flow decides. */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fromHook, transcriptOf, usageFromTail } from '../www/js/trace/events.js';
import { scrubEvent } from '../www/js/trace/privacy.js';
import { ASK_TOOLS, emptyState, noticeFor, step } from '../www/js/trace/state.js';
import { readState, settings, where } from './agent-notify.js';
import { keepDays, prune } from './trace-retention.js';

const TRACES = process.env.VC_TRACE_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'traces');
const PORT = Number(process.env.VC_TRACE_PORT || 8134);
const GATE_MS = 110000;
const TAIL = 65536;
const gate = (process.argv.find((a) => a.startsWith('--gate=')) ?? '').slice(7).split(',').filter(Boolean);

const quit = () => process.exit(0);
const lines = (name) => {
  try { return fs.readFileSync(path.join(TRACES, name), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean); } catch { return []; }
};

function tail(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const buf = Buffer.alloc(Math.min(TAIL, size));
    fs.readSync(fd, buf, 0, buf.length, size - buf.length);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch { return ''; }
}

function relay(route, body, timeout, method = 'POST') {
  const code = lines('.code')[0];
  if (!code) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: route, method, timeout,
      headers: { Host: `127.0.0.1:${PORT}`, 'content-type': 'application/json', 'x-trace-code': code },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { text += d; });
      res.on('end', () => { try { resolve(JSON.parse(text)); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

/* The events that can make a session blocked or done; only these pay for reading its trace. */
const watched = (ev) => ev.kind === 'stop' || ev.kind === 'notice' || (ev.kind === 'call' && ASK_TOOLS.has(ev.tool));
const NOTIFY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-notify.js');

/* A change worth a ping starts agent-notify.js on its own; it waits and checks again before it speaks. */
function maybeNotify(hook, ev, before) {
  const s = settings(TRACES);
  if (!s.sound && !s.phone) return;
  const n = noticeFor(before, step(before, ev), ev, { doneAfterMs: s.doneAfterSec * 1000 });
  if (!n) return;
  const text = n.kind === 'done' ? ev.output
    : ev.kind === 'notice' ? (/ to use (.+)$/.exec(ev.text)?.[1] ?? ev.text)
      : (/"question":"((?:[^"\\]|\\.)*)"/.exec(ev.text)?.[1] ?? '');
  const args = [NOTIFY, '--sid', ev.sid, '--kind', n.kind, '--at', String(ev.t), '--where', where(hook.cwd),
    '--why', n.why ?? '', '--ms', String(n.ms ?? 0), '--text', String(text ?? '').slice(0, 200)];
  spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true, env: process.env }).unref();
}

async function main(raw) {
  const hook = JSON.parse(raw);
  const event = fromHook(hook);
  if (!event || !event.sid) return;
  if (['result', 'stop', 'agent-stop'].includes(event.kind) && transcriptOf(hook)) event.usage = usageFromTail(tail(transcriptOf(hook))) ?? undefined;
  const clean = scrubEvent(event, lines('names.txt'));
  const before = watched(clean) ? readState(clean.sid, TRACES) ?? emptyState() : null;
  fs.mkdirSync(TRACES, { recursive: true });
  fs.appendFileSync(path.join(TRACES, clean.sid.replace(/[^\w-]/g, '') + '.jsonl'), JSON.stringify(clean) + '\n');
  if (clean.kind === 'prompt') prune(TRACES, keepDays(TRACES));
  await relay('/event', clean, 400);
  if (clean.kind === 'call' && gate.includes(clean.tool)) {
    const a = await relay('/gate', clean, GATE_MS);
    if (a?.decision) {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: a.decision, permissionDecisionReason: a.note || 'Varler Console' } }));
    }
  }
  let resumed = false;
  if (clean.kind === 'stop') {
    const next = await relay('/next?sid=' + encodeURIComponent(clean.sid), null, 400, 'GET');
    if (next?.text) { resumed = true; process.stdout.write(JSON.stringify({ decision: 'block', reason: next.text })); }
  }
  if (before && !resumed) { try { maybeNotify(hook, clean, before); } catch { /* a ping is never worth a failed hook */ } }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; if (raw.length > 8 << 20) quit(); });
process.stdin.on('end', () => main(raw).catch(() => {}).finally(quit));
process.stdin.on('error', quit);
