// VRG Stack — the layer table: the one place that says which layers exist, their order, names and colours.
// Every other copy of the order or the colours reads this (STK-P213; the Konnektóm broke once because one copy of
// seven was missed). Shared by Node (`require('./schema/layers')`) and the browser (a page loads
// `schema/layers.js` as a script and gets window.StackLayers), the same way lib/strings.js runs in both.
//
//   LIST       [{ code, hu, en, col, mask, plane, adapter }] in stack order, top to bottom; E (the pillars) last
//   ORDER      every code, in that order
//   MASK       the reach mask's slots: every layer but E (the pillar is the string's spine, not a slot)
//   PLANES     the Stack Viewer's planes, and the layer text it reads: every layer but Z (the codec has no plane)
//   ADAPTERS   the layers a build reads with an adapter and keeps in the layer cache (lib/pipeline.js LAYER8):
//              not S (made from the recordings), U (from the recorder), J (from the other checks), Z, E
//   BY         code → its entry
//   cssVars(el)  sets --ly-<code> to each colour on el (default: the document's root), for pages styled in CSS
//
// A new layer is one row here, plus its adapter, its lib/meta.js row and its links (ARCHITECTURE §4).
// test/layers.test.js holds lib/meta.js and every former copy to this table, and fails on a page that keeps a
// colour table of its own.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StackLayers = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // code, Hungarian name, English name, colour, then the flags: in the mask, a Viewer plane, read by an adapter
  const ROWS = [
    ['W', 'Szereplők', 'People', '#f5e6b8', 1, 1, 1],            // S19
    ['F', 'Kirakat', 'Featured', '#e3be7b', 1, 1, 1],
    ['V', 'Látvány', 'Look', '#a6c8ff', 1, 1, 1],                // S17
    ['M', 'Munkák', 'Jobs', '#d9b38c', 1, 1, 1],                 // S15
    ['N', 'Belépők', 'Entry points', '#9fe0c4', 1, 1, 1],        // S11
    ['S', 'Kérések', 'Asks', '#f2c4e0', 1, 1, 0],                // S13 (was K; STK-P212)
    ['I', 'Ötletfa', 'Ideas', '#c6a0e6', 1, 1, 1],
    ['T', 'Teendők', 'Open work', '#ee9bb4', 1, 1, 1],           // S3
    ['Q', 'Döntések', 'Decisions', '#e4877d', 1, 1, 1],
    ['L', 'Fejlesztési vonalak', 'DevLog', '#8bcca1', 1, 1, 1],
    ['A', 'Ügynöki gerinc', 'Agentic backbone', '#7fd3ec', 1, 1, 1],
    ['U', 'Futás', 'Runtime', '#ff9a52', 1, 1, 0],
    ['P', 'Próbák', 'Tests', '#b8e06a', 1, 1, 1],                // S12
    ['R', 'Repó', 'DevRepo', '#f0dc6e', 1, 1, 1],
    ['C', 'Kód', 'Code', '#5b8fe0', 1, 1, 1],
    ['D', 'Eszközök', 'Devices', '#6fc7c0', 1, 1, 1],            // S16
    ['O', 'Külső', 'Outside', '#c9a6e0', 1, 1, 1],               // S18
    ['G', 'Adatgömb', 'Data Globe', '#8aa4b4', 1, 1, 1],
    ['K', 'Kisokos', 'Handbook', '#5ee6c0', 1, 1, 1],            // main's Kisokos (Fényjel's Tudás colour)
    ['J', 'Jelzések', 'Signals', '#ff5f56', 1, 1, 0],            // S14
    ['Z', 'Tömörített réteg', 'Codec', '#b0b8be', 1, 0, 0],
    ['E', 'Pillérek', 'Pillars', '#f2f6f8', 0, 1, 0],
  ];
  const LIST = ROWS.map(([code, hu, en, col, mask, plane, adapter]) => Object.freeze({ code, hu, en, col, mask: !!mask, plane: !!plane, adapter: !!adapter }));
  const pick = f => Object.freeze(LIST.filter(f).map(l => l.code));
  const ORDER = pick(() => true), MASK = pick(l => l.mask), PLANES = pick(l => l.plane), ADAPTERS = pick(l => l.adapter);
  const BY = Object.freeze(Object.fromEntries(LIST.map(l => [l.code, l])));

  function cssVars(el) {
    el = el || (typeof document !== 'undefined' && document.documentElement);
    if (el && el.style) for (const l of LIST) el.style.setProperty('--ly-' + l.code, l.col);
  }

  return { LIST: Object.freeze(LIST), ORDER, MASK, PLANES, ADAPTERS, BY, cssVars };
});
