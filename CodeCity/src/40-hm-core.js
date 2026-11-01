// 40-hm-core.js — Gépország (Computer Homeland, CITY-D34…D49, docs/city/homeland/): this PC as a city-state, a fourth view
// beside Város. Hardware is the land, Windows the state, programs the economy, data the cargo. 41-hm-island builds the
// fixed island, 42-hm-city puts the live numbers on it; this file holds the state, the feed, the HUD, the layers and the
// panels. The feed runs only while the view is open (POST hm-feed), and the page never invents motion: a feed that is off
// greys its part and says why. #hmtest=1 runs on made-up data under a permanent PRÓBAADAT banner.

const HM_LAYERS = [['Felszín', 0, 'Programok ablakkal'], ['Alváros', -36, 'Szolgáltatások: a 0. munkamenet'], ['Mélyút', -54, 'Kernel, megszakítások'], ['Alapkő', -70, 'UEFI, a lap vezetékei']];
const HM_TAG = { M: ['Mért', 'most mért érték'], K: ['Közelítő', 'mért adatból következtetett'], J: ['Jelkép', 'a metafora része, nincs mögötte mérés'] };
const hm = { group: null, ev: null, hw: null, layer: 0, all: false, tags: true, truth: false, sel: null, ring: [], scrub: null, rec: false, estate: null, reveal: false, plan: 0, planK: 0, gT: 0, gPlay: 0, fixture: false, fxTimer: 0, feed: 'off', ui: null, raf: 0, lastFrame: 0, confirm: null };

const hmGB = b => (b / 2 ** 30).toFixed(b >= 1e10 ? 0 : 1) + ' GB';
const hmMB = b => (b >= 2 ** 30 ? (b / 2 ** 30).toFixed(1) + ' GB' : Math.round(b / 2 ** 20) + ' MB');
const hmRate = b => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB/s' : Math.round(b / 1024) + ' kB/s');
const hmPct = v => Math.round(v || 0) + ' %';
const hmNum = v => hu(Math.round(v || 0));

// ---- entering and leaving (39-views calls these)
function hmEnter() {
  if (!hm.group) { hmBuild(); hmUiBuild(); }
  hm.group.visible = true;
  hm.ui.hidden = false;
  $('panel').classList.add('hm-below');   // the HUD bar sits where the panel starts
  hmPlanPaint();
  hm.fixture = new URLSearchParams(location.hash.slice(1)).get('hmtest') === '1';
  $('hm-fix').hidden = !hm.fixture;
  $('panel').hidden = true;
  hmSetLayer(0);
  hmHome(0);
  hmFeed(true);
  hmAnimate();
}
function hmLeave() {
  if (hm.group) hm.group.visible = false;
  if (hm.ui) hm.ui.hidden = true;
  $('panel').classList.remove('hm-below');
  hm.sel = null; $('panel').hidden = true;
  if (hm.scrub != null) hmLiveAgain();
  hm.rec = false; hmRecPaint();   // the feed stops, and the recording with it
  hmFeed(false);
  orbit.target.y = 0;
}
function hmHome(ms = 600) { orbit.target.y = 0; flyCamera(hm.estate ? [0, 0, 0, 0.14, 80 + 1.7 * hm.ePlan.side] : hm.plan ? [0, 0, 0.72, 0.5, 400] : [0, 24, 0.72, 0.9, 490], window.KV_INSTANT ? 0 : ms); }

function hmFeed(on) {
  if (hm.fixture) {
    clearInterval(hm.fxTimer); hm.feed = on ? 'fixture' : 'off';
    if (on) { hm.etwOn = true; hm.sens = { get at() { return Date.now(); }, pawnio: true, list: [{ g: 'cpu', hw: 'Próba CPU', k: 'temp', n: 'Core Average', v: 47 }, { g: 'cpu', hw: 'Próba CPU', k: 'power', n: 'CPU Package', v: 38 }, { g: 'board', hw: 'Próba alaplap', k: 'fan', n: 'Fan #1', v: 900 }] }; hm.diskIo = { get at() { return Date.now(); }, list: [{ exe: 'alfa-bongeszo.exe', disk: 0, r: 4e6, w: 2e5 }, { exe: 'git', disk: 0, r: 1e6, w: 3e6 }, { exe: 'System', disk: 0, r: 2e5, w: 9e5 }] }; hmHwEvent(hmFixtureHw()); hmEvent(hmFixtureEvent()); hm.fxTimer = setInterval(() => hmEvent(hmFixtureEvent()), 1000); }
    return;
  }
  if (!window.KV_COMPANION) { hm.feed = 'nocomp'; hmHud(); return; }
  if (!on) { hm.feed = 'off'; kvCall('hm-feed', { on: false }); return; }
  hm.feed = 'wait'; hmHud();
  live.ready.then(() => { if (vw.id === 'homeland') return kvCall('hm-feed', { on: true }); }).then(r => {
    if (!r) return;
    if (r.status !== 200) hm.feed = 'err';
    if (r.json && r.json.hw) hmHwEvent(r.json.hw);
    if (r.json) { hm.rec = !!r.json.rec; hmRecPaint(); hm.etwOn = !!r.json.etw; if (r.json.sens) hm.sens = r.json.sens; }
    if (r.json && r.json.state === 'missing') hm.feed = 'noprobe';
    hmHud();
  });
}
function hmEvent(d) {
  if (vw.id !== 'homeland') return;
  hmRingPush(d);   // 47-hm-time
  hm.feed = d.fixture ? 'fixture' : 'on';
  if (hm.scrub != null) return;   // looking back: the live city waits
  hm.ev = d;
  hmApply(d);   // 42-hm-city
  hmHud();
  hmPanel();
}
// the elevated sidecar's readings; a reading older than 20 s is no reading
function hmSensEvent(d) { hm.sens = d.off ? null : d; hm.etwOn = !d.off; hmHud(); hmPanel(); }
function hmSensor(g, k, hw) {
  const s = hm.sens;
  if (!s || Date.now() - s.at > 20000) return [];
  return s.list.filter(r => r.g === g && r.k === k && (!hw || hw.startsWith(r.hw) || r.hw.startsWith(hw)));
}
function hmCpuTemp() { const l = hmSensor('cpu', 'temp'); return (l.find(r => /average/i.test(r.n)) || l.find(r => /package/i.test(r.n)) || l[0] || {}).v; }
function hmSensWord() {
  if (!hm.etwOn) return 'ETW: ki · szenzor: ki';
  if (!hm.sens) return 'ETW: be · szenzor: ki';   // an older sidecar sends none
  return `ETW: be · szenzor: ${hm.sens.pawnio ? 'be' : 'nincs PawnIO'}`;
}
// ETW names a program without the .exe the process list has
const hmExeKey = s => { const k = String(s).toLowerCase(); return k === 'system' || k.endsWith('.exe') ? k : k + '.exe'; };
// ETW's exact traffic per program, summed by name; it is already on the stream for the Land, so nothing is measured twice
function hmCargoEvent(d) {
  if (vw.id !== 'homeland') return;
  const by = new Map();
  for (const p of d.list || []) { const k = hmExeKey(p.exe), g = by.get(k) || { exe: p.exe, rx: 0, tx: 0 }; g.rx += p.rx; g.tx += p.tx; by.set(k, g); }
  hm.cargo = { at: d.at, by };
  hm.etwOn = true;
}
const hmCargo = () => (hm.scrub == null && hm.cargo && Date.now() - hm.cargo.at < 5000 ? hm.cargo.by : null);
function hmHwEvent(d) { hm.hw = d; hmHwApply(d); hmHud(); hmPanel(); if (hm.ePending) hmEstateOpen(); else if (hm.estate) { hmEstateDraw(); hmDrivesPaint(); } }

// ---- the HUD: the state's budget in one line, the switches, the layer rail
function hmUiBuild() {
  hm.ui = document.createElement('div'); hm.ui.id = 'hm-ui'; hm.ui.hidden = true;
  hm.ui.innerHTML = `<div id="hm-fix" hidden>PRÓBAADAT — kitalált számok, nem ez a gép</div>
    <div id="hm-hud" aria-live="off"></div>
    <div id="hm-sw" role="group" aria-label="Kapcsolók">
      <button class="btn" data-sw="all" title="Minden folyamat külön épület (A)">Mind</button>
      <button class="btn" data-sw="tags" title="Mért, közelítő és jelkép jelölése a városban (T)">Jelölés</button>
      <button class="btn" data-sw="truth" title="Csak a mért elemek látszanak (M)">Mérés</button>
    </div>
    <div id="hm-plan" role="group" aria-label="Várostérkép">
      <button class="btn" data-plan="0" title="Az alaplap valódi bekötése (N)">Bekötés</button>
      <button class="btn" data-plan="1" title="A város, ahogy a git-történetben nőtt (N)">Növekedés</button>
      <button class="btn" data-plan="2" title="A meghajtók birtokként, felülről (B)">Birtok</button>
      <button class="btn" id="hm-replay" hidden title="A növekedés elölről (R)">Újra</button>
      <span id="hm-drives" hidden></span>
      <span id="hm-when" class="dim" hidden></span>
    </div>
    <nav id="hm-rail" aria-label="Rétegek">${HM_LAYERS.map((l, i) => `<button class="btn" data-layer="${i}" title="${esc(l[2])} (PgUp / PgDn)">${esc(l[0])}</button>`).join('')}</nav>
    <div id="hm-key"><span><i class="m"></i>Mért</span><span><i class="k"></i>Közelítő</span><span><i class="j"></i>Jelkép</span></div>`;
  $('stage').append(hm.ui);
  hm.ui.addEventListener('click', e => {
    const l = e.target.closest('[data-layer]'); if (l) return hmSetLayer(+l.dataset.layer);
    const s = e.target.closest('[data-sw]'); if (s) return hmSwitch(s.dataset.sw);
    const p = e.target.closest('[data-plan]'); if (p) return hmSetPlan(+p.dataset.plan);
    const d = e.target.closest('[data-drive]'); if (d) return hmEstateOpen(d.dataset.drive);
    if (e.target.closest('[data-rescan]')) return hmEstateAsk(true);
    if (e.target.id === 'hm-replay') hmReplay();
  });
  hmSwitchPaint(); hmPlanPaint(); hmTimeBuild();
}
function hmSwitch(k) {
  hm[k] = !hm[k];
  hmSwitchPaint();
  hmTagsApply();
  if (k === 'all' && hm.ev) hmApply(hm.ev);
  requestRender();
}
function hmSwitchPaint() { for (const b of hm.ui.querySelectorAll('[data-sw]')) b.classList.toggle('on', !!hm[b.dataset.sw]); }
function hmHud() {
  if (!hm.ui) return;
  const el = $('hm-hud'), e = hm.ev, msg = { off: 'A feed áll.', wait: 'Csatlakozás a szondához…', err: 'A segéd hibát jelzett.', nocomp: 'Élő adat a segéddel jön: START → K → G.',
    noprobe: 'A szonda nincs lefordítva: node CodeCity/tools/build-probe.js' }[hm.feed];
  if (!e || msg) { el.innerHTML = `<b>Gépország</b> <span class="dim">${esc(msg || '')}</span>`; return; }
  const m = e.mem, cpu = e.cores.reduce((a, c) => a + c.u + c.k, 0) / Math.max(1, e.cores.length), ram = m.total ? 100 * (1 - m.avail / m.total) : 0;
  const eng = (e.gpu && e.gpu.eng) || {}, gpu = Math.min(100, Object.values(eng).reduce((a, v) => Math.max(a, v), 0));
  const disk = Math.max(0, ...e.disks.map(d => d.busy)), rx = e.nics.reduce((a, n) => a + n.rx, 0), tx = e.nics.reduce((a, n) => a + n.tx, 0);
  const obs = e.obsCpu != null ? e.obsCpu : e.procs.filter(p => p.obs).reduce((a, p) => a + p.cpu, 0), hints = new Set(e.procs.filter(p => p.hint).map(p => p.key)).size;
  el.innerHTML = `<b>Gépország</b> <span>CPU <b>${hmPct(cpu)}</b>${hmCpuTemp() != null ? ` · ${Math.round(hmCpuTemp())} °C` : ''}</span><span>RAM <b>${hmPct(ram)}</b></span><span>GPU <b>${hmPct(gpu)}</b>${e.gpu && e.gpu.temp != null ? ` · ${Math.round(e.gpu.temp)} °C` : ''}</span>` +
    `<span>lemez <b>${hmPct(disk)}</b></span><span>háló ↓${hmRate(rx)} ↑${hmRate(tx)}</span><span>${hu(e.procs.reduce((a, p) => a + (p.n || 1), 0))} folyamat</span>` +
    (hints ? `<span class="warn">${hints} gyanús jel</span>` : '') + (hm.rec ? '<span class="warn">● felvétel fut</span>' : '') +
    `<span class="dim" title="A szonda ideje mintánként és a megfigyelő saját CPU-ja: a mérés is a gépen fut">megfigyelő ${e.ms} ms · ${obs.toFixed(1)} %</span><span class="dim">${hmSensWord()}</span>`;
}

// ---- layers: PgDn peels the surface off, nothing vanishes: it fades to a ghost above the layer you look at
function hmSetLayer(i) {
  hm.layer = Math.max(0, Math.min(HM_LAYERS.length - 1, i));
  for (const b of hm.ui.querySelectorAll('[data-layer]')) b.classList.toggle('on', +b.dataset.layer === hm.layer);
  hmLayerApply();   // 41-hm-island
  hmFlyY(HM_LAYERS[hm.layer][1]);
}
function hmFlyY(y) {
  const y0 = orbit.target.y, t0 = performance.now(), ms = window.KV_INSTANT ? 0 : 450;
  const step = () => {
    const k = ms ? Math.min(1, (performance.now() - t0) / ms) : 1, e = k * k * (3 - 2 * k);
    orbit.target.y = y0 + (y - y0) * e; placeCamera();
    if (k < 1) requestAnimationFrame(step);
  };
  step();
}

// ---- the keys of this view; the city's own keys (lenses, timeline, roads…) would act on a hidden city
addEventListener('keydown', e => {
  if (vw.id !== 'homeland' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea, select')) return;
  const k = e.key;
  if (k === 'v' || k === 'V' || k === 'l' || k === 'L' || k === 'Escape' || k === 'Tab') return;
  e.stopImmediatePropagation();
  if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); if (!hm.estate) hmSetLayer(hm.layer + (k === 'PageDown' ? 1 : -1)); }
  else if (k === 'Home') { e.preventDefault(); hmHome(); }
  else if (k === 'a' || k === 'A') hmSwitch('all');
  else if (k === 't' || k === 'T') hmSwitch('tags');
  else if (k === 'm' || k === 'M') hmSwitch('truth');
  else if (k === 'n' || k === 'N') hmSetPlan(hm.plan ? 0 : 1);
  else if (k === 'r' || k === 'R') hmReplay();
  else if (k === 'b' || k === 'B') hmSetPlan(hm.estate ? hm.plan : 2);
  else if (k === 'ArrowLeft' || k === 'ArrowRight') { if (!hm.estate) { e.preventDefault(); hmStep(k === 'ArrowLeft' ? -5 : 5); } }
  else if (k === 'End') { e.preventDefault(); if (hm.scrub != null) hmLiveAgain(); }
}, true);

// ---- the panel: fixed order, every number says where it comes from
function hmShow(t) {
  hm.sel = t; hm.confirm = null;
  if (!t) { $('panel').hidden = true; hmSelApply(); return; }
  hmPanel(); hmSelApply();
}
function hmFooter(tag, src) { return `<p class="dim hm-src"><i class="hm-t ${tag.toLowerCase()}"></i>${HM_TAG[tag][0]}: ${HM_TAG[tag][1]}${src ? '<br>Forrás: ' + esc(src) : ''}</p>`; }
function hmPanel() {
  const t = hm.sel;
  if (t && t.grow) return hmGrowPanel(t);
  if (t && t.est) return hmEstatePanel(t);
  if (t && t.pages) return;   // 48-hm-pages paints its own, only when a reading comes
  if (!t || !hm.ev && t.kind !== 'static') { if (t) hmPanelStatic(t); return; }
  if (t.prog) return hmProgPanel(t.prog);
  const e = hm.ev, hw = hm.hw || {}, m = e.mem, s = e.sys;
  const P = (title, rows, tag, src, extra = '') => { openPanel(title, rows, extra + hmFooter(tag, src)); };
  switch (t.id) {
    case 'fab': {
      const cpu = e.cores.reduce((a, c) => a + c.u + c.k, 0) / Math.max(1, e.cores.length);
      return P('Gyárnegyed · CPU', [['Egység', esc((hw.cpu && hw.cpu.name) || '—')], ['Terhelés', hmPct(cpu)], ['Órajel', hmNum(s.mhz * (s.perf || 100) / 100) + ' MHz'], ...(hmCpuTemp() != null ? [['Hőmérséklet', Math.round(hmCpuTemp()) + ' °C']] : []), ...hmSensor('cpu', 'power').filter(r => /package/i.test(r.n)).map(r => ['Teljesítmény', r.v.toFixed(0) + ' W']), ['Váltás', hmNum(s.ctx) + ' /s'], ['Rendszerhívás', hmNum(s.sys) + ' /s']], 'M', 'NtQuerySystemInformation, PDH · 1 s',
        `<ul class="hm-bars">${e.cores.map((c, i) => `<li><span>${Math.floor(i / 2) + 1}${'AB'[i % 2]}</span><i style="width:${Math.min(100, c.u + c.k)}%"></i></li>`).join('')}</ul>`);
    }
    case 'market': {
      const kern = m.paged + m.nonpaged;
      P('Piac · RAM', [['Összes', hmGB(m.total)], ['Programok', hmGB(Math.max(0, m.total - m.avail - kern - m.modified))], ['Állam (pool)', hmGB(kern)], ['Kirakodásra vár', hmMB(m.modified)], ['Készenlét', hmGB(m.standby)], ['Üres', hmMB(m.free)],
        ['Lekötve', `${hmGB(m.commit)} / ${hmGB(m.limit)}`], ['Lapbetöltés', hmNum(m.hard) + ' /s']], 'M', 'GetPerformanceInfo, PDH · 1 s', '<p class="dim">A telkek helye jelkép, az arányok mértek. A programok közti elosztás közelítő: a megosztott lapok több programnál is számítanak.</p><p><button class="btn" data-hmpages>Fizikai lapok…</button></p>');
      $('panel').querySelector('[data-hmpages]').onclick = hmPagesOpen;
      return;
    }
    case 'empty': return P('Üres telek', [['Foglalatok', hw.ram ? `${hw.ram.dimms.length} / ${hw.ram.slots} foglalt` : '—']], 'M', 'Win32_PhysicalMemory', '<p class="dim">Egy modul, egy csatorna: a Piac utca egysávos.</p>');
    case 'studio': {
      const g = e.gpu || {}, eng = g.eng || {};
      return P('Filmgyár · GPU', [['Egység', esc((hw.gpu && hw.gpu.name) || '—')], ['3D', hmPct(eng['3D'])], ['Másolás', hmPct(eng.Copy)], ['Videó', `${hmPct(eng.VideoDecode)} be · ${hmPct(eng.VideoEncode)} ki`], ['Kellékraktár', `${hmMB(g.ded || 0)}${g.total ? ' / ' + hmMB(g.total) : ''}`],
        ['Hőmérséklet', g.temp != null ? Math.round(g.temp) + ' °C' : '—'], ['Órajel', g.mhz ? hmNum(g.mhz) + ' MHz' : '—']], 'M', 'PDH GPU Engine · 1 s; nvidia-smi · 5 s');
    }
    case 'junction': return P('Rendező · chipset', [['Lemezek', hmRate(e.disks.reduce((a, d) => a + d.r + d.w, 0))], ['Hálózat', hmRate(e.nics.reduce((a, n) => a + n.rx + n.tx, 0))]], 'K', 'a mögötte lévő eszközök összege', '<p class="dim">A chipsetnek nincs saját forgalommérője: ez a rajta áthaladó eszközök összege.</p>');
    case 'palace': {
      const kern = e.cores.reduce((a, c) => a + c.k, 0) / Math.max(1, e.cores.length);
      return P('Palota · kernel', [['Kernel CPU', hmPct(kern)], ['Rendszerhívás', hmNum(s.sys) + ' /s'], ['Megszakítás', hmNum(s.irq) + ' /s'], ['DPC', hmPct(s.dpc)]], 'M', 'PDH · 1 s');
    }
    case 'harbour': {
      const by = hmCargo(), top = by ? [...by.values()].sort((a, b) => b.rx + b.tx - a.rx - a.tx).slice(0, 6) : [];
      return P('Tengeri kikötő · hálózat', [...e.nics.map(n => [esc(n.name.slice(0, 26)), `↓${hmRate(n.rx)} ↑${hmRate(n.tx)}`]), ...top.map(g => [esc(g.exe.slice(0, 26)), `↓${hmRate(g.rx)} ↑${hmRate(g.tx)}`])], 'M', by ? 'PDH Network Interface · 1 s; ETW · 1 s' : 'PDH Network Interface · 1 s', by ? '' : '<p class="dim">Programonkénti forgalom az ETW-vel jön.</p>');
    }
    case 'barracks': {
      const on = hmFold(e.procs.filter(p => p.cls === 'military'));
      return P('Laktanya · vírusirtók', on.map(g => [esc(g.exe), `${g.cpu.toFixed(1)} % · ${hmMB(g.ws)}`]), 'M', 'folyamatlista · 1 s', '<p class="dim">Az őrjárat jelkép; a jelenlét és a terhelés mért.</p>');
    }
    case 'bedrock': return hmPanelStatic(t);
  }
  if (t.disk) {
    const d = e.disks.find(x => x.letters.includes(t.disk)), inv = (hw.disks || []).find(x => (x.vols || []).some(v => v.letter === t.disk)), vol = inv && inv.vols.find(v => v.letter === t.disk);
    return P(`${t.name} · ${t.disk}`, [['Lemez', esc((inv && inv.model) || '—')], ['Olvasás', d ? hmRate(d.r) : '—'], ['Írás', d ? hmRate(d.w) : '—'], ['Foglaltság', d ? hmPct(d.busy) : '—'], ['Sor', d ? hmNum(d.q) : '—'], ['Szabad', vol ? `${hmGB(vol.free)} / ${hmGB(vol.size)}` : '—'], ...hmSensor('disk', 'temp', inv && inv.model).slice(0, 1).map(r => ['Hőmérséklet', Math.round(r.v) + ' °C']), ...(d ? hmDiskTop(d.id) : []).map(x => [esc(x.exe.slice(0, 26)), `be ${hmRate(x.r)} · ki ${hmRate(x.w)}`])], 'M', d && hmDiskTop(d.id).length ? 'PDH PhysicalDisk · 1 s; ETW · 1 s' : 'PDH PhysicalDisk · 1 s',
      d && hmDiskTop(d.id).length ? '' : '<p class="dim">Melyik program használja: a frissített ETW-segéddel jön.</p>');
  }
  hmPanelStatic(t);
}
function hmPanelStatic(t) {
  const hw = hm.hw || {}, b = hw.bios || {};
  if (t.id === 'bedrock') return openPanel('Alapkő · firmware', [['Alaplap', esc(hw.board || '—')], ['UEFI', esc(`${b.maker || ''} ${b.version || ''}`)], ['Dátum', esc(b.date || '—')], ...hmSensor('board', 'fan').map(r => [esc(r.n), hmNum(r.v) + ' /perc']), ...hmSensor('board', 'temp').slice(0, 4).map(r => [esc(r.n), Math.round(r.v) + ' °C'])], hmFooter('M', hm.sens ? 'Win32_BIOS; LibreHardwareMonitor · 5 s' : 'Win32_BIOS'));
  openPanel(t.name || '—', [], hmFooter(t.tag || 'J', ''));
}
// a program: one row per fact; closing needs a second click (CITY-D47 B) and goes through its windows' own close
function hmProgPanel(key) {
  const e = hm.ev, list = e.procs.filter(p => (hm.sel.pid ? p.pid === hm.sel.pid : p.key === key));
  if (!list.length) { openPanel(key, [['Állapot', 'Már nem fut']], ''); return; }
  const g = hmFold(list)[0], parent = new Map(e.procs.map(p => [p.pid, p])).get(list[0].ppid), layer = { 0: 'Felszín', '-1': 'Utcaszint', '-2': 'Alváros', '-3': 'Mélyút' }[g.layer];
  const hint = g.hint ? `<p class="warn">Gyanús jel, nem ítélet: ${g.hint === 'temp' ? 'Temp mappából fut' : 'a Letöltések mappából fut'}. Automatikus művelet nincs.</p>` : '';
  const can = hm.scrub == null && g.win > 0 && !list.some(p => p.ours);
  const btn = !can ? '' : hm.confirm === key
    ? `<p class="warn">Bezárod a(z) ${esc(g.exe)} ${g.win} ablakát? A program még rákérdezhet a mentésre.</p><button class="btn" data-hmclose="yes">Igen, bezárom</button> <button class="btn" data-hmclose="no">Mégse</button>`
    : '<button class="btn" data-hmclose="ask">Program bezárása…</button>';
  openPanel(g.exe, [['Réteg', layer + (g.s === 0 ? ' · 0. munkamenet' : '')], ['Osztály', esc(g.cls)], ['Folyamat', hu(g.n)], ['Szál', hu(g.th)], ['CPU', g.cpu.toFixed(1) + ' %'], ['Munkakészlet', hmMB(g.ws)], ['Saját', hmMB(g.priv)],
    ['I/O', `be ${hmRate(g.r)} · ki ${hmRate(g.w)}`], ...(hmCargo() && hmCargo().has(key) ? [['Hálózat', `↓${hmRate(hmCargo().get(key).rx)} ↑${hmRate(hmCargo().get(key).tx)}`]] : []), ...(hmDiskOf(key) ? [['Lemez', `be ${hmRate(hmDiskOf(key).r)} · ki ${hmRate(hmDiskOf(key).w)}`]] : []), ['Lapbetöltés', hmNum(g.hard) + ' /s'], ['Ablak', hu(g.win)], ['Indította', parent ? esc(parent.exe) : '—']], hint + btn + hmFooter('M', `NtQuerySystemInformation · 1 s; az I/O a hálózatot is tartalmazza${hmCargo() ? '; hálózat: ETW · 1 s' : ''}${hmDiskOf(key) ? '; lemez: ETW · 1 s' : ''}`));
  const box = $('panel');
  box.querySelectorAll('[data-hmclose]').forEach(b => { b.onclick = () => hmCloseStep(b.dataset.hmclose, key); });
}
async function hmCloseStep(step, key) {
  if (step === 'ask') { hm.confirm = key; return hmPanel(); }
  hm.confirm = null;
  if (step === 'no') return hmPanel();
  if (hm.fixture) { kvToast('Próbaadat: nincs mit bezárni'); return hmPanel(); }
  const r = await kvCall('hm-close', { key });
  kvToast(r.status === 200 ? `Bezárás kérve: ${r.json.n} ablak` : (r.json && r.json.error) || 'Nem sikerült');
  hmPanel();
}

// ---- #hmtest=1: repeatable made-up data of the feed's own shape; every name is invented
const HMFX_PROCS = [['alfa-bongeszo.exe', 'browser', 'belvaros', 0, 1, 900], ['alfa-bongeszo.exe', 'browser', 'belvaros', 1, 0, 420], ['alfa-bongeszo.exe', 'browser', 'belvaros', 1, 0, 300], ['tervezo-szerkeszto.exe', 'editor', 'belvaros', 0, 2, 640],
  ['mester.exe', 'agent', 'muhely', 0, 1, 380], ['node.exe', 'build', 'muhely', 1, 0, 120], ['git.exe', 'git', 'muhely', 1, 0, 24], ['tarsasjatek.exe', 'game', 'belvaros', 0, 1, 1200], ['fenykep-nezo.exe', 'media', 'belvaros', 0, 1, 180],
  ['ismeretlen-segito.exe', 'other', 'kulvaros', 1, 0, 60], ['frissito.exe', 'other', 'kulvaros', 1, 0, 40], ['tuzfal-ugynok.exe', 'military', 'laktanya', 2, 0, 210], ['orseg.exe', 'military', 'laktanya', 2, 0, 160],
  ['svchost.exe', 'state', 'palota', 2, 0, 90], ['svchost.exe', 'state', 'palota', 2, 0, 60], ['svchost.exe', 'state', 'palota', 2, 0, 44], ['spoolsv.exe', 'state', 'palota', 2, 0, 18], ['explorer.exe', 'state', 'palota', 0, 3, 240], ['System', 'state', 'palota', 3, 0, 2]];
let hmFxT = 0;
function hmFixtureHw() {
  return { board: 'Próba alaplap', bios: { maker: 'Próba', version: 'F0', date: '2000-01-01' }, cpu: { name: 'Próba CPU', cores: 6, threads: 12, l3: 12288 }, ram: { slots: 2, dimms: [{ slot: 'B', size: 2 ** 34, speed: 2666 }] },
    gpu: { name: 'Próba GPU', w: 1920, h: 1080, hz: 60 }, disks: [['C:', 'Próba SSD A'], ['H:', 'Próba SSD B'], ['G:', 'Próba HDD'], ['F:', 'Próba USB-lemez']].map(([l, model], index) => ({ index, model, size: 1e12, vols: [{ letter: l, size: 1e12, free: 4e11 }] })), nics: [], audio: [] };
}
function hmFixtureEvent() {
  const t = ++hmFxT, w = (a, b) => a + (b - a) * (0.5 + 0.5 * Math.sin(t / 3 + a)), total = 2 ** 34;
  const procs = HMFX_PROCS.map((p, i) => ({ pid: 100 + i, ppid: 100, exe: p[0], key: p[0].toLowerCase(), s: p[3] === 2 || p[3] === 3 ? 0 : 1, th: 8 + i, ws: p[5] * 2 ** 20, priv: p[5] * 7e5, cls: p[1], place: p[2], layer: -p[3],
    cpu: w(1, 3) * (i % 4 === 0 ? 3 : 0.4), r: i % 3 ? 0 : 2e5, w: i % 5 ? 0 : 5e4, hard: i % 3 ? 0 : 20, win: p[4], fg: i === 3, hint: p[0] === 'frissito.exe' ? 'temp' : '', obs: false, ours: p[0] === 'explorer.exe' }));
  return { at: Date.now(), ms: 30, fixture: true, procs, cores: Array.from({ length: 12 }, (_, i) => ({ u: w(5, 60) * (1 - i / 16), k: w(2, 10) })), disks: [[0, 'C:', 2e7, 0.9], [1, 'G:', 2e5, 0.1], [2, 'H:', 4e6, 0.3], [3, 'F:', 0, 0]].map(([id, l, r, b]) => ({ id, letters: [l], r: r * (t % 2 ? 1 : 0.5), w: r / 6, q: 1, busy: b * 60 })),
    nics: [{ name: 'Próba hálózat', rx: 3e5, tx: 2e4 }], gpu: { eng: { '3D': w(4, 40), Copy: 3, VideoDecode: 1, VideoEncode: 0 }, ded: 1.4e9, total: 4e9, temp: 50, mhz: 900 },
    sys: { ctx: 30000, sys: 200000, irq: 20000, dpc: 0.4, irqp: 0.6, mhz: 2900, perf: 95 }, mem: { total, avail: 2 ** 31 + 2 ** 30, commit: 2 ** 35, limit: 2 ** 36, paged: 1.4e9, nonpaged: 9e8, modified: 3e8, standby: 2 ** 31, free: 2 ** 30, faults: 4000, hard: 40, page: 12 } };
}
