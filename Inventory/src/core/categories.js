// Category resolution and tree building.
//
// Two taxonomies coexist on purpose:
//   kategoria.*            the vendor's OFFICIAL category — authoritative, empty today
//   kategoria_javaslat.*   a provisional AI guess from the product name
// resolve() prefers the official one and flags which was used, so the UI can
// mark provisional rows and Phase 6 can measure its own progress.

const UNCLASSIFIED = '(besorolatlan)';

function resolve(item) {
  const off = item.kategoria || {};
  if (off.fo || off.al) {
    return { fo: off.fo || UNCLASSIFIED, al: off.al || UNCLASSIFIED, ut: off.ut || null, official: true };
  }
  const sug = item.kategoria_javaslat || {};
  return {
    fo: sug.fo || UNCLASSIFIED,
    al: sug.al || UNCLASSIFIED,
    ut: null,
    official: false
  };
}

function key(item) {
  const c = resolve(item);
  return c.fo + ' / ' + c.al;
}

/**
 * Parse a DANIELLA-style ancestor path, which the webshop prints leaf-most
 * first: "/Szerelvény- és kötődobozok/Installáció technika/" -> the department
 * is the LAST segment.
 */
function parsePath(ut) {
  if (!ut) return { segments: [], fo: null };
  const segments = ut.split('/').map(s => s.trim()).filter(Boolean);
  return { segments, fo: segments.length ? segments[segments.length - 1] : null };
}

function formatPath(segments) {
  return segments.length ? '/' + segments.join('/') + '/' : '';
}

/** Two-level tree, sorted Hungarian, with counts and an official/provisional flag. */
function buildTree(items) {
  const tree = new Map();
  for (const it of items) {
    const c = resolve(it);
    if (!tree.has(c.fo)) tree.set(c.fo, { nev: c.fo, count: 0, official: c.official, children: new Map() });
    const node = tree.get(c.fo);
    node.count++;
    if (!c.official) node.official = false;
    if (!node.children.has(c.al)) node.children.set(c.al, { nev: c.al, count: 0, official: c.official });
    node.children.get(c.al).count++;
  }
  const byName = (a, b) => a.nev.localeCompare(b.nev, 'hu');
  return [...tree.values()]
    .map(n => Object.assign({}, n, { children: [...n.children.values()].sort(byName) }))
    .sort(byName);
}

/** How far Phase 6 has got. */
function officialCoverage(items) {
  const total = items.length;
  const done = items.filter(it => resolve(it).official).length;
  return { total, done, pct: total ? Math.round((done / total) * 1000) / 10 : 0 };
}

export { UNCLASSIFIED, resolve, key, parsePath, formatPath, buildTree, officialCoverage };
