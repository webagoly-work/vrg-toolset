// 51-grammar.js — K2-03: every building says what it holds (docs/city/v2/README.md §7, CITY-D59 A: low-poly, made in
// code). One instanced mesh stays one instance per file (picking, lenses, selection, roads and the replay are
// unchanged): the house geometry carries a gable roof whose ridge the shader raises per building (aPitch), and the
// facade, window rhythm and roof material come from the typology (aKind). The lens still owns the colour; materials
// only tint it, fully on the plain Alap lens (uMat, 07-lens).
//
// Typologies (aKind):           measured details on top (per shown commit):
//  0 plaster house  (default)    height = commits, footprint = lines, lit windows = recency (as before)
//  1 brick townhouse (.js .ts …) aChurn: scaffolding when it changed 4+ times in the week before
//  2 timber house   (.md, docs)  aAge:   patina and ivy with the time since its last change
//  3 stone house    (compiled)   aOwn:   the awning's colour = the main author
//  4 shop           (.html)      aVar:   a stable hash: pitch, window rhythm, which houses get awnings
//  5 barn / store   (data)
//  6 shed           (scripts, tests)
//  7 glass tower    (any house over 16 high, decided in the shader as it grows)
//  8 gallery        (images, audio, fonts)
//  9 villa          (Villanegyed: white, flat-roofed, panoramic glass)
// 10 college hall   (Akadémia: pale plaster, tall windows, slate roofs)
// K2-04: the district re-styles the typology (README §4: a .js house is brick in the Munkásnegyed, plaster in the
// Akadémia, glass downtown) and is packed beside it: aGram.x = kind + 16 × district code (02-grow GROWTH_DISTRICTS).

const GRAMMAR_EXT = [
  [1, /\.(m?js|cjs|jsx|ts|tsx|vue|svelte|py|rb|go|rs|java|kt|swift|lua|php)$/i],
  [2, /\.(md|mdx|txt|rst|adoc)$/i],
  [3, /\.(c|h|cpp|hpp|cc|cs|ino|s|asm|csproj|sln|dll|exe|so|wasm)$/i],
  [4, /\.html?$/i],
  [5, /\.(json|jsonl|csv|tsv|ya?ml|xml|toml|ini|sql|db|sqlite|lock|map)$/i],
  [6, /\.(cmd|bat|ps1|psm1|sh|bash|zsh|mk)$|(^|\/)makefile$/i],
  [8, /\.(png|jpe?g|gif|svg|webp|ico|bmp|mp3|wav|ogg|mp4|webm|ttf|otf|woff2?)$/i],
];
const GRAMMAR_PITCH = { 0: [0.45, 0.35], 1: [0.55, 0.4], 2: [0.95, 0.3], 3: [0.42, 0.12], 4: [0.25, 0.25], 5: [0.78, 0.2], 6: [0.32, 0.15], 8: [0, 0] };

function grammarKind(f) {
  if (/(^|\/)(tests?|spec|__tests__)\/|\.(test|spec)\.[a-z]+$/i.test(f.p)) return 6;
  for (const [k, re] of GRAMMAR_EXT) if (re.test(f.p)) return k;
  return 0;
}
// the district's version of a typology
function grammarDistrictKind(kind, dist) {
  switch (dist) {
    case 1: return kind <= 1 ? 10 : kind;          // Akadémia: code and plain houses are college halls
    case 2: return kind <= 3 ? 7 : kind;           // Belváros: offices of glass
    case 3: return kind <= 4 ? 9 : kind;           // Villanegyed
    case 4: return kind <= 3 ? 1 : kind;           // OmniComm Lakópark: brick terraces
    case 5: return kind <= 4 ? 6 : kind;           // Ipari part: sheds and works
    case 6: return kind === 0 ? 1 : kind;          // Munkásnegyed: brick
    default: return kind;
  }
}
function grammarPitch(f, kind, v, dist) {
  if (dist === 2 || dist === 3) return 0;                                    // downtown and the villas: flat
  if (dist === 4) return 0.62;                                               // a terrace: one roof line
  if (dist === 5) return v < 0.5 ? 0 : 0.3;                                  // works: flat or low
  if (kind === 5 && f.maxLoc > 5000) return 0;                    // a big data file is a flat-roofed vault
  if (kind === 6 && /(^|\/)(tests?|spec|__tests__)\//i.test(f.p)) return 0;   // the training yard's hall
  if ((kind === 0 || kind === 1 || kind === 4) && v < 0.18) return 0;          // now and then a modern flat roof
  const [a, b] = GRAMMAR_PITCH[kind] || GRAMMAR_PITCH[0];
  return a + b * v;
}

// the house: the walls of the unit box (no top), and a gable roof over it whose ridge runs along the object x axis —
// the frontage, so a grown street's houses turn their eaves to the road. aRoof 2 = ridge vertex (raised by the shader),
// aSide = which slope (its normal is set in the shader), 0 elsewhere. With pitch 0 the roof is the flat top.
function houseGeometry() {
  const pos = [], nrm = [], house = [];
  const tri = (a, b, c, n, r = [0, 0, 0], s = 0) => { for (const [p, k] of [[a, 0], [b, 1], [c, 2]]) { pos.push(...p); nrm.push(...n); house.push(r[k], s); } };
  const quad = (a, b, c, d, n, r, s) => { tri(a, b, c, n, r && [r[0], r[1], r[2]], s); tri(a, c, d, n, r && [r[0], r[2], r[3]], s); };
  const X = 0.5, Z = 0.5;
  quad([-X, 0, Z], [X, 0, Z], [X, 1, Z], [-X, 1, Z], [0, 0, 1]);          // front (+z)
  quad([X, 0, -Z], [-X, 0, -Z], [-X, 1, -Z], [X, 1, -Z], [0, 0, -1]);     // back
  quad([X, 0, Z], [X, 0, -Z], [X, 1, -Z], [X, 1, Z], [1, 0, 0]);          // right (+x)
  quad([-X, 0, -Z], [-X, 0, Z], [-X, 1, Z], [-X, 1, -Z], [-1, 0, 0]);     // left
  quad([-X, 0, -Z], [X, 0, -Z], [X, 0, Z], [-X, 0, Z], [0, -1, 0]);       // floor (for the raycaster's closed box)
  // the two slopes: eave (y 1, z ±0.5) to ridge (y 1, z 0; aRoof 2)
  quad([-X, 1, Z], [X, 1, Z], [X, 1, 0], [-X, 1, 0], [0, 1, 0], [0, 0, 2, 2], 1);
  quad([X, 1, -Z], [-X, 1, -Z], [-X, 1, 0], [X, 1, 0], [0, 1, 0], [0, 0, 2, 2], -1);
  // the gables (degenerate when flat)
  tri([X, 1, Z], [X, 1, -Z], [X, 1, 0], [1, 0, 0], [0, 0, 2]);
  tri([-X, 1, -Z], [-X, 1, Z], [-X, 1, 0], [-1, 0, 0], [0, 0, 2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aHouse', new THREE.Float32BufferAttribute(house, 2));   // (roof part, slope side)
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// per-instance attributes, set once per city (03-scene's showCity)
function grammarAttrs(geo, files) {
  const n = files.length, gram = new Float32Array(n * 4);   // (kind, pitch, var, owner) per file
  files.forEach((f, i) => {
    const dist = f.distG || 0, k = grammarDistrictKind(grammarKind(f), dist), v = growU(f.p, 9);
    gram.set([k + 16 * dist, grammarPitch(f, k, v, dist), v, typeof f.own === 'number' && f.own >= 0 ? f.own : -1], i * 4);
  });
  geo.setAttribute('aGram', new THREE.InstancedBufferAttribute(gram, 4));
  geo.setAttribute('aWear', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage));   // (churn, age)
  grammar.T = -1;
}

// scaffolding and patina follow the shown commit (05-replay's writeInstances calls this; it works only when T changed)
const grammar = { T: -1 };
function grammarTime() {
  if (!world || replay.T === grammar.T) return;
  const wear = world.buildings.geometry.attributes.aWear;
  if (!wear) return;
  grammar.T = replay.T;
  const c = current.city.commits, T = replay.T, t7 = c[T] ? c[T][0] - 7 * 86400 : 0;
  let lo = 0, hi = T;                       // the first commit of the week before T
  while (lo < hi) { const m = (lo + hi) >> 1; if (c[m][0] < t7) lo = m + 1; else hi = m; }
  for (let i = 0; i < wear.count; i++) {
    const tl = replay.touch[i], week = countUpTo(tl, T) - countUpTo(tl, lo - 1);
    wear.array[i * 2] = week >= 4 ? Math.min(1, (week - 3) / 3) : 0;
    wear.array[i * 2 + 1] = ageOf(i);
  }
  wear.needsUpdate = true;
}
