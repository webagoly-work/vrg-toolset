// VRG Időjárás — the one way out to the network.
//
// Every request is logged in fetch_log with its HTTP status, size, cache headers and error. It is polite
// by construction: an identifying User-Agent (MET Norway requires it), If-None-Match / If-Modified-Since
// from the previous good fetch, and no request at all while the previous answer's Expires is in the
// future. The raw answer is kept gzipped in data/raw/<source>/<day>/ for the audit and for replays
// (rawDays in settings.retention).
//
// Replay: with ctx.replay = a folder, nothing goes to the network. The answer is read from
// <folder>/<source>__<place>.<ext> or <folder>/<source>.<ext>; that is how the tests and the offline
// demo run the whole pipeline.
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DATA, now } = require('./common');
const { iso } = require('./db');

const redact = u => String(u).replace(/(apikey|key|token)=[^&]+/gi, '$1=***');

function replayFile(dir, sourceId, placeId) {
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir);
  const pick = stem => names.find(n => n === stem || n.startsWith(stem + '.'));
  const safe = placeId && String(placeId).replace(/[^a-z0-9_-]/gi, '-');   // "st:12843" -> "st-12843" (Windows file names)
  const f = (safe && pick(`${sourceId}__${safe}`)) || pick(sourceId);
  return f ? path.join(dir, f) : null;
}

/**
 * get(ctx, { source, place, url, headers, binary, force }) -> { ok, status, body, headers, cached, logId }
 * ctx = { db, settings, replay, log }
 */
async function get(ctx, req) {
  const { db, settings } = ctx;
  const src = req.source, placeId = req.place || null;
  const started = iso(now());
  const logRow = { source_id: src.id, place_id: placeId, started, url: redact(req.url) };
  const finish = (fields) => {
    const r = { ...logRow, finished: iso(now()), ...fields };
    const res = db.run(`INSERT INTO fetch_log (source_id, place_id, started, finished, status, http_status, bytes, rows, url, error, etag, last_modified, expires, raw_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, r.source_id, r.place_id, r.started, r.finished, r.status, r.http_status ?? null,
      r.bytes ?? null, r.rows ?? null, r.url, r.error ?? null, r.etag ?? null, r.last_modified ?? null, r.expires ?? null, r.raw_path ?? null);
    return Number(res.lastInsertRowid);
  };

  // ---- replay: a folder of recorded answers
  if (ctx.replay) {
    const f = replayFile(ctx.replay, src.id, placeId);
    if (!f) { const id = finish({ status: 'skipped', error: 'no replay file' }); return { ok: false, status: 0, skipped: true, logId: id, error: 'no replay file' }; }
    const body = fs.readFileSync(f);
    const id = finish({ status: 'replay', http_status: 200, bytes: body.length, raw_path: path.relative(DATA, f) });
    return { ok: true, status: 200, body, headers: {}, logId: id };
  }

  // ---- still fresh? (Expires of the last good answer for this source + place)
  const last = db.get(`SELECT etag, last_modified, expires, finished FROM fetch_log WHERE source_id = ? AND place_id IS ? AND status IN ('ok', 'cached')
    AND url = ? ORDER BY id DESC LIMIT 1`, src.id, placeId, logRow.url);
  if (!req.force && last && last.expires && last.expires > iso(now())) {
    const id = finish({ status: 'cached', error: 'fresh until ' + last.expires, etag: last.etag, last_modified: last.last_modified, expires: last.expires });
    return { ok: false, cached: true, status: 304, logId: id };
  }

  const contact = settings.contact ? ` (${settings.contact})` : '';
  const headers = { 'User-Agent': (settings.userAgent || 'VRG-Idojaras/1.0') + contact, 'Accept-Encoding': 'gzip', ...(req.headers || {}) };
  if (last && !req.force) {
    if (last.etag) headers['If-None-Match'] = last.etag;
    if (last.last_modified) headers['If-Modified-Since'] = last.last_modified;
  }

  const tries = 1 + ((settings.http && settings.http.retries) || 0);
  let lastErr;
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(req.url, { headers, signal: AbortSignal.timeout((settings.http && settings.http.timeoutMs) || 20000) });
      const h = Object.fromEntries(res.headers.entries());
      const expires = h.expires ? iso(new Date(h.expires)) : null;
      if (res.status === 304) {
        const id = finish({ status: 'cached', http_status: 304, etag: h.etag || last?.etag, last_modified: h['last-modified'] || last?.last_modified, expires });
        return { ok: false, cached: true, status: 304, logId: id };
      }
      const body = Buffer.from(await res.arrayBuffer());
      if (!res.ok) {
        if (res.status >= 500 && t + 1 < tries) { lastErr = 'HTTP ' + res.status; await sleep(1500 * (t + 1)); continue; }
        const id = finish({ status: 'http', http_status: res.status, bytes: body.length, error: body.slice(0, 200).toString('utf8') });
        return { ok: false, status: res.status, logId: id, error: 'HTTP ' + res.status };
      }
      const raw = saveRaw(src.id, placeId, body, req.ext);
      const id = finish({ status: 'ok', http_status: res.status, bytes: body.length, etag: h.etag, last_modified: h['last-modified'], expires, raw_path: raw });
      return { ok: true, status: res.status, body, headers: h, logId: id };
    } catch (e) {
      lastErr = (e && e.cause && e.cause.code) || (e && e.name === 'TimeoutError' ? 'timeout' : String(e && e.message || e));
      if (t + 1 < tries) await sleep(1500 * (t + 1));
    }
  }
  const id = finish({ status: 'net', error: lastErr });
  return { ok: false, status: 0, logId: id, error: lastErr };
}

function saveRaw(sourceId, placeId, body, ext = 'dat') {
  const t = now(), day = t.toISOString().slice(0, 10), hm = t.toISOString().slice(11, 16).replace(':', '');
  const dir = path.join(DATA, 'raw', sourceId, day);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${placeId || 'all'}-${hm}.${ext}.gz`);
  fs.writeFileSync(f, zlib.gzipSync(body));
  return path.relative(DATA, f);
}

const setRows = (db, logId, rows) => db.run('UPDATE fetch_log SET rows = ? WHERE id = ?', rows, logId);
const setError = (db, logId, error) => db.run("UPDATE fetch_log SET status = 'parse', error = ? WHERE id = ?", String(error).slice(0, 300), logId);
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { get, setRows, setError, redact, replayFile };
