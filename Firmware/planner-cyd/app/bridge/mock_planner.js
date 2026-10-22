// mock_planner.js - a fake Planner tab for --demo.
//
// Speaks the same thing as src/07e-dash-link.js in the Planner: it emits 'dash'
// snapshots (on change, and every 2.5 s) and answers the commands the bridge sends
// (dash.action, dash.phase, dash.stop, edit.undo, edit.redo, view.reset, keys).
// The phase / tool table is a copy of PH_LIST in src/05db-layout.js, trimmed to the
// fields the dashboard uses. Lets the whole CYD side be tested with no browser.

'use strict';

const PHASES = [
  { k: 'alap', n: 'Alapozás', tools: [['mode.room', '⬚ Helyiség-toll', 'room'], ['wf.walls', '🧱 Falak létrehozása'], ['wf.floors', '▦ Padló létrehozása'], ['mode.wall', '▤ Fal', 'wall'], ['mode.object', '🪑 Objektum', 'object']] },
  { k: 'nyil', n: 'Nyílászárók', tools: [['wf.door', '🚪 Ajtó'], ['wf.window', '🪟 Ablak'], ['wf.stairs', '🪜 Lépcső'], ['pt.place', '⛩ Portál']] },
  { k: 'szab', n: 'Szabályok', tools: [['wf.roomType', '🏷 Helyiségtípus'], ['wf.routeWalls', '🟩 Vezethető fal'], ['wf.rules', '📐 Szabályok'], ['wf.standards', '📏 Szabványok'], ['mark.wall', '🚩 Fal jelölése'], ['mark.plane', '◩ Padló / menny. jelölés'], ['wf.ceilLine', '〰 Mennyezeti út'], ['wf.floorLine', '▭ Padló út']] },
  { k: 'vill', n: 'Villamosság', tools: [['wf.layer.SOC', '⚡ Dugaljak'], ['wf.layer.LIGHT', '💡 Lámpák + kapcsolók'], ['wf.layer.DED', '🔌 Dedikált'], ['ep.place', '◉ Végpont…'], ['wf.switches', '🔀 Kapcsolások'], ['wf.switchSuggest', '✨ Javaslat'], ['wf.boxSzoba', '▣ Szobadoboz'], ['wf.boxKot', '⊡ Kötődoboz'], ['wf.board', '🗃 Elosztó'], ['wf.subBoard', '🗂 Alosztó'], ['circuit.suggest', '🧮 Áramkörök javaslata'], ['circuit.pick', 'K Végpontok kijelölése']] },
  { k: 'paly', n: 'Pályák', tools: [['bl.routes', '⚒ Pályák kiszámítása'], ['bl.wires', '🧶 Vezetékek'], ['mode.path', '➰ Pálya', 'path'], ['chn.route', '⛓ Csatorna'], ['rail.route', '═ Ezüst sín'], ['arm.route', '↗ ARM pálya'], ['fill.room', '🧵 Helyiség feltöltése'], ['fill.all', '🪡 Teljes feltöltés']] },
  { k: 'ki', n: 'Kimenet', tools: [['check.list', '✔ Ellenőrzés'], ['doc.totals', '📋 Anyagkimutatás'], ['doc.print', '🖨 Nyomtatás / PDF'], ['doc.png', '🖼 Kép (PNG)'], ['view.export.menu', '🔷 Axonometria lap']] }
];
const LEVELS = ['F', 'E1', 'E2'];
// one-shot actions (they run and return); everything else becomes "the running tool"
const ONESHOT = /^(wf\.walls|wf\.floors|wf\.switchSuggest|circuit\.suggest|bl\.|fill\.|check\.|doc\.|view\.|proj\.|level\.|draw\.|wf\.layer\.)/;

// opts.idleAfterS: the "user" stops working after that many seconds (0 = keeps working);
// any command from the CYD counts as work again.
function createMockPlanner(onMessage, log, opts) {
  const idleAfterS = (opts && opts.idleAfterS) || 0;
  let workFrom = Date.now(), inputAt = Date.now(), resting = false;
  const st = {
    proj: 'P33 demo', level: 0, phase: 3, tool: null, layer: 'Dugaljak', sel: 0, err: 2, warn: 5, flat: true,
    totals: { dev: 140, paths: 38, circuits: 16, cables: 0, notes: 12 }, undo: 0
  };
  let lastJson = '', lastAt = 0, tick = 0;

  function snapshot() {
    const ph = PHASES[st.phase];
    return {
      v: 1, proj: st.proj, level: LEVELS[st.level], phase: st.phase,
      phases: PHASES.map((p, i) => ({ k: p.k, n: p.n, err: i === 3 ? st.err : i === 4 ? 1 : 0, warn: i === 2 ? 2 : i === 3 ? st.warn : 0 })),
      tools: ph.tools.map(([a, n, mode]) => ({ a, mode: mode || null, n, live: !!st.tool && st.tool.id === a || (a.startsWith('wf.layer.') && st.layer === n.replace(/^\S+\s/, '')) })),
      tool: st.tool, layer: st.layer, sel: st.sel, err: st.err, warn: st.warn, flat: st.flat,
      inputAt: Math.floor(inputAt / 30000) * 30, totals: st.totals
    };
  }

  function emit(force) {
    const snap = snapshot(), json = JSON.stringify(snap), now = Date.now();
    if (!force && json === lastJson && now - lastAt < 2500) return;
    lastJson = json; lastAt = now;
    onMessage({ v: 1, from: 'planner', type: 'dash', payload: snap });
  }

  function ack(id, ok, reason) { onMessage({ v: 1, from: 'planner', type: 'ack', payload: { id, ok, reason: reason || null } }); }

  function runAction(a, mode) {
    const all = PHASES.flatMap(p => p.tools);
    const t = all.find(x => x[0] === a);
    if (a === 'proj.save') return true;
    if (a === 'view.toggle3d') { st.flat = !st.flat; return true; }
    if (a === 'level.up') { if (st.level >= LEVELS.length - 1) return false; st.level++; return true; }
    if (a === 'level.down') { if (st.level <= 0) return false; st.level--; return true; }
    if (a === 'draw.finish') return !!st.tool && /path/.test(st.tool.id);
    if (a && a.startsWith('wf.layer.')) { st.layer = t ? t[1].replace(/^\S+\s/, '') : a; return true; }
    if (a === 'check.list') { st.warn = Math.max(0, st.warn - 1); return true; }
    if (a && ONESHOT.test(a)) return true;
    if (!t && !mode) return false;
    st.tool = { id: a || 'mode.' + mode, label: t ? t[1].replace(/^\S+\s/, '') : mode };
    return true;
  }

  // the bridge's side of the relay: envelopes in, as the real Planner would receive them
  function receive(m) {
    if (!m || m.type === 'hello') return;
    if (m.type === 'cmd' || m.type === 'keys') { inputAt = workFrom = Date.now(); resting = false; }
    if (m.type === 'dash.request' || m.type === 'state.request') return emit(true);
    if (m.type === 'keys') {
      if (m.payload && m.payload.key === 'Escape') { if (st.tool) st.tool = null; else st.sel = 0; }
      return emit(true);
    }
    if (m.type !== 'cmd') return;
    const p = m.payload || {};
    let ok = true;
    switch (p.id) {
      case 'dash.action': ok = runAction(p.a, p.mode); break;
      case 'dash.phase': { const i = PHASES.findIndex(x => x.k === p.k); ok = i >= 0; if (ok) { st.phase = i; st.tool = null; } break; }
      case 'dash.stop': st.tool = null; break;
      case 'edit.undo': ok = st.undo > 0; if (ok) { st.undo--; st.totals.dev--; } break;
      case 'edit.redo': st.undo++; st.totals.dev++; break;
      case 'view.reset': break;
      default: ok = false;
    }
    if (log) log(`mock planner: ${p.id}${p.a ? ' ' + p.a : ''}${p.k ? ' ' + p.k : ''} -> ${ok ? 'ok' : 'refused'}`);
    ack(p.id, ok, ok ? null : 'nem elérhető');
    emit(true);
  }

  // something happens on the "tab" every few seconds: a device gets placed, a check flips
  const timer = setInterval(() => {
    tick++;
    if (idleAfterS && !resting && Date.now() - workFrom > idleAfterS * 1000) {
      resting = true;
      inputAt = Date.now() - 60 * 60000;   // as if the last input was an hour ago
      if (log) log('mock planner: the user stopped working (--demo-idle)');
    }
    if (resting) { emit(false); return; }
    if (tick % 5 === 0) inputAt = Date.now();
    if (tick % 10 === 0) { st.totals.dev++; st.undo++; }
    if (tick % 25 === 0) st.sel = st.sel ? 0 : 3;
    if (tick % 60 === 0) st.err = st.err ? 0 : 2;
    emit(false);
  }, 400);
  setTimeout(() => emit(true), 300);

  return { receive, stop: () => clearInterval(timer) };
}

module.exports = { createMockPlanner, PHASES };
