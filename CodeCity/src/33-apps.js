// 33-apps.js — the open programs as temporary constructs around Erőmű (P10, KV-21; report §1.4, §5.2). The segéd's
// 'apps' (vrg-probe.exe: one entry per program — product name, window count, foreground; never a window title) raises
// a glowing frame on a ring around Erőmű when a program opens its first window, and dissolves it — up and out, fading
// — when its last window closes. The program in front is cyan, the rest violet; each keeps its ring slot while it lives.

const ap = { state: 'off', list: [], items: new Map(), slots: [], group: null, raf: 0 };
const AP_RISE_MS = 700, AP_FADE_MS = 1200, AP_FRONT = 0x6fd3ff, AP_BACK = 0x9a7ae0;

function apGroup() {
  if (!ap.group || ap.group.parent !== world.group) { ap.group = new THREE.Group(); world.group.add(ap.group); ap.items.clear(); ap.slots = []; }
  return ap.group;
}
function apSlotPos(i) {   // two rings of 14 around Erőmű, outside its towers
  const er = pwPlace('eromu'), R = landR(), ring = Math.floor(i / 14), a = (i % 14) / 14 * Math.PI * 2 + ring * 0.22;
  return er ? er.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(R * (0.62 + ring * 0.2))) : null;
}
function apMake(a, slot) {
  const k = agScale(), h = 22 * k, w = 9 * k, g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w).translate(0, h / 2, 0),
    new THREE.MeshBasicMaterial({ color: AP_BACK, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: AP_BACK, transparent: true, fog: false }));
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(a.name, '#d6c8ff'), transparent: true, fog: false, depthWrite: false }));
  label.position.set(0, h + 4 * k, 0); label.scale.set(22 * k, 4 * k, 1);
  g.add(body, edges, label);
  g.position.copy(apSlotPos(slot));
  g.traverse(o => { o.raycast = () => {}; });
  apGroup().add(g);
  return { g, body, edges, label, slot, born: performance.now(), gone: 0, key: a.key };
}
function apPaint(it, a) {
  const col = a.fg ? AP_FRONT : AP_BACK;
  it.body.material.color.setHex(col); it.edges.material.color.setHex(col);
  const name = a.name.length > 15 ? a.name.slice(0, 14) + "…" : a.name, text = a.n > 1 ? `${name} ×${a.n}` : name;
  if (it.text !== text) { it.text = text; it.label.material.map = landLabel(text, a.fg ? '#bfefff' : '#d6c8ff'); it.label.material.needsUpdate = true; }
}
function appsEvent(d) {
  ap.state = d.state; ap.list = d.list || [];
  if (!world || !LAND || !pwPlace('eromu')) return;
  apGroup();
  const now = performance.now(), seen = new Set();
  for (const a of ap.list) {
    seen.add(a.key);
    let it = ap.items.get(a.key);
    if (it && it.gone) { it.gone = 0; it.born = now - AP_RISE_MS; }   // came back while dissolving
    if (!it) {
      let slot = ap.slots.indexOf(null); if (slot < 0) slot = ap.slots.length;
      ap.slots[slot] = a.key;
      it = apMake(a, slot); ap.items.set(a.key, it);
    }
    apPaint(it, a);
  }
  for (const it of ap.items.values()) if (!seen.has(it.key) && !it.gone) it.gone = now;
  apAnimate();
  if (land.at === 'land') landPanel();
}
function apAnimate() { if (!ap.raf) ap.raf = requestAnimationFrame(apFrame); }
function apFrame() {
  ap.raf = 0;
  const now = performance.now(), k = agScale(), instant = window.KV_INSTANT;
  let busy = false;
  for (const [key, it] of ap.items) {
    if (it.gone) {
      const t = instant ? 1 : Math.min(1, (now - it.gone) / AP_FADE_MS);
      it.g.scale.set(1 + t * 0.6, Math.max(0.01, 1 - t), 1 + t * 0.6); it.g.position.y = t * 30 * k;
      it.body.material.opacity = 0.22 * (1 - t); it.edges.material.opacity = 1 - t; it.label.material.opacity = 1 - t;
      if (t >= 1) { apGroup().remove(it.g); it.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); ap.items.delete(key); ap.slots[it.slot] = null; }
      else busy = true;
    } else {
      const t = instant ? 1 : Math.min(1, (now - it.born) / AP_RISE_MS), e = 1 - (1 - t) ** 3;
      it.g.scale.set(1, Math.max(0.01, e), 1); it.label.material.opacity = e;
      if (t < 1) busy = true;
    }
  }
  document.body.dataset.apps = [...ap.items.values()].map(it => it.key + (it.gone ? ':dissolving' : ':up')).join(' ');
  requestRender();
  if (busy) apAnimate();
}
// the Land panel's line (29-land asks for it)
function apPanelHtml() {
  if (ap.state === 'missing') return '<h4>Futó programok</h4><div class="dim">A szonda nincs lefordítva: <code>node CodeCity/tools/build-probe.js</code></div>';
  if (!ap.list.length) return '';
  const front = ap.list.find(a => a.fg);
  return '<h4>Futó programok</h4>' + (front ? `<div><b>Előtérben</b> <span class="dim">${esc(front.name)}</span></div>` : '') +
    `<div class="dim">${ap.list.map(a => esc(a.name) + (a.n > 1 ? ' ×' + a.n : '')).join(' · ')}</div>`;
}
