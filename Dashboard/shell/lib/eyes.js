// eyes.js — Szem (WP-56): main's side of reading the screen, read-only. Wraps Voice/screen/screen.js (the UI Automation helper, OCR,
// redaction, the allow / deny policy) and adds the "glance": when the global push-to-talk key goes down, the window in front at THAT
// moment is read at once, so "mi van a képernyőn?" answers about it, not about the VRG Asztal that may come forward later.
//   const e = createEyes({ loadScreen, enabled, opts, now, log });
//   e.describe({ what })  what: 'focused' | 'windows' | 'error' | 'read'  → Voice/screen's reply | { ok:false, err, hu }
//   e.glance()            reads the focused window now and keeps it GLANCE_MS · e.status() · e.close()
// Off unless the setting screen.enabled is on. Nothing is written to disk; the page gets text that screen.js already redacted.
'use strict';

const GLANCE_MS = 12000;
const WHATS = ['focused', 'windows', 'error', 'read'];
const OFF = { ok: false, err: 'disabled', hu: 'A képernyő-olvasás ki van kapcsolva (Beállítás: screen.enabled).' };
const NONE = { ok: false, err: 'unavailable', hu: 'A képernyő-olvasó nem érhető el (Voice/screen).' };

function createEyes({ loadScreen, enabled = () => false, opts = () => ({}), now = () => Date.now(), log = () => {} } = {}) {
  let scr = null, glanceAt = 0, glanced = null, pending = null;
  function get() {
    if (scr) return scr;
    let M = null;
    try { M = typeof loadScreen === 'function' ? loadScreen() : null; } catch (e) { log('eyes', 'load failed', e && e.message); }
    if (!M || typeof M.createScreen !== 'function') return null;
    try { scr = M.createScreen(opts()); } catch (e) { log('eyes', 'create failed', e && e.message); scr = null; }
    return scr;
  }
  async function raw(what) {
    const s = get();
    if (!s) return NONE;
    try { return await s.describe({ what }); } catch (e) { log('eyes', 'describe failed', e && e.message); return { ok: false, err: 'error', hu: 'A képernyő nem olvasható.' }; }
  }
  async function describe({ what } = {}) {
    if (!WHATS.includes(what)) return { ok: false, err: 'bad-request', hu: 'Ismeretlen kérés.' };
    if (!enabled()) return OFF;
    if ((what === 'focused' || what === 'error' || what === 'read') && now() - glanceAt < GLANCE_MS) {
      // the window that was in front when the key went down; 'error' and 'read' look at that same window again only if it is still in front
      if (what === 'focused') return pending ? await pending : glanced || raw(what);
    }
    return raw(what);
  }
  function glance() {
    if (!enabled()) return null;
    glanceAt = now(); glanced = null;
    pending = raw('focused').then(r => { glanced = r; pending = null; return r; });
    return pending;
  }
  const status = () => ({ ok: true, enabled: !!enabled(), available: !!get() || false });
  function close() { try { if (scr && scr.close) scr.close(); } catch (e) {} scr = null; }
  return { describe, glance, status, close };
}

module.exports = { createEyes, GLANCE_MS, WHATS };
