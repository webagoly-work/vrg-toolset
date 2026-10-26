// 31-flows.js — ships, planes and trains (P8, KV-19; report §1.7, §5.2). Cargo coming in (the segéd's 'cargo': a
// growing download or git pack) sails in from the open sea as a ship when it is big (over 50 MB) or flies in as a
// plane when it is small; it creeps towards the harbour while it grows, docks at Határ when it is complete, and its
// load hops on to Erőmű (a download) or Kódváros (a git pack). There a customs house stands for a while: red for a
// program from the internet, amber for anything else from the internet, green otherwise. While the border is closed,
// ships wait offshore. USB-falu rises when a removable drive is in (the power sample's 'usb'); a train runs from Erőmű
// while the drive is being written, one wagon per second of writing; the platform empties ~3 s after the writes stop,
// and only then does the Land panel say the stick can be pulled.

const fl = { ships: new Map(), group: null, raf: 0, trains: new Map() };
const FL_BIG = 50 * 1048576, FL_ARRIVE_MS = 1600;
const flMB = b => (b / 1048576 >= 10 ? Math.round(b / 1048576) : (b / 1048576).toFixed(1)) + ' MB';

function flRoute(kind) {   // sea -> harbour -> destination, in Land coordinates
  const er = pwPlace('eromu'), bd = pwPlace('hatar'), dest = kind === 'git' ? new THREE.Vector3(0, 0, 0) : er;
  if (!er || !bd) return null;
  const out = bd.clone().sub(er).setY(0).normalize(), R = landR();
  return { sea: bd.clone().add(out.clone().multiplyScalar(R * 3.2)), harbour: bd.clone().add(out.clone().multiplyScalar(R * 0.9)), dest };
}
function cargoEvent(c) {
  if (!world || !LAND) return;
  let sh = fl.ships.get(c.id);
  if (!sh) {
    const route = flRoute(c.kind), k = agScale();
    if (!route) return;
    const big = c.size > FL_BIG || (c.done && c.size > FL_BIG);
    const body = big ? new THREE.Mesh(new THREE.BoxGeometry(10 * k, 3 * k, 4 * k).translate(0, 1.5 * k, 0), new THREE.MeshBasicMaterial({ color: 0xc9d3ee, fog: false }))
      : new THREE.Mesh(new THREE.ConeGeometry(2 * k, 7 * k, 8).rotateZ(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    const band = new THREE.Mesh(new THREE.BoxGeometry(10 * k, 0.6 * k, 0.4 * k), new THREE.MeshBasicMaterial({ color: 0x6fd3ff, fog: false }));
    band.position.set(0, (big ? 3.4 : 2) * k, 2.2 * k);
    const lb = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(flMB(c.size) + ' ' + (c.ext || ''), '#c9d3ee'), fog: false, depthWrite: false }));
    lb.position.set(0, 7 * k, 0); lb.scale.set(18 * k, 3.4 * k, 1);
    const g = new THREE.Group(); g.add(body, band, lb);
    g.position.copy(route.sea).setY(big ? 0 : 30 * k);
    sh = { c, g, body, band, lb, route, big, p: 0, t0: performance.now(), arrived: 0 };
    fl.ships.set(c.id, sh);
    flGroup().add(g);
  }
  sh.c = c;
  sh.lb.material.map = landLabel(flMB(c.size) + ' ' + (c.ext || ''), '#c9d3ee');
  if (c.done && !sh.arrived) { sh.arrived = performance.now(); flCustoms(sh); }
  flAnimate();
}
function flGroup() {
  if (!fl.group || fl.group.parent !== world.group) { fl.group = new THREE.Group(); world.group.add(fl.group); }
  return fl.group;
}
function flCustoms(sh) {
  const cu = sh.c.customs || {}, k = agScale();
  const col = cu.internet && cu.exec ? 0xff3b3b : cu.internet ? 0xffb300 : 0x6fe39a;
  const house = new THREE.Mesh(new THREE.BoxGeometry(8 * k, 6 * k, 8 * k).translate(0, 3 * k, 0), new THREE.MeshBasicMaterial({ color: col, fog: false }));
  house.position.copy(sh.route.dest).add(new THREE.Vector3(landR() * 0.45, 0, -landR() * 0.3));
  const lb = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(cu.exec ? (cu.internet ? 'VÁM: program a netről' : 'VÁM: program') : cu.internet ? 'VÁM: a netről' : 'VÁM: rendben', cu.internet && cu.exec ? '#ff6b6b' : '#c9d3ee'), fog: false, depthWrite: false }));
  lb.position.copy(house.position).setY(12 * k); lb.scale.set(26 * k, 4.6 * k, 1);
  flGroup().add(house, lb);
  sh.customs = [house, lb];
  fl.log = [{ at: Date.now(), size: sh.c.size, ext: sh.c.ext, kind: sh.c.kind, from: sh.c.from, customs: cu }, ...(fl.log || [])].slice(0, 6);
  if (land.at === 'land') landPanel();
}
function flAnimate() { if (!fl.raf) fl.raf = requestAnimationFrame(flFrame); }
function flFrame() {
  fl.raf = 0;
  const now = performance.now(), open = !pw.net || pw.net.internet.up, k = agScale();
  let busy = false;
  for (const [id, sh] of fl.ships) {
    const { sea, harbour, dest } = sh.route;
    if (!sh.arrived) {
      // growing: creep towards the harbour (never quite there); offshore while the border is closed
      if (open) sh.p = Math.min(0.9, sh.p + 0.004);
      sh.g.position.lerpVectors(sea, harbour, sh.p).setY(sh.big ? 0 : 30 * k);
      sh.band.scale.x = Math.max(0.05, sh.p / 0.9);
      busy = true;
    } else {
      const t = (now - sh.arrived) / FL_ARRIVE_MS;
      if (t < 1) { sh.g.position.lerpVectors(sh.g.position.clone(), harbour, Math.min(1, t * 1.5)).setY(sh.big ? 0 : 30 * k * (1 - t)); busy = true; }
      else if (t < 2) { sh.g.position.lerpVectors(harbour, dest, t - 1); busy = true; }   // the load goes on to its place
      else if (t < 14) { sh.g.visible = false; busy = true; }
      else { for (const o of [sh.g, ...(sh.customs || [])]) flGroup().remove(o); fl.ships.delete(id); }
    }
  }
  // trains to USB-falu
  const usb = (pw.power && pw.power.usb) || [], uf = pwPlace('usbfalu'), er = pwPlace('eromu');
  if (uf && er) for (const d of usb) {
    let tr = fl.trains.get(d.drive);
    if (!tr) { tr = { wagons: [], writing: 0, quiet: now }; fl.trains.set(d.drive, tr); }
    if (d.writeBps > 0) { tr.quiet = now; if (tr.wagons.length < 8 && (!tr.lastAdd || now - tr.lastAdd > 1000)) { tr.lastAdd = now; const w = new THREE.Mesh(new THREE.BoxGeometry(4 * k, 2.4 * k, 2.4 * k).translate(0, 1.6 * k, 0), new THREE.MeshBasicMaterial({ color: 0xffcf5a, fog: false })); w.t = 0; tr.wagons.push(w); flGroup().add(w); } }
    for (const w of tr.wagons) { w.t = Math.min(1, w.t + 0.01); w.position.lerpVectors(er, uf, w.t); }
    if (d.writeBps === 0 && now - tr.quiet > 3000) { for (const w of tr.wagons) flGroup().remove(w); tr.wagons = []; }
    if (tr.wagons.length) busy = true;
  }
  requestRender();
  if (busy || fl.ships.size) fl.raf = requestAnimationFrame(flFrame);
}
// USB-falu: the village on its hex when a removable drive is in, rails to Erőmű
function flUsbDraw() {
  if (!pw.group) return;
  const usb = (pw.power && pw.power.usb) || [], uf = pwPlace('usbfalu'), er = pwPlace('eromu'), k = agScale();
  if (!usb.length || !uf || !er) return;
  pw.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([er.clone().setY(0.4 * k), uf.clone().setY(0.4 * k)]), new THREE.LineBasicMaterial({ color: 0x9ab0c0, fog: false })));
  usb.forEach((d, i) => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(10 * k, 7 * k, 10 * k).translate(0, 3.5 * k, 0), new THREE.MeshBasicMaterial({ color: 0x3a7a4a, fog: false }));
    h.position.set(uf.x - 12 * k + i * 14 * k, 0, uf.z);
    const lb = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(d.drive, '#9fe3b0'), fog: false, depthWrite: false }));
    lb.position.copy(h.position).setY(11 * k); lb.scale.set(8 * k, 2 * k, 1);
    pw.group.add(h, lb);
  });
}
// the Land panel's lines: the last arrivals, and whether each stick may be pulled
function flPanelHtml() {
  const usb = (pw.power && pw.power.usb) || [];
  const sticks = usb.map(d => { const tr = fl.trains.get(d.drive), n = tr ? tr.wagons.length : 0;
    return `<div><b>USB-falu ${esc(d.drive)}</b> <span class="dim">${Math.round(d.freeMB / 1024)} / ${Math.round(d.sizeMB / 1024)} GB szabad · ` +
      (n ? `<span class="warn">Még úton van ${n} kocsi — ne húzd ki</span>` : 'kihúzható: Windows tálca → „Hardver biztonságos eltávolítása”') + '</span></div>'; }).join('');
  const arr = (fl.log || []).map(a => `<div class="dim">${new Date(a.at).toLocaleTimeString('hu-HU')} · ${a.kind === 'git' ? 'git csomag' : 'letöltés'} ${flMB(a.size)} ${esc(a.ext || '')}` +
    `${a.from ? ` · <span class="blur">${esc(a.from)}</span>` : ''} · vám: ${a.customs.exec ? 'program' : 'fájl'}${a.customs.internet ? ', a netről' : ''}</div>`).join('');
  return (sticks || arr) ? '<h4>Áru és vonatok</h4>' + sticks + arr : '';
}
