// 42-hm-city.js — the live side of Gépország: the market's lots, the programs' plots, the undercity's rooms and the traffic.
// Every moving thing is a sample of a measured rate, never one-to-one; the panel shows the true number. The market's mix is
// exact, its lot positions are symbolic (docs/city/homeland/03-truth.md §3.3). Picking and the pointer live here too.

const HM_LOTS = [17, 15], HM_DYN = 700, HM_ROOMS = 500, HM_CARS = 260, HM_LOT_U = [64, 22.4], HM_LOT_P = 1.14;
const HM_LOTCOL = { kernel: 0x6b7480, modified: 0xc98a55, standby: 0x3d4a54, free: 0x1f2c35, other: 0x8a6f58 };
const HM_WARM = [0xe8a873, 0xd8965f, 0xefbd8e, 0xc98a55, 0xf2cfa8, 0xb97c4a];
const HM_FLOWCOL = { mem: 0xefbd8e, gpu: 0xe8a873, main: 0xd8965f, C: 0xe8a873, H: 0xe8a873, G: 0xe8a873, F: 0xe8a873, net: 0xf2cfa8 };

function hmCityBuild() {
  // market lots
  const lotN = HM_LOTS[0] * HM_LOTS[1], m = new THREE.Matrix4(), c = new THREE.Color();
  hm.lotMat = new THREE.MeshLambertMaterial();
  hm.lots = new THREE.InstancedMesh(unitBox, hm.lotMat, lotN);
  hm.lotOwner = new Array(lotN).fill(null);
  for (let i = 0; i < lotN; i++) { hm.lots.setMatrixAt(i, hmLotM(i, 0.4)); hm.lots.setColorAt(i, c.setHex(HM_LOTCOL.free)); }
  hm.zLot = new THREE.Group(); hm.zLot.add(hm.lots); hm.surface.add(hm.zLot);
  // the empty DIMM slot, fenced, its lots bare (shown when the inventory says a slot is free)
  hm.emptyLot = new THREE.Group();
  const f = new THREE.Mesh(new THREE.PlaneGeometry(19.4 * HM_K, 8.4 * HM_K).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: HM_COL.lot }));
  f.position.set(hmW(73.7), 0.15, hmW(15)); f.userData.ent = hmEnts.get('empty');
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(19.4 * HM_K, 2.4, 8.4 * HM_K)), new THREE.LineBasicMaterial({ color: HM_COL.ice }));
  edge.position.set(hmW(73.7), 1.2, hmW(15)); edge.raycast = () => {};
  hm.emptyLot.add(f, edge); hm.zLot.add(hm.emptyLot);
  // program plots: boxes with the city's own lit-window shader
  const geo = unitBox.clone();
  hm.dynMat = buildingMaterial();
  hm.dyn = new THREE.InstancedMesh(geo, hm.dynMat, HM_DYN);
  hm.dyn.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aLit', new THREE.InstancedBufferAttribute(new Float32Array(HM_DYN), 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aFlash', new THREE.InstancedBufferAttribute(new Float32Array(HM_DYN), 1).setUsage(THREE.DynamicDrawUsage));
  m.makeScale(0, 0, 0);
  for (let i = 0; i < HM_DYN; i++) { hm.dyn.setMatrixAt(i, m); hm.dyn.setColorAt(i, c.setHex(HM_COL.body)); }
  hm.dyn.frustumCulled = false;
  hm.surface.add(hm.dyn);
  hm.items = new Map(); hm.free = Array.from({ length: HM_DYN }, (_, i) => HM_DYN - 1 - i); hm.slots = {}; for (const p in HM_PLACES) hm.slots[p] = [];
  // undercity rooms
  hm.rooms = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial(), HM_ROOMS);
  hm.rooms.frustumCulled = false; hm.rooms.count = 0; hm.rooms.visible = false;
  hm.rooms.setColorAt(0, c.setHex(HM_COL.body));
  hm.roomOf = [];
  hm.group.add(hm.rooms);
  // vehicles
  hm.cars = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 1.3, 1.5).translate(0, 0.9, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), HM_CARS);
  hm.cars.frustumCulled = false; hm.cars.count = 0; hm.cars.raycast = () => {};
  hm.cars.setColorAt(0, c.setHex(HM_COL.warm));
  hm.surface.add(hm.cars);
  hm.carList = []; hm.flows = {};
  hm.paths = HM_PATHS; hm.boardLen = hm.len = hmPathLens(HM_PATHS); hm.ringPaths = hmRingPaths(); hm.ringLen = hmPathLens(hm.ringPaths);
  // a highlight box around the selected thing
  hm.selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), new THREE.LineBasicMaterial({ color: HM_COL.ice }));
  hm.selBox.visible = false; hm.selBox.raycast = () => {}; hm.group.add(hm.selBox);
}
function hmLotM(i, h) {
  const nx = HM_LOTS[0], s = HM_LOT_P * HM_K;
  return new THREE.Matrix4().makeScale(s * 0.86, h, s * 0.86).setPosition(hmW(HM_LOT_U[0] + (i % nx + 0.5) * HM_LOT_P), 0.05, hmW(HM_LOT_U[1] + (Math.floor(i / nx) + 0.5) * HM_LOT_P));
}

// one program family: sums over its processes
function hmFold(list) {
  const by = new Map();
  for (const p of list) {
    let g = by.get(p.key);
    if (!g) { g = { key: p.key, exe: p.exe, cls: p.cls, place: p.place, layer: p.layer, s: p.s, cpu: 0, ws: 0, priv: 0, r: 0, w: 0, hard: 0, th: 0, win: 0, fg: false, hint: '', n: 0, obs: false }; by.set(p.key, g); }
    g.cpu += p.cpu; g.ws += p.ws; g.priv += p.priv; g.r += p.r; g.w += p.w; g.hard += p.hard; g.th += p.th; g.win += p.win; g.n++;
    g.fg = g.fg || p.fg; g.hint = g.hint || p.hint; g.obs = g.obs || p.obs; g.layer = Math.max(g.layer, p.layer);   // the family's highest layer
  }
  return [...by.values()].sort((a, b) => b.ws - a.ws);
}

// ---- one sample of the machine
function hmApply(e) {
  hmCores(e); hmDisks(e); hmMarket(e); hmPrograms(e); hmRooms(e); hmFlows(e);
  hmSelApply();
  requestRender(); hmAnimate();
}
function hmLit(ent, v, flash = 0) {
  const a = hm.meshBox.geometry.attributes.aLit, f = hm.meshBox.geometry.attributes.aFlash;
  for (const p of ent.parts) if (p.kind === 'box') { a.array[p.i] = v; f.array[p.i] = flash; }
  a.needsUpdate = true; f.needsUpdate = true;
}
function hmCores(e) {
  const n = e.cores.length / 6;   // logical CPUs per hall
  for (let i = 0; i < 6; i++) {
    const a = e.cores[Math.floor(i * n)], b = e.cores[Math.floor(i * n) + 1] || a;
    if (a) hmLit(hmEnts.get('hall' + i), Math.min(1, (a.u + a.k + b.u + b.k) / 240));
  }
  const g = e.gpu && e.gpu.eng ? Math.min(1, Object.values(e.gpu.eng).reduce((x, v) => Math.max(x, v), 0) / 100) : 0;
  hmLit(hmEnts.get('studio'), Math.max(0.03, g));
  const kern = e.cores.reduce((x, c) => x + c.k, 0) / Math.max(1, e.cores.length);
  hmLit(hmEnts.get('palace'), Math.min(1, 0.05 + kern / 40));
}
function hmDisks(e) {
  for (const id of ['whC', 'whH', 'whG', 'whF']) {
    const t = hmEnts.get(id), d = e.disks.find(x => x.letters.includes(t.disk));
    if (t.parts.some(p => p.kind === 'box')) hmLit(t, d ? Math.min(1, d.busy / 100) : 0);
  }
}
function hmMarket(e) {
  const m = e.mem, total = m.total || 1, nLots = hm.lots.count, unit = total / nLots, c = new THREE.Color();
  const kern = m.paged + m.nonpaged, used = Math.max(0, total - m.avail - kern - m.modified), groups = hmFold(e.procs.filter(p => p.layer !== -3));
  const wsAll = groups.reduce((a, g) => a + g.ws, 0) || 1;
  const owners = groups.slice(0, 6).map((g, i) => ({ n: Math.round(g.ws / wsAll * used / unit), col: HM_WARM[i], key: g.key }));
  const seq = [{ n: Math.round(kern / unit), col: HM_LOTCOL.kernel, key: null, h: 2.2 }, ...owners.map(o => Object.assign(o, { h: 3.4 })), { n: Math.round(used / unit) - owners.reduce((a, o) => a + o.n, 0), col: HM_LOTCOL.other, key: null, h: 2.6 },
    { n: Math.round(m.modified / unit), col: HM_LOTCOL.modified, key: null, h: 1.6 }, { n: Math.round(m.standby / unit), col: HM_LOTCOL.standby, key: null, h: 0.9 }];
  let i = 0;
  for (const s of seq) for (let k = 0; k < s.n && i < nLots; k++, i++) { hm.lots.setMatrixAt(i, hmLotM(i, s.h)); hm.lots.setColorAt(i, c.setHex(s.col)); hm.lotOwner[i] = s.key; }
  for (; i < nLots; i++) { hm.lots.setMatrixAt(i, hmLotM(i, 0.25)); hm.lots.setColorAt(i, c.setHex(HM_LOTCOL.free)); hm.lotOwner[i] = null; }
  hm.lots.instanceMatrix.needsUpdate = true; hm.lots.instanceColor.needsUpdate = true;
}

// a stable plot in its place: spiral-free, simply the first free cell; a program keeps it while it lives
function hmPlot(place) {
  const r = HM_PLACES[place] || HM_PLACES.kulvaros, s = hm.slots[place] || hm.slots.kulvaros, p = hm.all ? r[4] * 0.62 : r[4];
  const nx = Math.max(1, Math.floor((r[2] - r[0]) / p)), ny = Math.max(1, Math.floor((r[3] - r[1]) / p));
  for (let i = 0; i < nx * ny; i++) if (!s[i]) { s[i] = true; return { place, cell: i, u: r[0] + (i % nx + 0.5) * p, v: r[1] + (Math.floor(i / nx) % ny + 0.5) * p, f: p * 0.74 }; }
  return null;
}
function hmPlotFree(pl) { if (pl) hm.slots[pl.place][pl.cell] = false; }
function hmPlacesReset() { for (const it of hm.items.values()) hmItemDrop(it); hm.items.clear(); for (const p in hm.slots) hm.slots[p] = []; }
function hmItemDrop(it) { hm.dyn.setMatrixAt(it.i, new THREE.Matrix4().makeScale(0, 0, 0)); hm.free.push(it.i); }

function hmPrograms(e) {
  if (hm.mode !== hm.all) { hmPlacesReset(); hm.mode = hm.all; }
  const wanted = [];
  if (hm.all) for (const p of e.procs) { if (p.layer >= -1) wanted.push(Object.assign({}, p, { id: 'p' + p.pid, n: 1 })); }
  else {
    const gs = hmFold(e.procs), booths = gs.filter(g => g.layer === -1).sort((a, b) => b.cpu - a.cpu || b.ws - a.ws).slice(0, 24);
    for (const g of gs) if (g.layer === 0) wanted.push(Object.assign(g, { id: 'k' + g.key }));
    for (const g of booths) wanted.push(Object.assign(g, { id: 'k' + g.key }));
    const busy = gs.filter(g => g.layer === -2 && g.cpu > 3).slice(0, 4);   // a busy background task can never hide
    for (const g of busy) wanted.push(Object.assign(g, { id: 'k' + g.key }));
  }
  const seen = new Set(), now = performance.now(), lit = hm.dyn.geometry.attributes.aLit, col = new THREE.Color();
  for (const w of wanted) {
    seen.add(w.id);
    let it = hm.items.get(w.id);
    if (!it) {
      const plot = hmPlot(w.place), i = hm.free.pop();
      if (!plot || i === undefined) { if (i !== undefined) hm.free.push(i); continue; }
      it = { id: w.id, i, plot, h: 0, born: now };
      hm.items.set(w.id, it);
      hm.dyn.geometry.attributes.aFlash.array[i] = 0.7;
    }
    it.w = w;
    const mb = w.ws / 1048576, booth = w.layer < 0, area = w.place === 'belvaros' ? 1.4 : 1;
    it.target = booth ? Math.max(1.5, 1.2 * Math.log10(1 + mb)) : Math.max(4, area * 11 * Math.log10(1 + mb / 4));
    it.foot = it.plot.f * (booth ? 0.5 : Math.min(1, 0.55 + 0.13 * Math.log10(1 + mb)));
    lit.array[it.i] = Math.min(1, 0.03 + w.cpu / 25);
    hm.dyn.setColorAt(it.i, col.setHex(w.fg ? 0x7a8a96 : hm.tags && w.hint ? 0x6a4a3a : HM_COL.body).multiplyScalar(w.obs ? 0.6 : 1));
  }
  for (const [id, it] of hm.items) if (!seen.has(id)) { it.gone = it.gone || now; if (now - it.gone > 1500) { hmPlotFree(it.plot); hmItemDrop(it); hm.items.delete(id); } else it.target = 0; } else it.gone = 0;
  lit.needsUpdate = true; hm.dyn.instanceColor.needsUpdate = true; hm.dyn.geometry.attributes.aFlash.needsUpdate = true;
}
function hmRooms(e) {
  const rows = hm.all ? e.procs.filter(p => p.layer <= -2).map(p => Object.assign({}, p, { n: 1 })) : hmFold(e.procs).filter(g => g.layer <= -2).slice(0, 90);
  const c = new THREE.Color(), n = Math.min(HM_ROOMS, rows.length), side = Math.ceil(Math.sqrt(n * 1.1)) || 1, span = 190, cell = span / side;
  hm.roomOf = [];
  for (let i = 0; i < n; i++) {
    const r = rows[i], kernel = r.layer === -3, h = 2 + 2.4 * Math.log10(1 + r.ws / 1048576) * (hm.all ? 0.6 : 1), f = cell * 0.78;
    hm.rooms.setMatrixAt(i, new THREE.Matrix4().makeScale(f, h, f).setPosition(-span / 2 + (i % side + 0.5) * cell, kernel ? -56 : -38, -span / 2 + (Math.floor(i / side) + 0.5) * cell));
    hm.rooms.setColorAt(i, c.setHex(r.cpu > 1 ? HM_COL.warm : kernel ? 0x4a5560 : HM_COL.body).multiplyScalar(r.cpu > 1 ? 1 : 0.55 + Math.min(0.45, r.cpu)));
    hm.roomOf[i] = r;
  }
  hm.rooms.count = n;
  hm.rooms.instanceMatrix.needsUpdate = true; if (hm.rooms.instanceColor) hm.rooms.instanceColor.needsUpdate = true;
}

// how many vehicles each road carries: a log of the measured rate
function hmFlows(e) {
  const bytes = id => { const d = e.disks.find(x => x.letters.includes(id)); return d ? d.r + d.w : 0; };
  const count = (v, unit) => Math.min(26, Math.round(3.2 * Math.log10(1 + v / unit)));
  const net = e.nics.reduce((a, n) => a + n.rx + n.tx, 0), eng = (e.gpu && e.gpu.eng) || {}, disks = e.disks.reduce((a, d) => a + d.r + d.w, 0);
  hm.flows = { mem: count(e.mem.hard, 1), gpu: count((eng.Copy || 0) + (eng['3D'] || 0), 0.5), main: count(disks + net, 20480), C: count(bytes('C:'), 20480), H: count(bytes('H:'), 20480), G: count(bytes('G:'), 20480), F: count(bytes('F:'), 20480), net: count(net, 2048) };
}
function hmCarsStep(dt) {
  const list = hm.carList;
  for (const k in hm.flows) {
    const have = list.filter(c => c.k === k).length;
    for (let i = have; i < hm.flows[k] && list.length < HM_CARS; i++) list.push({ k, t: Math.random(), dir: i % 2 ? 1 : -1, sp: 9 + Math.random() * 7 });
  }
  const m = new THREE.Matrix4(), rm = new THREE.Matrix4(), col = new THREE.Color();
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i];
    c.t += c.dir * dt * c.sp / hm.len[c.k];
    if (c.t < 0 || c.t > 1) {   // at the end of its road: a car beyond the measured rate leaves
      if (list.filter(x => x.k === c.k).length > (hm.flows[c.k] || 0)) { list.splice(i, 1); continue; }
      c.dir = -c.dir; c.t = Math.max(0, Math.min(1, c.t));
    }
  }
  for (const c of list) {
    const pts = hm.paths[c.k]; let at = c.t * hm.len[c.k], j = 1;
    for (; j < pts.length; j++) { const L = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); if (at <= L || j === pts.length - 1) { const f = L ? at / L : 0, a = pts[j - 1], b = pts[j], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const side = c.dir * 1.1, nx = -Math.sin(ang), nz = Math.cos(ang);
      m.copy(rm.makeRotationY(-ang)).setPosition(hmW(a[0] + (b[0] - a[0]) * f) + nx * side, 0.2, hmW(a[1] + (b[1] - a[1]) * f) + nz * side); break; } at -= L; }
    hm.cars.setMatrixAt(n, m); hm.cars.setColorAt(n, col.setHex(HM_FLOWCOL[c.k])); n++;
  }
  hm.cars.count = n;
  hm.cars.instanceMatrix.needsUpdate = true; if (hm.cars.instanceColor) hm.cars.instanceColor.needsUpdate = true;
}

// ---- the frame loop: only while this view is open, the tab shows, and something moves (R11, 04-data-feed §4.6)
function hmAnimate() { if (!hm.raf && vw.id === 'homeland') hm.raf = requestAnimationFrame(hmFrame); }
function hmFrame(ts) {
  hm.raf = 0;
  if (vw.id !== 'homeland' || document.hidden) return;
  const now = performance.now(), dt = Math.min(0.1, (now - (hm.lastFrame || now)) / 1000);
  if (now - hm.lastFrame < 30) { hmAnimate(); return; }   // about 30 frames a second is plenty for traffic
  hm.lastFrame = now;
  const k = 1 - Math.pow(0.002, dt), still = matchMedia('(prefers-reduced-motion: reduce)').matches || window.KV_INSTANT;
  let busy = hmPlanStep(now, still);   // 44-hm-grow: the move between the plans
  for (const it of hm.items.values()) {
    if (it.target == null) continue;
    const d = it.target - it.h;
    if (Math.abs(d) > 0.05) { it.h = still ? it.target : it.h + d * k; busy = true; it.dirty = true; }
    const fa = hm.dyn.geometry.attributes.aFlash;
    if (fa.array[it.i] > 0) { fa.array[it.i] = Math.max(0, fa.array[it.i] - dt * 0.6); fa.needsUpdate = true; busy = true; }
    if (it.dirty || it.foot !== it.footWas) {
      it.dirty = false; it.footWas = it.foot;
      hm.dyn.setMatrixAt(it.i, hmItemM(it, new THREE.Matrix4()));
      hm.dyn.instanceMatrix.needsUpdate = true;
    }
  }
  if (!still && Object.values(hm.flows || {}).some(v => v) || hm.carList.length) { hmCarsStep(still ? 0 : dt); busy = true; }
  const nowS = now / 1000;
  if (nowS < hm.waveUntil) { hm.water.material.uniforms.uT.value = nowS; busy = true; }
  hm.water.material.uniforms.uCam.value.copy(camera.position);
  requestRender();
  if (busy) hmAnimate();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) hmAnimate(); });

// ---- the pointer
function hmPick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (hm.layer > 0) {
    const hit = ray.intersectObjects(hm.layer >= 2 ? [hm.rooms, hm.stone] : [hm.rooms], false)[0];
    if (!hit) return null;
    if (hit.object === hm.stone) return hm.stone.userData.ent;
    const rw = hm.roomOf[hit.instanceId]; return rw ? { prog: rw.key, pid: hm.all ? rw.pid : 0, name: rw.exe } : null;
  }
  const hits = ray.intersectObjects([hm.dyn, hm.lots, ...hm.emptyLot.children, ...hm.meshes, ...(hm.plan ? hm.gMeshes : [])], false);
  for (const h of hits) {
    if (h.object === hm.dyn) {
      for (const it of hm.items.values()) if (it.i === h.instanceId && it.w) return { prog: it.w.key, pid: hm.all ? it.w.pid : 0, name: it.w.exe, it };
      continue;
    }
    if (h.object === hm.lots) { const k = hm.lotOwner[h.instanceId]; return k ? { prog: k, pid: 0, name: k, lot: true } : hmEnts.get('market'); }
    if (h.object.userData.ent) return h.object.userData.ent;
    const p = h.object.userData.parts && h.object.userData.parts[h.instanceId];
    if (p && p.ent) return p.ent.parent === 'fab' ? hmEnts.get('fab') : p.ent;
  }
  return null;
}
function hmHover(e) {
  const tip = $('tip'), t = hmPick(e);
  if (!t) { tip.hidden = true; return; }
  const r = canvas.getBoundingClientRect();
  tip.textContent = t.prog ? t.name : t.name;
  tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.hidden = false;
}
function hmClick(e) {
  const t = hmPick(e);
  if (t) return hmShow(t);
  hmShow(null);
  const p = hmWaterAt(e);
  if (p) hmWave(p.x, p.z);
}
function hmSelApply() {
  const t = hm.sel, b = hm.selBox;
  if (!b) return;
  const it = t && t.it;
  b.visible = !!(it && hm.layer === 0);
  if (b.visible) {
    const z = hm.z[HM_PLACE_ZONE[it.plot.place]], s = z ? z.s : 1, [x, y] = hmZoneXZ(z, hmW(it.plot.u), hmW(it.plot.v));
    b.scale.set(it.foot * HM_K * 1.15 * s, Math.max(2, it.target) * 1.06 * s, it.foot * HM_K * 1.15 * s); b.position.set(x, 0, y);
  }
  requestRender();
}
function hmHwApply(d) {
  hm.emptyLot.visible = !d.ram || d.ram.dimms.length < d.ram.slots;
  const s = (d.bios && `Alapkő · UEFI ${d.bios.version} · ${d.board}`) || 'Alapkő';
  hm.bedLabel.material.map = landLabel(s.slice(0, 34), '#e0c9a8'); hm.bedLabel.material.needsUpdate = true;
  requestRender();
}
