// postit-core.js — the Post-it overlay's data rules, shared by the VRG Asztal (Desktop) and anything else in JS.
// The Kotlin twin is Mobile/android/kit-core/src/main/kotlin/hu/vrg/mobile/core/PostIt.kt; both read and write the
// same bundle (format "vrg-postit/1", docs/notes/POSTIT.md §4) and both are tested against fixtures/bundle-v1.json.
//
//   const P = require('shared/postit/postit-core.js')   (Node)   ·   window.VrgPostit   (a page, via <script>)
//   P.make({ text, anchor, at })            a new note            P.check(note) / P.checkBundle(b) → { ok, err? }
//   P.bundle(author, notes, at)             the export bundle     P.parse(text) → { ok, bundle } | { ok:false, err }
//   P.mergeInbox(inbox, bundle)             testers' notes kept per author, the newer edit of an id wins
//   P.onScreen(notes, screen)               the notes anchored on this screen
//   P.toPx(anchor, box) / P.fromPx(x, y, box)   fraction ⇄ pixel inside the anchor's box
//   P.cardAt(mark, box, card)               where the note's card sits beside its mark (right, else left; kept inside)
//   P.hue(authorId)                         a stable colour per tester for the dev overlay
// No DOM, no Node API: pure functions only, so node --test and the overlay page load the same file.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VrgPostit = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMAT = 'vrg-postit/1';
  const LIMITS = { text: 2000, notes: 500, screen: 160, detail: 200, name: 60, id: 40 };
  const STATES = ['open', 'done'];
  const PLATFORMS = ['desktop', 'mobile'];
  const SCREEN_RE = /^[dm]:[A-Za-z0-9._\/:-]{1,158}$/;     // d:… = VRG Asztal, m:… = VRG Mobile (§3)
  const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const plain = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const frac = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  const str = (v, max) => typeof v === 'string' && v.length <= max;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const round4 = v => Math.round(v * 10000) / 10000;

  function newId(rand) {
    const r = typeof rand === 'function' ? rand : Math.random;
    let s = '';
    for (let i = 0; i < 12; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(r() * 36) % 36];
    return 'pn-' + s;
  }

  // ---------------------------------------------------------------- the anchor (§3)
  // { screen, detail?, x, y, w, h }: x, y are fractions of the anchor box (a pane, or the whole window / screen),
  // w, h the box's size when the note was made (px on the PC, dp on the phone), kept only to tell "same layout" later.
  function checkAnchor(a) {
    if (!plain(a)) return 'anchor';
    if (typeof a.screen !== 'string' || !SCREEN_RE.test(a.screen)) return 'anchor.screen';
    if (has(a, 'detail') && a.detail !== null && !str(a.detail, LIMITS.detail)) return 'anchor.detail';
    if (!frac(a.x) || !frac(a.y)) return 'anchor.xy';
    for (const k of ['w', 'h']) if (!(Number.isInteger(a[k]) && a[k] > 0 && a[k] <= 20000)) return 'anchor.' + k;
    return null;
  }

  function fromPx(x, y, box) {
    const w = Math.max(1, Math.round(box.w)), h = Math.max(1, Math.round(box.h));
    return { x: round4(clamp01((x - (box.x || 0)) / w)), y: round4(clamp01((y - (box.y || 0)) / h)), w, h };
  }

  function toPx(anchor, box) {
    return { x: (box.x || 0) + anchor.x * box.w, y: (box.y || 0) + anchor.y * box.h };
  }

  // ---------------------------------------------------------------- one note
  function make({ text, anchor, at, rand }) {
    const t = typeof at === 'number' ? at : Date.now();
    const n = { id: newId(rand), at: t, edited: t, text: String(text == null ? '' : text).slice(0, LIMITS.text), state: 'open', anchor: { ...anchor } };
    if (n.anchor.detail === undefined || n.anchor.detail === '') delete n.anchor.detail;
    return n;
  }

  function check(n) {
    if (!plain(n)) return { ok: false, err: 'note' };
    if (typeof n.id !== 'string' || !ID_RE.test(n.id)) return { ok: false, err: 'id' };
    if (!Number.isInteger(n.at) || n.at <= 0) return { ok: false, err: 'at' };
    if (!Number.isInteger(n.edited) || n.edited < n.at) return { ok: false, err: 'edited' };
    if (!str(n.text, LIMITS.text) || !n.text.trim()) return { ok: false, err: 'text' };
    if (!STATES.includes(n.state)) return { ok: false, err: 'state' };
    const a = checkAnchor(n.anchor);
    return a ? { ok: false, err: a } : { ok: true };
  }

  // only the known keys travel: a bundle never carries anything a later reader would not expect
  const clean = n => {
    const a = { screen: n.anchor.screen, x: n.anchor.x, y: n.anchor.y, w: n.anchor.w, h: n.anchor.h };
    if (typeof n.anchor.detail === 'string' && n.anchor.detail) a.detail = n.anchor.detail;
    return { id: n.id, at: n.at, edited: n.edited, text: n.text, state: n.state, anchor: a };
  };

  // ---------------------------------------------------------------- the bundle (§4)
  function checkAuthor(a) {
    if (!plain(a)) return 'author';
    if (typeof a.id !== 'string' || !ID_RE.test(a.id)) return 'author.id';
    if (!str(a.name, LIMITS.name)) return 'author.name';
    if (!PLATFORMS.includes(a.platform)) return 'author.platform';
    for (const k of ['device', 'app']) if (has(a, k) && !str(a[k], 80)) return 'author.' + k;
    return null;
  }

  function bundle(author, notes, at) {
    return {
      format: FORMAT,
      exportedAt: new Date(typeof at === 'number' ? at : Date.now()).toISOString(),
      author: { id: author.id, name: String(author.name || '').slice(0, LIMITS.name), platform: author.platform,
        ...(author.device ? { device: String(author.device).slice(0, 80) } : {}), ...(author.app ? { app: String(author.app).slice(0, 80) } : {}) },
      notes: notes.filter(n => check(n).ok).slice(0, LIMITS.notes).map(clean),
    };
  }

  function checkBundle(b) {
    if (!plain(b)) return { ok: false, err: 'bundle' };
    if (b.format !== FORMAT) return { ok: false, err: 'format' };
    const a = checkAuthor(b.author);
    if (a) return { ok: false, err: a };
    if (!Array.isArray(b.notes) || b.notes.length > LIMITS.notes) return { ok: false, err: 'notes' };
    for (let i = 0; i < b.notes.length; i++) { const r = check(b.notes[i]); if (!r.ok) return { ok: false, err: 'notes[' + i + '].' + r.err }; }
    const ids = new Set(b.notes.map(n => n.id));
    if (ids.size !== b.notes.length) return { ok: false, err: 'notes.dup' };
    return { ok: true };
  }

  function parse(text) {
    if (typeof text !== 'string' || text.length > 2e6) return { ok: false, err: 'size' };
    let b;
    try { b = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { return { ok: false, err: 'json' }; }
    const r = checkBundle(b);
    return r.ok ? { ok: true, bundle: { ...b, notes: b.notes.map(clean) } } : r;
  }

  // ---------------------------------------------------------------- the developer's inbox (§5)
  // inbox = { authors: { <authorId>: { author, notes: [...] , importedAt } } }. A tester's later export replaces nothing
  // it does not carry: notes are matched by id and the newer `edited` wins, so importing the same file twice changes nothing.
  function mergeInbox(inbox, b, at) {
    const out = { authors: { ...((inbox && inbox.authors) || {}) } };
    const prev = out.authors[b.author.id];
    const byId = new Map(((prev && prev.notes) || []).map(n => [n.id, n]));
    let added = 0, updated = 0;
    for (const n of b.notes) {
      const old = byId.get(n.id);
      if (!old) { byId.set(n.id, n); added++; }
      else if (n.edited > old.edited) { byId.set(n.id, n); updated++; }
    }
    out.authors[b.author.id] = { author: b.author, importedAt: typeof at === 'number' ? at : Date.now(),
      notes: [...byId.values()].sort((x, y) => x.at - y.at).slice(-LIMITS.notes) };
    return { inbox: out, added, updated };
  }

  // every tester's notes as one list, each with its author attached (the dev overlay draws these)
  function inboxNotes(inbox, hidden) {
    const off = new Set(hidden || []);
    const all = [];
    for (const [id, e] of Object.entries((inbox && inbox.authors) || {})) {
      if (off.has(id)) continue;
      for (const n of e.notes || []) all.push({ ...n, author: e.author });
    }
    return all;
  }

  // ---------------------------------------------------------------- what is shown where
  const onScreen = (notes, screen) => (notes || []).filter(n => n && n.anchor && n.anchor.screen === screen);

  // the card beside its mark: right of it and a little up; flipped left when it would leave the box; then kept inside
  function cardAt(mark, box, card, gap) {
    const g = gap == null ? 14 : gap, bx = box.x || 0, by = box.y || 0;
    let x = mark.x + g, y = mark.y - Math.round(card.h / 3);
    if (x + card.w > bx + box.w) x = mark.x - g - card.w;
    x = Math.max(bx + 4, Math.min(x, bx + box.w - card.w - 4));
    y = Math.max(by + 4, Math.min(y, by + box.h - card.h - 4));
    return { x: Math.round(x), y: Math.round(y), side: x < mark.x ? 'left' : 'right' };
  }

  // a stable hue (0–359) per author id: the developer tells testers apart at a glance
  function hue(id) {
    let h = 0;
    for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return (h % 12) * 30 + 15;
  }

  return { FORMAT, LIMITS, STATES, SCREEN_RE, newId, make, check, checkAnchor, bundle, checkBundle, parse, mergeInbox, inboxNotes,
    onScreen, toPx, fromPx, cardAt, hue, clean };
}));
