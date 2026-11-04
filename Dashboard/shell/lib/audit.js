// audit.js — append-only JSON lines in <logs>/audit-YYYY-MM-DD.jsonl (CONTRACT §4.1, API.md).
// Never logs a value whose key looks secret, never logs text longer than 200 chars. logDir() is lib/paths.js logs().
'use strict';
const fs = require('fs'), path = require('path');
const paths = require('./paths.js');

const SECRET_KEY = /token|secret|password|code_verifier/i;
const MAX_TEXT = 200, MAX_DEPTH = 4, MAX_KEYS = 30;

const logDir = () => paths.logs();

// a copy of `v` that is safe to write: secrets redacted, long text cut, depth and width limited
function clean(v, depth = 0) {
  if (v === null || typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'string') return v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) + '…[' + v.length + ']' : v;
  if (typeof v !== 'object') return '[' + typeof v + ']';
  if (depth >= MAX_DEPTH) return '[deep]';
  if (Array.isArray(v)) return v.slice(0, MAX_KEYS).map(x => clean(x, depth + 1)).concat(v.length > MAX_KEYS ? ['…[' + v.length + ']'] : []);
  const out = {};
  for (const k of Object.keys(v).slice(0, MAX_KEYS)) {
    const key = k.length > 60 ? k.slice(0, 60) + '…' : k;
    out[key] = SECRET_KEY.test(k) ? '[redacted]' : clean(v[k], depth + 1);
  }
  return out;
}

// createAudit({ dir?: string | () => string, now?: () => Date }) → { write(entry), clean, file() }
function createAudit(opts = {}) {
  const dirOf = typeof opts.dir === 'function' ? opts.dir : () => opts.dir || logDir();
  const now = opts.now || (() => new Date());
  const file = () => path.join(dirOf(), 'audit-' + now().toISOString().slice(0, 10) + '.jsonl');
  function write(entry) {
    try {
      const f = file();
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.appendFileSync(f, JSON.stringify({ t: now().toISOString(), ...clean(entry) }) + '\n');
      return true;
    } catch (e) { return false; }                                   // logging never breaks a call
  }
  return { write, clean, file };
}

module.exports = { createAudit, clean, logDir, SECRET_KEY };
