// data.js — the Adat/PoE layer on top of the Erősáram baseline
//
// Model (defaults, each one a question in ADATRETEG-Q-001 — cfg.data overrides):
//  · BASE = the home distributor (patch panel + PoE switch, EN 50173-4). topology 'rbx' (BRIDGE: silver rail): every
//    data port is a Cat6A home run to its nearest hardware node — an RBX (a small PoE switch in its SELV bay) or the
//    BASE —, and every RBX has an uplink pair to the BASE. topology 'star': every port runs to the BASE. No splices.
//    The ISP entry gets empty conduits to the BASE, one pipe per name in cfg.data.isp (D09: optika + koax).
//  · cfg.ceilLinks (D07): a hop through the ceiling slab where the wall line breaks; a pull box at each end.
//  · same walls as the baseline (the sketch's allowed faces), one wall crossing only at a service point — at a portal
//    through the hinge-side nest (H0, the SELV side), never through a 230 V box.
//  · its own band: horizontal data conduits at 2700, above the trunk (2600) and the distribution (2450). Screened
//    Cat6A in its own conduit needs no further segregation from power (EN 50174-2, class d).
//  · ONE tree from the BASE (other service points cost 3 m to pass, as on the trunk); cables of a branch share a
//    conduit up to perPipe; a box wherever the conduit splits, and a pull box after maxBends wall corners.
//  · wall outlets: a sweep bend down from the band to the outlet's own box; ceiling APs: up into the ceiling from the
//    room's cheapest node and across, like the ceiling lamps of the baseline.
'use strict';
const geom = require('./geom'), RU = require('./rules'), NW = require('./network');

const DEF = { topology: 'rbx', h: 2700, cable: 'CAT6A', perPipe: 4, maxBends: 2, minCond: 'M20', rbxLinks: 2, ispCond: 'M32', isp: [''], usb: true, nestH: 2450, passPenalty: 3000 };
const PORTS = e => e.code === 'ETH' ? Math.max(1, parseInt(e.v, 10) || 1) : 1;
const PORT_HU = { ETH: 'adataljzat', CAM: 'PoE kamera', ACP: 'PoE WiFi AP', USB: 'USB-C (PoE → PD) ⚑' };

function planData(G, E, PT, cfg, allowed) {
  const C = Object.assign({}, DEF, cfg.data || {}), warn = [], D = G.D;
  const hw = D.devices.filter(d => d.level === G.level);
  const baseDev = hw.find(d => d.type === 'base'), rbxs = hw.filter(d => d.type === 'rbx'), isp = hw.find(d => d.type === 'entry');
  if (!baseDev) return { warn: [{ sev: 'err', msg: 'nincs BASE — az adatréteg forrása hiányzik' }], legs: [], boxes: [], EP: [] };
  const EP = E.filter(e => e.role === 'sys:DATA' || (C.usb && e.role === 'sys:USB'));

  // ---- service points: portals cross at the hinge side (SELV), RBX / BASE where they stand ----
  const SP = [];
  PT.forEach(p => SP.push({ id: p.id, type: 'portal', faces: p.faces.map(f => {
    const u = Math.max(f.face.lo + 50, Math.min(f.face.hi - 50, p.c - p.latch * (p.half + 150)));
    return { room: f.room, face: f.face, u, key: `dsp:${p.id}:${f.room}` }; }) }));
  hw.filter(d => d.type === 'rbx' || d.type === 'base').forEach(d => SP.push({ id: d.id, type: d.type, dev: d, faces: geom.roomsAround(G, d.x, d.y).map(rid => {
    const nf = geom.nearestFace(G, d.x, d.y, rid); return { room: rid, face: nf.face, u: nf.u, key: `dsp:${d.id}:${rid}` }; }) }));
  const anchors = [];
  SP.forEach(sp => sp.faces.forEach(f => anchors.push({ key: f.key, room: f.room, s: f.face.uToS(f.u) })));

  // ---- sinks: wall outlets (their own u), ceiling APs (riser chosen after the tree), RBX uplinks, the ISP entry ----
  const sinks = [];
  EP.forEach(e => { const n = PORTS(e);
    const ceil = e.code === 'ACP' || e.h >= (cfg.ceiling || RU.LEVEL.ceilingDefault) - 100;
    if (e.onWall && e.face && !ceil) { const key = 'dw:' + e.id; anchors.push({ key, room: e.room, s: e.face.uToS(e.u) });
      sinks.push({ id: e.id, kind: 'wall', e, key, n, cable: e.cable || C.cable, label: e.ref || e.id }); }
    else { const nf = geom.nearestFace(G, e.x, e.y, e.room), key = 'dc:' + e.id; anchors.push({ key, room: e.room, s: nf.face.uToS(nf.u) });
      sinks.push({ id: e.id, kind: 'ceil', e, key, n, cable: e.cable || C.cable, label: e.ref || e.id }); } });
  rbxs.forEach(d => sinks.push({ id: d.id, kind: 'rbx', dev: d, sp: d.id, n: C.rbxLinks, cable: C.cable, label: (d.ref || d.id).split(/ to | - /)[0].trim() }));
  if (isp) { const nf = geom.nearestFace(G, isp.x, isp.y), key = 'di:' + isp.id; anchors.push({ key, room: nf.face.room, s: nf.face.uToS(nf.u) });
    sinks.push({ id: isp.id, kind: 'isp', dev: isp, key, n: (C.isp || [0]).length, cable: 'SPARE', label: isp.ref || 'ISP' }); }
  NW.ceilAnchors(G, cfg, 'dcl', anchors);

  const net = NW.build(G, allowed, anchors), g = net.g;
  const node = key => (net.byKey[key] || [])[0];
  const overEnds = NW.ceilLinks(G, cfg, 'dcl', net, C.h);                              // D07: the ceiling crossing over the stair opening
  SP.forEach(sp => { const ns = sp.faces.map(f => node(f.key)).filter(i => i != null);
    for (let a = 0; a < ns.length; a++) for (let b = a + 1; b < ns.length; b++) g.link(ns[a], ns[b], Math.hypot(g.N[ns[a]].x - g.N[ns[b]].x, g.N[ns[a]].y - g.N[ns[b]].y), 'cross'); });
  const spOfNode = {}; SP.forEach(sp => sp.faces.forEach(f => { const i = node(f.key); if (i != null) spOfNode[i] = sp.id; }));
  // every hardware node is a source: a virtual node tied to its faces; trees from each (soft walls only if needed)
  const SRC = {};
  [baseDev, ...rbxs].forEach(d => { const v = g.add({ room: null, x: d.x, y: d.y, keys: ['src:' + d.id], virtual: true });
    SP.find(s => s.id === d.id).faces.forEach(f => { const i = node(f.key); if (i != null) g.link(v, i, 0, 'src'); });
    const pen = i => spOfNode[i] && spOfNode[i] !== d.id ? C.passPenalty : 0, ok = i => !g.N[i].virtual || i === v;
    SRC[d.id] = { d, v, T1: g.run(v, { penalty: pen, ok, edge: e => e.kind !== 'soft' }), T2: g.run(v, { penalty: pen, ok }) }; });
  const best = (S, t) => isFinite(S.T1.dist[t]) ? { T: S.T1, soft: false, d: S.T1.dist[t] } : isFinite(S.T2.dist[t]) ? { T: S.T2, soft: true, d: S.T2.dist[t] * 1.5 } : null;
  const T1 = SRC[baseDev.id].T1, T2 = SRC[baseDev.id].T2;
  // which source serves a sink: the BASE (star, RBX uplinks, ISP) or the nearest hardware node (topology 'rbx')
  const pathTo = (t, sk) => { const cands = (C.topology === 'rbx' && (sk.kind === 'wall' || sk.kind === 'ceil')) ? Object.values(SRC) : [SRC[baseDev.id]];
    let b = null; cands.forEach(S => { const r = best(S, t); if (r && (!b || r.d < b.d)) b = Object.assign(r, { S }); });
    return b ? { nodes: g.path(b.T.prev, t), soft: b.soft, src: b.S.d } : null; };

  // ---- route every sink ----
  const load = new Map(), ek = (a, b) => a < b ? a + '-' + b : b + '-' + a, tails = [];      // tails: vertical / ceiling ends
  sinks.forEach(sk => {
    let t;
    if (sk.kind === 'rbx') { const sp = SP.find(s => s.id === sk.sp), ts = sp.faces.map(f => node(f.key)).filter(i => i != null);
      t = ts.sort((a, b) => T2.dist[a] - T2.dist[b])[0]; }
    else if (sk.kind === 'ceil') {
      // the riser: the room's node that minimises (tree length + 1.5 × the ceiling run)
      const cand = net.roomNodes[sk.e.room] || []; let pick = null;
      const S = C.topology === 'rbx' ? Object.values(SRC) : [SRC[baseDev.id]];
      cand.forEach(i => { const d = Math.min(...S.map(s => { const r = best(s, i); return r ? r.d : Infinity; })); if (!isFinite(d)) return;
        const c = d + 1.5 * Math.hypot(g.N[i].x - sk.e.x, g.N[i].y - sk.e.y); if (!pick || c < pick.c) pick = { i, c }; });
      t = pick ? pick.i : node(sk.key); }
    else t = node(sk.key);
    const p = t != null && pathTo(t, sk);
    if (!p) { warn.push({ sev: 'err', msg: `${sk.label}: a BASE-ből nem érhető el falon` }); return; }
    if (p.soft) warn.push({ sev: 'warn', msg: `${sk.label}: az adatút jelöletlen falon is fut` });
    sk.node = t; sk.path = p.nodes; sk.src = p.src;
    for (let k = 1; k < p.nodes.length - 1; k++) { const a = p.nodes[k], b = p.nodes[k + 1]; const key = ek(a, b);
      (load.get(key) || load.set(key, []).get(key)).push(sk); }
    tails.push(sk); });

  // ---- boxes: BASE, RBX, portal nests, tees where the conduit splits, pull boxes after maxBends corners ----
  const boxes = [], boxAt = {}, mk = b => { b.id = 'Y' + (boxes.length + 1); boxes.push(b); return b; };
  const deg = {}; load.forEach((v, k) => k.split('-').map(Number).forEach(i => deg[i] = (deg[i] || 0) + 1));
  const tailsAt = {}; tails.forEach(sk => (tailsAt[sk.node] = tailsAt[sk.node] || []).push(sk));
  const spBox = i => { const sid = spOfNode[i], sp = SP.find(s => s.id === sid);
    if (sp.type === 'base') return mk({ kind: 'base', sp: sid, room: g.N[i].room, x: g.N[i].x, y: g.N[i].y, h: C.h, node: i, n: 'BASE — adatközpont (patch panel + PoE switch)' });
    if (sp.type === 'rbx') return mk({ kind: 'rbx', sp: sid, room: g.N[i].room, x: g.N[i].x, y: g.N[i].y, h: 2150, node: i, n: `${sid} — SELV rekesz` });
    return mk({ kind: 'nest', sp: sid, room: g.N[i].room, x: g.N[i].x, y: g.N[i].y, h: C.nestH, node: i, n: `Portál ${sid} — fészek (H0), SELV átvezetés` }); };
  // a service point gets a data box only where the data uses it: a wall crossing, a source face, an RBX uplink end —
  // a run that merely passes a portal goes by its nest, not into it (as the trunk passes the 230 V boxes)
  const crossAt = new Set(); load.forEach((v, k) => { const [a, b] = k.split('-').map(Number); if (g.adj[a].some(x => x.to === b && x.kind === 'cross')) { crossAt.add(a); crossAt.add(b); } });
  const srcFace = new Set(tails.map(sk => sk.path[1]).filter(i => i != null));
  Object.keys(deg).map(Number).forEach(i => {
    const branches = deg[i] + (tailsAt[i] || []).filter(sk => sk.kind !== 'rbx').length;
    if (spOfNode[i] && (crossAt.has(i) || srcFace.has(i) || (tailsAt[i] || []).length)) boxAt[i] = spBox(i);
    else if (branches >= 3) boxAt[i] = mk({ kind: 'tee', room: g.N[i].room, x: g.N[i].x, y: g.N[i].y, h: C.h, node: i, n: 'Adat elágazó doboz' }); });
  // a tail at a node on the way (not the end of the line) also needs the conduit to split there
  tails.forEach(sk => { if (sk.kind !== 'rbx' && !boxAt[sk.node] && (deg[sk.node] || 0) >= 2) boxAt[sk.node] = mk({ kind: 'tee', room: g.N[sk.node].room, x: g.N[sk.node].x, y: g.N[sk.node].y, h: C.h, node: sk.node, n: 'Adat elágazó doboz' }); });
  // the BASE side of the tree: the first real node of each path starts at the BASE box
  const firsts = new Set(tails.map(sk => sk.path[1]).filter(i => i != null));
  firsts.forEach(i => { if (!boxAt[i]) boxAt[i] = spBox(i); });
  // a used ceiling crossing: a pull box at each end (the conduit leaves the wall upward into the slab)
  overEnds.forEach((n, i) => { if (boxAt[i] || !g.adj[i].some(x => x.kind === 'over' && load.has(ek(i, x.to)))) return; boxAt[i] = mk({ kind: 'pull', room: g.N[i].room, x: g.N[i].x, y: g.N[i].y, h: C.h, node: i, n: `Adat húzódoboz — mennyezeti átvezetés (${n})` }); });

  // ---- legs: walk the loaded subgraph box to box ----
  const legs = [];
  const leg = o => { const per = C.perPipe, flat = [];
    o.cables.forEach(c => { for (let k = 0; k < c.n; k++) flat.push({ c: c.c, n: 1, to: c.to }); });
    // every empty conduit is its own pipe (D09: optika + koax), the Cat6A share pipes up to perPipe
    const cat = flat.filter(c => c.c !== 'SPARE'), spare = flat.filter(c => c.c === 'SPARE');
    o.pipes = []; for (let k = 0; k < cat.length; k += per) { const cs = merge(cat.slice(k, k + per)); o.pipes.push(Object.assign({ to: [...new Set(cat.slice(k, k + per).map(c => c.to))], cables: cs }, size(cs, o.len, C))); }
    spare.forEach((c, k) => { const s = size([{ c: 'SPARE', n: 1 }], o.len, C), nm = (C.isp || [])[k];
      o.pipes.push(Object.assign({ to: [c.to], cables: [{ c: 'SPARE', n: 1, to: [c.to] }], spare: nm || '' }, s, { why: s.why + (nm ? ' — ' + nm : '') })); });
    const cnt = {}; o.pipes.forEach(p => cnt[p.cond] = (cnt[p.cond] || 0) + 1);
    o.cond = Object.entries(cnt).map(([k, n]) => (n > 1 ? n + '×' : '') + k).join(' + ');
    o.id = 'A' + String(legs.length + 1).padStart(2, '0'); legs.push(o); };
  const cabOf = list => list.map(sk => ({ c: sk.cable, n: sk.n, to: sk.id }));          // by id: the sketch repeats refs (two ETH1, two CAM1)
  const hAt = (i, def) => boxAt[i] ? boxAt[i].h : def;
  const seen = new Set();
  const walk = start => g.adj[start].forEach(e0 => { if (!load.has(ek(start, e0.to)) || seen.has(ek(start, e0.to))) return;
    const pts = [start]; let prev = start, cur = e0.to, len = e0.w, nb = 0; seen.add(ek(start, cur));
    while (!boxAt[cur]) {
      if (g.N[cur].corner && ++nb > C.maxBends) { boxAt[cur] = mk({ kind: 'pull', room: g.N[cur].room, x: g.N[cur].x, y: g.N[cur].y, h: C.h, node: cur, n: 'Adat húzódoboz' }); break; }
      const nx = g.adj[cur].find(x => x.to !== prev && load.has(ek(cur, x.to)) && !seen.has(ek(cur, x.to))); if (!nx) break;
      pts.push(cur); seen.add(ek(cur, nx.to)); prev = cur; cur = nx.to; len += nx.w; }
    pts.push(cur);
    const sk = load.get(ek(pts[0], pts[1])), cross = pts.some((p, k) => k && g.adj[pts[k - 1]].some(x => x.to === p && x.kind === 'cross'));
    const ceilH = cfg.ceiling || RU.LEVEL.ceilingDefault; let over = false;
    const poly = []; pts.forEach((i, k) => { const ed = k ? g.adj[pts[k - 1]].find(x => x.to === i) : null;
      if (ed && ed.kind === 'cross') { const a = g.N[pts[k - 1]], hh = boxAt[pts[k - 1]] ? boxAt[pts[k - 1]].h : C.nestH; poly.push([a.x, a.y, hh], [g.N[i].x, g.N[i].y, hh]); }
      if (ed && ed.kind === 'over') { const a = g.N[pts[k - 1]]; poly.push([a.x, a.y, ceilH], [g.N[i].x, g.N[i].y, ceilH]); over = true; }
      poly.push([g.N[i].x, g.N[i].y, C.h]); });
    const vert = Math.abs(C.h - hAt(pts[0], C.h)) + Math.abs(C.h - hAt(cur, C.h));
    leg({ kind: 'dh', from: boxAt[pts[0]] ? boxAt[pts[0]].id : '—', to: boxAt[cur] ? boxAt[cur].id : '—', len: Math.round(len + vert), bends: Math.min(nb, C.maxBends) + (over ? 2 : 0), h: C.h, poly, cross, over,
      soft: pts.some((p, k) => k && g.adj[pts[k - 1]].some(x => x.to === p && x.kind === 'soft')), cables: cabOf(sk) });
    walk(cur); });
  [...firsts].forEach(i => walk(i));
  // BASE rise: the BASE cabinet → the band, one leg per first node
  [...firsts].forEach(i => { const list = tails.filter(sk => sk.path[1] === i && sk.src === baseDev), b = boxAt[i]; if (!list.length) return;
    leg({ kind: 'drise', from: 'BASE', to: b.id, len: Math.round(Math.abs(C.h - (baseDev.h || 900)) + Math.hypot(baseDev.x - b.x, baseDev.y - b.y)), bends: 1, h: null,
      poly: [[baseDev.x, baseDev.y, baseDev.h || 900], [b.x, b.y, baseDev.h || 900], [b.x, b.y, C.h]], cables: cabOf(list) }); });
  // tails: wall drops, ceiling runs, the ISP entry (RBX uplinks end in the RBX box itself)
  tails.forEach(sk => { const i = sk.node, b = boxAt[i], x0 = g.N[i].x, y0 = g.N[i].y, from = b ? b.id : '—';
    if (sk.kind === 'wall') leg({ kind: 'ddrop', from, to: sk.e.id, len: Math.round(Math.abs(C.h - sk.e.h)), bends: 1, h: null, poly: [[x0, y0, C.h], [x0, y0, sk.e.h]], cables: cabOf([sk]), dev: sk.e.id });
    if (sk.kind === 'ceil') { const ch = cfg.ceiling || RU.LEVEL.ceilingDefault;
      leg({ kind: 'dceil', from, to: sk.e.id, len: Math.round(ch - C.h + Math.hypot(sk.e.x - x0, sk.e.y - y0)), bends: 2, h: ch, poly: [[x0, y0, C.h], [x0, y0, ch], [sk.e.x, sk.e.y, ch]], cables: cabOf([sk]), dev: sk.e.id }); }
    if (sk.kind === 'isp') leg({ kind: 'disp', from, to: sk.label, len: Math.round(Math.abs(C.h - (sk.dev.h || 2250)) + Math.hypot(sk.dev.x - x0, sk.dev.y - y0)), bends: 1, h: null,
      poly: [[x0, y0, C.h], [sk.dev.x, sk.dev.y, sk.dev.h || 2250]], cables: [{ c: 'SPARE', n: sk.n, to: sk.id }], dev: sk.dev.id }); });
  boxes.filter(b => b.kind === 'tee' || b.kind === 'pull').forEach(b => { const n = legs.filter(l => l.from === b.id || l.to === b.id).reduce((a, l) => a + l.pipes.length, 0);
    b.size = n > 4 ? 'tee-L' : 'tee'; if (n > 6) warn.push({ sev: 'warn', msg: `${b.id} (${b.room}): ${n} cső fut be — nagyobb (pl. 150 × 150) doboz kell` }); });
  return { C, EP, SP, sinks, legs, boxes, warn, net, spOfNode };
}

function merge(list) { const by = {}; list.forEach(c => { const o = by[c.c] || (by[c.c] = { c: c.c, n: 0, to: [] }); o.n += c.n || 1; if (c.to && !o.to.includes(c.to)) o.to.push(c.to); }); return Object.values(by); }
function size(cables, len, C) {
  if (cables.every(c => c.c === 'SPARE')) return { cond: C.ispCond, fill: 0, why: 'üres cső + behúzószál (szolgáltatói bekötés)' };
  const s = RU.sizeConduit(cables, len), order = RU.CONDUITS.map(k => k.k);
  const cond = order.indexOf(s.size) < order.indexOf(C.minCond) ? C.minCond : s.size;
  return { cond, fill: s.fill, why: s.why + (cond !== s.size ? ` → legalább ${C.minCond} (Cat6A hajlítási sugár) ⚑` : ''), over: !!s.over };
}

module.exports = { planData, PORT_HU, PORTS, DEF };
