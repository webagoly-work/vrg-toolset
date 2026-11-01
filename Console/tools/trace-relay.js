#!/usr/bin/env node
/* Local relay between the trace hook and the trace view. Loopback only. Every call needs the code
   printed at start (also in traces/.code for the hook), because any web page can reach a local port.
     node Console/tools/trace-relay.js     http://127.0.0.1:8134 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { keepDays, prune } from './trace-retention.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRACES = process.env.VC_TRACE_DIR || path.join(HERE, '..', 'traces');
const PAGE = path.join(HERE, '..', 'dist', 'vrg-trace.html');
const PORT = Number(process.env.VC_TRACE_PORT || 8134);
const GATE_MS = 100000;
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const ORIGINS = new Set(['http://127.0.0.1:8133', 'http://localhost:8133', `http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, 'https://localhost', 'null']);

fs.mkdirSync(TRACES, { recursive: true });
const CODE = crypto.randomBytes(9).toString('base64url');
fs.writeFileSync(path.join(TRACES, '.code'), CODE + '\n', { mode: 0o600 });

const viewers = new Set();
const gates = new Map();
const prompts = new Map();
const configFile = path.join(TRACES, 'config.json');
const config = () => ({ keepDays: keepDays(TRACES) });

const safeSid = (s) => String(s ?? '').replace(/[^\w-]/g, '');
const record = (ev) => {
  if (safeSid(ev.sid)) fs.appendFileSync(path.join(TRACES, safeSid(ev.sid) + '.jsonl'), JSON.stringify(ev) + '\n');
};
const broadcast = (ev) => { for (const v of viewers) v.write(`data: ${JSON.stringify(ev)}\n\n`); };
const announce = (ev) => { record(ev); broadcast(ev); };

function sameCode(given) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(CODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const readBody = (req) => new Promise((resolve, reject) => {
  let text = '';
  req.setEncoding('utf8');
  req.on('data', (d) => { text += d; if (text.length > 1 << 20) req.destroy(); });
  req.on('end', () => { try { resolve(text ? JSON.parse(text) : {}); } catch (e) { reject(e); } });
  req.on('error', reject);
});

function sessions() {
  return fs.readdirSync(TRACES).filter((f) => f.endsWith('.jsonl')).map((f) => {
    const st = fs.statSync(path.join(TRACES, f));
    return { id: f.slice(0, -6), size: st.size, updatedAt: st.mtimeMs };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

const routes = {
  'GET /ping': () => ({ ok: true, ...config() }),
  'GET /sessions': () => sessions(),
  'GET /session': (url) => {
    const file = path.join(TRACES, safeSid(url.searchParams.get('id')) + '.jsonl');
    return { text: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '' };
  },
  'GET /next': (url) => {
    const q = prompts.get(url.searchParams.get('sid')) ?? [];
    return { text: q.shift() ?? null };
  },
  'POST /event': (url, body) => { broadcast(body); return { ok: true }; },
  'POST /prompt': (url, { sid, text }) => {
    if (!prompts.has(sid)) prompts.set(sid, []);
    prompts.get(sid).push(String(text).slice(0, 8000));
    return { ok: true };
  },
  'POST /answer': (url, { callId, decision, note }) => {
    if (decision !== 'allow' && decision !== 'deny') return { ok: false };
    const g = gates.get(callId);
    if (!g) return { ok: false };
    g.finish({ decision, note: String(note ?? '').slice(0, 2000) });
    return { ok: true };
  },
  'POST /retention': (url, { keepDays }) => {
    const days = Math.max(1, Math.min(365, Number(keepDays) || 14));
    fs.writeFileSync(configFile, JSON.stringify({ keepDays: days }));
    prune(TRACES, days);
    return { ok: true, keepDays: days };
  },
};

/* The hook waits on this request until the page answers. With nobody watching it returns at once. */
function holdGate(ev, res) {
  if (!viewers.size) return send(res, 200, {});
  let timer = null;
  const finish = (answer) => {
    clearTimeout(timer);
    gates.delete(ev.callId);
    announce({ v: ev.v, t: Date.now(), sid: ev.sid, kind: 'resolved', callId: ev.callId, decision: answer.decision ?? 'timeout' });
    send(res, 200, answer);
  };
  gates.set(ev.callId, { finish });
  timer = setTimeout(() => finish({}), GATE_MS);
  res.on('close', () => { if (gates.has(ev.callId)) finish({}); });
  announce({ ...ev, kind: 'pending', t: Date.now() });
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (!HOSTS.has(req.headers.host)) { res.writeHead(403); return res.end(); }
  const { origin } = req.headers;
  if (origin) {
    if (!ORIGINS.has(origin)) { res.writeHead(403); return res.end(); }
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-headers', 'content-type, x-trace-code');
    res.setHeader('vary', 'origin');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/') {
    /* a page from elsewhere cannot read this response, so the code in it stays here */
    fs.readFile(PAGE, 'utf8', (err, html) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('dist/vrg-trace.html is missing: npm run build:trace'); }
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
        'content-security-policy': "frame-ancestors 'self' http://127.0.0.1:* http://localhost:*",
      });
      res.end(html.replace('<head>', `<head><meta name="trace-code" content="${CODE}">`));
    });
    return undefined;
  }

  if (!sameCode(req.headers['x-trace-code'] ?? url.searchParams.get('code'))) return send(res, 401, {});

  if (req.method === 'GET' && url.pathname === '/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': hello\n\n');
    viewers.add(res);
    const beat = setInterval(() => res.write(': beat\n\n'), 20000);
    req.on('close', () => { clearInterval(beat); viewers.delete(res); });
    return undefined;
  }
  try {
    if (req.method === 'POST' && url.pathname === '/gate') return holdGate(await readBody(req), res);
    const route = routes[`${req.method} ${url.pathname}`];
    if (!route) return send(res, 404, {});
    return send(res, 200, route(url, req.method === 'POST' ? await readBody(req) : null));
  } catch {
    return send(res, 400, {});
  }
});

prune(TRACES, keepDays(TRACES));
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Trace relay on http://127.0.0.1:${PORT}`);
  console.log(`Pairing code: ${CODE}`);
});
