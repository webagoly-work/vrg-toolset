// voicecmd.js — WP-55 Parancs-héj: the voice command overlay of the VRG Asztal (phase 2 of the voice work; phase 1 = WP-54 dictation).
// A small HUD over the top strip shows the live words while push-to-talk is held in command mode, then what was done and a terse
// answer (≤ 6 words; a dim second line for details). Short commands drive the Desktop through its own page APIs only — VRGDesk,
// VRGSheets, VRGFrame, the Munkamenetek / Vezérlő pane instances, vrg.sessions — and questions are answered from the Desktop's state.
// Risky acts (close a window, send a prompt) wait for "igen" (spoken, typed, Enter or the button); "mégse" / Esc cancels. Nothing is
// ever sent or closed without that confirmation. Dictated text never leaves the program: "írd a vezérlőbe: …" only fills the
// Vezérlő's own box. Typed fallback: Ctrl+Shift+Space opens a one-line command input with the same parser (no microphone needed).
// Voice: window.VRGVoice (WP-54) events with mode 'command' — 'start' / 'partial' / 'final' / 'stop' / 'error'; attached when it appears.
// "Mi van a képernyőn?" is built by `providers` from the Desktop's own state (not pixels); phase 3 adds a screen-reading provider:
//   VRGVoiceCmd.providers.push(async snap => ({ say?, detail }))
//   window.VRGVoiceCmd = { run(text) → Promise<result>, parse(text), state(), vocabulary(), providers, describe() }
// Needs (before this file): ../../Voice/command/commands.js (window.VRGVoiceCommands), ../../Voice/command/parse.js (window.VRGVoiceParse).
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};

  // ------------------------------------------------------------ pure helpers (exported for tests)
  const KIND_HU = { home: 'Kezdőlap', empty: 'Üres', files: 'Fájlok', term: 'Terminál', web: 'Böngésző', mail: 'Posta', stack: 'Kontextuscsomag',
    chat: 'Claude chat', note: 'Jegyzet', git: 'Git', feed: 'Hírek', app: 'Alkalmazás', sessions: 'Munkamenetek', controller: 'Vezérlő' };
  const LEVEL_HU = { user: 'Felhasználói', dev: 'Fejlesztői', all: 'Teljes' };
  const CMD_HU = { open: 'megnyitás', 'lap.go': 'lapváltás', 'win.focus': 'fókusz', 'win.max': 'teljes képernyő', 'win.restore': 'visszaállítás',
    'win.small': 'kicsinyítés', 'win.close': 'bezárás', 'ctl.fill': 'beírás a Vezérlőbe', 'ctl.send': 'küldés', 'label.machine': 'gép címke',
    'label.origin': 'eredet címke', 'label.color': 'szín', 'level.set': 'szintváltás' };
  // at most n words, with an ellipsis when cut
  function terse(s, n = 6) {
    const w = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return w.length <= n ? w.join(' ') : w.slice(0, n).join(' ') + '…';
  }
  const short = (s, n = 40) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  // one window as a phrase: "Terminál – GO MOBILE M16 (Helyi · A)"
  function windowLine(w) {
    const k = KIND_HU[w.kind] || w.kind || 'ablak';
    return k + (w.title && w.title !== k ? ' – ' + short(w.title, 36) : '') + (w.origin ? ' (' + w.origin + ')' : '');
  }
  // the Desktop's own state → the spoken-style summary
  //   snap = { view, level, lap, onTree, windows:[{ kind, title, origin, note, focused }], live? }
  function describeState(snap) {
    const s = snap || {};
    if (s.view === 'dashboard') return { say: 'Irányítópult nézet.', detail: 'Szint: ' + (LEVEL_HU[s.level] || s.level || '?') + '.' };
    const wins = Array.isArray(s.windows) ? s.windows : [];
    const where = s.onTree || !s.lap ? 'Munkapad' : s.lap + ' lap';
    const say = terse(where + ', ' + wins.length + ' ablak.', 6);
    const f = wins.find(w => w.focused);
    const rest = wins.filter(w => !w.focused);
    const parts = [];
    if (f) parts.push('Fókusz: ' + windowLine(f) + (f.note ? ', jegyzet: ' + short(f.note, 40) : '') + '.');
    if (rest.length) parts.push('Még: ' + rest.slice(0, 5).map(windowLine).join('; ') + (rest.length > 5 ? '; +' + (rest.length - 5) : '') + '.');
    if (typeof s.live === 'number') parts.push(s.live ? s.live + ' élő munkamenet.' : 'Nincs élő munkamenet.');
    return { say, detail: parts.join(' ') };
  }
  const pushHistory = (list, item, max = 5) => [item, ...(Array.isArray(list) ? list : [])].slice(0, max);
  // newest idle / newest any session row
  const newest = (rows, idle) => (Array.isArray(rows) ? rows : []).filter(r => r && (!idle || !r.live)).sort((a, b) => b.mtime - a.mtime)[0] || null;

  // ------------------------------------------------------------ executors: act → async (cmd, E) → { say, detail?, ok }
  // E = the page environment (see env() below); every one of commands.json's acts has an entry here (wp-55 test).
  const need = (x, hu) => { if (!x) throw Object.assign(new Error(hu), { hu }); return x; };
  const EXEC = {
    async open(c, E) {
      const id = c.slots.target && c.slots.target.value;
      need(id, 'Mit nyissak meg?');
      await need(E.desk(), 'Nincs Asztal.').open(id);
      return { say: 'Megnyitva: ' + terse(c.slots.target.label, 4) };
    },
    async 'lap.go'(c, E) {
      const S = need(E.sheets(), 'Nincsenek lapok.');
      S.activate(c.slots.lap.value); E.showDesktop();
      return { say: 'Lap: ' + terse(c.slots.lap.label, 4) };
    },
    async 'lap.next'(c, E) { return E.stepLap(1); },
    async 'lap.prev'(c, E) { return E.stepLap(-1); },
    async tree(c, E) { const S = need(E.sheets(), 'Nincsenek lapok.'); S.showTree(); E.showDesktop(); return { say: 'Munkapad.' }; },
    async board(c, E) { const S = need(E.sheets(), 'Nincsenek lapok.'); await S.sessionBoard(); return { say: 'Munkamenet-tábla.' }; },
    async view(c, E) { need(E.desk(), 'Nincs Asztal.').setView(c.value); return { say: c.value === 'dashboard' ? 'Irányítópult.' : 'Asztal.' }; },
    async 'win.focus'(c, E) { const w = E.win(c); E.frame().focus(w.id); return { say: 'Fókusz: ' + terse(windowLine(w), 4) }; },
    async 'win.max'(c, E) { return E.sheetButton(E.win(c), 'max', true); },
    async 'win.restore'(c, E) { return E.sheetButton(E.win(c), 'max', false); },
    async 'win.small'(c, E) { return E.sheetButton(E.win(c), 'min'); },
    async 'win.close'(c, E) { const w = E.win(c); E.frame().close(w.id); return { say: 'Bezárva: ' + terse(windowLine(w), 4) }; },
    async 'sess.resume'(c, E) {
      const r = newest(await E.sessions(), true);
      need(r, 'Nincs folytatható munkamenet.');
      const x = await E.vrg().sessions.resume(r.account, r.session);
      if (x && x.ok === false) return { say: terse(x.hu || 'Nem sikerült.', 6), ok: false };
      return { say: 'Folytatva.', detail: r.account + ' · ' + short(r.title || r.session, 60) };
    },
    async 'sess.stronger'(c, E) {
      const r = newest(await E.sessions(), true);
      need(r, 'Nincs folytatható munkamenet.');
      const x = await E.vrg().sessions.resume(r.account, r.session, { stronger: true });
      if (x && x.ok === false) return { say: terse(x.hu || 'Nem sikerült.', 6), ok: false };
      return { say: 'Folytatva opusszal.', detail: short(r.title || r.session, 60) };
    },
    async 'sess.canvas'(c, E) {
      const r = newest(await E.sessions(), false);
      need(r, 'Nincs munkamenet.');
      const x = await E.vrg().sessions.canvas(r.account, r.session);
      if (!x || x.ok === false || !x.url) return { say: terse((x && x.hu) || 'A vászon nem nyílt meg.', 6), ok: false };
      E.frame().openUrl(x.url);
      return { say: 'Vászon megnyitva.', detail: short(r.title || r.session, 60) };
    },
    async 'ctl.fill'(c, E) {
      const text = String(c.slots.text && c.slots.text.value || '').trim();
      need(text, 'Mit írjak be?');
      const inst = await E.controller(true);
      inst.text.value = text.slice(0, 8000);
      inst.text.dispatchEvent(new Event('input', { bubbles: true }));
      try { inst.text.focus(); } catch (e) {}
      return { say: 'Beírva a Vezérlőbe.', detail: '„' + short(text, 60) + '” — küldéshez: „küldd el”.' };
    },
    async 'ctl.send'(c, E) {
      const inst = await E.controller(false);
      need(inst && inst.text && inst.text.value.trim(), 'A Vezérlő üres.');
      await inst.send();
      return { say: 'Elküldve az Előszűrőn át.' };
    },
    async 'ctl.clear'(c, E) {
      const inst = await E.controller(false);
      need(inst, 'Nincs Vezérlő.');
      inst.text.value = ''; inst.text.dispatchEvent(new Event('input', { bubbles: true }));
      return { say: 'Vezérlő törölve.' };
    },
    async 'label.note'(c, E) { return E.decorate({ note: String(c.slots.text.value || '').slice(0, 200) }, 'Jegyzet mentve.'); },
    async 'label.title'(c, E) { return E.decorate({ title: String(c.slots.text.value || '').slice(0, 80) }, 'Cím mentve.'); },
    async 'label.machine'(c, E) { return E.decorate({ origin: 'machine', machine: String(c.slots.machine.value || '').slice(0, 40) }, 'Gép: ' + terse(c.slots.machine.value, 3)); },
    async 'label.origin'(c, E) { return E.decorate({ origin: c.slots.origin.value, machine: null }, c.slots.origin.value === 'cloud' ? 'Felhő.' : 'Helyi.'); },
    async 'label.color'(c, E) { return E.decorate({ color: c.slots.color.value }, 'Szín: ' + terse(c.slots.color.label || c.slots.color.value, 2)); },
    async 'level.set'(c, E) {
      const lv = c.slots.level.value, reg = E.registry();
      need(lv, 'Melyik szint?');
      const gated = (reg.levelNeedsAuth || []).includes(lv);
      if (gated && !(c.slots.auth && c.slots.auth.value === true)) return { say: 'Jogosultság kell.', detail: 'Mondd: „' + (LEVEL_HU[lv] || lv).toLowerCase() + ' szint, jogosult vagyok”.', ok: false };
      need(E.desk(), 'Nincs Asztal.').setLevel(lv);
      return { say: (LEVEL_HU[lv] || lv) + ' szint.', detail: gated ? 'Csak a jelmondat ellenőrizve; hangazonosítás egy későbbi fázisban jön.' : '' };
    },
    async 'ask.screen'(c, E) { return E.describe(); },
    async 'ask.window'(c, E) {
      const f = E.windows().find(w => w.focused);
      if (!f) return { say: 'Nincs fókuszban ablak.' };
      return { say: terse(windowLine(f), 6), detail: f.note ? 'Jegyzet: ' + short(f.note, 80) : '' };
    },
    async 'ask.sessions'(c, E) {
      const rows = await E.sessions();
      const live = rows.filter(r => r.live).length;
      return { say: rows.length + ' munkamenet, ' + live + ' élő.', detail: rows.slice(0, 3).map(r => r.account + ': ' + short(r.title || r.session, 40)).join(' · ') };
    },
    async 'ask.live'(c, E) {
      const live = (await E.sessions()).filter(r => r.live);
      if (!live.length) return { say: 'Semmi sem fut élőben.' };
      return { say: live.length + ' élő munkamenet.', detail: live.slice(0, 4).map(r => r.account + ': ' + short(r.title || r.session, 40)).join(' · ') };
    },
    async 'ask.controller'(c, E) {
      const inst = await E.controller(false);
      if (!inst || !inst.text) return { say: 'Nincs nyitva Vezérlő.' };
      const n = inst.text.value.trim().length;
      const v = inst.verdict ? inst.verdict.textContent.trim() : '';
      return { say: n ? 'Vezérlő: ' + n + ' karakter.' : 'A Vezérlő üres.', detail: v || (n ? short(inst.text.value, 80) : '') };
    },
    async cancel(c, E) { return { say: 'Rendben.' }; },
    async repeat(c, E) { const l = E.last(); return l ? { say: l.say, detail: l.detail } : { say: 'Még nem mondtam semmit.' }; },
    async help() {
      return { say: 'Rövid parancsokat értek.', detail: 'Pl.: „nyisd meg a Plannert”, „menj a Munkamenetek lapra”, „ezt tedd teljes képernyőre”, „írd a vezérlőbe: …”, „küldd el”, „jegyzet ehhez: …”, „mi van a képernyőn?”, „hány munkamenet fut?”, „mégse”.' };
    },
  };
  const ACTS = Object.keys(EXEC);

  const helpers = { terse, short, windowLine, describeState, pushHistory, newest, ACTS, KIND_HU, CMD_HU };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------ the page environment
  const P = () => W.VRGVoiceParse;
  const REG = () => W.VRGVoiceCommands || { commands: [], phrases: [] };
  const vrg = () => W.vrg || null;
  const S = { hist: [], last: null, pending: null, clarify: null, busy: false, catalog: [], hideTimer: 0, covered: false, voiceOff: null, listening: null };
  const cover = on => { if (S.covered === !!on) return; S.covered = !!on; try { vrg() && vrg().call('desktop', 'cover', { on: !!on }); } catch (e) {} };

  async function loadCatalog() {
    try { const r = vrg() && vrg().desktop ? await vrg().desktop.catalog('all') : null; if (r && Array.isArray(r.items)) S.catalog = r.items.map(i => ({ id: i.id, hu: i.hu, en: i.en })); } catch (e) {}
  }
  // the windows the user can see now: the active Lap's, or the Munkapad's panes when no Lap is in front
  function windows() {
    const F = W.VRGFrame, SH = W.VRGSheets;
    if (!F) return [];
    const focused = F.focused ? F.focused() : '';
    const doc = SH && SH.doc ? SH.doc() : null;
    const sheet = doc && doc.active ? doc.sheets.find(s => s.id === doc.active) : null;
    const onSheet = !!(SH && SH.on && SH.on() && sheet);
    const sheetIds = new Set(doc ? doc.sheets.flatMap(s => s.wins.map(w => w.id)) : []);
    const ids = onSheet ? sheet.wins.map(w => w.id) : F.panes().filter(id => !sheetIds.has(id));
    return ids.map(id => {
      const kind = F.kindOf(id);
      const lab = onSheet && SH.labelOf ? SH.labelOf(id) : null;
      const deco = onSheet ? (sheet.wins.find(w => w.id === id) || {}).deco || {} : {};
      return { id, kind, title: (lab && lab.title) || KIND_HU[kind] || kind, origin: lab ? lab.originText : '', note: (lab && lab.note) || '', machine: deco.machine || '', focused: id === focused };
    });
  }
  function ctx() {
    const SH = W.VRGSheets, doc = SH && SH.doc ? SH.doc() : null;
    const machines = doc ? [...new Set(doc.sheets.flatMap(s => s.wins.map(w => w.deco && w.deco.machine).filter(Boolean)))] : [];
    return { catalog: S.catalog, laps: doc ? doc.sheets.map(s => ({ id: s.id, name: s.name })) : [], windows: windows(), machines };
  }
  const inst = id => { const F = W.VRGFrame; return F ? (F.pane(id) || (F.host && F.host.inst(id)) || null) : null; };
  const E = {
    desk: () => W.VRGDesk || null, sheets: () => W.VRGSheets || null, frame: () => need(W.VRGFrame, 'Nincs keret.'), vrg: () => need(vrg(), 'Nincs kapcsolat.'),
    registry: REG, windows, last: () => S.last,
    showDesktop() { const D = W.VRGDesk; if (D && D.view && D.view() !== 'desktop') D.setView('desktop'); if (D && D.showWindows) D.showWindows(true); },
    stepLap(d) {
      const SH = need(W.VRGSheets, 'Nincsenek lapok.'), doc = SH.doc();
      need(doc.sheets.length, 'Nincs lap.');
      const i = doc.sheets.findIndex(s => s.id === doc.active);
      const j = i < 0 ? (d > 0 ? 0 : doc.sheets.length - 1) : (i + d + doc.sheets.length) % doc.sheets.length;
      SH.activate(doc.sheets[j].id); E.showDesktop();
      return { say: 'Lap: ' + terse(doc.sheets[j].name, 4) };
    },
    // the window a command names (its slot), else the focused one
    win(c) {
      const ws = windows();
      const sl = c.slots && c.slots.window;
      const id = sl && sl.value ? sl.value : (ws.find(w => w.focused) || {}).id;
      return need(ws.find(w => w.id === id) || (id && { id, kind: W.VRGFrame.kindOf(id), title: '' }), 'Melyik ablak?');
    },
    // full / small through the Lap window's own header buttons (the same code path as a click)
    sheetButton(w, act, wantMax) {
      const el = document.querySelector('[data-role="sh-win"][data-win="' + (W.CSS && CSS.escape ? CSS.escape(w.id) : w.id) + '"]');
      if (!el) return { say: 'Csak lapon működik.', ok: false };
      const isMax = el.dataset.max === '1';
      if (act === 'max' && wantMax === isMax) return { say: isMax ? 'Már teljes képernyő.' : 'Már a helyén van.' };
      const b = el.querySelector('[data-role="sh-head"] button[data-act="' + act + '"]');
      need(b, 'Nincs ilyen gomb.').click();
      return { say: act === 'min' ? 'Kicsinyítve.' : wantMax ? 'Teljes képernyő.' : 'Visszaállítva.' };
    },
    decorate(patch, said) {
      const SH = need(W.VRGSheets, 'Nincsenek lapok.');
      const f = windows().find(w => w.focused);
      need(f, 'Nincs fókuszban ablak.');
      const ok = SH.decorate(f.id, patch);
      const doc = SH.doc(), sheet = doc.sheets.find(s => s.id === doc.active);
      if (!ok && !(sheet && sheet.wins.some(w => w.id === f.id))) return { say: 'Csak lapon lévő ablakra.', ok: false };
      return sheet && sheet.board ? { say: said } : { say: said, detail: 'A címkék ezen a lapon ki vannak kapcsolva: lap fül → Tábla-címkék.' };
    },
    async sessions() { const v = vrg(); const r = v && v.sessions ? await v.sessions.list() : null; return r && Array.isArray(r.sessions) ? r.sessions : []; },
    // the Vezérlő pane instance; `open` = open one when there is none
    async controller(open) {
      const F = W.VRGFrame;
      if (!F) return null;
      let id = F.panes().find(p => F.kindOf(p) === 'controller');
      if (!id && open) id = F.open('controller', {});
      if (!id) return null;
      for (let i = 0; i < 40; i++) { const x = inst(id); if (x && x.text) return x; await new Promise(r => setTimeout(r, 50)); }
      return need(null, 'A Vezérlő nem nyílt meg.');
    },
    async describe() {
      const D = W.VRGDesk;
      const snap = { view: D && D.view ? D.view() : 'desktop', level: D && D.level ? D.level() : '', windows: windows() };
      const SH = W.VRGSheets, doc = SH && SH.doc ? SH.doc() : null;
      snap.onTree = !(SH && SH.on && SH.on());
      snap.lap = doc && doc.active ? (doc.sheets.find(s => s.id === doc.active) || {}).name || '' : '';
      try { snap.live = (await E.sessions()).filter(r => r.live).length; } catch (e) {}
      let say = '', detail = [];
      for (const p of providers) {
        try { const r = await p(snap); if (r && r.say && !say) say = r.say; if (r && r.detail) detail.push(r.detail); } catch (e) {}
      }
      return { say: say || 'Nem látok semmit.', detail: detail.join(' ') };
    },
  };
  // phase 3 adds a screen-reading provider here; the first provider that answers `say` speaks, every `detail` is shown
  const providers = [snap => describeState(snap)];

  // ------------------------------------------------------------ the HUD
  const el = (tag, role, text) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text != null) e.textContent = text; return e; };
  const hud = el('div', 'vcmd'); hud.hidden = true; hud.setAttribute('aria-live', 'polite'); hud.title = 'Parancs-héj (Ctrl+Shift+Space)';
  const dot = el('i', 'vcmd-dot'), say = el('span', 'vcmd-say'), detail = el('div', 'vcmd-detail');
  const row = el('div', 'vcmd-row'); row.append(dot, say);
  const conf = el('div', 'vcmd-confirm'); conf.hidden = true;
  const yes = el('button', 'vcmd-yes', 'Igen'), no = el('button', 'vcmd-no', 'Mégse');
  yes.type = no.type = 'button'; yes.title = 'Yes (Enter)'; no.title = 'Cancel (Esc)';
  conf.append(yes, no);
  const input = el('input', 'vcmd-input'); input.type = 'text'; input.hidden = true; input.placeholder = 'Parancs… (pl. „nyisd meg a Plannert”)'; input.maxLength = 300;
  const hist = el('ol', 'vcmd-hist');
  hud.append(row, detail, conf, input, hist);
  (document.body || document.documentElement).append(hud);

  function show(state, text, more) {
    clearTimeout(S.hideTimer);
    hud.hidden = false; hud.dataset.state = state;
    say.textContent = text || ''; detail.textContent = more || ''; detail.hidden = !more;
    conf.hidden = state !== 'confirm';
    cover(state === 'confirm' || !input.hidden || hud.matches(':hover'));
    if (state === 'result' || state === 'error') S.hideTimer = setTimeout(hide, more ? 7000 : 4500);
  }
  function hide() {
    if (hud.matches(':hover') || !input.hidden || S.pending || S.clarify) { S.hideTimer = setTimeout(hide, 2000); return; }
    hud.hidden = true; hud.dataset.state = ''; cover(false);
  }
  function drawHist() {
    hist.replaceChildren(...S.hist.map(h => { const li = el('li', null); li.append(el('b', null, h.heard), document.createTextNode(' → ' + h.say)); return li; }));
  }
  hud.addEventListener('mouseenter', () => { if (S.hist.length) cover(true); });
  hud.addEventListener('mouseleave', () => { if (!S.pending && input.hidden) cover(false); });
  yes.addEventListener('click', () => run('igen'));
  no.addEventListener('click', () => run('mégse'));
  function openInput() {
    input.hidden = false; show(hud.dataset.state && hud.dataset.state !== 'result' ? hud.dataset.state : 'typing', 'Parancs:', ''); input.value = ''; input.focus();
  }
  function closeInput() { input.hidden = true; input.blur(); if (!S.pending) hide(); }
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { const t = input.value.trim(); input.value = ''; if (t) run(t); else if (S.pending) run('igen'); }
    else if (e.key === 'Escape') { if (S.pending) run('mégse'); closeInput(); }
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && !e.altKey && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); if (input.hidden) openInput(); else closeInput(); return; }
    if (S.pending && !hud.hidden && document.activeElement !== input) {
      if (e.key === 'Escape') { e.preventDefault(); run('mégse'); }
      else if (e.key === 'Enter') { e.preventDefault(); run('igen'); }
    }
  }, true);

  // ------------------------------------------------------------ run one utterance
  function remember(heard, r) {
    S.last = { say: r.say, detail: r.detail || '' };
    S.hist = pushHistory(S.hist, { heard: short(heard, 40), say: r.say });
    drawHist();
  }
  function parseNow(text) { return P() ? P().parse(text, { registry: REG(), ctx: ctx() }) : { command: null, ask: 'A parancsértelmező nincs betöltve.' }; }
  async function exec(cmd, heard) {
    const fn = EXEC[cmd.act];
    let r;
    try { r = fn ? await fn(cmd, E) : { say: 'Ezt még nem tudom.', ok: false }; }
    catch (e) { r = { say: terse(e && e.hu || 'Nem sikerült.', 6), detail: e && e.hu ? '' : String(e && e.message || e).slice(0, 120), ok: false }; }
    r = { ok: r.ok !== false, say: r.say, detail: r.detail || '', act: cmd.act, command: cmd.command };
    remember(heard, r);
    show(r.ok ? 'result' : 'error', r.say, r.detail);
    return r;
  }
  async function run(text) {
    const heard = String(text || '').trim();
    if (!heard) return { ok: false, say: '' };
    if (!P()) { const r = { ok: false, say: 'A parancsértelmező nincs betöltve.' }; show('error', r.say); return r; }
    // a pending confirmation: igen → run it, mégse → drop it, anything else → drop it and treat the words as a new command
    if (S.pending) {
      const p = S.pending, w = P().confirmWord(heard, REG());
      S.pending = null; conf.hidden = true;
      if (w === 'yes' && Date.now() <= p.until) return exec(p.cmd, p.heard);
      if (w === 'no' || w === 'yes') { const r = { ok: true, say: w === 'no' ? 'Mégse.' : 'Lejárt; mondd újra.', act: 'cancel' }; remember(heard, r); show('result', r.say); return r; }
    }
    // an open ask-back: the answer picks one of the choices
    if (S.clarify) {
      const c = S.clarify; S.clarify = null;
      const i = P().choose(heard, c.list.map(x => x.label), REG());
      if (i >= 0) { const cmd = { ...c.cmd, slots: { ...c.cmd.slots, [c.slot]: { ...c.cmd.slots[c.slot], value: c.list[i].value, label: c.list[i].label, score: 1 } } }; return gate(cmd, heard); }
      if (P().confirmWord(heard, REG()) === 'no') { const r = { ok: true, say: 'Mégse.', act: 'cancel' }; remember(heard, r); show('result', r.say); return r; }
    }
    const cmd = parseNow(heard);
    if (!cmd.command) { const r = { ok: false, say: 'Nem értem.', detail: 'Mondd: „súgó”.', ask: cmd.ask }; remember(heard, r); show('error', r.say, r.detail); return r; }
    if (cmd.choices && cmd.choices.list && cmd.choices.list.length >= 2) {
      S.clarify = { cmd, slot: cmd.choices.slot, list: cmd.choices.list.slice(0, 3) };
      const r = { ok: true, say: cmd.ask, ask: cmd.ask, act: 'clarify' }; remember(heard, r); show('result', r.say, 'Mondd a nevét, vagy: „az első”.'); return r;
    }
    if (cmd.confidence < 0.6) { S.pending = { cmd, heard, until: Date.now() + 12000 }; const q = 'Úgy érted: ' + (CMD_HU[cmd.act] || cmd.command) + '?'; show('confirm', q, 'igen / mégse'); return { ok: true, say: q, ask: q, pending: true, act: cmd.act }; }
    return gate(cmd, heard);
  }
  // risky commands wait for "igen"
  function gate(cmd, heard) {
    if (cmd.confirm) {
      let what = CMD_HU[cmd.act] || cmd.command;
      if (cmd.act === 'win.close') { try { what = 'bezárjam: ' + windowLine(E.win(cmd)); } catch (e) { what = 'bezárjam?'; } }
      const q = terse(what.charAt(0).toUpperCase() + what.slice(1), 6).replace(/\?*$/, '?');
      S.pending = { cmd, heard, until: Date.now() + 12000 };
      show('confirm', q, 'Mondd: „igen” vagy „mégse”.');
      return Promise.resolve({ ok: true, say: q, pending: true, act: cmd.act });
    }
    return exec(cmd, heard);
  }

  // ------------------------------------------------------------ push-to-talk (WP-54): command mode only
  function attachVoice() {
    const V = W.VRGVoice;
    if (!V || typeof V.on !== 'function' || S.voiceOff) return !!S.voiceOff;
    const offs = [
      V.on('start', m => { if (m && m.mode === 'command') { S.listening = m.id; show('listening', '…', ''); } }),
      V.on('partial', m => { if (m && m.mode === 'command') show('listening', m.text || '…', ''); }),
      V.on('final', m => { if (m && m.mode === 'command') { S.listening = null; run(m.text || ''); } }),
      V.on('stop', m => { if (m && m.mode === 'command' && S.listening === m.id) { S.listening = null; if (hud.dataset.state === 'listening') hide(); } }),
      V.on('error', m => { if (!m || !m.mode || m.mode === 'command') { S.listening = null; show('error', terse((m && m.hu) || 'Hangfelismerési hiba.', 6)); } }),
    ];
    S.voiceOff = () => offs.forEach(f => { try { f && f(); } catch (e) {} });
    return true;
  }
  let tries = 0;
  const poll = setInterval(() => { if (attachVoice() || ++tries > 60) clearInterval(poll); }, 500);
  loadCatalog();
  setInterval(loadCatalog, 120000);

  W.VRGVoiceCmd = {
    run, parse: parseNow, providers, describe: () => E.describe(),
    vocabulary: () => (P() ? P().vocabulary(REG(), ctx()) : (REG().phrases || [])),
    state: () => ({ voice: !!S.voiceOff, pending: S.pending ? S.pending.cmd.command : '', clarify: !!S.clarify, last: S.last, history: S.hist.slice(), shown: !hud.hidden, hud: hud.dataset.state || '', catalog: S.catalog.length }),
    openInput, helpers, _env: E,
  };
})();
