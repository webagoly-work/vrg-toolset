// suggest.js — web suggestions for the omnibox, fetched by serve.js (the page cannot: the sites' CORS rules, and on the
// phone every request off the app's origin is refused). Off until the user turns "Webes javaslatok" on, because every
// keystroke then goes to that site. Only the query is sent: no cookies, no history. Answers are cached for 10 minutes.
//   const s = createSuggest({ guard }); await s.get('google', 'kábel') → ['kábel 3x2,5', …]
'use strict';

const SOURCES = {
  google: q => 'https://suggestqueries.google.com/complete/search?client=firefox&hl=hu&q=' + encodeURIComponent(q),
  ddg: q => 'https://duckduckgo.com/ac/?type=list&q=' + encodeURIComponent(q),
  'wiki-hu': q => 'https://hu.wikipedia.org/w/api.php?action=opensearch&format=json&limit=8&namespace=0&search=' + encodeURIComponent(q),
  'wiki-en': q => 'https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=8&namespace=0&search=' + encodeURIComponent(q),
};

// every source answers in the OpenSearch shape [query, [suggestions…], …]
function parse(body) {
  let j;
  try { j = JSON.parse(body); } catch (e) { return []; }
  const list = Array.isArray(j) && Array.isArray(j[1]) ? j[1] : [];
  return list.filter(s => typeof s === 'string').map(s => s.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120)).filter(Boolean).slice(0, 8);
}

function createSuggest(opts) {
  const guard = opts.guard;
  const cache = new Map();
  const TTL = 10 * 60 * 1000;
  async function get(source, q) {
    const make = SOURCES[source];
    const query = String(q || '').trim().slice(0, 100);
    if (!make || query.length < 2) return [];
    const k = source + '\u0000' + query.toLowerCase();
    const hit = cache.get(k);
    if (hit && Date.now() - hit.at < TTL) return hit.list;
    const r = await guard.get(make(query), { maxBytes: 64 * 1024, timeout: 4000, accept: 'application/json,*/*;q=0.5' });
    const list = r.status === 200 ? parse(new TextDecoder(r.charset && /8859-2|1250/.test(r.charset) ? 'iso-8859-2' : r.charset && /8859-1|1252/.test(r.charset) ? 'windows-1252' : 'utf-8').decode(r.body)) : [];
    cache.set(k, { at: Date.now(), list });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return list;
  }
  return { get, sources: () => Object.keys(SOURCES) };
}

module.exports = { createSuggest, parse, SOURCES };
