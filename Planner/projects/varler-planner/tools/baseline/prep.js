// prep.js — endpoints: role, room, face, context, standard height; portals: geometry, latch side, members, slots
'use strict';
const geom = require('./geom'), R = require('./rules');

const ROLE_OF = (P, id) => { const l = P.layers.find(y => y.id === id); return l ? (l.role || l.name) : id; };
const codeOf = d => d.code || ({ light: 'LMP', switch: 'SWI', socket: 'SOC' })[d.type] || d.type;

let CFG = {};
// a room's kinds: the plan's own (Planner rooms carry kinds) + the config's (P33: R05 = kamra) — no room ids in rules (F7)
function kindsOf(G, cfg, rid) { const r = G.rooms.find(x => x.id === rid); return [...((r && r.kinds) || []), ...(((cfg || {}).roomKinds || {})[rid] || [])]; }
const WET_KINDS = ['furdo', 'wc'];
function isWet(G, cfg, rid) { return ((cfg || {}).wetRooms || []).includes(rid) || kindsOf(G, cfg, rid).some(k => WET_KINDS.includes(k)); }
function endpoints(G, cfg) {
  CFG = cfg;
  const P = G.P, D = G.D, out = [];
  const circName = {}; D.circuits.forEach(c => c.members.forEach(m => circName[m] = c.name));
  const island = cfg.island && D.objects.find(o => o.id === cfg.island.object);
  const bedMarks = (D.marks || []).filter(m => m.kind === 'zone' && (m.level == null || m.level === G.level) && (m.tags || []).includes(cfg.bedZoneMark));
  D.devices.filter(d => d.level === G.level).forEach(d => {
    let role = ROLE_OF(P, d.layer);
    if ((cfg.adoptSwitches || []).includes(d.id)) role = 'sys:MAINS';
    if (role === 'cluster' || role === 'channel') return;
    const nf = geom.nearestFace(G, d.x, d.y), onWall = nf && nf.d <= 260;      // ≤ ½ of the thickest wall (400) + margin: sits in / on a wall
    let room = onWall ? nf.face.room : geom.roomOf(G, d.x, d.y), face = onWall ? nf.face : null, u = onWall ? nf.u : null;
    let fixed = null;
    // F15 (2026-10-15): a point pinned to a face IS on the wall — before, one placed > 260 off the wall kept onWall false and
    // silently got no drop, no cable (P33 v1: socket D339 / D23 in R01, found by the Planner acceptance run)
    if (cfg.fixFace && cfg.fixFace[d.id]) { const f = geom.nearestFace(G, d.x, d.y, cfg.fixFace[d.id]); if (f) { room = f.face.room; face = f.face; u = f.u; fixed = f; } }
    const ctx = { role, wall: !!onWall, room, kinds: kindsOf(G, cfg, room), ceiling: cfg.ceiling, note: d.note || d.ref || '', circuitName: circName[d.id] || '',
      wet: isWet(G, cfg, room), window: false, portal: false,
      worktop: !!(face && (cfg.worktop || []).some(w => w.room === room && face.wall === w.wall && u >= w.from - 50 && u <= w.to + 50)),
      island: !!(island && !onWall && codeOf(d) !== 'LMP' && Math.abs(d.x - island.x) <= island.w / 2 + 50 && Math.abs(d.y - island.y) <= island.d / 2 + 50),
      bed: !!(face && bedMarks.some(m => bedTouches(m, face, u))) };
    out.push({ id: d.id, dev: d, role, code: codeOf(d), v: d.var || '', ref: d.ref || '', room, face, u, onWall: !!onWall || !!fixed,
      floorGroup: floorGroupOf(cfg, d, ctx),
      x: fixed ? fixed.x : d.x, y: fixed ? fixed.y : d.y, moved: !!fixed, fixedFace: !!fixed, h0: d.h, ctx, adopted: (cfg.adoptSwitches || []).includes(d.id) });
  });
  return out;
}
// a wall face touches the bed zone if the zone reaches within 200 mm of the face line and the device is within the
// zone's extent along the face ± 700 (the nightstands)
// which floor-fed group a device belongs to: an explicit member list, or the island (non-lamp, inside the island object)
function floorGroupOf(cfg, d, ctx) {
  const g = (cfg.floorGroups || []).find(g => (g.members || []).includes(d.id) || (g.auto === 'island' && ctx.island));
  return g ? g.name : null;
}
function bedTouches(m, f, u) {
  const lo = f.horiz ? m.x0 : m.y0, hi = f.horiz ? m.x1 : m.y1, a = f.horiz ? m.y0 : m.x0, b = f.horiz ? m.y1 : m.x1;
  const gap = Math.min(Math.abs(f.fix - a), Math.abs(f.fix - b));
  return gap <= 200 && u >= lo - 700 && u <= hi + 700;
}

function applyHeights(E) {
  E.forEach(e => { if (e.dev && e.dev.hFix) { e.h = e.dev.h; e.hRule = 'rögzítve (válasz): ' + (e.dev.note || ''); e.hChanged = e.h0 !== e.h; return; }
    const r = R.stdHeight(e.dev, e.ctx); e.h = r.h; e.hRule = r.rule; e.hChanged = Math.round(r.h) !== Math.round(e.h0); });
}

// ---- portals -------------------------------------------------------------------------------------------------------
function portals(G, E) {
  const doors = G.D.openings.filter(o => o.level === G.level && o.type === 'door');
  return doors.map(o => {
    const w = G.walls.find(w => geom.inRect(o.x, o.y, w, 30)); if (!w) return null;
    const axis = w.axis, c = axis === 'x' ? o.x : o.y, half = (o.w || 900) / 2, mid = axis === 'x' ? (w.y0 + w.y1) / 2 : (w.x0 + w.x1) / 2;
    // the faces on both sides: the room faces lying on this wall and covering the opening centre
    const faces = [];
    G.rooms.forEach(r => r.faces.forEach(f => { if (f.wall !== w.id) return; if (f.horiz !== (axis === 'x')) return;
      if (c >= f.lo - 1 && c <= f.hi + 1) faces.push({ room: r.id, fix: f.fix, face: f }); }));
    // latch side (+1 = toward larger axis values): where the user's MAINS switches are; else away from the nearer corner
    const sw = E.filter(e => e.role === 'sys:MAINS' && e.code === 'SWI' && e.face && e.face.wall === w.id && Math.abs(e.u - c) <= half + 800);
    let latch = 0;
    if (sw.length) { const s = sw.reduce((a, e) => a + Math.sign(e.u - c), 0); latch = s >= 0 ? 1 : -1; }
    else { const f = faces[0] && faces[0].face, dLo = f ? (c - half) - f.lo : 1e9, dHi = f ? f.hi - (c + half) : 1e9; latch = dLo < dHi ? 1 : -1; }
    return { id: o.id, door: o, wall: w.id, axis, c, half, mid, thk: w.thk, faces, latch, exterior: faces.length < 2 };
  }).filter(Boolean);
}

// which endpoints belong to which portal (on the door's wall, within 800 of the opening edge, the "portal codes")
const PORTAL_CODES = e => (e.role === 'sys:MAINS' && (e.code === 'SWI' || e.code === 'SOC')) ||
  ['POR', 'NTL', 'PAN', 'THR'].includes(e.code) || (e.role === 'sys:BUSB' && e.code === 'LMP') || e.code === 'SPK';
function portalMembers(G, PT, E) {
  E.forEach(e => {
    if (!PORTAL_CODES(e)) return;
    let best = null;
    PT.forEach(p => { const w = G.wallById[p.wall];
      const along = p.axis === 'x' ? e.x : e.y, perp = p.axis === 'x' ? e.y : e.x;
      if (Math.abs(perp - p.mid) > p.thk / 2 + 120) return;
      // a device on another wall's face (an előtétfal in front of this one) is not this portal's
      if (e.face && e.face.wall !== p.wall && Math.abs(perp - p.mid) > p.thk / 2 + 5) return;
      const dEdge = Math.abs(along - p.c) - p.half; if (dEdge > 800) return;
      // MAINS sockets only when right beside the opening; switches within 800
      if (e.role === 'sys:MAINS' && e.code === 'SOC' && dEdge > 400) return;
      if (!best || dEdge < best.dEdge) best = { p, dEdge }; });
    if (best) e.portal = best.p.id;
  });
  // face per member: by the side of the wall centre it sits on; centred duplicates split A / B; singles follow the majority
  PT.forEach(p => {
    const mem = E.filter(e => e.portal === p.id);
    const sideOf = e => { const perp = p.axis === 'x' ? e.y : e.x; return Math.abs(perp - p.mid) < 20 ? 0 : Math.sign(perp - p.mid); };
    const faceBySign = s => p.faces.find(f => Math.sign(f.fix - p.mid) === s) || p.faces[0];
    const counts = {}; mem.forEach(e => { const s = sideOf(e); if (s) counts[s] = (counts[s] || 0) + 1; });
    const major = (counts[1] || 0) >= (counts[-1] || 0) ? 1 : -1;
    // a WC / bathroom door: the switch and the notification light (occupancy) belong OUTSIDE, on the dry face
    const wetFace = p.faces.find(f => isWet(G, CFG, f.room)), dryFace = p.faces.find(f => !isWet(G, CFG, f.room));
    const drySign = (wetFace && dryFace) ? Math.sign(dryFace.fix - p.mid) : 0;
    // per code, which sides already hold one (a duplicate placed on the door means "both faces")
    const has = {}; mem.forEach(e => { const s = sideOf(e); if (s) (has[e.code + e.v] = has[e.code + e.v] || new Set()).add(s); });
    mem.forEach(e => { let s = sideOf(e); const k = e.code + e.v, H = (has[k] = has[k] || new Set());
      if (!s) { const pref = (drySign && ((e.role === 'sys:MAINS' && e.code === 'SWI') || e.code === 'NTL')) ? drySign : major;
        s = !H.has(pref) ? pref : (!H.has(-pref) && p.faces.length > 1 ? -pref : pref); H.add(s); }
      const f = faceBySign(s); e.pFace = f ? f.room : null; });
  });
}

// slot for each member, and its new plan position (moved onto the slot)
function slotOf(e) {
  const key = e.code + (e.v ? ':' + e.v : ''), slots = R.PORTAL_SLOTS;
  if (e.role === 'sys:MAINS' && e.code === 'SWI') return slots.find(s => s.k === 'L1');
  if (e.role === 'sys:MAINS' && e.code === 'SOC') return slots.find(s => s.k === 'L3');
  if (e.role === 'sys:BUSB' && e.code === 'LMP') return slots.find(s => s.k === 'H1');
  return slots.find(s => s.codes.includes(key)) || slots.find(s => s.codes.includes(e.code)) || null;
}
function placeInPortals(G, PT, E) {
  const used = {};
  E.filter(e => e.portal).forEach(e => {
    const p = PT.find(q => q.id === e.portal), s = slotOf(e); if (!s || !e.pFace) return;
    const f = p.faces.find(q => q.room === e.pFace);
    const dir = s.side === 'latch' ? p.latch : s.side === 'hinge' ? -p.latch : 0;
    const key = p.id + '|' + f.room + '|' + s.k, n = (used[key] = (used[key] || 0) + 1);
    // same slot twice: MAINS switches gang up in one box; anything else steps 250 further out
    const extra = (n > 1 && !(e.code === 'SWI' || e.code === 'SOC')) ? 250 * (n - 1) : 0;
    const along = dir === 0 ? p.c + (n > 1 ? 250 * (n - 1) : 0) : p.c + dir * (p.half + s.u + extra);
    const inset = 0;                                    // devices sit on the face line
    e.slot = s.k; e.slotN = n; e.moved = true;
    e.room = f.room; e.face = f.face; e.u = along; e.onWall = true; e.ctx.portal = true; e.ctx.wall = true; e.ctx.room = f.room;
    e.x = p.axis === 'x' ? along : f.fix + inset; e.y = p.axis === 'x' ? f.fix + inset : along;
    e.h = s.h; e.hRule = `portál ${p.id} · ${s.k} — ${s.n}`; e.hChanged = Math.round(e.h) !== Math.round(e.h0);
  });
}

// the user's answers as edits on the sketch itself: new points get real ids (so the output .vplan carries them),
// moves change x / y, hFix pins a height. "N:name" references in the config resolve to those ids.
function applyEdits(doc, cfg) {
  const D = doc.project.data, P = doc.project, L_MAINS = (P.layers.find(l => l.role === 'sys:MAINS') || {}).id, ids = {};
  (cfg.edits || []).forEach(ed => {
    if (ed.move) { const d = D.devices.find(x => x.id === ed.move); if (!d) return;
      if (ed.x != null) d.x = ed.x; if (ed.y != null) d.y = ed.y; if (ed.hFix != null) { d.h = ed.hFix; d.hFix = true; }
      if (ed.setNote != null) d.note = ed.setNote;                                 // a corrected note replaces the old one (R09)
      d.note = ((d.note || '') + ' · ' + ed.note).replace(/^ · /, ''); d.edited = true; return; }
    if (ed.add) { const at = ed.at && D.devices.find(x => x.id === ed.at), id = 'D' + (++D.seq);
      D.devices.push({ type: ed.type, code: ed.code || (ed.type === 'switch' ? 'SWI' : undefined), var: ed.var || (ed.type === 'switch' ? '230' : undefined), kind: ed.kind,
        level: cfg.level, x: at ? at.x : ed.x, y: at ? at.y : ed.y, h: ed.hFix != null ? ed.hFix : (at ? at.h : 1100), hFix: ed.hFix != null, layer: L_MAINS, id, ref: ed.ref, note: ed.note, faceBack: false, added: true });
      ids['N:' + ed.add] = id; } });
  const res = v => (typeof v === 'string' && ids[v]) || v;
  (cfg.switchGroups || []).forEach(g => { g.lamps = g.lamps.map(res); g.chain = g.chain.map(res); });
  (cfg.floorGroups || []).forEach(g => { if (g.members) g.members = g.members.map(res); });
  (cfg.socketPlan || []).forEach(p => { if (p.members) p.members = p.members.map(res); if (p.add) p.add = p.add.map(res); });
  if (cfg.rbxSwitched) cfg.rbxSwitched = Object.fromEntries(Object.entries(cfg.rbxSwitched).map(([k, v]) => [res(k), v]));
  cfg._ids = ids;
}

module.exports = { applyEdits, kindsOf, isWet, endpoints, applyHeights, portals, portalMembers, placeInPortals, codeOf };
