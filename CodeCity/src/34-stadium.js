// 34-stadium.js — the Stadion, sound towers, Bluetooth buoys and the USB port board (P10, KV-22; report §1.4, §4;
// CITY-D25 A). From vrg-probe through the segéd:
// - 'media' (Windows' own now-playing, GSMTC — no Spotify API): the stadium on the Land lights its floodlights while
//   something plays (Spotify first, else what Windows calls current); the scoreboard shows the title and the artist.
// - 'audio' + 'peaks' (Core Audio): a sound tower per program on the field — the solid core is its volume, the cap
//   flares with its peak meter; the field glows with the playing program's peak. Drag a tower up or down (or use the
//   slider in the Land panel) to set that program's volume; the segéd passes it to the probe (probe-volume).
// - 'bt': paired Bluetooth devices as buoys around USB-falu — lit with a battery ring while connected.
// - 'usb': the port board at USB-falu — a row per port of the root hub, a hub's own ports indented after it.

const st = { media: null, audio: [], peaks: { m: 0, s: {} }, bt: [], usb: null, group: null, towers: [], drag: null, sendAt: 0, sliding: false };
const ST_H = 40, ST_GOLD = 0xffcf5a, ST_VIOLET = 0x9a7ae0, ST_GREY = 0x55606e;

function stGroup() {
  if (!st.group || st.group.parent !== world.group) { st.group = new THREE.Group(); world.group.add(st.group); }
  return st.group;
}
// what the stadium shows: Spotify if Windows knows it, else the current session, else anything playing
function stNow() {
  const l = (st.media && st.media.list) || [];
  return l.find(m => m.key === 'spotify.exe') || l.find(m => m.current) || l.find(m => m.status === 'playing') || null;
}
const stPlaying = () => { const n = stNow(); return !!n && n.status === 'playing'; };
const stLabel = (text, color, at, w, h) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(text.length > 26 ? text.slice(0, 25) + '…' : text, color), fog: false, depthWrite: false }));
  sp.position.copy(at); sp.scale.set(w, h, 1); return sp;
};

function stDraw() {
  if (!world || !LAND) return;
  const g = stGroup();
  g.children.slice().forEach(o => { g.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); }); });
  st.towers = [];
  const k = agScale(), R = landR(), sd = pwPlace('stadion'), uf = pwPlace('usbfalu');
  const now = stNow(), on = stPlaying();
  if (sd) {
    // stands, field, four masts with their light cones
    const stands = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.5, R * 0.56, 10 * k, 40, 1, true).translate(0, 5 * k, 0),
      new THREE.MeshBasicMaterial({ color: on ? 0x6a5a8a : 0x3a3550, side: THREE.DoubleSide, fog: false }));
    stands.position.copy(sd);
    st.field = new THREE.Mesh(new THREE.CircleGeometry(R * 0.46, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1f4a2f, fog: false }));
    st.field.position.copy(sd).setY(0.4 * k);
    g.add(stands, st.field);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, at = sd.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(R * 0.53));
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6 * k, 50 * k, 1.6 * k).translate(0, 25 * k, 0), new THREE.MeshBasicMaterial({ color: 0x8a8fa0, fog: false }));
      mast.position.copy(at);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(6 * k, 3 * k, 2 * k), new THREE.MeshBasicMaterial({ color: on ? 0xfff6c0 : 0x3a3a40, fog: false }));
      lamp.position.copy(at).setY(51 * k);
      g.add(mast, lamp);
      if (on) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(R * 0.22, 50 * k, 24, 1, true).translate(0, -25 * k, 0),
          new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        cone.position.copy(at).setY(50 * k);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), sd.clone().sub(cone.position).normalize());   // apex at the lamp, opening onto the field
        g.add(cone);
      }
    }
    // the scoreboard
    const board = now ? (now.status === 'playing' ? '▶ ' : now.status === 'paused' ? '‖ ' : '■ ') + (now.title || now.app) : 'csend';
    g.add(stLabel(board, on ? '#ffe9a0' : '#9aa0b0', sd.clone().setY(70 * k), 44 * k, 7 * k));
    if (now && now.artist) g.add(stLabel(now.artist, on ? '#ffd27a' : '#8a90a0', sd.clone().setY(62 * k), 34 * k, 5.5 * k));
    // the sound towers, in a row across the field
    const list = st.audio, n = list.length, H = ST_H * k;
    list.forEach((a, i) => {
      const x = (i - (n - 1) / 2) * Math.min(14 * k, (R * 0.8) / Math.max(1, n)), at = sd.clone().add(new THREE.Vector3(x, 0, R * 0.05));
      const mine = now && a.key === now.key, col = a.mute ? ST_GREY : mine ? ST_GOLD : ST_VIOLET;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(3.4 * k, 3.4 * k, H, 16, 1, true).translate(0, H / 2, 0),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      shell.position.copy(at);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(2.6 * k, 2.6 * k, 1, 16).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: col, fog: false }));
      core.position.copy(at); core.scale.y = Math.max(0.3, a.vol * H);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.6 * k, 3.6 * k, 1.2 * k, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, fog: false }));
      cap.position.copy(at).setY(Math.max(0.3, a.vol * H) + 0.6 * k);
      const label = stLabel(`${a.name.length > 14 ? a.name.slice(0, 13) + '…' : a.name} ${Math.round(a.vol * 100)}%${a.mute ? ' némítva' : ''}`, a.mute ? '#8a90a0' : mine ? '#ffe9a0' : '#d6c8ff',
        at.clone().setY(H + 5 * k), 22 * k, 4 * k);
      [core, cap, label].forEach(o => { o.raycast = () => {}; });
      g.add(shell, core, cap, label);
      st.towers.push({ key: a.key, a, shell, core, cap, label, H });
    });
  }
  // Bluetooth buoys around USB-falu
  if (uf) st.bt.forEach((d, i) => {
    const a = (i / Math.max(1, st.bt.length)) * Math.PI * 2 - Math.PI / 2, at = uf.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(R * 0.62));
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(3 * k, 14, 10), new THREE.MeshBasicMaterial({ color: d.connected ? 0x4aa8ff : 0x3a4250, fog: false }));
    buoy.position.copy(at).setY(2.5 * k);
    g.add(buoy);
    if (d.battery != null) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4 * k, 0.6 * k, 6, 32, Math.PI * 2 * d.battery / 100).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: d.battery <= 20 ? 0xff6b6b : 0x6fe39a, fog: false }));
      ring.position.copy(at).setY(2.5 * k);
      g.add(ring);
    }
    g.add(stLabel(d.name + (d.battery != null ? ` ${d.battery}%` : ''), d.connected ? '#a8d4ff' : '#7a8290', at.clone().setY(10 * k), 20 * k, 3.6 * k));
  });
  // the USB port board at USB-falu: a row per port, a hub's ports after it
  if (uf && st.usb) {
    const rows = st.usb.list.slice().sort((p, q) => p.root - q.root || p.chain.join('.').localeCompare(q.chain.join('.'), undefined, { numeric: true }));
    const top = uf.clone().add(new THREE.Vector3(-R * 0.3, 0, -R * 0.36));
    const plate = new THREE.Mesh(new THREE.BoxGeometry(R * 0.6, 0.6 * k, rows.length * 6 * k + 6 * k).translate(R * 0.3, 0.3 * k, (rows.length * 6 * k) / 2),
      new THREE.MeshBasicMaterial({ color: 0x1c2a22, fog: false }));
    plate.position.copy(top).add(new THREE.Vector3(0, 0, -3 * k));
    g.add(plate);
    rows.forEach((d, i) => {
      const depth = d.chain.length - 1, at = top.clone().add(new THREE.Vector3(4 * k + depth * 6 * k, 0, i * 6 * k));
      const hub = /hub/i.test(d.name), slot = new THREE.Mesh(new THREE.BoxGeometry(4 * k, 1.6 * k, 3 * k).translate(0, 0.8 * k, 0),
        new THREE.MeshBasicMaterial({ color: hub ? 0x3aa8a0 : 0x6fe39a, fog: false }));
      slot.position.copy(at);
      g.add(slot, stLabel(`${d.chain[d.chain.length - 1]} · ${d.name}`, hub ? '#8fe0d8' : '#b8f0c8', at.clone().add(new THREE.Vector3(14 * k, 3 * k, 0)), 22 * k, 3.4 * k));
    });
  }
  g.traverse(o => { if (!st.towers.some(t => t.shell === o)) o.raycast = () => {}; });
  stPeaks();
  document.body.dataset.stadium = (on ? 'playing' : 'dark') + ':' + (now ? now.key : '-') + ' towers=' + st.towers.map(t => t.key + '@' + Math.round(t.a.vol * 100)).join(',');
}
function stRedraw() { if ((st.media || st.audio.length || st.bt.length || st.usb) && (!st.group || st.group.parent !== world.group)) stDraw(); }
// the peak meters move without a rebuild: the caps flare, the field glows with the stadium's program
function stPeaks() {
  const now = stNow(), on = stPlaying(), k = agScale();
  for (const t of st.towers) {
    const p = st.peaks.s[t.key] || 0;
    t.cap.material.opacity = 0.2 + 0.8 * p; t.cap.scale.set(1 + p * 0.8, 1 + p * 6, 1 + p * 0.8);
    t.cap.position.y = t.core.scale.y + 0.6 * k + p * 3 * k;
  }
  if (st.field) {
    const p = on ? (now && st.peaks.s[now.key] != null ? st.peaks.s[now.key] : st.peaks.m) : 0;
    st.field.material.color.setHex(on ? 0x2f7a45 : 0x1f4a2f).lerp(new THREE.Color(0x9cff9c), Math.min(1, p * 0.9));
  }
  requestRender();
}

// ---- events from the segéd
function mediaEvent(d) { st.media = d; stDraw(); stPanelSoon(); }
function audioEvent(d) { st.audio = d.list || []; if (!st.drag) stDraw(); stPanelSoon(); }
function peaksEvent(d) { st.peaks = d; if (st.group) stPeaks(); }
function btEvent(d) { st.bt = d.list || []; stDraw(); stPanelSoon(); }
function usbEvent(d) { st.usb = d; stDraw(); stPanelSoon(); }
function stPanelSoon() { if (land.at === 'land' && !st.sliding) landPanel(); }

// ---- the volume: a tower dragged, or a slider in the panel
function stSend(key, v, final) {
  const t = st.towers.find(x => x.key === key);
  if (t) { t.a.vol = v; t.core.scale.y = Math.max(0.3, v * t.H); stPeaks(); }
  if (window.KV_DRYVOL) { document.body.dataset.vol = key + ':' + v.toFixed(2); return; }
  if (!final && performance.now() - st.sendAt < 90) return;   // ~11 a second while dragging, and always the last one
  st.sendAt = performance.now();
  kvCall('probe-volume', { key, v }).then(r => { if (r.status !== 200 && final) kvDone(r, ''); });
}
const stRay = new THREE.Raycaster(), stNdc = new THREE.Vector2();
addEventListener('pointerdown', e => {
  if (e.target !== canvas || !st.towers.length || e.button !== 0) return;
  const r = canvas.getBoundingClientRect();
  stNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  stRay.setFromCamera(stNdc, camera);
  const hit = stRay.intersectObjects(st.towers.map(t => t.shell), false)[0];
  if (!hit) return;
  const t = st.towers.find(x => x.shell === hit.object);
  st.drag = { key: t.key, y0: e.clientY, v0: t.a.vol, px: Math.max(120, r.height * 0.3) };
  e.stopPropagation(); e.preventDefault();   // the orbit does not turn while a tower is held
}, true);
addEventListener('pointermove', e => {
  if (!st.drag) return;
  const d = st.drag, v = Math.round(Math.min(1, Math.max(0, d.v0 + (d.y0 - e.clientY) / d.px)) * 100) / 100;
  stSend(d.key, v, false);
}, true);
addEventListener('pointerup', e => {
  if (!st.drag) return;
  const d = st.drag, v = Math.round(Math.min(1, Math.max(0, d.v0 + (d.y0 - e.clientY) / d.px)) * 100) / 100;
  st.drag = null;
  stSend(d.key, v, true); stDraw();
}, true);

// the Land panel's lines (29-land asks for it)
function stPanelHtml() {
  const now = stNow();
  let h = '';
  if (st.media || st.audio.length) {
    h += '<h4>Stadion</h4>' + (now ? `<div><b>${now.status === 'playing' ? 'Most szól' : now.status === 'paused' ? 'Szünet' : 'Áll'}</b> <span class="dim">${esc(now.title || '')}${now.artist ? ' — ' + esc(now.artist) : ''} · ${esc(now.app)}</span></div>` : '<div class="dim">Semmi nem szól.</div>');
    h += st.audio.map(a => `<div class="st-tower"><b>${esc(a.name)}</b> <input type="range" min="0" max="100" value="${Math.round(a.vol * 100)}" data-vol="${esc(a.key)}" aria-label="${esc(a.name)} hangereje"> ` +
      `<span class="dim">${Math.round(a.vol * 100)}%</span> <button class="btn" data-mute="${esc(a.key)}" data-on="${a.mute ? 0 : 1}">${a.mute ? 'Hang vissza' : 'Némítás'}</button></div>`).join('');
  }
  if (st.bt.length) h += '<h4>Bluetooth</h4>' + st.bt.map(d => `<div><b>${esc(d.name)}</b> <span class="dim">${d.connected ? 'kapcsolódva' + (d.battery != null ? ' · akku ' + d.battery + '%' : '') : 'párosítva' + (d.last ? ' · utoljára ' + new Date(d.last).toLocaleDateString('hu-HU') : '')}</span></div>`).join('');
  if (st.usb && st.usb.list.length) h += '<h4>USB-portok</h4>' + st.usb.list.slice().sort((p, q) => p.chain.join('.').localeCompare(q.chain.join('.'), undefined, { numeric: true }))
    .map(d => `<div style="padding-left:${(d.chain.length - 1) * 14}px"><span class="dim">port ${d.chain[d.chain.length - 1]}</span> <b>${esc(d.name)}</b> <span class="dim">${esc(d.cls)}</span></div>`).join('');
  return h;
}
addEventListener('pointerdown', e => { if (e.target.matches && e.target.matches('input[data-vol]')) st.sliding = true; }, true);
addEventListener('pointerup', () => { if (st.sliding) { st.sliding = false; setTimeout(stPanelSoon, 300); } }, true);
addEventListener('input', e => { const el = e.target; if (el.matches && el.matches('input[data-vol]')) stSend(el.dataset.vol, +el.value / 100, false); });
addEventListener('change', e => { const el = e.target; if (el.matches && el.matches('input[data-vol]')) stSend(el.dataset.vol, +el.value / 100, true); });
addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button[data-mute]');
  if (b) kvCall('probe-mute', { key: b.dataset.mute, on: b.dataset.on === '1' }).then(r => kvDone(r, b.dataset.on === '1' ? 'Némítva' : 'Hang vissza'));
});
