// Sketcher/lib/fieldkit.js — the VRG Sketcher field-kit engine for the Desktop page and the Node tools.
//
// The same language and the same answers as the phone's Kotlin engine (Mobile/android/sketch-core FieldKit.kt):
// conditions, facts, the shadow questionnaire, keyword suggestions, the shot list, loose ends. Proof: the fixture
// Sketcher/test/fixtures/shadow.json is written by this file (tools/make-fixture.js) and replayed by FieldKitTest on
// the JVM. Change the rules here and there together, then re-run make-fixture.js.
//
// Works in Node (module.exports) and in the browser (window.VRGFieldKit). No dependencies.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VRGFieldKit = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KIND = 'vrg-fieldkit', VARIANT_KIND = 'vrg-sketcher-variant', SKETCH_KIND = 'vrg-vazlat';
  const COND_KINDS = ['scope', 'answer', 'room', 'point', 'tag', 'kw', 'chip', 'photo', 'site', 'variant'];
  const FRESH_MS = 10 * 60 * 1000;

  const fold = s => String(s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  const ids = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : typeof v === 'string' ? [v] : v === true ? ['true'] : [];

  // ---- conditions ----------------------------------------------------------------------------------------------
  function parseCond(v) {
    if (v === undefined || v === null || v === true) return { t: true };
    if (v === false) return { t: false };
    if (Array.isArray(v)) return { any: v.map(parseCond) };
    if (typeof v !== 'object') throw new Error('unknown condition: ' + JSON.stringify(v));
    if ('all' in v) return { all: (v.all || []).map(parseCond) };
    if ('any' in v) return { any: (v.any || []).map(parseCond) };
    if ('not' in v) return { not: parseCond(v.not) };
    const k = Object.keys(v).find(x => COND_KINDS.includes(x));
    if (!k) throw new Error('unknown condition: ' + JSON.stringify(v));
    return { of: k, ids: ids(v[k]), opts: k === 'answer' && 'is' in v ? ids(v.is) : null };
  }
  function evalCond(c, f) {
    if ('t' in c) return c.t;
    if (c.all) return c.all.every(x => evalCond(x, f));
    if (c.any) return c.any.some(x => evalCond(x, f));
    if (c.not) return !evalCond(c.not, f);
    const has = set => c.ids.some(x => set.has(x));
    switch (c.of) {
      case 'scope': return has(f.scope);
      case 'answer': return c.ids.some(q => f.answers.has(q) && (c.opts === null || c.opts.some(o => f.answers.get(q).has(o))));
      case 'room': return has(f.rooms);
      case 'point': return has(f.points);
      case 'tag': return has(f.tags);
      case 'kw': return has(f.kw);
      case 'chip': return has(f.chips);
      case 'photo': return has(f.photos);
      case 'site': return f.site === c.ids.includes('true');
      case 'variant': return f.variant != null && c.ids.includes(f.variant);
    }
    return false;
  }

  // ---- the catalog ---------------------------------------------------------------------------------------------
  const effect = o => {
    if (!o) return null;
    const a = o.answer || null, e = { scope: Array.isArray(o.scope) ? o.scope.slice() : [], q: a && a.q || null, opt: a && a.opt || null, text: a && a.text || null };
    return !e.scope.length && !e.q ? null : e;
  };
  function lists(o) {
    return {
      fronts: (o.fronts || []).slice(), purposes: (o.purposes || []).slice(),
      chips: (o.chips || []).map(c => Object.assign({}, c, { sets: effect(c.sets), open: !!c.open })),
      scope: (o.scope || []).slice(),
      keywords: (o.keywords || []).map(k => Object.assign({}, k, { rx: new RegExp(k.re), suggest: effect(k.suggest) })),
      questions: (o.questions || []).map(q => Object.assign({}, q, { prio: q.prio || 1, who: q.who || 'ugyfel', cond: parseCond(q.when),
        options: (q.options || []).map(p => Object.assign({}, p, { sets: effect(p.sets) })) })),
      shotlist: (o.shotlist || []).map(h => Object.assign({}, h, { need: h.need || 1, prio: h.prio || 1, room: h.room || null, cond: parseCond(h.when) })),
      templates: (o.templates || []).slice(),
    };
  }
  function parseKit(o) { if (!o || o.kind !== KIND) throw new Error('not a field kit'); return lists(o); }
  function withVariant(kit, v) {
    if (!v) return kit;
    const add = lists(v), out = {};
    for (const k of Object.keys(kit)) {
      const a = add[k] || [], ids = new Set(a.map(x => x.id));
      out[k] = kit[k].map(b => ids.has(b.id) ? a.find(x => x.id === b.id) : b).concat(a.filter(x => !kit[k].some(b => b.id === x.id)));
    }
    return out;
  }

  // ---- facts ---------------------------------------------------------------------------------------------------
  const tagsOf = (s, target) => (s.tagUses || []).filter(u => u.target === target).map(u => (s.tags || []).find(t => t.id === u.tag)).filter(Boolean);
  const texts = s => (s.entries || []).map(e => [e.id, e.text || '']).concat((s.memos || []).map(m => [m.id, m.text || '']), (s.captures || []).map(c => [c.id, c.note || '']));
  function hits(kit, s) {
    const out = new Map(), ts = texts(s).filter(t => t[1].trim()).map(t => [t[0], fold(t[1])]);
    for (const k of kit.keywords) for (const [id, t] of ts) { const m = k.rx.exec(t); if (m) { out.set(k.id, [id, m[0].trim()]); break; } }
    return out;
  }
  function facts(kit, s) {
    const rooms = new Set();
    (s.rooms || []).forEach(r => { (r.kinds || []).forEach(k => rooms.add(k));
      tagsOf(s, r.id).forEach(t => { if (t.preset && t.preset.startsWith('kind:')) rooms.add(t.preset.slice(5)); }); });
    const photos = new Set((s.captures || []).map(c => c.purpose || 'egyeb'));
    if ((s.photos || []).some(p => (p.shots || []).length)) photos.add('szoba');
    const answers = new Map();
    Object.entries(s.answers || {}).forEach(([q, a]) => { if ((a.state || 'answered') === 'answered') answers.set(q, new Set(a.options || [])); });
    const site = s.site || null;
    return {
      scope: new Set(Object.entries(s.scope || {}).filter(([, v]) => v > 0).map(([k]) => k)), answers, rooms,
      points: new Set((s.points || []).map(p => p.type || 'pont')), tags: new Set((s.tagUses || []).map(u => u.tag)),
      kw: new Set(hits(kit, s).keys()), chips: new Set((s.entries || []).flatMap(e => e.chips || [])), photos,
      site: !!(site && ((site.address || '').trim() || site.lat != null)), variant: s.variantOn ? (s.variant || null) : null,
    };
  }

  // ---- the shadow ----------------------------------------------------------------------------------------------
  function questions(kit, s, f, now) {
    f = f || facts(kit, s); now = now == null ? Date.now() : now;
    const A = s.answers || {}, seen = s.seen || {}, idx = new Map(kit.questions.map((q, i) => [q.id, i]));
    const rank = a => !a ? 0 : (a.state || 'answered') === 'answered' ? 2 : a.state === 'later' ? 1 : 0;
    return kit.questions.filter(q => evalCond(q.cond, f) && !(A[q.id] && A[q.id].state === 'skip'))
      .map(q => ({ q, answer: A[q.id] || null, fresh: !A[q.id] && (seen[q.id] == null || now - seen[q.id] < FRESH_MS),
        done: !!A[q.id] && (A[q.id].state || 'answered') === 'answered', later: !!A[q.id] && A[q.id].state === 'later' }))
      .sort((a, b) => rank(a.answer) - rank(b.answer) || a.q.prio - b.q.prio
        || (seen[a.q.id] == null ? Infinity : seen[a.q.id]) - (seen[b.q.id] == null ? Infinity : seen[b.q.id]) || idx.get(a.q.id) - idx.get(b.q.id));
  }
  // NaN guard: Infinity - Infinity is NaN, which sort treats as 0 (equal) — the same as Kotlin's equal Long.MAX_VALUE.
  const unseen = (kit, s, f) => { f = f || facts(kit, s); const seen = s.seen || {}; return kit.questions.filter(q => evalCond(q.cond, f) && !(q.id in seen)).map(q => q.id); };

  function answered(e, s) { const a = (s.answers || {})[e.q]; return !!a && ((a.state || 'answered') === 'answered' || a.state === 'skip'); }
  function applied(e, s) {
    const sc = s.scope || {};
    if (e.scope.length && e.scope.every(x => (sc[x] || 0) > 0)) return !e.q || answered(e, s);
    if (!e.scope.length && e.q) return answered(e, s);
    return false;
  }
  function suggestions(kit, s) {
    const out = [], dis = new Set(s.dismissed || []);
    for (const [k, hit] of hits(kit, s)) {
      const kw = kit.keywords.find(x => x.id === k); if (!kw || !kw.suggest) continue;
      const e = Object.assign({}, kw.suggest, { text: kw.suggest.text ? kw.suggest.text.replace('$0', hit[1]) : null });
      const id = 'kw:' + k;
      if (!dis.has(id) && !applied(e, s)) out.push({ id, keyword: k, effect: e, match: hit[1], source: hit[0] });
    }
    return out;
  }
  function apply(kit, e, s, now) {
    if (!e) return s;
    const o = Object.assign({}, s, { scope: Object.assign({}, s.scope || {}), answers: Object.assign({}, s.answers || {}) });
    e.scope.forEach(x => { o.scope[x] = Math.max(1, o.scope[x] || 0); });
    if (e.q) {
      const q = kit.questions.find(x => x.id === e.q), old = o.answers[e.q];
      const opts = e.opt == null ? (old ? old.options : []) : q && q.multi ? Array.from(new Set((old ? old.options : []).concat([e.opt]))) : [e.opt];
      o.answers[e.q] = { options: opts, text: e.text != null ? e.text : old ? old.text : '', at: now, state: 'answered' };
    }
    return o;
  }

  function shots(kit, s, f) {
    f = f || facts(kit, s);
    const items = kit.shotlist.filter(h => evalCond(h.cond, f)), have = new Map(items.map(h => [h.id, 0]));
    const caps = s.captures || [];
    caps.filter(c => c.shot != null).forEach(c => { if (have.has(c.shot)) have.set(c.shot, have.get(c.shot) + 1); });
    caps.filter(c => (c.shot == null || !have.has(c.shot)) && c.kind !== 'signature').forEach(c => {   // a signature fills no item (M47)
      const it = items.find(h => h.purpose === (c.purpose || 'egyeb') && h.room == null && have.get(h.id) < h.need);
      if (it) have.set(it.id, have.get(it.id) + 1);
    });
    items.filter(h => h.room != null).forEach(h => {
      const rooms = new Set((s.rooms || []).filter(r => (r.kinds || []).includes(h.room) || tagsOf(s, r.id).some(t => t.preset === 'kind:' + h.room)).map(r => r.id));
      const n = (s.photos || []).filter(p => rooms.has(p.room)).map(p => (p.shots || []).length);
      have.set(h.id, n.length ? Math.max(...n) : 0);
    });
    return items.map(h => ({ item: h, have: have.get(h.id), done: have.get(h.id) >= h.need }))
      .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || a.item.prio - b.item.prio);
  }

  const SIDES = { 0: 'É', 90: 'K', 180: 'D', 270: 'Ny' };
  // loose ends; norm = {rooms:[{id, name, kinds, inferred}]} or null (the Desktop gets it from the package's plan)
  function open(kit, s, norm, f) {
    f = f || facts(kit, s);
    const out = [], chipLabel = c => (kit.chips.find(x => x.id === c) || {}).label;
    if ((s.draft || '').trim()) out.push({ front: 'jegyzet', kind: 'draft', ref: 'draft', label: 'Félbehagyott jegyzet: ' + s.draft.slice(0, 40) });
    (s.entries || []).filter(e => e.open).forEach(e => out.push({ front: 'jegyzet', kind: 'entry', ref: e.id,
      label: ('Tisztázandó: ' + ((e.text || '') || (e.chips || []).map(chipLabel).filter(Boolean).join(', '))).slice(0, 'Tisztázandó: '.length + 60) }));
    suggestions(kit, s).forEach(g => out.push({ front: 'jegyzet', kind: 'suggestion', ref: g.id, label: 'Javaslat a jegyzetből: „' + g.match + '”' }));
    questions(kit, s, f).filter(x => !x.done && x.q.prio === 1).forEach(x => out.push({ front: 'kerdes', kind: 'question', ref: x.q.id, label: x.q.q }));
    shots(kit, s, f).filter(x => !x.done && x.item.prio === 1).forEach(x => out.push({ front: 'kamera', kind: 'shot', ref: x.item.id,
      label: 'Fotó: ' + x.item.label + (x.item.need > 1 ? ' (' + x.have + '/' + x.item.need + ')' : '') }));
    (s.photos || []).filter(p => (p.shots || []).length >= 1 && p.shots.length <= 3).forEach(p => out.push({ front: 'vazlat', kind: 'photo', ref: p.id,
      label: 'Fotópont: hiányzik ' + [0, 90, 180, 270].filter(d => !p.shots.some(x => ((x.deg % 360) + 360) % 360 === d)).map(d => SIDES[d]).join(', ') }));
    if (norm) (norm.rooms || []).filter(r => r.inferred).forEach(r => out.push({ front: 'vazlat', kind: 'room', ref: r.id, label: 'Becsült méret: ' + (r.name || r.id) }));
    (s.points || []).filter(p => (p.type || 'pont') === 'pont').forEach(p => out.push({ front: 'vazlat', kind: 'point', ref: p.id, label: 'Típus nélküli pont' }));
    if ((s.points || []).some(p => p.type === 'board')) (s.circuits || []).filter(c => !c.board && (c.members || []).length).forEach(c => out.push({ front: 'vazlat', kind: 'circuit', ref: c.id, label: 'Nincs bekötve: ' + c.name }));
    (s.captures || []).filter(c => (c.purpose || 'egyeb') === 'egyeb' && !(c.note || '').trim()).forEach(c => out.push({ front: 'kamera', kind: 'capture', ref: c.id, label: 'Fotó cél nélkül' }));
    if (!s.site || (!(s.site.address || '').trim() && s.site.lat == null)) out.push({ front: 'helyszin', kind: 'site', ref: 'site', label: 'Nincs cím' });
    return out;
  }

  // ---- validation (the variant protocol's gate) -----------------------------------------------------------------
  function checkLists(o, where, errs, known) {
    const seen = {};
    for (const k of ['fronts', 'purposes', 'chips', 'scope', 'keywords', 'questions', 'shotlist', 'templates']) {
      if (o[k] !== undefined && !Array.isArray(o[k])) { errs.push(where + ': ' + k + ' must be a list'); continue; }
      (o[k] || []).forEach((x, i) => {
        const at = where + ' ' + k + '[' + i + ']';
        if (!x || typeof x.id !== 'string' || !/^[a-z0-9][a-z0-9_.:-]*$/.test(x.id)) errs.push(at + ': id must be lower-case ascii');
        else { if (seen[k + x.id]) errs.push(at + ': duplicate id ' + x.id); seen[k + x.id] = 1; }
        if (k === 'keywords') { try { new RegExp(x.re); } catch (e) { errs.push(at + ': bad regex ' + e.message); } if (/[A-ZÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(x.re || '')) errs.push(at + ': regex must be folded (lower case, no accents)'); }
        try { if ('when' in x) parseCond(x.when); } catch (e) { errs.push(at + ': ' + e.message); }
        if (k === 'questions') {
          if (!x.q) errs.push(at + ': q text missing');
          if (!Array.isArray(x.options) || x.options.length < 2 || x.options.length > 6) errs.push(at + ': 2-6 options');
          (x.options || []).forEach((p, j) => { if (!p.id || !p.label) errs.push(at + ' option ' + j + ': id and label'); });
        }
        if (k === 'shotlist' && known && !known.purposes.has(x.purpose)) errs.push(at + ': unknown purpose ' + x.purpose);
        if (k === 'templates') {
          const p = x.poly;
          if (!Array.isArray(p) || p.length < 3 || p.some(q => !Array.isArray(q) || q.length !== 2 || q.some(v => typeof v !== 'number' || v < 0 || v > 1)))
            errs.push(at + ': poly = 3+ points within the unit square');
        }
      });
    }
  }
  function validateKit(o) {
    const errs = [];
    if (!o || o.kind !== KIND) return ['kind must be ' + KIND];
    checkLists(o, 'kit', errs, { purposes: new Set((o.purposes || []).map(p => p.id)) });
    return errs;
  }
  const RAIL_TOOLS = ['select', 'memo', 'tag', 'room', 'line', 'measure', 'point', 'circuit', 'board', 'route', 'photo', 'template'];
  const POINT_TYPES = ['pont', 'socket', 'switch', 'light', 'junction', 'data', 'fixed', 'sensor', 'board'];
  const ROOM_KINDS = ['nappali', 'konyha', 'halo', 'furdo', 'wc', 'eloszoba', 'kozlekedo', 'etkezo', 'dolgozo', 'kamra', 'gepeszet', 'gyerek', 'gardrob', 'mosokonyha', 'kulter', 'egyeb'];
  const PLUGINS = ['alaprajz', 'villany', 'fotopont'];
  function validateVariant(v, kit) {
    const errs = [];
    if (!v || v.kind !== VARIANT_KIND) return ['kind must be ' + VARIANT_KIND];
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(v.id || '')) errs.push('id: 2-41 chars, a-z 0-9 -');
    if (!v.name) errs.push('name missing');
    if (!v.premise || v.premise.length < 20) errs.push('premise: one to three sentences');
    if (v.topics !== undefined && (!Array.isArray(v.topics) || v.topics.some(t => typeof t !== 'string'))) errs.push('topics: a list of words');
    const known = { purposes: new Set((kit && kit.purposes || []).map(p => p.id).concat((v.purposes || []).map(p => p.id))) };
    checkLists(v, 'variant', errs, known);
    (v.rail || []).forEach(t => { if (!RAIL_TOOLS.includes(t)) errs.push('rail: unknown tool ' + t); });
    (v.pointRing || []).forEach(t => { if (!POINT_TYPES.includes(t)) errs.push('pointRing: unknown type ' + t); });
    (v.pointPresets || []).forEach((p, i) => { if (!p.label || !POINT_TYPES.includes(p.type)) errs.push('pointPresets[' + i + ']: label and a known type'); });
    (v.roomRing || []).forEach(k => { if (!ROOM_KINDS.includes(k)) errs.push('roomRing: unknown room kind ' + k); });
    if ((v.roomRing || []).length > 7) errs.push('roomRing: at most 7 (the wheel has 7 kinds a ring)');
    const pl = v.plugins || {};
    (pl.on || []).concat(pl.off || []).forEach(p => { if (!PLUGINS.includes(p)) errs.push('plugins: unknown ' + p); });
    const sc = v.scopePreset || {};
    if (typeof sc !== 'object' || Array.isArray(sc)) errs.push('scopePreset: {scope id: qty}');
    const scopeIds = new Set((kit && kit.scope || []).map(x => x.id).concat((v.scope || []).map(x => x.id)));
    Object.keys(sc).forEach(k => { if (kit && !scopeIds.has(k)) errs.push('scopePreset: unknown scope ' + k); });
    (v.tags || []).forEach((t, i) => { if (!t.id || !t.name) errs.push('tags[' + i + ']: id and name'); });
    return errs;
  }

  return { KIND, VARIANT_KIND, SKETCH_KIND, FRESH_MS, fold, parseCond, evalCond, parseKit, withVariant, facts, hits, questions, unseen,
    suggestions, applied, apply, shots, open, tagsOf, validateKit, validateVariant, RAIL_TOOLS, POINT_TYPES, ROOM_KINDS };
});
