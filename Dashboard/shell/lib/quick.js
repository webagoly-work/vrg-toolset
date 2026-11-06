// quick.js — the quick bar (WP-30): what a typed line means, and the per-user history of lines. Shared with the page as window.VRGQuick.
//   route(input, { items }) → { kind, target, text }      pure
//     kind: none | google | ai | stack | code | chat | note | filter | url | server | command
//     target: a web.open target (srch:<id>:<words>, srv:<id>, omni:<text>, an http(s) URL) or a palette id; '' when the kind needs none
//     text: the words after the prefix
//   items: the palette index ([{ id, hu, en, kind }]); a plain word that matches one of them is a command, anything else is a Google search
//   PREVIEW[kind] → the Hungarian line shown under the input
//   loadHotkey(file) → the Electron accelerator for the bar (config/keymap.json "quick")
//   createHistory({ file }) → { list(), add(line) }      last 50 lines, newest first
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGQuick = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAX_HISTORY = 50, MAX_INPUT = 500;
  const DEFAULT_HOTKEY = 'Control+Alt+K';
  const PREVIEW = { none: '', google: 'Enter: Google keresés', ai: 'Enter: AI keresés', stack: 'Enter: Rétegverem', code: 'Enter: kódkeresés',
    chat: 'Enter: új Claude-beszélgetés', note: 'Enter: jegyzet', filter: 'Enter: parancs', command: 'Enter: parancs', url: 'Enter: megnyitás', server: 'Enter: megnyitás' };
  // "<prefix> <words>": the prefix needs a space and words after it; a bare "ai" is just a word
  const PREFIX = { g: 'google', ai: 'ai', '?': 'ai', s: 'stack', k: 'code', c: 'chat', n: 'note' };

  // the same shapes as shell/lib/search.js toUrl (host.tld, localhost:port, http(s) URL, srv:<id>)
  const HOST_TLD = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?(?:[/?#]\S*)?$/i;
  const LOCALHOST = /^localhost:\d{1,5}(?:[/?#]\S*)?$/i;
  const HTTP = /^https?:\/\/\S+$/i;
  const SRV = /^srv:([a-z0-9_-]{1,40})$/i;

  const google = q => ({ kind: 'google', target: 'srch:google:' + q, text: q });

  function paletteSearch() {
    if (typeof module === 'object' && module.exports) return require('./palette.js').search;
    return typeof self !== 'undefined' && self.VRGPaletteLib ? self.VRGPaletteLib.search : null;
  }

  function route(input, { items = [] } = {}) {
    const s = String(input == null ? '' : input).trim().slice(0, MAX_INPUT);
    if (!s) return { kind: 'none', target: '', text: '' };

    if (s[0] === '>') return { kind: 'filter', target: '', text: s.slice(1).trim() };
    if (s[0] === '?' && s.length > 1) { const q = s.slice(1).trim(); if (q) return { kind: 'ai', target: 'srch:ai:' + q, text: q }; }
    const m = /^(\S+)\s+(\S[\s\S]*)$/.exec(s);
    if (m && Object.prototype.hasOwnProperty.call(PREFIX, m[1].toLowerCase())) {
      const kind = PREFIX[m[1].toLowerCase()], q = m[2].trim();
      if (kind === 'google') return google(q);
      if (kind === 'ai') return { kind, target: 'srch:ai:' + q, text: q };
      return { kind, target: '', text: q };
    }

    if (!/\s/.test(s)) {
      if (SRV.test(s)) return { kind: 'server', target: s.toLowerCase(), text: s };
      if (HTTP.test(s)) return { kind: 'url', target: s, text: s };
      if (LOCALHOST.test(s) || HOST_TLD.test(s)) return { kind: 'url', target: 'omni:' + s, text: s };
    }

    const search = paletteSearch();
    const hasWord = /[a-z0-9]/.test(s.normalize('NFD').toLowerCase());          // the palette matcher treats a line with no word as "everything"
    const hit = hasWord && search && Array.isArray(items) ? search(items, s, [])[0] : null;
    if (hit && typeof hit.id === 'string') return { kind: 'command', target: hit.id, text: s };
    return google(s);
  }

  function loadHotkey(file, fs) {
    try {
      const j = JSON.parse((fs || require('fs')).readFileSync(file, 'utf8'));
      if (typeof j.quick === 'string' && /^(?:(?:Control|Ctrl|Alt|Shift)\+)+[A-Za-z0-9]$/.test(j.quick)) return j.quick;
    } catch (e) {}
    return DEFAULT_HOTKEY;
  }

  function createHistory({ file }) {
    const fs = require('fs'), path = require('path');
    const read = () => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(j) ? j.filter(x => typeof x === 'string').slice(0, MAX_HISTORY) : []; } catch (e) { return []; } };
    return {
      list: read,
      add(line) {
        const s = String(line == null ? '' : line).trim().slice(0, MAX_INPUT);
        if (!s) return;
        const next = [s, ...read().filter(x => x !== s)].slice(0, MAX_HISTORY);
        try { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(next)); fs.renameSync(tmp, file); } catch (e) {}
      },
    };
  }

  return { route, loadHotkey, createHistory, PREVIEW, DEFAULT_HOTKEY, MAX_HISTORY };
});
