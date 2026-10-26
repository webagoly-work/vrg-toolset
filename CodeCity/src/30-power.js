// 30-power.js — Erőmű, Pályaudvar, Határ and the shoreline on the Land (P8, KV-18; report §1.4, §1.6).
// Erőmű (this PC): four towers — CPU, RAM, GPU, disk — as tall as their load ('power', every ~3 s; Tier 0,
// unelevated). The road Erőmű → Pályaudvar → Határ glows with the NIC traffic. Pályaudvar (the TP-Link): a station
// house, a wagon for each device on its yard (ARP). Határ (the Huawei ONT): a barrier — open and green while the
// internet answers, closed and red when it does not; then ships would wait in the harbour, and everything local keeps
// working. The shoreline beyond it: a pier per dock (ports.json) as long as its connection count, and a buoy per
// country (DB-IP Lite, "IP Geolocation by DB-IP", CC BY 4.0). Counts only — no address reaches the page (CITY-D27 A).

const pw = { power: null, net: null, group: null };
const PW_GREEN = 0x6fe39a, PW_RED = 0xff3b3b, PW_CYAN = 0x6fd3ff;
const pwPlace = id => { const pl = LAND && LAND.places.find(p => p.id === id); return pl ? landPos(pl.slot) : null; };

function pwDraw() {
  if (!world || !LAND) return;
  if (pw.group) { world.group.remove(pw.group); pw.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  pw.group = new THREE.Group();
  const k = agScale(), R = landR(), er = pwPlace('eromu'), st = pwPlace('palyaudvar'), bd = pwPlace('hatar');
  const p = pw.power, n = pw.net;
  // Erőmű: four towers
  if (er && p) {
    const ram = p.ramMB ? 100 * (1 - p.ramFreeMB / p.ramMB) : 0;
    [['CPU', p.cpu], ['RAM', ram], ['GPU', p.gpu], ['lemez', p.disk]].forEach(([name, v], i) => {
      const x = er.x - R * 0.36 + i * R * 0.24, z = er.z, h = Math.max(1, (v / 100) * 60 * k), hot = v > 85;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(3 * k, 4 * k, h, 12).translate(0, h / 2, 0),
        new THREE.MeshBasicMaterial({ color: hot ? 0xffb300 : 0x8a6cc0, fog: false }));
      tower.position.set(x, 0, z);
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(3.2 * k, 4.2 * k, 60 * k, 12, 1, true).translate(0, 30 * k, 0),
        new THREE.MeshBasicMaterial({ color: 0x5a3a78, transparent: true, opacity: 0.18, side: THREE.DoubleSide, fog: false }));
      shell.position.set(x, 0, z);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(`${name} ${Math.round(v)}%`, hot ? '#ffb300' : '#c9b6f0'), fog: false, depthWrite: false }));
      sp.position.set(x, 64 * k, z); sp.scale.set(16 * k, 3 * k, 1);
      pw.group.add(tower, shell, sp);
    });
  }
  // the road out: Erőmű → Pályaudvar → Határ, glowing with the traffic (log scale)
  if (er && st && bd) {
    const bytes = p ? (p.rx || 0) + (p.tx || 0) : 0, glow = Math.min(1, Math.log10(1 + bytes) / 7);
    const up = !n || n.internet.up;
    const road = new THREE.Line(new THREE.BufferGeometry().setFromPoints([er, st, bd].map(v => v.clone().setY(0.6 * k))),
      new THREE.LineBasicMaterial({ color: new THREE.Color(0x2f3a5a).lerp(new THREE.Color(PW_CYAN), glow), fog: false }));
    pw.group.add(road);
    // Pályaudvar: the station house + a wagon per device on its yard
    const house = new THREE.Mesh(new THREE.BoxGeometry(18 * k, 8 * k, 10 * k).translate(0, 4 * k, 0),
      new THREE.MeshBasicMaterial({ color: n && !n.station.up ? PW_RED : 0x2f6a7a, fog: false }));
    house.position.copy(st);
    pw.group.add(house);
    for (let i = 0; i < Math.min(12, n ? n.devices : 0); i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(5 * k, 3 * k, 3 * k).translate(0, 1.5 * k, 0), new THREE.MeshBasicMaterial({ color: 0x9ab0c0, fog: false }));
      w.position.set(st.x - R * 0.4 + i * 6 * k, 0, st.z + R * 0.3);
      pw.group.add(w);
    }
    // Határ: the barrier, open or closed
    const col = up ? PW_GREEN : PW_RED;
    const post = new THREE.Mesh(new THREE.BoxGeometry(2 * k, 10 * k, 2 * k).translate(0, 5 * k, 0), new THREE.MeshBasicMaterial({ color: 0x6a4a2f, fog: false }));
    post.position.set(bd.x - 10 * k, 0, bd.z);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(24 * k, 1.2 * k, 1.2 * k).translate(12 * k, 0, 0), new THREE.MeshBasicMaterial({ color: col, fog: false }));
    bar.position.set(bd.x - 10 * k, 9 * k, bd.z);
    bar.rotation.z = up ? Math.PI * 0.42 : 0;   // up = open
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(up ? 'nyitva' : 'ZÁRVA', up ? '#6fe39a' : '#ff6b6b'), fog: false, depthWrite: false }));
    sp.position.set(bd.x, 22 * k, bd.z); sp.scale.set(22 * k, 4 * k, 1);
    pw.group.add(post, bar, sp);
    // the shoreline beyond the border: piers per dock, buoys per country
    if (n) {
      const out = bd.clone().sub(er).setY(0).normalize(), side = new THREE.Vector3(-out.z, 0, out.x), shore = bd.clone().add(out.clone().multiplyScalar(R * 1.3));
      n.docks.forEach((d, i) => {
        const len = Math.max(4 * k, Math.min(60 * k, 6 * k * Math.sqrt(d.n))), at = shore.clone().add(side.clone().multiplyScalar((i - (n.docks.length - 1) / 2) * 12 * k));
        const pier = new THREE.Mesh(new THREE.BoxGeometry(4 * k, 1 * k, len).translate(0, 0.5 * k, len / 2), new THREE.MeshBasicMaterial({ color: up ? 0x8a7350 : 0x4a3f30, fog: false }));
        pier.position.copy(at); pier.lookAt(at.clone().add(out));
        const lb = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(`${d.name} ${d.n}`, '#c9d3ee'), fog: false, depthWrite: false }));
        lb.position.copy(at).add(new THREE.Vector3(0, 6 * k, 0)); lb.scale.set(20 * k, 3.6 * k, 1);
        pw.group.add(pier, lb);
      });
      n.countries.forEach((c, i) => {
        const at = shore.clone().add(out.clone().multiplyScalar(R * 0.55 + (i % 3) * 10 * k)).add(side.clone().multiplyScalar((Math.floor(i / 3) - 1.5) * 14 * k));
        const buoy = new THREE.Mesh(new THREE.SphereGeometry(Math.min(5, 1.2 + Math.sqrt(c.n)) * k, 12, 8), new THREE.MeshBasicMaterial({ color: up ? 0xffcf5a : 0x5a4a2a, fog: false }));
        buoy.position.copy(at).setY(1.5 * k);
        const lb = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(`${c.cc} ${c.n}`, '#ffcf5a'), fog: false, depthWrite: false }));
        lb.position.copy(at).setY(8 * k); lb.scale.set(12 * k, 2.4 * k, 1);
        pw.group.add(buoy, lb);
      });
    }
  }
  flUsbDraw();   // 31-flows: USB-falu
  if (ap.list.length) appsEvent({ state: ap.state, list: ap.list });   // 33-apps: rebuilt if the world was
  pw.group.traverse(o => { o.raycast = () => {}; });
  world.group.add(pw.group);
  requestRender();
}
// the Land panel's line for these places (29-land asks for it)
function pwPanelHtml() {
  const p = pw.power, n = pw.net;
  if (!p && !n) return '';
  const ram = p && p.ramMB ? Math.round(100 * (1 - p.ramFreeMB / p.ramMB)) : null, kb = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB/s' : Math.round(b / 1024) + ' kB/s';
  return '<h4>Most a Földön</h4>' +
    (p ? `<div><b>Erőmű</b> <span class="dim">CPU ${p.cpu}% · RAM ${ram}% · GPU ${p.gpu}% · lemez ${p.disk}% · hálózat ↓${kb(p.rx)} ↑${kb(p.tx)}</span></div>` : '') +
    (n ? `<div><b>Pályaudvar</b> <span class="dim">${n.station.up ? 'él' : 'NEM VÁLASZOL'} · ${n.devices} eszköz az udvaron</span></div>` +
      `<div><b>Határ</b> <span class="dim">${n.internet.up ? 'nyitva — van internet' : 'ZÁRVA — nincs internet; minden helyi tovább működik'}</span></div>` +
      (n.docks.length ? `<div><b>Part</b> <span class="dim">${n.docks.map(d => esc(d.name) + ' ' + d.n).join(' · ')}</span></div>` : '') +
      (n.countries.length ? `<div class="dim">Országok: ${n.countries.map(c => esc(c.cc) + ' ' + c.n).join(' · ')} — IP Geolocation by <a href="https://db-ip.com" target="_blank" rel="noopener">DB-IP</a> (CC BY 4.0)</div>` : '') : '');
}
function powerEvent(d) { pw.power = d; pwDraw(); if (d.usb && d.usb.length) flAnimate(); if (land.at === 'land') landPanel(); }
function netEvent(d) { pw.net = d; pwDraw(); if (land.at === 'land') landPanel(); }
