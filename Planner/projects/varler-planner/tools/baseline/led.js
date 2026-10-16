// led.js — LED strip feed points: every LED run (the old plan's LED lines, the sketch's LNR points, the work lights)
// gets ONE start point on its wall segment and ONE extra flush box there (the user's request 2026-10-12).
// The start is the end of the run nearer to its feed (the 230 V work-light point, or the RBX the run hangs on),
// set in by `inset` so the box clears the corner; an explicit `start: <u>` wins. `cont` = the strip carries on past the
// run's far end (L07: round the stair landing) — drawn and measured, but no second start point.
'use strict';
const geom = require('./geom');

function planLed(G, E, cfg) {
  const out = [], warn = [];
  (cfg.led || []).forEach((l, k) => {
    const nf = geom.nearestFace(G, l.at[0], l.at[1], l.room); if (!nf) { warn.push({ sev: 'err', msg: `${l.id}: nincs fal a ${l.room} helyiségben` }); return; }
    const f = nf.face, lo = Math.max(f.lo, Math.min(l.from, l.to)), hi = Math.min(f.hi, Math.max(l.from, l.to));
    const sid = (cfg._ids || {})[l.src] || l.src;                                  // "N:MW2" → the id the edit got
    const src = sid && (E.find(e => e.id === sid) || G.D.devices.find(d => d.id === sid));
    const su = src ? (f.horiz ? src.x : src.y) : (lo + hi) / 2, inset = l.inset == null ? 100 : l.inset;
    const end = l.start != null ? l.start : (Math.abs(su - lo) <= Math.abs(hi - su) ? lo + inset : hi - inset);
    const pt = u => f.horiz ? { x: u, y: f.fix } : { x: f.fix, y: u };
    const s = pt(end), a = pt(lo), b = pt(hi);
    const box = { id: 'LB' + (k + 1), kind: 'led', x: s.x, y: s.y, h: l.h, room: f.room, wall: f.wall, size: 'gang1', inward: f.inward, horiz: f.horiz,
      n: `LED-betáp kezdőpont — ${l.name}` };
    // a run that only continues beyond this round (L07): its path and length, measured from the run's far end
    let cont = null;
    if (l.cont) { const far = Math.abs(end - lo) < Math.abs(end - hi) ? b : a, P = [[far.x, far.y]].concat(l.cont.poly);
      const len = P.slice(1).reduce((t, p, k) => t + Math.hypot(p[0] - P[k][0], p[1] - P[k][1]), 0);
      cont = Object.assign({}, l.cont, { poly: P, len: Math.round(len / 100) * 100 }); }
    out.push(Object.assign({}, l, { face: f, lo, hi, len: Math.round(hi - lo), a, b, start: s, box, srcDev: src || null, cont,
      srcTxt: src ? `${src.ref || src.id}${src.code ? ' (' + src.code + (src.v ? '/' + src.v : '') + ')' : ''}` : (l.srcTxt || '—') }));
    if (l.conflict) warn.push({ sev: 'warn', msg: `${l.id}: ${l.conflict}` });
  });
  return { runs: out, warn };
}
module.exports = { planLed };
