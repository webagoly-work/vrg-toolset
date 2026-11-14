/* ================= 5 · Üres háló: an empty, human-shaped web made by re-organising the fly's cell-type graph.
   32 768 slots × 16 bytes. Text is written into free slots along a walk through the web; the walk is steered by the
   words, so every text grows its own 3D pattern. Stored only as bytes + paths + one checksum per 16-byte chunk. */
const SLOT = 16, NSLOT = 32768, SKEY = 'konnektom-labor.ures-halo.v1';
const HREG = {
  'ctx-front': { hu: 'Homloklebeny', col: '#e8a873', fly: 'a protocerebrum asszociációs típusai' },
  'ctx-par': { hu: 'Fali lebeny + szomatoszenzoros kéreg', col: '#5b8fe0', fly: 'mechanoszenzoros bemenet, vizuális vetítők egy része' },
  'ctx-temp': { hu: 'Halántéklebeny (piriform kéreg)', col: '#8aa4b4', fly: 'antennalebeny vetítőneuronjai, asszociációs típusok' },
  'ctx-occ': { hu: 'Nyakszirtlebeny (látókéreg)', col: '#93d3e6', fly: 'a lamina és a lobula oszlopai' },
  hippo: { hu: 'Hippokampusz', col: '#c6a0e6', fly: 'gombatest: Kenyon-sejtek, MBON, MBIN' },
  amyg: { hu: 'Amigdala', col: '#e4877d', fly: 'oldalsó szarv (LH) neuronjai' },
  striatum: { hu: 'Bazális ganglionok', col: '#f0dc6e', fly: 'központi komplex (navigáció, cselekvésválasztás)' },
  insula: { hu: 'Inzula (ízkéreg)', col: '#ff9a52', fly: 'ízérzékelő neuronok' },
  olf: { hu: 'Szaglógumó', col: '#b9e08a', fly: 'szaglóreceptorok, antennalebeny helyi neuronjai' },
  vta: { hu: 'VTA / substantia nigra', col: '#d98cc0', fly: 'dopaminerg neuronok (DAN)' },
  thal: { hu: 'Talamusz', col: '#8bcca1', fly: 'felszálló neuronok, TuBu, fotoreceptor-bemenet' },
  hypo: { hu: 'Hipotalamusz', col: '#e3be7b', fly: 'pars intercerebralis, endokrin, hő- és páraérzékelők' },
  sc: { hu: 'Felső ikertest', col: '#6fb7c9', fly: 'vizuális centrifugális neuronok, pontszemek' },
  ic: { hu: 'Alsó ikertest (hallás)', col: '#7fd3ec', fly: 'Johnston-szerv: a muslica „füle”' },
  cereb: { hu: 'Kisagy', col: '#a3b8f0', fly: 'a látólebeny medullájának ismétlődő oszlopai' },
  pons: { hu: 'Híd', col: '#c9a37a', fly: 'leszálló parancsneuronok' },
  medulla: { hu: 'Nyúltvelő', col: '#e0b090', fly: 'motoros neuronok' },
};
const HKEYS = Object.keys(HREG);
// words that steer the walk toward a part of the web (stems, Hungarian and English)
const LEX = [
  ['ctx-occ', ['lát', 'szín', 'fény', 'kép', 'szem', 'vörös', 'kék', 'zöld', 'see', 'look', 'colo', 'light', 'image', 'eye', 'red', 'blue', 'green']],
  ['ic', ['hang', 'zene', 'hall', 'dal', 'zaj', 'sound', 'music', 'hear', 'song', 'noise', 'frekv', 'rezg']],
  ['olf', ['szag', 'illat', 'bűz', 'smell', 'odou', 'odor', 'scent']],
  ['insula', ['íz', 'édes', 'sós', 'keserű', 'savany', 'taste', 'sweet', 'salt', 'bitter', 'cukor', 'sugar', 'étel', 'food']],
  ['amyg', ['fél', 'félel', 'harag', 'düh', 'szeret', 'öröm', 'bánat', 'szív', 'fear', 'anger', 'love', 'joy', 'sad', 'heart']],
  ['hippo', ['emlék', 'tegnap', 'régen', 'gyerek', 'remember', 'memory', 'yesterday', 'once', 'otthon', 'home', 'ház', 'house']],
  ['ctx-front', ['terv', 'dönt', 'cél', 'akar', 'kell', 'plan', 'decide', 'goal', 'want', 'should', 'miért', 'why', 'idea', 'ötlet']],
  ['ctx-par', ['tér', 'mező', 'mágne', 'erő', 'energ', 'irány', 'hely', 'field', 'magnet', 'force', 'energy', 'where', 'space', 'szám', 'number', 'mérték', 'gauge']],
  ['striatum', ['út', 'utaz', 'navig', 'jobbra', 'balra', 'menj', 'way', 'travel', 'route', 'path', 'szokás', 'habit']],
  ['cereb', ['mozdul', 'egyensúly', 'pontos', 'ritmus', 'tánc', 'balance', 'rhythm', 'dance', 'precise', 'gyakorl', 'practice']],
  ['pons', ['fut', 'ugr', 'repül', 'mozog', 'run', 'jump', 'fly', 'move', 'walk', 'jár']],
  ['hypo', ['éhes', 'szomj', 'alv', 'meleg', 'hideg', 'hungry', 'thirst', 'sleep', 'warm', 'cold', 'hőmérs', 'temper']],
];
function crc8(u, o, n) { let c = 0; for (let i = 0; i < n; i++) { c ^= u[o + i]; for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff; } return c; }
const Empty = {
  key: 'empty', name: 'Üres háló', sets: [], px: 1,
  st: { col: 'mem', tool: 'probe', rad: 0.08, T: 0.15, damp: 0.6, rep: 2, web: true, sel: -1, confirm: 0 },
  async init() {
    const F = FLYD, G = Fly.G, B = window.BRAIN, r = rng(32768);
    // ---- 1. each fly cell type gets a human region and a number of slots (∝ √neurons)
    const regOf = g => {
      const sc = F.SC[F.sc[g]], cc = F.cc[g] || '', t = F.types[g], h = mix32(g, 77);
      if (sc === 'optic') return cc === 'ME' ? 'cereb' : 'ctx-occ';
      if (sc === 'visual_projection') return h % 3 ? 'ctx-par' : 'thal';
      if (sc === 'visual_centrifugal') return 'sc';
      if (sc === 'sensory_ascending') return 'pons';
      if (sc === 'sensory') { if (cc === 'olfactory') return 'olf'; if (cc === 'gustatory') return 'insula'; if (cc === 'mechanosensory') return /^JO/.test(t) ? 'ic' : 'ctx-par'; if (cc === 'ocellar') return 'sc'; if (cc === 'visual') return 'thal'; return 'hypo'; }
      if (sc === 'ascending') return 'thal'; if (sc === 'descending') return 'pons'; if (sc === 'motor') return 'medulla'; if (sc === 'endocrine') return 'hypo';
      if (/Kenyon|MBON|MBIN/.test(cc)) return 'hippo'; if (cc === 'DAN') return 'vta'; if (cc === 'CX') return 'striatum';
      if (cc === 'ALLN' || cc === 'ALIN') return 'olf'; if (/ALPN|ALON|mAL|TPN/.test(cc)) return 'ctx-temp';
      if (/LHLN|LHCENT/.test(cc)) return 'amyg'; if (/pars_/.test(cc)) return 'hypo'; if (cc === 'TuBu') return 'thal'; if (cc === 'bilateral') return 'ctx-front';
      return ['ctx-front', 'ctx-front', 'ctx-front', 'ctx-front', 'ctx-par', 'ctx-par', 'ctx-temp', 'ctx-temp'][h % 8];
    };
    const sided = k => /^ctx|hippo|amyg|striatum|insula|olf|vta|thal|sc|ic/.test(k);
    let sq = 0; for (let g = 0; g < G; g++) sq += Math.sqrt(F.size[g]);
    const k = new Int32Array(G), greg = new Array(G), ghemi = new Int8Array(G); let tot = 0;
    for (let g = 0; g < G; g++) { k[g] = Math.max(1, Math.round(Math.sqrt(F.size[g]) * (NSLOT - G * 0.35) / sq)); tot += k[g]; greg[g] = regOf(g); const s = F.side[g]; ghemi[g] = sided(greg[g]) ? (s === 'l' ? -1 : s === 'r' ? 1 : (mix32(g, 5) & 1 ? 1 : -1)) : 0; }
    for (let g = 0; tot > NSLOT; g = (g + 1) % G) if (k[g] > 1) { k[g]--; tot--; }
    for (let g = 0; tot < NSLOT; g = (g + 7) % G) { k[g]++; tot++; }
    // ---- 2. positions: brain.js parts plus deep nuclei of our own; a group's slots are a contiguous patch
    const vol = (c, rr) => n => { const out = []; for (let i = 0; i < n; i++) { let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1); out.push([c[0] + x * rr[0], c[1] + y * rr[1], c[2] + z * rr[2]]); } return out; };
    const tube = h => n => { const out = []; for (let i = 0; i < n; i++) { const t = r(), a = r() * 6.283, rad = 0.045 * Math.sqrt(r()); out.push([h * (0.5 - 0.12 * t) + Math.cos(a) * rad, -0.04 + 0.2 * t + Math.sin(a) * rad * .8, 0.14 - 0.5 * t]); } return out; };
    const OWN = { hippo: h => tube(h), amyg: h => vol([h * 0.45, -0.06, 0.2], [0.06, 0.05, 0.065]), striatum: h => vol([h * 0.22, 0.24, 0.1], [0.075, 0.13, 0.24]), insula: h => vol([h * 0.62, 0.16, 0.02], [0.035, 0.13, 0.17]), olf: h => vol([h * 0.09, -0.25, 0.9], [0.035, 0.03, 0.13]), vta: h => vol([h * 0.05, -0.13, -0.12], [0.035, 0.03, 0.04]) };
    const sortKey = p => { let x = Math.floor((p[0] + 1) * 300), y = Math.floor((p[1] + 1.4) * 300), z = Math.floor((p[2] + 1.4) * 300); return (x >> 4) * 1e8 + (y >> 4) * 1e4 + (z >> 4) + ((x & 15) + (y & 15) + (z & 15)) / 100; };
    const buckets = {}; for (let g = 0; g < G; g++) (buckets[greg[g] + '|' + ghemi[g]] = buckets[greg[g] + '|' + ghemi[g]] || []).push(g);
    const pos = new Float32Array(NSLOT * 3), sg = new Uint16Array(NSLOT), gStart = new Int32Array(G), sreg = new Uint8Array(NSLOT), slay = new Uint8Array(NSLOT);
    let cur = 0;
    for (const key of Object.keys(buckets).sort()) {
      const [reg, hs] = key.split('|'), h = +hs, gs = buckets[key].sort((a, b) => F.sc[a] - F.sc[b] || (F.cc[a] || '').localeCompare(F.cc[b] || '') || a - b);
      const need = gs.reduce((s, g) => s + k[g], 0);
      let pts = OWN[reg] ? OWN[reg](h || 1)(need) : B.slots(reg, h, need, r);
      if (OWN[reg]) pts.sort((a, b) => sortKey(a) - sortKey(b));
      let j = 0;
      for (const g of gs) { gStart[g] = cur; for (let q = 0; q < k[g]; q++) { const p = pts[j++]; pos.set(p, cur * 3); sg[cur] = g; sreg[cur] = HKEYS.indexOf(reg);
        if (reg.startsWith('ctx')) { const C = B.CER, rho = Math.hypot(p[0] / C.rx, (p[1] - C.cy) / C.ry, p[2] / C.rz); slay[cur] = clamp(1 + Math.floor((1.02 - rho) / 0.2 * 6), 1, 6); }
        cur++; } }
    }
    this.k = k; this.gStart = gStart; this.sg = sg; this.sreg = sreg; this.slay = slay; this.greg = greg; this.pos = pos;
    // ---- 3. links: every fly edge s→t joins each slot of t to one slot of s (hashed), plus a chain inside each patch
    const deg = new Int32Array(NSLOT + 1), es = [];
    for (let t = 0; t < G; t++) for (let e = Fly.inS[t]; e < Fly.inS[t + 1]; e++) { const s = Fly.inSrc[e]; for (let q = 0; q < k[t]; q++) { const a = gStart[t] + q, b = gStart[s] + mix32(a, s) % k[s]; if (a !== b) { deg[a + 1]++; deg[b + 1]++; es.push(a, b); } } }
    for (let g = 0; g < G; g++) for (let q = 1; q < k[g]; q++) { const a = gStart[g] + q - 1, b = a + 1; deg[a + 1]++; deg[b + 1]++; es.push(a, b); }
    for (let i = 0; i < NSLOT; i++) deg[i + 1] += deg[i];
    const adj = new Int32Array(deg[NSLOT]), fill = deg.slice(0, NSLOT); for (let e = 0; e < es.length; e += 2) { adj[fill[es[e]]++] = es[e + 1]; adj[fill[es[e + 1]]++] = es[e]; }
    this.adjS = deg; this.adj = adj; this.nLinks = es.length / 2;
    // region → its slot list (for the steering words)
    this.regSlots = HKEYS.map(() => []); for (let i = 0; i < NSLOT; i++) this.regSlots[sreg[i]].push(i);
    this.regCen = HKEYS.map((key, ri) => { let l = this.regSlots[ri]; if (sided(key)) { const left = l.filter(i => pos[i * 3] < 0); if (left.length) l = left; } const c = [0, 0, 0]; l.forEach(i => { for (let q = 0; q < 3; q++) c[q] += pos[i * 3 + q]; }); return c.map(v => v / Math.max(1, l.length)); });
    // ---- 4. storage
    this.data = new Uint8Array(NSLOT * SLOT); this.own = new Uint16Array(NSLOT); this.alive = new Uint8Array(NSLOT).fill(1); this.mems = []; this.nextId = 1;
    this.act = new Float32Array(NSLOT); this.u = new Float32Array(NSLOT); this.v = new Float32Array(NSLOT); this.waveOn = false; this.heads = []; this.fidH = [];
    // ---- 5. graphics
    const rc0 = HKEYS.map(k => hex(HREG[k].col)); const p = new R.Points(NSLOT); p.pos.set(pos); this.pts = p; p.hot = [1, .95, .8]; p.base = .8; p.upload();
    const web = new R.Lines(30000); for (let n = 0, kept = 0; n < 200000 && kept < 14000; n++) { const a = Math.floor(r() * NSLOT), d = deg[a + 1] - deg[a]; if (!d) continue; const b = adj[deg[a] + Math.floor(r() * d)], dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2]; if (dx * dx + dy * dy + dz * dz > 0.012) continue; kept++; web.seg([pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], rc0[sreg[a]], .14, rc0[sreg[b]], .14); } web.upload();
    this.web = web; this.paths = new R.Lines(NSLOT * 2 * 3 + 64); this.sets = [web, this.paths, p];
    this.load();
    if (!this.mems.length && !store.get(SKEY + '.seeded')) {
      for (const t of ['A Meissner-hatás: a szupravezető kiszorítja magából a mágneses teret, a tér a felülete mentén folyik körbe. (minta)',
        'Egy ferrocella vékony olajrétegében a vasrészecskék az erővonalak mentén rendeződnek, így a mágneses tér láthatóvá válik. (minta)',
        'Yang–Mills-mező: minden rácsélen egy mérték-potenciál él, a térerősség a kis hurkok körüli fázis. Ez a háló a muslica közel 140 ezer neuronjából épült át. (minta)']) this.write(t, 2, true);
      store.set(SKEY + '.seeded', 1); this.save();
    }
    this.recolor(); this.drawPaths();
  },
  // ---------- the walk
  features(text) {
    const words = (text.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}]+/gu) || []), out = [];
    for (const w of words) { const lx = LEX.find(([, st]) => st.some(s => w.startsWith(s))); out.push({ h: hash32(w), reg: lx ? HKEYS.indexOf(lx[0]) : -1, w: lx ? 3 : 1 }); const pad = ' ' + w + ' '; for (let i = 0; i + 3 <= pad.length; i++) out.push({ h: hash32(pad.slice(i, i + 3), 2166136261 ^ 0x5bd1), reg: -1, w: 0.25 }); }
    return { words, out };
  },
  field(text) {   // activation over fly groups: the words land on slots, their groups spread it two hops along the fly edges
    const G = Fly.G, a = new Float32Array(G), { out } = this.features(text);
    for (const f of out) { const s = f.reg >= 0 ? this.regSlots[f.reg][f.h % this.regSlots[f.reg].length] : f.h % NSLOT; a[this.sg[s]] += f.w; }
    let cur = a; for (let hop = 0; hop < 2; hop++) { const nx = new Float32Array(cur); for (let g = 0; g < G; g++) { if (cur[g] < 1e-4) continue; for (let e = Fly.outS[g]; e < Fly.outS[g + 1]; e++) nx[Fly.outDst[e]] += cur[g] * 0.08 * Math.abs(Fly.outQ[e]) / 64; } cur = nx; }
    return cur;
  },
  walk(a, chunks, seed, rank, used) {
    const own = this.own, alive = this.alive, sg = this.sg, adj = this.adj, S = this.adjS, R2 = rng(seed);
    const free = i => !own[i] && alive[i] && !used.has(i);
    const order = [...a.keys()].filter(g => a[g] > 0).sort((x, y) => a[y] - a[x]);
    const startIn = g => { for (let q = 0; q < this.k[g]; q++) { const i = this.gStart[g] + q; if (free(i)) return i; } return -1; };
    let curS = -1; for (let o = rank; o < order.length && curS < 0; o++) curS = startIn(order[o]);
    for (let tries = 0; curS < 0 && tries < 5000; tries++) { const i = Math.floor(R2() * NSLOT); if (free(i)) curS = i; }
    if (curS < 0) return null;
    const path = [curS]; used.add(curS);
    while (path.length < chunks) {
      let best = -1, bs = -1e9;
      for (let e = S[curS]; e < S[curS + 1]; e++) { const n = adj[e]; if (!free(n)) continue; const P = this.pos, dx = P[n * 3] - P[curS * 3], dy = P[n * 3 + 1] - P[curS * 3 + 1], dz = P[n * 3 + 2] - P[curS * 3 + 2], sc = (a[sg[n]] || 0) * 0.6 + R2() * 0.35 - 9 * Math.sqrt(dx * dx + dy * dy + dz * dz); if (sc > bs) { bs = sc; best = n; } }
      if (best < 0) {   // dead end: breadth-first to the nearest free slot, else jump to the best free group
        const seen = new Set([curS]); let q = [curS];
        for (let d = 0; d < 4 && best < 0 && q.length; d++) { const nq = []; for (const x of q) { for (let e = S[x]; e < S[x + 1]; e++) { const n = adj[e]; if (seen.has(n)) continue; seen.add(n); if (free(n)) { best = n; break; } nq.push(n); } if (best >= 0) break; } q = nq.length > 3000 ? nq.slice(0, 3000) : nq; }
        for (let o = 0; best < 0 && o < order.length; o++) best = startIn(order[o]);
        for (let tries = 0; best < 0 && tries < 20000; tries++) { const i = Math.floor(R2() * NSLOT); if (free(i)) best = i; }
        if (best < 0) return null;
      }
      path.push(best); used.add(best); curS = best;
    }
    return path;
  },
  write(text, rep, quiet) {
    const bytes = new TextEncoder().encode(text); if (!bytes.length) return null;
    const chunks = Math.ceil(bytes.length / SLOT), freeN = this.own.reduce((s, v, i) => s + (!v && this.alive[i] ? 1 : 0), 0);
    if (chunks * rep > freeN) { UI.toast(`Nincs elég szabad hely: ${chunks * rep} rés kellene, ${freeN} szabad.`); return null; }
    const a = this.field(text), id = this.nextId++, seed = hash32(text) ^ id, used = new Set(), paths = [];
    for (let k = 0; k < rep; k++) { const p = this.walk(a, chunks, mix32(seed, k), k * 3, used); if (!p) { UI.toast('A háló megtelt.'); return null; } paths.push(p); }
    const ck = [];
    for (let c = 0; c < chunks; c++) { const o = c * SLOT, n = Math.min(SLOT, bytes.length - o); const buf = new Uint8Array(SLOT); buf.set(bytes.subarray(o, o + n)); ck.push(crc8(buf, 0, SLOT)); for (const p of paths) this.data.set(buf, p[c] * SLOT); }
    const m = { id, n: bytes.length, paths, ck, E: 1, t: Date.now(), hue: (mix32(id, seed) % 360) / 360 };
    this.mems.push(m); const mi = this.mems.length; for (const p of paths) for (const s of p) this.own[s] = id;
    if (!quiet) { this.heads.push({ m, k: 0, speed: 26, mode: 'write' }); this.save(); this.recolor(); this.drawPaths(); this.list(); }
    return m;
  },
  read(m) {
    const chunks = m.ck.length, out = new Uint8Array(chunks * SLOT), ok = new Uint8Array(chunks);
    for (let c = 0; c < chunks; c++) {
      let got = -1; for (const p of m.paths) { const s = p[c]; if (this.alive[s] && crc8(this.data, s * SLOT, SLOT) === m.ck[c]) { got = s; break; } }
      if (got >= 0) { out.set(this.data.subarray(got * SLOT, got * SLOT + SLOT), c * SLOT); ok[c] = 1; }
      else { const s = m.paths[0][c]; if (this.alive[s]) out.set(this.data.subarray(s * SLOT, s * SLOT + SLOT), c * SLOT); }
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(out.subarray(0, m.n)).replace(/\u0000/g, '░');
    return { text, ok, fid: ok.reduce((s, v) => s + v, 0) / chunks };
  },
  forget(m) { for (const p of m.paths) for (const s of p) { if (this.own[s] === m.id) { this.own[s] = 0; this.data.fill(0, s * SLOT, s * SLOT + SLOT); } } this.mems = this.mems.filter(x => x !== m); },
  consolidate(m) {   // sleep: read with the checksums, write again on a fresh walk, stronger
    const r = this.read(m), rep = m.paths.length; if (r.fid === 0) return false;
    const E = m.E, t = m.t, hue = m.hue; this.forget(m);
    const bytes = new TextEncoder().encode(r.text); const nm = this.write(r.text, rep, true); if (!nm) return false;
    nm.E = Math.min(6, E + 0.8); nm.t = t; nm.hue = hue;
    if (r.fid < 1) { /* keep the damage visible: the bad chunks were rewritten as they were read */ }
    this.heads.push({ m: nm, k: 0, speed: 40, mode: 'sleep' }); return true;
  },
  // ---------- persistence and the time capsule
  snapshot() { return { t: 'idokapszula', v: 1, kind: 'konnektom-memoria', title: 'Üres háló: emlékek', created: new Date().toISOString().slice(0, 10), readme: 'A Konnektóm-labor Üres hálójának tartalma. Kibontás: base64url -> zlib inflate -> JSON; a labor Időkapszula mezőjébe illesztve visszatölthető. A szöveg csak a résekben van, a mems mező az utakat és az ellenőrzőösszegeket tartja.', S: NSLOT, slot: SLOT, data: b64of(this.data), own: b64of(new Uint8Array(this.own.buffer)), alive: b64of(this.alive), mems: this.mems, nextId: this.nextId }; },
  restore(o) {
    if (!o || o.kind !== 'konnektom-memoria' || o.S !== NSLOT) throw new Error('Ez nem ennek a hálónak az időkapszulája.');
    this.data.set(u8of(o.data)); this.own.set(new Uint16Array(u8of(o.own).buffer)); this.alive.set(u8of(o.alive)); this.mems = o.mems || []; this.nextId = o.nextId || this.mems.reduce((m, x) => Math.max(m, x.id + 1), 1);
  },
  save() { clearTimeout(this._sv); this._sv = setTimeout(() => { if (!store.set(SKEY, this.snapshot())) UI.toast('A böngésző nem engedi a mentést (localStorage).'); }, 600); },
  load() { const o = store.get(SKEY); if (o) try { this.restore(o); } catch (e) { /* stale or foreign data: start empty */ } },
  // ---------- graphics
  recolor() {
    const p = this.pts, m = this.st.col, own = this.own, byId = new Map(this.mems.map(x => [x.id, x])), rc = HKEYS.map(k => hex(HREG[k].col)), lc = ['#3d5a80', '#5b8fe0', '#93d3e6', '#8bcca1', '#e3be7b', '#e8a873', '#e4877d'].map(hex), sc = SC_COL.map(hex);
    const fillR = new Float32Array(HKEYS.length), cntR = new Float32Array(HKEYS.length); for (let i = 0; i < NSLOT; i++) { cntR[this.sreg[i]]++; if (own[i]) fillR[this.sreg[i]]++; }
    for (let i = 0; i < NSLOT; i++) {
      let c, s = 1.1, dim = 1;
      if (!this.alive[i]) { c = [.35, .05, .05]; s = 0.9; }
      else if (m === 'mem') { if (own[i]) { const mm = byId.get(own[i]); c = hsl(mm ? mm.hue : 0, .8, .62); s = 2.1; } else { c = rc[this.sreg[i]].map(v => v * .5); s = 1.5; } }
      else if (m === 'reg') { c = rc[this.sreg[i]].map(v => v * (own[i] ? 1 : .55)); s = own[i] ? 2 : 1.2; }
      else if (m === 'layer') { c = this.slay[i] ? lc[this.slay[i]] : [.25, .3, .35]; s = this.slay[i] ? 1.3 : 0.9; }
      else if (m === 'fly') { c = sc[FLYD.sc[this.sg[i]]].map(v => v * .8); }
      else { const f = fillR[this.sreg[i]] / Math.max(1, cntR[this.sreg[i]]); c = hsl(0.62 - 0.62 * Math.min(1, f * 6), .8, .3 + .4 * Math.min(1, f * 6)); }
      p.col.set(c.map(v => v * dim), i * 3); p.size[i] = s;
    }
    p.upload('cs');
  },
  drawPaths() {
    const L = this.paths, P = this.pos, at = i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; L.clear();
    for (const m of this.mems) { const c = hsl(m.hue, .8, .6), sel = this.st.sel === m.id, al = sel ? .9 : this.st.sel > 0 ? .08 : .32; for (const p of m.paths) for (let k = 1; k < p.length; k++) L.seg(at(p[k - 1]), at(p[k]), c, al); }
    L.upload();
  },
  enter() {
    Object.assign(R.cam, { yaw: 0.75, pitch: 0.18, dist: 3.4, tgt: [0, -0.05, 0], auto: 0.05 });
    const st = this.st;
    UI.set(`
      <h2>Üres háló <small>emberi agy alakú, a muslicából</small></h2>
      <p class="lead">${fmt(NSLOT)} üres rés, egyenként ${SLOT} bájt (${fmt(NSLOT * SLOT / 1024)} KB), ${fmt(this.nLinks)} kapcsolat. A muslica ${fmt(Fly.G)} sejttípusa emberi agyrészekbe rendezve, a kapcsolataik megtartva; a kéregben hat réteg. Amit betáplálsz, a szavai szerint kanyargó úton tárolódik, saját 3D mintát rajzolva.</p>
      <div class="grp"><h3>Betáplálás</h3><textarea id="em-in" rows="4" placeholder="Írj ide bármit: egy mondatot, egy emléket, egy képletet…"></textarea>
      <div class="row">${UI.chips('em-rep', [['1', '1×'], ['2', '2×'], ['3', '3×']], String(st.rep))}<button type="button" class="pri" id="em-go">Betáplálás</button></div>
      <p class="hint" id="em-cap"></p></div>
      <div class="grp"><h3>Emlékek</h3><ul class="mems" id="em-list"></ul></div>
      <div class="grp"><h3>Asszociáció</h3><input type="search" id="em-q" placeholder="Mire emlékszik a háló? Pl. mágneses tér" aria-label="Asszociatív keresés"><ul class="mini" id="em-qr"></ul></div>
      <div class="grp"><h3>Eszköz a hálón</h3>${UI.chips('em-tool', [['probe', 'Szonda'], ['lesion', 'Lézió'], ['wave', 'Hullám'], ['stim', 'Inger']], st.tool)}
      ${UI.slider('em-rad', 'Sugár', 0.02, 0.3, 0.005, st.rad)}<div class="loupe" id="em-lp"><span class="hint">Szonda: vidd az egeret egy résre, és megmutatja a 16 bájtját.</span></div></div>
      <div class="grp"><h3>Fizika</h3>${UI.slider('em-T', 'Hőmérséklet (bitzaj)', 0, 1, 0.01, st.T)}${UI.slider('em-d', 'Hullám csillapítása', 0.05, 3, 0.05, st.damp)}
      <div class="row"><button type="button" id="em-sleep">Alvás: konszolidáció</button><button type="button" id="em-heal">Szövet visszanövesztése</button></div>
      <canvas class="spark" id="em-sp"></canvas><p class="hint"><span class="k1">━</span> átlagos hűség &nbsp;<span class="k3">┅</span> megfigyelő előrejelzése (60 mp)</p></div>
      <div class="grp"><h3>Szín</h3>${UI.chips('em-col', [['mem', 'Emlék'], ['reg', 'Agyrész'], ['layer', 'Kéregréteg'], ['fly', 'Muslica-eredet'], ['fill', 'Telítettség']], st.col)}<div id="em-lg"></div>
      <div class="tgs">${UI.toggle('em-web', 'Háló', st.web)}</div></div>
      <div class="grp"><h3>Időkapszula</h3><textarea id="em-cap-t" rows="3" class="mono" placeholder="Ide kerül a háló tartalma tömörítve, vagy ide illeszd a visszatöltéshez." aria-label="Időkapszula"></textarea>
      <div class="row"><button type="button" id="em-exp">Kapszula készítése</button><button type="button" id="em-imp">Visszatöltés</button><button type="button" id="em-copy">Másolás</button></div>
      <div class="row"><button type="button" class="warn" id="em-wipe">Minden emlék törlése</button></div></div>
      <p class="src">Tárolás: a böngésző localStorage-ában (csak ezen a gépen). A szöveg nincs külön elmentve: amit látsz, az a résekből olvasott bájt, rés-szintű CRC-8 ellenőrzéssel és a választott számú másolattal.</p>`);
    UI.bindChips('em-rep', k => st.rep = +k);
    $('em-go').onclick = () => { const t = $('em-in').value.trim(); if (!t) return UI.toast('Előbb írj valamit a mezőbe.'); const m = this.write(t, st.rep); if (m) { $('em-in').value = ''; st.sel = m.id; this.drawPaths(); this.list(); UI.toast(`Tárolva: ${m.ck.length} rés × ${m.paths.length} másolat.`); } };
    $('em-q').addEventListener('input', e => this.assoc(e.target.value));
    UI.bindChips('em-tool', k => { st.tool = k; $('em-lp').innerHTML = { probe: '<span class="hint">Szonda: vidd az egeret egy résre, és megmutatja a 16 bájtját.</span>', lesion: '<span class="hint">Lézió: koppints a hálóra, a sugáron belüli rések elhalnak. A sérült emlékek a másolataikból még olvashatók.</span>', wave: '<span class="hint">Hullám: koppints, és a hálózat gráf-Laplace-operátora szerint terjedő hullám indul. Holt szövet elnyeli.</span>', stim: '<span class="hint">Inger: koppints, az aktivitás a kapcsolatokon szétfut, és felvillantja az érintett emlékeket.</span>' }[k]; });
    UI.bind('em-rad', v => st.rad = v); UI.bind('em-T', v => st.T = v); UI.bind('em-d', v => st.damp = v);
    $('em-sleep').onclick = () => { const n = this.mems.length; let ok = 0; for (const m of [...this.mems]) if (this.consolidate(m)) ok++; this.save(); this.recolor(); this.drawPaths(); this.list(); UI.toast(`Alvás: ${ok} / ${n} emlék újraírva, erősebben.`); };
    $('em-heal').onclick = () => { let n = 0; for (let i = 0; i < NSLOT; i++) if (!this.alive[i]) { this.alive[i] = 1; this.data.fill(0, i * SLOT, i * SLOT + SLOT); n++; } this.save(); this.recolor(); this.list(); UI.toast(n ? `${n} rés visszanőtt, üresen: ami rajtuk volt, elveszett.` : 'Nincs holt szövet.'); };
    UI.bindChips('em-col', k => { st.col = k; this.recolor(); this.legend(); }); UI.bindToggle('em-web', v => st.web = v);
    $('em-exp').onclick = async () => { $('em-cap-t').value = await zipStr(JSON.stringify(this.snapshot())); UI.toast(`Kapszula kész: ${fmt($('em-cap-t').value.length)} karakter.`); };
    $('em-imp').onclick = async () => { try { const o = JSON.parse(await unzipStr($('em-cap-t').value)); this.restore(o); this.save(); this.recolor(); this.drawPaths(); this.list(); UI.toast(`Visszatöltve: ${this.mems.length} emlék.`); } catch (e) { UI.toast('Nem sikerült: ' + (e.message || 'hibás kapszula')); } };
    $('em-copy').onclick = () => { const t = $('em-cap-t'); if (!t.value) return UI.toast('Előbb készíts kapszulát.'); navigator.clipboard.writeText(t.value).then(() => UI.toast('Vágólapra másolva.'), () => { t.select(); UI.toast('Kijelölve: másold a Ctrl+C-vel.'); }); };
    $('em-wipe').onclick = () => { const b = $('em-wipe'); if (Date.now() - st.confirm > 3000) { st.confirm = Date.now(); b.textContent = 'Biztos? Koppints még egyszer'; setTimeout(() => b.textContent = 'Minden emlék törlése', 3000); return; } for (const m of [...this.mems]) this.forget(m); this.save(); this.recolor(); this.drawPaths(); this.list(); b.textContent = 'Minden emlék törlése'; UI.toast('A háló újra üres.'); };
    this.legend(); this.list();
  },
  peek() {
    const used = this.own.reduce((s, v) => s + (v ? 1 : 0), 0);
    return { text: `<b>${this.mems.length} emlék</b> · ${fmt(used)} / ${fmt(NSLOT)} rés foglalt`, acts: [['Új emlék', () => { Sheet.snap('half'); setTimeout(() => { const t = $('em-in'); if (t) t.focus(); }, 260); }, true]] };
  },
  legend() {
    const m = this.st.col, el = $('em-lg'); if (!el) return;
    if (m === 'reg' || m === 'mem') { const cnt = HKEYS.map(() => [0, 0]); for (let i = 0; i < NSLOT; i++) { cnt[this.sreg[i]][0]++; if (this.own[i]) cnt[this.sreg[i]][1]++; } el.innerHTML = `<ul class="regs">${HKEYS.map((k, i) => `<li title="${esc(HREG[k].fly)}"><i style="background:${HREG[k].col}"></i><b>${esc(HREG[k].hu)}</b><em>${cnt[i][1]} / ${fmt(cnt[i][0])}</em><small>← ${esc(HREG[k].fly)}</small></li>`).join('')}</ul>`; }
    else if (m === 'layer') el.innerHTML = legend([1, 2, 3, 4, 5, 6].map(l => [['#3d5a80', '#5b8fe0', '#93d3e6', '#8bcca1', '#e3be7b', '#e8a873', '#e4877d'][l], `${['I', 'II', 'III', 'IV', 'V', 'VI'][l - 1]}. réteg`]));
    else if (m === 'fly') el.innerHTML = legend(FLYD.SC.map((s, i) => [SC_COL[i], SC_HU[s] || s]));
    else el.innerHTML = '<p class="hint">Agyrészenként: kék = üres, sárga–fehér = sűrűn teleírt.</p>';
  },
  list() {
    const el = $('em-list'); if (!el) return; const used = this.own.reduce((s, v) => s + (v ? 1 : 0), 0), dead = NSLOT - this.alive.reduce((s, v) => s + v, 0);
    $('em-cap').textContent = `Foglalt: ${fmt(used)} rés (${(used / NSLOT * 100).toFixed(1)} %) · holt: ${fmt(dead)} · szabad: ${fmt(NSLOT - used - dead)}`;
    el.innerHTML = this.mems.length ? this.mems.slice().reverse().map(m => { const r = this.read(m), c = hsl(m.hue, .8, .6).map(v => Math.round(v * 255)).join(',');
      return `<li data-id="${m.id}" class="${this.st.sel === m.id ? 'on' : ''}"><div class="mh"><i style="background:rgb(${c})"></i><span class="mt">${esc(r.text.slice(0, 120))}${r.text.length > 120 ? '…' : ''}</span></div>
        <div class="strip" aria-label="Rések állapota">${[...r.ok].map(v => `<b class="${v ? '' : 'bad'}"></b>`).join('')}</div>
        <div class="mf"><span class="mono">${m.ck.length} rés × ${m.paths.length} · hűség ${(r.fid * 100).toFixed(0)} % · E ${m.E.toFixed(1)}</span>
        <span class="acts"><button type="button" data-a="recall">Felidéz</button><button type="button" data-a="hear">Hallgat</button><button type="button" data-a="del" aria-label="Törlés">×</button></span></div></li>`; }).join('') : '<li class="hint">Még üres. Írj valamit fent, és nézd, merre nő.</li>';
    el.onclick = e => { const li = e.target.closest('li[data-id]'); if (!li) return; const m = this.mems.find(x => x.id === +li.dataset.id); if (!m) return; const a = e.target.dataset.a;
      if (a === 'del') { this.forget(m); this.save(); this.recolor(); this.drawPaths(); this.list(); return; }
      if (a === 'recall') { m.E = Math.min(6, m.E + 0.3); this.heads.push({ m, k: 0, speed: 30, mode: 'read' }); const r = this.read(m); UI.info.hidden = false; UI.info.innerHTML = `<button type="button" class="x" aria-label="Bezárás" id="em-x">×</button><h3>Felidézve · ${(r.fid * 100).toFixed(0)} %</h3><p class="recall">${esc(r.text)}</p><p class="hint">${r.fid < 1 ? 'A sérült rések bájtjai úgy jelennek meg, ahogy a résben állnak.' : 'Minden rés ellenőrzőösszege stimmel.'}</p>`; $('em-x').onclick = () => UI.info.hidden = true; this.save(); }
      if (a === 'hear') this.hear(m);
      this.st.sel = this.st.sel === m.id && !a ? -1 : m.id; this.drawPaths(); el.querySelectorAll('li').forEach(x => x.classList.toggle('on', +x.dataset.id === this.st.sel));
      if (this.st.sel > 0) { const c = [0, 0, 0], p = m.paths[0]; p.forEach(s => { for (let q = 0; q < 3; q++) c[q] += this.pos[s * 3 + q]; }); R.cam.tgt = c.map(v => v / p.length); }
    };
  },
  assoc(q) {
    const el = $('em-qr'); if (!el) return; q = q.trim(); if (q.length < 2) { el.innerHTML = ''; return; }
    const a = this.field(q); let mx = 0; for (let g = 0; g < a.length; g++) mx = Math.max(mx, a[g]);
    for (let i = 0; i < NSLOT; i++) this.act[i] = Math.max(this.act[i], Math.min(1, a[this.sg[i]] / (mx || 1)) * 0.9);
    const qa = this.features(q).out.map(f => f.h), qs = new Set(qa);
    const sc = this.mems.map(m => { let s = 0; for (const p of m.paths) for (const sl of p) s += a[this.sg[sl]]; const r = this.read(m), ov = this.features(r.text).out.filter(f => qs.has(f.h)).length; return { m, s: s / m.paths.length / m.ck.length / (mx || 1) + ov / Math.max(4, qa.length), t: r.text }; }).sort((x, y) => y.s - x.s).slice(0, 4);
    el.innerHTML = sc.filter(x => x.s > 0.02).map(x => `<li><b>${Math.min(100, x.s * 100).toFixed(0)}</b> ${esc(x.t.slice(0, 80))}</li>`).join('') || '<li class="hint">Semmi nem rezonál erre.</li>';
  },
  hear(m) {
    try {
      const A = this.audio || (this.audio = new (window.AudioContext || window.webkitAudioContext)()), t0 = A.currentTime + 0.05, p = m.paths[0];
      p.slice(0, 96).forEach((s, k) => { const o = A.createOscillator(), g = A.createGain(), pan = A.createStereoPanner ? A.createStereoPanner() : null, b = this.data[s * SLOT], f = 110 * Math.pow(2, (this.sreg[s] * 2 + (b % 12)) / 12);
        o.type = this.alive[s] ? 'triangle' : 'sawtooth'; o.frequency.value = f; const t = t0 + k * 0.075; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        if (pan) { pan.pan.value = clamp(this.pos[s * 3] * 1.2, -1, 1); o.connect(g).connect(pan).connect(A.destination); } else o.connect(g).connect(A.destination); o.start(t); o.stop(t + 0.16); });
      this.heads.push({ m, k: 0, speed: 1 / 0.075, mode: 'read' });
    } catch (e) { UI.toast('A hang itt nem érhető el.'); }
  },
  near(x, y) { return R.pickPoints(this.pts, x, y, 12); },
  tap(x, y) {
    const i = this.near(x, y); if (i < 0) return; const st = this.st, P = this.pos;
    if (st.tool === 'lesion') { let n = 0, hit = new Set(); const r2 = st.rad * st.rad; for (let j = 0; j < NSLOT; j++) { const dx = P[j * 3] - P[i * 3], dy = P[j * 3 + 1] - P[i * 3 + 1], dz = P[j * 3 + 2] - P[i * 3 + 2]; if (dx * dx + dy * dy + dz * dz < r2 && this.alive[j]) { this.alive[j] = 0; this.u[j] = this.v[j] = 0; n++; if (this.own[j]) hit.add(this.own[j]); } } this.save(); this.recolor(); this.list(); UI.toast(`${n} rés elhalt, ${hit.size} emlék érintett.`); }
    else if (st.tool === 'wave') { this.u[i] = 6; for (let e = this.adjS[i]; e < this.adjS[i + 1]; e++) this.u[this.adj[e]] = 3; this.waveOn = true; }
    else if (st.tool === 'stim') { const seen = new Set([i]); let q = [i]; for (let d = 0; d < 5; d++) { const nq = []; for (const x of q) { this.act[x] = Math.max(this.act[x], 1.2 - d * 0.2); for (let e = this.adjS[x]; e < this.adjS[x + 1]; e++) { const n = this.adj[e]; if (!seen.has(n) && this.alive[n]) { seen.add(n); nq.push(n); } } } q = nq.length > 4000 ? nq.slice(0, 4000) : nq; } const ids = new Set(); seen.forEach(s => { if (this.own[s]) ids.add(this.own[s]); }); UI.toast(`${fmt(seen.size)} rés kapott jelet${ids.size ? ', ' + ids.size + ' emlék villant fel' : ''}.`); ids.forEach(id => { const m = this.mems.find(x => x.id === id); if (m) this.heads.push({ m, k: 0, speed: 40, mode: 'read' }); }); }
    else this.probe(i);
  },
  probe(i) {
    const el = $('em-lp'); if (!el) return; const b = this.data.subarray(i * SLOT, i * SLOT + SLOT), g = this.sg[i], m = this.own[i] && this.mems.find(x => x.id === this.own[i]);
    const hexs = [...b].map(v => v.toString(16).padStart(2, '0')).join(' '), asc = [...b].map(v => v >= 32 && v < 127 ? String.fromCharCode(v) : '·').join('');
    el.innerHTML = `<div class="mono"><b>#${i}</b> · ${esc(HREG[HKEYS[this.sreg[i]]].hu)}${this.slay[i] ? ', ' + ['I', 'II', 'III', 'IV', 'V', 'VI'][this.slay[i] - 1] + '. réteg' : ''}${this.alive[i] ? '' : ' · <span class="bad">holt</span>'}</div>
      <div class="mono hx">${hexs}</div><div class="mono hx">${esc(asc)}</div>
      <div class="hint">Muslica-eredet: <b>${esc(FLYD.types[g])}</b> (${esc(SC_HU[FLYD.SC[FLYD.sc[g]]] || '')}) · ${this.adjS[i + 1] - this.adjS[i]} kapcsolat${m ? ` · emlék #${m.id}, ${m.paths.findIndex(p => p.includes(i)) + 1}. másolat` : ' · üres'}</div>`;
  },
  hover(x, y) { const i = this.near(x, y); if (i < 0) return UI.showTip(0, 0, ''); if (this.st.tool === 'probe') this.probe(i); UI.showTip(x, y, `<b>${esc(HREG[HKEYS[this.sreg[i]]].hu)}</b><br>rés #${i} · ${this.own[i] ? 'emlék #' + this.own[i] : 'üres'}${this.alive[i] ? '' : ' · holt'}`); },
  frame(dt, t) {
    const st = this.st, p = this.pts, act = this.act; this.web.on = st.web;
    const d = Math.exp(-dt * 1.2); for (let i = 0; i < NSLOT; i++) act[i] *= d;
    // read / write heads walk the paths
    this.heads = this.heads.filter(h => { h.k += dt * h.speed; const n = h.m.paths[0].length; for (const path of h.m.paths) { const k = Math.min(n - 1, Math.floor(h.k)); for (let j = Math.max(0, k - 2); j <= k; j++) act[path[j]] = Math.max(act[path[j]], h.mode === 'write' ? 1.5 : 1.2); } return h.k < n + 2 && this.mems.includes(h.m); });
    // thermal noise: bit flips, rarer in strongly encoded memories
    if (st.T > 0) for (const m of this.mems) { const lam = st.T * st.T * 0.004 * m.n * m.paths.length * Math.exp(-m.E); if (Math.random() < lam * dt) { const path = m.paths[Math.floor(Math.random() * m.paths.length)], s = path[Math.floor(Math.random() * path.length)]; if (this.alive[s]) { this.data[s * SLOT + Math.floor(Math.random() * SLOT)] ^= 1 << Math.floor(Math.random() * 8); act[s] = 1.5; this._dirty = true; } } }
    // the wave: u'' = c²·(mean of neighbours − u) − damping·u'
    if (this.waveOn) {
      const u = this.u, v = this.v, S = this.adjS, adj = this.adj, al = this.alive; let en = 0;
      for (let sub = 0; sub < 2; sub++) { const h = 0.5; for (let i = 0; i < NSLOT; i++) { if (!al[i]) { v[i] = 0; continue; } const a0 = S[i], a1 = S[i + 1]; if (a1 === a0) continue; let s = 0; for (let e = a0; e < a1; e++) s += u[adj[e]]; v[i] += h * (s / (a1 - a0) - u[i]) - h * st.damp * 0.2 * v[i]; } for (let i = 0; i < NSLOT; i++) { u[i] += h * v[i]; en += u[i] * u[i]; } }
      for (let i = 0; i < NSLOT; i++) { const a = Math.abs(this.u[i]) * 2; if (a > act[i]) act[i] = Math.min(1.4, a); }
      if (en < 1e-3) { this.waveOn = false; u.fill(0); v.fill(0); }
    }
    p.act.set(act); p.upAct();
    if ((this._ui = (this._ui || 0) + dt) > 1) {
      this._ui = 0; const f = this.mems.length ? this.mems.reduce((s, m) => s + this.read(m).fid, 0) / this.mems.length : 1; this.fidH.push(f); if (this.fidH.length > 120) this.fidH.shift();
      const sp = $('em-sp'); if (sp) { const h = this.fidH, n = Math.min(30, h.length), xs = h.slice(-n), lg = xs.map(v => Math.log(Math.max(1e-3, v)));
        let sx = 0, sy = 0, sxx = 0, sxy = 0; lg.forEach((v, i) => { sx += i; sy += v; sxx += i * i; sxy += i * v; }); const b = n > 2 ? (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx) : 0, a0 = n ? (sy - b * sx) / n : 0;
        const fc = []; for (let k = 0; k < 60; k++) fc.push(Math.exp(a0 + b * (n - 1 + k)));
        const css = getComputedStyle(document.documentElement); spark(sp, [{ data: h.concat(new Array(60).fill(NaN)).slice(0, h.length), col: css.getPropertyValue('--ok'), fill: 1 }, { data: new Array(Math.max(0, h.length - 1)).fill(NaN).concat(fc), col: css.getPropertyValue('--acc'), dash: [3, 3] }], { n: h.length + 59, max: 1 }); }
      if (this._dirty) { this._dirty = false; this.save(); this.list(); }
    }
  },
  overlay(c) { HKEYS.forEach((k, i) => { if (this.regSlots[i].length) label(c, HREG[k].hu, this.regCen[i], HREG[k].col); }); },
};
