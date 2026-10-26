// 23-agents.js — live Claude in the city (P4, KV-09; no settings change). The segéd polls `claude agents
// --json` and tails each running session's transcript (sessions.js filter: kind + path only); the stream
// brings 'agents' and 'beam'. Every running session is a figure in its own colour, waiting at the city
// gate; when it reads, searches or edits a file of the repo it flies over that building and a beam drops
// onto the roof (blue read · violet search · amber edit — the replay's colours). A session waiting for you
// turns amber. The City Hall dispatch board sorts every session into five bays.
// With the hooks (KV-10) a path outside the repo lands in the outskirts: one anonymous plate per zone west of
// the city (the zone's name is only on the board, blurred until clicked — CITY-D27 A). A restricted zone
// (.ssh, Planner/data|home, credentials, H_BACKUP_*, client PDFs) beams red and adds a 'Figyelem' line;
// it is shown, never blocked (CITY-D16 A). A hook reports a call twice: 'pre' draws the beam, 'post' pulses.

const AG_BAYS = [['sorban', 'Sorban'], ['dolgozik', 'Dolgozik'], ['var', 'Rád vár'], ['kesz', 'Kész'], ['hiba', 'Hiba']];
const AG_BEAM_MS = 1600, AG_FLY_MS = 600, AG_AMBER = 0xffb300;
const ag = { list: [], figs: new Map(), beams: [], raf: 0, outside: new Map(), open: false, el: null,
  zones: new Map(), seenZones: new Map(), alerts: [], reveal: false };
const AG_RED = 0xff3b3b;

const agBay = st => /work|busy|running/.test(st) ? 'dolgozik' : /block|wait|permission/.test(st) ? 'var'
  : /done|idle|complete|stopp/.test(st) ? 'kesz' : /fail|error/.test(st) ? 'hiba' : 'sorban';
function agHue(id) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 360) / 360; }
const agScale = () => Math.max(1, current.side / 90);

// a folder of the city by its path ('' = the repo)
function agDir(p) {
  let d = current.root;
  for (const part of p ? p.split('/') : []) { d = d.dirs.get(part); if (!d) return null; }
  return d;
}
// where a beam lands: the roof of a file, the middle of a district plate
function agSpot(p) {
  const i = current.city.files.findIndex(f => f.p === p);
  if (i >= 0 && replay.cur[i * 3] > 0) {
    const f = current.city.files[i], { x, z, w, h } = f.rect;
    return { i, at: new THREE.Vector3(x + w / 2, f.base + replay.cur[i * 3], z + h / 2) };
  }
  const d = agDir(p);
  if (!d || !d.rect) return null;
  const { x, z, w, h } = d.rect;
  return { i: -1, at: new THREE.Vector3(x + w / 2, d.depth * PLATE, z + h / 2) };
}
// the outskirts: one plate per outside zone, in a column west of the city (made again after a city swap)
function agZoneSpot(zone, restricted) {
  let z = ag.zones.get(zone);
  if (!z || z.mesh.parent !== world.group) {
    const k = z ? z.k : ag.zones.size, s = current.side, sc = agScale();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s * 0.06, 0.4 * sc, s * 0.06).translate(0, 0.2 * sc, 0),
      new THREE.MeshBasicMaterial({ color: restricted ? AG_RED : 0x3a4a78, transparent: true, opacity: 0.6, fog: false }));
    mesh.raycast = () => {};
    mesh.position.set(-s / 2 - s * (0.1 + 0.08 * Math.floor(k / 10)), 0, -s / 2 + s * (0.06 + 0.095 * (k % 10)));
    world.group.add(mesh);
    z = { mesh, k, restricted }; ag.zones.set(zone, z);
  }
  return z.mesh.position.clone();
}
function agGate(k, n) {
  const s = current.side;
  return new THREE.Vector3(-s / 2 + s * (k + 1) / (n + 1), 0, s / 2 + s * 0.06);
}

function agFigure(a) {
  let fg = ag.figs.get(a.id);
  if (fg && fg.group.parent === world.group) return fg;
  if (fg) ag.figs.delete(a.id);
  const color = new THREE.Color().setHSL(agHue(a.id), 0.75, 0.6), k = agScale();
  const mat = new THREE.MeshBasicMaterial({ color, fog: false });
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.1 * k, 3 * k, 12).translate(0, 1.5 * k, 0), mat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.8 * k, 14, 10).translate(0, 3.6 * k, 0), mat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8 * k, 0.18 * k, 8, 28).rotateX(Math.PI / 2).translate(0, 0.3 * k, 0),
    new THREE.MeshBasicMaterial({ color: AG_AMBER, fog: false }));
  const group = new THREE.Group();
  group.add(body, head, ring);
  group.traverse(o => { o.raycast = () => {}; });
  world.group.add(group);
  fg = { id: a.id, group, mat, ring, color, from: null, to: null, t0: 0 };
  ag.figs.set(a.id, fg);
  return fg;
}
function agMove(fg, to) {
  fg.from = fg.group.position.clone(); fg.to = to.clone(); fg.t0 = performance.now();
  agAnimate();
}

// ---- events from the segéd (also fed directly by the #agenttest hook)
function agentsEvent(d) {
  if (!world) return;
  ag.list = d.list || [];
  const running = ag.list.filter(a => agBay(a.state) !== 'kesz' && agBay(a.state) !== 'hiba');
  running.forEach((a, k) => {
    const fresh = !ag.figs.has(a.id) || ag.figs.get(a.id).group.parent !== world.group;
    const fg = agFigure(a);
    fg.ring.visible = agBay(a.state) === 'var';            // waiting for you: an amber ring
    if (fresh) fg.group.position.copy(agGate(k, running.length));
  });
  for (const [id, fg] of ag.figs) if (!running.some(a => a.id === id)) { world.group.remove(fg.group); ag.figs.delete(id); }
  agBoard(); requestRender();
}
function beamEvent(b) {
  if (!world) return;
  if (b.restricted) {   // shown, never blocked: one 'needs you' line per session and zone
    const key = b.id + '|' + b.restricted;
    if (!ag.alerts.some(x => x.key === key)) ag.alerts.unshift({ key, id: b.id, zone: b.restricted, kind: b.kind, at: Date.now() });
    ag.alerts = ag.alerts.slice(0, 20);
  }
  if (b.outside || b.p === undefined) {
    ag.outside.set(b.id, (ag.outside.get(b.id) || 0) + 1);
    if (b.zone) { const zs = ag.seenZones.get(b.id) || new Set(); zs.add(b.zone); ag.seenZones.set(b.id, zs); }
    agBoard();
    if (!b.zone || b.phase === 'post') return;
    return agBeam(b, { i: -1, at: agZoneSpot(b.zone, !!b.restricted) });
  }
  const spot = agSpot(b.p);
  if (!spot) { if (b.restricted) agBoard(); return; }
  if (b.phase === 'post') { if (spot.i >= 0) livePulse([spot.i]); return; }
  agBeam(b, spot);
}
function agBeam(b, spot) {
  const a = ag.list.find(x => x.id === b.id) || { id: b.id, name: b.id, state: 'working' };
  if (!ag.list.includes(a)) { ag.list.push(a); agBoard(); }
  const fg = agFigure(a), k = agScale();
  agMove(fg, spot.at.clone().add(new THREE.Vector3(0, 8 * k, 0)));
  const col = b.restricted ? AG_RED : SESS_COLOR[b.kind] || 0xffffff;
  const geo = new THREE.BufferGeometry().setFromPoints([spot.at.clone().add(new THREE.Vector3(0, 8 * k, 0)), spot.at]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 1, fog: false }));
  line.raycast = () => {};
  world.group.add(line);
  ag.beams.push({ line, t0: performance.now() });
  if (spot.i >= 0) livePulse([spot.i]);
  agAnimate();
  if (b.restricted) agBoard();
}

function agAnimate() { if (!ag.raf) ag.raf = requestAnimationFrame(agFrame); }
function agFrame() {
  ag.raf = 0;
  const now = performance.now();
  let busy = false;
  for (const fg of ag.figs.values()) {
    if (!fg.to) continue;
    const k = Math.min(1, (now - fg.t0) / AG_FLY_MS), e = k * (2 - k);
    fg.group.position.lerpVectors(fg.from, fg.to, e);
    if (k >= 1) fg.to = null; else busy = true;
  }
  ag.beams = ag.beams.filter(bm => {
    const k = (now - bm.t0) / AG_BEAM_MS;
    if (k >= 1) { world.group.remove(bm.line); bm.line.geometry.dispose(); return false; }
    bm.line.material.opacity = 1 - k; busy = true; return true;
  });
  requestRender();
  if (busy) agAnimate();
}

// ---- City Hall: the dispatch board, five bays
function agBoard() {
  const btn = $('hall-btn'), act = ag.list.filter(a => ['dolgozik', 'var'].includes(agBay(a.state))).length;
  const wait = ag.list.filter(a => agBay(a.state) === 'var').length;
  const clash = fen.list.filter(fc => fc.conflict).length;
  btn.hidden = !ag.list.length && !fen.list.length;
  btn.textContent = `Városháza ${act}` + (wait ? ` · ${wait} rád vár` : '') + (clash ? ` · ${clash} ütközés` : '');
  btn.classList.toggle('wait', !!(wait || clash));
  if (!ag.open) return;
  if (!ag.el) {
    ag.el = document.createElement('aside'); ag.el.id = 'hall';
    ag.el.addEventListener('click', e => {
      const s = e.target.closest('[data-ag]'), fg = s && ag.figs.get(s.dataset.ag);
      if (e.target.closest('.x')) return agToggle(false);
      if (e.target.closest('[data-reveal]')) { ag.reveal = !ag.reveal; return agBoard(); }
      const fp = e.target.closest('[data-path]'), ff = fp && current.city.files.find(x => x.p === fp.dataset.path);
      if (ff) { showFile(ff); flyTo(ff); return; }
      if (fg) { orbit.target.copy(fg.group.position).setY(0); placeCamera(); }
    });
    document.body.append(ag.el);
  }
  const strip = a => {
    const c = '#' + new THREE.Color().setHSL(agHue(a.id), 0.75, 0.6).getHexString(), out = ag.outside.get(a.id);
    const m = a.startedAt ? Math.max(0, Math.round((Date.now() - a.startedAt) / 60000)) : null;
    const age = m === null ? null : m < 60 ? hu(m) + ' perce' : m < 1440 ? hu(Math.round(m / 60)) + ' órája' : hu(Math.round(m / 1440)) + ' napja';
    return `<div class="strip" data-ag="${esc(a.id)}" title="${esc(a.name || a.id)}"><i style="background:${c}"></i>${esc(a.name || a.id)}` +
      `<small>${a.inRepo ? 'a repóban' : 'a repón kívül indult'}${a.kind ? ' · ' + esc(a.kind) : ''}${age !== null ? ' · ' + age : ''}${out ? ' · kívül: ' + hu(out) : ''}</small>` +
      (ag.seenZones.has(a.id) ? `<small class="zones${ag.reveal ? '' : ' blur'}">${[...ag.seenZones.get(a.id)].map(esc).join(' · ')}</small>` : '') + '</div>';
  };
  const who = id => esc((ag.list.find(a => a.id === id) || { name: id }).name || id);
  const alerts = ag.alerts.length ? '<div class="alerts"><h4>Figyelem — korlátozott zóna</h4>' + ag.alerts.map(x =>
    `<div class="alert">${who(x.id)} ${['olvasott', 'keresett', 'szerkesztett'][x.kind] || 'nyúlt'} itt: <b>${esc(x.zone)}</b> <span class="dim">${new Date(x.at).toLocaleTimeString('hu-HU')} · csak jelzés, nem tiltás</span></div>`).join('') + '</div>' : '';
  const anyZone = [...ag.seenZones.values()].some(z => z.size);
  ag.el.innerHTML = '<span class="x" title="Bezárás">×</span><h3>Városháza — diszpécser' +
    (anyZone ? ` <button class="btn" data-reveal title="A repón kívüli helyek nevei elmosva — kattintásra látszanak (csak a memóriában vannak)">${ag.reveal ? 'Elrejtés' : 'Külső helyek mutatása'}</button>` : '') +
    '</h3>' + fenAlertsHtml() + alerts + '<div class="bays">' +
    AG_BAYS.map(([id, label]) => { const xs = ag.list.filter(a => agBay(a.state) === id);
      return `<section class="bay ${id}"><h4>${label} <span class="dim">${xs.length || ''}</span></h4>${xs.map(strip).join('')}</section>`; }).join('') + '</div>';
  ag.el.hidden = false;
}
function agToggle(force) {
  ag.open = force === undefined ? !ag.open : force;
  if (ag.el) ag.el.hidden = !ag.open;
  agBoard();
}
$('hall-btn').onclick = () => agToggle();
