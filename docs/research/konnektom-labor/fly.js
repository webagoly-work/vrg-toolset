/* ================= 1 · Muslica: the FlyWire v783 brain, every neuron, a working cell-type model on top */
const SC_COL = ['#5b8fe0', '#e8a873', '#8bcca1', '#93d3e6', '#c6a0e6', '#e4877d', '#b9e08a', '#6fb7c9', '#ff9a52', '#f0dc6e'];
const SC_HU = { optic: 'látólebeny', central: 'központi agy', sensory: 'érzékelő', visual_projection: 'vizuális vetítő', ascending: 'felszálló', descending: 'leszálló (parancs)', sensory_ascending: 'érzékelő-felszálló', visual_centrifugal: 'vizuális centrifugális', motor: 'motoros', endocrine: 'endokrin' };
const NT_COL = ['#e3be7b', '#7fd3ec', '#e4877d', '#c6a0e6', '#8bcca1', '#f0dc6e'];
const NT_HU = { acetylcholine: 'acetilkolin (+)', glutamate: 'glutamát (−)', gaba: 'GABA (−)', dopamine: 'dopamin', serotonin: 'szerotonin', octopamine: 'oktopamin' };
const STIM = [
  ['olf', 'Szag', g => FLYD.cc[g] === 'olfactory', 'szaglóreceptor-neuronok (ORN), az antennából'],
  ['gust', 'Íz', g => FLYD.cc[g] === 'gustatory', 'ízérzékelő neuronok (GRN): a szívókától a GNG-ig'],
  ['mech', 'Tapintás / hang', g => FLYD.cc[g] === 'mechanosensory', 'mechanoszenzoros neuronok (Johnston-szerv, szőrök)'],
  ['light', 'Fény', g => /^R1-6$|^R7$|^R8$/.test(FLYD.types[g]), 'fotoreceptorok (R1–6, R7, R8) mindkét szemben'],
  ['oc', 'Pontszem', g => FLYD.cc[g] === 'ocellar', 'a három pontszem (ocellus) neuronjai'],
  ['therm', 'Hő / pára', g => /thermo|hygro/.test(FLYD.cc[g]), 'hő- és páraérzékelő neuronok'],
];
let FLYD = null;
const Fly = {
  key: 'fly', name: 'Muslica', sets: [], px: 1,
  st: { col: 'sc', gain: 4, inh: 1.5, adapt: 0.4, noise: 0.02, bright: 0.5, run: true, stim: new Set(['olf']), hist: [], dnHist: [], sel: -1, lesion: new Set(), pulse: new Float32Array(0) },
  async init() {
    const F = window.FLY; FLYD = F;
    const [pos, es, ed, eq] = await Promise.all([unz(F.pos), unz(F.es), unz(F.ed), unz(F.eq)]);
    const P = new Uint8Array(pos), S = new Uint16Array(es), D = new Uint16Array(ed), Q = new Int8Array(eq), G = F.types.length, N = F.n, E = S.length;
    this.G = G; this.N = N;
    // neurons come sorted by group: group g owns [start[g], start[g+1])
    const start = new Int32Array(G + 1); for (let g = 0; g < G; g++) start[g + 1] = start[g] + F.size[g]; this.start = start;
    const gid = new Uint16Array(N); for (let g = 0; g < G; g++) gid.fill(g, start[g], start[g + 1]); this.gid = gid;
    const pts = new R.Points(N), r = rng(7), span = [F.hi[0] - F.lo[0], F.hi[1] - F.lo[1], F.hi[2] - F.lo[2]], c = [(F.hi[0] + F.lo[0]) / 2, (F.hi[1] + F.lo[1]) / 2, (F.hi[2] + F.lo[2]) / 2], SCL = 450;
    const cen = new Float32Array(G * 3);
    for (let i = 0; i < N; i++) {
      const x = F.lo[0] + (P[i * 3] + r() - .5) / 255 * span[0], y = F.lo[1] + (P[i * 3 + 1] + r() - .5) / 255 * span[1], z = F.lo[2] + (P[i * 3 + 2] + r() - .5) / 255 * span[2];
      const X = (x - c[0]) / SCL, Y = -(y - c[1]) / SCL, Z = -(z - c[2]) / SCL;
      pts.pos[i * 3] = X; pts.pos[i * 3 + 1] = Y; pts.pos[i * 3 + 2] = Z; const g = gid[i]; cen[g * 3] += X; cen[g * 3 + 1] += Y; cen[g * 3 + 2] += Z;
    }
    for (let g = 0; g < G; g++) for (let k = 0; k < 3; k++) cen[g * 3 + k] /= F.size[g];
    this.cen = cen; this.pts = pts;
    pts.size.fill(1.7); pts.hot = [1, .93, .78];
    // incoming CSR, weights normalised per target (saturating in the total input)
    const inS = new Int32Array(G + 1); for (let e = 0; e < E; e++) inS[D[e] + 1]++; for (let g = 0; g < G; g++) inS[g + 1] += inS[g];
    const fill = inS.slice(), inSrc = new Uint16Array(E), inW = new Float32Array(E), raw = new Float32Array(E);
    for (let e = 0; e < E; e++) { const k = fill[D[e]]++, q = Q[e]; inSrc[k] = S[e]; raw[k] = Math.sign(q) * (Math.pow(2, Math.abs(q) / 16) - 1) / 4; }
    for (let j = 0; j < G; j++) { let s = 0; for (let k = inS[j]; k < inS[j + 1]; k++) s += Math.abs(raw[k]); const sat = s / (s + 2); for (let k = inS[j]; k < inS[j + 1]; k++) inW[k] = raw[k] / (s || 1) * sat; }
    this.inS = inS; this.inSrc = inSrc; this.inW = inW; this.raw = raw;
    // outgoing lists (for the info card and the edge view)
    const outS = new Int32Array(G + 1); for (let e = 0; e < E; e++) outS[S[e] + 1]++; for (let g = 0; g < G; g++) outS[g + 1] += outS[g];
    const of = outS.slice(), outDst = new Uint16Array(E), outQ = new Int8Array(E); for (let e = 0; e < E; e++) { const k = of[S[e]]++; outDst[k] = D[e]; outQ[k] = Q[e]; }
    this.outS = outS; this.outDst = outDst; this.outQ = outQ; this.E = E;
    this.r = new Float32Array(G); this.nr = new Float32Array(G); this.a = new Float32Array(G); this.st.pulse = new Float32Array(G);
    this.flick = new Float32Array(N); for (let i = 0; i < N; i++) this.flick[i] = 0.7 + 0.6 * r();
    this.edges = new R.Lines(4000); this.sets = [pts, this.edges];
    // label anchors from the data itself: the centroid of a class, per side where it has two
    const anchor = (fn, split) => { const acc = {}; for (let g = 0; g < G; g++) if (fn(g)) for (let i = start[g]; i < start[g + 1]; i++) { const X = pts.pos[i * 3], k = split ? (X < 0 ? 'l' : 'r') : 'c', a = acc[k] || (acc[k] = [0, 0, 0, 0]); a[0] += X; a[1] += pts.pos[i * 3 + 1]; a[2] += pts.pos[i * 3 + 2]; a[3]++; } return Object.values(acc).map(a => [a[0] / a[3], a[1] / a[3], a[2] / a[3]]); };
    this.labels = [
      ['látólebeny', anchor(g => F.SC[F.sc[g]] === 'optic', true)], ['gombatest (Kenyon-sejtek)', anchor(g => F.cc[g] === 'Kenyon_Cell', true)],
      ['antennalebeny', anchor(g => /^(ALPN|ALLN)$/.test(F.cc[g]), true)], ['központi komplex', anchor(g => F.cc[g] === 'CX', false)],
      ['leszálló neuronok (GNG felé)', anchor(g => F.SC[F.sc[g]] === 'descending', false)],
    ];
    this.recolor(); pts.upload();
  },
  recolor() {
    const F = FLYD, p = this.pts, mode = this.st.col, cs = SC_COL.map(hex), cn = NT_COL.map(hex);
    for (let g = 0; g < this.G; g++) {
      let c = mode === 'sc' ? cs[F.sc[g]] : mode === 'nt' ? (F.nt[g] >= 0 ? cn[F.nt[g]] : [.5, .55, .6]) : hsl((mix32(g, 3) % 360) / 360, .65, .6);
      if (this.st.lesion.has(g)) c = [.25, .08, .08];
      for (let i = this.start[g]; i < this.start[g + 1]; i++) p.col.set(c, i * 3);
    }
    p.upload('c');
  },
  enter() {
    const c = R.cam; Object.assign(c, { yaw: 0.0, pitch: 0.12, dist: 2.6, tgt: [0, 0, 0], auto: 0.05 });
    const st = this.st, F = FLYD;
    UI.set(`
      <h2>Muslica-agy <small>FlyWire FAFB v783</small></h2>
      <p class="lead">Mind a ${fmt(F.n)} neuron a saját helyén, ${fmt(F.syn)} szinapszis ${fmt(F.conn)} kapcsolatban. Felette egy működő modell: ${fmt(this.G)} sejttípus, ${fmt(this.E)} előjeles él.</p>
      <div class="grp"><h3>Inger</h3>${UI.chips('fl-stim', STIM.map(s => [s[0], s[1]]), '')}
      <p class="hint" id="fl-stim-h">Koppints egy neuronra: rövid impulzust kap az egész típusa. Shift + koppintás: kiiktatás (lézió).</p></div>
      <div class="grp"><h3>Modell</h3>
      ${UI.slider('fl-gain', 'Erősítés', 1, 10, 0.1, st.gain)}${UI.slider('fl-inh', 'Gátlás (GABA, glutamát)', 0, 3, 0.05, st.inh)}
      ${UI.slider('fl-ad', 'Adaptáció', 0, 1.5, 0.05, st.adapt)}${UI.slider('fl-no', 'Zaj', 0, 0.2, 0.005, st.noise)}
      <div class="row"><button type="button" id="fl-run">${st.run ? 'Szünet' : 'Indítás'}</button><button type="button" id="fl-reset">Csend</button><button type="button" id="fl-heal">Léziók törlése</button></div></div>
      <div class="grp"><h3>Szín</h3>${UI.chips('fl-col', [['sc', 'Szuperosztály'], ['nt', 'Transzmitter'], ['type', 'Sejttípus']], st.col)}
      ${UI.slider('fl-br', 'Fényerő', 0.05, 1, 0.01, st.bright)}<div id="fl-lg"></div></div>
      <div class="grp"><h3>Kimenet</h3><canvas class="spark" id="fl-sp"></canvas><p class="hint"><span class="k1">━</span> aktív neuronok &nbsp;<span class="k2">━</span> leszálló parancsneuronok (viselkedés)</p><ol class="top" id="fl-top"></ol></div>
      <p class="src">Forrás: FlyWire 783 (Dorkenwald et al., Schlegel et al., Nature 2024), annotációk: flyconnectome/flywire_annotations; kapcsolatok és előjel: Shiu et al., Nature 2024. A modell sejttípus-szintű rátamodell, nem tüskemodell.</p>`);
    $('fl-stim').querySelectorAll('button').forEach(b => b.classList.toggle('on', st.stim.has(b.dataset.k)));
    $('fl-stim').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k; st.stim.has(k) ? st.stim.delete(k) : st.stim.add(k); b.classList.toggle('on', st.stim.has(k)); const s = STIM.find(x => x[0] === k); $('fl-stim-h').textContent = s[3] + (st.stim.has(k) ? ': bekapcsolva.' : ': kikapcsolva.'); });
    UI.bind('fl-gain', v => st.gain = v); UI.bind('fl-inh', v => st.inh = v); UI.bind('fl-ad', v => st.adapt = v); UI.bind('fl-no', v => st.noise = v);
    UI.bind('fl-br', v => st.bright = v);
    UI.bindChips('fl-col', k => { st.col = k; this.recolor(); this.legend(); });
    $('fl-run').onclick = () => { st.run = !st.run; $('fl-run').textContent = st.run ? 'Szünet' : 'Indítás'; };
    $('fl-reset').onclick = () => { this.r.fill(0); this.a.fill(0); st.stim.clear(); $('fl-stim').querySelectorAll('button').forEach(b => b.classList.remove('on')); };
    $('fl-heal').onclick = () => { st.lesion.clear(); this.recolor(); UI.toast('Minden lézió törölve.'); };
    this.legend(); this.select(st.sel);
  },
  peek() {
    const st = this.st, on = STIM.filter(s => st.stim.has(s[0])).map(s => s[1]).join(', ') || 'nincs inger', n = Math.round(st.hist[st.hist.length - 1] || 0);
    return { text: `<b>${esc(on)}</b><br>${fmt(n)} aktív neuron`, acts: [[st.stim.has('olf') ? 'Szag ki' : 'Szag', () => { const b = document.querySelector('#fl-stim [data-k=olf]'); if (b) b.click(); }], [st.run ? 'Szünet' : 'Indítás', () => clk('fl-run'), true]] };
  },
  legend() {
    const F = FLYD, m = this.st.col; let html = '';
    if (m === 'sc') { const cnt = {}; F.sc.forEach((s, g) => cnt[s] = (cnt[s] || 0) + F.size[g]); html = legend(F.SC.map((s, i) => [SC_COL[i], SC_HU[s] || s, fmt(cnt[i] || 0)])); }
    else if (m === 'nt') { const cnt = {}; F.nt.forEach((s, g) => cnt[s] = (cnt[s] || 0) + F.size[g]); html = legend(F.NT.map((s, i) => [NT_COL[i], NT_HU[s], fmt(cnt[i] || 0)])); }
    else html = '<p class="hint">Minden sejttípus saját színt kap: így látszik, hogy a látólebeny oszlopai ugyanabból a néhány típusból épülnek.</p>';
    $('fl-lg').innerHTML = html;
  },
  step(dt) {
    const st = this.st, G = this.G, r = this.r, nr = this.nr, a = this.a, inS = this.inS, inSrc = this.inSrc, inW = this.inW, F = FLYD;
    const clampTo = new Float32Array(G); for (const k of st.stim) { const s = STIM.find(x => x[0] === k); for (let g = 0; g < G; g++) if (s[2](g)) clampTo[g] = 0.9 + 0.1 * Math.sin(performance.now() / 300 + g); }
    const pu = st.pulse, rate = clamp(dt * 6, 0, 0.5), aRate = dt * 0.8, th = 0.05, gain = st.gain, inh = st.inh, ad = st.adapt, noise = st.noise;
    for (let j = 0; j < G; j++) {
      if (st.lesion.has(j)) { nr[j] = 0; continue; }
      if (clampTo[j] > 0 || pu[j] > 0) { nr[j] = Math.max(clampTo[j], pu[j]); continue; }
      let I = 0; for (let k = inS[j]; k < inS[j + 1]; k++) { const w = inW[k]; I += (w < 0 ? w * inh : w) * r[inSrc[k]]; }
      const x = gain * (I - th - ad * a[j]) + (noise ? (Math.random() - .5) * noise * 4 : 0), f = x > 0 ? Math.tanh(x) : 0;
      nr[j] = r[j] + rate * (f - r[j]);
    }
    r.set(nr); for (let j = 0; j < G; j++) { a[j] += aRate * (r[j] - a[j]); if (pu[j] > 0) pu[j] = Math.max(0, pu[j] - dt * 1.5); }
    let act = 0, dn = 0, dnc = 0; for (let j = 0; j < G; j++) { act += r[j] * F.size[j]; if (F.sc[j] === 5) { dn += r[j]; dnc++; } }
    st.hist.push(act); st.dnHist.push(dnc ? dn / dnc : 0); if (st.hist.length > 240) { st.hist.shift(); st.dnHist.shift(); }
  },
  frame(dt, t) {
    if (this.st.run) { this.step(Math.min(dt, 0.05)); this.step(Math.min(dt, 0.05)); }
    const p = this.pts, r = this.r, gid = this.gid, fl = this.flick, N = this.N; p.base = this.st.bright;
    const ph = t * 7;
    for (let i = 0; i < N; i++) { const v = r[gid[i]]; p.act[i] = v > 0.02 ? v * (fl[i] + 0.3 * Math.sin(ph * fl[i] + i)) : 0; }
    p.upAct();
    if ((this._ui = (this._ui || 0) + dt) > 0.25) { this._ui = 0; this.readout(); }
  },
  readout() {
    const sp = $('fl-sp'); if (!sp) return; const st = this.st;
    spark(sp, [{ data: st.hist.map(v => v / this.N), col: getComputedStyle(document.documentElement).getPropertyValue('--warm'), fill: 1 }, { data: st.dnHist, col: getComputedStyle(document.documentElement).getPropertyValue('--acc') }], { n: 240, max: 0.3 });
    const F = FLYD, idx = []; for (let g = 0; g < this.G; g++) if (this.r[g] > 0.05) idx.push(g);
    idx.sort((a, b) => this.r[b] * Math.sqrt(F.size[b]) - this.r[a] * Math.sqrt(F.size[a]));
    const dns = idx.filter(g => F.sc[g] === 5 || F.sc[g] === 8).slice(0, 3);
    const top = [...new Set([...dns, ...idx.slice(0, 6)])].slice(0, 8);
    $('fl-top').innerHTML = top.length ? top.map(g => `<li data-g="${g}"><b>${esc(F.types[g])}</b> <span>${esc(SC_HU[F.SC[F.sc[g]]] || '')} · ${F.size[g]} db</span><i style="width:${Math.round(this.r[g] * 100)}%"></i></li>`).join('') : '<li class="hint">Csend. Kapcsolj be egy ingert.</li>';
    $('fl-top').onclick = e => { const li = e.target.closest('li[data-g]'); if (li) this.select(+li.dataset.g); };
    const sel = this.st.sel; if (sel >= 0) { const el = $('fl-sel-r'); if (el) el.textContent = this.r[sel].toFixed(2); }
  },
  select(g) {
    this.st.sel = g; const L = this.edges; L.clear();
    if (g < 0) { UI.info.hidden = true; L.upload(); return; }
    const F = FLYD, c = this.cen, P = k => [c[k * 3], c[k * 3 + 1], c[k * 3 + 2]];
    const ins = [], outs = [];
    for (let k = this.inS[g]; k < this.inS[g + 1]; k++) ins.push([this.inSrc[k], this.raw[k]]);
    for (let k = this.outS[g]; k < this.outS[g + 1]; k++) outs.push([this.outDst[k], this.outQ[k]]);
    ins.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])); outs.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    for (const [s, w] of ins.slice(0, 40)) L.seg(P(s), P(g), w > 0 ? [.55, .8, 1] : [1, .45, .4], .1, [1, 1, 1], .6);
    for (const [d, q] of outs.slice(0, 60)) L.seg(P(g), P(d), [1, 1, 1], .6, q > 0 ? [1, .75, .4] : [1, .4, .5], .12);
    L.upload();
    const nm = k => `<a href="#" data-g="${k}">${esc(F.types[k])}</a>`;
    UI.info.hidden = false;
    UI.info.innerHTML = `<button type="button" class="x" aria-label="Bezárás" id="fl-x">×</button><h3>${esc(F.types[g])}</h3>
      <dl><dt>Osztály</dt><dd>${esc(SC_HU[F.SC[F.sc[g]]] || F.SC[F.sc[g]])}${F.cc[g] ? ' · ' + esc(F.cc[g]) : ''}</dd><dt>Neuron</dt><dd>${F.size[g]} db · ${esc(F.side[g] === 'l' ? 'bal' : F.side[g] === 'r' ? 'jobb' : F.side[g] === 'lr' ? 'két oldal' : F.side[g] || '–')}</dd>
      <dt>Transzmitter</dt><dd>${F.nt[g] >= 0 ? esc(NT_HU[F.NT[F.nt[g]]]) : '–'}</dd><dt>Aktivitás</dt><dd id="fl-sel-r">${this.r[g].toFixed(2)}</dd></dl>
      <p><b>Bemenet</b> ${ins.slice(0, 6).map(([s, w]) => nm(s) + (w < 0 ? '<sup>−</sup>' : '')).join(', ') || '–'}</p>
      <p><b>Kimenet</b> ${outs.slice(0, 6).map(([d, q]) => nm(d) + (q < 0 ? '<sup>−</sup>' : '')).join(', ') || '–'}</p>
      <div class="row"><button type="button" id="fl-pulse">Impulzus</button><button type="button" id="fl-les">${this.st.lesion.has(g) ? 'Visszakapcsolás' : 'Kiiktatás'}</button></div>`;
    $('fl-x').onclick = () => this.select(-1);
    $('fl-pulse').onclick = () => { this.st.pulse[g] = 1; };
    $('fl-les').onclick = () => { this.st.lesion.has(g) ? this.st.lesion.delete(g) : this.st.lesion.add(g); this.recolor(); this.select(g); };
    UI.info.querySelectorAll('a[data-g]').forEach(a => a.onclick = e => { e.preventDefault(); this.select(+a.dataset.g); });
  },
  tap(x, y, e) {
    const i = R.pickPoints(this.pts, x, y, 10); if (i < 0) { this.select(-1); return; }
    const g = this.gid[i];
    if (e.shiftKey) { this.st.lesion.has(g) ? this.st.lesion.delete(g) : this.st.lesion.add(g); this.recolor(); UI.toast(`${FLYD.types[g]}: ${this.st.lesion.has(g) ? 'kiiktatva' : 'visszakapcsolva'}`); }
    else this.st.pulse[g] = 1;
    this.select(g);
  },
  hover(x, y) {
    const i = R.pickPoints(this.pts, x, y, 8); if (i < 0) return UI.showTip(0, 0, '');
    const g = this.gid[i], F = FLYD; UI.showTip(x, y, `<b>${esc(F.types[g])}</b><br>${esc(SC_HU[F.SC[F.sc[g]]] || '')} · ${F.size[g]} neuron · r = ${this.r[g].toFixed(2)}`);
  },
  overlay(c) {
    if (!this.showLabels) return;
    for (const [t, ps] of this.labels) for (const p of ps) label(c, t, p);
  },
};
