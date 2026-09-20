// Stable VRG id assignment.
//
// vrg_id is the primary key of the inventory and must never change once handed
// out: user lists, project files and QR payloads reference it. The registry
// below is therefore the authority, not the export order — rebuilding from the
// raw documents, adding items or reordering them must all leave existing ids
// untouched.
//
// Registry format (data/vrg-id-registry.json):
//   { "version": 1, "next": 222, "map": { "<legacy_id>": "VRG-0001", ... } }
//
// legacy_id is the DANIELLA article number, which was the primary key in the
// Phase 0 snapshot (schema 1.0.0).

const fs = require('fs');
const path = require('path');

const WIDTH = 4;
const PREFIX = 'VRG-';

function fmt(n) {
  return PREFIX + String(n).padStart(WIDTH, '0');
}

function load(file) {
  if (!fs.existsSync(file)) return { version: 1, next: 1, map: {} };
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (r.version !== 1) throw new Error('unknown id registry version: ' + r.version);
  return r;
}

/**
 * Assign a vrg_id to every legacy id, reusing existing assignments.
 * Returns { map, assigned, reused } and rewrites the registry on disk.
 */
function assign(file, legacyIds) {
  const reg = load(file);
  const used = new Set(Object.values(reg.map));
  let assigned = 0, reused = 0;
  for (const legacy of legacyIds) {
    if (reg.map[legacy]) { reused++; continue; }
    let id = fmt(reg.next);
    while (used.has(id)) id = fmt(++reg.next);   // defensive: never reissue
    reg.map[legacy] = id;
    used.add(id);
    reg.next++;
    assigned++;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(reg, null, 1) + '\n', 'utf8');
  return { map: reg.map, assigned, reused };
}

module.exports = { assign, load, fmt };
