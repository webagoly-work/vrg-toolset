#!/usr/bin/env node
/* "Claude is done / Claude needs you": the trace hook starts this, detached, when a session's state
   (www/js/trace/state.js) turns blocked or a long turn ends. It waits, re-reads the session's trace and
   only speaks if nothing happened meanwhile, so a prompt you answer in two seconds stays silent:
     after soundDelaySec   a short 8-bit chime on this PC (Windows; made here, no third-party audio)
     after phoneDelaySec   a notice to the paired phones via the phone relay's POST /notify (VRG Mobile
                           Értesítések, WP M10) — only when the relay runs, from this PC only
   Settings: traces/notify.json { sound, phone, doneAfterSec, soundDelaySec, phoneDelaySec, port }.
   VC_NOTIFY=0 turns it all off. It always exits 0.
     node Console/tools/agent-notify.js --sid <8> --kind done|blocked --at <ms> [--where <folder>] [--text <…>] */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseJsonl } from '../www/js/trace/events.js';
import { sessionState, stillHolds } from '../www/js/trace/state.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TRACES = process.env.VC_TRACE_DIR || path.join(HERE, '..', 'traces');
export const DEFAULTS = { sound: true, phone: true, doneAfterSec: 60, soundDelaySec: 5, phoneDelaySec: 30, port: 47291 };
const TAIL = 512 << 10;

export function settings(dir = TRACES) {
  let own = {};
  try { own = JSON.parse(fs.readFileSync(path.join(dir, 'notify.json'), 'utf8')); } catch { /* defaults */ }
  const s = { ...DEFAULTS, ...own };
  if (process.env.VC_NOTIFY === '0') { s.sound = false; s.phone = false; }
  return s;
}

/* A worktree is named by its worktree folder, anything else by its last folder. */
export function where(cwd) {
  const parts = String(cwd ?? '').split(/[\\/]+/).filter(Boolean);
  const wt = parts.lastIndexOf('worktrees');
  const name = wt >= 0 && parts[wt - 1] === '.claude' && parts[wt + 1] ? parts[wt + 1] : parts.at(-1) ?? '';
  return name.slice(0, 40);
}

const WHY = { permission: 'engedélyre vár', question: 'kérdez', plan: 'tervet hagyna jóvá', approval: 'jóváhagyásra vár' };
const mins = (ms) => (ms >= 90000 ? `${Math.round(ms / 60000)} perc` : `${Math.max(1, Math.round(ms / 1000))} mp`);

/* -> the relay's notice body { title, text, level, from } */
export function message({ kind, why, ms, where: w, text }) {
  const at = w ? ` · ${w}` : '';
  const body = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (kind === 'done') return { title: `Claude kész${at}`, text: [`${mins(ms || 0)} munka után.`, body].filter(Boolean).join(' ').slice(0, 300), level: 'good', from: 'claude' };
  return { title: `Claude vár rád${at}`, text: `A munkamenet ${WHY[why] ?? 'rád vár'}${body ? ': ' + body : '.'}`.slice(0, 300), level: 'info', from: 'claude' };
}

/* A chime as an 8-bit mono WAV: square-wave notes, a fade on each so nothing clicks. */
export function chime(kind, rate = 22050) {
  const notes = kind === 'done'
    ? [[523.25, 0.07], [659.25, 0.07], [783.99, 0.07], [1046.5, 0.16]]
    : [[880, 0.09], [0, 0.05], [659.25, 0.09], [0, 0.05], [880, 0.09], [0, 0.05], [659.25, 0.12]];
  const samples = [];
  for (const [f, sec] of notes) {
    const n = Math.round(sec * rate);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / 60, (n - i) / 400);
      const sq = f ? (Math.floor((2 * f * i) / rate) % 2 ? 1 : -1) : 0;
      samples.push(128 + Math.round(sq * env * 40));
    }
  }
  const data = Buffer.from(samples);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/* traces/sounds/<kind>.wav; a file you put there yourself is used as it is */
export function soundFile(kind, dir = TRACES) {
  const file = path.join(dir, 'sounds', kind + '.wav');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, chime(kind));
  }
  return file;
}

function play(file) {
  if (process.platform !== 'win32') return Promise.resolve();
  const ps = `(New-Object Media.SoundPlayer '${file.replace(/'/g, "''")}').PlaySync()`;
  return new Promise((resolve) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore', windowsHide: true });
    const timer = setTimeout(() => { p.kill(); resolve(); }, 8000);
    p.on('exit', () => { clearTimeout(timer); resolve(); });
    p.on('error', () => { clearTimeout(timer); resolve(); });
  });
}

function phone(port, body) {
  const text = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1', port, path: '/notify', method: 'POST', timeout: 3000,
      headers: { Host: `localhost:${port}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) },
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end(text);
  });
}

export function readState(sid, dir = TRACES) {
  const file = path.join(dir, String(sid).replace(/[^\w-]/g, '') + '.jsonl');
  try {
    const fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const buf = Buffer.alloc(Math.min(TAIL, size));
    fs.readSync(fd, buf, 0, buf.length, size - buf.length);
    fs.closeSync(fd);
    return sessionState(parseJsonl(buf.toString('utf8')));
  } catch { return null; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* The whole run; `io` is replaced by the test. -> what it did: ['sound', 'phone'] */
export async function run(a, { dir = TRACES, io = { play, phone, sleep } } = {}) {
  const s = settings(dir);
  const did = [];
  const at = Number(a.at);
  const holds = () => { const st = readState(a.sid, dir); return st && stillHolds(st, a.kind, at); };
  const steps = [];
  if (s.sound) steps.push([s.soundDelaySec, 'sound']);
  if (s.phone) steps.push([s.phoneDelaySec, 'phone']);
  steps.sort((x, y) => x[0] - y[0]);
  let waited = 0;
  for (const [sec, what] of steps) {
    await io.sleep(Math.max(0, sec - waited) * 1000);
    waited = Math.max(waited, sec);
    if (!holds()) break;
    if (what === 'sound') await io.play(soundFile(a.kind, dir));
    else if ((await io.phone(s.port, message({ ...a, ms: Number(a.ms) || 0 }))) !== 200) continue;
    did.push(what);
  }
  return did;
}

export function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] ?? '';
  return a;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = parseArgs(process.argv.slice(2));
  if (!a.sid || !['done', 'blocked'].includes(a.kind)) process.exit(0);
  run(a).catch(() => {}).finally(() => process.exit(0));
}
