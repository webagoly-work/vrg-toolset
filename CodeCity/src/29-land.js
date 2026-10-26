// 29-land.js — the Land (P8, KV-17; report §1.6, §5.3). Everything ours on hex slots that never move (land.json,
// inlined by build.js as LAND): Kódváros in the middle, Tárház (the H: drive), Erőmű, Pályaudvar, Határ, USB-falu
// around it. The Land shares the city's units — it spans a few thousand of them, far below where float32 starts to
// jitter — so the camera simply flies out and in (the nested frames of M3 wait for the planet, P9).
// Where am I: a breadcrumb (GitWorld › Föld › Kódváros › district › file, each part clickable) and an inset map of
// the level above. Home flies to the Land's table view; Shift+Home is the replay's first commit now.
// Tárház: the segéd's H: walk (sizes only, memory only — CITY-D27 A): one block per top-level folder, height by size,
// restricted folders walled red, the folder that holds this repo tinted. Folder names appear only in the Land panel,
// blurred until clicked.

const land = { group: null, disk: null, el: null, crumb: null, inset: null, reveal: false, at: 'city' };
const LAND_COL = { city: 0x2a3552, disk: 0x3a4a78, pc: 0x5a3a78, router: 0x2f5a6a, border: 0x6a4a2f, usb: 0x3a5a3a };
const landR = () => current.side * 0.8;
function landPos(slot) {
  const R = landR() * 1.12, [q, r] = slot;
  return new THREE.Vector3(R * Math.sqrt(3) * (q + r / 2), 0, R * 1.5 * r);
}
function landLabel(text, color) {
  const key = 'L|' + text + '|' + color;
  if (jb.labels.has(key)) return jb.labels.get(key);
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 54px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c); jb.labels.set(key, t); return t;
}
const landHexPts = (c, R, y) => Array.from({ length: 7 }, (_, n) => { const a = Math.PI / 6 + n * Math.PI / 3; return new THREE.Vector3(c.x + R * Math.cos(a), y, c.z + R * Math.sin(a)); });

function landDraw() {
  if (!world || !LAND) return;
  if (land.group) { world.group.remove(land.group); land.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  land.group = new THREE.Group();
  const R = landR(), k = agScale();
  for (const pl of LAND.places) {
    const c = landPos(pl.slot), col = LAND_COL[pl.kind] || 0x2a3552;
    land.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(landHexPts(c, R, 0.05)), new THREE.LineBasicMaterial({ color: pl.kind === 'city' ? 0x6fd3ff : col, fog: false })));
    if (pl.kind !== 'city') {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R * 0.97, 0.6 * k, 6).rotateY(Math.PI / 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, fog: false }));
      plate.position.set(c.x, -0.3 * k, c.z);
      land.group.add(plate);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(pl.name, pl.kind === 'city' ? '#6fd3ff' : '#c9d3ee'), fog: false, depthWrite: false }));
    sp.position.set(c.x, (pl.kind === 'city' ? 70 : 22) * k, c.z - R * (pl.kind === 'city' ? 0.75 : 0.45)); sp.scale.set(40 * k, 7.5 * k, 1);
    land.group.add(sp);
    if (pl.kind === 'disk') landTarhaz(c, R, k);
  }
  land.group.traverse(o => { o.raycast = () => {}; });
  world.group.add(land.group);
  requestRender();
}
// Tárház: a block per top-level folder of the drive, on a small grid inside its hex
function landTarhaz(c, R, k) {
  const dirs = (land.disk && land.disk.dirs) || [];
  if (!dirs.length) return;
  const n = Math.ceil(Math.sqrt(dirs.length)), cell = (R * 1.1) / n, max = Math.max(...dirs.map(d => d.size || 0), 1);
  dirs.forEach((d, i) => {
    const x = c.x - R * 0.55 + cell * (i % n) + cell / 2, z = c.z - R * 0.45 + cell * Math.floor(i / n) + cell / 2, w = cell * 0.75;
    if (d.restricted) {   // walled: an outline, no size read
      land.group.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 3 * k, w).translate(x, 1.5 * k, z)), new THREE.LineBasicMaterial({ color: 0xff3b3b, fog: false })));
      return;
    }
    const h = Math.max(0.6 * k, 30 * k * Math.log10(1 + (d.size || 0) / 1e6) / Math.log10(1 + max / 1e6));
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w).translate(x, h / 2, z), new THREE.MeshLambertMaterial({ color: d.repo ? 0x3a8fb0 : 0x8a7350 }));
    land.group.add(box);
  });
}

// ---- where am I: the level, the breadcrumb, the inset map
const landLevel = () => (wd.R && orbit.r > wdExt() * 4 ? 'world' : orbit.r > current.side * 1.9 ? 'land' : 'city');
function landPlaceAt(x, z) {
  let best = null, d0 = Infinity;
  for (const pl of LAND.places) { const c = landPos(pl.slot), d = Math.hypot(c.x - x, c.z - z); if (d < d0) { d0 = d; best = pl; } }
  return d0 < landR() ? best : null;
}
function landUpdate() {
  if (!current || !LAND) return;
  land.at = landLevel();
  if (wd.ring) wd.ring.visible = land.at === 'world';   // 32-world
  const t = orbit.target, parts = [['GitWorld', 'world'], ['Föld', 'land']];
  if (land.at === 'world') parts.splice(1);
  else if (land.at === 'land') { const pl = landPlaceAt(t.x, t.z); if (pl) parts.push([pl.name, 'place:' + pl.id]); }
  else {
    parts.push(['Kódváros', 'city']);
    const d = districtAt(t.x, t.z);
    if (d && d.path) { let acc = ''; for (const seg of d.path.split('/')) { acc = acc ? acc + '/' + seg : seg; parts.push([seg, 'dir:' + acc]); } }
    if (shownFile) parts.push([shownFile.name, 'file']);
  }
  if (!land.crumb) {
    land.crumb = document.createElement('nav'); land.crumb.id = 'crumb'; land.crumb.setAttribute('aria-label', 'Hol vagyok');
    land.crumb.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) landGo(a.dataset.go); });
    document.body.append(land.crumb);
  }
  land.crumb.innerHTML = parts.map(([n, go], i) => `<span data-go="${esc(go)}"${i === parts.length - 1 ? ' class="here"' : ''}>${esc(n)}</span>`).join('<i>›</i>');
  landInset();
  landPanel();
}
function landGo(go) {
  if (go === 'world') return worldGo();   // 32-world
  if (go === 'land') return landHome();
  if (go === 'city') return flyCamera([0, 0, orbit.theta, 0.95, current.side * 1.25], 500);
  if (go.startsWith('place:')) { const pl = LAND.places.find(p => p.id === go.slice(6)); if (pl) { const c = landPos(pl.slot); flyCamera([c.x, c.z, orbit.theta, 0.9, landR() * 2.4], 500); } return; }
  if (go.startsWith('dir:')) { const d = agDir(go.slice(4)); if (d && d.rect) flyCamera([d.rect.x + d.rect.w / 2, d.rect.z + d.rect.h / 2, orbit.theta, orbit.phi, Math.max(40, Math.max(d.rect.w, d.rect.h) * 1.6)], 450); }
}
// Home: the Land's table view, one key from anywhere
function landHome(ms = 600) {
  if (!LAND) return;
  const ps = LAND.places.map(p => landPos(p.slot)), ext = Math.max(...ps.map(p => Math.hypot(p.x, p.z))) + landR();
  flyCamera([0, 0, orbit.theta, 0.82, ext * 1.9], window.KV_INSTANT ? 0 : ms);   // KV_INSTANT: headless checks (rAF barely ticks there)
}
function landInset() {
  if (!land.inset) {
    land.inset = document.createElement('canvas'); land.inset.id = 'inset'; land.inset.width = 160; land.inset.height = 160;
    land.inset.title = 'A fölötte lévő szint — kattints: a Föld'; land.inset.onclick = () => landHome();
    document.body.append(land.inset);
  }
  const g = land.inset.getContext('2d'), W = 160;
  g.clearRect(0, 0, W, W); g.fillStyle = '#05070de6'; g.fillRect(0, 0, W, W);
  if (land.at !== 'city') {   // the level above the Land: the planet (P9)
    g.strokeStyle = '#3a4a78'; g.beginPath(); g.arc(W / 2, W / 2, 56, 0, 7); g.stroke();
    g.fillStyle = '#6fd3ff'; g.beginPath(); g.arc(W / 2 + 18, W / 2 - 10, 5, 0, 7); g.fill();
    g.fillStyle = '#8b97b5'; g.font = '11px Consolas'; g.fillText('GitWorld (P9)', 36, 150);
    return;
  }
  const ps = LAND.places.map(p => [p, landPos(p.slot)]), ext = Math.max(...ps.map(([, c]) => Math.hypot(c.x, c.z))) + landR(), s = (W / 2 - 8) / ext;
  for (const [p, c] of ps) {
    g.strokeStyle = p.kind === 'city' ? '#6fd3ff' : '#3a4a78'; g.beginPath();
    landHexPts(c, landR(), 0).forEach((v, n) => { const X = W / 2 + v.x * s, Y = W / 2 + v.z * s; if (n) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.stroke();
  }
  g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(W / 2 + orbit.target.x * s, W / 2 + orbit.target.z * s, 3.5, 0, 7); g.fill();   // you are here
  g.fillStyle = '#8b97b5'; g.font = '11px Consolas'; g.fillText('Föld · itt vagy', 40, 150);
}
// at the Land level: the places and what they are; Tárház's folder names blurred until clicked (CITY-D27 A)
function landPanel() {
  if (!land.el) {
    land.el = document.createElement('aside'); land.el.id = 'landinfo';
    land.el.addEventListener('click', e => { if (e.target.closest('[data-reveal]')) { land.reveal = !land.reveal; landPanel(); } });
    document.body.append(land.el);
  }
  land.el.hidden = land.at === 'city';
  if (land.el.hidden) return;
  if (land.at === 'world') { land.el.innerHTML = worldPanelHtml(); return; }
  const dirs = (land.disk && land.disk.dirs) || [], gb = b => (b / 1e9).toFixed(b > 1e10 ? 0 : 1) + ' GB';
  land.el.innerHTML = '<h3>Föld — minden, ami a miénk</h3>' + LAND.places.map(p => `<div><b>${esc(p.name)}</b> <span class="dim">${esc(p.what)}</span></div>`).join('') +
    `<h4>Tárház ${land.disk ? (land.disk.walking ? '(felmérés folyik…)' : `· ${dirs.length} mappa`) : '(a segéddel jön)'}` +
    (dirs.length ? ` <button class="btn" data-reveal>${land.reveal ? 'Elrejtés' : 'Nevek mutatása'}</button>` : '') + '</h4>' +
    pwPanelHtml() + flPanelHtml() +   // 30-power: Erőmű, station, border, shore · 31-flows: cargo, trains
    dirs.slice(0, 12).map(d => `<div class="dir"><span class="${land.reveal ? '' : 'blur'}">${esc(d.name)}</span> <span class="dim">${d.restricted ? 'fallal körülvéve: ' + esc(d.restricted) : gb(d.size || 0)}${d.repo ? ' · itt lakik a Kódváros' : ''}${d.partial || (d.children || []).some(c => c.partial) ? ' · részleges (kifutott az időből)' : ''}</span></div>`).join('');
}
async function landLoad() {
  await kvReady();
  if (!kv.match) return;
  try { const r = await fetch('/api/disk'); if (r.ok) { land.disk = await r.json(); landDraw(); landPanel(); } } catch (e) { /* the segéd is gone */ }
}
function diskEvent(d) { land.disk = d; landDraw(); landPanel(); }
// fog follows the zoom: from the Land the city must not drown in the horizon colour
function landFog() {
  if (!scene.fog || !current) return;
  scene.fog.near = Math.max(current.side * 1.1, orbit.r * 0.9);
  scene.fog.far = Math.max(current.side * 3.2, orbit.r * 3);
}
addEventListener('keydown', e => {
  if (!current || e.key !== 'Home' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea')) return;
  e.preventDefault(); landHome();
});
