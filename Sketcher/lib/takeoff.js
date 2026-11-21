// Sketcher/lib/takeoff.js — the VRG Sketcher takeoff engine: a survey → its work items and quantities (Munkakör lap).
//
// The survey (kind vrg-vazlat, v2) plus its solved plan (the vrg-sketch package's plan, or the raw sketch at a default
// scale) and the rules (Sketcher/catalog/takeoff.json) give ONE document, kind vrg-sketch-takeoff v1
// (docs/sketcher/TAKEOFF.md): the scope by group, the work items (points by type and action, machines, circuits,
// boards, cable metres, systems, other wants), the open decisions that change a quantity (⚑), what is guessed (≈),
// the answers, the notes with their chips, the photos by purpose and the rooms; and a Hungarian summary (.md).
// No prices: pricing belongs to the Varler Workflow Kit.
//
// The Kotlin engine (Mobile/android/sketch-core Takeoff.kt) implements the same rules; Sketcher/test/fixtures/takeoff.json
// is written by this file (tools/make-takeoff-fixture.js) and replayed by TakeoffTest on the JVM, document AND summary,
// so the phone and the Desktop never disagree. Change the rules here and there together.
//
// Arithmetic is kept identical on both sides: plan coordinates are integer mm, a segment is sqrt(dx*dx+dy*dy) (never
// hypot: its last bit differs between V8 and the JVM), a route is rounded to the mm, metres to 0.1 with Math.round.
//
// Works in Node (module.exports) and in the browser (window.VRGTakeoff, after window.VRGFieldKit). No dependencies.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./fieldkit.js') : root.VRGFieldKit);
  if (node) module.exports = api; else root.VRGTakeoff = api;
})(typeof self !== 'undefined' ? self : this, function (FK) {
  'use strict';
  const KIND = 'vrg-sketch-takeoff', V = 1, RULES_KIND = 'vrg-takeoff-rules';
  const GROUPS = [['jelleg', 'A munka jellege'], ['terulet', 'Terület'], ['rendszer', 'Rendszerek'], ['igeny', 'Igények']];

  function parseRules(o) {
    if (!o || o.kind !== RULES_KIND) throw new Error('not takeoff rules');
    return o;
  }

  // ---- numbers, the same on both sides --------------------------------------------------------------------------
  const m1 = mm => Math.round(mm / 100) / 10;                        // mm → metres, 0.1
  const a1 = mm2 => Math.round(mm2 / 1e5) / 10;                      // mm² → m², 0.1
  function fmt(x) {                                                  // 12 → "12", 12.5 → "12,5"
    const r = Math.round(x * 10);
    if (r % 10 === 0) return String(r / 10);
    const neg = r < 0, a = Math.abs(r);
    return (neg ? '-' : '') + Math.floor(a / 10) + ',' + (a % 10);
  }
  function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(s) / 2; }
  const seg = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; return Math.sqrt(dx * dx + dy * dy); };

  // ---- the plan view: geometry in integer mm ------------------------------------------------------------------------
  // {solved, rooms:[{id, name, kinds, poly, est}], pts:{id → {x, y, h}}, routes:{id → [[x, y]…]}}
  function planFromPackage(pkg) {
    const d = pkg && pkg.plan && pkg.plan.data;
    if (!d) return null;
    const rooms = (d.floors || []).filter(f => f && Array.isArray(f.poly) && f.poly.length >= 3 && f.sk && f.sk.id).map(f => ({
      id: f.sk.id, name: f.name || '', kinds: Array.isArray(f.kinds) ? f.kinds.slice() : [],
      poly: f.poly.map(p => [Math.round(p[0]), Math.round(p[1])]), est: !!(Array.isArray(f.sk.est) && f.sk.est.length) }));
    const pts = {};
    (d.devices || []).forEach(v => { if (v && v.sk && v.sk.id) pts[v.sk.id] = { x: Math.round(v.x), y: Math.round(v.y), h: Math.round(v.h) }; });
    const routes = {};
    (d.paths || []).forEach(p => { if (p && p.sk && p.sk.id && Array.isArray(p.nodes) && p.nodes.length >= 2) routes[p.sk.id] = p.nodes.map(n => [Math.round(n.x), Math.round(n.y)]); });
    return { solved: true, rooms, pts, routes };
  }
  const LEVELS = ['basement', 'ground', 'upper'];
  const levelOf = s => LEVELS.includes(s.level) ? s.level : 'ground';
  const typeOf = p => (FK.POINT_TYPES.includes(p.type) ? p.type : 'pont');
  const levelH = (rules, level) => { const l = (rules.levels || []).find(x => x[0] === level) || (rules.levels || []).find(x => x[0] === 'ground'); return l ? l[1] : 2700; };
  const ptRule = (rules, type) => (rules.points || []).find(p => p.id === type) || (rules.points || []).find(p => p.id === 'pont');
  function roomKinds(s, r) {
    const k = (r.kinds || []).slice();
    FK.tagsOf(s, r.id).forEach(t => { if (t.preset && t.preset.startsWith('kind:')) k.push(t.preset.slice(5)); });
    return k.filter((x, i) => k.indexOf(x) === i);
  }
  // no solved plan (a bare survey file): the sketch at the default scale, everything a guess
  function planRaw(s, rules) {
    const k = rules.cable.rawScaleMm, R = v => Math.round(v * k), ceil = levelH(rules, levelOf(s));
    const rooms = (s.rooms || []).filter(r => (r.poly || []).length >= 3).map(r => ({ id: r.id, name: r.name || '', kinds: roomKinds(s, r),
      poly: r.poly.map(p => [R(p[0]), R(p[1])]), est: true }));
    const pts = {};
    (s.points || []).forEach(p => {
      const pr = ptRule(rules, typeOf(p)), onWall = p.room != null && p.edge != null && p.t != null;
      pts[p.id] = { x: R(p.at[0]), y: R(p.at[1]), h: pr.ceiling && !onWall ? ceil : pr.h };
    });
    const routes = {};
    (s.routes || []).forEach(r => { if ((r.pts || []).length >= 2) routes[r.id] = r.pts.map(p => [R(p[0]), R(p[1])]); });
    return { solved: false, rooms, pts, routes };
  }

  // ---- helpers over the survey ------------------------------------------------------------------------------------
  const tagHit = (tags, spec) => !!spec && tags.some(t => (spec.presets || []).includes(t.preset) || (spec.names || []).includes(FK.fold(t.name)));
  function actionOf(s, rules, p) {
    const tags = FK.tagsOf(s, p.id);
    if (tagHit(tags, rules.removeTags)) return 'bontas';
    if (tagHit(tags, rules.replaceTags)) return 'csere';
    return (p.st || 'tervezett') === 'meglevo' ? 'marad' : 'uj';
  }
  const scopeQ = (s, id) => { const v = (s.scope || {})[id]; return typeof v === 'number' && v > 0 ? v : 0; };
  const answered = (s, q) => { const a = (s.answers || {})[q]; return a && (a.state || 'answered') === 'answered' ? a : null; };
  const scopeItem = (kit, id) => kit.scope.find(x => x.id === id) || null;
  const roomTitle = r => r.name || r.kinds.join(' + ') || r.id;
  const stemOf = s => (FK.fold(s.name || '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'vazlat').slice(0, 40);

  function item(id, cat, label, sym, unit, qty, o) {
    o = o || {};
    return { id, cat, label, sym, unit, qty, est: !!o.est, work: o.work !== false, open: [], note: o.note || '', refs: o.refs || [] };
  }

  // ---- the takeoff ------------------------------------------------------------------------------------------------
  // opts: {now, endReserveMm, looseEndMm}
  function build(kit, rules, s, plan, opts) {
    opts = opts || {};
    plan = plan || planRaw(s, rules);
    const now = opts.now == null ? Date.now() : opts.now;
    const reserve = opts.endReserveMm == null ? rules.cable.endReserveMm : opts.endReserveMm;
    const loose = opts.looseEndMm == null ? rules.cable.looseEndMm : opts.looseEndMm;
    const ceil = levelH(rules, levelOf(s));
    const A = {}; (rules.actions || []).forEach(a => { A[a.id] = a; });
    const items = [], checks = [];
    const points = s.points || [], circuits = (s.circuits || []).filter(c => (c.members || []).length > 0);

    // points by type and action; the Igények counts reconcile with what is drawn
    let fixedDrawn = 0;
    (rules.points || []).filter(t => t.id !== 'board').forEach(t => {
      const of = points.filter(p => typeOf(p) === t.id);
      const want = (rules.scopePoints || []).filter(x => x[1] === t.id).reduce((n, x) => n + scopeQ(s, x[0]), 0);
      (rules.actions || []).forEach(a => {
        const list = of.filter(p => actionOf(s, rules, p) === a.id), drawn = list.length;
        if (t.id === 'fixed' && (a.id === 'uj' || a.id === 'csere')) fixedDrawn += drawn;
        const isNew = a.id === 'uj', qty = isNew ? Math.max(drawn, want) : drawn;
        if (qty <= 0) return;
        const note = isNew && want > 0 && want !== drawn ? 'Munkakör: ' + want + ', vázlat: ' + drawn : '';
        items.push(item('pont.' + t.id + '.' + a.id, 'pont', t.label + ' — ' + a.label, t.sym, 'db', qty,
          { est: (isNew && want > drawn) || t.id === 'pont', work: a.id !== 'marad', note, refs: list.map(p => p.id) }));
      });
    });

    // machines (gépbekötés) from the scope
    let machines = 0, implied = 0;
    (rules.machines || []).forEach(m => {
      const q = scopeQ(s, m.id); if (!q) return;
      const k = scopeItem(kit, m.id) || { label: m.id, sym: '⊗' };
      machines += q; implied += q * (m.dedicated || 0);
      items.push(item('gep.' + m.id, 'gep', k.label, k.sym, 'db', q, { refs: [] }));
    });
    if (machines > 0 && fixedDrawn > 0 && machines !== fixedDrawn) checks.push('Gépbekötés a Munkakörben: ' + machines + ', fix bekötés a vázlaton: ' + fixedDrawn);

    // systems from the scope; a count from its answer where the rules name one
    const sysItems = [];
    (rules.systems || []).forEach(y => {
      if (!scopeQ(s, y.id)) return;
      const k = scopeItem(kit, y.id) || { label: y.id, sym: '◈' };
      let qty = 1, est = false, note = '';
      if (y.qtyQ) {
        const a = answered(s, y.qtyQ), hit = a && (y.qtyMap || []).find(x => (a.options || []).includes(x[0]));
        if (hit) { qty = hit[1]; est = (y.qtyEst || []).includes(hit[0]); }
        else { est = true; note = 'a darabszám még nincs meg'; }
      }
      implied += qty * (y.dedicated || 0);
      sysItems.push(item('rendszer.' + y.id, 'rendszer', k.label, k.sym, 'db', qty, { est, note }));
    });

    // circuits: drawn ones, and the dedicated circuits the machines and systems imply
    const dedOf = c => !!c.ded || tagHit(FK.tagsOf(s, c.id), rules.dedicatedTags) || (c.members || []).some(m => tagHit(FK.tagsOf(s, m), rules.dedicatedTags));
    const ded = circuits.filter(dedOf), gen = circuits.filter(c => !dedOf(c));
    if (gen.length) items.push(item('aramkor.altalanos', 'aramkor', 'Áramkör — általános', '◌', 'db', gen.length, { refs: gen.map(c => c.id) }));
    const dq = Math.max(ded.length, implied);
    if (dq > 0) items.push(item('aramkor.dedikalt', 'aramkor', 'Áramkör — dedikált', '◉', 'db', dq, { est: implied > ded.length,
      note: implied > 0 && implied !== ded.length ? 'gépek, rendszerek szerint: ' + implied + ', vázlat: ' + ded.length : '', refs: ded.map(c => c.id) }));

    // boards: the one feeding most circuits is the main one, the others are taken for sub-boards (≈)
    const boards = points.filter(p => typeOf(p) === 'board');
    const fed = b => (s.circuits || []).filter(c => c.board === b.id).length;
    let main = null; boards.forEach(b => { if (main === null || fed(b) > fed(main)) main = b; });
    const bAct = b => { const a = actionOf(s, rules, b); return b === main && a === 'marad' && scopeQ(s, rules.boardScope) > 0 ? 'csere' : a; };
    ['eloszto', 'aleloszto'].forEach(role => (rules.actions || []).forEach(a => {
      const list = boards.filter(b => (b === main ? 'eloszto' : 'aleloszto') === role && bAct(b) === a.id);
      if (!list.length) return;
      items.push(item(role + '.' + a.id, role, (role === 'eloszto' ? 'Elosztó' : 'Alelosztó') + ' — ' + a.label, '▣', 'db', list.length,
        { est: role === 'aleloszto', work: a.id !== 'marad', note: role === 'aleloszto' ? 'alelosztónak vettük' : '', refs: list.map(b => b.id) }));
    }));
    if (!boards.length && scopeQ(s, rules.boardScope) > 0)
      items.push(item('eloszto.csere', 'eloszto', 'Elosztó — ' + A.csere.label, '▣', 'db', 1, { est: true, note: 'a vázlaton nincs elosztó' }));
    const nb = answered(s, rules.newBoardQ);
    if (nb && (nb.options || []).includes(rules.newBoardOpt) && !items.some(x => x.id === 'eloszto.uj')) {
      const q = kit.questions.find(x => x.id === rules.newBoardQ);
      items.push(item('eloszto.uj', 'eloszto', 'Elosztó — ' + A.uj.label, '▣', 'db', 1, { est: true, note: 'a válasz szerint: ' + (q ? q.q : rules.newBoardQ) }));
    }

    // cable: every route (its solved length + a drop at each end), then the home runs nobody drew (≈)
    const drop = id => { const p = id != null ? plan.pts[id] : null; return p ? Math.max(0, ceil - p.h) + reserve : loose; };
    const inEst = pt => plan.rooms.some(r => r.est && (() => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      r.poly.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
      return pt[0] >= x0 - 1 && pt[0] <= x1 + 1 && pt[1] >= y0 - 1 && pt[1] <= y1 + 1; })());
    const cname = id => { const c = (s.circuits || []).find(x => x.id === id); return c ? c.name || c.id : ''; };
    let rtot = 0, rest = false; const rparts = [], rrefs = [];
    (s.routes || []).forEach(r => {
      const P = plan.routes[r.id]; if (!P) return;
      let len = 0; for (let i = 1; i < P.length; i++) len += seg(P[i - 1], P[i]);
      const mm = Math.round(len) + drop(r.a) + drop(r.b);
      rtot += mm; rrefs.push(r.id);
      if (!plan.solved || P.some(inEst)) rest = true;
      rparts.push({ ref: r.id, label: cname(r.circuit), m: m1(mm) });
    });
    if (rrefs.length) { const it = item('kabel.nyomvonal', 'kabel', 'Kábel a nyomvonalon', '〰', 'm', m1(rtot), { est: rest, refs: rrefs,
      note: 'nyomvonal + végenként ' + fmt(reserve / 1000) + ' m tartalék és a függőleges szakasz' }); it.parts = rparts; items.push(it); }
    let htot = 0; const hparts = [], hrefs = [];
    circuits.forEach(c => {
      const b = c.board != null ? plan.pts[c.board] : null; if (!b) return;
      const mem = c.members || [];
      if ((s.routes || []).some(r => plan.routes[r.id] && (r.circuit === c.id || mem.includes(r.a) || mem.includes(r.b)))) return;
      let best = null, bd = Infinity;
      mem.forEach(id => { const p = plan.pts[id]; if (!p) return; const d = Math.abs(p.x - b.x) + Math.abs(p.y - b.y); if (d < bd) { bd = d; best = id; } });
      if (best === null) return;
      const mm = bd + drop(c.board) + drop(best);
      htot += mm; hrefs.push(c.id); hparts.push({ ref: c.id, label: c.name || c.id, m: m1(mm) });
    });
    if (hrefs.length) { const it = item('kabel.bekotes', 'kabel', 'Kábel az elosztótól (rajzolatlan)', '⚡', 'm', m1(htot), { est: true, refs: hrefs,
      note: 'az elosztótól a legközelebbi pontig, derékszögben' }); it.parts = hparts; items.push(it); }
    if (scopeQ(s, 'ev')) {
      const a = answered(s, rules.cable.evCableQ), hit = a && (rules.cable.evCableM || []).find(x => (a.options || []).includes(x[0]));
      items.push(item('kabel.ev', 'kabel', 'Kábel az e-autó töltőhöz', '⚡', 'm', hit ? hit[1] : 0, { est: true, note: hit ? 'a válasz szerint' : 'a távolság még nincs meg' }));
    }

    sysItems.forEach(x => items.push(x));

    // the other countable wants
    const covered = new Set((rules.scopePoints || []).map(x => x[0]).concat((rules.machines || []).map(m => m.id)));
    kit.scope.filter(k => k.group === 'igeny' && k.qty && !covered.has(k.id) && scopeQ(s, k.id)).forEach(k =>
      items.push(item('igeny.' + k.id, 'igeny', k.label, k.sym, 'db', scopeQ(s, k.id))));

    // the open decisions that change a quantity (⚑)
    const f = FK.facts(kit, s), shadow = FK.questions(kit, s, f, now);
    const hits = (id, p) => id === p || id.startsWith(p + '.');
    const decisions = [];
    (rules.decisions || []).forEach(d => {
      const x = shadow.find(y => y.q.id === d.q); if (!x || x.done) return;
      const aff = items.filter(it => d.affects.some(p => hits(it.id, p))).map(it => it.id);
      aff.forEach(id => items.find(it => it.id === id).open.push(d.q));
      decisions.push({ q: d.q, label: x.q.q, who: x.q.who, state: x.later ? 'later' : 'open', affects: aff });
    });

    // the intake as it is
    const order = new Map(kit.questions.map((q, i) => [q.id, i]));
    const optLabel = (q, o) => { const p = (q.options || []).find(x => x.id === o); return p ? p.label : o; };
    const questions = shadow.slice().sort((a, b) => order.get(a.q.id) - order.get(b.q.id)).map(x => ({ q: x.q.id, label: x.q.q, who: x.q.who,
      state: x.done ? 'answered' : x.later ? 'later' : 'open', options: (x.answer ? x.answer.options || [] : []).map(o => optLabel(x.q, o)), text: x.answer ? x.answer.text || '' : '' }));
    const chipLabel = c => { const k = kit.chips.find(x => x.id === c); return k ? k.label : c; };
    const roomName = id => { if (!id) return ''; const r = plan.rooms.find(x => x.id === id); if (r) return roomTitle(r); const q = (s.rooms || []).find(x => x.id === id); return q ? q.name || id : id; };
    const notes = (s.entries || []).map(e => ({ id: e.id, text: e.text || '', chips: (e.chips || []).map(chipLabel), room: roomName(e.room), open: !!e.open }));
    const memos = (s.memos || []).map(m => ({ id: m.id, text: m.text || '' }));
    const stem = stemOf(s), caps = s.captures || [], photos = [];
    const purposeIds = kit.purposes.map(p => p.id);
    caps.forEach(c => { const p = c.purpose || 'egyeb'; if (!purposeIds.includes(p)) purposeIds.push(p); });
    const roomShots = (s.photos || []).reduce((n, p) => n + (p.shots || []).length, 0);
    purposeIds.forEach(id => {
      const list = caps.filter(c => (c.purpose || 'egyeb') === id), n = list.length + (id === 'szoba' ? roomShots : 0);
      if (!n) return;
      const k = kit.purposes.find(p => p.id === id) || { label: id, sym: '◉' };
      photos.push({ purpose: id, label: k.label, sym: k.sym, n, files: list.map(c => stem + '_' + c.id + '_' + (c.purpose || 'egyeb') + '.jpg') });
    });
    const rooms = plan.rooms.map(r => ({ id: r.id, name: roomTitle(r), kinds: r.kinds.slice(), areaM2: a1(area(r.poly)), est: r.est }));
    const scope = GROUPS.map(([g, label]) => ({ group: g, label, items: kit.scope.filter(k => k.group === g && scopeQ(s, k.id)).map(k => ({ id: k.id, label: k.label, sym: k.sym, qty: scopeQ(s, k.id) })) }))
      .filter(g => g.items.length);

    const totalArea = a1(plan.rooms.reduce((t, r) => t + area(r.poly), 0));
    return {
      kind: KIND, v: V, made: now,
      source: { name: s.name || '', id: s.id || '', level: levelOf(s), plan: plan.solved ? 'megoldott' : 'nyers',
        variant: s.variantOn && s.variant ? s.variant : '' },
      config: { endReserveMm: reserve, looseEndMm: loose, ceilingMm: ceil },
      counts: { items: items.length, work: items.filter(x => x.work).length, est: items.filter(x => x.est).length, open: items.filter(x => x.open.length).length,
        decisions: decisions.length, tisztazando: notes.filter(n => n.open).length,
        answered: questions.filter(q => q.state === 'answered').length, questionsOpen: questions.filter(q => q.state !== 'answered').length,
        rooms: rooms.length, areaM2: totalArea, photos: photos.reduce((t, p) => t + p.n, 0) },
      scope, items, decisions, checks, questions, notes, memos, photos, rooms,
    };
  }

  // ---- the readable summary (Hungarian) ----------------------------------------------------------------------------
  function markdown(t) {
    const L = [], cell = x => String(x).replace(/\|/g, '/').replace(/\n/g, ' ');
    const flags = it => (it.est ? '≈' : '') + (it.open.length ? (it.est ? ' ' : '') + '⚑' : '');
    L.push('# Munkakör lap — ' + (t.source.name || 'Felmérés'));
    L.push('');
    L.push('*' + KIND + ' v' + t.v + ' · felmérés ' + t.source.id + ' · terv: ' + t.source.plan + (t.source.variant ? ' · variáns: ' + t.source.variant : '') +
      ' · ' + t.counts.rooms + ' helyiség, ' + fmt(t.counts.areaM2) + ' m²*');
    L.push('');
    L.push('≈ = becsült, ⚑ = nyitott döntés változtathat rajta. Árat nem tartalmaz: az árazás a Varler Workflow Kit dolga.');
    if (t.scope.length) {
      L.push(''); L.push('## Munkakör'); L.push('');
      t.scope.forEach(g => L.push('- **' + g.label + ':** ' + g.items.map(i => i.label + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ')));
    }
    L.push(''); L.push('## Tételek'); L.push('');
    if (!t.items.length) L.push('Még nincs tétel.');
    else {
      L.push('| | Tétel | Mennyiség | | Megjegyzés |'); L.push('|---|---|---|---|---|');
      t.items.forEach(it => L.push('| ' + it.sym + ' | ' + cell(it.label) + ' | ' + fmt(it.qty) + ' ' + it.unit + ' | ' + flags(it) + ' | ' + cell(it.note) + ' |'));
      const parts = t.items.filter(it => it.parts && it.parts.length);
      parts.forEach(it => { L.push(''); L.push('**' + it.label + '** szakaszonként: ' + it.parts.map(p => (p.label || p.ref) + ' ' + fmt(p.m) + ' m').join(', ')); });
    }
    if (t.decisions.length) {
      L.push(''); L.push('## Döntésre vár ⚑'); L.push('');
      const lab = id => { const it = t.items.find(x => x.id === id); return it ? it.label : id; };
      t.decisions.forEach(d => L.push('- ' + (d.state === 'later' ? '⏱ ' : '') + d.label + (d.affects.length ? ' → ' + d.affects.map(lab).join(', ') : '')));
    }
    if (t.checks.length) { L.push(''); L.push('## Ellenőrizni'); L.push(''); t.checks.forEach(c => L.push('- ' + c)); }
    const qs = t.questions;
    if (qs.length) {
      L.push(''); L.push('## Kérdések (' + t.counts.answered + ' megválaszolva, ' + t.counts.questionsOpen + ' nyitott)'); L.push('');
      qs.forEach(q => L.push('- ' + (q.state === 'answered' ? '✓' : q.state === 'later' ? '⏱' : '○') + ' ' + q.label +
        (q.options.length ? ' — ' + q.options.join(', ') : '') + (q.text ? ' — „' + q.text + '”' : '')));
    }
    if (t.notes.length || t.memos.length) {
      L.push(''); L.push('## Jegyzetek'); L.push('');
      t.notes.forEach(n => L.push('- ' + (n.open ? '⚑ Tisztázandó: ' : '') + (n.text || '(csak címke)') + (n.chips.length ? ' [' + n.chips.join(', ') + ']' : '') + (n.room ? ' · ' + n.room : '')));
      t.memos.forEach(m => L.push('- ✎ ' + m.text));
    }
    if (t.photos.length) { L.push(''); L.push('## Fotók'); L.push(''); t.photos.forEach(p => L.push('- ' + p.sym + ' ' + p.label + ': ' + p.n)); }
    if (t.rooms.length) { L.push(''); L.push('## Helyiségek'); L.push(''); t.rooms.forEach(r => L.push('- ' + r.name + ': ' + (r.est ? '≈ ' : '') + fmt(r.areaM2) + ' m²')); }
    return L.join('\n') + '\n';
  }

  // a package or a bare survey file → {sketch, plan}
  function input(o) {
    if (o && o.kind === 'vrg-sketch' && o.sketch && o.sketch.kind === FK.SKETCH_KIND) return { sketch: o.sketch, plan: planFromPackage(o) };
    if (o && o.kind === FK.SKETCH_KIND) return { sketch: o, plan: null };
    throw new Error('Ismeretlen fájl (kind: ' + (o && o.kind) + ') — vrg-sketch vagy vrg-vazlat kell.');
  }

  return { KIND, V, RULES_KIND, GROUPS, parseRules, planFromPackage, planRaw, build, markdown, input, fmt, m1, stemOf };
});
