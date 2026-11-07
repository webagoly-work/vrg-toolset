// VRG Stack — the link registry. Every relation the stack knows, with its concept-map verb
// (STK-Q17 = A: one verb per link type, so a link reads as a sentence: "Planner — indítja → START").
//
//   rel: { hu, en, back, scope, inferred }
//     hu / en   the verb read from a to b
//     back      the verb read from b to a (Hungarian), for cards that list incoming links
//     scope     'h' horizontal (inside one layer) · 'v' vertical (across layers) · 'any'
//     inferred  true when the link is guessed (name match, '?' in the source), not quoted
// A relation that is not listed here is a schema warning in HEALTH.md, so a new adapter has to
// register its verbs before its links count.
'use strict';

const R = (hu, en, back, scope = 'h', inferred = false) => ({ hu, en, back, scope, inferred });

const LINKS = {
  // F · Featured
  part: R('része', 'is part of', 'tartalmazza'),
  launch: R('indítja', 'launches', 'innen indul'),
  grows: R('ebből nő', 'grows into', 'ebből nőtt'),
  feeds: R('táplálja', 'feeds', 'táplálja ez'),
  uses: R('használja', 'uses', 'használja ez'),
  look: R('kinézetét adja', 'gives the look of', 'kinézete innen'),
  // I · Ideas (a trailing '?' marks an inferred link; see rel())
  dev: R('továbbfejlődik', 'develops into', 'ebből fejlődött'),
  fork: R('leágazik', 'forks into', 'innen ágazott le'),
  merge: R('beolvad', 'merges into', 'beolvadt ide'),
  trig: R('kiváltja', 'triggers', 'kiváltotta ez'),
  feed: R('táplálja', 'feeds', 'táplálja ez'),
  meth: R('módszert ad', 'lends its method to', 'módszere innen'),
  // Q · Decisions, G · Globe
  holds: R('tartalmazza', 'holds', 'benne van'),
  flags: R('jelzi', 'flags', 'jelzés rá'),
  // L · DevLog
  next: R('utána jön', 'comes before', 'előtte volt'),
  'absorbed-by': R('beolvadt', 'was absorbed by', 'magába olvasztotta'),
  'overruled-by': R('felülírta', 'was overruled by', 'felülírta ezt'),
  'on-line': R('ezen a vonalon', 'works on line', 'munkamenete'),
  // R · DevRepo, C · Code
  parent: R('szülője', 'is parent of', 'szülője ez'),
  'merged-in': R('beolvasztva', 'is merged into', 'beolvasztotta'),
  contains: R('tartalmazza', 'contains', 'benne van'),
  // U · Futás (runtime)
  ran: R('lefuttatta', 'ran as', 'futása', 'v'),
  touched: R('hozzányúlt', 'touched', 'hozzányúlt ez', 'v'),
  'on-day': R('ezen a napon', 'ran on day', 'futott aznap'),
  // vertical joins (build: lib/join.js)
  'ref:p': R('útvonalra hivatkozik', 'names the path of', 'útvonalát említi', 'v'),
  'ref:c': R('commitra hivatkozik', 'names commit', 'commitját említi', 'v'),
  'ref:s': R('munkamenetre hivatkozik', 'names session', 'munkamenetét említi', 'v'),
  'ref:m': R('memóriára hivatkozik', 'names memory note', 'memóriáját említi', 'v'),
  'ref:q': R('döntésre hivatkozik', 'names decision', 'döntését említi', 'v'),
  'ref:go': R('kódszóra hivatkozik', 'names codephrase', 'kódszavát említi', 'v'),
  'ref:ln': R('vonalra hivatkozik', 'names dev line', 'vonalát említi', 'v'),
  'ref:ft': R('funkcióra hivatkozik', 'names feature', 'funkcióját említi', 'v'),
  same: R('ugyanaz, mint', 'is the same thing as', 'ugyanaz, mint', 'v'),
  alike: R('hasonló nevű', 'has a name like', 'hasonló nevű', 'v', true),
  pillar: R('az oszlophoz tartozik', 'belongs to pillar', 'tagja', 'v'),
};

/* The registry entry for a relation as it appears on an edge ('fork?' → fork, inferred). */
function rel(name) {
  const inferred = name.endsWith('?');
  const base = LINKS[inferred ? name.slice(0, -1) : name];
  if (!base) return null;
  return inferred ? { ...base, inferred: true } : base;
}

/* A link as a sentence, for cards and the MindMap export. */
const sentence = (a, name, b, lang = 'hu') => { const r = rel(name); return r ? `${a} — ${r[lang]} → ${b}` : `${a} — ${name} → ${b}`; };

module.exports = { LINKS, rel, sentence };
