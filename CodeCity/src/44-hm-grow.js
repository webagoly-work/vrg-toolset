// 44-hm-grow.js — the two plans of Gépország (CITY-D42 A + C). Bekötés is the board's real wiring. Növekedés draws 43-hm-plan
// in the middle of the island while the same complexes, still live, move out to a ring and their wires fold into a ring
// road. The move rebuilds no building: every complex keeps its instances and only its zone's transform changes.

// a zone: its centre in Bekötés and its place clockwise on the ring; the ring keeps the complexes roughly where they were
const HM_RING_R = 38, HM_RING_ROAD = 29.8, HM_ZONE_S = 0.55;
const HM_ZONES = [['muhely', 49.5, 12.5], ['market', 73.5, 25], ['kulvaros', 91, 41], ['storage', 77, 69], ['junction', 49, 74], ['palace', 50, 58], ['barracks', 40, 90], ['harbour', 19, 83], ['belvaros', 22.5, 57], ['studio', 18, 32], ['fab', 47, 32]];
const HM_ENT_ZONE = { fab: 'fab', studio: 'studio', palace: 'palace', junction: 'junction', whC: 'storage', whH: 'storage', whG: 'storage', harbour: 'harbour', barracks: 'barracks', empty: 'market', market: 'market', downtown: 'belvaros', workshops: 'muhely', suburbs: 'kulvaros' };
const HM_PLACE_ZONE = { belvaros: 'belvaros', muhely: 'muhely', kulvaros: 'kulvaros', palota: 'palace', laktanya: 'barracks' };
// the board's links, as trips on the ring road; the same vehicles count the same measured rates
const HM_TRIPS = { mem: ['fab', 'market'], gpu: ['fab', 'studio'], main: ['fab', 'junction'], C: ['junction', 'storage'], H: ['junction', 'storage'], G: ['junction', 'storage'], F: ['junction', 'storage'], net: ['junction', 'harbour'] };
const hmEntZone = id => HM_ENT_ZONE[/^hall/.test(id) ? 'fab' : id] || null;
const hmRingAng = i => i / HM_ZONES.length * Math.PI * 2;
const hmRingPt = (ang, r) => [50 + Math.sin(ang) * r, 50 - Math.cos(ang) * r];

function hmZonesInit() {
  hm.z = {};
  HM_ZONES.forEach(([id, u, v], i) => { const [tu, tv] = hmRingPt(hmRingAng(i), HM_RING_R); hm.z[id] = { i, c: [hmW(u), hmW(v)], t: [hmW(tu), hmW(tv)], tx: 0, tz: 0, s: 1 }; });
}
function hmZonesAt(e) {
  for (const z of Object.values(hm.z)) {
    z.s = 1 + (HM_ZONE_S - 1) * e;
    z.tx = z.c[0] + (z.t[0] - z.c[0]) * e - z.s * z.c[0];
    z.tz = z.c[1] + (z.t[1] - z.c[1]) * e - z.s * z.c[1];
  }
}
const hmZoneXZ = (z, x, y) => (z ? [z.tx + z.s * x, z.tz + z.s * y] : [x, y]);
function hmItemM(it, m) {
  const z = hm.z[HM_PLACE_ZONE[it.plot.place]], s = z ? z.s : 1, [x, y] = hmZoneXZ(z, hmW(it.plot.u), hmW(it.plot.v));
  return m.makeScale(it.foot * HM_K * s, Math.max(0.01, it.h) * s, it.foot * HM_K * s).setPosition(x, 0, y);
}

// the board's wires, folded: from one zone along the ring road to the other, by the shorter way round
function hmRingPaths() {
  const out = {}, n = HM_ZONES.length, at = id => HM_ZONES.findIndex(z => z[0] === id);
  for (const [k, [a, b]] of Object.entries(HM_TRIPS)) {
    const ia = at(a), ib = at(b), d = ((ib - ia + n + n / 2) % n) - n / 2, pts = [hmRingPt(hmRingAng(ia), HM_RING_R)];
    for (let t = 0; t <= 8; t++) pts.push(hmRingPt(hmRingAng(ia + d * t / 8), HM_RING_ROAD));
    pts.push(hmRingPt(hmRingAng(ia + d), HM_RING_R));
    out[k] = pts;
  }
  return out;
}
const hmPathLens = paths => { const o = {}; for (const [k, pts] of Object.entries(paths)) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); o[k] = L; } return o; };

// ---- the drawing of the plan
const HM_KINDCOL = { code: HM_COL.body, data: 0x6d6257, docs: 0x5b6a75, gone: 0x2c3339 };
const HM_GARDEN = 0x41594b;
async function hmGrowEnsure() {
  const city = current && current.city;
  if (!city || !city.commits || city.commits.length < 2) return false;
  if (hm.grow && hm.growHead === city.repo.head) return true;
  if (hm.grow) { hm.group.remove(hm.grow); for (const m of hm.gMeshes) m.dispose(); for (const k of [...hmEnts.keys()]) if (k.startsWith('g:')) hmEnts.delete(k); }
  let tools = (pal.cat || PAL_EMPTY).tools;
  if (!tools.length && window.KV_COMPANION) try { const r = await fetch('/api/catalog'); if (r.ok) tools = (await r.json()).tools || []; } catch (e) { /* no shops, the panel still works */ }
  hm.plan2 = hmGrowthPlan(city, tools);
  hm.growHead = city.repo.head;
  hmGrowBuild(hm.plan2, city);
  return true;
}
function hmGrowBuild(plan, city) {
  const list = { box: [], dome: [] };
  const put = (kind, ent, u, v, w, d, h, col, y, born) => { const p = { kind, ent, m: new THREE.Matrix4().makeScale(w * HM_K, h, d * HM_K).setPosition(hmW(u), y, hmW(v)), col, tag: ent ? ent.tag : 'K', born }; list[kind].push(p); return p; };
  const seg = (ent, a, b, wide, col, born, y = 0.1) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const q = new THREE.Matrix4().makeRotationY(-ang).scale(new THREE.Vector3(L * HM_K + wide, 0.25, wide)).setPosition(hmW((a[0] + b[0]) / 2), y, hmW((a[1] + b[1]) / 2));
    list.box.push({ kind: 'box', ent, m: q, col, tag: 'K', born });
  };
  // the ring road and its spurs carry the live traffic, so they stand from the first moment
  for (let i = 0; i < 44; i++) seg(null, hmRingPt(i / 44 * Math.PI * 2, HM_RING_ROAD), hmRingPt((i + 1) / 44 * Math.PI * 2, HM_RING_ROAD), 2.6, HM_COL.road, -1);
  HM_ZONES.forEach((z, i) => seg(null, hmRingPt(hmRingAng(i), HM_RING_ROAD), hmRingPt(hmRingAng(i), HM_RING_R - 5), 2.2, HM_COL.road, -1));
  // the hub: a plaza and the first village, one house for about every tenth file of the first commit
  const he = hmEnt('g:hub', `${plan.hub || 'Gyökér'}-falu`, 'K', { grow: 'hub' });
  put('box', he, 50, 50, HM_HUB_R * 2 * 0.74, HM_HUB_R * 2 * 0.74, 0.5, HM_COL.road, 0, 0);
  const houses = Math.min(14, Math.max(3, Math.round(plan.hubStart / 10)));
  for (let i = 0; i < houses; i++) { const a = i / houses * Math.PI * 2, r = i % 2 ? 2.9 : 1.7, [u, v] = [50 + Math.sin(a) * r, 50 - Math.cos(a) * r]; put('box', he, u, v, 0.9, 0.9, 2.4 + (i % 3), HM_COL.top, 0.5, 0); }
  // the streets
  plan.areas.forEach(a => {
    const name = a.name || 'Gyökér', e = hmEnt('g:a' + a.i, name, 'M', { grow: 'area', a });
    const dead = a.gone === a.files, n = Math.ceil((a.end - HM_HUB_R) / 2.2), wide = 1.6 + Math.min(1.6, Math.log10(1 + a.loc) / 3.2);
    for (let i = 0; i < n; i++) { const r0 = HM_HUB_R + i * 2.2, r1 = Math.min(a.end, r0 + 2.2); seg(e, hmPolar(a, r0), hmPolar(a, r1), wide, dead ? HM_KINDCOL.gone : HM_COL.road, a.born + i * 0.3); }
  });
  // ideas merging
  plan.links.forEach((l, i) => { const e = hmEnt('g:l' + i, `${l.a || 'Gyökér'} ↔ ${l.b || 'Gyökér'}`, 'K', { grow: 'link', l }); seg(e, l.ua, l.ub, 1.3, HM_COL.rim, l.first); });
  // warehouses, boxes and packs
  plan.lots.forEach((l, i) => {
    const e = hmEnt('g:w' + i, hmLotName(l), 'M', { grow: 'lot', l }), col = HM_KINDCOL[l.kind], f = l.foot, h = l.kind === 'gone' ? 0.8 : 1.5 + 3.3 * Math.log10(1 + l.loc);
    if (l.kind === 'gone') put('box', e, l.u, l.v, f, f, h, col, 0, l.born);
    else if (l.size === 'warehouse') { put('box', e, l.u, l.v, f, f, h, col, 0, l.born); put('box', e, l.u, l.v, f * 1.08, f * 1.08, 1, HM_COL.top, h, l.born); }
    else if (l.size === 'boxes') { const q = f * 0.56; put('box', e, l.u - q / 2, l.v - q / 2, q, q, h * 0.6, col, 0, l.born); put('box', e, l.u + q / 2, l.v + q / 2, q, q, h * 0.4, col, 0, l.born); put('box', e, l.u + q / 2, l.v - q / 2, q * 0.8, q * 0.8, h * 0.8, col, 0, l.born); }
    else put('box', e, l.u, l.v, f * 0.55, f * 0.55, Math.max(1.4, h * 0.6), col, 0, l.born);
  });
  // shops, and a garden beside the programs of the design system
  plan.shops.forEach((s, i) => {
    const e = hmEnt('g:s' + i, s.name, 'M', { grow: 'shop', s });
    put('box', e, s.u, s.v, s.foot, s.foot, 6, HM_COL.top, 0, s.born);
    put('box', e, s.u, s.v, s.foot * 1.2, s.foot * 1.2, 0.6, HM_COL.ice, 6, s.born);
    if (s.garden) {
      const [gu, gv] = s.ga;
      put('box', e, gu, gv, s.foot, s.foot, 0.35, HM_GARDEN, 0, s.born + 1);
      for (let k = 0; k < 3; k++) put('dome', e, gu + (k - 1) * s.foot * 0.28, gv + (k % 2 - 0.5) * s.foot * 0.4, s.foot * 0.3, s.foot * 0.3, 1.7, HM_GARDEN, 0.35, s.born + 1);
    }
  });
  hm.grow = new THREE.Group(); hm.grow.visible = false;
  const inst = (kind, geo) => {
    const parts = list[kind], im = new THREE.InstancedMesh(geo, hm.mPlain, parts.length), c = new THREE.Color();
    parts.forEach((p, i) => { im.setMatrixAt(i, p.m); im.setColorAt(i, c.setHex(p.col)); p.i = i; });
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.parts = parts; im.frustumCulled = false;
    im.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 700);
    hm.grow.add(im);
    return im;
  };
  hm.gMeshes = [inst('box', unitBox.clone()), inst('dome', hm.meshes[3].geometry)];
  // signs: the ten largest ideas and the village; the others answer on hover, so no sign covers another
  hm.gLabels = [...plan.areas].sort((x, y) => y.loc - x.loc).slice(0, 10).map(a => {
    const [u, v] = hmPolar(a, a.end + 0.5), sp = hmLabel(a.name || 'Gyökér', hmW(u), 11 + (a.i % 3) * 5, hmW(v), 18 + (a.name || 'Gyökér').length * 1.9);
    sp.userData.born = a.born; hm.grow.add(sp); return sp;
  });
  const hl = hmLabel(he.name, hmW(50), 16, hmW(50), 26 + he.name.length * 1.5); hl.userData.born = 0; hm.gLabels.push(hl); hm.grow.add(hl);
  hm.group.add(hm.grow);
  hmTagsApply();
  hmGrowReveal(plan.last);
}
function hmLotName(l) { return `${l.area || 'Gyökér'} · ${{ code: 'kód', data: 'adat', docs: 'dokumentum', gone: 'törölt' }[l.kind]}`; }

// the history up to commit T: what was not there yet is not drawn
function hmGrowReveal(T) {
  hm.gT = T;
  const m = new THREE.Matrix4(), s = new THREE.Matrix4(), rise = Math.max(2, hm.plan2.last * 0.05);
  for (const im of hm.gMeshes) {
    for (const p of im.userData.parts) {
      const v = Math.min(1, Math.max(0, (T - p.born + 1) / rise));
      if (v >= 1) { im.setMatrixAt(p.i, p.m); continue; }
      im.setMatrixAt(p.i, m.copy(p.m).multiply(s.makeScale(v, v, v)));
    }
    im.instanceMatrix.needsUpdate = true;
  }
  for (const sp of hm.gLabels) sp.visible = T >= sp.userData.born;
  hmWhen();
}
function hmWhen() {
  const el = $('hm-when'), city = current && current.city;
  if (!el) return;
  if (hm.estate) {
    const pl = hm.ePlan;
    el.hidden = false;
    el.textContent = hm.eStatus || (pl && pl.measured ? `${hmGB(pl.read)} olvasva${pl.partial ? ' · részleges: lejárt az időkeret' : ''}` : '');
    return;
  }
  el.hidden = !hm.plan || !city;
  if (el.hidden) return;
  const i = Math.min(city.commits.length - 1, Math.floor(hm.gT)), d = new Date(city.commits[i][0] * 1000).toLocaleDateString('hu-HU');
  el.textContent = `${hu(i + 1)}. / ${hu(city.commits.length)} commit · ${d}`;
}

// ---- switching: one frame of the move, driven from hmFrame so it costs nothing at rest
async function hmSetPlan(p) {
  if (p === 2) return hmEstateOpen();
  const wasEstate = !!hm.estate;
  if (wasEstate) hmEstateClose();
  if (p === hm.plan) { hmPlanPaint(); if (wasEstate) hmHome(900); return; }
  if (p && !await hmGrowEnsure()) { kvToast('Nincs betöltött git-történet'); return; }
  hm.plan = p; hmShow(null);
  hm.carList = []; hm.flowsWas = hm.flows;
  if (p) hmGrowReveal(0);
  hm.planFrom = hm.planK; hm.planT0 = performance.now();
  hm.gPlay = p ? hm.planT0 + 500 : 0;
  hmPlanPaint();
  hmHome(1100);
  hmAnimate();
}
// by the clock, not by frames: a busy machine draws few of them, and the move must still end on time
function hmPlanStep(now, still) {
  let busy = false;
  if (hm.planK !== hm.plan) {
    const f = still ? 1 : Math.min(1, (now - hm.planT0) / 1100);
    hm.planK = hm.planFrom + (hm.plan - hm.planFrom) * f;
    hmPlanApply();
    if (hm.planK === hm.plan) { hm.paths = hm.plan ? hm.ringPaths : HM_PATHS; hm.len = hm.plan ? hm.ringLen : hm.boardLen; }
    busy = true;
  }
  if (hm.gPlay && now >= hm.gPlay) {
    const T = still ? hm.plan2.last : (now - hm.gPlay) / 6500 * hm.plan2.last;
    hmGrowReveal(Math.min(hm.plan2.last, T));
    if (hm.gT >= hm.plan2.last) hm.gPlay = 0;
    busy = true;
  } else if (hm.gPlay) busy = true;
  return busy;
}
function hmPlanApply() {
  const k = hm.planK, e = k * k * (3 - 2 * k), m = new THREE.Matrix4(), q = new THREE.Matrix4(), v = new THREE.Vector3(), lift = 1 - e;
  hmZonesAt(e);
  for (const im of hm.meshes) {
    for (const p of im.userData.parts) {
      if (p.road) { im.setMatrixAt(p.i, m.copy(p.m).scale(v.set(lift, 1, lift))); continue; }
      const z = p.ent && hm.z[hmEntZone(p.ent.id)];
      if (!z) continue;
      im.setMatrixAt(p.i, m.set(z.s, 0, 0, z.tx, 0, z.s, 0, 0, 0, 0, z.s, z.tz, 0, 0, 0, 1).multiply(q.copy(p.m)));
    }
    im.instanceMatrix.needsUpdate = true;
  }
  const lz = hm.z.market;
  hm.zLot.position.set(lz.tx, 0, lz.tz); hm.zLot.scale.setScalar(lz.s);
  for (const it of hm.items.values()) it.dirty = true;
  for (const s of hm.labels) {
    const [x0, y0, z0] = s.userData.at, z = hm.z[hmEntZone(s.userData.ent.id)], [x, zz] = hmZoneXZ(z, x0, z0), f = z ? 1 - 0.28 * e : 1;
    s.position.set(x, z ? y0 * z.s + 3 * e : y0, zz); s.scale.set(s.userData.w * f, s.userData.w * f * 96 / 512, 1);
  }
  hm.grow.visible = !hm.estate && hm.layer === 0 && (hm.plan === 1 || k > 0);
  hm.cars.visible = k === 0 || k === 1;
  hmSelApply();
}
function hmPlanPaint() {
  if (!hm.ui) return;
  const on = hm.estate ? 2 : hm.plan;
  for (const b of hm.ui.querySelectorAll('[data-plan]')) b.classList.toggle('on', +b.dataset.plan === on);
  $('hm-replay').hidden = !hm.plan || !!hm.estate;
  hmWhen();
}
function hmReplay() { if (!hm.plan || !hm.plan2 || hm.estate) return; hmGrowReveal(0); hm.gPlay = performance.now(); hmAnimate(); }

// ---- the panel of the plan
function hmGrowPanel(t) {
  const c = current.city, d = i => new Date(c.commits[Math.max(0, Math.min(c.commits.length - 1, i))][0] * 1000).toLocaleDateString('hu-HU');
  const note = '<p class="dim">A hubtól mért távolság az idő, a körbeli sorrend az eszmék megjelenése. Az utcák íve jelkép.</p>';
  const src = 'git log, ' + (t.grow === 'shop' ? 'START-menü' : 'a repó fájljai');
  if (t.grow === 'hub') return openPanel(t.name, [['Első commit', d(0)], ['Fájlok az elején', hu(hm.plan2.hubStart)], ['Commit', hu(c.commits.length)]], '<p class="dim">Innen indult minden. A git-történet az első importtal kezdődik, a korábbi munka nem látszik benne.</p>' + hmFooter('K', src));
  if (t.grow === 'area') { const a = t.a; return openPanel(`${t.name}/`, [['Indult', d(a.born)], ['Utolsó módosítás', d(a.last)], ['Fájl', hu(a.files)], ['Sor', hu(a.loc)], ['Törölt fájl', hu(a.gone)]], note + hmFooter('M', src)); }
  if (t.grow === 'link') { const l = t.l; return openPanel(t.name, [['Közös commit', hu(l.n)], ['Először', d(l.first)]], '<p class="dim">Ez a két terület gyakran ugyanabban a commitban változik. Az összevonó, sok területet érintő commitok nem számítanak.</p>' + hmFooter('K', src)); }
  if (t.grow === 'shop') { const s = t.s; return openPanel(t.name, [['Út', s.area || 'Gyökér'], ['Megjelent', d(s.born)], ['Mélyvíz-kert', s.garden ? 'van' : 'nincs']], note + hmFooter('M', src)); }
  const l = t.l;
  return openPanel(t.name, [['Forma', l.kind === 'gone' ? 'Rom' : { warehouse: 'Raktár', boxes: 'Dobozok', pack: 'Csomag' }[l.size]], ['Fájl', hu(l.files)], ['Sor', hu(l.loc)], ['Legkorábbi', d(l.born)]], note + hmFooter('M', src));
}
