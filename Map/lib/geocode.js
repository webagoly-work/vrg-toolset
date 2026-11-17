// geocode.js — the VRG Térkép offline geocoder, shared by the page (vrg-terkep.html) and Node
// (tools/build-jobs.js, test/). Dependency-free; no network.
//
//   const G = require('./geocode.js')        // Node
//   window.VRGGeocode                         // browser, after <script src="/lib/geocode.js">
//
//   G.buildIndex(d)          d = the parsed Map/data/addresses.json -> index object
//   G.search(idx, text)      -> up to 8 results { kind, title, sub, lon, lat, zoom, score, prec }
//   G.parseQuery(text)       -> { hn, pc, district, rest }
//   G.jobQuery(text)         a written job address ("Budapest, 1051 Kalapács utca 12., 2. em.") -> the
//                            shape parseQuery reads best ("1051 Kalapács utca 12 Budapest") + its parts
//   G.geocodeJob(idx, text)  -> { lon, lat, prec, title, sub } | null; prec = cím / legközelebbi / utca / település
//
// prec says how close the point is: `cím` the house number itself, `legközelebbi` the nearest house
// number on the same street (same parity), `utca` somewhere on the street, `település` the settlement
// (or district) centre. The page shows prec only as a ring; the search UI is unchanged by it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGGeocode = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Normalised for matching: lower case, no accents, common Hungarian abbreviations expanded.
  const ABBR = { u: 'utca', krt: 'korut', sgt: 'sugarut', rkp: 'rakpart', ltp: 'lakotelep', stny: 'setany', fasor: 'fasor', bp: 'budapest' };
  const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20, xxi: 21, xxii: 22, xxiii: 23 };
  const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = s => fold(s).replace(/[.,;:()"„”]/g, ' ').split(/\s+/).filter(Boolean).map(w => ABBR[w] || w);

  const KIND = { city: 'város', town: 'város', village: 'falu', suburb: 'városrész', quarter: 'negyed', neighbourhood: 'környék', hamlet: 'tanya', borough: 'kerület' };
  const RANK = { city: 0, town: 1, borough: 2, suburb: 3, village: 4, quarter: 5, neighbourhood: 6, hamlet: 7 };
  // every query word must start one of the target's words
  const covers = (qw, tw) => qw.every(q => tw.some(t => t.startsWith(q)));

  function buildIndex(d) {
    const S = d.s;
    const streets = d.streets.map(([n, c, lon, lat]) => ({ name: S[n], city: S[c], lon: lon / 1e5, lat: lat / 1e5, key: n + '|' + c,
      w: words(S[n]), cw: words(S[c]) }));
    const addr = new Map();
    for (const [c, n, hn, pc, lon, lat] of d.addr) {
      const k = n + '|' + c; let l = addr.get(k); if (!l) addr.set(k, l = []);
      l.push({ hn, pc, lon: lon / 1e5, lat: lat / 1e5 });
    }
    const places = d.places.map(([name, kind, lon, lat]) => ({ name, kind, lon: lon / 1e5, lat: lat / 1e5, w: words(name) }));
    return { streets, addr, places, built: d.built, count: d.addr.length };
  }

  function parseQuery(text) {
    const ws = words(text);
    let hn = null, pc = null, district = null;
    const rest = [];
    ws.forEach((w, i) => {
      if (/^\d{4}$/.test(w) && (i === 0 || pc === null && hn !== null)) { pc = w; return; }
      if (/^\d+(\/?[a-z])?(\/\d+)?$/.test(w) && hn === null && i > 0) { hn = w; return; }
      if (ROMAN[w] && (ws[i + 1] === 'ker' || ws[i + 1] === 'kerulet' || /\b[ivx]+\.\s/i.test(text))) { district = ROMAN[w]; return; }
      if (/^\d{1,2}$/.test(w) && (ws[i + 1] === 'ker' || ws[i + 1] === 'kerulet')) { district = Number(w); return; }
      if (w === 'ker' || w === 'kerulet') return;
      rest.push(w);
    });
    return { hn, pc, district, rest };
  }

  function label(city, pc) {
    if (city === 'Budapest' && pc && pc[0] === '1') return pc + ' Budapest ' + toRoman(Number(pc.slice(1, 3))) + '. ker.';
    return (pc ? pc + ' ' : '') + city;
  }
  function toRoman(n) {
    return (Object.keys(ROMAN).find(k => ROMAN[k] === n) || String(n)).toUpperCase();
  }

  function search(IDX, text) {
    if (!IDX) return [];
    const q = parseQuery(text);
    if (!q.rest.length) return [];
    const out = [];
    const pcOk = p => (!q.pc || p === q.pc) && (!q.district || (p && p[0] === '1' && Number(p.slice(1, 3)) === q.district));
    // streets: the street words must be covered by street+city words, and at least one word must hit the street
    for (const s of IDX.streets) {
      const all = s.w.concat(s.cw);
      if (!covers(q.rest, all) || !q.rest.some(w => s.w.some(t => t.startsWith(w)))) continue;
      const list = IDX.addr.get(s.key) || [];
      const score = q.rest.filter(w => s.w.includes(w)).length * 2 + q.rest.filter(w => s.cw.includes(w)).length;
      if (q.hn) {
        const want = q.hn.replace('/', '');
        let hit = list.find(a => fold(a.hn).replace(/[\s/.]/g, '') === want && pcOk(a.pc));
        let approx = false;
        if (!hit && list.length) {         // nearest house number on the same street
          const n = parseInt(q.hn, 10);
          const cand = list.filter(a => pcOk(a.pc) && !isNaN(parseInt(a.hn, 10)) && parseInt(a.hn, 10) % 2 === n % 2);
          cand.sort((a, b) => Math.abs(parseInt(a.hn, 10) - n) - Math.abs(parseInt(b.hn, 10) - n));
          hit = cand[0]; approx = !!hit;
        }
        if (hit) {
          out.push({ kind: 'cím', title: s.name + ' ' + hit.hn + (approx ? ' (legközelebbi)' : ''), sub: label(s.city, hit.pc), lon: hit.lon, lat: hit.lat, zoom: 18.2,
            score: score + (approx ? 3 : 5), prec: approx ? 'legközelebbi' : 'cím' });
          continue;
        }
      }
      if ((q.pc || q.district) && list.length && !list.some(a => pcOk(a.pc))) continue;
      const a0 = list.find(a => pcOk(a.pc));
      out.push({ kind: 'utca', title: s.name, sub: label(s.city, a0 && a0.pc), lon: s.lon, lat: s.lat, zoom: 16.8, score, prec: 'utca' });
    }
    for (const p of IDX.places) {
      if (!covers(q.rest, p.w)) continue;
      const exact = p.w.join(' ') === q.rest.join(' ');
      out.push({ kind: KIND[p.kind] || p.kind, title: p.name, sub: '', lon: p.lon, lat: p.lat,
        zoom: p.kind === 'city' ? 11.5 : p.kind === 'town' ? 13 : 14.2, score: (exact ? 6 : 2) + (q.hn ? -4 : 0) - (RANK[p.kind] || 0) * 0.2, prec: 'település' });
    }
    out.sort((a, b) => b.score - a.score || a.title.length - b.title.length);
    const seen = new Set();
    return out.filter(r => { const k = r.kind + r.title + r.sub; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  }

  // ---------------------------------------------------------------- job addresses
  // A written address carries more than the search box needs: floor, door, "felső emeleti lakás", a
  // postcode after the city, placeholder dots. jobQuery keeps postcode + settlement + street + number.
  const STREET_TYPE = '(?:utca|u\\.?|út|útja|tér|tere|körút|krt\\.?|sor|köz|sétány|stny\\.?|lakótelep|ltp\\.?|fasor|lejtő|park|rakpart|rkp\\.?|dűlő|sugárút|sgt\\.?|liget|kert|árok|udvar)';
  const STREET_RX = new RegExp('([A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű][\\wÁÉÍÓÖŐÚÜŰáéíóöőúüű.-]*(?:\\s+[A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű][\\wÁÉÍÓÖŐÚÜŰáéíóöőúüű.-]*){0,3})\\s+' + STREET_TYPE + '(?=[\\s.,]|$)\\s*(\\d+(?:\\s*\\/\\s*[a-zA-Z0-9]+|[a-zA-Z](?![a-zA-Z]))?)?', 'u');
  function jobQuery(text) {
    let t = String(text || '').replace(/[…]+|\.{2,}/g, ' ').replace(/\s+/g, ' ').trim();
    const pcm = /(?:^|[\s,])([1-9]\d{3})(?=\.?(?:[\s,]|$))/.exec(t);
    const pc = pcm ? pcm[1] : null;
    if (pcm) t = (t.slice(0, pcm.index) + ' ' + t.slice(pcm.index + pcm[0].length)).replace(/^[\s.,]+/, '');
    const dm = /\b([IVX]{1,5})\.\s*(?:ker(?:ület)?\.?)/i.exec(t);
    const district = dm ? dm[1].toUpperCase() + '. ker.' : '';
    if (dm) t = t.slice(0, dm.index) + ' ' + t.slice(dm.index + dm[0].length);
    const sm = STREET_RX.exec(t);
    let street = '', hn = '', city = '';
    if (sm) {
      street = sm[0].replace(/\s+\d.*$/, '').trim();
      hn = (sm[2] || '').replace(/\s+/g, '');
      // the settlement: whatever word-run is left outside the street part, before the first comma
      const outside = (t.slice(0, sm.index) + ',' + t.slice(sm.index + sm[0].length)).split(',')
        .map(s => s.replace(/[.\d]/g, ' ').trim()).filter(s => s && /^[A-ZÁÉÍÓÖŐÚÜŰ]/.test(s));
      city = (outside[0] || '').split(/\s+/).slice(0, 2).join(' ');
      // "Budapest Kalapács utca 12": the street regex swallowed the city in front of the street name
      if (!city) {
        const lead = /^(Budapest|Bp\.?)\s+/i.exec(street);
        if (lead) { city = 'Budapest'; street = street.slice(lead[0].length); }
      }
    } else {
      city = (t.split(',').map(s => s.replace(/[.\d]/g, ' ').trim()).filter(Boolean)[0] || '').split(/\s+/).slice(0, 2).join(' ');
    }
    if (/^bp\.?$/i.test(city)) city = 'Budapest';
    const query = [pc, street, hn, city, district].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return { query, pc, street, hn, city, district };
  }

  function geocodeJob(IDX, text) {
    if (!IDX || !text) return null;
    const p = jobQuery(text);
    const tries = [];
    if (p.street) tries.push(p.query);
    if (p.street && p.pc) tries.push([p.street, p.hn, p.city].filter(Boolean).join(' '));   // a wrong postcode must not lose the street
    if (p.street && p.city) tries.push([p.street, p.hn].filter(Boolean).join(' '));          // only for the border-street check below
    const RANKP = { 'cím': 0, 'legközelebbi': 1, 'utca': 2 };
    const cityW = p.city ? words(p.city) : [];
    let best = null, stray = null;
    for (const q of tries) {
      const r = search(IDX, q).filter(x => x.prec !== 'település');
      // the street result must sit in the right settlement when one is named
      const ok = r.find(x => !cityW.length || covers(cityW, words(x.sub || '')) || covers(cityW, words(x.title)));
      if (ok && (!best || RANKP[ok.prec] < RANKP[best.prec])) best = ok;
      // OSM sometimes files a border street under the neighbour (a Budapest postcode, the street in the
      // next village): kept only when the street name is unique, and flagged
      if (!ok && !stray && p.street) {
        const sw = words(p.street);
        const named = r.filter(x => x.prec !== 'település' && covers(sw, words(x.title)));
        const cities = new Set(named.map(x => x.sub.replace(/^\d{4}\s*/, '')));
        if (named.length && cities.size === 1) stray = named[0];
      }
    }
    if (best) return { lon: best.lon, lat: best.lat, prec: best.prec, title: best.title, sub: best.sub };
    if (stray) return { lon: stray.lon, lat: stray.lat, prec: stray.prec, title: stray.title, sub: stray.sub, otherCity: stray.sub.replace(/^\d{4}\s*/, '') };
    if (p.city) {
      const r = search(IDX, p.city).filter(x => x.prec === 'település');
      const exact = r.find(x => fold(x.title) === fold(p.city)) || r[0];
      if (exact) return { lon: exact.lon, lat: exact.lat, prec: 'település', title: exact.title, sub: '' };
    }
    return null;
  }

  return { ABBR, ROMAN, KIND, RANK, fold, words, covers, buildIndex, parseQuery, search, label, toRoman, jobQuery, geocodeJob };
});
