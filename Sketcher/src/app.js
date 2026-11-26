// Sketcher/src/app.js — VRG Sketcher Desktop page: review and complete a field survey at the PC.
// The engine (window.VRGFieldKit), the catalog (window.VRG_FIELDKIT) and the variants (window.VRG_VARIANTS) are inlined by tools/build.js.
(function () {
  'use strict';
  const FK = window.VRGFieldKit, TK = window.VRGTakeoff;
  const RULES = TK.parseRules(window.VRG_TAKEOFF_RULES);
  const BASE = FK.parseKit(window.VRG_FIELDKIT);
  const VARIANTS = window.VRG_VARIANTS || [];
  const GROUPS = [['jelleg', 'Jelleg'], ['terulet', 'Terület'], ['rendszer', 'Rendszer'], ['igeny', 'Igény']];
  const TYPES = { socket: 'Dugalj', switch: 'Kapcsoló', light: 'Lámpa', junction: 'Kötődoboz', data: 'Adat', fixed: 'Fix bekötés', sensor: 'Érzékelő', board: 'Elosztó', pont: 'Típustalan' };
  const EXTRA = { attekintes: { id: 'attekintes', label: 'Áttekintés', sym: '▤', color: '#93d3e6' }, variansok: { id: 'variansok', label: 'Variánsok', sym: '◐', color: '#b08ad8' } };
  const LAST_KEY = 'vrg-sketcher-last';
  // WP M51 (D-91…D-99): every feature on its own switch, kept per browser (lib/features.js, catalog/features.json).
  // The stored list is what differs from the default; D-79's own key keeps the implied-dedicated toggle.
  const FE = window.VRGFeatures, FEAT_KEY = 'vrg-sketcher-features';
  EXTRA.funkciok = { id: 'funkciok', label: 'Funkciók', sym: '⚙', color: '#a6afb7' };

  let S = null, pkg = null, cur = 'attekintes', msg = null, fileName = '';
  let files = new Map();                       // photo file name -> object URL (memory only, never saved)
  const boxMeta = new Map(), boxImg = new Map();   // skcam K1: file name -> {f35, w, h} from EXIF, and an upright canvas (memory only)
  let note = { text: '', chips: new Set(), open: false, room: '' };
  let wantRoom = '';   // F4 (WP M49): where the Munkakör's + / − put a want: '' = Általános, else a room id
  let starter = '';

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const base = n => String(n || '').split(/[\\/]/).pop();
  const stem = () => (FK.fold(S && S.name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'vazlat').slice(0, 40);

  // ---- state helpers ---------------------------------------------------------------------------------------------
  const variantJson = () => S && S.variantOn && S.variant ? VARIANTS.find(v => v.id === S.variant) || null : null;
  const kit = () => FK.withVariant(BASE, variantJson());
  const floors = () => pkg && pkg.plan && pkg.plan.data && pkg.plan.data.floors || [];
  const norm = () => floors().length
    ? { rooms: floors().map(f => ({ id: f.sk && f.sk.id || f.id, name: f.name, inferred: !!(f.sk && f.sk.est && f.sk.est.length) })) }
    : { rooms: (S.rooms || []).map(r => ({ id: r.id, name: r.name, inferred: false })) };
  const roomName = id => {
    if (!id) return '';
    const n = norm().rooms.find(r => r.id === id);
    return n && n.name || (S.rooms || []).find(r => r.id === id)?.name || id;
  };
  const nextId = prefix => { S.seq = (S.seq || 0) + 1; return prefix + S.seq; };   // = prefix + (seq+1), then seq += 1
  const stamp = () => Date.now();

  function persist() {
    try { localStorage.setItem(LAST_KEY, JSON.stringify(pkg ? Object.assign({}, pkg, { sketch: S }) : S)); } catch (e) { /* file:// has no storage */ }
  }
  function commit(fn, rerender) {
    const r = fn(S); if (r) S = r;
    persist();
    if (rerender === false) { renderRail(); renderHeader(); } else render();
  }
  function flash(text, cls) { msg = text ? { text, cls: cls || '' } : null; }

  // ---- loading and saving ----------------------------------------------------------------------------------------
  function load(obj, name) {
    if (typeof obj === 'string') obj = JSON.parse(obj);
    if (!obj || typeof obj !== 'object') throw new Error('Nem felmérés fájl.');
    obj = clone(obj);
    pkgImplied = null;
    if (obj.kind === 'vrg-sketch' && obj.sketch && obj.sketch.kind === 'vrg-vazlat') {
      pkg = obj; S = obj.sketch; delete pkg.sketch;
      const cf = pkg.takeoff && pkg.takeoff.config;
      if (cf && typeof cf.impliedDedicated === 'boolean') pkgImplied = cf.impliedDedicated;
    }
    else if (obj.kind === 'vrg-vazlat') { pkg = null; S = obj; }
    else throw new Error('Ismeretlen fájl (kind: ' + obj.kind + ') — vrg-sketch vagy vrg-vazlat kell.');
    files.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
    files = new Map(); boxMeta.clear(); boxImg.clear(); if (typeof boxClose === 'function' && ui.open) { ui.open = false; if (boxEl) boxEl.hidden = true; }
    fileName = name || ''; note = { text: '', chips: new Set(), open: false, room: '' };
    flash(null); persist(); render();
    return S;
  }
  // the takeoff (Munkakör lap, docs/sketcher/TAKEOFF.md): from the package's solved plan, or the raw sketch (all ≈)
  // D-79: the dedicated circuits the big machines imply, only when switched on (a general setting of this browser)
  const IMPLIED_KEY = 'vrg-sketcher-implied-dedicated';
  let implied = (() => { try { return localStorage.getItem(IMPLIED_KEY) === '1'; } catch (e) { return !!RULES.impliedDedicated; } })();
  // F8 (WP M53, D-111): a package the phone exported carries its takeoff; until the toggle is touched here, the page counts
  // as the phone did (its ⚙ setting is in takeoff.config), so the Desktop shows the phone's numbers
  let pkgImplied = null;
  const impliedNow = () => pkgImplied == null ? implied : pkgImplied;
  function setImplied(on) { implied = !!on; pkgImplied = null; try { localStorage.setItem(IMPLIED_KEY, implied ? '1' : '0'); } catch (e) { /* no storage: this page only */ } FL = FE.fromStores(Object.assign(FE.toStores(FL), { implied })); }
  let FL = (() => { let g = []; try { g = FE.read(localStorage.getItem(FEAT_KEY)); } catch (e) { /* no storage */ } return FE.fromStores({ cameraOff: [], implied, general: g }); })();
  const on = id => FE.on(FL, id);
  function setFeatures(next) {
    const st = FE.toStores(next); FL = FE.read(FE.write(next));
    try { localStorage.setItem(FEAT_KEY, FE.write(st.general)); } catch (e) { /* no storage: this page only */ }
    if (st.implied !== implied) setImplied(st.implied);
    if (cur !== 'funkciok' && !viewShown(cur)) cur = 'attekintes';
  }
  const viewShown = id => id === 'attekintes' || id === 'funkciok' || (id === 'variansok' ? on('variansok.use') : FE.visibleFronts(FL, [id]).length > 0);
  function takeoff() { return TK.build(kit(), RULES, S, pkg ? TK.planFromPackage(pkg) : null, { now: stamp(), impliedDedicated: impliedNow() }); }
  // a package carries its takeoff (the Planner keeps it with the job); a bare survey file stays as it is
  function output() { return pkg ? Object.assign({}, pkg, { sketch: S, takeoff: takeoff() }) : S; }
  function download(text, name, type) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = document.createElement('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { /* no download in this environment (tests); the text is still returned */ }
  }
  function save() {
    if (!S) return null;
    const text = JSON.stringify(output(), null, 1);
    download(text, stem() + '.vsketch.json', 'application/json');
    return text;
  }
  // the intake / takeoff export for the Varler Workflow Kit: <stem>.takeoff.json + <stem>.takeoff.md
  function exportTakeoff() {
    if (!S) return null;
    const t = takeoff(), json = JSON.stringify(t, null, 1) + '\n', md = TK.markdown(t);
    download(json, stem() + '.takeoff.json', 'application/json');
    download(md, stem() + '.takeoff.md', 'text/markdown');
    return { json, md, takeoff: t };
  }
  // F5 (WP M50): the Felmérési jegyzőkönyv (Sketcher/lib/report.js), built now from the open survey; never stored
  const RP = window.VRGReport;
  function reportHtml() {
    if (!S || !RP) return '';
    const si = S.site || {}, out = si.outline || [];
    let siteSvg = '', siteLines = [];
    if (SM && out.length >= 3) {
      const rooms = siteRooms(), rep = si.place && rooms.length ? SM.report(rooms, out, si.place) : null;
      siteSvg = sitePlaceSvg(out, rooms, si.place && rooms.length ? si.place : null, rep); siteLines = rep ? SM.reportLines(rep) : [];
    }
    return RP.html(RP.model(kit(), S, takeoff(), { now: stamp(), roomName, photoUrl: thumbFor, planSvg: svgPlan(), siteSvg, siteLines }));
  }
  function openReport() {
    const h = reportHtml(); if (!h) return '';
    let w = null;
    try { w = window.open('', '_blank'); } catch (e) { w = null; }
    if (w && w.document) { w.document.open(); w.document.write(h); w.document.close(); flash('Jegyzőkönyv: új ablakban (Nyomtatás / PDF).', 'ok'); }
    else { download(h, stem() + '.jegyzokonyv.html', 'text/html'); flash('Jegyzőkönyv letöltve: ' + stem() + '.jegyzokonyv.html (a felugró ablak tiltva).', 'ok'); }
    return h;
  }
  function readFile(f) { return f.text ? f.text() : new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsText(f); }); }
  async function openFiles(list) {
    const arr = Array.from(list || []), js = arr.filter(f => /\.json$/i.test(f.name) || f.type === 'application/json'), ph = arr.filter(f => !js.includes(f));
    try {
      if (js.length) { const txt = await readFile(js[0]), o = (() => { try { return JSON.parse(txt); } catch (e) { return null; } })();
        if (H3 && H3.is(o)) houseOpen(o, js[0].name); else load(txt, js[0].name); }   // skcam K5: a .house3d.json opens the Ház 3D viewer
      if (ph.length) attach(ph);
    } catch (e) { flash(String(e.message || e), 'err'); render(); }
  }

  // ---- photos in memory ------------------------------------------------------------------------------------------
  // Kamera 2: a video is .mp4, a signature .png named "alairas" (sketch-core Intake.exportName)
  const capExt = c => c.kind === 'video' ? 'mp4' : c.kind === 'signature' ? 'png' : c.kind === 'audio' ? 'm4a' : 'jpg';   // F5: a sound note is .m4a
  function captureNames(c) {
    const n = [base(c.file), stem() + '_' + c.id + '_' + (c.kind === 'signature' ? 'alairas' : (c.purpose || 'egyeb')) + '.' + capExt(c)];
    return n.filter(Boolean);
  }
  function attach(list) {
    const want = new Set();
    (S.captures || []).forEach(c => captureNames(c).forEach(n => want.add(n)));
    (S.photos || []).forEach(p => (p.shots || []).forEach(x => want.add(base(x.file))));
(pkg && pkg.plan && pkg.plan.photos || []).forEach(p => (p.shots || []).forEach(x => want.add(base(x.file))));
    let n = 0;
    Array.from(list).forEach(f => { if (want.has(f.name)) { if (files.has(f.name)) URL.revokeObjectURL(files.get(f.name)); files.set(f.name, URL.createObjectURL(f)); boxPrep(f); n++; } });
    flash(n + ' / ' + list.length + ' fotó párosítva (csak a memóriában, a mentett fájlba nem kerül).', n ? 'ok' : '');
    render();
  }
  const thumbFor = c => { const n = captureNames(c).find(x => files.has(x)); return n ? files.get(n) : null; };

  // ---- pieces ----------------------------------------------------------------------------------------------------
  const pill = (o, extra) => '<span class="pill ' + (extra || '') + '" style="--c:' + esc(o.color || '#a6afb7') + '"><i>' + esc(o.sym || '•') + '</i>' + esc(o.label) + '</span>';
  const chipPill = id => { const c = BASE.chips.find(x => x.id === id) || kit().chips.find(x => x.id === id) || { label: id }; return pill(c); };
  const fmtTime = at => typeof at === 'number' && at > 1e11 ? new Date(at).toLocaleString('hu-HU', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; }
  const f1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const frontOf = id => BASE.fronts.find(f => f.id === id) || EXTRA[id];

  function model() {
    const fl = floors();
    if (fl.length) {
      const dev = pkg.plan.data.devices || [];
      return { unit: 'mm', polys: fl.map(f => ({ poly: f.poly, name: f.name, est: new Set(f.sk && f.sk.est || []) })),
        devs: dev.map(d => ({ x: d.x, y: d.y, st: d.sk && d.sk.st || 'tervezett', type: d.type })),
        photos: (pkg.plan.photos || []).map(p => ({ x: p.x, y: p.y, shots: p.shots || [] })) };
    }
    return { unit: 'u', polys: (S.rooms || []).map(r => ({ poly: r.poly, name: r.name || (r.kinds || [])[0] || r.id, est: new Set() })),
      devs: (S.points || []).map(p => ({ x: p.at[0], y: p.at[1], st: p.st || 'tervezett', type: p.type })),
      photos: (S.photos || []).map(p => ({ x: p.at[0], y: p.at[1], shots: p.shots || [] })) };
  }
  const bbox = pts => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);

  function svgPlan() {
    const m = model(), pts = [];
    m.polys.forEach(r => (r.poly || []).forEach(p => pts.push(p)));
    m.devs.forEach(d => pts.push([d.x, d.y])); m.photos.forEach(p => pts.push([p.x, p.y]));
    if (!pts.length) return '<div class="empty">Még nincs rajz a felmérésben.</div>';
    let b = bbox(pts); const ext = Math.max(b[2] - b[0], b[3] - b[1], 1), pad = ext * 0.08, wr = ext / 12;
    b = [b[0] - pad - wr, b[1] - pad - wr, b[2] + pad + wr, b[3] + pad + wr];
    const fs = ext * 0.03, dr = ext * 0.012;
    let out = '<svg id="plansvg" viewBox="' + b[0] + ' ' + b[1] + ' ' + (b[2] - b[0]) + ' ' + (b[3] - b[1]) + '" xmlns="http://www.w3.org/2000/svg">';
    m.polys.forEach(r => {
      const p = r.poly || []; if (p.length < 3) return;
      out += '<polygon class="fl" points="' + p.map(q => q.join(',')).join(' ') + '"/>';
      p.forEach((q, i) => {
        const n = p[(i + 1) % p.length], est = r.est.has(i), len = Math.hypot(n[0] - q[0], n[1] - q[1]);
        out += '<line class="' + (est ? 'est' : 'edge') + '" x1="' + q[0] + '" y1="' + q[1] + '" x2="' + n[0] + '" y2="' + n[1] + '"/>';
        if (est && m.unit === 'mm') out += '<text class="lbl e" font-size="' + fs * 0.85 + '" x="' + (q[0] + n[0]) / 2 + '" y="' + ((q[1] + n[1]) / 2 - fs * 0.4) + '">≈ ' + f1(len / 1000) + ' m</text>';
      });
      const bb = bbox(p);
      if (r.name) out += '<text class="lbl" font-size="' + fs + '" x="' + (bb[0] + bb[2]) / 2 + '" y="' + (bb[1] + bb[3]) / 2 + '">' + esc(r.name) + '</text>';
    });
    m.photos.forEach(p => {
      [0, 90, 180, 270].forEach(deg => {
        const has = (p.shots || []).some(s => ((s.deg % 360) + 360) % 360 === deg), pt = a => [p.x + wr * Math.sin(a * Math.PI / 180), p.y - wr * Math.cos(a * Math.PI / 180)];
        const A = pt(deg - 40), B = pt(deg + 40);
        out += '<path class="wedge ' + (has ? 'shot' : 'noshot') + '" d="M' + p.x + ' ' + p.y + ' L' + A.join(' ') + ' A' + wr + ' ' + wr + ' 0 0 1 ' + B.join(' ') + ' Z"/>';
      });
    });
    m.devs.forEach(d => { out += '<circle class="dev ' + (d.st === 'meglevo' ? 'meglevo' : 'tervezett') + '" cx="' + d.x + '" cy="' + d.y + '" r="' + dr + '"><title>' + esc(TYPES[d.type] || d.type || '') + ' (' + (d.st === 'meglevo' ? 'meglévő' : 'tervezett') + ')</title></circle>'; });
    return out + '</svg>';
  }

  // ---- fronts ----------------------------------------------------------------------------------------------------
  function derived() {
    const k = kit(), f = FK.facts(k, S), now = stamp();
    // M51 (D-93): a feature switched off leaves no trace: its cards, badges and loose ends go; the data stays
    return { k, f, qs: on('kerdes.questions') ? FK.questions(k, S, f, now) : [], shots: on('kamera.shotlist') ? FK.shots(k, S, f) : [],
      open: FK.open(k, S, norm(), f).filter(o => FE.openShown(FL, o)), sug: on('jegyzet.keywords') ? FK.suggestions(k, S) : [] };
  }

  function vAttekintes(d) {
    const sc = S.scope || {}, fl = floors();
    let h = '<div class="grid">' + (on('munkakor.summary') ? '<div class="card"><h3 style="margin-top:0">Munkakör</h3>' : '<div hidden>');
    let any = false;
    GROUPS.forEach(([g, label]) => {
      const sel = d.k.scope.filter(x => x.group === g && sc[x.id] > 0);
      if (!sel.length) return; any = true;
      h += '<div class="small muted">' + label + '</div><div>' + sel.map(x => pill({ sym: x.sym, label: x.label + (x.qty ? ' ×' + sc[x.id] : ''), color: '#3dae5a' })).join('') + '</div>';
    });
    h += (any ? '' : '<div class="muted">Még nincs kiválasztva semmi.</div>') + '</div>';
    const area = fl.reduce((a, f) => a + polyArea(f.poly || []), 0) / 1e6, pts = S.points || [];
    const byType = {}; pts.forEach(p => { const t = p.type || 'pont', k = t + '|' + (p.st === 'meglevo' ? 'meglevo' : 'tervezett'); byType[k] = (byType[k] || 0) + 1; });
    const nPlan = pts.filter(p => p.st !== 'meglevo').length, nOld = pts.length - nPlan, shotsN = (S.photos || []).reduce((a, p) => a + (p.shots || []).length, 0);
    const answered = d.qs.filter(x => x.done).length;
    h += '<div class="card"><h3 style="margin-top:0">Felmérés</h3><div class="kv">' +
      '<b>Helyiségek</b><span>' + (fl.length ? fl.length : (S.rooms || []).length) + (fl.length ? ' · ' + f1(area) + ' m²' : '') + '</span>' +
      '<b>Pontok</b><span>' + nPlan + ' tervezett · ' + nOld + ' meglévő</span>' +
      '<b></b><span class="small muted">' + (Object.keys(byType).map(k => { const [t, st] = k.split('|'); return (TYPES[t] || t) + ' ' + byType[k] + (st === 'meglevo' ? ' (m)' : ''); }).join(', ') || '—') + '</span>' +
      '<b>Áramkörök</b><span>' + (S.circuits || []).length + '</span>' +
      '<b>Fotók</b><span>' + (S.captures || []).length + ' célfotó · ' + shotsN + ' fotópont-kép</span>' +
      '<b>Jegyzetek</b><span>' + (S.entries || []).length + '</span>' +
      '<b>Kérdések</b><span>' + answered + ' megválaszolva · ' + (d.qs.length - answered) + ' nyitott</span></div></div></div>';
    h += '<h3>Nyitott szálak (első 8)</h3>' + (d.open.length ? d.open.slice(0, 8).map(leHtml).join('') : '<div class="empty">Nincs nyitott szál.</div>');
    return h;
  }
  const leHtml = o => { const f = frontOf(o.front) || {}; return '<button class="le" data-act="jump" data-front="' + esc(o.front) + '" style="--c:' + esc(f.color) + '"><span class="k">' + esc(f.sym) + '</span><span>' + esc(o.label) + '</span></button>'; };

  function vVazlat() {
    return '<div class="svgwrap">' + svgPlan() + '</div><div class="legend"><span><i style="background:#d9a441"></i>meglévő</span><span><i style="background:#27c2b0"></i>tervezett</span>' +
      '<span><i style="background:#e8641c"></i>≈ becsült él</span><span><i style="background:#2a8cdb"></i>fotópont (kitöltött = van kép)</span>' +
      '<span>' + (floors().length ? 'Terv: mm-ben (Planner adat)' : 'Csak vázlat: rajzegységben') + '</span></div>' + boxCard();
  }

  function vJegyzet(d) {
    const k = d.k, rooms = norm().rooms;
    let h = !on('jegyzet.quick') ? '' : '<div class="card"><textarea id="ntext" placeholder="Jegyzet: amit az ügyfél mondott…">' + esc(note.text) + '</textarea><div style="margin-top:6px">' +
      (on('jegyzet.chips') ? k.chips : []).map(c => '<button class="pill ' + (note.chips.has(c.id) ? 'sel' : '') + '" data-act="nchip" data-id="' + esc(c.id) + '" style="--c:' + esc(c.color) + '"><i>' + esc(c.sym) + '</i>' + esc(c.label) + '</button>').join('') +
      '</div><div class="row"><select id="nroom" style="width:auto"><option value="">(helyiség nélkül)</option>' + rooms.map(r => '<option value="' + esc(r.id) + '"' + (note.room === r.id ? ' selected' : '') + '>' + esc(r.name || r.id) + '</option>').join('') + '</select>' +
      (on('jegyzet.unclear') ? '<label class="small"><input type="checkbox" id="nopen"' + (note.open ? ' checked' : '') + '> ⚑ Tisztázandó</label>' : '') + '<span class="grow"></span><button class="btn primary" id="nadd" data-act="nadd">Hozzáad</button></div></div>';
    if (d.sug.length) {
      h += '<h3>Javaslatok a jegyzetekből</h3><div>' + d.sug.map(g => {
        const e = g.effect, parts = e.scope.map(s => (k.scope.find(x => x.id === s) || { label: s }).label);
        if (e.q) { const q = k.questions.find(x => x.id === e.q); parts.push((q ? q.q : e.q) + (e.opt ? ' → ' + ((q && q.options.find(o => o.id === e.opt) || {}).label || e.opt) : '')); }
        return '<span class="pill ghost" style="--c:#e0b020" data-sug="' + esc(g.id) + '"><i>✎</i>„' + esc(g.match) + '” → ' + esc(parts.join(', ')) +
          ' <button class="x" title="Elfogad" data-act="sugok" data-id="' + esc(g.id) + '">✓</button><button class="x" title="Elvet" data-act="sugno" data-id="' + esc(g.id) + '">✕</button></span>';
      }).join('') + '</div>';
    }
    const ents = (S.entries || []).slice().reverse();
    if (on('jegyzet.log')) h += '<h3>Napló</h3>' + (ents.length ? '<div class="tl">' + ents.map(e => '<div class="ent' + (e.open ? ' open' : '') + '" data-ent="' + esc(e.id) + '"><div class="meta"><span>' + esc(fmtTime(e.at)) + '</span>' +
      (e.room ? '<span>⌂ ' + esc(roomName(e.room)) + '</span>' : '') + (e.voice ? '<span>🎙</span>' : '') +
      (on('jegyzet.unclear') ? '<button class="flag ' + (e.open ? 'on' : '') + '" data-act="eopen" data-id="' + esc(e.id) + '" title="Tisztázandó">⚑</button>' : '') + '</div>' +
      (e.text ? '<div class="txt">' + esc(e.text) + '</div>' : '') + '<div>' + (e.chips || []).map(chipPill).join('') + '</div></div>').join('') + '</div>' : '<div class="empty">Még nincs jegyzet.</div>');
    return h;
  }

  // the Munkakör lap: the takeoff live, symbols and colours, ≈ guessed, ⚑ an open decision changes it
  function takeoffCard() {
    const t = takeoff(), c = t.counts;
    const row = it => '<div class="tk-item' + (it.work ? '' : ' keep') + (it.est ? ' est' : '') + (it.open.length ? ' open' : '') + '" data-item="' + esc(it.id) + '" title="' + esc(it.note) + '">' +
      '<span class="sym">' + esc(it.sym) + '</span><span class="lb">' + esc(it.label) + '</span><span class="q">' + (it.est ? '≈' : '') + esc(TK.fmt(it.qty)) + ' ' + esc(it.unit) + '</span>' +
      '<span class="fl">' + (it.open.length ? '⚑' : '') + '</span></div>';
    return '<div class="card tk" id="takeoff"><div class="row"><h3 style="margin:0">☰ Munkakör lap</h3><span class="grow"></span>' +
      '<span class="small muted">' + c.items + ' tétel · ≈ ' + c.est + ' · ⚑ ' + c.decisions + (c.tisztazando ? ' · Tisztázandó ' + c.tisztazando : '') + '</span>' +
      (on('export.takeoff') ? '<button class="btn sm" data-act="tkexport" title="vrg-sketch-takeoff JSON + összefoglaló .md a Workflow Kitnek">⇩ Takeoff</button>' : '') + '</div>' +
      (t.items.length ? '<div class="tk-list">' + t.items.map(row).join('') + '</div>' : '<div class="empty">Még nincs tétel: kapcsold be, mi a munka, vagy rajzolj pontokat.</div>') +
      (t.decisions.length ? '<div class="tk-dec">' + t.decisions.map(x => '<button class="pill" data-act="jump" data-front="kerdes" style="--c:#d64545"><i>⚑</i>' + esc(x.label) + '</button>').join('') + '</div>' : '') +
      '<div class="row"><button class="pill ' + (impliedNow() ? 'sel' : 'off') + '" id="tkimplied" data-act="tkimplied" style="--c:#3dae5a" title="Minden felmérésre ebben a böngészőben">' +
      '<i>◉</i>Dedikált kör a nagy gépeknek (≈)</button>' + (pkgImplied != null ? '<span class="small faint" id="tkfromphone">a telefon beállítása szerint</span>' : '') + '</div>' +
      (t.checks.length ? '<div class="small" style="color:#e0b020">' + t.checks.map(esc).join('<br>') + '</div>' : '') +
      '<div class="small faint">' + (pkg ? 'Hosszak a megoldott tervből (mm).' : 'Nincs megoldott terv: a hosszak a vázlat léptékéből, mind ≈.') + ' Árat nem tartalmaz (Workflow Kit).</div></div>';
  }

  function vMunkakor(d) {
    const sc = S.scope || {}, col = frontOf('munkakor').color, rooms = S.rooms || [];
    if (wantRoom && !rooms.some(r => r.id === wantRoom)) wantRoom = '';
    const here = (id) => wantRoom ? (((S.roomScope || {})[wantRoom] || {})[id] || 0) : null;
    return (on('munkakor.takeoff') ? takeoffCard() : '') + (on('munkakor.scope') ? GROUPS : []).map(([g, label]) => '<h3>' + label + '</h3>' + (g === 'igeny' && on('munkakor.wants') ? wantWhere(rooms) : '') + '<div>' + d.k.scope.filter(x => x.group === g).map(x => {
      const n = x.qty ? FK.wantTotal(S, x.id) : sc[x.id] || 0, h = x.qty ? here(x.id) : null;
      if (x.qty) return '<span class="stepper" data-scope="' + esc(x.id) + '" style="--c:' + (n ? col : '#a6afb7') + '"><span class="nm"><i>' + esc(x.sym) + '</i>' + esc(x.label) + '</span>' +
        '<button data-act="sdec" data-id="' + esc(x.id) + '" aria-label="kevesebb">−</button><span class="q">' + n + (h ? '<small class="here"> (' + h + ' itt)</small>' : '') + '</span><button data-act="sinc" data-id="' + esc(x.id) + '" aria-label="több">+</button></span>';
      return '<button class="pill ' + (n ? 'sel' : 'off') + '" data-act="stoggle" data-id="' + esc(x.id) + '" data-scope="' + esc(x.id) + '" style="--c:' + col + '"><i>' + esc(x.sym) + '</i>' + esc(x.label) + '</button>';
    }).join('') + '</div>' + (g === 'igeny' && on('munkakor.wants') ? wantsByRoom(d.k) : '')).join('');
  }
  // F4: where + / − go, and the wants per room (a room's own, then the job's); ⇠ / → re-link one
  function wantWhere(rooms) {
    return '<div class="row small"><span class="muted">Hová:</span><select id="wroom" style="width:auto"><option value="">Általános (a munka egésze)</option>' +
      rooms.map(r => '<option value="' + esc(r.id) + '"' + (wantRoom === r.id ? ' selected' : '') + '>' + esc(roomName(r.id)) + '</option>').join('') + '</select></div>';
  }
  function wantsByRoom(k) {
    const ws = FK.wants(k, S);
    if (!ws.some(w => w.rooms.length)) return '';
    const lab = id => { const x = k.scope.find(s => s.id === id) || {}; return (x.sym ? x.sym + ' ' : '') + (x.label || id); };
    const notes = r => (S.entries || []).filter(e => e.room === r).length;
    const rows = (S.rooms || []).map(r => [r.id, ws.map(w => [w.id, (w.rooms.find(x => x[0] === r.id) || [0, 0])[1]]).filter(x => x[1] > 0)]).filter(x => x[1].length);
    const gen = ws.filter(w => w.general > 0).map(w => [w.id, w.general]);
    const btn = (act, id, from, title, glyph) => '<button class="x" data-act="' + act + '" data-id="' + esc(id) + '" data-from="' + esc(from) + '" title="' + esc(title) + '">' + glyph + '</button>';
    return '<div class="card wants"><div class="small muted">Szobánként (összesen: ' + ws.map(w => esc(lab(w.id)) + ' ×' + w.total).join(', ') + ')</div>' +
      rows.map(([r, items]) => '<div class="wrow"><b>⌂ ' + esc(roomName(r)) + '</b> ' + items.map(([id, n]) => '<span class="pill sel" style="--c:#3dae5a">' + esc(lab(id)) + ' ×' + n +
        btn('wmove', id, r, 'egyet az Általánosba', '⇠') + '</span>').join('') + (notes(r) ? ' <span class="small muted">✎ ' + notes(r) + ' jegyzet</span>' : '') + '</div>').join('') +
      (gen.length ? '<div class="wrow"><b>Általános</b> ' + gen.map(([id, n]) => '<span class="pill" style="--c:#3dae5a">' + esc(lab(id)) + ' ×' + n +
        (wantRoom ? btn('wmove', id, '', 'egyet ide: ' + roomName(wantRoom), '→') : '') + '</span>').join('') + '</div>' : '') + '</div>';
  }

  function qCard(x) {
    const q = x.q, a = x.answer, chosen = new Set(a && a.options || []), c = frontOf('kerdes').color;
    return '<div class="card qcard' + (x.fresh && on('kerdes.fresh') ? ' fresh' : '') + (x.later ? ' later' : '') + '" data-q="' + esc(q.id) + '" style="--c:' + c + '"><div class="qt">' + esc(q.q) +
      (x.fresh && on('kerdes.fresh') ? '<span class="tag new">új</span>' : '') + (x.later ? '<span class="tag">később</span>' : '') + (q.multi ? '<span class="tag">több is</span>' : '') + '</div><div>' +
      q.options.map(o => '<button class="pill ' + (chosen.has(o.id) ? 'sel' : '') + '" data-act="qopt" data-q="' + esc(q.id) + '" data-o="' + esc(o.id) + '">' + esc(o.label) + '</button>').join('') + '</div>' +
      (q.num ? '<div class="row"><input type="text" data-qtext="' + esc(q.id) + '" value="' + esc(a && a.text) + '" placeholder="Érték"><span class="muted">' + esc(q.num.unit) + '</span></div>'
        : '<textarea data-qtext="' + esc(q.id) + '" placeholder="Megjegyzés (szabad szöveg)">' + esc(a && a.text) + '</textarea>') +
      '<div class="acts">' + (on('kerdes.later') ? '<button class="btn sm" data-act="qlater" data-q="' + esc(q.id) + '">Később</button><button class="btn sm" data-act="qskip" data-q="' + esc(q.id) + '">Nem releváns</button>' : '') +
      (a ? '<button class="btn sm dim" data-act="qclear" data-q="' + esc(q.id) + '">Törlés</button>' : '') + '</div></div>';
  }
  function vKerdes(d) {
    const op = d.qs.filter(x => !x.done), dn = d.qs.filter(x => x.done);
    const skipped = Object.keys(S.answers || {}).filter(k => S.answers[k].state === 'skip');
    return (op.length ? op.map(qCard).join('') : '<div class="empty">Nincs nyitott kérdés.</div>') +
      (dn.length ? '<details id="qdone"><summary class="muted">Megválaszolva (' + dn.length + ')</summary>' + dn.map(qCard).join('') + '</details>' : '') +
      (skipped.length ? '<p class="small muted">Nem releváns: ' + skipped.length + ' <button class="btn sm" data-act="qunskip">visszaállít</button></p>' : '');
  }

  function vKamera(d) {
    const caps = S.captures || [], purposes = BASE.purposes.concat(kit().purposes.filter(p => !BASE.purposes.some(b => b.id === p.id)));
    let h = '<div class="row"><label class="btn">Fotók csatolása<input type="file" id="fphotos" accept="image/*,video/mp4,audio/mp4,.m4a" multiple hidden></label><span class="small muted">A fájlok név szerint párosodnak; csak a memóriában maradnak.</span></div>';
    if (on('kamera.shotlist')) h += '<h3>Fotólista</h3>' + (d.shots.length ? d.shots.map(s => '<div class="shotrow ' + (s.done ? 'done' : '') + '"><span class="ck">' + (s.done ? '✓' : '○') + '</span><span><b>' + esc(s.item.label) + '</b> <span class="mono small">' + s.have + '/' + s.item.need + '</span>' +
      (s.item.hint ? '<div class="small muted">' + esc(s.item.hint) + '</div>' : '') + '</span></div>').join('') : '<div class="empty">Nincs fotólista.</div>');
    h += '<h3>Célfotók</h3>';
    const used = new Set();
    purposes.forEach(p => {
      const list = caps.filter(c => (c.purpose || 'egyeb') === p.id); if (!list.length) return; used.add(p.id);
      h += '<div class="small" style="color:' + esc(p.color) + '">' + esc(p.sym) + ' ' + esc(p.label) + ' (' + list.length + ')</div>' + list.map(capCard).join('');
    });
    const rest = caps.filter(c => !used.has(c.purpose || 'egyeb') && c.kind !== 'audio'); if (rest.length) h += rest.map(capCard).join('');
    // F5 (WP M50, D-84): the sound notes (the dictation fallback), played once their .m4a is attached
    const auds = caps.filter(c => c.kind === 'audio'); if (auds.length && on('jegyzet.audio')) h += '<h3 id="hangok">🎙 Hangjegyzetek (' + auds.length + ')</h3>' + auds.map(capCard).join('');
    if (!caps.length) h += '<div class="empty">Még nincs célfotó.</div>';
    h += vCamera2(caps);
    const pp = (S.photos || []);
    if (pp.length) h += '<h3>Fotópontok</h3>' + pp.map(p => '<div class="card"><b>' + esc(p.id) + '</b> ' + esc(roomName(p.room)) + ' ' + (p.shots || []).map(x => {
      const u = files.get(base(x.file)); return u ? '<img class="thumb" src="' + esc(u) + '" alt="' + esc(x.file) + '">' : '<span class="tag">' + esc(base(x.file)) + '</span>';
    }).join('') + (p.shots || []).map(x => planeBits(PL.keyOf(p.id, x.deg), shotImage(p.id, x), roomName(p.room) + ' · ' + sideLabel(x.deg))).join('') + '</div>').join('');
    return h;
  }
  function capCard(c) {
    const u = thumbFor(c);
    const media = !u ? '<div class="thumb">' + (c.kind === 'video' ? '▶ videó' : c.kind === 'signature' ? '✍ aláírás' : c.kind === 'audio' ? '🎙 hang' : 'nincs kép') + '</div>'
      : c.kind === 'audio' ? '<audio class="aud" src="' + esc(u) + '" controls preload="metadata"></audio>'
      : c.kind === 'video' ? '<video class="thumb" src="' + esc(u) + '" controls preload="metadata"></video>' : '<img class="thumb" src="' + esc(u) + '" alt="">';
    return '<div class="card cap-card" data-cap="' + esc(c.id) + '" data-kind="' + esc(c.kind || 'photo') + '">' + media +
      '<div><div class="mono small">' + esc(c.id) + ' · ' + esc(fmtTime(c.at)) + (c.room ? ' · ' + esc(roomName(c.room)) : '') + capBadges(c) + '</div>' +
      capExtra(c) + (c.note ? '<div>' + esc(c.note) + '</div>' : '') + planeBits(c.id, c.kind === 'photo' || !c.kind ? captureNames(c).find(n => boxImg.has(n)) : null, (BASE.purposes.find(p => p.id === c.purpose) || {}).label || c.id) +
      '<div class="small faint mono">' + esc(captureNames(c)[captureNames(c).length - 1]) + '</div></div></div>';
  }
  // ---- Kamera 2: video, signature, personal data, type-plate readings, before / after ---------------------------
  const mb = b => b > 0 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : '?';   // as Camera2.mb
  const dur = ms => { const t = Math.round((ms || 0) / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function capBadges(c) {
    const b = [];
    if (c.kind === 'video') b.push('<span class="tag" data-b="video">▶ ' + esc(dur(c.durationMs)) + ' · ' + esc(mb(c.bytes)) + '</span>');
    if (c.kind === 'signature') b.push('<span class="tag" data-b="signature">✍ aláírás</span>');
    if (c.kind === 'audio') b.push('<span class="tag" data-b="audio">🎙 ' + esc(dur(c.durationMs)) + '</span>');   // F5 (WP M50)
    if (c.privacy) b.push('<span class="tag warn" data-b="privacy">👤 személyes adat</span>');
    if ((c.marks || []).some(m => m.kind === 'elmos' || m.kind === 'elmos_ecset')) b.push('<span class="tag" data-b="blur">▦ elmosva</span>');
    if (c.phase === 'elotte') b.push('<span class="tag" data-b="before">◐ előtte</span>');
    if (c.phase === 'utana') b.push('<span class="tag" data-b="after">◑ utána: ' + esc(c.pair || '') + '</span>');
    if (c.keepGps) b.push('<span class="tag" data-b="gps">⌖ GPS marad</span>');
    return b.length ? ' ' + b.join(' ') : '';
  }
  function capExtra(c) {
    let h = '';
    if (c.kind === 'signature') h += '<div class="sig"><b>' + esc(c.signer || '—') + '</b> · ' + esc(fmtTime(c.at)) + '</div>';
    const hits = c.ocr || [];
    if (hits.length) h += '<div class="ocr small">▤ ' + hits.map(x => '<span class="tag ' + (x.used ? 'ok' : x.dropped ? 'dim' : '') + '" data-ocr="' + esc(x.kind) + '">' +
      (x.used ? '✓ ' : '') + esc(x.value) + '</span>').join(' ') + '</div>';
    return h;
  }
  function vCamera2(caps) {
    let h = '';
    const pairs = caps.filter(c => c.phase === 'utana' && c.pair).map(a => [caps.find(b => b.id === a.pair), a]).filter(p => p[0]);
    if (pairs.length && on('kamera.pairs')) h += '<h3>Előtte / utána</h3>' + pairs.map(([b, a]) => {
      const one = (c, l) => { const u = thumbFor(c); return '<figure><figcaption class="small">' + l + ' · ' + esc(fmtTime(c.at)) + '</figcaption>' +
        (u ? '<img class="pairimg" src="' + esc(u) + '" alt="">' : '<div class="thumb">' + esc(c.id) + '</div>') + '</figure>'; };
      return '<div class="card pair" data-pair="' + esc(b.id + '-' + a.id) + '">' + one(b, 'Előtte') + one(a, 'Utána') + '</div>';
    }).join('');
    const sigs = caps.filter(c => c.kind === 'signature');
    if (sigs.length && on('kamera.signature')) h += '<h3>Aláírás</h3>' + sigs.map(c => '<div class="card"><b>' + esc(c.signer || '—') + '</b> · ' + esc(fmtTime(c.at)) +
      '<div class="small">' + esc(c.note) + '</div>' + (thumbFor(c) ? '<img class="sigimg" src="' + esc(thumbFor(c)) + '" alt="aláírás">' : '<div class="small faint mono">' + esc(captureNames(c)[1]) + '</div>') + '</div>').join('');
    const priv = caps.filter(c => c.privacy && !(c.marks || []).some(m => m.kind === 'elmos' || m.kind === 'elmos_ecset'));
    if (priv.length && on('kamera.privacy')) h += '<p class="small warn">👤 ' + priv.length + ' személyes adatot mutató fotón nincs elmosás (a telefonon: ✎ Jelölés → ▦ / ▒).</p>';
    return h;
  }

  function vHelyszin() {
    const si = S.site || {}, fl = floors();
    let h = !on('helyszin.address') ? '' : '<div class="card"><div class="kv"><b>Cím</b><input type="text" data-site="address" value="' + esc(si.address) + '">' +
      '<b>Szélesség</b><input type="text" data-site="lat" value="' + esc(si.lat) + '"><b>Hosszúság</b><input type="text" data-site="lon" value="' + esc(si.lon) + '">' +
      '<b>Forrás</b><span>' + esc(si.source || '—') + '</span></div></div>';
    const fp = si.footprint;
    let size = '';
    if (fl.length) { const b = bbox([].concat(...fl.map(f => f.poly || []))); size = f1((b[2] - b[0]) / 1000) + ' × ' + f1((b[3] - b[1]) / 1000) + ' m'; }
    if ((fp || size) && on('helyszin.footprint')) h += '<div class="card"><div class="kv">' + (fp ? '<b>Épület (térkép)</b><span>' + f1(fp.w) + ' × ' + f1(fp.d) + ' m · ' + f1(fp.area) + ' m²</span>' : '') + (size ? '<b>Terv teljes mérete</b><span>' + size + '</span>' : '') + '</div></div>';
    // F5 (WP M50, D-82): the client's contact; the address is the site's. Personal: it stays in this file and the report
    const cl = S.client || {};
    if (on('helyszin.client')) h += '<h3>👤 Ügyfél</h3><div class="card" id="client"><div class="kv"><b>Név</b><input type="text" data-client="name" value="' + esc(cl.name) + '">' +
      '<b>Telefon</b><input type="text" data-client="phone" value="' + esc(cl.phone) + '"><b>E-mail</b><input type="text" data-client="email" value="' + esc(cl.email) + '">' +
      '<b></b><label class="small"><input type="checkbox" data-client="keep"' + (cl.keep ? ' checked' : '') + '> a telefon kiadott csomagjában is marad</label></div>' +
      '<div class="small muted">Személyes adat: a felmérés fájljában és a jegyzőkönyvben van; variáns-kérésbe soha nem kerül, Gitbe sem.</div></div>';
    if (on('helyszin.place')) h += sitePlaceCard();
    // skcam K5 (Ház 3D): a walk round the house, reconstructed on the PC (Sketcher/tools/house3d.js), opened here
    if (on('helyszin.house3d')) h += '<h3>🏠 Ház 3D</h3><div class="card"><label class="btn sm">🏠 Ház 3D megnyitása (.house3d.json)<input type="file" id="fhouse" accept=".json,application/json" hidden></label>' +
      '<div class="small muted">A ház körbefotózva (Kamera → Épület kívülről, ⟳ Sorozat, 1–2 lépésenként), a fotók a PC-re; START P → Ház 3D feldolgozás. A pontfelhőn két ismert távolságú pont adja a léptéket, utána bármi mérhető.</div></div>';
    if (!on('helyszin.map')) return h;
    const q = si.lat != null && si.lon != null && si.lat !== '' ? '#18/' + si.lat + '/' + si.lon + '/0/50' : '';
    const url = 'http://localhost:8802/vrg-terkep.html?embed=1' + (q ? q : '&q=' + encodeURIComponent(si.address || ''));
    return h + '<p class="small muted">A térképhez a START <b>H</b> szervere (VRG Térkép) kell, hogy fusson. A <b>🗺 Szerkesztés a térképen</b> a körvonalat és a vázlatot a lenti térképre teszi; ott ✓ Kész hozza vissza.</p><iframe class="map" id="mapframe" src="' + esc(url) + '" title="VRG Térkép"></iframe>';
  }

  // ---- F1: the sketch on the building (Map/lib/site-math.js, the same maths as the phone and the map page) --------
  const SM = window.VrgSiteMath;
  const siteRooms = () => SM ? SM.roomsFromMm(floors()) : [];
  function sitePlaceCard() {
    const si = S.site || {}, out = si.outline || [], rooms = siteRooms();
    let h = '<h3>A vázlat az épületen</h3><div class="card" id="siteplace">';
    if (!SM) return h + '<p class="small muted">(a helyszín számítása hiányzik a lapból)</p></div>';
    const acts = '<div class="acts" style="margin-top:6px">' + (on('helyszin.map') ? '<button class="btn sm" data-act="sitemap">🗺 Szerkesztés a térképen</button>' : '') +
      (out.length >= 3 && rooms.length ? '<button class="btn sm" data-act="sitefit">⤢ Illesztés</button>' : '') +
      (si.place ? '<button class="btn sm" data-act="siteclear">✕ Elhelyezés</button>' : '') + '</div>';
    if (out.length < 3) return h + '<p class="small muted">Még nincs körvonal: a telefon Helyszínén (OSM vagy rajz a térképen), vagy itt a térképen rajzolva.</p>' + acts + '</div>';
    if (!rooms.length) return h + '<p class="small muted">A csomagban nincs megoldott terv (a telefon Rendezés → csomag): a vázlat nem helyezhető el.</p>' + acts + '</div>';
    const rep = si.place ? SM.report(rooms, out, si.place) : null;
    h += sitePlaceSvg(out, rooms, si.place, rep);
    h += rep ? SM.reportLines(rep).map((l, i) => '<div class="' + (i === 0 ? (rep.verdict === 'rendben' ? 'ok' : 'bad') : 'small') + '">' + esc(l) + '</div>').join('')
      : '<p class="small muted">Még nincs elhelyezve: ⤢ Illesztés, vagy a térképen.</p>';
    if (si.place) h += '<div class="small muted">Elforgatás ' + f1(si.place.rot) + '°' + (si.place.auto ? ' (automatikus)' : ' (kézzel igazítva)') + '</div>';
    return h + acts + '</div>';
  }
  function sitePlaceSvg(out, rooms, place, rep) {
    const lat0 = out.reduce((a, p) => a + p[0], 0) / out.length, lon0 = out.reduce((a, p) => a + p[1], 0) / out.length;
    const poly = out.map(p => SM.local(lat0, lon0, p[0], p[1])), pr = place ? SM.placed(rooms, place, lat0, lon0) : [];
    const pts = poly.concat(...pr.map(r => r.poly)); let b = bbox(pts); const ext = Math.max(b[2] - b[0], b[3] - b[1], 1), pad = ext * 0.1;
    b = [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
    const P = p => p.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' '), sw = ext / 150;
    let svg = '<svg class="siteplace" viewBox="' + b[0] + ' ' + b[1] + ' ' + (b[2] - b[0]) + ' ' + (b[3] - b[1]) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<polygon class="so" points="' + P(poly) + '" stroke-width="' + sw * 2 + '"/>';
    pr.forEach(r => { svg += '<polygon class="sp" points="' + P(r.poly) + '" stroke-width="' + sw + '"/>'; });
    (rep ? rep.walls : []).forEach(w => { const r = pr[w.room].poly, a = r[w.edge], c = r[(w.edge + 1) % r.length];
      svg += '<line class="sb" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + c[0] + '" y2="' + c[1] + '" stroke-width="' + sw * 3 + '"/>'; });
    return svg + '<text x="' + (b[0] + pad * 0.3) + '" y="' + (b[1] + pad * 0.8) + '" font-size="' + ext * 0.05 + '">É ↑</text></svg>';
  }
  function siteApply(r) {
    if (!r || r.kind !== 'vrg-site-result' || r.cancelled || !S) return;
    commit(() => {
      const si = Object.assign({ address: '', source: 'kezi' }, S.site), now = stamp();
      if (Array.isArray(r.center) && r.center.length === 2) { si.lat = r.center[0]; si.lon = r.center[1]; si.source = 'terkep'; }
      if (Array.isArray(r.outline)) {
        if (r.outline.length >= 3) {
          const fp = SM.footprint(r.outline), src = ['osm', 'rajz', 'muhold'].includes(r.outlineSrc) ? r.outlineSrc : 'rajz';
          si.outline = r.outline; si.footprint = { w: fp.w, d: fp.d, area: fp.area, angle: Math.round((fp.axis % 90) * 10) / 10, src, at: now };
          if (si.lat == null) { si.lat = r.outline.reduce((a, p) => a + p[0], 0) / r.outline.length; si.lon = r.outline.reduce((a, p) => a + p[1], 0) / r.outline.length; si.source = 'terkep'; }
        } else { delete si.outline; delete si.footprint; }
      }
      if (r.place) si.place = { lat: r.place.lat, lon: r.place.lon, rot: r.place.rot, auto: !!r.place.auto, at: now }; else if (r.place === null) delete si.place;
      S.site = si;
    });
    flash('A térkép változásai átvéve (Mentés: a frissített fájl).', 'ok'); render();
  }
  function siteSend() {
    const f = $('mapframe'); if (!f || !f.contentWindow) { flash('Nincs térkép a lapon.', 'warn'); render(); return; }
    const si = S.site || {};
    f.contentWindow.postMessage({ kind: 'vrg-site', v: 1, id: S.id || 'asztal', name: S.name || '', lat: typeof si.lat === 'number' ? si.lat : undefined,
      lon: typeof si.lon === 'number' ? si.lon : undefined, outline: si.outline || [], outlineSrc: si.footprint && si.footprint.src || '', place: si.place || null, rooms: siteRooms(), hide: FE.mapHide(FL) }, 'http://localhost:8802');
  }
  window.addEventListener('message', e => {
    const f = $('mapframe'); if (!f || e.source !== f.contentWindow || !e.data) return;
    if (e.data.kind === 'vrg-site-result') siteApply(e.data);
  });

  function vNyitott(d) {
    if (!d.open.length) return '<div class="empty">Nincs nyitott szál — minden rendben.</div>';
    return BASE.fronts.filter(f => viewShown(f.id)).map(f => { const l = d.open.filter(o => o.front === f.id); if (!l.length) return '';
      return '<h3 style="color:' + esc(f.color) + '">' + esc(f.sym) + ' ' + esc(f.label) + ' (' + l.length + ')</h3>' + l.map(leHtml).join(''); }).join('');
  }

  // F4 (WP M49): what the variant tunes in the phone's drawing tools (sketch-core DrawTune.describe, same words)
  function drawLine(v) {
    const d = v.draw; if (!d) return '';
    const n = x => String(x).replace('.', ','), out = [];
    if (d.snapAngle > 0) out.push('Vonal: ' + d.snapAngle + '°-os lépés');
    if (d.snapGrid > 0) out.push('Rács: ' + n(d.snapGrid) + ' m');
    if (d.defaultRoom) out.push('Koppintás = ' + n(d.defaultRoom.w) + ' × ' + n(d.defaultRoom.d) + ' m szoba');
    if (d.measureFirst) out.push('Új szoba: rögtön a méret');
    if (d.pointSnap === 'free') out.push('Pont: nem ugrik a falra');
    if (d.lineClose === 'auto') out.push('Vonal: Kész = szoba'); else if (d.lineClose === 'ask') out.push('Vonal: Kész → szoba vagy vonal?');   // F5
    return out.length ? '<div class="small draw" data-draw="' + esc(v.id) + '">✎ ' + out.map(esc).join(' · ') + '</div>' : '';
  }
  function vVariansok() {
    return '<div class="grid">' + VARIANTS.map(v => '<div class="card" style="border-left:3px solid ' + esc(v.color) + '"><div style="font-size:18px;color:' + esc(v.color) + '">' + esc(v.sym) + ' <b>' + esc(v.name) + '</b>' +
      (S.variant === v.id ? ' <span class="tag">aktív</span>' : '') + '</div><div class="small">' + esc(v.premise) + '</div><div class="small muted">' + (v.topics || []).map(esc).join(' · ') + '</div>' + (on('vazlat.drawtune') ? drawLine(v) : '') +
      '<div class="acts" style="margin-top:6px"><button class="btn sm" data-act="vpick" data-id="' + esc(v.id) + '">Használat ebben a felmérésben</button></div></div>').join('') + '</div>' +
      (!on('variansok.request') ? '' : '<h3>Új variáns</h3><div class="card"><p class="small">Új variáns kérése: kodszó <code>GO VARIANT</code>, a menet a <code>Sketcher/variants/PROTOCOL.md</code>-ben van. Írd le egy-három mondatban, milyen munkához kell:</p>' +
      '<textarea id="vprem" placeholder="pl. társasházi felszálló csere, lépcsőházi mérőhelyek">' + esc(starter) + '</textarea><div class="acts" style="margin-top:6px"><button class="btn" data-act="vcopy">Másolás</button><span class="small muted" id="vprev">GO VARIANT — ' + esc(starter || '…') + '</span></div></div>');
  }

  // ---- rendering -------------------------------------------------------------------------------------------------
  function renderHeader() {
    const h = $('hinfo'); if (!h) return;
    const rb = $('breport'); if (rb) rb.hidden = !on('export.report');   // M51
    if (!S) { h.innerHTML = '<span class="muted">Nincs megnyitott felmérés</span>'; return; }
    const v = VARIANTS.find(x => x.id === S.variant);
    h.innerHTML = '<span class="nm">' + esc(S.name || fileName || 'Névtelen felmérés') + '</span><span class="ad">' + esc(S.site && S.site.address || '') + '</span>' +
      (S.variant && on('variansok.use') ? '<button class="btn sm ' + (S.variantOn ? 'on' : 'dim') + '" id="vtoggle" data-act="vtoggle" style="--c:' + esc(v ? v.color : '#93d3e6') + '" title="Variáns: ' + esc(v ? v.name : S.variant) + '">◐ ' + esc(v ? v.name : S.variant) + '</button>' : '');
  }
  function railItem(f, badge, isNew) {
    return '<button class="rb' + (cur === f.id ? ' act' : '') + '" data-act="front" data-front="' + f.id + '" title="' + esc(f.label) + '" style="--c:' + esc(f.color) + '"><span class="sym">' + esc(f.sym) + '</span><span class="cap">' + esc(f.label) + '</span>' +
      (badge ? '<span class="badge' + (isNew ? ' new' : '') + '" data-badge="' + f.id + '">' + badge + '</span>' : '') + '</button>';
  }
  function badges(d) {
    if (!d) return {};
    const oq = d.qs.filter(x => !x.done);
    return { kerdes: [oq.length, oq.some(x => x.fresh)], nyitott: [d.open.length, false], kamera: [d.shots.filter(x => !x.done).length, false] };
  }
  function renderRail() {
    const r = $('rail'); if (!r) return;
    const b = S ? badges(derived()) : {}, one = f => railItem(f, b[f.id] && b[f.id][0], b[f.id] && b[f.id][1]);
    r.innerHTML = one(EXTRA.attekintes) + '<div class="sep"></div>' + BASE.fronts.filter(f => viewShown(f.id)).map(one).join('') + '<div class="sep"></div>' +
      (on('variansok.use') ? one(EXTRA.variansok) : '') + one(EXTRA.funkciok);   // M51: a front whose features are all off is not on the rail
  }
  // ⚙ Funkciók (M51): every feature by front, Mind per front and for everything; the same list as the phone's
  function vFunkciok() {
    const sw = (act, attrs, val, dis) => '<button class="sw' + (val ? ' on' : '') + '" role="switch" aria-checked="' + val + '" data-act="' + act + '"' + attrs + (dis ? ' disabled' : '') + '><i></i></button>';
    let h = '<p class="small muted">Ebben a böngészőben, minden felmérésre. Ami ki van kapcsolva, eltűnik a lapról; az adat megmarad, a mentett fájl ugyanaz.</p>' +
      '<div class="frow all"><span class="fs">✱</span><b class="fl">Mind</b>' + sw('featall', '', FE.allOn(FL)) + '</div>';
    FE.FRONTS.forEach(fr => {
      h += '<div class="fgrp" data-group="' + esc(fr.id) + '" style="--c:' + esc(fr.color) + '"><div class="frow head"><span class="fs">' + esc(fr.sym) + '</span><b class="fl">' + esc(fr.label) + '</b>' +
        sw('featfront', ' data-front="' + esc(fr.id) + '"', FE.allOn(FL, fr.id)) + '</div>';
      FE.inFront(fr.id).forEach(f => {
        const b = FE.blockedBy(FL, f.id);
        h += '<div class="frow' + (b ? ' dim' : '') + '" data-feature="' + esc(f.id) + '"><span class="fs">' + esc(f.sym) + '</span><span class="fl">' + esc(f.label) + (b ? ' <small>· előbb: ' + esc(b.label) + '</small>' : '') + '</span>' +
          sw('feat', ' data-id="' + esc(f.id) + '"', FE.on(FL, f.id), f.locked || !!b) + '</div>';
      });
      h += '</div>';
    });
    return h;
  }
  // ---- Ház 3D (dev line skcam, stage K5): the point cloud of a walk round the house ----------------------------------
  const H3 = window.VRGHouse3d, H3UI = window.VRGHouse3dUI;
  function houseOpen(house, name) {
    if (!H3UI) return null;
    const stemOf = String(name || house.name || 'haz').replace(/\.house3d\.json$|\.json$/i, '');
    return H3UI.open(document.getElementById('root'), { house, name: stemOf, onSave: h => {
      const text = JSON.stringify(h); download(text, stemOf + '.house3d.json', 'application/json');
      flash('Ház 3D mentve: ' + stemOf + '.house3d.json (' + (h.measures || []).length + ' mérés' + (h.scale ? ', léptékkel' : ', lépték nélkül') + ').', 'ok'); render();
    } });
  }

  // ---- Síkmérés (dev line skcam, stage K3): measuring on a plane in one photo --------------------------------------
  // lib/plane.js does the maths, lib/plane-ui.js is the screen (the phone runs the same one in a WebView). The results
  // go into the survey's optional `planes` key, by photo: a capture id or a Fotópont shot ("F25/0").
  const PL = window.VRGPlane, PLUI = window.VRGPlaneUI;
  const sideLabel = deg => ({ 0: 'É', 90: 'K', 180: 'D', 270: 'Ny' })[((deg % 360) + 360) % 360] || deg + '°';
  // a Fotópont photo attached on the PC carries its board name (the package's plan.photos), the survey the phone's
  const shotImage = (pid, x) => {
    const pp = (pkg && pkg.plan && pkg.plan.photos || []).find(q => q.id === pid), b = pp && (pp.shots || []).find(q => q.deg === x.deg);
    return [base(x.file), b && base(b.file)].find(n => n && boxImg.has(n)) || null;
  };
  function planeBits(key, file, title) {
    if (!PL || !on('kamera.measure')) return '';
    const rec = (S.planes || {})[key], lines = rec ? PL.summary(rec) : [];
    return '<div class="plane-bits">' + (file ? '<button class="btn sm" data-pact="open" data-key="' + esc(key) + '" data-file="' + esc(file) + '" data-title="' + esc(title) + '">📏 Mérés</button> ' : '') +
      (lines.length ? '<span class="small">' + lines.map(esc).join(' · ') + '</span>' : '') + '</div>';
  }
  /** 🖨 Kártya nyomtatása: the VRG mérőkártya (lib/marker.js) on its own printable page, at 100 %. */
  function printCard(id) {
    const MK = window.VRGMarker, w = MK && window.open('', '_blank'); if (!w) return;
    w.document.open(); w.document.write(MK.page(id || 0)); w.document.close();
  }
  function planeOpen(key, file, title) {
    const im = boxImg.get(file); if (!im || !PLUI) return;
    PLUI.open(document.getElementById('root'), { image: im, title: title + ' — ' + key, record: (S.planes || {})[key] || null, printCard,
      onSave: rec => commit(() => {
        const pl = Object.assign({}, S.planes || {});
        if (rec) pl[key] = rec; else delete pl[key];
        if (Object.keys(pl).length) S.planes = pl; else delete S.planes;
      }) });
  }
  document.addEventListener('click', e => { const t = e.target.closest('#main [data-pact="open"]'); if (t && S) planeOpen(t.dataset.key, t.dataset.file, t.dataset.title); });

  // ---- Szobadoboz (dev line skcam, stage K1): the room in 3D with its Fotópont photos ------------------------------
  // lib/roombox.js does the maths, lib/roombox-gl.js draws; the overlay lives outside #main, so a re-render of the
  // page does not drop the WebGL canvas. Corrections go into the survey's optional `box` key (see lib/roombox.js).
  const RB = window.VRGRoomBox, RBGL = window.VRGRoomBoxGL;
  const ui = { open: false, room: '', mode: 'orbit', az: 30, el: 50, zoom: 2.6, yaw: 0, pitch: 0, fov: 75, point: '', hi: null, panoMsg: {} };
  let gl3 = null, boxEl = null;
  function boxPrep(f) {
    if (!RB) return;
    const name = f.name;
    if (/\.jpe?g$/i.test(name) && f.slice) f.slice(0, 262144).arrayBuffer().then(b => { boxMeta.set(name, RB.exif(b)); boxRedraw(true); }).catch(() => {});
    if (!/^image\//.test(f.type || '') && !/\.(jpe?g|png|webp)$/i.test(name)) return;
    const img = new Image();
    img.onload = () => {                         // drawn onto a canvas: the browser applies the EXIF orientation, and big photos shrink
      const k = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const m = Object.assign({}, boxMeta.get(name)); m.w = img.naturalWidth; m.h = img.naturalHeight; boxMeta.set(name, m);
      boxImg.set(name, c);
      if (ui.open) boxRedraw(true); else if (cur === 'vazlat' || cur === 'kamera') render();   // the cards count / measure the attached photos
    };
    img.src = files.get(name);
  }
  const boxLevel = () => { const id = pkg && pkg.level || S && S.level; return { heightMm: id === 'basement' ? 2500 : 2700 }; };
  const boxMetaOf = file => { const m = boxMeta.get(base(file)); return m && (m.w || m.f35) ? m : null; };
  function boxScene() { return pkg && pkg.plan && RB ? RB.scene(pkg.plan, S && S.box, boxMetaOf, boxLevel()) : []; }
  function boxCard() {
    if (!on('vazlat.roombox')) return '';
    if (!floors().length) return '<div class="card box-card"><b>⬚ Szobadoboz (3D)</b> <span class="small muted">A 3D szobához méretek kellenek: nyisd meg a telefon Planner-csomagját (Rendezés → Küldés a Plannerbe), nem csak a vázlatot.</span></div>';
    const rooms = boxScene(), shots = rooms.reduce((a, r) => a + r.shots.length, 0), withImg = rooms.reduce((a, r) => a + r.shots.filter(x => boxImg.has(base(x.file))).length, 0);
    return '<div class="card box-card"><button class="btn" data-bact="open">⬚ Szobadoboz (3D)</button> <span class="small muted">' + rooms.length + ' helyiség · ' + shots + ' fotópont-kép' +
      (shots ? ' · ' + withImg + ' csatolva' + (withImg < shots ? ' (a többit a Kamera nézetben: Fotók csatolása)' : '') : '') + '</span></div>';
  }
  function boxOpen() {
    if (!RB || !RBGL) return;
    if (!boxEl) {
      boxEl = document.createElement('div'); boxEl.id = 'box3d'; boxEl.className = 'box3d';
      boxEl.innerHTML = '<div class="bx-top"><b>⬚ Szobadoboz</b><select id="bxroom" data-b="room"></select><span class="seg"><button class="btn sm" data-bact="mode" data-m="orbit">Felülről</button><button class="btn sm" data-bact="mode" data-m="stand">A fotópontból</button></span><span class="grow"></span>' +
        '<span class="small muted" id="bxhint"></span><button class="btn sm" data-bact="close" title="Bezárás (Esc)">✕</button></div><div class="bx-body"><canvas id="bxc"></canvas><aside id="bxside"></aside></div>';
      document.getElementById('root').appendChild(boxEl);
      boxEl.addEventListener('click', boxClick); boxEl.addEventListener('input', e => boxInput(e, false)); boxEl.addEventListener('change', e => boxInput(e, true));
      const c = boxEl.querySelector('#bxc');
      let drag = null;
      c.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); });
      c.addEventListener('pointermove', e => {
        if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; drag = [e.clientX, e.clientY];
        if (ui.mode === 'orbit') { ui.az -= dx * 0.4; ui.el = Math.max(8, Math.min(89, ui.el + dy * 0.3)); } else { ui.yaw -= dx * 0.2; ui.pitch = Math.max(-80, Math.min(80, ui.pitch + dy * 0.2)); }
        boxRedraw();
      });
      c.addEventListener('pointerup', () => { drag = null; });
      c.addEventListener('wheel', e => { e.preventDefault(); if (ui.mode === 'orbit') ui.zoom = Math.max(1.1, Math.min(8, ui.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); else ui.fov = Math.max(30, Math.min(110, ui.fov + (e.deltaY > 0 ? 4 : -4))); boxRedraw(); }, { passive: false });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.open) boxClose(); });
      window.addEventListener('resize', () => boxRedraw());
      try { gl3 = RBGL.create(c); } catch (e) { gl3 = null; }
    }
    const rooms = boxScene();
    if (!rooms.find(r => r.id === ui.room)) ui.room = (rooms.find(r => r.shots.length) || rooms[0] || {}).id || '';
    ui.open = true; boxEl.hidden = false; boxRedraw(true);
  }
  function boxClose() { ui.open = false; if (boxEl) boxEl.hidden = true; render(); }
  const boxRoom = () => boxScene().find(r => r.id === ui.room) || null;
  function boxRedraw(side) {
    if (!ui.open || !boxEl) return;
    const room = boxRoom(), hint = boxEl.querySelector('#bxhint');
    boxEl.querySelectorAll('[data-bact="mode"]').forEach(b => b.classList.toggle('on', b.dataset.m === ui.mode));
    if (side) boxSide(room);
    if (!gl3) { hint.textContent = 'Ez a böngésző nem tud WebGL-t: a 3D nézet nem rajzolható.'; return; }
    const r = gl3.draw(room, f => boxImg.get(base(f)) || null, { mode: ui.mode, az: ui.az, el: ui.el, zoom: ui.zoom, yaw: ui.yaw, pitch: ui.pitch, fov: ui.fov, point: ui.point }, { hi: ui.hi });
    hint.textContent = !room ? '' : ui.mode === 'orbit' ? 'Húzás: forgatás · görgő: nagyítás' : 'Húzás: körülnézés · görgő: látószög ' + Math.round(ui.fov) + '°';
    boxEl.dataset.drawn = r ? String(r.textured) : '0';
  }
  const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; };
  function boxSide(room) {
    const sel = boxEl.querySelector('#bxroom'), rooms = boxScene();
    sel.innerHTML = rooms.map(r => '<option value="' + esc(r.id) + '"' + (r.id === ui.room ? ' selected' : '') + '>' + esc(r.name) + (r.shots.length ? ' · ' + r.shots.length + ' kép' : '') + '</option>').join('');
    const side = boxEl.querySelector('#bxside');
    if (!room) { side.innerHTML = '<p class="muted">Nincs helyiség a tervben.</p>'; return; }
    const B = S.box || {}, covered = room.cover.filter(Boolean).length;
    let h = '<div class="kv"><b>Alapterület</b><span>' + f1(room.area) + ' m²</span><b>Kerület</b><span>' + f1(room.perimeter) + ' m</span><b>Falak képpel</b><span>' + covered + ' / ' + room.walls.length + '</span></div>' +
      '<label class="bx-f">Belmagasság (cm) <input type="number" min="180" max="600" step="1" data-b="h" value="' + Math.round(room.h / 10) + '"></label>' +
      '<label class="bx-f">Szemmagasság a fotónál (cm) <input type="number" min="60" max="220" step="1" data-b="eye" value="' + Math.round(room.eye / 10) + '"></label>';
    if (!room.shots.length) h += '<p class="small muted">Ebben a helyiségben nincs fotópont: a doboz kép nélkül, a méretekből áll.</p>';
    else h += '<p class="small muted">Ha egy kép sarka nem a doboz sarkára esik: ' + (SNAP ? '📐 Sarok, és húzd a sarkot a fotón a helyére; finomítás: ' : '') + 'forgasd (irány), vagy állítsd a látószöget (mm-egyenérték; 0,5× ≈ 13–16, 1× ≈ 24–28).</p>';
    room.shots.forEach((x, i) => {
      const img = boxImg.has(base(x.file)), src = { exif: 'EXIF', kezi: 'kézi', lencse: 'a kamerától', alap: 'alapérték' }[x.f35src];
      h += '<div class="bx-shot' + (ui.hi === i ? ' hi' : '') + '" data-key="' + esc(x.key) + '"><div class="row"><button class="btn sm" data-bact="hi" data-i="' + i + '" title="Kiemelés a 3D nézetben">' + esc(x.side || x.deg + '°') + '</button>' +
        '<span class="small ' + (img ? '' : 'muted') + '">' + esc(base(x.file)) + (img ? '' : ' (nincs csatolva)') + '</span>' +
        (SNAP && img ? '<button class="btn sm" data-bact="snap" data-i="' + i + '" title="Húzd a doboz sarkát a fotón látható sarokra: irány és látószög">📐 Sarok</button>' : '') +
        '<button class="btn sm" data-bact="stand" data-p="' + esc(x.point) + '" data-deg="' + x.yaw + '" title="Nézd innen">👁</button></div>' +
        '<label>Irány ' + (x.fix.yaw >= 0 ? '+' : '') + f1(x.fix.yaw) + '°<input type="range" min="-30" max="30" step="0.5" data-b="yaw" data-key="' + esc(x.key) + '" value="' + x.fix.yaw + '"></label>' +
        '<label>Dőlés ' + (x.pitch >= 0 ? '+' : '') + f1(x.pitch) + '°<input type="range" min="-25" max="25" step="0.5" data-b="pitch" data-key="' + esc(x.key) + '" value="' + x.pitch + '"></label>' +
        '<label>Látószög ' + Math.round(x.fovH) + '° · ' + f1(x.f35) + ' mm (' + src + ')<input type="number" min="8" max="80" step="0.5" data-b="f35" data-key="' + esc(x.key) + '" placeholder="auto" value="' + (x.fix.f35 || '') + '"></label></div>';
    });
    // skcam K4 (Körkép): per photo point, align the neighbours where they overlap, and the 360° image
    if (PA && on('vazlat.pano')) [...new Set(room.shots.map(x => x.point))].forEach(pt => {
      h += '<div class="bx-pano"><b>⟳ Körkép · ' + esc(pt) + '</b><div class="row"><button class="btn sm" data-bact="align" data-p="' + esc(pt) + '" title="A szomszédos képek egymáshoz igazítása, ahol átfednek">⟲ Igazítás</button>' +
        '<button class="btn sm" data-bact="pano" data-p="' + esc(pt) + '" title="360°-os kép (equirectangular JPEG, GPano), bármely 360° nézőben">⇩ 360° kép</button></div>' +
        (ui.panoMsg[pt] ? '<div class="small muted">' + esc(ui.panoMsg[pt]) + '</div>' : '') + '</div>';
    });
    if (room.shots.length) h += '<div class="acts"><button class="btn sm dim" data-bact="reset">Javítások törlése ebben a helyiségben</button></div>';
    side.innerHTML = h;
  }
  function boxSet(fn, live) {
    const b = clone(S.box || {}); fn(b);
    ['h', 'shots'].forEach(k => { if (b[k] && !Object.keys(b[k]).length) delete b[k]; });
    commit(() => { if (Object.keys(b).length) S.box = b; else delete S.box; }, false);
    boxRedraw(!live);
  }
  function boxInput(e, done) {
    const t = e.target, k = t.dataset.b; if (!k || !S) return;
    if (k === 'room') { if (done) { ui.room = t.value; ui.hi = null; boxRedraw(true); } return; }
    const v = num(t.value), room = boxRoom();
    if (k === 'h') { if (!done || !room) return; boxSet(b => { b.h = b.h || {}; if (v > 0) b.h[room.id] = Math.round(v * 10); else delete b.h[room.id]; }); return; }
    if (k === 'eye') { if (!done) return; boxSet(b => { if (v > 0) b.eye = Math.round(v * 10); else delete b.eye; }); return; }
    const key = t.dataset.key;
    boxSet(b => {
      b.shots = b.shots || {}; const o = Object.assign({}, b.shots[key]);
      if (k === 'f35') { if (v > 0) o.f35 = v; else delete o.f35; } else if (v) o[k] = v; else delete o[k];
      if (Object.keys(o).length) b.shots[key] = o; else delete b.shots[key];
    }, !done);
    if (!done) { const lab = t.closest('label'); if (lab && k !== 'f35') lab.firstChild.textContent = (k === 'yaw' ? 'Irány ' : 'Dőlés ') + (v >= 0 ? '+' : '') + f1(v || 0) + '°'; }
  }
  function boxClick(e) {
    const t = e.target.closest('[data-bact]'); if (!t) return;
    const a = t.dataset.bact;
    if (a === 'close') boxClose();
    else if (a === 'mode') { ui.mode = t.dataset.m; if (ui.mode === 'stand' && !ui.point) { const r = boxRoom(); if (r && r.shots[0]) { ui.point = r.shots[0].point; ui.yaw = r.shots[0].yaw; ui.pitch = 0; } } boxRedraw(); }
    else if (a === 'stand') { ui.mode = 'stand'; ui.point = t.dataset.p; ui.yaw = +t.dataset.deg; ui.pitch = 0; boxRedraw(); }
    else if (a === 'hi') { const i = +t.dataset.i; ui.hi = ui.hi === i ? null : i; boxRedraw(true); }
    else if (a === 'reset') { const r = boxRoom(); if (r) boxSet(b => { if (b.h) delete b.h[r.id]; if (b.shots) r.shots.forEach(x => delete b.shots[x.key]); }); }
    else if (a === 'align') boxAlign(t.dataset.p);
    else if (a === 'pano') boxPano(t.dataset.p);
    else if (a === 'snap') boxSnap(+t.dataset.i);
  }
  // ---- 📐 Sarok (K1 polish): drag the box's corners onto the corners in the photo (lib/roombox-snap.js) -------------
  const SNAP = window.VRGRoomBoxSnap;
  function boxSnap(i) {
    const r = boxRoom(), x = r && r.shots[i]; if (!x || !SNAP) return null;
    return SNAP.open({ RB, room: r, shot: x, image: boxImg.get(base(x.file)) || null, document,
      onApply: fix => boxSet(b => { b.shots = b.shots || {}; const o = Object.assign({}, b.shots[x.key], { yaw: fix.yaw }); if (fix.f35) o.f35 = fix.f35; b.shots[x.key] = o; }) });
  }
  // ---- Körkép (dev line skcam, stage K4): lib/pano.js on the attached Fotópont photos ------------------------------
  const PA = window.VRGPano;
  const pixelsOf = cv => ({ w: cv.width, h: cv.height, data: cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data });
  function panoShots(point) {
    const r = boxRoom(), shots = r ? r.shots.filter(x => x.point === point) : [], imgs = {};
    shots.forEach(x => { const c = boxImg.get(base(x.file)); if (c) imgs[x.file] = pixelsOf(c); });
    return { shots, imgs };
  }
  function boxAlign(point) {
    const { shots, imgs } = panoShots(point);
    const al = PA.align(shots, imgs);
    ui.panoMsg[point] = PA.report(al, k => sideLabel(+k.split('/')[1]));
    if (al.pairs.some(p => p.ok)) boxSet(b => { const nb = PA.applyFixes(b, al.fixes); Object.keys(b).forEach(k => delete b[k]); Object.assign(b, nb); });
    else boxRedraw(true);
  }
  function boxPano(point) {
    const { shots, imgs } = panoShots(point);
    if (!Object.keys(imgs).length) { ui.panoMsg[point] = 'Ehhez a ponthoz nincs csatolt fotó.'; boxRedraw(true); return; }
    ui.panoMsg[point] = 'Készül a 360° kép…'; boxRedraw(true);
    setTimeout(() => {
      const W = 4096, H = 2048, p = PA.equirect(shots, imgs, W, H), c = document.createElement('canvas');
      c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H); im.data.set(p.data); g.putImageData(im, 0, 0);
      c.toBlob(b => b.arrayBuffer().then(buf => {
        const out = new Blob([PA.withXmp(new Uint8Array(buf), PA.xmp(W, H, 0))], { type: 'image/jpeg' }), name = stem() + '_' + point + '_360.jpg';
        try { const u = URL.createObjectURL(out), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch (e) { /* tests */ }
        ui.lastPano = { name, bytes: out.size, covered: p.covered };
        ui.panoMsg[point] = '360° kép: ' + name + ' (' + Math.round(out.size / 1024) + ' kB, a gömb ' + Math.round(p.covered * 100) + ' %-a képpel).';
        boxRedraw(true);
      }), 'image/jpeg', 0.9);
    }, 30);
  }
  document.addEventListener('click', e => { const t = e.target.closest('#main [data-bact="open"]'); if (t && S) boxOpen(); });

  const VIEWS = { attekintes: vAttekintes, vazlat: vVazlat, jegyzet: vJegyzet, munkakor: vMunkakor, kerdes: vKerdes, kamera: vKamera, helyszin: vHelyszin, nyitott: vNyitott, variansok: vVariansok, funkciok: vFunkciok };

  function render() {
    renderHeader(); renderRail();
    const m = $('main'); if (!m) return;
    if (!S && cur !== 'funkciok') { m.innerHTML = '<div class="empty">Nyiss meg egy felmérést (Megnyitás vagy húzd ide a .vsketch.json fájlt).</div>'; return; }
    const f = frontOf(cur) || EXTRA.attekintes;
    let body;
    try {
      const d = S ? derived() : null;
      if (cur === 'kerdes' && d) {                        // first appearance of each shadow question
        const un = FK.unseen(d.k, S, d.f);
        if (un.length) { const t = stamp(); S.seen = Object.assign({}, S.seen || {}); un.forEach(id => { S.seen[id] = t; }); persist(); }
      }
      body = VIEWS[cur](d);
    } catch (e) { body = '<div class="msg err">Hiba a nézet építésekor: ' + esc(e.message) + '</div>'; }
    m.innerHTML = '<h2 style="--c:' + esc(f.color) + '"><span class="sym">' + esc(f.sym) + '</span>' + esc(f.label) + '</h2>' +
      (msg ? '<div class="msg ' + msg.cls + '">' + esc(msg.text) + '</div>' : '') + '<div id="view" data-front="' + cur + '">' + body + '</div>';
  }
  function front(id) { if (!VIEWS[id] || !viewShown(id)) return false; cur = id; render(); return true; }

  // ---- actions ---------------------------------------------------------------------------------------------------
  const setAnswer = (q, a) => { S.answers = Object.assign({}, S.answers || {}); if (a) S.answers[q] = a; else delete S.answers[q]; };
  const answerOf = q => (S.answers || {})[q];
  function chooseOption(qid, oid) {
    const k = kit(), q = k.questions.find(x => x.id === qid); if (!q) return;
    const old = answerOf(qid), cur0 = old && old.state === 'answered' ? old.options.slice() : [];
    const on = cur0.includes(oid), opts = q.multi ? (on ? cur0.filter(x => x !== oid) : cur0.concat([oid])) : (on ? [] : [oid]);
    const now = stamp(), text = old ? old.text || '' : '';
    if (!opts.length && !text) setAnswer(qid, null); else setAnswer(qid, { options: opts, text, at: now, state: 'answered' });
    if (!on) { const o = q.options.find(x => x.id === oid); if (o && o.sets) S = FK.apply(k, o.sets, S, now); }
  }
  function onClick(ev) {
    const t = ev.target.closest('[data-act]'); if (!t || !S && !['save', 'front', 'feat', 'featfront', 'featall'].includes(t.dataset.act)) return;
    const a = t.dataset.act, id = t.dataset.id, q = t.dataset.q, k = () => kit();
    switch (a) {
      case 'front': front(t.dataset.front); break;
      case 'feat': setFeatures(FE.toggle(FL, id)); render(); break;
      case 'featfront': setFeatures(FE.all(FL, !FE.allOn(FL, t.dataset.front), t.dataset.front)); render(); break;
      case 'featall': setFeatures(FE.all(FL, !FE.allOn(FL))); render(); break;
      case 'sitemap': siteSend(); break;
      case 'sitefit': { const p = SM.autoFit(siteRooms(), S.site.outline); if (p) commit(() => { S.site = Object.assign({}, S.site, { place: Object.assign(p, { at: stamp() }) }); }); break; }
      case 'siteclear': commit(() => { const si = Object.assign({}, S.site); delete si.place; S.site = si; }); break;
      case 'jump': front(t.dataset.front); break;
      case 'tkimplied': setImplied(!impliedNow()); render(); break;
      case 'tkexport': { const r = exportTakeoff(); if (r) { flash('Takeoff: ' + stem() + '.takeoff.json + .md (' + r.takeoff.counts.items + ' tétel)', 'ok'); render(); } break; }
      case 'report': { if (S && on('export.report')) { openReport(); render(); } break; }
      case 'save': { if (S) { const txt = save(); flash('Mentve: ' + stem() + '.vsketch.json (' + txt.length + ' bájt)', 'ok'); render(); } break; }
      case 'vtoggle': commit(s => { S.variantOn = !S.variantOn; }); break;
      case 'vpick': commit(() => { S.variant = id; S.variantOn = true; }); break;
      case 'vcopy': copy('GO VARIANT — ' + starter); break;
      case 'nchip': syncNote(); note.chips.has(id) ? note.chips.delete(id) : note.chips.add(id); render(); break;
      case 'nadd': addNote(); break;
      case 'eopen': commit(() => { S.entries = S.entries.map(e => e.id === id ? Object.assign({}, e, { open: !e.open }) : e); }); break;
      case 'sugok': { const g = FK.suggestions(k(), S).find(x => x.id === id); if (g) commit(() => { S = FK.apply(k(), g.effect, S, stamp()); }); break; }
      case 'sugno': commit(() => { S.dismissed = (S.dismissed || []).concat([id]); }); break;
      case 'stoggle': commit(() => { if (S.scope && S.scope[id] > 0) S = FK.trimWant(S, id, 0); else { S.scope = Object.assign({}, S.scope); S.scope[id] = 1; } }); break;
      case 'sinc': commit(() => { S = FK.addWant(S, id, wantRoom || null, +1); }); break;   // F4: into the room chosen under Hová
      case 'sdec': commit(() => { const r = wantRoom || null, n = FK.addWant(S, id, r, -1); S = n === S && !r ? FK.trimWant(S, id, FK.wantTotal(S, id) - 1) : n; }); break;
      case 'wmove': commit(() => { const from = t.dataset.from || null; S = FK.moveWant(S, id, from, from ? null : wantRoom || null, 1); }); break;
      case 'qopt': commit(() => chooseOption(q, t.dataset.o)); break;
      case 'qlater': case 'qskip': commit(() => { const old = answerOf(q); setAnswer(q, { options: old ? old.options : [], text: old ? old.text || '' : '', at: stamp(), state: a === 'qlater' ? 'later' : 'skip' }); }); break;
      case 'qclear': commit(() => setAnswer(q, null)); break;
      case 'qunskip': commit(() => { S.answers = Object.assign({}, S.answers); Object.keys(S.answers).forEach(x => { if (S.answers[x].state === 'skip') delete S.answers[x]; }); }); break;
    }
  }
  function syncNote() { const t = $('ntext'); if (t) note.text = t.value; const o = $('nopen'); if (o) note.open = o.checked; const r = $('nroom'); if (r) note.room = r.value; }
  function addNote() {
    syncNote();
    const text = note.text.trim(), chips = Array.from(note.chips); if (!text && !chips.length) return;
    const k = kit();
    commit(() => {
      const e = { id: nextId('E'), at: stamp(), text, chips };
      if (note.room) e.room = note.room;
      if (note.open || chips.some(c => (k.chips.find(x => x.id === c) || {}).open)) e.open = true;
      S.entries = (S.entries || []).concat([e]);
      chips.forEach(c => { const ch = k.chips.find(x => x.id === c); if (ch && ch.sets) S = FK.apply(k, ch.sets, S, e.at); });
    });
    note = { text: '', chips: new Set(), open: false, room: note.room }; render();
  }
  function onChange(ev) {
    const t = ev.target;
    if (t.id === 'fopen') { openFiles(t.files); t.value = ''; return; }
    if (t.id === 'fphotos') { if (S) attach(t.files); t.value = ''; return; }
    if (t.id === 'fhouse') { openFiles(t.files); t.value = ''; return; }
    if (t.id === 'wroom') { wantRoom = t.value; render(); return; }
    if (!S) return;
    if (t.dataset.qtext) {                           // store silently, so a following click is not eaten by a re-render
      const q = t.dataset.qtext, old = answerOf(q), text = t.value;
      commit(() => { if (old && old.state === 'answered') setAnswer(q, Object.assign({}, old, { text, at: stamp() })); else if (text.trim()) setAnswer(q, { options: old ? old.options : [], text, at: stamp(), state: 'answered' }); }, false);
    } else if (t.dataset.site) {
      commit(() => {
        const si = Object.assign({ address: '', source: 'kezi' }, S.site), key = t.dataset.site;
        if (key === 'address') si.address = t.value;
        else if (t.value.trim() === '') delete si[key]; else if (!isNaN(parseFloat(t.value.replace(',', '.')))) si[key] = parseFloat(t.value.replace(',', '.'));
        S.site = si;
      }, false);
      if (cur === 'helyszin') render();
    } else if (t.dataset.client) {                    // F5 (WP M50, D-82): the client's contact, personal (sketch-core ClientInfo)
      commit(() => {
        const c = Object.assign({ name: '', phone: '', email: '' }, S.client), key = t.dataset.client;
        if (key === 'keep') c.keep = t.checked; else c[key] = t.value.trim();
        if (!c.keep) delete c.keep;
        if (!c.name && !c.phone && !c.email) delete S.client; else S.client = c;
      }, false);
      if (cur === 'helyszin') render();
    } else if (t.id === 'ntext' || t.id === 'nopen' || t.id === 'nroom') syncNote();
  }
  function onInput(ev) {
    if (ev.target.id === 'ntext') note.text = ev.target.value;
    if (ev.target.id === 'vprem') { starter = ev.target.value; const p = $('vprev'); if (p) p.textContent = 'GO VARIANT — ' + (starter || '…'); }
  }
  function copy(text) {
    const done = () => { flash('Kimásolva: ' + text, 'ok'); render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done)); else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing more to try */ } t.remove(); done();
  }

  // ---- start -----------------------------------------------------------------------------------------------------
  function start() {
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    let depth = 0; const drop = $('drop');
    window.addEventListener('dragenter', e => { e.preventDefault(); depth++; drop.hidden = false; });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drop.hidden = true; });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { e.preventDefault(); depth = 0; drop.hidden = true; if (e.dataTransfer) openFiles(e.dataTransfer.files); });
    let last = null;
    try { last = localStorage.getItem(LAST_KEY); } catch (e) { /* no storage */ }
    if (last) { try { load(JSON.parse(last), 'utolsó'); return; } catch (e) { /* stale: ignore */ } }
    render();
  }
  window.__sketcher = { load, state: () => S, save, front, output, render, siteApply, takeoff, exportTakeoff, setImplied, reportHtml, openReport, features: () => FL, setFeatures,
    box: { open: boxOpen, close: boxClose, scene: boxScene, ui, attach, image: f => boxImg.get(base(f)) || null, snap: i => boxSnap(i) },
    plane: { open: planeOpen }, house: { open: houseOpen } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
