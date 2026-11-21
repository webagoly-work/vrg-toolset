// guide.js — turn-by-turn guidance for a route of lib/route.js (WP M58, N3): the maneuvers, their Hungarian
// text, what to say when, and where on the route the user is. Shared by the page (lib/nav-layer.js) and the
// tests. Dependency-free; no network.
//
//   const G = require('./guide.js')         // Node
//   window.VRGGuide                          // browser, after <script src="/lib/guide.js">
//
//   G.steps(route, dest)        -> [{ kind, mod, angle, name, exit, at: [lon, lat], offset, text, icon }]
//                                  kind: depart | turn | ramp | roundabout | arrive; offset = metres along the
//                                  route where it happens
//   G.next(steps, done)         -> the index of the next step for `done` metres travelled
//   G.spoken(step, metres)      "300 méter múlva forduljon jobbra – Váci utca"
//   G.cues(mode)                the distances (m) before a step at which it is said
//
// The rules: a junction where the mode had no other way to go is never announced (the road only bends); one
// with a choice is announced when the turn is 35°+ or the street's name changes at 12°+. A roundabout is one
// step ("a 2. kijáraton"), counting the exits the mode could take. Street names are written after a dash
// ("Forduljon jobbra – Váci utca"): no Hungarian suffixes to get wrong.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGGuide = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ROUNDABOUT = 16, LINK = 32;
  const rad = x => x * Math.PI / 180, deg = x => x * 180 / Math.PI;
  function dist(a, b) {
    const k = Math.cos(rad((a[1] + b[1]) / 2));
    return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * 111195;
  }
  function bearing(a, b) {
    const k = Math.cos(rad((a[1] + b[1]) / 2));
    return (deg(Math.atan2((b[0] - a[0]) * k, b[1] - a[1])) + 360) % 360;
  }
  const norm = a => { a = ((a + 540) % 360) - 180; return a === -180 ? 180 : a; };

  /** The bearing into coords[i] (from a point ≥ 15 m back) and out of it (to a point ≥ 15 m ahead). */
  function inOut(c, i) {
    let j = i - 1;
    while (j > 0 && dist(c[j], c[i]) < 15) j--;
    let k = i + 1;
    while (k < c.length - 1 && dist(c[i], c[k]) < 15) k++;
    return [bearing(c[Math.max(0, j)], c[i]), bearing(c[i], c[Math.min(c.length - 1, k)])];
  }

  function modOf(angle) {
    const a = Math.abs(angle), side = angle > 0 ? 'jobbra' : 'balra';
    if (a < 12) return 'egyenesen';
    if (a < 40) return 'enyhén ' + side;
    if (a < 120) return side;
    if (a < 160) return 'élesen ' + side;
    return 'vissza';
  }
  const ICON = { egyenesen: '↑', 'enyhén jobbra': '↗', jobbra: '↱', 'élesen jobbra': '↘', 'enyhén balra': '↖', balra: '↰', 'élesen balra': '↙', vissza: '↶' };
  const COMPASS = ['észak', 'északkelet', 'kelet', 'délkelet', 'dél', 'délnyugat', 'nyugat', 'északnyugat'];
  const dash = n => (n ? ' – ' + n : '');

  function textOf(s, mode) {
    switch (s.kind) {
      case 'depart': return 'Induljon el ' + s.dir + ' felé' + dash(s.name);
      case 'arrive': return 'Megérkezett' + (s.name ? ': ' + s.name : '');
      case 'roundabout': return (mode === 'gyalog' ? 'A körforgalomnál a ' + s.exit + '. kijáratnál menjen tovább' : 'A körforgalomban a ' + s.exit + '. kijáraton hajtson ki') + dash(s.name);
      case 'ramp': return 'Tartson ' + (s.angle > 0 ? 'jobbra' : 'balra') + ' a lehajtóra' + dash(s.name);
      default:
        if (s.mod === 'egyenesen') return 'Haladjon tovább egyenesen' + dash(s.name);
        if (s.mod === 'vissza') return 'Forduljon vissza' + dash(s.name);
        if (s.mod.startsWith('enyhén')) return 'Tartson ' + s.mod + dash(s.name);
        return 'Forduljon ' + s.mod + dash(s.name);
    }
  }

  function steps(rt, dest) {
    const c = rt.coords, legs = rt.legs || [], mode = rt.mode;
    const cum = [0];
    for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + dist(c[i - 1], c[i]));
    const out = [];
    const add = s => { s.text = textOf(s, mode); s.icon = s.kind === 'roundabout' ? '⟳' : s.kind === 'arrive' ? '⚑' : s.kind === 'depart' ? '↑' : (ICON[s.mod] || ICON[modOf(s.angle)] || '↑'); out.push(s); };
    if (c.length > 1) {
      const b = bearing(c[0], c[Math.min(c.length - 1, 1)]);
      add({ kind: 'depart', dir: COMPASS[Math.round(b / 45) % 8], name: legs[0] ? legs[0].name : '', at: c[0], offset: 0, angle: 0 });
    }
    for (let i = 1; i < legs.length; i++) {
      const L = legs[i], P = legs[i - 1], at = L.from;
      const [bi, bo] = inOut(c, at);
      const angle = norm(bo - bi);
      if ((L.flags & ROUNDABOUT) && !(P.flags & ROUNDABOUT)) {             // into a roundabout: one step, counting exits
        let j = i, exits = 0;
        while (j + 1 < legs.length && (legs[j + 1].flags & ROUNDABOUT)) { if (legs[j + 1].others > 0) exits++; j++; }
        const after = legs[j + 1];
        add({ kind: 'roundabout', exit: exits + 1, name: after ? after.name : '', at: c[at], offset: cum[at], angle });
        i = j + 1;                                                          // the way out is part of this step
        continue;
      }
      if (P.flags & ROUNDABOUT) continue;
      if (L.others === 0) continue;                                         // no choice here: the road just bends
      const a = Math.abs(angle), renamed = (L.name || '') !== (P.name || '');
      if ((L.flags & LINK) && !(P.flags & LINK) && a >= 8) { add({ kind: 'ramp', angle, name: L.name, at: c[at], offset: cum[at] }); continue; }
      if (a >= 35 || (renamed && a >= 12)) add({ kind: 'turn', angle, mod: modOf(angle), name: L.name, at: c[at], offset: cum[at] });
      else if (renamed && L.name) add({ kind: 'turn', angle, mod: 'egyenesen', name: L.name, at: c[at], offset: cum[at] });
    }
    add({ kind: 'arrive', name: dest || '', at: c[c.length - 1], offset: cum[cum.length - 1], angle: 0 });
    return out;
  }

  /** The next step to do after `done` metres (a step stays "next" until the user is 8 m past it). */
  function next(list, done) {
    for (let i = 1; i < list.length; i++) if (list[i].offset + 8 > done || list[i].kind === 'arrive') return i;
    return list.length - 1;
  }

  function spokenDistance(m) {
    if (m < 40) return 'Most';
    if (m < 1000) return Math.round(m / (m < 200 ? 10 : 50)) * (m < 200 ? 10 : 50) + ' méter múlva';
    return (Math.round(m / 100) / 10).toString().replace('.', ',') + ' kilométer múlva';
  }
  function spoken(step, metres) {
    if (step.kind === 'arrive') return metres < 40 ? textOf(step) : spokenDistance(metres) + ' megérkezik' + (step.name ? ': ' + step.name : '');
    const t = step.text;
    return metres < 40 ? t : spokenDistance(metres) + ' ' + t.charAt(0).toLowerCase() + t.slice(1);
  }
  function cues(mode) { return mode === 'gyalog' ? [120, 30] : [700, 250, 50]; }
  function fmtShort(m) { return m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km'; }

  return { steps, next, spoken, cues, modOf, bearing, fmtShort };
});
