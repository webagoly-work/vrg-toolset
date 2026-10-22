// ==========================================================================
// 07e-dash-link.js — the desk dashboard (CYD) feed
//
// WHERE: src/07e-dash-link.js — after 07d-linkpanel.js, before 08-interaction.js.
//
// A second consumer of PLANNER_LINK (07a), next to the phone camera. The CYD
// dashboard's bridge (<repo>/Firmware/planner-cyd/app/bridge) joins the same local
// relay with role 'cyd'. This module only:
//   · sends a 'dash' snapshot — project, level, phase, the phase's tools, the
//     running tool, layer, selection, check counts, totals — on change, and at
//     least every 2.5 s so the bridge can tell a live tab from a closed one;
//   · registers the commands the CYD's buttons send: dash.action, dash.phase,
//     dash.stop. Everything else (undo, Esc…) already goes through 07a;
//   · reports when the tab last had keyboard / pointer input (inputAt, UTC s,
//     rounded down to 30 s so an active user costs one message per 30 s). The
//     bridge turns that into "idle", and the CYD then shows its clock.
// The CYD is a readout and a remote: a dropped message must never corrupt
// anything, so nothing here keeps state the Planner does not already own.
//
// It only polls while the link is up, so a Planner with no relay running pays
// nothing (and jsdom specs get no stray timer).
//
// Single top-level name: PLANNER_DASH.
// ==========================================================================

const PLANNER_DASH = (function () {
  'use strict';

  const POLL_MS = 400, BEAT_MS = 2500;
  let timer = null, lastJson = '', lastAt = 0, sent = 0;
  let inputAt = Date.now();
  function touch() { inputAt = Date.now(); }

  function safe(f, d) { try { const v = f(); return v === undefined ? d : v; } catch (e) { return d; } }

  function projName() {
    return safe(function () {
      const ix = loadProjIndex(), p = currentProjId && ix[currentProjId];
      return (p && p.name) || (B && B.name) || '';
    }, '');
  }

  function phaseNow() { return safe(function () { return phByKey(state.wfPhase); }, null); }

  function layerNow() { return safe(function () { return lyrLayer(state.activeLayer); }, null); }

  // A phase button is lit when it is the running tool, its mode is on, or (the
  // Villamosság layer buttons) its role is the active layer's role.
  function toolLive(t, cur, role) {
    if (cur && t.a && cur.id === t.a) return true;
    if (t.mode && t.mode !== 'select' && state.mode === t.mode && !(cur && cur.id && cur.id.indexOf('mode.') !== 0)) return true;
    if (t.role && role && t.role === role) return true;
    return false;
  }

  function snapshot() {
    const ph = phaseNow(), cur = safe(function () { return toolCurrent(); }, null), L = layerNow();
    const role = L && L.role;
    const v = safe(function () { return statusValidate(); }, { error: 0, warn: 0 });
    const phases = safe(function () {
      return PH_LIST.map(function (p) {
        const c = safe(function () { return phCheck(p); }, { bad: 0, warn: 0 });
        return { k: p.k, n: p.n, err: c.bad || 0, warn: c.warn || 0 };
      });
    }, []);
    const tools = ph ? ph.tools.map(function (t) {
      return { a: t.a || null, mode: t.mode || null, n: t.n, live: toolLive(t, cur, role) };
    }) : [];
    const D = typeof data !== 'undefined' ? data : {};
    const len = function (a) { return Array.isArray(a) ? a.length : 0; };
    return {
      v: 1,
      proj: projName(),
      level: state.active != null ? safe(function () { return VIEW_LEVEL_HU[state.active]; }, null) || String(state.active) : '',
      phase: ph ? PH_LIST.indexOf(ph) : -1,
      phases: phases,
      tools: tools,
      tool: cur ? { id: cur.id, label: cur.label } : null,
      layer: L ? (L.name || L.id) : '',
      sel: safe(function () { return selList().length; }, 0),
      err: v.error || 0,
      warn: v.warn || 0,
      flat: !!state.flat,
      inputAt: Math.floor(inputAt / 30000) * 30,
      totals: {
        dev: len(D.devices), paths: len(D.paths), circuits: len(D.circuits),
        cables: len(D.cables), notes: len(D.notes)
      }
    };
  }

  function push(force) {
    const L = window.PLANNER_LINK;
    if (!L || !L.isUp()) return false;
    const snap = snapshot(), json = JSON.stringify(snap), now = Date.now();
    if (!force && json === lastJson && now - lastAt < BEAT_MS) return false;
    lastJson = json; lastAt = now;
    if (L.send('dash', snap)) sent++;
    return true;
  }

  function poll(on) {
    clearInterval(timer); timer = null;
    if (on) { lastJson = ''; timer = setInterval(function () { push(false); }, POLL_MS); push(true); }
  }

  function after() {
    safe(function () { layoutSync(true); });
    safe(function () { draw(); });
    setTimeout(function () { push(true); }, 30);
  }

  function init() {
    const L = window.PLANNER_LINK;
    if (!L) return;
    // capture + passive: sees every input before the app's own handlers, costs one assignment
    ['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach(function (t) {
      document.addEventListener(t, touch, { capture: true, passive: true });
    });
    // run a phase tool by its action id; tools that are only a mode fall back to setMode
    L.command('dash.action', function (p) {
      let ok = false;
      if (p.a && typeof actionById === 'function' && actionById(p.a)) ok = runAction(p.a);
      else if (p.mode && typeof setMode === 'function') { setMode(p.mode); ok = true; }
      after();
      return ok;
    });
    L.command('dash.phase', function (p) { const ok = phSet(p.k); after(); return ok; });
    L.command('dash.stop', function () { toolStop(); after(); return true; });
    L.on('dash.request', function () { push(true); });
    L.onStatus(function (s) { poll(!!(s && s.connected)); });
    if (L.isUp()) poll(true);
  }

  init();
  return { snapshot: snapshot, push: push, stats: function () { return { sent: sent, polling: !!timer, inputAt: inputAt }; } };
})();
if (typeof window !== 'undefined') window.PLANNER_DASH = PLANNER_DASH;
