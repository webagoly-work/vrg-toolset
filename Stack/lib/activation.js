// VRG Stack — spreading activation: how a touch on one node lights up its neighbours.
// Shared by Node (patterns, proposals) and the browser (replay.html loads this file as a script).
//
//   spread(neighbours, seeds, opts) → Map id → energy
//     neighbours(id) → [ids]       the graph, as a function, so any adjacency fits
//     seeds          Map id → energy (the nodes a step touched, 1.0 each)
//     opts.decay     energy kept per hop (0.5)
//     opts.hops      how far it spreads (2)
//     opts.hubPenalty  lateral inhibition: a node with d neighbours passes on energy / d^p, so a
//                    folder linked to 300 things does not light up the whole stack
//     opts.threshold energy below this is dropped
//   fade(prev, factor) → Map    the glow from earlier steps, dimmed (one replay tick)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StackActivation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function spread(neighbours, seeds, opts) {
    const o = Object.assign({ decay: 0.5, hops: 2, hubPenalty: 0.5, threshold: 0.02 }, opts || {});
    const energy = new Map(seeds);
    let frontier = new Map(seeds);
    for (let h = 0; h < o.hops; h++) {
      const next = new Map();
      for (const [id, e] of frontier) {
        const nb = neighbours(id) || [];
        if (!nb.length) continue;
        const share = e * o.decay / Math.pow(nb.length, o.hubPenalty);
        if (share < o.threshold) continue;
        for (const y of nb) next.set(y, (next.get(y) || 0) + share);
      }
      for (const [id, e] of next) energy.set(id, Math.min(1, (energy.get(id) || 0) + e));
      frontier = next;
    }
    for (const [id, e] of energy) if (e < o.threshold) energy.delete(id);
    return energy;
  }

  function fade(prev, factor) {
    const out = new Map();
    for (const [id, e] of prev) { const v = e * factor; if (v >= 0.02) out.set(id, v); }
    return out;
  }

  /* add b onto a, capped at 1 */
  function merge(a, b) {
    const out = new Map(a);
    for (const [id, e] of b) out.set(id, Math.min(1, (out.get(id) || 0) + e));
    return out;
  }

  return { spread, fade, merge };
});
