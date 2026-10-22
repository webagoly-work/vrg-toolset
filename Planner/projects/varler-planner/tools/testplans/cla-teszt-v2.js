// cla-teszt-v2.js — v2 of the CLA stack test plan: v1 + every higher stack layer filled with ideal positions.
// Called by cla-teszt.js (mode v2), which boots the Planner and passes its helpers in `ctx`.
//
// The placement rules (the user's, 2026-10-09):
//  1. cluster with traditional electrical positions where possible;
//  2. three wall zones — low 200–500, medium 800–1400, high 1900–2500 — plus ceiling and floor (floor is
//     for pathways, not endpoints: the only floor-level endpoints here are leak sensors);
//  3. a foundational endpoint's vertical zone becomes the preferred zone for other layers' points nearby;
//  4. wall routes rise straight up from an endpoint to the cable spine (kábelgerinc, 2400); the T where a
//     vertical meets the spine gets a kötődoboz;
//  5. higher-layer devices cluster around those junction points;
//  6. door-frame / portal devices go first to the portal box at the door's upper corner (v1).
// So the shape of every door is one vertical column on the latch side: SWI 1300 (the house standard the
// v1 switches set) · NTL 1150 under it · PAN / THR / SEN-wall above it · POR sensor + control over the
// lintel · the portal box at 2300 — one riser, one spine T.
'use strict';
module.exports = function v2(ctx) {
  const { w, fs, IN, OUT, LVL, D, onWall, free, ep, save, report } = ctx;
  const src = JSON.parse(fs.readFileSync(IN, 'utf8'));
  w.hardResetWorkspace(); w.applyProjectData(src.project);
  w.eval('B.name="CLA teszt v2"');
  const S = w.eval('stacks')[0];
  w.stkActivate(S.id);
  const room = num => D().floors.find(f => f.level === LVL && f.num === num);
  const dev = pred => D().devices.find(pred);
  const byRef = ref => dev(d => d.ref === ref);
  const byNote = re => dev(d => re.test(d.note || ''));
  const door = noteOrId => D().openings.find(o => o.id === noteOrId || o.note === noteOrId);
  const NEWDOOR = door('új ajtónyílás (szoba ↔ nappali)').id;
  const V2 = { note: null };
  const tag = (d, n) => { d.note = (d.note ? d.note + ' · ' : '') + 'v2' + (n ? ': ' + n : ''); return d; };

  // a point on the face of room `num` beside door `id`: k mm past the frame on the latch side (k < 0: hinge
  // side; 'lintel' = over the door centre). Falls back to the other jamb, then null, when the face beside the
  // door is not inside the room (a corner, a room narrower than its door).
  function doorPt(id, num, k, h) {
    const o = door(id), rm = room(num), Dd = w.sugDoor(o, rm.id);
    const fits = p => { if (!p) return false; const kk = w.wallInfo(Dd.r).thick / 2 + 60;
      return [60, -60].every(dx => w.pointInPoly(p.x + Dd.n[0] * kk + Dd.d[0] * dx, p.y + Dd.n[1] * kk + Dd.d[1] * dx, rm.poly)); };
    if (k === 'lintel') { const p = w.sugDoorPt(Dd, 0, h, ''); return p && { x: p.x, y: p.y, side: p.side > 0 ? 1 : 0 }; }
    for (const s of [1, -1]) {
      const p = w.sugDoorPt(Dd, s * Dd.hd * (Dd.w + Math.abs(k)) * Math.sign(k || 1), h, '');
      if (fits(p)) return { x: p.x, y: p.y, side: p.side > 0 ? 1 : 0 };
    }
    return null;
  }
  const M = 'sys:MAINS', N = {};
  const put = (key, code, role, vk, at, h, note) => { if (!at) throw new Error('no place for ' + key); N[key] = tag(ep(code, role, vk, at, h), note); return N[key]; };

  // ---------- MAINS completion: BRIDGE needs an input at every room's door and a lamp output where the
  // client kept only an existing lamp (the existing positions are re-wired in BRIDGE, so they reappear) ----------
  put('LMP_R01', 'LMP', M, '230', free(9430, 8150), 2700, 'előszoba mennyezet');
  put('LMP_R05', 'LMP', M, '230', free(6338, 8200), 2700, 'kamra mennyezet');
  put('LMP_R03L', 'LMP', M, '230', free(7287, 8300), 2700, 'lépcső mennyezet');
  put('LMP_R07', 'LMP', M, '230', free(2700, 3700), 2700, 'szoba mennyezet');
  put('SWI_R01', 'SWI', M, '230', doorPt('B107', 'R01', 150, 1300), 1300, 'bejárat, kilincs felől');
  put('SWI_R03', 'SWI', M, '230', doorPt('B106', 'R03', 150, 1300), 1300, 'előszoba felőli ajtó');
  put('SWI_R06', 'SWI', M, '230', doorPt('B103', 'R06', 150, 1300), 1300, 'étkező felőli ajtó — kétirányú K14-gyel');
  put('SWI_R04', 'SWI', M, '230', doorPt('B105', 'R04', 150, 1300) || onWall(8514, 8700), 1300, 'WC');
  put('SWI_R05', 'SWI', M, '230', onWall(6769, 7500), 1300, 'kamra, az ajtó melletti falon');
  put('SWI_R03L', 'SWI', M, '230', onWall(7604, 7300), 1300, 'lépcső alja');
  put('SWI_R08', 'SWI', M, '230', doorPt('B109', 'R08', 150, 1300), 1300, 'fürdő');
  put('SOC_R01', 'SOC', M, 's04', onWall(8714, 8500), 300, 'előszoba általános');

  // ---------- bus B: an NTL under every room's door switch (S8: beside every portal), night lights ----------
  const ntl = (key, at) => put(key, 'NTL', 'sys:BUSB', 'tr', at, 1150, 'értesítő fény a kapcsoló alatt');
  ntl('NTL_R01', doorPt('B107', 'R01', 150, 1150)); ntl('NTL_R03', doorPt('B106', 'R03', 150, 1150));
  ntl('NTL_R06', doorPt('B103', 'R06', 150, 1150)); ntl('NTL_R07', doorPt(NEWDOOR, 'R07', 150, 1150));
  ntl('NTL_R08', doorPt('B109', 'R08', 150, 1150)); ntl('NTL_R04', doorPt('B105', 'R04', 150, 1150) || onWall(8514, 8700));
  ntl('NTL_R05', onWall(6769, 7500)); ntl('NTL_R03L', onWall(7604, 7300));
  put('NL_R01', 'LMP', 'sys:BUSB', 'b', onWall(8714, 8200), 300, 'lábfény — éjszakai út a WC felé');
  put('NL_R03L', 'LMP', 'sys:BUSB', 'b', onWall(6969, 8300), 300, 'lépcső lábfény');

  // ---------- portals P-2 / P-3: ToF sensor + RS-485 control point over the lintel, one door per room ----------
  [['B107', 'R01'], ['B106', 'R03'], ['B103', 'R06'], [NEWDOOR, 'R07'], ['B109', 'R08']].forEach(([id, num]) => {
    put('PORS_' + num, 'POR', 'sys:SENSOR', 'tof', doorPt(id, num, 'lintel', 2150), 2150, 'portál ToF a szemöldök fölött');
    put('PORC_' + num, 'POR', 'sys:CONTROL', 'rs485', doorPt(id, num, 'lintel', 2250), 2250, 'portál vezérlőpont, a portál dobozba fut');
  });

  // ---------- HMI: entry panel, living-room panel, thermostats on inner walls in the door columns ----------
  put('PAN_R01', 'PAN', 'sys:HMI', 'entry', doorPt('B107', 'R01', 300, 1450), 1450, 'belépési pont a bejárat mellett');
  put('PAN_R06', 'PAN', 'sys:HMI', 'touch', doorPt('B103', 'R06', 300, 1450), 1450, 'nappali kezelőpanel');
  put('THR_R06', 'THR', 'sys:HMI', 'bus', onWall(5607, 7900), 1500, 'belső fal (gerincfal), ablaktól és klímától távol');
  put('THR_R07', 'THR', 'sys:HMI', 'bus', doorPt(NEWDOOR, 'R07', 150, 1500), 1500, 'a K15 oszlopában');
  put('THR_R08', 'THR', 'sys:HMI', 'bus', onWall(5400, 3700), 1500, 'fürdő, belső fal');

  // ---------- SENSOR: presence on the ceiling in every room (two zones in R03), air quality, leaks ----------
  [['R01', 8900, 7500], ['R03', 8600, 5900], ['R04', 8184, 8150], ['R03L', 7287, 7600], ['R06', 1300, 5700], ['R07', 3800, 3800]]
    .forEach(([num, x, y]) => put('SEN_' + num, 'SEN', 'sys:SENSOR', 'mmwave', free(x, y), 2700, 'jelenlét'));
  put('SEN_R03b', 'SEN', 'sys:SENSOR', 'mmwave', free(7000, 6800), 2700, 'jelenlét — közlekedő zóna (R03 két zóna)');
  put('SEN_R08', 'SEN', 'sys:SENSOR', 'thermal', free(6700, 3700), 2700, 'hőkamera-tömb, fürdő');
  put('LEAK_R08', 'SEN', 'sys:SENSOR', 'leak', onWall(7599, 4100), 50, 'vízszivárgás a zuhany mellett (padlózóna)');
  put('LEAK_R03', 'SEN', 'sys:SENSOR', 'leak', onWall(7849, 4300), 50, 'vízszivárgás a mosogatógép mellett');
  put('CO2_R03', 'SEN', 'sys:SENSOR', 'co2', doorPt('B106', 'R03', 150, 1500), 1500, 'levegőminőség, a kapcsolóoszlopban');

  // ---------- DATA: access points, the entry camera ----------
  put('ACP_R06', 'ACP', 'sys:DATA', 'poe', free(3000, 7400), 2700, 'nappali WiFi');
  put('ACP_R03', 'ACP', 'sys:DATA', 'poe', free(6800, 5600), 2700, 'étkező / konyha WiFi');
  put('CAM_R01', 'CAM', 'sys:DATA', 'poe', onWall(8714, 7700), 2400, 'a bejárati ajtóra néz');

  // ---------- LV: kitchen under-cabinet line, living-room cove, universal endpoints ----------
  put('LNR_R03', 'LNR', 'sys:LV', 'hosszu', onWall(8800, 3169), 1950, 'felső szekrény alatt, a pult-aljzatok oszlopában');
  put('LNR_R06', 'LNR', 'sys:LV', 'hosszu', onWall(5607, 7200), 2550, 'rejtett világítás a gerincfalon (L-fal)');
  put('UEP_R06', 'UEP', 'sys:LV', 'selv', onWall(4200, 5225), 300, 'médiafal');
  put('UEP_R07', 'UEP', 'sys:LV', 'usbc', onWall(3664, 2390), 900, 'ágy mellett, K13 oszlopában');

  // ---------- MEDIA, USB: the R06 media wall on the partition (K33), the bedroom unit offset ≥ 300 mm ----------
  put('SCR_R06', 'SCR', 'sys:MEDIA', 'aoc', onWall(3900, 5225), 1200, 'médiafal képernyő (K33)');
  put('AVP_R06', 'AVP', 'sys:MEDIA', 'std', onWall(3900, 5225), 300, 'AV pozíció, saját kör (bronz)');
  put('USB_R06', 'USB', 'sys:USB', 'u2', onWall(3600, 5225), 300, 'médiafal');
  put('SCR_R07', 'SCR', 'sys:MEDIA', 'aocd', onWall(3300, 4975), 1200, 'hálószobai egység, 600 mm-re a nappali dobozaitól (K33)');
  [['R06', 3100, 6000], ['R06', 4700, 6000], ['R03', 7500, 6700], ['R03', 9300, 6700], ['R07', 1800, 3500], ['R07', 3300, 3500], ['R08', 6300, 3500]]
    .forEach(([num, x, y], i) => put('SPK_' + num + '_' + i, 'SPK', 'sys:MEDIA', '17', free(x, y), 2700, num === 'R08' ? 'nedves helyiségbe minősített' : 'mennyezeti pár'));

  // ---------- SECURITY (needs an SSC — not placed: a hardware decision) ----------
  put('SEC_R01c', 'SEC', 'sys:SECURITY', 'contact', doorPt('B107', 'R01', 50, 2150), 2150, 'bejárati ajtó nyitásérzékelő, a portál dobozhoz');
  put('SEC_R01d', 'SEC', 'sys:SECURITY', 'det', onWall(8714, 8900), 2200, 'mozgásérzékelő');
  put('SEC_R06d', 'SEC', 'sys:SECURITY', 'det', onWall(5607, 8800), 2200, 'nappali mozgásérzékelő (minden réteg a nappaliban)');

  // ---------- RF: UWB on both RoomBoxes (S5: key rooms) ----------
  ['RBX01', 'RBX02'].forEach(r => { const x = byRef(r); if (x.radios.indexOf('uwb') < 0) x.radios.push('uwb'); });

  // ---------- circuits and control groups for what v2 added ----------
  const ck = name => D().circuits.find(c => c.name === name);
  w.cktAssign(ck('R01 · R04 · R05 általános dugalj'), N.SOC_R01);
  w.cktCreate({ name: 'AV pozíció (médiafal)', dedicated: true, mcb: '1C 16A', members: [N.AVP_R06.id] });
  const mainsL = w.stkLayer(S.id, 'sys:MAINS').id;           // bus-B lamps (orientation, night) are not switch outputs
  const lampsIn = num => D().devices.filter(d => d.type === 'light' && d.code === 'LMP' && d.layer === mainsL && w.epRoomOf(d) === room(num).id).map(d => d.id);
  N.SWI_R01.ctl = lampsIn('R01'); N.SWI_R05.ctl = lampsIn('R05'); N.SWI_R03L.ctl = lampsIn('R03L');
  N.SWI_R03.ctl = lampsIn('R03'); N.SWI_R04.ctl = lampsIn('R04');
  byRef('K15') && (byRef('K15').ctl = [N.LMP_R07.id]);
  const k14 = D().devices.find(d => d.code === 'SWI' && (d.ctl || []).length === 5);
  if (k14) N.SWI_R06.ctl = k14.ctl.slice(0, 3);                  // two-way: the ceiling lamps from both doors
  N.SWI_R08.ctl = [byNote(/^Elszívó/), D().devices.find(d => d.type === 'light' && d.h === 1900 && w.epRoomOf(d) === room('R08').id),
    byNote(/zuhany falában/), byNote(/új fürdőfalban/)].filter(Boolean).map(d => d.id);

  // ---------- the cable spine: a T-kötődoboz at 2400 above every wall cluster (rule 4) ----------
  const armL = w.stkLayer(S.id, 'arm').id, SPINE = 2400;
  const faces = {};
  D().devices.filter(d => d.level === LVL && d.side != null && ['junction', 'board', 'base', 'rbx'].indexOf(d.type) < 0).forEach(d => {
    const pk = w.hwPickPlan(LVL, d.x, d.y, 200); if (!pk) return;
    const key = pk.id + ':' + d.side; (faces[key] = faces[key] || { r: pk.r, side: d.side, list: [] }).list.push({ d, u: w.mrkU(pk.r, d.x, d.y) });
  });
  const boxes = D().devices.filter(d => d.type === 'junction');
  let tn = 0;
  Object.values(faces).forEach(F => {
    F.list.sort((a, b) => a.u - b.u);
    const groups = []; F.list.forEach(it => { const g = groups[groups.length - 1]; if (g && it.u - g[g.length - 1].u <= 600) g.push(it); else groups.push([it]); });
    groups.forEach(g => {
      if (g.every(it => it.d.h >= SPINE)) return;                    // already on the spine (shutters, cameras)
      const u = Math.round(g.reduce((s, it) => s + it.u, 0) / g.length);
      const wi = w.wallInfo(F.r), a = wi.seg[0], x = wi.horiz ? F.r.x0 + u : a[0], y = wi.horiz ? a[1] : F.r.y0 + u;
      const near = boxes.find(b => b.side === F.side && w.hwPickPlan(LVL, b.x, b.y, 200) && w.hwPickPlan(LVL, b.x, b.y, 200).id === F.r.id && Math.hypot(b.x - x, b.y - y) <= 800);
      if (near) return;                                              // the portal box is this column's T
      D().devices.push({ type: 'junction', jbShape: 'circle', jbSize: 80, level: LVL, x: Math.round(x), y: Math.round(y), h: SPINE, side: F.side,
        layer: armL, ref: 'GT' + (++tn), note: 'v2: gerinc T-csomópont — ' + g.length + ' végpont: ' + g.map(it => it.d.ref).join(', ') });
    });
  });
  w.ensureIds(D());

  save(OUT, 'CLA teszt v2');
  const added = Object.keys(N).length;
  console.log(`v2: +${added} endpoints · +${tn} spine T-boxes · ${D().devices.length} devices · ${D().circuits.length} circuits`);
  console.log(JSON.stringify(report(S), null, 1));
};
