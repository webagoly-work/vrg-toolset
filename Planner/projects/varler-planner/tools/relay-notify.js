#!/usr/bin/env node
// ==========================================================================
// relay-notify.js — Értesítések (VRG Mobile, WP M10, D-11 = C): a tool on this PC tells the phone.
//
// A notice comes from this PC only: POST /notify on the relay (a script, a build, curl) or a
// {type:'notify', to:'relay'} message from an app connected from this PC (the Planner, Kódváros). The
// relay keeps the last MAX for TTL and sends each to the trusted (paired, M2) phones at once as
// {from:'relay', type:'notify', payload:{id, title, text, level, link, from, at}}; a phone that was away
// asks {type:'notify.list', payload:{after}} on its next connect and gets the ones it missed.
//
// The rules (checkNotice): a title of 1..120 characters, a text up to 500, level info|good|bad, a link
// only http(s) and up to 500, `from` up to 40; control characters are taken out. At most RATE notices
// a minute, so a script stuck in a loop cannot ring the phone without end.
//
// Also a command line for scripts and START (the relay must be running on this PC):
//   node relay-notify.js "Build kész" ["A Kapu újraépült."] [--level good|bad] [--link https://…] [--port 47291]
// ==========================================================================
'use strict';
const crypto = require('crypto');

const MAX = 30;
const TTL = 24 * 60 * 60 * 1000;
const RATE = 20;
const LIMITS = { title: 120, text: 500, link: 500, from: 40 };
const LEVELS = new Set(['info', 'good', 'bad']);

// C0/C1 controls and the bidi overrides (a title must not reorder what the phone shows)
const clean = s => String(s).replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();

/** -> {ok:true, notice:{title, text, level, link, from}} | {ok:false, reason} */
function checkNotice(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, reason: 'Hibás értesítés.' };
  if (typeof p.title !== 'string') return { ok: false, reason: 'A cím (title) kötelező.' };
  const title = clean(p.title);
  if (!title || title.length > LIMITS.title) return { ok: false, reason: `A cím 1..${LIMITS.title} karakter.` };
  if (p.text != null && typeof p.text !== 'string') return { ok: false, reason: 'A szöveg (text) csak szöveg lehet.' };
  const text = p.text == null ? '' : clean(p.text);
  if (text.length > LIMITS.text) return { ok: false, reason: `A szöveg legfeljebb ${LIMITS.text} karakter.` };
  const level = p.level == null ? 'info' : String(p.level);
  if (!LEVELS.has(level)) return { ok: false, reason: 'A szint (level) info, good vagy bad.' };
  let link = null;
  if (p.link != null && p.link !== '') {
    if (typeof p.link !== 'string' || p.link.length > LIMITS.link || !/^https?:\/\/[^\s]+$/i.test(p.link)) return { ok: false, reason: 'A link csak http(s) cím lehet.' };
    link = p.link;
  }
  const from = p.from == null ? null : clean(p.from).slice(0, LIMITS.from) || null;
  return { ok: true, notice: { title, text, level, link, from } };
}

function createNotices(opts) {
  opts = opts || {};
  const max = opts.max || MAX, ttl = opts.ttl || TTL, rate = opts.rate || RATE;
  const now = opts.now || (() => Date.now());
  let list = [];                 // oldest first
  let stamps = [];               // times of the last notices, for the rate
  let last = 0;
  const listeners = [];

  const sweep = () => { const t = now(); list = list.filter(e => t - e.at < ttl); };

  return {
    /** -> {ok, entry} | {ok:false, reason} */
    add(p, source) {
      const c = checkNotice(p);
      if (!c.ok) return c;
      const t = now();
      stamps = stamps.filter(s => t - s < 60000);
      if (stamps.length >= rate) return { ok: false, reason: `Legfeljebb ${rate} értesítés percenként.` };
      stamps.push(t);
      // strictly increasing times: notify.list {after} never skips one of two notices in one millisecond
      const at = Math.max(t, last + 1);
      last = at;
      const entry = Object.assign({ id: crypto.randomBytes(6).toString('hex'), at }, c.notice);
      if (!entry.from && source) entry.from = String(source).slice(0, LIMITS.from);
      sweep();
      list.push(entry);
      if (list.length > max) list = list.slice(-max);
      listeners.forEach(f => f(entry));
      return { ok: true, entry };
    },
    /** The notices newer than `after` (ms), oldest first. */
    since(after) {
      sweep();
      const a = Number(after);
      return list.filter(e => !(Number.isFinite(a) && e.at <= a));
    },
    on(f) { listeners.push(f); },
  };
}

module.exports = { checkNotice, createNotices, MAX, TTL, RATE, LIMITS };

// ---- the command line --------------------------------------------------------------------------
if (require.main === module) {
  const http = require('http');
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const port = Number(opt('--port')) || Number(process.env.GYRO_PORT) || 47291;
  const level = opt('--level'), link = opt('--link');
  const [title, text] = args;
  if (!title) {
    console.log('Hasznalat: node relay-notify.js "Cim" ["szoveg"] [--level good|bad] [--link https://...] [--port 47291]');
    process.exit(2);
  }
  const body = JSON.stringify({ title, text, level, link, from: 'parancssor' });
  const r = http.request({ host: '127.0.0.1', port, path: '/notify', method: 'POST',
    headers: { Host: `localhost:${port}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
    let b = ''; res.on('data', d => b += d);
    res.on('end', () => {
      let o = {}; try { o = JSON.parse(b); } catch (e) { }
      if (o.ok) { console.log(`  ertesites elkuldve (${o.delivered} telefon)`); process.exit(0); }
      console.log('  nem ment ki: ' + (o.reason || res.statusCode)); process.exit(1);
    });
  });
  r.on('error', e => { console.log(`  a rele nem fut a ${port} porton (${e.code})`); process.exit(1); });
  r.end(body);
}
