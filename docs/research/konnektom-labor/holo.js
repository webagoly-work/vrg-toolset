/* ================= 3 · Holo: the same data in four forms (Stack/orb.html): Polip, Gömb, Föld, Mag, with Átmenet and the Őrség lock */
const FORMS = [['polip', 'Polip'], ['orb', 'Gömb'], ['earth', 'Föld'], ['core', 'Mag']];
const Holo = {
  key: 'holo', name: 'Holo', sets: [], px: 1.15,
  st: { form: 'polip', via: true, lock: 0, lockTo: 0, iso: -1, tr: null },
  init() {
    STKB.build(); const K = STKB, S = window.STK, areas = S.areas;
    // lines = pillars that own files; members = their commits (oldest → newest), their biggest files and the decisions that sit in them
    const byP = {}; K.nodes.forEach(n => { if (n.p && n.L !== 'E') (byP[n.p] = byP[n.p] || []).push(n.i); });
    const head = Date.parse(S.commits[S.commits.length - 1][1]);
    const lines = [];
    for (const [pid, name, area] of S.pillars) {
      const files = byP[pid]; if (!files || !files.length) continue;
      const fs = new Set(files), cm = new Set(); files.forEach(f => K.touch[f].forEach(k => cm.add(k)));
      const commits = [...cm].sort((a, b) => a - b), qs = K.edges.filter(e => e[2] === 'in' && fs.has(e[1])).map(e => e[0]);
      const last = commits.length ? Date.parse(S.commits[commits[commits.length - 1]][1]) : 0;
      lines.push({ pid, name, area, files: files.sort((a, b) => K.nodes[b].b - K.nodes[a].b).slice(0, 44), allFiles: files.length, commits, qs, active: last && head - last < 2.5 * 864e5, last });
    }
    lines.sort((a, b) => areas.indexOf(a.area) - areas.indexOf(b.area) || b.commits.length - a.commits.length);
    lines.forEach((l, i) => { const ah = areas.indexOf(l.area) / areas.length; l.col = hsl((ah + (i % 3) * 0.025) % 1, 0.62, l.active ? 0.66 : 0.52); l.ix = i; });
    const mem = [];
    lines.forEach((l, li) => {
      l.commits.forEach((k, j) => mem.push({ li, kind: 'c', node: K.commitNode[k], t: l.commits.length > 1 ? 0.18 + 0.82 * j / (l.commits.length - 1) : 0.9, c: k }));
      l.files.forEach((f, j) => mem.push({ li, kind: 'f', node: f, t: 0.08 + 0.9 * ((hash32(K.nodes[f].title) % 1000) / 1000), j }));
      l.qs.forEach((q, j) => mem.push({ li, kind: 'q', node: q, t: 0.25 + 0.7 * (j + .5) / l.qs.length }));
    });
    this.lines = lines; this.mem = mem; const M = mem.length, L = lines.length;
    const pts = new R.Points(M); this.pts = pts;
    mem.forEach((m, i) => { const c = lines[m.li].col; pts.col.set(m.kind === 'q' ? hex('#e4877d') : m.kind === 'c' ? c.map(v => Math.min(1, v * 1.25)) : c.map(v => v * .8), i * 3); pts.size[i] = m.kind === 'c' ? 3.2 : m.kind === 'q' ? 2.8 : 2.1; });
    pts.hot = [1, .78, .42]; pts.base = 1;
    // ---- form positions
    const P = {}; for (const [f] of FORMS) P[f] = new Float32Array(M * 3);
    const jit = (i, s) => { const r = rng(i * 7 + 3); return [(r() - .5) * s, (r() - .5) * s, (r() - .5) * s]; };
    const arm = (l, t) => { const a = 2 * Math.PI * l.ix / L, len = 0.55 + 0.45 * Math.min(1, (l.commits.length + l.files.length) / 70), rho = 0.1 + len * t * 1.05, ang = a + 0.7 * t * t;
      const y = l.active ? -0.8 + 1.55 * len * Math.pow(t, 1.2) : -0.8 + 0.32 * Math.sin(Math.PI * t) * len - 0.28 * t * t;
      return [rho * Math.cos(ang), y, rho * Math.sin(ang)]; };
    this.arm = arm;
    mem.forEach((m, i) => { const l = lines[m.li], p = arm(l, m.t), j = m.kind === 'f' ? jit(i, 0.07) : [0, 0, 0]; if (m.kind === 'q') p[1] -= 0.04; P.polip.set([p[0] + j[0], p[1] + j[1], p[2] + j[2]], i * 3); });
    const basis = n => { const a = Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0]; let u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]; const lu = Math.hypot(...u); u = u.map(v => v / lu); const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]; return [u, v]; };
    lines.forEach(l => { l.n = fib(l.ix, L); [l.u, l.v] = basis(l.n); l.rr = 0.82 + 0.06 * (l.ix % 3); });
    const ring = (l, th, rr) => [rr * (Math.cos(th) * l.u[0] + Math.sin(th) * l.v[0]), rr * (Math.cos(th) * l.u[1] + Math.sin(th) * l.v[1]), rr * (Math.cos(th) * l.u[2] + Math.sin(th) * l.v[2])];
    mem.forEach((m, i) => { const l = lines[m.li], th = m.t * Math.PI * 2 * 0.94 + l.ix, rr = l.rr + (m.kind === 'f' ? (rng(i)() - .5) * 0.06 : m.kind === 'q' ? -0.035 : 0); P.orb.set(ring(l, th, rr), i * 3); });
    // Föld: land dots from the Natural Earth mask; each line a country around its capital
    const EL = window.EARTH_LAND, bits = u8of(EL.bits), land = (cx, cy) => (bits[(cy * EL.w + cx) >> 3] >> (7 - ((cy * EL.w + cx) & 7))) & 1;
    const ll2v = (lat, lon, r) => [r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon)];
    const dots = [];
    for (let cy = 4; cy < EL.h - 20; cy += 3) for (let cx = 0; cx < EL.w; cx += 3) { if (!land(cx, cy)) continue; const coast = !land((cx + 3) % EL.w, cy) || !land((cx + EL.w - 3) % EL.w, cy) || !land(cx, Math.min(EL.h - 1, cy + 3)) || !land(cx, Math.max(0, cy - 3)); dots.push({ lat: (90 - (cy + .5) / 2) * Math.PI / 180, lon: ((cx + .5) / 2 - 180) * Math.PI / 180, coast }); }
    dots.forEach(d => d.v = ll2v(d.lat, d.lon, 0.9));
    const caps = []; lines.forEach((l, i) => { const f = fib(i * 7 % L, L), want = f; let best = 0, bd = 9; for (let k = 0; k < dots.length; k += 2) { const v = dots[k].v, d = (v[0] / .9 - want[0]) ** 2 + (v[1] / .9 - want[1]) ** 2 + (v[2] / .9 - want[2]) ** 2; if (d < bd && !caps.includes(k)) { bd = d; best = k; } } caps.push(best); l.cap = dots[best].v; });
    const country = lines.map(() => []);
    dots.forEach((d, k) => { let best = 0, bd = 9; lines.forEach((l, i) => { const dd = (d.v[0] - l.cap[0]) ** 2 + (d.v[1] - l.cap[1]) ** 2 + (d.v[2] - l.cap[2]) ** 2; if (dd < bd) { bd = dd; best = i; } }); d.owner = best; country[best].push(k); });
    country.forEach((list, i) => list.sort((a, b) => { const c = lines[i].cap, da = dots[a].v, db = dots[b].v; return ((da[0] - c[0]) ** 2 + (da[1] - c[1]) ** 2 + (da[2] - c[2]) ** 2) - ((db[0] - c[0]) ** 2 + (db[1] - c[1]) ** 2 + (db[2] - c[2]) ** 2); }));
    mem.forEach((m, i) => { const list = country[m.li], l = lines[m.li]; let v;
      if (!list.length) v = l.cap; else { const k = m.kind === 'c' ? list[Math.min(list.length - 1, Math.floor((1 - m.t) * Math.min(list.length, 40)))] : list[(m.j != null ? m.j * 5 + 3 : hash32('' + i)) % list.length]; v = dots[k].v; }
      const s = m.kind === 'c' ? 0.935 : m.kind === 'q' ? 0.95 : 0.915; P.earth.set(v.map(x => x / .9 * s), i * 3); });
    // Mag: the brain inside (brain.js positions, scaled), commits on an inner shell
    mem.forEach((m, i) => { let v; if (m.kind === 'c') { const f = fib(m.c, S.commits.length); v = f.map(x => x * 0.62); } else { const c = K.cen[m.node]; v = [c[0] * .5, (c[1] + 0.25) * .5, c[2] * .5]; } P.core.set(v, i * 3); });
    this.P = P; this.cur = new Float32Array(P.polip);
    // ---- decoration per form
    const D = {};
    D.polip = new R.Lines(L * 64 + 64); lines.forEach(l => { const pts2 = []; for (let k = 0; k <= 30; k++) pts2.push(arm(l, k / 30)); D.polip.poly(pts2, l.col, l.active ? .7 : .35); }); D.polip.wob = 0.012; D.polip.upload();
    D.orb = new R.Lines(L * 130 + 64); lines.forEach(l => { const pts2 = []; for (let k = 0; k <= 64; k++) pts2.push(ring(l, k / 64 * Math.PI * 2, l.rr)); D.orb.poly(pts2, l.col, .12); }); D.orb.upload();
    D.dust = new R.Points(2600); { const r = rng(11); for (let i = 0; i < 2600; i++) { const f = fib(i, 2600), s = 1.08 + r() * 0.28; D.dust.pos.set(f.map(x => x * s), i * 3); D.dust.col.set([.45, .7, .8], i * 3); D.dust.size[i] = 0.9; } D.dust.base = .22; D.dust.wob = 0.02; D.dust.upload(); }
    D.land = new R.Points(dots.length); dots.forEach((d, k) => { D.land.pos.set(d.v, k * 3); const c = lines[d.owner].col; D.land.col.set(d.coast ? [.6, .9, 1] : c.map(v => v * .55), k * 3); D.land.size[k] = d.coast ? 2 : 1.6; }); D.land.base = .85; D.land.upload();
    const ico = this.icosphere(2); D.mesh = new R.Lines(ico.edges.length * 2 + 8); ico.edges.forEach(([a, b]) => D.mesh.seg(ico.v[a].map(x => x * .905), ico.v[b].map(x => x * .905), [.5, .8, .95], .1)); D.mesh.upload();
    D.caps = new R.Lines(L * 40 + 64 + 4000);
    lines.forEach(l => { const c = l.cap, n = c.map(x => x / .9), [u, v] = basis(n), pts2 = []; for (let k = 0; k <= 16; k++) { const th = k / 16 * Math.PI * 2; pts2.push([0, 1, 2].map(j => n[j] * .93 + (Math.cos(th) * u[j] + Math.sin(th) * v[j]) * 0.035)); } D.caps.poly(pts2, l.col, .8); });
    const share = {}; lines.forEach((l, i) => l.commits.forEach(k => (share[k] = share[k] || []).push(i)));
    const pair = {}; Object.values(share).forEach(ls => { for (let a = 0; a < ls.length; a++) for (let b = a + 1; b < ls.length; b++) { const k = ls[a] + ',' + ls[b]; pair[k] = (pair[k] || 0) + 1; } });
    this.bundles = Object.entries(pair).filter(([, n]) => n >= 2);
    for (const [k, n] of this.bundles) { const [a, b] = k.split(',').map(Number), A = lines[a].cap, B = lines[b].cap, pts2 = []; for (let s = 0; s <= 20; s++) { const t = s / 20, p = A.map((x, j) => lerp(x, B[j], t)), l2 = Math.hypot(...p) || 1, h = 0.93 + 0.18 * Math.sin(Math.PI * t) * Math.min(1, 0.4 + n / 8); pts2.push(p.map(x => x / l2 * h)); } D.caps.poly(pts2, [1, .82, .55], Math.min(.5, .1 + n * .03)); }
    D.caps.upload();
    D.shell = new R.Points(3200); for (let i = 0; i < 3200; i++) { const f = fib(i, 3200); D.shell.pos.set(f, i * 3); D.shell.col.set([.55, .85, 1], i * 3); D.shell.size[i] = 1.1; } D.shell.base = .3; D.shell.wob = 0.025; D.shell.upload();
    D.fil = new R.Lines(1400); { const r = rng(5); for (let i = 0; i < 600; i++) { const f = fib(Math.floor(r() * 3200), 3200), d = 0.82 + r() * 0.12; D.fil.seg(f, f.map(x => x * d), [.55, .85, 1], .28, [.55, .85, 1], 0); } D.fil.wob = 0.025; D.fil.upload(); }
    D.entry = new R.Lines(L * 4 + 8); lines.forEach((l, li) => { if (!l.active) return; const c = [0, 0, 0]; let n = 0; mem.forEach((m, i) => { if (m.li === li && m.kind === 'f') { for (let k = 0; k < 3; k++) c[k] += P.core[i * 3 + k]; n++; } }); if (!n) return; const cc = c.map(v => v / n), l2 = Math.hypot(...cc) || 1; l.entry = cc.map(v => v / l2); D.entry.seg(cc, l.entry, l.col, .8, [1, 1, 1], .9); }); D.entry.upload();
    // Őrség: a coarse triangle mesh that flies in and snaps onto the shell
    const lk = this.icosphere(1); this.lk = lk; D.lock = new R.Lines(lk.f.length * 6 + 8); D.lockPts = new R.Points(lk.v.length); lk.v.forEach((v, k) => { D.lockPts.col.set([.7, .92, 1], k * 3); D.lockPts.size[k] = 2.6; }); D.lockPts.base = 0; D.lockPts.upload();
    this.D = D;
    this.sets = [D.dust, D.orb, D.polip, D.mesh, D.land, D.caps, D.shell, D.fil, D.entry, pts, D.lock, D.lockPts];
    this.w = { polip: 1, orb: 0, earth: 0, core: 0 };
    pts.pos.set(this.cur); pts.upload();
  },
  icosphere(sub) {
    const t = (1 + Math.sqrt(5)) / 2; let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => { const l = Math.hypot(...p); return p.map(x => x / l); });
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < sub; s++) { const mid = {}, m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid[k] != null) return mid[k]; const p = v[a].map((x, j) => (x + v[b][j]) / 2), l = Math.hypot(...p); v.push(p.map(x => x / l)); return (mid[k] = v.length - 1); }; const nf = []; for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); } f = nf; }
    const es = new Set(), edges = []; for (const [a, b, c] of f) for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = Math.min(x, y) + '_' + Math.max(x, y); if (!es.has(k)) { es.add(k); edges.push([x, y]); } }
    return { v, f, edges };
  },
  go(form) {
    const st = this.st; if (form === st.form && !st.tr) return;
    const from = new Float32Array(this.cur), legs = st.via && form !== 'core' && st.form !== 'core' ? ['core', form] : [form];
    st.tr = { from, legs, k: 0, t: 0, fromForm: st.form }; st.form = form;
    document.querySelectorAll('#ho-forms button').forEach(b => b.classList.toggle('on', b.dataset.k === form));
  },
  enter() {
    Object.assign(R.cam, { yaw: 0.5, pitch: 0.3, dist: 3.3, tgt: [0, 0, 0], auto: 0.08 });
    const st = this.st, ls = this.lines;
    UI.set(`
      <h2>Holo <small>négy alak, egy adat</small></h2>
      <p class="lead">A pillérek a vonalak (${ls.length} db), a tagjaik a commitjaik, a legnagyobb fájljaik és a bennük ülő döntések. Az aktív vonalak (az utolsó 2,5 napban commit) felfelé nyúlnak.</p>
      <div class="grp"><h3>Alak <kbd>G</kbd></h3>${UI.chips('ho-forms', FORMS, st.form)}
      <div class="tgs">${UI.toggle('ho-via', 'Átmenet a Magon át', st.via)}${UI.toggle('ho-lock', 'Őrség (zár) <kbd>L</kbd>', st.lockTo > 0)}</div>
      <p class="hint" id="ho-h"></p></div>
      <div class="grp"><h3>Vonalak</h3><ul class="lines" id="ho-ls">${ls.map((l, i) => `<li data-i="${i}" class="${l.active ? 'act' : ''}"><i style="background:rgb(${l.col.map(v => Math.round(v * 255)).join(',')})"></i><b>${esc(l.name)}</b><em>${l.commits.length} c · ${l.allFiles} f${l.qs.length ? ' · ' + l.qs.length + ' d' : ''}</em></li>`).join('')}</ul>
      <p class="hint">Koppints egy vonalra az elkülönítéséhez; még egy koppintás visszaállítja.</p></div>
      <p class="src">${this.bundles.length} köteg köt össze vonalakat, amelyek legalább két commitot közösen kaptak. A Föld-alak szárazföldi maszkja: Natural Earth 1:110m (közkincs).</p>`);
    UI.bindChips('ho-forms', k => this.go(k));
    UI.bindToggle('ho-via', v => st.via = v); UI.bindToggle('ho-lock', v => st.lockTo = v ? 1 : 0);
    $('ho-ls').addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (!li) return; const i = +li.dataset.i; this.isolate(st.iso === i ? -1 : i); });
    this.hint();
  },
  peek() {
    const f = FORMS.find(x => x[0] === this.st.form);
    return { text: `<b>${esc(f[1])}</b> · ${this.lines.length} vonal${this.st.lockTo ? ' · Őrség zárva' : ''}`, acts: [['Alak ›', () => this.onKey('g'), true], [this.st.lockTo ? 'Nyit' : 'Zár', () => this.onKey('l')]] };
  },
  hint() {
    const h = { polip: 'Fordított polip: az origó a talp közepe, minden vonal egy kar, a legújabb commit a csúcson. A döntések a tapadókorongok.', orb: 'Holo-gömb: minden vonal egy gyűrű a saját síkjában, körülötte passzív porhalo.', earth: 'Hologram-Föld: minden vonal egy ország a fővárosa körül, a fájljai a szárazföldjén. A kötegek ívek a fővárosok között.', core: 'Mag: lélegző részecskehéj, benne az agy (brain.js), a commitok egy belső héjon, az aktív vonalak útja a felszíni belépési pontjukig.' };
    const el = $('ho-h'); if (el) el.textContent = h[this.st.form];
  },
  isolate(i) {
    this.st.iso = i; const p = this.pts;
    document.querySelectorAll('#ho-ls li').forEach(li => li.classList.toggle('on', +li.dataset.i === i));
    this.mem.forEach((m, k) => { const c = this.lines[m.li].col, on = i < 0 || m.li === i, base = m.kind === 'q' ? hex('#e4877d') : m.kind === 'c' ? c.map(v => Math.min(1, v * 1.25)) : c.map(v => v * .8); p.col.set(on ? base : base.map(v => v * .12), k * 3); });
    p.upload('c');
    if (i >= 0) { const l = this.lines[i]; UI.info.hidden = false; UI.info.innerHTML = `<button type="button" class="x" aria-label="Bezárás" id="ho-x">×</button><h3>${esc(l.name)}</h3><dl><dt>Terület</dt><dd>${esc(l.area)}</dd><dt>Állapot</dt><dd>${l.active ? 'aktív' : 'pihen'}${l.last ? ' · utolsó commit ' + new Date(l.last).toISOString().slice(0, 10) : ''}</dd><dt>Tagok</dt><dd>${l.commits.length} commit, ${l.allFiles} fájl, ${l.qs.length} döntés</dd></dl>${l.commits.length ? `<ul class="mini">${l.commits.slice(-4).reverse().map(k => `<li>${esc(STKB.commits[k][0])} ${esc(STKB.commits[k][2].slice(0, 64))}</li>`).join('')}</ul>` : ''}`; $('ho-x').onclick = () => this.isolate(-1); }
    else UI.info.hidden = true;
  },
  frame(dt, t) {
    const st = this.st, p = this.pts, D = this.D, M = this.mem.length;
    if (st.tr) {
      const tr = st.tr, dur = tr.legs.length > 1 ? 0.85 : 1.1; tr.t += dt / dur;
      const tgt = this.P[tr.legs[tr.k]], e = ease(Math.min(1, tr.t));
      for (let i = 0; i < M * 3; i++) this.cur[i] = lerp(tr.from[i], tgt[i], e);
      const prev = tr.k === 0 ? tr.fromForm : tr.legs[tr.k - 1]; for (const [f] of FORMS) this.w[f] = f === tr.legs[tr.k] ? e : f === prev ? 1 - e : 0;
      if (tr.t >= 1) { if (tr.k < tr.legs.length - 1) { tr.k++; tr.t = 0; tr.from = new Float32Array(this.cur); } else st.tr = null; }
      if (!st.tr) this.hint();
    }
    st.lock += (st.lockTo - st.lock) * Math.min(1, dt * 2.2);
    const lock = st.lock, shrink = 1 - 0.84 * lock;
    for (let i = 0; i < M * 3; i++) p.pos[i] = this.cur[i] * shrink;
    p.upload('p');
    const w = this.w; D.polip.k = w.polip; D.orb.k = w.orb; D.dust.k = w.orb * 0.9 + w.core * 0.2; D.land.k = w.earth; D.mesh.k = w.earth; D.caps.k = w.earth; D.shell.k = w.core * (1 - 0.5 * lock); D.fil.k = w.core * (1 - lock); D.entry.k = w.core * (1 - lock);
    p.wob = w.polip * 0.01; p.hot = [1, .72, .3];
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    for (let i = 0; i < M; i++) { const m = this.mem[i], l = this.lines[m.li]; p.act[i] = lock * 0.7 + (m.kind === 'c' && l.active ? 0.25 + 0.35 * pulse * (m.t > 0.85 ? 1 : 0.3) : 0); }
    p.upAct();
    const shellR = 1 + 0.015 * Math.sin(t * 1.7); 
    // Őrség mesh
    const L = D.lock, lk = this.lk; L.clear(); const grey = [.42, .47, .52], ice = [.62, .9, 1];
    for (let fi = 0; fi < lk.f.length; fi++) {
      const f = lk.f[fi], c = [0, 1, 2].map(j => (lk.v[f[0]][j] + lk.v[f[1]][j] + lk.v[f[2]][j]) / 3), rot = (1 - lock) * (0.6 + (fi % 5) * 0.2), off = (1 - lock) * (0.38 + (fi % 4) * 0.06);
      const q = f.map(vi => { const v = lk.v[vi], a = t * 0.15 * (1 - lock) + rot, ca = Math.cos(a), sa = Math.sin(a); const r = [v[0] * ca - v[2] * sa, v[1], v[0] * sa + v[2] * ca]; const cr = [c[0] * ca - c[2] * sa, c[1], c[0] * sa + c[2] * ca]; return [0, 1, 2].map(j => r[j] * 1.03 * shellR + cr[j] * off); });
      const col = grey.map((g, j) => lerp(g, ice[j], lock)), al = lerp(0.18, 0.32, lock);
      L.seg(q[0], q[1], col, al); L.seg(q[1], q[2], col, al); L.seg(q[2], q[0], col, al);
    }
    L.k = 0.25 + 0.75 * Math.max(lock, st.lockTo); L.upload();
    lk.v.forEach((v, k) => D.lockPts.pos.set(v.map(x => x * 1.03 * shellR), k * 3)); D.lockPts.upload('p'); D.lockPts.base = lock * 0.55;
  },
  pick(x, y) { return R.pickPoints(this.pts, x, y, 10); },
  hover(x, y) {
    const i = this.pick(x, y); if (i < 0) return UI.showTip(0, 0, ''); const m = this.mem[i], l = this.lines[m.li], n = STKB.nodes[m.node];
    UI.showTip(x, y, `<b>${esc(l.name)}</b><br>${m.kind === 'c' ? 'commit ' : m.kind === 'q' ? 'döntés ' : ''}${esc(n ? n.title : '')}`);
  },
  tap(x, y) { const i = this.pick(x, y); if (i < 0) return; const li = this.mem[i].li; this.isolate(this.st.iso === li ? -1 : li); },
  onKey(k) { if (k === 'g') { const i = FORMS.findIndex(f => f[0] === this.st.form); this.go(FORMS[(i + 1) % FORMS.length][0]); return true; } if (k === 'l') { this.st.lockTo = this.st.lockTo ? 0 : 1; const el = $('ho-lock'); if (el) el.checked = !!this.st.lockTo; return true; } },
  overlay(c) {
    const f = this.st.tr || this.st.lock > 0.5 ? null : this.st.form; if (!f) return;
    if (f === 'earth') this.lines.forEach(l => label(c, l.name, l.cap.map(x => x * 1.04)));
    if (f === 'polip') this.lines.forEach(l => { if (l.active) label(c, l.name, this.arm(l, 1)); });
    if (f === 'core') this.lines.forEach(l => { if (l.entry) label(c, l.name, l.entry.map(x => x * 1.05)); });
  },
};
