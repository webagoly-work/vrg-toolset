// plan.js — the Erősáram baseline: drops, service points, lamp→switch, circuits, cable routes, boxes, conduit legs
'use strict';
const geom = require('./geom'), R = require('./rules'), NW = require('./network');

const isMains = e => e.role === 'sys:MAINS';
const W = { trunk: R.LEVEL.trunk, dist: R.LEVEL.dist };

function plan(G, E, PT, cfg, allowed) {
  const warn = [], D = G.D;
  const hw = D.devices.filter(d => d.level === G.level);
  const board = hw.find(d => d.type === 'board'), meter = hw.find(d => d.type === 'meter');
  const spDevs = hw.filter(d => d.type === 'rbx' || d.type === 'base');

  // ---- 0. shutter switches: one per motor, on the window's room face, 200 beyond the window edge, 1100 ----
  const M = E.filter(isMains);
  if (cfg.shutterSwitch) M.filter(e => e.code === 'SHU').forEach(e => {
    const win = D.openings.find(o => o.type === 'window' && Math.hypot(o.x - e.x, o.y - e.y) < 400); if (!win) return;
    const w = G.walls.find(w => geom.inRect(win.x, win.y, w, 30)), along = w.axis === 'x' ? win.x : win.y, half = (win.w || 1200) / 2;
    const rid = geom.roomsAround(G, win.x, win.y)[0], f0 = geom.nearestFace(G, win.x, win.y, rid);
    const f = f0.face, room = G.rooms.find(r => r.id === rid);
    // the side with more face left beyond the window edge
    const okU = u => (allowed[f.wall] || []).some(([a, b]) => u >= a - 300 && u <= b + 300) && u > f.lo + 100 && u < f.hi - 100;
    const roomy = (f.hi - (along + half)) >= ((along - half) - f.lo) ? 1 : -1, up = along + (half + 200), dn = along - (half + 200);
    const side = okU(up) && !okU(dn) ? 1 : okU(dn) && !okU(up) ? -1 : roomy, u = along + side * (half + 200);
    const sw = { id: 'SW-' + e.id, dev: null, role: 'sys:MAINS', code: 'SWI', v: 'shu', ref: 'R-' + (e.ref || e.id), room: rid, face: f, u, onWall: true,
      x: f.horiz ? u : f.fix, y: f.horiz ? f.fix : u, h: 1100, h0: null, hRule: 'redőnykapcsoló 1100 (új)', isNew: true, shutterFor: e.id, ctx: { room: rid } };
    E.push(sw); M.push(sw); e.shutterSwitch = sw.id; });

  // ---- 1. drop groups (wall endpoints within MERGE on one face) ----
  const drops = [];
  M.filter(e => e.onWall && e.face && !e.floorGroup).forEach(e => {
    const room = G.rooms.find(r => r.id === e.room), s = e.face.uToS(e.u);
    let g = drops.find(d => d.room === e.room && d.face === e.face && Math.abs(d.u - e.u) <= NW.MERGE);
    if (!g) { g = { key: 'drop:' + drops.length, room: e.room, face: e.face, u: e.u, s, members: [] }; drops.push(g); }
    g.members.push(e); e.drop = g.key; });
  drops.forEach(g => { g.u = g.members.reduce((a, e) => a + e.u, 0) / g.members.length; g.s = g.face.uToS(g.u); });

  // ---- 2. service points and their face anchors ----
  const SP = [];
  PT.forEach(p => SP.push({ id: p.id, type: 'portal', portal: p, faces: p.faces.map(f => {
    const u = Math.max(f.face.lo + 50, Math.min(f.face.hi - 50, p.c + p.latch * (p.half + 150)));
    return { room: f.room, face: f.face, u, key: `sp:${p.id}:${f.room}` }; }) }));
  spDevs.forEach(d => SP.push({ id: d.id, type: d.type, dev: d, faces: geom.roomsAround(G, d.x, d.y).map(rid => {
    const nf = geom.nearestFace(G, d.x, d.y, rid); return { room: rid, face: nf.face, u: nf.u, key: `sp:${d.id}:${rid}` }; }) }));
  const bf = geom.nearestFace(G, board.x, board.y);
  const anchors = [{ key: 'board', room: bf.face.room, s: bf.face.uToS(bf.u) }];
  SP.forEach(sp => sp.faces.forEach(f => anchors.push({ key: f.key, room: f.room, s: f.face.uToS(f.u) })));
  drops.forEach(d => anchors.push({ key: d.key, room: d.room, s: d.s }));

  (cfg.floorLinks || []).forEach((fl, k) => { const nf = geom.nearestFace(G, fl.a.x, fl.a.y, fl.a.room); anchors.push({ key: 'fl:' + k, room: fl.a.room, s: nf.face.uToS(nf.u) }); });
  NW.ceilAnchors(G, cfg, 'cl', anchors);
  (cfg.prepared || []).forEach(p => p.points.forEach((q, k) => { const nf = geom.nearestFace(G, q.x, q.y, q.room); anchors.push({ key: `pp:${p.id}:${k}`, room: q.room, s: nf.face.uToS(nf.u) }); }));
  const net = NW.build(G, allowed, anchors), g = net.g, zone = NW.zones(G, net);
  const node = key => (net.byKey[key] || [])[0];
  // ceiling crossings (D07): the trunk may use them, the distribution never; a pull box at each end
  const overEnds = NW.ceilLinks(G, cfg, 'cl', net, W.trunk);
  // crossings at service points (only there may a wall be crossed)
  SP.forEach(sp => { const ns = sp.faces.map(f => node(f.key)).filter(i => i != null);
    for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) g.link(ns[a], ns[b], Math.hypot(g.N[ns[a]].x - g.N[ns[b]].x, g.N[ns[a]].y - g.N[ns[b]].y), 'cross'); });
  (cfg.floorLinks || []).forEach((fl, k) => { const a = node('fl:' + k), b = node(`sp:${fl.b.sp}:${fl.b.room}`); if (a == null || b == null) return;
    g.link(a, b, 2 * W.dist + Math.abs(g.N[a].x - g.N[b].x) + Math.abs(g.N[a].y - g.N[b].y), 'floor'); });
  const spOfNode = {}; SP.forEach(sp => sp.faces.forEach(f => { const i = node(f.key); if (i != null) spOfNode[i] = sp.id; }));
  const inZone = z => i => zone[g.N[i].room] === z;
  const noOver = e => e.kind !== 'over';
  const P = (a, b, opt = {}) => { const ed = opt.edge, r = g.run(a, Object.assign({}, opt, { edge: e => noOver(e) && (!ed || ed(e)) }));
    return isFinite(r.dist[b]) ? { len: r.dist[b], nodes: g.path(r.prev, b) } : null; };

  // ---- 3. every drop → its service point (shortest along the room, no crossing) ----
  drops.forEach(d => { const di = node(d.key), z = zone[d.room]; let best = null;
    SP.forEach(sp => sp.faces.filter(f => zone[f.room] === z).forEach(f => { const si = node(f.key); if (si == null) return;
      const r = g.run(si, { ok: inZone(z), edge: noOver }); if (isFinite(r.dist[di]) && (!best || r.dist[di] < best.len)) best = { sp: sp.id, face: f, len: r.dist[di] }; }));
    if (!best) warn.push({ sev: 'err', msg: `${d.members.map(e => e.id).join('+')}: nincs engedélyezett falszakasz a szervizpontig (${d.room})` });
    d.sp = best && best.sp; d.spFace = best && best.face; d.spLen = best && best.len; });

  // ---- 4. lamp → switch (explicit ctl, wet rooms from the dry face, nearest, two-way pairs) ----
  const L = inferLamps(G, M, cfg, warn);

  // ---- 5. circuits ----
  const C = circuits(D, M, L, cfg, warn);

  // ---- 6. trunk channels: Elosztó → each used service point, avoiding other service points ----
  const used = new Set();
  const loads = new Map();                                            // dist edge key → [{circ, cable, kind}]
  const ek = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  const addLoad = (nodes, cab) => { for (let k = 0; k < nodes.length - 1; k++) { const key = ek(nodes[k], nodes[k + 1]);
    (loads.get(key) || loads.set(key, []).get(key)).push(cab); } };
  const channel = {};                                                  // sp id → {nodes, len, cables[]} = its path on the trunk tree
  const feedAt = {};                                                   // circuit → the service-point nodes its distribution starts from
  // ONE tree from the Elosztó: every service point costs 3 m to pass, so a path that goes round another service point
  // wins whenever it exists (user rule); marked walls only, unless a service point is unreachable without unmarked ones
  const penAll = i => spOfNode[i] ? 3000 : 0;
  // floor links serve the distribution only (W01) — the trunk never dives under the floor
  const T1 = g.run(node('board'), { penalty: penAll, edge: e => e.kind !== 'soft' && e.kind !== 'floor' }), T2 = g.run(node('board'), { penalty: penAll, edge: e => e.kind !== 'floor' });
  const chanTo = spId => { if (channel[spId]) return channel[spId];
    const sp = SP.find(s => s.id === spId), targets = sp.faces.map(f => node(f.key)).filter(i => i != null);
    const T = targets.some(i => isFinite(T1.dist[i])) ? T1 : T2;
    let t = targets[0]; targets.forEach(i => { if (T.dist[i] < T.dist[t]) t = i; });
    const nodes = g.path(T.prev, t), passes = [...new Set(nodes.map(i => spOfNode[i]).filter(s => s && s !== spId))];
    return (channel[spId] = { sp: spId, nodes, len: T.dist[t], cables: [], passes, soft: T === T2 }); };

  // ---- 7. cable routes per circuit ----
  const dropOf = e => drops.find(d => d.key === e.drop);
  const vlegs = [];       // vertical drop legs: {drop, list:[{e, cables[]}]}
  const ceil = [];        // ceiling legs: {from:{node|x,y,h}, to lamp, cable}
  const special = [];     // floor (island), meter feed
  const dropCab = {};     // drop key → e.id → [{c, circ, kind}]
  const addDrop = (d, e, cab) => { ((dropCab[d.key] = dropCab[d.key] || {})[e.id] = dropCab[d.key][e.id] || []).push(cab); };

  C.list.forEach(c => {
    // which drops this circuit FEEDS (switch boxes for lighting, the device drops otherwise)
    const fed = new Map();                                             // drop key → drop
    c.members.forEach(e => {
      if (c.kind === 'light') {
        if (e.code === 'SWI' && e.drop) fed.set(e.drop, dropOf(e));
        if (e.code === 'LMP' && !L.ctlOf[e.id] && e.drop) fed.set(e.drop, dropOf(e));       // switchless wall lamp
        if (e.code === 'SHU') return;                                                        // reached from its switch box
      } else if (e.drop) fed.set(e.drop, dropOf(e)); });
    // group by service point and route: home run in the SP's channel, then along the room from the SP face
    const bySp = {}; fed.forEach(d => { if (!d.sp) return; (bySp[d.sp] = bySp[d.sp] || []).push(d); });
    Object.entries(bySp).forEach(([spId, ds]) => {
      chanTo(spId).cables.push({ c: c.cable, circ: c.ref, kind: 'feed' }); used.add(spId);
      ds.forEach(d => { const p = P(node(d.spFace.key), node(d.key), { ok: inZone(zone[d.room]) }); if (p) addLoad(p.nodes, { c: c.cable, circ: c.ref, kind: 'feed', key: c.ref + '@' + spId });
        (feedAt[c.ref] = feedAt[c.ref] || new Set()).add(node(d.spFace.key)); });
    });
    // switchless ceiling lamps hang directly off their service point
    c.members.filter(e => c.kind === 'light' && e.code === 'LMP' && !e.onWall && !L.ctlOf[e.id]).forEach(e => {
      const sp = nearestSpFace(G, SP, e, zone); if (!sp) return; chanTo(sp.sp.id).cables.push({ c: c.cable, circ: c.ref, kind: 'feed' }); used.add(sp.sp.id);
      ceil.push({ fromKey: sp.face.key, lamps: [e], cable: 'NYM3x15', circ: c.ref }); });
    // island members: home run to the island's service point, then through the floor
    c.members.filter(e => e.floorGroup && !(e.code === 'LMP' && L.ctlOf[e.id])).forEach(e => {
      const grp = (cfg.floorGroups || []).find(g => g.name === e.floorGroup), spId = grp.sp; chanTo(spId).cables.push({ c: c.cable, circ: c.ref, kind: 'feed' }); used.add(spId);
      special.push({ kind: 'floor', group: grp.name, e, cable: c.cable, circ: c.ref }); });
    // vertical legs: device cables inside each fed drop
    c.members.filter(e => e.drop).forEach(e => {
      const d = dropOf(e);
      if (c.kind === 'light' && e.code === 'SWI') addDrop(d, e, { c: R.SWITCH_LEG[1], circ: c.ref, kind: 'switch' });   // re-sized below by the plate's cores
      else if (c.kind === 'light' && e.code === 'LMP') { if (!L.ctlOf[e.id]) addDrop(d, e, { c: 'NYM3x15', circ: c.ref, kind: 'lamp' }); }
      else if (c.kind === 'light' && e.code === 'SHU') { /* below */ }
      else addDrop(d, e, { c: c.cable, circ: c.ref, kind: 'device' }); });
  });

  // switch plates: cores per box → one cable from the box to the plate
  drops.forEach(d => { const sws = d.members.filter(e => e.code === 'SWI'); if (!sws.length) return;
    let cores = 2;                                                                    // L + PE
    const rc = s => s.v === 'shu' ? 2 : ({ single: 1, double: 2, end: 2, middle: 4 })[L.role[s.id]] || 1;
    sws.forEach(s => { cores += rc(s); });
    const byCores = n => n <= 3 ? 'NYM3x15' : n === 4 ? 'NYM4x15' : 'NYM5x15', circ = (C.byMember[sws[0].id] || {}).ref || '?';
    if (cores <= 5) sws.forEach((s, k) => { if (dropCab[d.key] && dropCab[d.key][s.id]) dropCab[d.key][s.id] = k === 0 ? [{ c: byCores(cores), circ, kind: 'switch', cores }] : []; });
    else sws.forEach(s => { const n = 2 + rc(s); if (dropCab[d.key] && dropCab[d.key][s.id]) dropCab[d.key][s.id] = [{ c: byCores(n), circ: (C.byMember[s.id] || {}).ref || circ, kind: 'switch', cores: n }]; });
    d.plate = { n: sws.length, cores, cable: cores <= 5 ? byCores(cores) : sws.length + ' kábel' }; });

  // lamp legs from the switch box (the user rule: lamp + switch meet in the switch's leállás box)
  L.units.forEach(u => {
    const head = M.find(e => e.id === u.switches[0]), hd = head && dropOf(head); if (!hd) return;
    const circ = (C.byMember[head.id] || {}).ref;
    // two-way: the traveller cable between the two switch boxes
    u.switches.slice(1).forEach((id, k) => { const pid = u.switches[k], a = M.find(e => e.id === pid), o = M.find(e => e.id === id), ad = a && dropOf(a), od = o && dropOf(o);
      if (!ad || !od || od === ad) return;
      const p = P(node(ad.key), node(od.key)); if (p) { addLoad(p.nodes, { c: 'NYM4x15', circ, kind: 'trav', key: 'trav:' + pid + '-' + id }); markCross(p.nodes); }
      else warn.push({ sev: 'warn', msg: `váltó-összekötés nem vezethető falon: ${a.ref} → ${o.ref}` }); });
    const wallL = u.lamps.map(id => M.find(e => e.id === id)).filter(e => e && e.onWall), ceilL = u.lamps.map(id => M.find(e => e.id === id)).filter(e => e && !e.onWall);
    wallL.forEach(e => { if (e.floorGroup) { special.push({ kind: 'floor', group: e.floorGroup, e, cable: 'NYM3x15', circ, lamp: true }); return; }
      const d = dropOf(e); if (d !== hd) { const p = P(node(hd.key), node(d.key)); if (p) { addLoad(p.nodes, { c: 'NYM3x15', circ, kind: 'lamp', key: 'lamp:' + e.id }); markCross(p.nodes); } }
      addDrop(d, e, { c: 'NYM3x15', circ, kind: 'lamp' }); });
    if (ceilL.length) {
      // the riser: from the switch box if the lamps are in its room, else from the nearest node of the lamps' room
      const lr = ceilL[0].room;
      if (zone[lr] === zone[hd.room]) ceil.push({ fromKey: hd.key, lamps: ceilL, cable: 'NYM3x15', circ });
      else { const sp = nearestSpFace(G, SP, ceilL[0], zone), p = sp && P(node(hd.key), node(sp.face.key));
        if (p) { addLoad(p.nodes, { c: 'NYM3x15', circ, kind: 'lamp', key: 'lamp:' + ceilL[0].id }); markCross(p.nodes); }
        ceil.push({ fromKey: sp ? sp.face.key : hd.key, lamps: ceilL, cable: 'NYM3x15', circ }); } }
  });
  // shutters: switch box → motor box (motor cable), motor box → motor
  M.filter(e => e.code === 'SHU' && e.shutterSwitch).forEach(e => {
    const sw = M.find(x => x.id === e.shutterSwitch), sd = dropOf(sw), md = dropOf(e), circ = (C.byMember[e.id] || {}).ref;
    if (sd && md && sd !== md) { const p = P(node(sd.key), node(md.key)); if (p) addLoad(p.nodes, { c: R.SWITCH_LEG.shutter, circ, kind: 'motor', key: 'motor:' + e.id }); }
    if (md) addDrop(md, e, { c: R.SWITCH_LEG.shutter, circ, kind: 'motor' }); });
  function markCross(nodes) { nodes.forEach(i => { if (spOfNode[i]) used.add(spOfNode[i]); }); }

  // ---- 8. boxes ----
  const boxes = []; const boxAt = {};                                   // node index → box
  const mk = (b) => { b.id = 'X' + (boxes.length + 1); boxes.push(b); return b; };
  // the distribution subgraph actually used
  const usedEdges = [...loads.keys()].map(k => k.split('-').map(Number));
  const deg = {}; usedEdges.forEach(([a, b]) => { deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; });
  // service point boxes (MAINS part): RBX = the RBX itself; BASE / portal = a 2-gang box at 2450 on each used face
  SP.forEach(sp => sp.faces.forEach(f => { const i = node(f.key); if (i == null) return;
    const touched = deg[i] || Object.values(channel).some(ch => ch.sp === sp.id && ch.nodes[ch.nodes.length - 1] === i) ||
      ceil.some(c => c.fromKey === f.key);
    if (!touched) return;
    boxAt[i] = mk({ kind: sp.type === 'rbx' ? 'rbx' : 'sp', sp: sp.id, room: f.room, x: g.N[i].x, y: g.N[i].y, h: sp.type === 'rbx' ? 2150 : W.dist, node: i,
      size: sp.type === 'rbx' ? (sp.dev.rb || 'RB-M') : 'gang2', n: sp.type === 'rbx' ? `${sp.dev.rb || 'RB'} — ${(sp.dev.ref || sp.id).split(/ to | - /)[0]}` :
        sp.type === 'base' ? 'BASE melletti erősáramú kötődoboz' : `Portál ${sp.id} — L4 erősáramú doboz` }); }));
  drops.forEach(d => { const i = node(d.key); if (!d.sp || boxAt[i]) { if (boxAt[i]) boxAt[i].drop = d.key; return; }
    boxAt[i] = mk({ kind: 'drop', room: d.room, x: g.N[i].x, y: g.N[i].y, h: W.dist, node: i, size: 'gang2', drop: d.key,
      n: 'Leállás — ' + d.members.map(e => e.ref || e.id).join(' + ') }); });
  // corners the horizontal paths pass (distribution and trunk)
  const cornerNodes = new Set();
  usedEdges.forEach(([a, b]) => [a, b].forEach(i => { if (g.N[i].corner) cornerNodes.add(i); }));
  Object.values(channel).forEach(ch => ch.nodes.forEach(i => { if (g.N[i].corner) cornerNodes.add(i); }));
  cornerNodes.forEach(i => { if (boxAt[i]) return; boxAt[i] = mk({ kind: 'corner', room: g.N[i].room, x: g.N[i].x, y: g.N[i].y, h: W.dist, node: i, size: 'corner', n: 'Sarok-tartalékdoboz' }); });
  // far ends of the horizontal paths: a provision box 180 beyond the last box, along the free direction
  Object.entries(deg).filter(([, n]) => n === 1).forEach(([k]) => { const i = +k, nb = g.adj[i].find(e => loads.has(ek(i, e.to)));
    const other = nb ? g.N[nb.to] : null, room = G.rooms.find(r => r.id === g.N[i].room); if (!other || !room) return;
    const fwd = ((other.s - g.N[i].s + room.perim) % room.perim) < room.perim / 2 ? -1 : 1, s2 = g.N[i].s + fwd * 180, pt = NW.sToPt(room, s2);
    mk({ kind: 'end', room: room.id, x: pt.x, y: pt.y, h: W.dist, node: null, size: 'end', n: 'Pályavég-tartalékdoboz', near: boxAt[i] && boxAt[i].id }); });

  // ---- 9. conduit legs ----
  const legs = [], softWalls = new Set();
  const polyOf = pts => { const out = []; pts.forEach((i, k) => { const e = k ? g.adj[pts[k - 1]].find(x => x.to === i) : null;
    if (e && e.kind === 'floor') { const a = g.N[pts[k - 1]]; out.push([a.x, a.y, 0], [g.N[i].x, g.N[i].y, 0]); } out.push([g.N[i].x, g.N[i].y, W.dist]); }); return out; };
  const wallsOf = pts => [...new Set(pts.slice(1).map((p, k) => { const e = g.adj[pts[k]].find(x => x.to === p); if (!e || e.kind !== 'soft') return null;
    const a = g.N[pts[k]], b = g.N[p], rm = G.rooms.find(r => r.id === a.room); return rm ? NW.sToPt(rm, (a.s + (b.s > a.s ? b.s : b.s + rm.perim)) / 2).face.wall : null; }).filter(Boolean))];
  const leg = (o) => {
    let groups;
    if (o.kind === 'trunk') { const flat = o.cables.flatMap(c => Array.from({ length: c.n }, () => ({ c: c.c, n: 1, circ: c.circ }))), per = cfg.maxCablesPerPipe || 2;
      groups = []; for (let k = 0; k < flat.length; k += per) groups.push(countCables(flat.slice(k, k + per))); }
    else { const by = {}; o.cables.forEach(c => c.circ.forEach(ci => { (by[ci] = by[ci] || []).push({ c: c.c, n: c.circ.length > 1 ? 1 : c.n, circ: [ci] }); }));
      groups = [];
      Object.values(by).forEach(cs => { const flat = cs.flatMap(c => Array.from({ length: c.n }, () => ({ c: c.c, n: 1, circ: c.circ })));
        const per = cfg.maxCablesPerPipe || 2; for (let k = 0; k < flat.length; k += per) groups.push(countCables(flat.slice(k, k + per))); }); }
    o.pipes = groups.map(cs => { const sz = R.sizeConduit(cs, o.len); return { circ: [...new Set(cs.flatMap(c => c.circ))], cables: cs, cond: sz.size, fill: sz.fill, why: sz.why, over: !!sz.over }; });
    const cnt = {}; o.pipes.forEach(p => cnt[p.cond] = (cnt[p.cond] || 0) + 1);
    o.cond = Object.entries(cnt).map(([k, n]) => (n > 1 ? n + '×' : '') + k).join(' + ');
    o.id = 'C' + (legs.length + 1); legs.push(o); };
  // distribution (user rule 2026-10-12: a passing pipe goes BY a box, not into it). Per circuit, its pipe runs from
  // event to event: where its feed starts, a box that serves it (a device of it, a ceiling riser of it), where it
  // branches or ends, where its cable set changes — and, after more than maxBends corners, into that corner's box.
  // Runs of different circuits on the same node sequence form one leg (one pipe per circuit inside it).
  const edgeW = (a, b) => g.adj[a].find(e => e.to === b).w;
  const isFloor = pts => pts.some((p, k) => k && g.adj[pts[k - 1]].some(e => e.to === p && e.kind === 'floor'));
  const circE = {};
  loads.forEach((cs, k) => { const [a, b] = k.split('-').map(Number); cs.forEach(c => { const o = circE[c.circ] || (circE[c.circ] = { adj: {}, keys: new Map() });
    if (!o.keys.has(k)) { o.keys.set(k, new Set()); (o.adj[a] = o.adj[a] || []).push(b); (o.adj[b] = o.adj[b] || []).push(a); }
    o.keys.get(k).add((c.key || c.circ) + '|' + c.c + '|' + (c.kind || '')); }); });
  const serves = (v, circ) => { const b = boxAt[v]; if (!b) return false;
    if ((feedAt[circ] || new Set()).has(v)) return true;
    if (b.drop && Object.values(dropCab[b.drop] || {}).some(cs => cs.some(c => c.circ === circ))) return true;
    return ceil.some(c => c.circ === circ && node(c.fromKey) === v); };
  const same = (A, B) => A && B && A.size === B.size && [...A].every(x => B.has(x));
  const druns = [];
  Object.entries(circE).forEach(([circ, o]) => {
    const deg = v => (o.adj[v] || []).length, seenE = new Set();
    const stack = Object.keys(o.adj).map(Number).filter(v => deg(v) !== 2 || serves(v, circ));
    while (stack.length) { const st = stack.pop();
      (o.adj[st] || []).forEach(n0 => { if (seenE.has(ek(st, n0))) return;
        const pts = [st]; let prev = st, cur = n0, nb = 0; seenE.add(ek(st, cur));
        for (;;) { if (deg(cur) !== 2 || serves(cur, circ)) break;
          const nx = o.adj[cur].find(x => x !== prev);
          if (!same(o.keys.get(ek(prev, cur)), o.keys.get(ek(cur, nx)))) break;
          if (g.N[cur].corner && boxAt[cur] && ++nb > R.FILL.maxBends) break;
          if (seenE.has(ek(cur, nx))) break;
          pts.push(cur); seenE.add(ek(cur, nx)); prev = cur; cur = nx; }
        pts.push(cur); druns.push({ circ, pts }); stack.push(cur); }); } });
  const dgroups = new Map(); druns.forEach(r => { const f = r.pts.join('>'), b = [...r.pts].reverse().join('>'), key = dgroups.has(b) ? b : f;
    (dgroups.get(key) || dgroups.set(key, []).get(key)).push(dgroups.has(b) && key === b ? { circ: r.circ, pts: [...r.pts].reverse() } : r); });
  dgroups.forEach(rs => { const pts = rs[0].pts, z = pts[pts.length - 1];
    let len = 0, bends = 0; pts.forEach((p, k) => { if (k) len += edgeW(pts[k - 1], p); if (k && k < pts.length - 1 && g.N[p].corner) bends++; });
    const cables = mergeCables(rs.flatMap(r => loads.get(ek(pts[0], pts[1])).filter(c => c.circ === r.circ)));
    const crosses = pts.some((p, k) => k && g.adj[pts[k - 1]].some(e => e.to === p && e.kind === 'cross'));
    const soft = pts.some((p, k) => k && g.adj[pts[k - 1]].some(e => e.to === p && e.kind === 'soft'));
    leg({ kind: 'dist', from: boxAt[pts[0]] ? boxAt[pts[0]].id : '—', to: boxAt[z] ? boxAt[z].id : '—', len: Math.round(len), bends, h: W.dist,
      poly: polyOf(pts), pts, cables, crosses, soft, floor: isFloor(pts) });
    if (soft) softWalls.add(pts.map(i => g.N[i].room).find(Boolean) + ' ' + wallsOf(pts).join('/'));
    [pts[0], z].forEach(v => { if (!boxAt[v]) warn.push({ sev: 'warn', msg: `leágazó-cső vége doboz nélkül a ${g.N[v].room} ${Math.round(g.N[v].x)},${Math.round(g.N[v].y)} pontnál` }); }); });
  // for the sheets: the stretches between boxes (as before), each with every pipe that runs along it
  const legsOnEdge = new Map(); legs.filter(l => l.kind === 'dist').forEach(l => l.pts.forEach((p, k) => { if (k) { const key = ek(l.pts[k - 1], p); (legsOnEdge.get(key) || legsOnEdge.set(key, []).get(key)).push(l); } }));
  const spans = [], seenS = new Set();
  Object.keys(boxAt).map(Number).forEach(start => g.adj[start].forEach(e0 => {
    if (!loads.has(ek(start, e0.to)) || seenS.has(ek(start, e0.to))) return;
    const pts = [start]; let prev = start, cur = e0.to; seenS.add(ek(start, cur));
    while (!boxAt[cur]) { const nx = g.adj[cur].find(e => e.to !== prev && loads.has(ek(cur, e.to)) && !seenS.has(ek(cur, e.to)));
      if (!nx) break; pts.push(cur); seenS.add(ek(cur, nx.to)); prev = cur; cur = nx.to; }
    pts.push(cur);
    const ls = legsOnEdge.get(ek(pts[0], pts[1])) || [], pipes = ls.flatMap(l => l.pipes.map(p => ({ leg: l.id, circ: p.circ, cond: p.cond })));
    let len = 0; pts.forEach((p, k) => { if (k) len += edgeW(pts[k - 1], p); });
    const cnt = {}; pipes.forEach(p => cnt[p.cond] = (cnt[p.cond] || 0) + 1);
    spans.push({ poly: polyOf(pts), len: Math.round(len), pipes, cond: Object.entries(cnt).map(([k, n]) => (n > 1 ? n + '×' : '') + k).join(' + '),
      soft: ls.some(l => l.soft), floor: isFloor(pts) }); }));
  // trunk channels
  const bTop = (board.z || board.h || 2000);
  // every circuit runs ONE cable along the tree: from the Elosztó out to each service point it serves. A trunk pipe
  // runs box to box; a box is needed wherever the set of circuits changes (a circuit ends at its service point, or
  // splits toward two of them), at an RBX (oversized — the pull point) and after more than maxBends corners.
  const tload = new Map();                                                         // trunk edge → Map(circ → cable)
  Object.values(channel).forEach(ch => ch.cables.forEach(cb => { for (let k = 0; k < ch.nodes.length - 1; k++) {
    const key = ek(ch.nodes[k], ch.nodes[k + 1]); const m = tload.get(key) || new Map(); m.set(cb.circ, cb.c); tload.set(key, m); } }));
  // per circuit: its own subtree; a run of that circuit's cable goes from event to event (the Elosztó, where it ends
  // at a service point, where it splits, an RBX, a pull box). Runs on the same node sequence share pipes (≤ 2 cables).
  const B0 = node('board'), pullAt = {}, circEdges = {};
  tload.forEach((m, key) => m.forEach((c, circ) => (circEdges[circ] = circEdges[circ] || { cable: c, edges: [] }).edges.push(key)));
  const isRbx = v => spOfNode[v] && (SP.find(s => s.id === spOfNode[v]) || {}).type === 'rbx';
  const spBox = v => { if (boxAt[v]) return boxAt[v]; const sid = spOfNode[v], sp = sid && SP.find(s => s.id === sid);
    return (boxAt[v] = mk(sp ? { kind: sp.type === 'rbx' ? 'rbx' : 'sp', sp: sid, room: g.N[v].room, x: g.N[v].x, y: g.N[v].y, h: sp.type === 'rbx' ? 2150 : W.dist, node: v,
        size: sp.type === 'rbx' ? (sp.dev.rb || 'RB-M') : 'gang2', n: sp.type === 'rbx' ? `${sp.dev.rb || 'RB'} — ${sid}` : sp.type === 'base' ? 'BASE melletti erősáramú kötődoboz' : `Portál ${sid} — L4 erősáramú doboz` }
      : { kind: 'tj', room: g.N[v].room, x: g.N[v].x, y: g.N[v].y, h: W.trunk, node: v, size: 'gang2', n: 'Gerinc elágazó doboz' })); };
  const runs = [];
  // both ends of a used ceiling crossing get a pull box: the conduit leaves the wall chase upward into the slab there
  overEnds.forEach((nm, v) => { if (!g.adj[v].some(e => e.kind === 'over' && tload.has(ek(v, e.to)))) return;
    pullAt[v] = mk({ kind: 'pull', room: g.N[v].room, x: g.N[v].x, y: g.N[v].y, h: W.trunk, node: v, size: 'pull', n: 'Gerinc húzódoboz — mennyezeti átvezetés (' + overEnds.get(v) + ')' }); });
  Object.entries(circEdges).forEach(([circ, o]) => {
    const adj = {}; o.edges.forEach(k => { const [p, q] = k.split('-').map(Number); (adj[p] = adj[p] || []).push(q); (adj[q] = adj[q] || []).push(p); });
    const ends = new Set(Object.values(channel).filter(ch => ch.cables.some(c => c.circ === circ)).map(ch => ch.nodes[ch.nodes.length - 1]));
    const event = v => v === B0 || ends.has(v) || (adj[v] || []).length >= 3 || isRbx(v) || pullAt[v];
    const seen = new Set(), stack = [B0];
    while (stack.length) { const st = stack.pop();
      (adj[st] || []).forEach(n0 => { if (seen.has(ek(st, n0))) return;
        const pts = [st]; let prev = st, cur = n0, nb = 0; seen.add(ek(st, cur));
        while (!event(cur)) { if (g.N[cur].corner && ++nb > R.FILL.maxBends) { pullAt[cur] = pullAt[cur] || mk({ kind: 'pull', room: g.N[cur].room, x: g.N[cur].x, y: g.N[cur].y, h: W.trunk, node: cur, size: 'pull', n: 'Gerinc húzódoboz (közös)' }); break; }
          const nx = adj[cur].find(x => x !== prev && !seen.has(ek(cur, x))); if (nx == null) break;
          pts.push(cur); seen.add(ek(cur, nx)); prev = cur; cur = nx; }
        pts.push(cur); runs.push({ circ, cable: o.cable, pts }); stack.push(cur); }); } });
  // group identical runs → legs; boxes at every run end that has none
  const groups = new Map(); runs.forEach(r => { const key = r.pts.join('>'); (groups.get(key) || groups.set(key, []).get(key)).push(r); });
  groups.forEach(rs => { const pts = rs[0].pts, a0 = pts[0], z = pts[pts.length - 1];
    const toBox = pullAt[z] || spBox(z), fromBox = a0 === B0 ? null : (pullAt[a0] || spBox(a0));
    let flat = 0, nb = 0; pts.forEach((i, k) => { if (k) flat += g.adj[pts[k - 1]].find(e => e.to === i).w; if (k && k < pts.length - 1 && g.N[i].corner) nb++; });
    const vert = (a0 === B0 ? Math.abs(W.trunk - bTop) : Math.abs(W.trunk - fromBox.h)) + Math.abs(W.trunk - toBox.h);
    const chs = Object.values(channel).filter(c => c.nodes.includes(z) && c.nodes.includes(a0)).map(c => c.sp);
    const over = pts.some((i, k) => k && g.adj[pts[k - 1]].some(e => e.to === i && e.kind === 'over'));
    leg({ kind: 'trunk', from: a0 === B0 ? 'Elosztó' : fromBox.id, to: toBox.id, sp: chs.join(','), len: Math.round(flat + vert), bends: nb + 2, h: W.trunk, over,
      poly: (a0 === B0 ? [[board.x, board.y, bTop]] : [[fromBox.x, fromBox.y, fromBox.h]]).concat(NW.polyAt(g, pts, W.trunk, cfg.ceiling)).concat([[toBox.x, toBox.y, toBox.h]]),
      cables: rs.map(r => ({ c: r.cable, n: 1, circ: [r.circ] })), passes: [] }); });
  Object.values(channel).forEach(ch => { if (ch.soft && ch.cables.length) warn.push({ sev: 'warn', msg: `${ch.sp}: a gerinc csak jelöletlen falon éri el` }); });
  // vertical drops: box → devices, one chain down and one chain up (a shutter motor sits above the 2450 box); one flush
  // box each; cables shrink as devices are passed
  drops.forEach(d => { const box = boxAt[node(d.key)]; if (!box) return;
    const devs = d.members.filter(e => (dropCab[d.key] || {})[e.id] && dropCab[d.key][e.id].length);
    [devs.filter(e => e.h <= W.dist).sort((a, b) => b.h - a.h), devs.filter(e => e.h > W.dist).sort((a, b) => a.h - b.h)].forEach(chain => {
      let from = box.id, fromH = W.dist;
      chain.forEach((e, k) => { const rest = chain.slice(k).flatMap(x => dropCab[d.key][x.id]);
        leg({ kind: 'drop', from, to: e.id, len: Math.round(Math.abs(fromH - e.h)), bends: 0, h: null, poly: [[box.x, box.y, fromH], [box.x, box.y, e.h]], cables: mergeCables(rest), dev: e.id });
        from = e.id; fromH = e.h; }); }); });
  // ceiling: box → riser → lamps (nearest-neighbour chain)
  ceil.forEach(c => { const i = node(c.fromKey), b = boxAt[i]; if (!b) return; let px = b.x, py = b.y, from = b.id, first = true;
    const rest = [...c.lamps];
    while (rest.length) { rest.sort((a, z) => Math.hypot(a.x - px, a.y - py) - Math.hypot(z.x - px, z.y - py)); const e = rest.shift();
      const flat = Math.hypot(e.x - px, e.y - py), len = Math.round(flat + (first ? (cfg.ceiling - W.dist) : 0));
      leg({ kind: 'ceil', from, to: e.id, len, bends: first ? 2 : 0, h: cfg.ceiling, poly: first ? [[px, py, W.dist], [px, py, cfg.ceiling], [e.x, e.y, cfg.ceiling]] : [[px, py, cfg.ceiling], [e.x, e.y, cfg.ceiling]],
        cables: [{ c: c.cable, n: 1, circ: [c.circ] }], dev: e.id });
      px = e.x; py = e.y; from = e.id; first = false; } });
  // floor groups (the island, the stair foot): SP box → down → across the floor → junction box → devices
  (cfg.floorGroups || []).forEach(grp => { const items = special.filter(x => x.kind === 'floor' && x.group === grp.name); if (!items.length) return;
    const sp = SP.find(x => x.id === grp.sp), f = sp.faces.find(x => x.room === (grp.room || items[0].e.room)) || sp.faces[0], ni = node(f.key);
    const b = boxAt[ni] || (boxAt[ni] = mk({ kind: sp.type === 'rbx' ? 'rbx' : 'sp', sp: sp.id, room: f.room, x: g.N[ni].x, y: g.N[ni].y, h: sp.type === 'rbx' ? 2150 : W.dist, node: ni, size: sp.type === 'rbx' ? 'RB-M' : 'gang2', n: sp.id }));
    let at = grp.box; if (grp.object) { const obj = D.objects.find(o => o.id === grp.object); at = { x: obj.x - obj.w / 2 + 150, y: obj.y, h: grp.box.h }; }
    const ib = mk({ kind: 'island', room: items[0].e.room, x: at.x, y: at.y, h: at.h, size: 'gang2', n: grp.box.n });
    const flat = Math.abs(ib.x - b.x) + Math.abs(ib.y - b.y);
    leg({ kind: 'floor', from: b.id, to: ib.id, len: Math.round(b.h + flat + ib.h), bends: 4, h: 0, group: grp.name,
      poly: [[b.x, b.y, b.h], [b.x, b.y, 0], [ib.x, b.y, 0], [ib.x, ib.y, 0], [ib.x, ib.y, ib.h]],
      cables: mergeCables(items.map(x => ({ c: x.cable, circ: x.circ, kind: x.lamp ? 'lamp' : 'feed', key: x.lamp ? 'lamp:' + x.e.id : x.circ }))) });
    items.forEach(x => leg({ kind: 'island', from: ib.id, to: x.e.id, len: Math.round(Math.hypot(x.e.x - ib.x, x.e.y - ib.y) + Math.abs(x.e.h - ib.h)), bends: 1, h: x.e.h,
      poly: [[ib.x, ib.y, ib.h], [x.e.x, x.e.y, x.e.h]], cables: [{ c: x.cable, n: 1, circ: [x.circ] }], dev: x.e.id })); });
  // risers: an empty conduit up to the upper floor from a pull box at the trunk height (W01)
  (cfg.risers || []).forEach(r => { const sp = SP.find(x => x.id === r.sp), f = sp && (sp.faces.find(x => x.room === r.room) || sp.faces[0]); if (!f) return; const i = node(f.key);
    const pb = mk({ kind: 'pull', room: f.room, x: g.N[i].x, y: g.N[i].y, h: W.trunk, node: null, size: 'pull', n: r.n });
    const o = { kind: 'riser', from: pb.id, to: 'emelet', len: Math.round(cfg.ceiling + 300 - W.trunk), bends: 0, h: null, poly: [[pb.x, pb.y, W.trunk], [pb.x, pb.y, cfg.ceiling + 300]], cables: [] };
    o.pipes = [{ circ: ['tartalék'], cables: [{ c: 'SPARE', n: 1, circ: ['tartalék'] }], cond: r.cond || 'M32', fill: 0, why: 'üres tartalék + behúzószál' }];
    o.cond = o.pipes[0].cond; o.id = 'C' + (legs.length + 1); legs.push(o); });
  // main feed: meter → Elosztó
  if (meter && cfg.mainFeed !== false) leg({ kind: 'feed', from: meter.ref || meter.id, to: 'Elosztó', len: Math.round(Math.hypot(meter.x - board.x, meter.y - board.y) + Math.abs(W.trunk - meter.h) + Math.abs(W.trunk - bTop)),
    bends: 3, h: W.trunk, poly: [[meter.x, meter.y, meter.h], [meter.x, meter.y, W.trunk], [board.x, board.y, W.trunk], [board.x, board.y, bTop]],
    cables: [{ c: cfg.mainFeedCable || 'NYM5x10', n: 1, circ: ['fővezeték'] }] });

  // ---- prepared routes (R12): drawn and listed, never counted. Each item: its points share one leállás box; the feed
  // comes along the room faces from the nearest box that already carries its circuit. Kept apart from legs / boxes.
  const prep = (cfg.prepared || []).map(p => {
    const it = { id: p.id, name: p.name, why: p.why, circ: p.circ, points: p.points, legs: [], boxes: [] };
    const di = node(`pp:${p.id}:0`); if (di == null) { warn.push({ sev: 'warn', msg: `${p.id}: az előkészített pont nincs falon` }); return it; }
    const z = zone[g.N[di].room], carries = new Set();
    loads.forEach((cs, k) => { if (cs.some(c => c.circ === p.circ)) k.split('-').map(Number).forEach(i => carries.add(i)); });
    Object.values(channel).forEach(ch => { if (ch.cables.some(c => c.circ === p.circ)) carries.add(ch.nodes[ch.nodes.length - 1]); });
    const r = g.run(di, { ok: inZone(z), edge: noOver });
    const src = boxes.filter(b => b.node != null && carries.has(b.node) && isFinite(r.dist[b.node])).sort((a, b) => r.dist[a.node] - r.dist[b.node])[0];
    const pb = { id: 'XE' + p.id.replace(/\D/g, ''), kind: 'drop', prep: true, room: g.N[di].room, x: g.N[di].x, y: g.N[di].y, h: W.dist, size: 'gang2', n: `Leállás (előkészítés) — ${p.name}` };
    it.boxes.push(pb);
    const pleg = o => { const by = {}; o.cables.forEach(c => (by[c.circ[0]] = by[c.circ[0]] || []).push(c));
      o.pipes = Object.values(by).map(cs => { const sz = R.sizeConduit(cs, o.len); return { circ: [p.circ], cables: cs, cond: sz.size, fill: sz.fill, why: sz.why }; });
      o.cond = o.pipes.map(q => q.cond).join(' + '); o.id = `${p.id}.${it.legs.length + 1}`; o.prep = true; it.legs.push(o); };
    if (src) { const nodes = g.path(r.prev, src.node).reverse(); let bends = 0; for (let k = 1; k < nodes.length - 1; k++) if (g.N[nodes[k]].corner) bends++;
      pleg({ kind: 'dist', from: src.id, to: pb.id, len: Math.round(r.dist[src.node]), bends, h: W.dist, poly: polyOf(nodes), cables: [{ c: 'NYM3x15', n: 1, circ: [p.circ] }] }); }
    else warn.push({ sev: 'warn', msg: `${p.id}: nincs ${p.circ}-et vivő doboz a helyiségben — az előkészítés betáp nélkül` });
    // the points: one chain down from the box (the motor above the switch); a shutter switch and its motor take NYM-J 4×1,5
    const cab = q => q.cable || (q.code === 'SHU' || (q.code === 'SWI' && q.v === 'shu') ? R.SWITCH_LEG.shutter : 'NYM3x15');
    const down = p.points.slice().sort((a, b) => b.h - a.h); let from = pb.id, fromH = W.dist;
    down.forEach((q, k) => { pleg({ kind: 'drop', from, to: q.ref, len: Math.round(Math.abs(fromH - q.h)), bends: 0, h: null, poly: [[pb.x, pb.y, fromH], [pb.x, pb.y, q.h]],
      cables: down.slice(k).map(x => ({ c: cab(x), n: 1, circ: [p.circ] })) }); from = q.ref; fromH = q.h; });
    return it; });

  softWalls.forEach(w => warn.push({ sev: 'warn', msg: `jelöletlen falon is fut leágazó: ${w} — rajzold be a vázlatba, vagy hagyd jóvá` }));
  Object.values(channel).forEach(ch => { const sw = wallsOf(ch.nodes); if (sw.length) warn.push({ sev: 'warn', msg: `${ch.sp} gerinc-csatorna jelöletlen falon: ${sw.join(', ')}` }); });
  // ---- 10. checks ----
  // a box the user already enlarged (cfg.spBoxSize, e.g. B103 150 × 150) takes 12 runs, a 2-gang one 6
  boxes.filter(b => b.kind === 'sp' || b.kind === 'drop').forEach(b => { const n = legs.filter(l => l.from === b.id || l.to === b.id).length;
    const ov = b.kind === 'sp' && ((cfg.spBoxSize || {})[b.sp + ':' + b.room] || (cfg.spBoxSize || {})[b.sp]);
    if (n > (ov ? 12 : 6)) warn.push({ sev: 'warn', msg: `${b.id} (${b.n}${ov ? ', ' + ov + ' × ' + ov : ''}): ${n} cső fut be — ${ov ? 'ennél is' : '2 szerelvényesnél'} nagyobb doboz kell` }); });
  M.filter(e => !C.byMember[e.id]).forEach(e => warn.push({ sev: 'warn', msg: `${e.id} ${e.code} (${e.room}): nincs áramkörben` }));

  return { net, SP, drops, channel, boxes, legs, L, C, warn, used, prep, spans };
}

function nearestSpFace(G, SP, e, zone) {
  let best = null; SP.forEach(sp => sp.faces.filter(f => zone[f.room] === zone[e.room]).forEach(f => {
    const x = f.face.horiz ? f.u : f.face.fix, y = f.face.horiz ? f.face.fix : f.u, d = Math.hypot(x - e.x, y - e.y);
    if (!best || d < best.d) best = { sp, face: f, d }; })); return best;
}
// the cables already split into one pipe: every entry is a real cable, so they are counted, never de-duplicated
// (mergeCables would fold a circuit's feed and its lamp leg — both NYM-J 3×1,5 — into one; fixed 2026-10-12)
function countCables(list) {
  const by = {}; (list || []).forEach(c => { const o = by[c.c] || (by[c.c] = { c: c.c, n: 0, circ: [] }); o.n += c.n || 1; [].concat(c.circ).flat().forEach(x => { if (!o.circ.includes(x)) o.circ.push(x); }); });
  return Object.values(by);
}
// same cable type of the same circuit counted once per route (a circuit's feed passes a box once)
function mergeCables(list) {
  const uniq = new Map(); (list || []).forEach(c => { const k = (c.key || c.circ) + '|' + c.c + '|' + (c.kind || ''); if (!uniq.has(k)) uniq.set(k, c); });
  const by = {}; uniq.forEach(c => { const o = by[c.c] || (by[c.c] = { c: c.c, n: 0, circ: [] }); o.n++; [].concat(c.circ).flat().forEach(x => { if (!o.circ.includes(x)) o.circ.push(x); }); });
  return Object.values(by);
}

// ---- lamp → switch ----------------------------------------------------------------------------------------------------
function inferLamps(G, M, cfg, warn) {
  const lamps = M.filter(e => e.code === 'LMP'), sws = M.filter(e => e.code === 'SWI' && e.v !== 'shu');
  const ctlOf = {}, units = [], twoWay = {}, why = {};
  const unitOf = id => units.find(u => u.switches.includes(id));
  // (0) the user's answers: explicit switching groups (chain[0] = the box the lamps hang from)
  const role = {}, fixed = new Set();
  (cfg.switchGroups || []).forEach(gr => {
    const miss = gr.chain.filter(id => !sws.some(s => s.id === id)); if (miss.length) warn.push({ sev: 'err', msg: `kapcsolócsoport (${gr.why}): ismeretlen kapcsoló ${miss.join(', ')}` });
    const u = { switches: [...gr.chain], lamps: [], mode: gr.mode, explicit: true, why: gr.why }; units.push(u);
    gr.chain.forEach((id, k) => { fixed.add(id);
      role[id] = gr.mode === 'single' ? 'single' : gr.mode === 'double' ? 'double' : (gr.mode === '3way' && k > 0 && k < gr.chain.length - 1) ? 'middle' : 'end';
      if (gr.mode === '2way' || gr.mode === '3way') twoWay[id] = true; });
    gr.lamps.forEach(l => { u.lamps.push(l); ctlOf[l] = u.switches; why[l] = 'válasz — ' + gr.why; }); });
  const assign = (lampId, swId, reason) => { if (ctlOf[lampId]) return; let u = unitOf(swId); if (!u) { u = { switches: [swId], lamps: [] }; units.push(u); }
    u.lamps.push(lampId); ctlOf[lampId] = u.switches; why[lampId] = reason; };
  // (a) explicit ctl from the sketch
  sws.filter(s => !fixed.has(s.id)).forEach(s => (s.dev && s.dev.ctl || []).forEach(l => assign(l, s.id, 'ctl a vázlatból')));
  Object.entries(cfg.ctlPin || {}).forEach(([l, s]) => { delete ctlOf[l]; assign(l, s, 'rögzítve (config)'); });
  // (b) kind 106 = two-way: pair them in one room zone
  const tw = sws.filter(s => s.dev && s.dev.kind === '106' && !fixed.has(s.id));
  for (let i = 0; i + 1 < tw.length; i += 2) { const u = { switches: [tw[i].id, tw[i + 1].id], lamps: [], pair: '106' }; units.push(u); twoWay[tw[i].id] = twoWay[tw[i + 1].id] = true; }
  const busy = new Set(units.flatMap(u => u.switches.length > 1 ? [] : u.switches).filter(id => units.find(u => u.switches.includes(id) && u.lamps.length)));
  const isWet = r => (cfg.wetRooms || []).includes(r), fan = e => /ventil/i.test(e.dev && e.dev.note || '');
  // (c) wet-room lamps (not the fan) → the switch on the dry face of the room's door
  lamps.filter(e => !ctlOf[e.id] && isWet(e.room) && !fan(e)).forEach(e => {
    const cand = sws.filter(s => !s.ctx.bed && s.room !== e.room && s.portal && portalRooms(G, s.portal).includes(e.room));
    const nbr = new Set(G.D.openings.filter(o => o.type === 'door' && geom.roomsAround(G, o.x, o.y).includes(e.room)).flatMap(o => geom.roomsAround(G, o.x, o.y)));
    const near = cand.length ? cand : sws.filter(s => !s.ctx.bed && !isWet(s.room) && nbr.has(s.room) && Math.hypot(s.x - e.x, s.y - e.y) < 3000);
    if (near.length) { near.sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)); assign(e.id, near[0].id, 'vizes helyiség: kapcsoló kívül, az ajtó száraz oldalán'); busy.add(near[0].id); } });
  // (d) the rest: nearest switch unit in the same room zone (bed switches excluded, units with ctl kept as they are)
  const sameZone = (a, b) => a === b || (a === 'R03' && b === 'R03L') || (a === 'R03L' && b === 'R03');
  lamps.filter(e => !ctlOf[e.id]).forEach(e => {
    // switched by an RBX output (the user's answer): no wall switch, whatever stands in the room
    if ((cfg.rbxSwitched || {})[e.id]) { why[e.id] = 'válasz — ' + cfg.rbxSwitched[e.id]; return; }
    // a two-way pair is measured from its LONE member — the one not sharing a box with a simple switch
    const opts = []; units.filter(u => u.pair && !u.explicit).forEach(u => { const ss = u.switches.map(id => sws.find(s => s.id === id));
      const lone = ss.filter(s => !sws.some(o => o !== s && !twoWay[o.id] && Math.hypot(o.x - s.x, o.y - s.y) < 300)); const ref = lone.length ? lone : ss;
      if (ss.some(s => sameZone(s.room, e.room))) opts.push({ id: u.switches[0], d: Math.min(...ref.map(s => Math.hypot(s.x - e.x, s.y - e.y))) + 1, unit: true }); });
    sws.filter(s => !s.ctx.bed && !twoWay[s.id] && !fixed.has(s.id) && sameZone(s.room, e.room) && !busy.has(s.id))
      .forEach(s => { const mates = sws.filter(o => o !== s && Math.hypot(o.x - s.x, o.y - s.y) < 300).length, mine = (unitOf(s.id) || { lamps: [] }).lamps.length;
        opts.push({ id: s.id, d: Math.hypot(s.x - e.x, s.y - e.y) + (busy.has(s.id) ? 1 : 0) + (mates ? 900 * mine : 0) }); });
    if (!opts.length) { warn.push({ sev: 'info', msg: `${e.id} ${e.ref}: nincs kapcsoló a helyiségben — a szervizpontról kapcsolt (RBX kimenet)` }); return; }
    opts.sort((a, b) => a.d - b.d); assign(e.id, opts[0].id, opts[0].unit ? 'legközelebbi váltópár' : 'legközelebbi kapcsoló'); });
  // (e) a switch left without lamps at another door of the same room → two-way partner of that room's main group
  sws.filter(s => !s.ctx.bed && !unitOf(s.id) && !fixed.has(s.id)).forEach(s => {
    const host = units.filter(u => !u.pair && !u.explicit && u.lamps.length && u.switches.every(id => { const o = sws.find(x => x.id === id); return o && o.room === s.room && o.portal && o.portal !== s.portal; }))
      .sort((a, b) => b.lamps.length - a.lamps.length)[0];
    if (host && s.portal) { host.switches.push(s.id); twoWay[s.id] = twoWay[host.switches[0]] = true; host.lamps.forEach(l => why[l] += ' · váltó ' + s.id); }
    else warn.push({ sev: 'warn', msg: `${s.id} ${s.ref} (${s.room}): kapcsolóhoz nem tartozik lámpa a rajzon` }); });
  sws.forEach(s => { if (!role[s.id]) role[s.id] = twoWay[s.id] ? 'end' : 'single'; });
  units.forEach(u => { if (!u.mode) u.mode = u.switches.length > 1 ? '2way' : 'single'; });
  return { ctlOf, units, twoWay, why, role };
}
function portalRooms(G, pid) { const o = G.D.openings.find(x => x.id === pid); return o ? geom.roomsAround(G, o.x, o.y) : []; }

// ---- circuits --------------------------------------------------------------------------------------------------------
function circuits(D, M, L, cfg, warn) {
  const list = [], byMember = {};
  const cableFor = (c, ms) => { if (c.dedicated) { const v = (ms[0] && ms[0].v) || ''; return R.CIRCUIT_CABLE[v === 'hob2l' ? 'hob2l' : v === 'hob32' ? 'hob32' : 'ded16']; }
    return /13A/.test(c.mcb || '') ? 'NYM3x15' : 'NYM3x25'; };
  const plan = {}; (cfg.socketPlan || []).forEach(p => plan[p.ref] = p);
  const get = id => M.find(e => e.id === id);
  // existing circuits, with the plan's corrections
  D.circuits.forEach(c => { const p = plan[c.ref] || {}; let ids = p.members ? [...p.members] : [...c.members]; (p.add || []).forEach(id => { if (!ids.includes(id)) ids.push(id); });
    const missing = ids.filter(id => !get(id)); if (missing.length) warn.push({ sev: 'info', msg: `${c.ref}: a vázlatban nem létező tagok elhagyva (${missing.join(', ')})` });
    const ms = ids.map(get).filter(Boolean);
    list.push({ ref: c.ref, name: p.name || c.name, mcb: c.mcb, kind: c.dedicated ? 'ded' : 'socket', dedicated: !!c.dedicated, members: ms, cable: cableFor(c, ms), src: 'vázlat' + (p.members || p.add ? ' + javaslat' : '') }); });
  (cfg.socketPlan || []).filter(p => !D.circuits.some(c => c.ref === p.ref)).forEach(p => {
    const ms = p.members.map(get).filter(Boolean);
    list.push({ ref: p.ref, name: p.name, mcb: p.mcb, kind: p.dedicated ? 'ded' : 'socket', dedicated: !!p.dedicated, members: ms,
      cable: R.CIRCUIT_CABLE[p.cable || (p.dedicated ? 'ded16' : 's25')], src: p.src || 'javaslat' }); });
  // lighting: lamps, switches, shutters (+ their switches) of each zone
  (cfg.lighting || []).forEach(v => { const ms = M.filter(e => v.rooms.includes(e.room) && (e.code === 'LMP' || e.code === 'SWI' || e.code === 'SHU'));
    // a lamp switched from another zone's box follows its switch
    list.push({ ref: v.ref, name: v.name, mcb: v.mcb, kind: 'light', members: ms, cable: R.CIRCUIT_CABLE.light, src: 'javaslat' }); });
  // a lamp belongs to the circuit of its switch (wet rooms switched from outside)
  const light = list.filter(c => c.kind === 'light');
  M.filter(e => e.code === 'LMP' && L.ctlOf[e.id]).forEach(e => { const sw = L.ctlOf[e.id][0], cs = light.find(c => c.members.some(m => m.id === sw)), cl = light.find(c => c.members.includes(e));
    if (cs && cl && cs !== cl) { cl.members = cl.members.filter(m => m !== e); cs.members.push(e); } });
  list.forEach(c => c.members.forEach(e => { if (byMember[e.id] && byMember[e.id] !== c) warn.push({ sev: 'warn', msg: `${e.id} két áramkörben: ${byMember[e.id].ref}, ${c.ref}` }); byMember[e.id] = c; }));
  return { list, byMember };
}

module.exports = { plan };
