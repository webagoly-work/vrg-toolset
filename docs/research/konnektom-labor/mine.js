/* ================= 2 · Saját konnektóm: the VRG Stack as a brain (Stack/connectome.html, rebuilt from the repo data) */
const LAYER = {
  F: { col: '#e3be7b', hu: 'Kirakat (appok, kép, ikon)' }, I: { col: '#c6a0e6', hu: 'Ötletek (kutatási jegyzetek)' }, E: { col: '#f2f6f8', hu: 'Pillérek' },
  A: { col: '#7fd3ec', hu: 'Ügynöki gerinc (ügynökök, eszközök, házirend)' }, G: { col: '#8aa4b4', hu: 'Dokumentumok' }, C: { col: '#5b8fe0', hu: 'Kód' },
  L: { col: '#8bcca1', hu: 'Fejlesztési vonalak (GO-kódszavak)' }, Q: { col: '#e4877d', hu: 'Döntések' }, U: { col: '#ff9a52', hu: 'Futás (sessionök)' }, R: { col: '#f0dc6e', hu: 'Repó (commitok)' },
};
const LORDER = ['F', 'I', 'E', 'A', 'G', 'C', 'L', 'Q', 'U', 'R'];
const STKB = {
  done: false,
  build() {
    if (this.done) return; this.done = true;
    const S = window.STK, B = window.BRAIN, cols = S.cols, ci = k => cols.indexOf(k);
    const areaIx = Object.fromEntries(S.areas.map((a, i) => [a, i])), pil = Object.fromEntries(S.pillars.map(p => [p[0], p]));
    const nodes = S.nodes.map((r, i) => ({ i, id: r[ci('id')], L: r[ci('L')], kind: r[ci('kind')], title: r[ci('title')], b: r[ci('b')], p: r[ci('p')], t: r[ci('t')], open: r[ci('open')], area: r[ci('area')] }));
    const regOf = n => { const L = n.L, k = n.kind; if (L === 'F') return 'ctx-occ'; if (L === 'I' || L === 'E') return 'ctx-front'; if (L === 'C') return 'ctx-par'; if (L === 'G') return 'ctx-temp'; if (L === 'A') return k === 'house rules' ? 'hypo' : 'cereb'; if (L === 'L') return 'thal'; if (L === 'Q') return 'hypo'; if (L === 'R') return 'medulla'; return 'ctx-temp'; };
    const sided = r => r.startsWith('ctx') || r === 'thal' || r === 'sc' || r === 'ic';
    for (const n of nodes) {
      n.reg = regOf(n); const pa = n.p && pil[n.p] ? areaIx[pil[n.p][2]] : (hash32(n.title) & 1);
      n.hemi = sided(n.reg) ? (pa % 2 ? 1 : -1) : 0;
      n.nn = Math.min(n.kind === 'asset' ? 24 : 256, Math.max(1, Math.ceil(n.b / 2048)));
    }
    const buckets = {}; for (const n of nodes) (buckets[n.reg + '|' + n.hemi] = buckets[n.reg + '|' + n.hemi] || []).push(n);
    let NN = 0; nodes.forEach(n => NN += n.nn);
    const pos = new Float32Array(NN * 3), owner = new Int32Array(NN), par = new Int32Array(NN).fill(-1), r = rng(20261107);
    let cur = 0;
    for (const key of Object.keys(buckets).sort()) {
      const [reg, h] = key.split('|'), list = buckets[key].sort((a, b) => (a.p || '~').localeCompare(b.p || '~') || (a.t || '').localeCompare(b.t || '') || a.title.localeCompare(b.title));
      const need = list.reduce((s, n) => s + n.nn, 0), pts = B.slots(reg, +h, need, r);
      const gr = B.grow(pts, list.map(n => n.nn), list.map(n => B.patternOf(n.title, n.nn)), r);
      list.forEach((n, k) => {
        n.first = cur; const g = gr[k]; n.count = g.idx.length;
        g.idx.forEach((s, j) => { const q = cur + j; pos.set(pts[s], q * 3); owner[q] = n.i; par[q] = g.par[j] >= 0 ? cur + g.par[j] : -1; });
        cur += g.idx.length;
      });
    }
    this.NN = cur; this.pos = pos; this.owner = owner; this.par = par; this.nodes = nodes;
    this.cen = nodes.map(n => { const c = [0, 0, 0]; for (let j = 0; j < n.count; j++) for (let k = 0; k < 3; k++) c[k] += pos[(n.first + j) * 3 + k]; return c.map(v => v / Math.max(1, n.count)); });
    const E = S.edges; this.edges = []; for (let k = 0; k < E.length; k += 3) this.edges.push([E[k], E[k + 1], E[k + 2]]);
    this.touch = nodes.map(() => []); this.commits = S.commits;
    S.commits.forEach((c, k) => { for (const f of c[3]) this.touch[f].push(k); });
    this.commitNode = S.commits.map(c => nodes.findIndex(n => n.id === 'R:' + c[0]));
    this.pil = pil;
  },
};
const Mine = {
  key: 'mine', name: 'Saját konnektóm', sets: [], px: 1.1,
  st: { parts: true, web: true, edges: false, play: true, speed: 1, ci: 0, hidden: new Set(), q: '' },
  init() {
    STKB.build(); const K = STKB, N = K.NN, p = new R.Points(N);
    p.pos.set(K.pos.subarray(0, N * 3)); this.pts = p; p.hot = [1, .9, .7]; p.base = .8;
    this.recolor();
    const web = new R.Lines(N * 2 + 8); for (let i = 0; i < N; i++) { const j = K.par[i]; if (j >= 0) { const c = hex(LAYER[K.nodes[K.owner[i]].L].col); web.seg([K.pos[i * 3], K.pos[i * 3 + 1], K.pos[i * 3 + 2]], [K.pos[j * 3], K.pos[j * 3 + 1], K.pos[j * 3 + 2]], c, .2); } } web.upload();
    const ed = new R.Lines(K.edges.length * 2 + 8); for (const [a, b] of K.edges) ed.seg(K.cen[a], K.cen[b], hex(LAYER[K.nodes[a].L].col), .05, hex(LAYER[K.nodes[b].L].col), .05); ed.upload();
    const ol = new R.Lines(30000); for (const line of window.BRAIN.outlines()) ol.poly(line, [.58, .83, .9], .12); ol.upload();
    this.tr = new R.Lines(4000); this.trList = [];
    this.web = web; this.ed = ed; this.ol = ol; this.sets = [ol, web, ed, p, this.tr];
    this.act = new Float32Array(N); this.mark = new Float32Array(N); this.clock = 0;
  },
  recolor() {
    const K = STKB, p = this.pts;
    for (let i = 0; i < K.NN; i++) { const n = K.nodes[K.owner[i]]; const c = hex(LAYER[n.L].col), hid = this.st.hidden.has(n.L); p.col[i * 3] = hid ? 0 : c[0]; p.col[i * 3 + 1] = hid ? 0 : c[1]; p.col[i * 3 + 2] = hid ? 0 : c[2]; p.size[i] = hid ? 0 : n.L === 'E' || n.L === 'L' ? 2.4 : n.L === 'R' || n.L === 'Q' ? 1.9 : 1.35; }
    p.upload('pcs'); p.upload('a');
  },
  enter() {
    Object.assign(R.cam, { yaw: 0.9, pitch: 0.22, dist: 3.4, tgt: [0, -0.1, 0], auto: 0.06 });
    const K = STKB, st = this.st, cnt = {}; K.nodes.forEach(n => cnt[n.L] = (cnt[n.L] || 0) + 1);
    const nC = K.commits.length;
    UI.set(`
      <h2>Saját konnektóm <small>VRG Stack, agyként</small></h2>
      <p class="lead">A Rétegverem csomópontjai az agy részeibe rendezve, funkció szerint. Egy pont = 2 KB a lemezen: ${fmt(K.NN)} pont ${fmt(K.nodes.length)} csomópontból. Egy fájl pontjai foltként, fonalként vagy faként nőnek; a commitok tüzelésként futnak végig rajta.</p>
      <div class="grp"><h3>Rétegek</h3><div class="lg lgx" id="mi-lg">${LORDER.map(L => `<button type="button" data-l="${L}" class="${st.hidden.has(L) ? 'off' : ''}"><i style="background:${LAYER[L].col}"></i><b>${L}</b> ${esc(LAYER[L].hu)} <em>${cnt[L] || 0}</em></button>`).join('')}</div>
      <p class="hint">Koppints egy rétegre az elrejtéséhez. A U réteg üres: a session-átiratok nincsenek ebben a fájlban.</p></div>
      <div class="grp"><h3>Nézet</h3><div class="tgs">${UI.toggle('mi-parts', 'Részek', st.parts)}${UI.toggle('mi-web', 'Háló', st.web)}${UI.toggle('mi-edges', 'Élek', st.edges)}</div>
      <input type="search" id="mi-q" placeholder="Keresés: fájl, mappa, döntés…" value="${esc(st.q)}" aria-label="Keresés"></div>
      <div class="grp"><h3>Tüzelés: commitok sorban</h3>
      <div class="row"><button type="button" id="mi-play">${st.play ? 'Szünet' : 'Lejátszás'}</button><button type="button" id="mi-prev" aria-label="Előző">‹</button><button type="button" id="mi-next" aria-label="Következő">›</button></div>
      <input type="range" id="mi-scrub" min="0" max="${nC - 1}" step="1" value="${st.ci}" aria-label="Commit">
      ${UI.slider('mi-sp', 'Tempó (commit / mp)', 0.2, 4, 0.1, st.speed)}
      <div class="commit" id="mi-c"></div></div>
      <div class="grp"><h3>Agyrészek</h3><ul class="parts">${Object.entries(window.BRAIN.REG).map(([k, r]) => `<li><b>${esc(r.hu)}</b> ${esc(r.what)}</li>`).join('')}</ul></div>
      <p class="src">Adat: a vrg-toolset repó (${fmt(K.nodes.length)} csomópont: git ls-files, ${nC} commit, entities.json, DECISIONS fájlok), fej: ${esc(window.STK.head)}. Az elrendezés a Stack brain.js-e, változatlanul.</p>`);
    $('mi-lg').addEventListener('click', e => { const b = e.target.closest('button[data-l]'); if (!b) return; const L = b.dataset.l; st.hidden.has(L) ? st.hidden.delete(L) : st.hidden.add(L); b.classList.toggle('off'); this.recolor(); });
    UI.bindToggle('mi-parts', v => st.parts = v); UI.bindToggle('mi-web', v => st.web = v); UI.bindToggle('mi-edges', v => st.edges = v);
    $('mi-q').addEventListener('input', e => this.search(e.target.value));
    $('mi-play').onclick = () => { st.play = !st.play; $('mi-play').textContent = st.play ? 'Szünet' : 'Lejátszás'; };
    $('mi-prev').onclick = () => this.fire(st.ci - 1); $('mi-next').onclick = () => this.fire(st.ci + 1);
    $('mi-scrub').addEventListener('input', e => this.fire(+e.target.value));
    UI.bind('mi-sp', v => st.speed = v);
    this.fire(st.ci); if (st.q) this.search(st.q);
  },
  search(q) {
    this.st.q = q; this.mark.fill(0); q = q.trim().toLowerCase(); if (q.length < 2) return;
    const K = STKB; let hits = 0, c = [0, 0, 0];
    K.nodes.forEach((n, i) => { if (n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) { hits++; for (let j = 0; j < n.count; j++) this.mark[n.first + j] = 1; for (let k = 0; k < 3; k++) c[k] += K.cen[i][k]; } });
    if (hits) { R.cam.tgt = c.map(v => v / hits); UI.toast(`${hits} találat`); } else UI.toast('Nincs találat.');
  },
  fire(k) {
    const K = STKB, n = K.commits.length; k = (k + n) % n; this.st.ci = k; this.clock = 0;
    const c = K.commits[k], cn = K.commitNode[k], from = K.cen[cn];
    const lit = i => { const nd = K.nodes[i]; for (let j = 0; j < nd.count; j++) this.act[nd.first + j] = 1.2; };
    if (cn >= 0) lit(cn);
    c[3].forEach((f, j) => { lit(f); if (j < 40) this.trList.push({ a: from, b: K.cen[f], age: 0, col: hex(LAYER[K.nodes[f].L].col) }); });
    const sc = $('mi-scrub'); if (sc) sc.value = k;
    const el = $('mi-c'); if (el) el.innerHTML = `<span class="mono">${esc(c[0])} · ${esc(c[1].slice(0, 16).replace('T', ' '))}</span><br>${esc(c[2])}<br><em>${c[3].length} fájl tüzel</em>`;
  },
  frame(dt) {
    const st = this.st, p = this.pts, N = STKB.NN;
    this.ol.on = st.parts; this.web.on = st.web; this.ed.on = st.edges;
    if (st.play) { this.clock += dt * st.speed; if (this.clock > 1) this.fire(st.ci + 1); }
    const d = Math.exp(-dt * 1.4); for (let i = 0; i < N; i++) { this.act[i] *= d; p.act[i] = Math.max(this.act[i], this.mark[i] * (0.7 + 0.3 * Math.sin(performance.now() / 200))); }
    p.upAct();
    const T = this.tr; T.clear(); this.trList = this.trList.filter(x => (x.age += dt) < 1.4);
    for (const x of this.trList) { const a = Math.max(0, 1 - x.age / 1.4); T.seg(x.a, x.b, [1, .95, .7], a * .35, x.col, a * .2); }
    T.upload();
  },
  pickNode(x, y) { const i = R.pickPoints(this.pts, x, y, 10, i => this.pts.size[i] > 0); return i < 0 ? -1 : STKB.owner[i]; },
  hover(x, y) { const i = this.pickNode(x, y); if (i < 0) return UI.showTip(0, 0, ''); const n = STKB.nodes[i]; UI.showTip(x, y, `<b>${esc(n.title)}</b><br>${esc(LAYER[n.L].hu)} · ${(n.b / 1024).toFixed(1)} KB · ${n.count} pont`); },
  tap(x, y) {
    const i = this.pickNode(x, y); if (i < 0) { UI.info.hidden = true; return; }
    const K = STKB, n = K.nodes[i], reg = window.BRAIN.REG[n.reg], pil = n.p && K.pil[n.p];
    const links = K.edges.filter(e => e[0] === i || e[1] === i).slice(0, 14).map(e => { const o = K.nodes[e[0] === i ? e[1] : e[0]]; return `<li><span class="v">${esc(e[2])}</span> ${esc(o.title)}</li>`; }).join('');
    const tc = K.touch[i].slice(-5).reverse().map(k => `<li><a href="#" data-c="${k}">${esc(K.commits[k][0])}</a> ${esc(K.commits[k][2].slice(0, 70))}</li>`).join('');
    UI.info.hidden = false;
    UI.info.innerHTML = `<button type="button" class="x" aria-label="Bezárás" id="mi-x">×</button><h3>${esc(n.title)}</h3>
      <dl><dt>Réteg</dt><dd>${n.L} · ${esc(LAYER[n.L].hu)}</dd><dt>Agyrész</dt><dd>${esc(reg.hu)}${n.hemi ? (n.hemi < 0 ? ', bal' : ', jobb') : ''}</dd><dt>Méret</dt><dd>${(n.b / 1024).toFixed(1)} KB · ${n.count} pont</dd>${pil ? `<dt>Pillér</dt><dd>${esc(pil[1])}</dd>` : ''}</dl>
      ${tc ? `<p><b>Utolsó commitok</b></p><ul class="mini">${tc}</ul>` : ''}${links ? `<p><b>Kapcsolatok</b></p><ul class="mini">${links}</ul>` : ''}`;
    $('mi-x').onclick = () => UI.info.hidden = true;
    UI.info.querySelectorAll('a[data-c]').forEach(a => a.onclick = e => { e.preventDefault(); this.fire(+a.dataset.c); });
    for (let j = 0; j < n.count; j++) this.act[n.first + j] = 1.3;
  },
  overlay(c) {
    if (!this.st.parts) return; const A = window.BRAIN.ANCHOR, REG = window.BRAIN.REG;
    for (const k in A) label(c, REG[k].hu, A[k]);
  },
};
