/* ================= 4 · Rétegverem: the ten layers as an exploded stack (Stack/layers.html), each plane in its own natural order */
const Layers = {
  key: 'layers', name: 'Rétegverem', sets: [], px: 1.1,
  st: { gap: 0.36, all: false, solo: null, hide: new Set(), sel: -1 },
  init() {
    STKB.build(); const K = STKB, nodes = K.nodes;
    this.planes = LORDER.map(L => ({ L, ids: nodes.filter(n => n.L === L).map(n => n.i) }));
    // 2D layout per plane in [-1, 1]²
    const xy = new Float32Array(nodes.length * 2);
    const tree = ids => {   // radial folder tree: angle by leaf share, radius by depth
      const root = { kids: new Map(), leaves: [] };
      for (const i of ids) { const parts = nodes[i].title.split('/'); let n = root; for (const p of parts.slice(0, -1)) { if (!n.kids.has(p)) n.kids.set(p, { kids: new Map(), leaves: [] }); n = n.kids.get(p); } n.leaves.push(i); }
      const count = n => n.c = n.leaves.length + [...n.kids.values()].reduce((s, k) => s + count(k), 0);
      count(root); const maxD = 6;
      const place = (n, a0, a1, d) => {
        let a = a0; const span = a1 - a0;
        n.leaves.forEach((i, k) => { const aa = a0 + span * (k + .5) / Math.max(1, n.c), r = 0.12 + 0.84 * Math.min(1, (d + 0.6 + (k % 3) * 0.12) / maxD); xy[i * 2] = r * Math.cos(aa); xy[i * 2 + 1] = r * Math.sin(aa); });
        a = a0 + span * n.leaves.length / Math.max(1, n.c);
        for (const k of [...n.kids.values()].sort((p, q) => q.c - p.c)) { const s = span * k.c / Math.max(1, n.c); place(k, a, a + s, d + 1); a += s; }
      };
      place(root, 0, Math.PI * 2, 0);
    };
    for (const pl of this.planes) {
      const ids = pl.ids, n = ids.length; if (!n) continue;
      if ('CGFAI'.includes(pl.L)) tree(ids);
      else if (pl.L === 'R') ids.forEach((i, k) => { const t = k / Math.max(1, n - 1), a = t * Math.PI * 3.2, r = 0.2 + 0.75 * t; xy[i * 2] = r * Math.cos(a); xy[i * 2 + 1] = r * Math.sin(a); });
      else if (pl.L === 'Q') { const ns = [...new Set(ids.map(i => nodes[i].title.split('-')[0]))]; ids.forEach(i => { const g = ns.indexOf(nodes[i].title.split('-')[0]), inG = ids.filter(j => nodes[j].title.split('-')[0] === ns[g]), k = inG.indexOf(i), a = g / ns.length * Math.PI * 2, r = 0.25 + 0.06 * Math.sqrt(k), b = k * 2.4; xy[i * 2] = 0.55 * Math.cos(a) + r * 0.5 * Math.cos(b); xy[i * 2 + 1] = 0.55 * Math.sin(a) + r * 0.5 * Math.sin(b); }); }
      else if (pl.L === 'E') { const A = window.STK.areas; ids.forEach((i, k) => { const g = Math.max(0, A.indexOf(nodes[i].area)), inG = ids.filter(j => nodes[j].area === nodes[i].area), kk = inG.indexOf(i), a = g / A.length * Math.PI * 2 + (kk - inG.length / 2) * 0.09; xy[i * 2] = 0.78 * Math.cos(a); xy[i * 2 + 1] = 0.78 * Math.sin(a); }); }
      else ids.forEach((i, k) => { const a = k / n * Math.PI * 2; xy[i * 2] = 0.6 * Math.cos(a); xy[i * 2 + 1] = 0.6 * Math.sin(a); });
    }
    this.xy = xy;
    const N = nodes.length, p = new R.Points(N); this.pts = p;
    nodes.forEach((n, i) => { p.col.set(hex(LAYER[n.L].col), i * 3); p.size[i] = n.L === 'C' || n.L === 'G' || n.L === 'F' ? 2.4 + Math.min(2.6, Math.log2(1 + n.b / 4096) * 0.5) : 3.6; });
    p.base = 1; p.hot = [1, 1, 1];
    this.frameL = new R.Lines(LORDER.length * 8 + 8); this.conn = new R.Lines(K.edges.length * 2 + 8); this.selL = new R.Lines(6000);
    this.sets = [this.frameL, this.conn, p, this.selL];
    this.layout();
  },
  y(L) { const k = LORDER.indexOf(L); return (LORDER.length / 2 - k - .5) * this.st.gap; },
  vis(L) { return !this.st.hide.has(L) && (!this.st.solo || this.st.solo === L); },
  layout() {
    const K = STKB, p = this.pts, xy = this.xy, st = this.st;
    K.nodes.forEach((n, i) => { const v = this.vis(n.L); p.pos.set([xy[i * 2], this.y(n.L), xy[i * 2 + 1]], i * 3); p.size[i] = v ? (n.L === 'C' || n.L === 'G' || n.L === 'F' ? 2.4 + Math.min(2.6, Math.log2(1 + n.b / 4096) * 0.5) : 3.6) : 0; });
    p.upload();
    const F = this.frameL; F.clear();
    for (const L of LORDER) { if (!this.vis(L)) continue; const y = this.y(L), c = hex(LAYER[L].col), s = 1.08, q = [[-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]]; for (let k = 0; k < 4; k++) F.seg(q[k], q[(k + 1) % 4], c, .22); }
    F.upload();
    const C = this.conn; C.clear(); const P = i => [p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]];
    if (st.all) for (const [a, b] of K.edges) { const A = K.nodes[a], B = K.nodes[b]; if (A.L === B.L || !this.vis(A.L) || !this.vis(B.L)) continue; C.seg(P(a), P(b), hex(LAYER[A.L].col), .05, hex(LAYER[B.L].col), .05); }
    C.upload(); this.select(st.sel);
  },
  select(i) {
    const st = this.st, K = STKB, p = this.pts, S = this.selL; st.sel = i; S.clear(); p.act.fill(0);
    const P = k => [p.pos[k * 3], p.pos[k * 3 + 1], p.pos[k * 3 + 2]];
    if (i >= 0) {
      p.act[i] = 1.2; const n = K.nodes[i]; let cnt = 0;
      for (const [a, b] of K.edges) { if (a !== i && b !== i) continue; const o = a === i ? b : a; if (!this.vis(K.nodes[o].L)) continue; p.act[o] = 0.8; S.seg(P(i), P(o), [1, 1, 1], .7, hex(LAYER[K.nodes[o].L].col), .55); cnt++; }
      // the pillar as one vertical line through the planes where it has nodes
      const pid = n.L === 'E' ? n.p : n.p; if (pid) {
        const pts2 = [];
        for (const L of LORDER) { if (!this.vis(L)) continue; let c = [0, 0], m = 0; K.nodes.forEach((q, k) => { if (q.L === L && q.p === pid) { c[0] += this.xy[k * 2]; c[1] += this.xy[k * 2 + 1]; m++; } }); if (m) pts2.push([c[0] / m, this.y(L), c[1] / m]); }
        for (let k = 1; k < pts2.length; k++) { S.seg(pts2[k - 1], pts2[k], [1, .85, .55], .9); }
        pts2.forEach(q => { const r = 0.05, ring = []; for (let s = 0; s <= 16; s++) ring.push([q[0] + r * Math.cos(s / 16 * 6.283), q[1], q[2] + r * Math.sin(s / 16 * 6.283)]); S.poly(ring, [1, .85, .55], .8); });
      }
      const pil = n.p && K.pil[n.p];
      UI.info.hidden = false;
      UI.info.innerHTML = `<button type="button" class="x" aria-label="Bezárás" id="la-x">×</button><h3>${esc(n.title)}</h3><dl><dt>Réteg</dt><dd>${n.L} · ${esc(LAYER[n.L].hu)}</dd>${pil ? `<dt>Pillér</dt><dd>${esc(pil[1])} <em>(arany függőleges vonal)</em></dd>` : ''}<dt>Kötők</dt><dd>${cnt} másik rétegbe vagy ugyanebbe</dd></dl>`;
      $('la-x').onclick = () => this.select(-1);
    } else UI.info.hidden = true;
    S.upload(); p.upAct();
  },
  enter() {
    Object.assign(R.cam, { yaw: Math.PI / 4, pitch: 0.5, dist: 6.4, tgt: [0, 0, 0], auto: 0 });
    const st = this.st, K = STKB, cnt = {}; K.nodes.forEach(n => cnt[n.L] = (cnt[n.L] || 0) + 1);
    UI.set(`
      <h2>Rétegverem <small>tíz réteg, szétszedve</small></h2>
      <p class="lead">Minden réteg egy sík a saját rendjében: a kód, a dokumentumok és az appok mappafaként, a commitok időspirálként, a döntések névtér szerint, a pillérek terület szerint. A függőleges kötők a rétegek közti kapcsolatok.</p>
      <div class="grp"><h3>Síkok</h3><ul class="planes" id="la-pl">${LORDER.map(L => `<li data-l="${L}" class="${st.hide.has(L) ? 'off' : ''} ${st.solo === L ? 'on' : ''}"><i style="background:${LAYER[L].col}"></i><b>${L}</b> ${esc(LAYER[L].hu)} <em>${cnt[L] || 0}</em><button type="button" data-a="solo">csak ez</button><button type="button" data-a="hide">${st.hide.has(L) ? 'mutat' : 'rejt'}</button></li>`).join('')}</ul></div>
      <div class="grp"><h3>Nézet</h3>${UI.slider('la-gap', 'Távolság', 0.12, 0.8, 0.01, st.gap)}<div class="tgs">${UI.toggle('la-all', 'Minden kötő (' + fmt(K.edges.length) + ')', st.all)}</div>
      <div class="row"><button type="button" id="la-iso">Izometrikus alap</button><button type="button" id="la-top">Felülnézet</button></div>
      <p class="hint">Koppints egy pontra: csak a saját kötői látszanak, és a pillére arany vonalként fut át a síkokon.</p></div>
      <p class="src">A U (futás) sík üres: az ügynöki session-átiratok a gépen vannak, ebben a fájlban nincsenek.</p>`);
    $('la-pl').addEventListener('click', e => { const li = e.target.closest('li[data-l]'); if (!li) return; const L = li.dataset.l, a = e.target.dataset.a;
      if (a === 'hide') { st.hide.has(L) ? st.hide.delete(L) : st.hide.add(L); } else if (a === 'solo') st.solo = st.solo === L ? null : L; else st.solo = st.solo === L ? null : L;
      this.layout(); this.enterRefresh(); });
    UI.bind('la-gap', v => { st.gap = v; this.layout(); }); UI.bindToggle('la-all', v => { st.all = v; this.layout(); });
    $('la-iso').onclick = () => Object.assign(R.cam, { yaw: Math.PI / 4, pitch: 0.5, dist: 6.4, tgt: [0, 0, 0] });
    $('la-top').onclick = () => Object.assign(R.cam, { yaw: 0, pitch: 1.5, dist: 3.4, tgt: [0, 0, 0] });
  },
  peek() {
    const i = this.st.sel, n = i >= 0 ? STKB.nodes[i] : null;
    return { text: n ? `<b>${esc(n.L)}</b> ${esc(n.title)}` : 'Koppints egy pontra: a kötői és a pillére látszik.', acts: [['Izo', () => clk('la-iso')], ['Felül', () => clk('la-top')]] };
  },
  enterRefresh() { document.querySelectorAll('#la-pl li').forEach(li => { const L = li.dataset.l; li.classList.toggle('off', this.st.hide.has(L)); li.classList.toggle('on', this.st.solo === L); li.querySelector('[data-a=hide]').textContent = this.st.hide.has(L) ? 'mutat' : 'rejt'; }); },
  frame() { },
  hover(x, y) { const i = R.pickPoints(this.pts, x, y, 9, i => this.pts.size[i] > 0); if (i < 0) return UI.showTip(0, 0, ''); const n = STKB.nodes[i]; UI.showTip(x, y, `<b>${esc(n.title)}</b><br>${n.L} · ${esc(LAYER[n.L].hu)}`); },
  tap(x, y) { const i = R.pickPoints(this.pts, x, y, 10, i => this.pts.size[i] > 0); this.select(i); },
  overlay(c) { for (const L of LORDER) if (this.vis(L)) label(c, `${L} · ${LAYER[L].hu}`, [-1.08, this.y(L), 1.08], LAYER[L].col); },
};
