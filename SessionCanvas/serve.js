#!/usr/bin/env node
/* VRG Munkavászon - live server. Serves the page and tails Claude Code's session transcripts to it.
     node SessionCanvas/serve.js [--port 8809] [--dir <claude config dir>]...     http://localhost:8809

   Reads, never writes: <config>/projects/<project>/<session>.jsonl and its <session>/subagents/*.jsonl.
   Config dirs: --dir, VRG_CLAUDE_DIRS (path-list), CLAUDE_CONFIG_DIR, ~/.claude, and the second account
   at <full>/home/claude-account-b (GO-MAIN). Loopback only, and the Host header must be this port's, so a
   web page cannot read transcripts through a rebound DNS name; no CORS headers, so no other origin can either.
   GET /api/sessions             the newest 80 sessions across the config dirs
   GET /api/stream?f=<id>        SSE: hello, the file's lines in batches, ready, then every appended line
   GET /api/img?f=<id>&p=<path>  an image file a tool saved or sent (screenshots, SendUserFile): only a png / jpg /
                                 gif / webp / bmp whose exact path is written in that session's transcript or one of
                                 its subagents' (images a tool returned are in the transcript already) */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');

const HERE = __dirname, REPO = path.resolve(HERE, '..'), FULL = path.dirname(REPO);
const PAGE = path.join(HERE, 'vrg-munkavaszon.html');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const PORT = Number(arg('--port') || process.env.VRG_CANVAS_PORT || 8809);
const POLL_MS = 600, BATCH = 400;

function roots() {
  const cand = [];
  argv.forEach((a, i) => { if (a === '--dir' && argv[i + 1]) cand.push(['', argv[i + 1]]); });
  (process.env.VRG_CLAUDE_DIRS || '').split(path.delimiter).filter(Boolean).forEach((d) => cand.push(['', d]));
  if (process.env.CLAUDE_CONFIG_DIR) cand.push(['', process.env.CLAUDE_CONFIG_DIR]);
  cand.push(['A', path.join(os.homedir(), '.claude')]);
  cand.push(['B', path.join(FULL, 'home', 'claude-account-b')]);
  const seen = new Set(), out = [];
  cand.forEach(([acc, d]) => {
    const r = path.resolve(d);
    if (seen.has(r.toLowerCase()) || !fs.existsSync(path.join(r, 'projects'))) return;
    seen.add(r.toLowerCase()); out.push({ dir: r, account: acc || (/account-b/i.test(r) ? 'B' : '') });
  });
  return out;
}
const ROOTS = roots();

/* a session id for the page: <root index>/<project folder>/<file>; resolved back and checked below */
function resolveId(id) {
  const m = /^(\d+)\/([^/\\]+)\/([^/\\]+\.jsonl)$/.exec(String(id || ''));
  if (!m || !ROOTS[+m[1]] || m[2].startsWith('.') || m[3].startsWith('.')) return null;
  const projects = path.join(ROOTS[+m[1]].dir, 'projects');
  const file = path.resolve(projects, m[2], m[3]);
  return file.startsWith(projects + path.sep) && fs.existsSync(file) ? file : null;
}

const IMG = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
const texts = new Map(); // file -> { m, text, cwd }: the last few transcripts read whole, for /api/img
function sessionText(file) {
  const st = fs.statSync(file), c = texts.get(file);
  if (c && c.m === st.mtimeMs) return c;
  let text = fs.readFileSync(file, 'utf8');
  const sub = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
  try { fs.readdirSync(sub).filter((f) => f.endsWith('.jsonl')).forEach((f) => { text += '\n' + fs.readFileSync(path.join(sub, f), 'utf8'); }); } catch { /* none */ }
  const m = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(text);
  let cwd = ''; try { cwd = m ? JSON.parse('"' + m[1] + '"') : ''; } catch { /* odd cwd */ }
  const v = { m: st.mtimeMs, text, cwd };
  texts.set(file, v);
  if (texts.size > 4) texts.delete(texts.keys().next().value);
  return v;
}
function image(res, file, p) {
  const type = IMG[path.extname(p).toLowerCase()];
  if (!type) { res.writeHead(415).end('not an image'); return; }
  const s = sessionText(file);
  if (!s.text.includes(JSON.stringify(p).slice(1, -1))) { res.writeHead(403).end('not in this session'); return; }
  const abs = path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p) ? p : path.resolve(s.cwd || REPO, p);
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile() || st.size > 30 * 1024 * 1024) { res.writeHead(404).end('no such image'); return; }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(abs).pipe(res);
  });
}

const titles = new Map();
function titleOf(file) {
  if (titles.has(file)) return titles.get(file);
  let title = '', cwd = '';
  try {
    const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(256 * 1024);
    const n = fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
    for (const line of buf.toString('utf8', 0, n).split('\n')) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (!cwd && e.cwd) cwd = e.cwd;
      if (e.type !== 'user' || e.isMeta) continue;
      const c = e.message && e.message.content, text = typeof c === 'string' ? c : Array.isArray(c) ? (c.find((b) => b.type === 'text') || {}).text || '' : '';
      if (text && !/^\s*</.test(text)) { title = text.replace(/\s+/g, ' ').trim().slice(0, 90); break; }
    }
  } catch { /* unreadable: no title */ }
  if (title) titles.set(file, { title, cwd });
  return { title, cwd };
}

function sessions() {
  const out = [];
  ROOTS.forEach((r, ri) => {
    const projects = path.join(r.dir, 'projects');
    let dirs = []; try { dirs = fs.readdirSync(projects, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return; }
    dirs.forEach((d) => {
      let files = []; try { files = fs.readdirSync(path.join(projects, d.name)).filter((f) => f.endsWith('.jsonl')); } catch { return; }
      files.forEach((f) => {
        const full = path.join(projects, d.name, f);
        let st; try { st = fs.statSync(full); } catch { return; }
        if (!st.size) return;
        out.push({ file: `${ri}/${d.name}/${f}`, full, id: f.replace(/\.jsonl$/, ''), mtime: st.mtimeMs, size: st.size, account: r.account, dir: d.name });
      });
    });
  });
  out.sort((a, b) => b.mtime - a.mtime);
  return out.slice(0, 80).map((s) => {
    const t = titleOf(s.full);
    const project = t.cwd ? t.cwd.split(/[\\/]/).filter(Boolean).slice(-1)[0] : s.dir.replace(/^-+/, '').split('-').slice(-2).join('-');
    return { file: s.file, id: s.id, mtime: s.mtime, size: s.size, account: s.account, project, title: t.title };
  });
}

/* one tailed file: an offset and the unfinished last line */
function tailer(file, agent) {
  return { file, agent, off: 0, rest: '' };
}
function readNew(t) {
  let st; try { st = fs.statSync(t.file); } catch { return null; }
  if (st.size < t.off) return { reset: true };
  if (st.size === t.off) return [];
  const fd = fs.openSync(t.file, 'r'), len = st.size - t.off, buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, t.off); fs.closeSync(fd);
  t.off = st.size;
  const text = t.rest + buf.toString('utf8'), lines = text.split('\n');
  t.rest = lines.pop();
  return lines.filter((l) => l.trim());
}

function stream(req, res, file) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  const send = (obj, ev) => res.write((ev ? `event: ${ev}\n` : '') + `data: ${JSON.stringify(obj)}\n\n`);
  send({ now: Date.now(), file: path.basename(file) }, 'hello');
  const subDir = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
  const tails = [tailer(file, 'root')], known = new Set();
  let closed = false, ready = false;
  const pump = () => {
    if (closed) return;
    try { fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).forEach((f) => {
      if (!known.has(f)) { known.add(f); tails.push(tailer(path.join(subDir, f), f.replace(/\.jsonl$/, ''))); }
    }); } catch { /* no subagents yet */ }
    for (const t of tails) {
      const got = readNew(t);
      if (got && got.reset) { send({ reset: true }); res.end(); closed = true; return; }
      if (!got) continue;
      for (let i = 0; i < got.length; i += BATCH) send({ agent: t.agent, lines: got.slice(i, i + BATCH) });
    }
    if (!ready) { ready = true; send({}, 'ready'); }
  };
  pump();
  const timer = setInterval(pump, POLL_MS), beat = setInterval(() => res.write(': beat\n\n'), 15000);
  req.on('close', () => { closed = true; clearInterval(timer); clearInterval(beat); });
}

const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);
const server = http.createServer((req, res) => {
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) { res.writeHead(403).end('host'); return; }
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/' || u.pathname === '/vrg-munkavaszon.html' || u.pathname === '/index.html') {
    fs.readFile(PAGE, (err, buf) => {
      if (err) { res.writeHead(500).end('page missing'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(buf);
    });
    return;
  }
  if (u.pathname === '/api/sessions') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ roots: ROOTS.map((r) => r.account || path.basename(r.dir)), sessions: sessions() }));
    return;
  }
  if (u.pathname === '/api/img') {
    const file = resolveId(u.searchParams.get('f'));
    if (!file) { res.writeHead(404).end('no such session'); return; }
    image(res, file, u.searchParams.get('p') || '');
    return;
  }
  if (u.pathname === '/api/stream') {
    const file = resolveId(u.searchParams.get('f'));
    if (!file) { res.writeHead(404).end('no such session'); return; }
    stream(req, res, file);
    return;
  }
  res.writeHead(404).end('not found');
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is in use: is the Munkavaszon already running?` : e.message); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => {
  console.log(`VRG Munkavaszon on http://localhost:${PORT}`);
  console.log(ROOTS.length ? 'Transcripts: ' + ROOTS.map((r) => r.dir).join(' | ') : 'No Claude Code config dir with projects/ found (use --dir).');
});
