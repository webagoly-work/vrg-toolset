'use strict';
// Dependency-free fetch helpers: retrying GET, bounded concurrency, hashing.
const { createHash } = require('node:crypto');

const UA = 'vrg-coreref-harvest/1 (+private toolset)';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function getBuffer(url, { retries = 3, timeoutMs = 30000, accept } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const headers = { 'user-agent': UA };
      if (accept) headers.accept = accept;
      const res = await fetch(url, { headers, signal: ctl.signal, redirect: 'follow' });
      const body = Buffer.from(await res.arrayBuffer());
      if (res.status === 404) return { ok: false, status: 404, url, body: null };
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return { ok: true, status: res.status, url, body, sha256: sha256(body), bytes: body.length };
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, url, body: null, error: String(lastErr && lastErr.message || lastErr) };
}

async function getJson(url, opts) {
  const r = await getBuffer(url, { accept: 'application/json', ...opts });
  if (!r.ok) return r;
  try {
    r.json = JSON.parse(r.body.toString('utf8'));
  } catch (err) {
    return { ok: false, status: r.status, url, error: 'bad JSON: ' + err.message };
  }
  return r;
}

// Run tasks with a fixed worker count; onDone(result, index) is called as each finishes.
async function pool(items, limit, worker, onDone) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  async function run() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
      done++;
      if (onDone) onDone(out[i], i, done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

module.exports = { getBuffer, getJson, pool, sha256 };
