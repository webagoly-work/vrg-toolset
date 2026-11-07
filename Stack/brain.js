/* VRG Stack: brain anatomy shared by connectome.html and orb.html (BR-Q1).
   Brain coordinates: x = left (-) / right (+), y = up, z = front (+) / back (-). The cerebrum is an
   ellipsoid (rx 1.0, ry 0.8, rz 1.22) centred at y 0.32; the brainstem hangs below it, tilted back.
   lib/connectome.js gives every node a region (and a hemisphere for the cortex); this file only places them.
   Plain script (no modules), so it loads from file:// too. Own geometry, no anatomy atlas copied. */
(function () {
  'use strict';
  const CER = { rx: 1.0, ry: 0.80, rz: 1.22, cy: 0.32 };
  const REG = {
    'ctx-front': { part: 'cerebrum', hu: 'Homloklebeny', en: 'Frontal lobe', what: 'tervek, ötletek, pillérek, briefek', whatEn: 'plans, ideas, pillars, briefs' },
    'ctx-par': { part: 'cerebrum', hu: 'Fali lebeny + mozgatókéreg', en: 'Parietal lobe + motor strip', what: 'kód: amit csinálunk', whatEn: 'code: what gets done' },
    'ctx-temp': { part: 'cerebrum', hu: 'Halántéklebeny (felsőbb hallásközpont)', en: 'Temporal lobe (higher auditory centre)', what: 'memória, dokumentumok', whatEn: 'memory, documents' },
    'ctx-occ': { part: 'cerebrum', hu: 'Nyakszirtlebeny (felsőbb látóközpont)', en: 'Occipital lobe (higher visual centre)', what: 'appok, funkciók, kirakat', whatEn: 'apps, features, showcase' },
    thal: { part: 'dien', hu: 'Talamusz', en: 'Thalamus', what: 'DevLog vonalak: minden munka itt kapcsol át', whatEn: 'DevLog lines: every line of work relays here' },
    hypo: { part: 'dien', hu: 'Hipotalamusz', en: 'Hypothalamus', what: 'döntések, házirend, ütemezés', whatEn: 'decisions, house rules, schedules' },
    sc: { part: 'mes', hu: 'Felső ikertestek (alsóbb látóközpont)', en: 'Superior colliculi (lower visual centre)', what: 'jelek, napok: ami szemet szúr', whatEn: 'signals, days: what catches the eye' },
    ic: { part: 'mes', hu: 'Alsó ikertestek (alsóbb hallásközpont)', en: 'Inferior colliculi (lower auditory centre)', what: 'sessionök: a beszélgetések', whatEn: 'sessions: the conversations' },
    cereb: { part: 'cereb', hu: 'Kisagy', en: 'Cerebellum', what: 'ügynökök, eszközök, generátorok: begyakorolt rutinok', whatEn: 'agents, tools, generators: learned routines' },
    pons: { part: 'stem', hu: 'Híd', en: 'Pons', what: 'futások, a legújabb felül', whatEn: 'runs, newest on top' },
    medulla: { part: 'stem', hu: 'Nyúltvelő', en: 'Medulla', what: 'commitok, mergek: a kimenő jel', whatEn: 'commits, merges: the outgoing signal' },
  };
  const PARTS = [
    { key: 'cerebrum', hu: 'Nagyagy: kéreg, két félteke', en: 'Cerebrum: cortex, two hemispheres', regs: ['ctx-front', 'ctx-par', 'ctx-temp', 'ctx-occ'] },
    { key: 'dien', hu: 'Köztiagy', en: 'Diencephalon', regs: ['thal', 'hypo'] },
    { key: 'mes', hu: 'Középagy', en: 'Mesencephalon', regs: ['sc', 'ic'] },
    { key: 'cereb', hu: 'Kisagy', en: 'Cerebellum', regs: ['cereb'] },
    { key: 'stem', hu: 'Agytörzs', en: 'Brainstem', regs: ['pons', 'medulla'] },
  ];

  /* ---------- cerebrum: lobes on the ellipsoid surface */
  function lobeOf(d) {
    const [x, y, z] = d;
    if (z > 0.28) return 'ctx-front';
    if (z < -0.6) return 'ctx-occ';
    if (y < 0.05 && Math.abs(x) > 0.42) return 'ctx-temp';
    return 'ctx-par';
  }
  // gyri: shallow grooves where the fold field crosses zero
  function fold(d) {
    const [x, y, z] = d, g = Math.sin(9 * x + 3 * Math.sin(5 * z)) * Math.sin(8 * z + 3 * Math.sin(6 * y + x));
    return Math.pow(1 - Math.abs(g), 6);
  }
  function cortexPos(d, depth) {
    const [x, y, z] = d;
    let k = depth * (1 - 0.05 * fold(d));
    let px = x * CER.rx * k, py = y * CER.ry * k, pz = z * CER.rz * k;
    if (Math.abs(x) < 0.07) { px += Math.sign(x || 1) * 0.05; py -= 0.05 * (1 - Math.abs(x) / 0.07); }   // the fissure between the hemispheres
    if (py < -0.30) py = -0.30 + (py + 0.30) * 0.45;                                                      // flat underside
    if (y < 0.05 && Math.abs(x) > 0.42 && z > -0.6 && z < 0.28) py -= 0.06 * Math.min(1, (0.05 - y) * 6); // the temporal lobe hangs a little lower
    return [px, py + CER.cy, pz];
  }
  function hilbert(n, x, y) { let d = 0; for (let s = n >> 1; s > 0; s >>= 1) { const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0; d += s * s * ((3 * rx) ^ ry); if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const t = x; x = y; y = t; } } return d; }
  function morton3(x, y, z) { const sp = v => { v &= 1023; v = (v | v << 16) & 0x30000ff; v = (v | v << 8) & 0x300f00f; v = (v | v << 4) & 0x30c30c3; v = (v | v << 2) & 0x9249249; return v; }; return sp(x) | sp(y) << 1 | sp(z) << 2; }
  const fib = (i, N) => { const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), ph = i * Math.PI * (3 - Math.sqrt(5)); return [r * Math.cos(ph), y, r * Math.sin(ph)]; };
  const inCtx = (d, reg, hemi) => lobeOf(d) === reg && (hemi === 0 || Math.sign(d[0] || 1) === hemi);
  const frac = {};
  function areaOf(reg, hemi) {
    const k = reg + hemi; if (frac[k] != null) return frac[k];
    let c = 0; const N = 20000; for (let i = 0; i < N; i++) if (inCtx(fib(i, N), reg, hemi)) c++;
    return (frac[k] = Math.max(1e-3, c / N));
  }
  // need slots on one lobe (one hemisphere, or both with hemi 0), in a space-filling order so neighbours stay neighbours.
  // Heavy lobes get a thicker grey matter instead of a denser surface.
  function cortexSlots(reg, hemi, need, R) {
    if (need <= 0) return [];
    const a = areaOf(reg, hemi), dens = need / (a * 9000), thick = 0.05 + 0.2 * Math.min(1, dens);   // nodes go under the surface too
    const N = Math.ceil(Math.min(need, a * 9000 * 1.6) / a * 1.04) + 16;
    const keep = [];
    for (let i = 0; i < N; i++) { const d = fib(i, N); if (!inCtx(d, reg, hemi)) continue; const lon = (Math.atan2(d[2], d[0]) + Math.PI) / (2 * Math.PI), lat = (d[1] + 1) / 2; keep.push({ d, k: hilbert(1024, Math.min(1023, lon * 1024 | 0), Math.min(1023, lat * 1024 | 0)) }); }
    keep.sort((p, q) => p.k - q.k);
    const out = [];
    for (let i = 0; i < need; i++) { const s = keep[Math.min(keep.length - 1, Math.floor(i * keep.length / need))]; out.push(cortexPos(s.d, 1 - thick * Math.pow(R(), 1.6))); }
    return out;
  }

  /* ---------- deep parts: volumes */
  const ball = R => { let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1); return [x, y, z]; };
  const ell = (c, r) => R => { const b = ball(R); return [c[0] + b[0] * r[0], c[1] + b[1] * r[1], c[2] + b[2] * r[2]]; };
  const VOL = {
    thal: hemi => ell([0.12 * (hemi || 1), 0.10, -0.02], [0.10, 0.085, 0.17]),
    hypo: () => ell([0, -0.08, 0.17], [0.085, 0.065, 0.10]),
    sc: hemi => ell([0.07 * (hemi || 1), -0.03, -0.25], [0.055, 0.045, 0.05]),
    ic: hemi => ell([0.07 * (hemi || 1), -0.13, -0.29], [0.05, 0.042, 0.048]),
    pons: () => ell([0, -0.42, -0.28], [0.30, 0.22, 0.25]),
  };
  // cerebellum: two lobes and a narrow vermis, leaf stripes (folia) in the side view
  function cerebPt(R) {
    for (;;) {
      const b = ball(R), p = [b[0] * 0.62, -0.30 + b[1] * 0.26, -0.86 + b[2] * 0.36];
      if (Math.abs(b[0]) < 0.12 && b[1] > 0.35) continue;                       // the notch above the vermis
      const ang = Math.atan2(p[1] + 0.30, p[2] + 0.86), rr = Math.hypot(b[1], b[2]);
      if (rr > 0.45 && (Math.sin(ang * 9) + 1) / 2 < 0.38) continue;            // folia: leaves, with gaps between them
      return p;
    }
  }
  const medulla = R => { const s = R(), a = R() * Math.PI * 2, r = Math.sqrt(R()) * (0.12 - 0.05 * s); return [Math.cos(a) * r, -0.56 - 0.72 * s, -0.36 - 0.18 * s + Math.sin(a) * r * 0.85]; };
  const mortonKey = (lo, hi) => p => morton3(...p.map((v, j) => Math.max(0, Math.min(1023, ((v - lo[j]) / (hi[j] - lo[j]) * 1023) | 0))));
  // need slots in a deep part; pons and medulla run top (first) to bottom (last), the rest are in a space-filling order
  function volumeSlots(reg, hemi, need, R) {
    if (need <= 0) return [];
    const sample = reg === 'cereb' ? cerebPt : reg === 'medulla' ? medulla : VOL[reg](hemi);
    const pts = []; for (let i = 0; i < need; i++) pts.push(sample(R));
    if (reg === 'pons' || reg === 'medulla') pts.sort((a, b) => b[1] - a[1]);
    else { const key = mortonKey([-1, -1.4, -1.4], [1, 1.2, 1.4]); pts.sort((a, b) => key(a) - key(b)); }
    return pts;
  }
  function slots(reg, hemi, need, R) { return reg.startsWith('ctx') ? cortexSlots(reg, hemi, need, R) : volumeSlots(reg, hemi, need, R); }

  /* ---------- outlines: lobe borders on the cortex + contour rings of the deep parts */
  function outlines() {
    const out = [], N = 90;
    const surf = d => cortexPos(d, 1.012);
    const onPlane = (axis, v, keep) => {   // a curve on the unit sphere where d[axis] = v
      let cur = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N * Math.PI * 2, r = Math.sqrt(Math.max(0, 1 - v * v)), d = [0, 0, 0], o = [0, 1, 2].filter(k => k !== axis);
        d[axis] = v; d[o[0]] = Math.cos(t) * r; d[o[1]] = Math.sin(t) * r;
        if (keep(d)) cur.push(surf(d)); else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
      }
      if (cur.length > 1) out.push(cur);
    };
    onPlane(2, 0.28, d => d[1] > 0.05 || Math.abs(d[0]) < 0.42);                           // central sulcus: frontal | parietal
    onPlane(2, -0.6, d => d[1] > -0.2);                                                       // parieto-occipital border
    onPlane(1, 0.05, d => Math.abs(d[0]) > 0.42 && d[2] > -0.6 && d[2] < 0.28);               // lateral sulcus: above the temporal lobe
    onPlane(0, 0.075, d => d[1] > -0.3); onPlane(0, -0.075, d => d[1] > -0.3);                // the long fissure between the hemispheres
    // silhouette rings of the cerebrum
    for (const v of [-0.25, 0.25, 0.65]) onPlane(1, v, () => true);
    const ring = (c, r, axis) => { const pts = []; for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI * 2, p = [c[0], c[1], c[2]], o = [0, 1, 2].filter(k => k !== axis); p[o[0]] += Math.cos(t) * r[o[0]]; p[o[1]] += Math.sin(t) * r[o[1]]; pts.push(p); } out.push(pts); };
    const shape = (c, r) => { ring(c, r, 0); ring(c, r, 1); ring(c, r, 2); };
    for (const h of [-1, 1]) { shape([0.12 * h, 0.10, -0.02], [0.10, 0.085, 0.17]); shape([0.07 * h, -0.03, -0.25], [0.055, 0.045, 0.05]); shape([0.07 * h, -0.13, -0.29], [0.05, 0.042, 0.048]); }
    shape([0, -0.08, 0.17], [0.085, 0.065, 0.10]);
    shape([0, -0.30, -0.86], [0.62, 0.26, 0.36]);
    shape([0, -0.42, -0.28], [0.30, 0.22, 0.25]);
    const med = []; for (let i = 0; i <= 12; i++) { const s = i / 12; med.push([0.12 - 0.05 * s, -0.56 - 0.72 * s, -0.36 - 0.18 * s]); } out.push(med, med.map(p => [-p[0], p[1], p[2]]));
    return out;
  }
  /* ---------- organic growth: one file's 2 KB nodes grow through the free slots as a patch, a string or a tree.
     pts: the region's slots (space-filling order); sizes[i], kinds[i] per item ('patch' | 'string' | 'tree').
     Returns per item the slot indices in growth order and, for each, the growth parent (index into that list, -1 = root).
     Consecutive nodes in growth order are a continuous string of data, so the axioms (12 … 400 KB) are contiguous. */
  function grow(pts, sizes, kinds, R) {
    const N = pts.length, K = 10;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const p of pts) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], p[j]); hi[j] = Math.max(hi[j], p[j]); }
    const vol = Math.max(1e-6, (hi[0] - lo[0] + 0.01) * (hi[1] - lo[1] + 0.01) * (hi[2] - lo[2] + 0.01));
    const ck = (x, y, z) => x * 73856093 ^ y * 19349663 ^ z * 83492791;
    let cs = Math.cbrt(vol / Math.max(1, N)) * 1.6, cell;
    const ci = p => [Math.floor((p[0] - lo[0]) / cs), Math.floor((p[1] - lo[1]) / cs), Math.floor((p[2] - lo[2]) / cs)];
    for (let pass = 0; pass < 3; pass++) {   // shells fill little of their box: size the cells to the real density (≈ 5 per cell)
      cell = new Map();
      pts.forEach((p, i) => { const c = ci(p), k = ck(c[0], c[1], c[2]); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(i); });
      const avg = N / cell.size; if (pass < 2 && (avg < 3 || avg > 9)) cs *= Math.cbrt(5 / avg); else break;
    }
    const nb = new Array(N), bi = new Int32Array(K), bd = new Float64Array(K);
    for (let i = 0; i < N; i++) {
      const c = ci(pts[i]), p = pts[i]; let cnt = 0;
      for (let r = 1; r <= 3 && cnt < K; r++) {
        cnt = 0;
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
          const l = cell.get(ck(c[0] + dx, c[1] + dy, c[2] + dz)); if (!l) continue;
          for (const j of l) {
            if (j === i) continue;
            const q = pts[j], d = (q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1]) + (q[2] - p[2]) * (q[2] - p[2]);
            if (cnt < K) { let m = cnt++; while (m > 0 && bd[m - 1] > d) { bd[m] = bd[m - 1]; bi[m] = bi[m - 1]; m--; } bd[m] = d; bi[m] = j; }
            else if (d < bd[K - 1]) { let m = K - 1; while (m > 0 && bd[m - 1] > d) { bd[m] = bd[m - 1]; bi[m] = bi[m - 1]; m--; } bd[m] = d; bi[m] = j; }
          }
        }
      }
      nb[i] = Array.from(bi.subarray(0, cnt));
    }
    const free = new Uint8Array(N).fill(1); let cursor = 0;
    const nextFree = () => { while (cursor < N && !free[cursor]) cursor++; return cursor < N ? cursor : -1; };
    const nearFree = from => {   // breadth-first through the neighbour graph to the closest free slot
      const seen = new Set([from]); let q = [from];
      for (let d = 0; d < 6 && q.length; d++) { const nq = []; for (const x of q) for (const y of nb[x]) { if (seen.has(y)) continue; if (free[y]) return y; seen.add(y); nq.push(y); } q = nq.length > 400 ? nq.slice(0, 400) : nq; }
      return nextFree();
    };
    const out = [];
    for (let it = 0; it < sizes.length; it++) {
      const n = sizes[it], kind = kinds[it], idx = [], par = [];
      let s = nextFree(); if (s < 0) { out.push({ idx, par }); continue; }
      free[s] = 0; idx.push(s); par.push(-1);
      let tips = [0], dir = null; const dead = new Set();
      while (idx.length < n) {
        let ti;
        if (kind === 'patch') ti = tips[Math.floor(R() * tips.length)];
        else if (kind === 'string') ti = R() < 0.05 && tips.length > 1 ? tips[Math.floor(R() * tips.length)] : idx.length - 1;
        else ti = R() < 0.72 ? idx.length - 1 : tips[Math.floor(R() * tips.length)];
        if (dead.has(ti) && tips.length) ti = tips[Math.floor(R() * tips.length)];
        const t = idx[ti], cand = nb[t].filter(j => free[j]);
        if (!cand.length) dead.add(ti);
        let pick = -1;
        if (cand.length) {
          if (kind === 'patch' || !dir || ti !== idx.length - 1) pick = cand[Math.floor(R() * Math.min(3, cand.length))];
          else { let best = -9; for (const j of cand) { const v = [pts[j][0] - pts[t][0], pts[j][1] - pts[t][1], pts[j][2] - pts[t][2]], l = Math.hypot(...v) || 1, sc = (v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / l + R() * 0.7; if (sc > best) { best = sc; pick = j; } } }
        } else {
          tips = tips.filter(x => x !== ti);
          if (tips.length) continue;
          pick = nearFree(t); if (pick < 0) break;   // a jump: still joined to the last node by the web
          tips = [idx.length]; free[pick] = 0; idx.push(pick); par.push(idx.length - 2); dir = null; continue;
        }
        const v = [pts[pick][0] - pts[t][0], pts[pick][1] - pts[t][1], pts[pick][2] - pts[t][2]], l = Math.hypot(...v) || 1;
        dir = [v[0] / l, v[1] / l, v[2] / l];
        free[pick] = 0; idx.push(pick); par.push(ti); tips.push(idx.length - 1);
        if (tips.length > 40) tips.splice(0, tips.length - 40);
      }
      out.push({ idx, par });
    }
    return out;
  }
  // the growth pattern of a file: small ones are patches, big ones strings or trees (stable per id)
  function patternOf(id, n) {
    if (n < 6) return 'patch';
    let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    const u = (h >>> 0) / 4294967296;
    return u < 0.45 ? 'tree' : u < 0.8 ? 'string' : 'patch';
  }
  // axioms: every 12, 24, 48, 120, 220 and 400 KB of continuous data is one web with its own neuron connector
  const AXIOM_KB = [12, 24, 48, 120, 220, 400];

  // a label point per region (brain coordinates)
  const ANCHOR = {
    'ctx-front': [0, 0.78, 0.95], 'ctx-par': [0, 1.12, -0.15], 'ctx-temp': [1.05, -0.02, -0.15], 'ctx-occ': [0, 0.45, -1.22],
    thal: [0.12, 0.2, -0.02], hypo: [0, -0.13, 0.25], sc: [0.07, 0.02, -0.3], ic: [0.07, -0.17, -0.34],
    cereb: [0, -0.42, -1.2], pons: [0, -0.4, 0.0], medulla: [0, -1.2, -0.5],
  };
  window.BRAIN = { REG, PARTS, CER, lobeOf, cortexPos, slots, outlines, ANCHOR, regions: Object.keys(REG), grow, patternOf, AXIOM_KB };
})();
