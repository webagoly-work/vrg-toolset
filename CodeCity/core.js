// core.js — the city's question engine in Node, for the MCP server (mcp.js) and tests.
//
// It does not re-implement anything: it loads the page's own DOM-free modules (01-data, 02-layout,
// 05-replay, 09-ask) into a vm context, so `city_query` and the page's query bar are the same code
// and cannot drift apart. The only stubs are the two things those modules touch outside themselves:
// a THREE.Matrix4 that 05-replay creates at load, and `roads.importers`, which 08-roads fills in the page.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const MODULES = ['01-data.js', '02-layout.js', '05-replay.js', '09-ask.js'];
const PRELUDE = `
const THREE = { Matrix4: class { makeScale() { return this; } setPosition() { return this; } } };
let current = null;
const roads = { importers: [] };
const hu = n => n.toLocaleString('hu-HU');
`;
const POSTLUDE = `
globalThis.__core = {
  open(city) {
    current = cityModel(city);
    layoutCity(current);
    replayPrepare(current);
    roads.importers = city.files.map(() => []);
    city.files.forEach((f, i) => (f.imp || []).forEach(j => roads.importers[j].push(i)));
    replay.T = replay.last;
    return current;
  },
  at(T) { replay.T = Math.max(0, Math.min(replay.last, T)); return replay.T; },
  get T() { return replay.T; }, get last() { return replay.last; },
  runQuery, neighboursOf, heatCounts, agentShareOf, ageOf, stateAt, fileAtT, dirStats, countUpTo,
  importers: i => roads.importers[i],
};
`;
let script = null;
function compiled() {
  if (!script) {
    const src = MODULES.map(f => `// ==== src/${f}\n` + fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')).join('\n');
    script = new vm.Script(PRELUDE + src + POSTLUDE, { filename: 'kodvaros-core.js' });
  }
  return script;
}

// a fresh engine over one city (city.json as scan.js wrote it); T starts at "now"
function openCity(city) {
  if (!city || city.kind !== 'vrg-codecity') throw new Error('not a Kódváros city.json');
  const ctx = vm.createContext({});
  compiled().runInContext(ctx);
  const core = ctx.__core;
  core.model = core.open(city);
  core.city = city;
  return core;
}

module.exports = { openCity };
