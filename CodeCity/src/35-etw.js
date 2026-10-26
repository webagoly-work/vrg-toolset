// 35-etw.js — the exact cargo per process (P11, KV-23; report §1.4 Tier B, CITY-D17 A). When the user's scheduled task
// runs vrg-etw.exe, the segéd reads its pipe and sends 'etwcargo' once a second: each busy process with its exact bytes
// in and out, by dock and country (no address ever reaches the page). A manifest board stands at Határ: a bar per
// process as tall as its traffic (log scale), cyan in, amber out, gold-rimmed when a Claude session started it. Files
// that such a process reads or writes in the repo arrive as ordinary beams (23-agents) — that is the "Bash read".

const et = { state: 'off', demo: false, cargo: null, group: null, peak: new Map() };
const etRate = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB/s' : b >= 1024 ? Math.round(b / 1024) + ' kB/s' : b + ' B/s';

function etGroup() {
  if (!et.group || et.group.parent !== world.group) { et.group = new THREE.Group(); world.group.add(et.group); }
  return et.group;
}
function etDraw() {
  if (!world || !LAND) return;
  const g = etGroup();
  g.children.slice().forEach(o => { g.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); }); });
  const bd = pwPlace('hatar'), list = (et.cargo && et.cargo.list || []).slice(0, 6);
  if (!bd || et.state !== 'on' || !list.length) { requestRender(); return; }
  const k = agScale(), R = landR(), base = bd.clone().add(new THREE.Vector3(-R * 0.3, 0, -R * 0.42));
  list.forEach((p, i) => {
    const x = i * 9 * k, h = b => Math.max(0.5 * k, Math.log10(1 + b) * 5 * k);
    const at = base.clone().add(new THREE.Vector3(x, 0, 0));
    const rx = new THREE.Mesh(new THREE.BoxGeometry(3 * k, 1, 3 * k).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x6fd3ff, fog: false }));
    rx.position.copy(at); rx.scale.y = h(p.rx);
    const tx = new THREE.Mesh(new THREE.BoxGeometry(3 * k, 1, 3 * k).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffb300, fog: false }));
    tx.position.copy(at).add(new THREE.Vector3(3.4 * k, 0, 0)); tx.scale.y = h(p.tx);
    g.add(rx, tx);
    if (p.claude) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(8 * k, 0.6 * k, 5 * k), new THREE.MeshBasicMaterial({ color: 0xffcf5a, fog: false }));
      rim.position.copy(at).add(new THREE.Vector3(1.7 * k, 0.3 * k, 0)); g.add(rim);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(p.exe.replace(/\.exe$/i, '').slice(0, 16), p.claude ? '#ffe9a0' : '#c9d3ee'), fog: false, depthWrite: false }));
    sp.position.copy(at).add(new THREE.Vector3(1.7 * k, Math.max(h(p.rx), h(p.tx)) + 4 * k, 0)); sp.scale.set(16 * k, 3 * k, 1);
    g.add(sp);
  });
  g.traverse(o => { o.raycast = () => {}; });
  requestRender();
}
function etwEvent(d) { et.state = d.state; et.demo = !!d.demo; etDraw(); if (land.at === 'land') landPanel(); }
function etwCargoEvent(d) {
  et.cargo = d;
  for (const p of d.list) et.peak.set(p.exe, Math.max(et.peak.get(p.exe) || 0, p.rx + p.tx));
  etDraw();
  if (land.at === 'land') landPanel();
}
// the Land panel's lines (29-land asks for it)
function etPanelHtml() {
  if (et.state !== 'on') return '<h4>Pontos rakomány (ETW)</h4><div class="dim">Nem fut — a rendszergazdai ütemezett feladat indítja (docs/city/wp/p11-etw.md). Nélküle a becslések maradnak.</div>';
  const list = (et.cargo && Date.now() - et.cargo.at < 5000 && et.cargo.list) || [];
  return `<h4>Pontos rakomány (ETW${et.demo ? ', próba' : ''})</h4>` + (list.length ? list.slice(0, 8).map(p =>
    `<div><b>${esc(p.exe)}</b>${p.claude ? ' <span class="warn">Claude indította</span>' : ''} <span class="dim">↓${etRate(p.rx)} ↑${etRate(p.tx)}` +
    `${Object.keys(p.docks).length ? ' · ' + Object.entries(p.docks).map(([d, b]) => esc(d) + ' ' + etRate(b)).join(', ') : ''}` +
    `${Object.keys(p.cc).length ? ' · ' + Object.keys(p.cc).map(esc).join(' ') : ''}</span></div>`).join('') : '<div class="dim">Most nincs forgalom.</div>');
}
