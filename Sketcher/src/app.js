// Sketcher/src/app.js — VRG Sketcher Desktop page: review and complete a field survey at the PC.
// The engine (window.VRGFieldKit), the catalog (window.VRG_FIELDKIT) and the variants (window.VRG_VARIANTS) are inlined by tools/build.js.
(function () {
  'use strict';
  const FK = window.VRGFieldKit;
  const BASE = FK.parseKit(window.VRG_FIELDKIT);
  const VARIANTS = window.VRG_VARIANTS || [];
  const GROUPS = [['jelleg', 'Jelleg'], ['terulet', 'Terület'], ['rendszer', 'Rendszer'], ['igeny', 'Igény']];
  const TYPES = { socket: 'Dugalj', switch: 'Kapcsoló', light: 'Lámpa', junction: 'Kötődoboz', data: 'Adat', fixed: 'Fix bekötés', sensor: 'Érzékelő', board: 'Elosztó', pont: 'Típustalan' };
  const EXTRA = { attekintes: { id: 'attekintes', label: 'Áttekintés', sym: '▤', color: '#93d3e6' }, variansok: { id: 'variansok', label: 'Variánsok', sym: '◐', color: '#b08ad8' } };
  const LAST_KEY = 'vrg-sketcher-last';

  let S = null, pkg = null, cur = 'attekintes', msg = null, fileName = '';
  let files = new Map();                       // photo file name -> object URL (memory only, never saved)
  let note = { text: '', chips: new Set(), open: false, room: '' };
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
    if (obj.kind === 'vrg-sketch' && obj.sketch && obj.sketch.kind === 'vrg-vazlat') { pkg = obj; S = obj.sketch; delete pkg.sketch; }
    else if (obj.kind === 'vrg-vazlat') { pkg = null; S = obj; }
    else throw new Error('Ismeretlen fájl (kind: ' + obj.kind + ') — vrg-sketch vagy vrg-vazlat kell.');
    files.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
    files = new Map(); fileName = name || ''; note = { text: '', chips: new Set(), open: false, room: '' };
    flash(null); persist(); render();
    return S;
  }
  function output() { return pkg ? Object.assign({}, pkg, { sketch: S }) : S; }
  function save() {
    if (!S) return null;
    const text = JSON.stringify(output(), null, 1);
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = stem() + '.vsketch.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { /* no download in this environment (tests); the text is still returned */ }
    return text;
  }
  function readFile(f) { return f.text ? f.text() : new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsText(f); }); }
  async function openFiles(list) {
    const arr = Array.from(list || []), js = arr.filter(f => /\.json$/i.test(f.name) || f.type === 'application/json'), ph = arr.filter(f => !js.includes(f));
    try {
      if (js.length) load(await readFile(js[0]), js[0].name);
      if (ph.length) attach(ph);
    } catch (e) { flash(String(e.message || e), 'err'); render(); }
  }

  // ---- photos in memory ------------------------------------------------------------------------------------------
  // Kamera 2: a video is .mp4, a signature .png named "alairas" (sketch-core Intake.exportName)
  const capExt = c => c.kind === 'video' ? 'mp4' : c.kind === 'signature' ? 'png' : 'jpg';
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
    Array.from(list).forEach(f => { if (want.has(f.name)) { if (files.has(f.name)) URL.revokeObjectURL(files.get(f.name)); files.set(f.name, URL.createObjectURL(f)); n++; } });
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
    return { k, f, qs: FK.questions(k, S, f, now), shots: FK.shots(k, S, f), open: FK.open(k, S, norm(), f), sug: FK.suggestions(k, S) };
  }

  function vAttekintes(d) {
    const sc = S.scope || {}, fl = floors();
    let h = '<div class="grid"><div class="card"><h3 style="margin-top:0">Munkakör</h3>';
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
      '<span>' + (floors().length ? 'Terv: mm-ben (Planner adat)' : 'Csak vázlat: rajzegységben') + '</span></div>';
  }

  function vJegyzet(d) {
    const k = d.k, rooms = norm().rooms;
    let h = '<div class="card"><textarea id="ntext" placeholder="Jegyzet: amit az ügyfél mondott…">' + esc(note.text) + '</textarea><div style="margin-top:6px">' +
      k.chips.map(c => '<button class="pill ' + (note.chips.has(c.id) ? 'sel' : '') + '" data-act="nchip" data-id="' + esc(c.id) + '" style="--c:' + esc(c.color) + '"><i>' + esc(c.sym) + '</i>' + esc(c.label) + '</button>').join('') +
      '</div><div class="row"><select id="nroom" style="width:auto"><option value="">(helyiség nélkül)</option>' + rooms.map(r => '<option value="' + esc(r.id) + '"' + (note.room === r.id ? ' selected' : '') + '>' + esc(r.name || r.id) + '</option>').join('') + '</select>' +
      '<label class="small"><input type="checkbox" id="nopen"' + (note.open ? ' checked' : '') + '> ⚑ Tisztázandó</label><span class="grow"></span><button class="btn primary" id="nadd" data-act="nadd">Hozzáad</button></div></div>';
    if (d.sug.length) {
      h += '<h3>Javaslatok a jegyzetekből</h3><div>' + d.sug.map(g => {
        const e = g.effect, parts = e.scope.map(s => (k.scope.find(x => x.id === s) || { label: s }).label);
        if (e.q) { const q = k.questions.find(x => x.id === e.q); parts.push((q ? q.q : e.q) + (e.opt ? ' → ' + ((q && q.options.find(o => o.id === e.opt) || {}).label || e.opt) : '')); }
        return '<span class="pill ghost" style="--c:#e0b020" data-sug="' + esc(g.id) + '"><i>✎</i>„' + esc(g.match) + '” → ' + esc(parts.join(', ')) +
          ' <button class="x" title="Elfogad" data-act="sugok" data-id="' + esc(g.id) + '">✓</button><button class="x" title="Elvet" data-act="sugno" data-id="' + esc(g.id) + '">✕</button></span>';
      }).join('') + '</div>';
    }
    const ents = (S.entries || []).slice().reverse();
    h += '<h3>Napló</h3>' + (ents.length ? '<div class="tl">' + ents.map(e => '<div class="ent' + (e.open ? ' open' : '') + '" data-ent="' + esc(e.id) + '"><div class="meta"><span>' + esc(fmtTime(e.at)) + '</span>' +
      (e.room ? '<span>⌂ ' + esc(roomName(e.room)) + '</span>' : '') + (e.voice ? '<span>🎙</span>' : '') +
      '<button class="flag ' + (e.open ? 'on' : '') + '" data-act="eopen" data-id="' + esc(e.id) + '" title="Tisztázandó">⚑</button></div>' +
      (e.text ? '<div class="txt">' + esc(e.text) + '</div>' : '') + '<div>' + (e.chips || []).map(chipPill).join('') + '</div></div>').join('') + '</div>' : '<div class="empty">Még nincs jegyzet.</div>');
    return h;
  }

  function vMunkakor(d) {
    const sc = S.scope || {}, col = frontOf('munkakor').color;
    return GROUPS.map(([g, label]) => '<h3>' + label + '</h3><div>' + d.k.scope.filter(x => x.group === g).map(x => {
      const n = sc[x.id] || 0;
      if (x.qty) return '<span class="stepper" data-scope="' + esc(x.id) + '" style="--c:' + (n ? col : '#a6afb7') + '"><span class="nm"><i>' + esc(x.sym) + '</i>' + esc(x.label) + '</span>' +
        '<button data-act="sdec" data-id="' + esc(x.id) + '" aria-label="kevesebb">−</button><span class="q">' + n + '</span><button data-act="sinc" data-id="' + esc(x.id) + '" aria-label="több">+</button></span>';
      return '<button class="pill ' + (n ? 'sel' : 'off') + '" data-act="stoggle" data-id="' + esc(x.id) + '" data-scope="' + esc(x.id) + '" style="--c:' + col + '"><i>' + esc(x.sym) + '</i>' + esc(x.label) + '</button>';
    }).join('') + '</div>').join('');
  }

  function qCard(x) {
    const q = x.q, a = x.answer, chosen = new Set(a && a.options || []), c = frontOf('kerdes').color;
    return '<div class="card qcard' + (x.fresh ? ' fresh' : '') + (x.later ? ' later' : '') + '" data-q="' + esc(q.id) + '" style="--c:' + c + '"><div class="qt">' + esc(q.q) +
      (x.fresh ? '<span class="tag new">új</span>' : '') + (x.later ? '<span class="tag">később</span>' : '') + (q.multi ? '<span class="tag">több is</span>' : '') + '</div><div>' +
      q.options.map(o => '<button class="pill ' + (chosen.has(o.id) ? 'sel' : '') + '" data-act="qopt" data-q="' + esc(q.id) + '" data-o="' + esc(o.id) + '">' + esc(o.label) + '</button>').join('') + '</div>' +
      (q.num ? '<div class="row"><input type="text" data-qtext="' + esc(q.id) + '" value="' + esc(a && a.text) + '" placeholder="Érték"><span class="muted">' + esc(q.num.unit) + '</span></div>'
        : '<textarea data-qtext="' + esc(q.id) + '" placeholder="Megjegyzés (szabad szöveg)">' + esc(a && a.text) + '</textarea>') +
      '<div class="acts"><button class="btn sm" data-act="qlater" data-q="' + esc(q.id) + '">Később</button><button class="btn sm" data-act="qskip" data-q="' + esc(q.id) + '">Nem releváns</button>' +
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
    let h = '<div class="row"><label class="btn">Fotók csatolása<input type="file" id="fphotos" accept="image/*,video/mp4" multiple hidden></label><span class="small muted">A fájlok név szerint párosodnak; csak a memóriában maradnak.</span></div>';
    h += '<h3>Fotólista</h3>' + (d.shots.length ? d.shots.map(s => '<div class="shotrow ' + (s.done ? 'done' : '') + '"><span class="ck">' + (s.done ? '✓' : '○') + '</span><span><b>' + esc(s.item.label) + '</b> <span class="mono small">' + s.have + '/' + s.item.need + '</span>' +
      (s.item.hint ? '<div class="small muted">' + esc(s.item.hint) + '</div>' : '') + '</span></div>').join('') : '<div class="empty">Nincs fotólista.</div>');
    h += '<h3>Célfotók</h3>';
    const used = new Set();
    purposes.forEach(p => {
      const list = caps.filter(c => (c.purpose || 'egyeb') === p.id); if (!list.length) return; used.add(p.id);
      h += '<div class="small" style="color:' + esc(p.color) + '">' + esc(p.sym) + ' ' + esc(p.label) + ' (' + list.length + ')</div>' + list.map(capCard).join('');
    });
    const rest = caps.filter(c => !used.has(c.purpose || 'egyeb')); if (rest.length) h += rest.map(capCard).join('');
    if (!caps.length) h += '<div class="empty">Még nincs célfotó.</div>';
    h += vCamera2(caps);
    const pp = (S.photos || []);
    if (pp.length) h += '<h3>Fotópontok</h3>' + pp.map(p => '<div class="card"><b>' + esc(p.id) + '</b> ' + esc(roomName(p.room)) + ' ' + (p.shots || []).map(x => {
      const u = files.get(base(x.file)); return u ? '<img class="thumb" src="' + esc(u) + '" alt="' + esc(x.file) + '">' : '<span class="tag">' + esc(base(x.file)) + '</span>';
    }).join('') + '</div>').join('');
    return h;
  }
  function capCard(c) {
    const u = thumbFor(c);
    const media = !u ? '<div class="thumb">' + (c.kind === 'video' ? '▶ videó' : c.kind === 'signature' ? '✍ aláírás' : 'nincs kép') + '</div>'
      : c.kind === 'video' ? '<video class="thumb" src="' + esc(u) + '" controls preload="metadata"></video>' : '<img class="thumb" src="' + esc(u) + '" alt="">';
    return '<div class="card cap-card" data-cap="' + esc(c.id) + '" data-kind="' + esc(c.kind || 'photo') + '">' + media +
      '<div><div class="mono small">' + esc(c.id) + ' · ' + esc(fmtTime(c.at)) + (c.room ? ' · ' + esc(roomName(c.room)) : '') + capBadges(c) + '</div>' +
      capExtra(c) + (c.note ? '<div>' + esc(c.note) + '</div>' : '') + '<div class="small faint mono">' + esc(captureNames(c)[captureNames(c).length - 1]) + '</div></div></div>';
  }
  // ---- Kamera 2: video, signature, personal data, type-plate readings, before / after ---------------------------
  const mb = b => b > 0 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : '?';   // as Camera2.mb
  const dur = ms => { const t = Math.round((ms || 0) / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function capBadges(c) {
    const b = [];
    if (c.kind === 'video') b.push('<span class="tag" data-b="video">▶ ' + esc(dur(c.durationMs)) + ' · ' + esc(mb(c.bytes)) + '</span>');
    if (c.kind === 'signature') b.push('<span class="tag" data-b="signature">✍ aláírás</span>');
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
    if (pairs.length) h += '<h3>Előtte / utána</h3>' + pairs.map(([b, a]) => {
      const one = (c, l) => { const u = thumbFor(c); return '<figure><figcaption class="small">' + l + ' · ' + esc(fmtTime(c.at)) + '</figcaption>' +
        (u ? '<img class="pairimg" src="' + esc(u) + '" alt="">' : '<div class="thumb">' + esc(c.id) + '</div>') + '</figure>'; };
      return '<div class="card pair" data-pair="' + esc(b.id + '-' + a.id) + '">' + one(b, 'Előtte') + one(a, 'Utána') + '</div>';
    }).join('');
    const sigs = caps.filter(c => c.kind === 'signature');
    if (sigs.length) h += '<h3>Aláírás</h3>' + sigs.map(c => '<div class="card"><b>' + esc(c.signer || '—') + '</b> · ' + esc(fmtTime(c.at)) +
      '<div class="small">' + esc(c.note) + '</div>' + (thumbFor(c) ? '<img class="sigimg" src="' + esc(thumbFor(c)) + '" alt="aláírás">' : '<div class="small faint mono">' + esc(captureNames(c)[1]) + '</div>') + '</div>').join('');
    const priv = caps.filter(c => c.privacy && !(c.marks || []).some(m => m.kind === 'elmos' || m.kind === 'elmos_ecset'));
    if (priv.length) h += '<p class="small warn">👤 ' + priv.length + ' személyes adatot mutató fotón nincs elmosás (a telefonon: ✎ Jelölés → ▦ / ▒).</p>';
    return h;
  }

  function vHelyszin() {
    const si = S.site || {}, fl = floors();
    let h = '<div class="card"><div class="kv"><b>Cím</b><input type="text" data-site="address" value="' + esc(si.address) + '">' +
      '<b>Szélesség</b><input type="text" data-site="lat" value="' + esc(si.lat) + '"><b>Hosszúság</b><input type="text" data-site="lon" value="' + esc(si.lon) + '">' +
      '<b>Forrás</b><span>' + esc(si.source || '—') + '</span></div></div>';
    const fp = si.footprint;
    let size = '';
    if (fl.length) { const b = bbox([].concat(...fl.map(f => f.poly || []))); size = f1((b[2] - b[0]) / 1000) + ' × ' + f1((b[3] - b[1]) / 1000) + ' m'; }
    if (fp || size) h += '<div class="card"><div class="kv">' + (fp ? '<b>Épület (térkép)</b><span>' + f1(fp.w) + ' × ' + f1(fp.d) + ' m · ' + f1(fp.area) + ' m²</span>' : '') + (size ? '<b>Terv teljes mérete</b><span>' + size + '</span>' : '') + '</div></div>';
    const q = si.lat != null && si.lon != null && si.lat !== '' ? '#18/' + si.lat + '/' + si.lon + '/0/50' : '';
    const url = 'http://localhost:8802/vrg-terkep.html?embed=1' + (q ? q : '&q=' + encodeURIComponent(si.address || ''));
    return h + '<p class="small muted">A térképhez a START <b>H</b> szervere (VRG Térkép) kell, hogy fusson.</p><iframe class="map" id="mapframe" src="' + esc(url) + '" title="VRG Térkép"></iframe>';
  }

  function vNyitott(d) {
    if (!d.open.length) return '<div class="empty">Nincs nyitott szál — minden rendben.</div>';
    return BASE.fronts.map(f => { const l = d.open.filter(o => o.front === f.id); if (!l.length) return '';
      return '<h3 style="color:' + esc(f.color) + '">' + esc(f.sym) + ' ' + esc(f.label) + ' (' + l.length + ')</h3>' + l.map(leHtml).join(''); }).join('');
  }

  function vVariansok() {
    return '<div class="grid">' + VARIANTS.map(v => '<div class="card" style="border-left:3px solid ' + esc(v.color) + '"><div style="font-size:18px;color:' + esc(v.color) + '">' + esc(v.sym) + ' <b>' + esc(v.name) + '</b>' +
      (S.variant === v.id ? ' <span class="tag">aktív</span>' : '') + '</div><div class="small">' + esc(v.premise) + '</div><div class="small muted">' + (v.topics || []).map(esc).join(' · ') + '</div>' +
      '<div class="acts" style="margin-top:6px"><button class="btn sm" data-act="vpick" data-id="' + esc(v.id) + '">Használat ebben a felmérésben</button></div></div>').join('') + '</div>' +
      '<h3>Új variáns</h3><div class="card"><p class="small">Új variáns kérése: kodszó <code>GO VARIANT</code>, a menet a <code>Sketcher/variants/PROTOCOL.md</code>-ben van. Írd le egy-három mondatban, milyen munkához kell:</p>' +
      '<textarea id="vprem" placeholder="pl. társasházi felszálló csere, lépcsőházi mérőhelyek">' + esc(starter) + '</textarea><div class="acts" style="margin-top:6px"><button class="btn" data-act="vcopy">Másolás</button><span class="small muted" id="vprev">GO VARIANT — ' + esc(starter || '…') + '</span></div></div>';
  }

  // ---- rendering -------------------------------------------------------------------------------------------------
  function renderHeader() {
    const h = $('hinfo'); if (!h) return;
    if (!S) { h.innerHTML = '<span class="muted">Nincs megnyitott felmérés</span>'; return; }
    const v = VARIANTS.find(x => x.id === S.variant);
    h.innerHTML = '<span class="nm">' + esc(S.name || fileName || 'Névtelen felmérés') + '</span><span class="ad">' + esc(S.site && S.site.address || '') + '</span>' +
      (S.variant ? '<button class="btn sm ' + (S.variantOn ? 'on' : 'dim') + '" id="vtoggle" data-act="vtoggle" style="--c:' + esc(v ? v.color : '#93d3e6') + '" title="Variáns: ' + esc(v ? v.name : S.variant) + '">◐ ' + esc(v ? v.name : S.variant) + '</button>' : '');
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
    r.innerHTML = one(EXTRA.attekintes) + '<div class="sep"></div>' + BASE.fronts.map(one).join('') + '<div class="sep"></div>' + one(EXTRA.variansok);
  }
  const VIEWS = { attekintes: vAttekintes, vazlat: vVazlat, jegyzet: vJegyzet, munkakor: vMunkakor, kerdes: vKerdes, kamera: vKamera, helyszin: vHelyszin, nyitott: vNyitott, variansok: vVariansok };

  function render() {
    renderHeader(); renderRail();
    const m = $('main'); if (!m) return;
    if (!S) { m.innerHTML = '<div class="empty">Nyiss meg egy felmérést (Megnyitás vagy húzd ide a .vsketch.json fájlt).</div>'; return; }
    const f = frontOf(cur) || EXTRA.attekintes;
    let body;
    try {
      const d = derived();
      if (cur === 'kerdes') {                        // first appearance of each shadow question
        const un = FK.unseen(d.k, S, d.f);
        if (un.length) { const t = stamp(); S.seen = Object.assign({}, S.seen || {}); un.forEach(id => { S.seen[id] = t; }); persist(); }
      }
      body = VIEWS[cur](d);
    } catch (e) { body = '<div class="msg err">Hiba a nézet építésekor: ' + esc(e.message) + '</div>'; }
    m.innerHTML = '<h2 style="--c:' + esc(f.color) + '"><span class="sym">' + esc(f.sym) + '</span>' + esc(f.label) + '</h2>' +
      (msg ? '<div class="msg ' + msg.cls + '">' + esc(msg.text) + '</div>' : '') + '<div id="view" data-front="' + cur + '">' + body + '</div>';
  }
  function front(id) { if (!VIEWS[id]) return false; cur = id; render(); return true; }

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
    const t = ev.target.closest('[data-act]'); if (!t || !S && t.dataset.act !== 'save') return;
    const a = t.dataset.act, id = t.dataset.id, q = t.dataset.q, k = () => kit();
    switch (a) {
      case 'front': front(t.dataset.front); break;
      case 'jump': front(t.dataset.front); break;
      case 'save': { if (S) { const txt = save(); flash('Mentve: ' + stem() + '.vsketch.json (' + txt.length + ' bájt)', 'ok'); render(); } break; }
      case 'vtoggle': commit(s => { S.variantOn = !S.variantOn; }); break;
      case 'vpick': commit(() => { S.variant = id; S.variantOn = true; }); break;
      case 'vcopy': copy('GO VARIANT — ' + starter); break;
      case 'nchip': syncNote(); note.chips.has(id) ? note.chips.delete(id) : note.chips.add(id); render(); break;
      case 'nadd': addNote(); break;
      case 'eopen': commit(() => { S.entries = S.entries.map(e => e.id === id ? Object.assign({}, e, { open: !e.open }) : e); }); break;
      case 'sugok': { const g = FK.suggestions(k(), S).find(x => x.id === id); if (g) commit(() => { S = FK.apply(k(), g.effect, S, stamp()); }); break; }
      case 'sugno': commit(() => { S.dismissed = (S.dismissed || []).concat([id]); }); break;
      case 'stoggle': commit(() => { S.scope = Object.assign({}, S.scope); if (S.scope[id] > 0) delete S.scope[id]; else S.scope[id] = 1; }); break;
      case 'sinc': commit(() => { S.scope = Object.assign({}, S.scope); S.scope[id] = (S.scope[id] || 0) + 1; }); break;
      case 'sdec': commit(() => { S.scope = Object.assign({}, S.scope); if ((S.scope[id] || 0) <= 1) delete S.scope[id]; else S.scope[id] -= 1; }); break;
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
  window.__sketcher = { load, state: () => S, save, front, output, render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
