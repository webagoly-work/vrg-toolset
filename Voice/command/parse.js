// parse.js — WP-55 Parancs-héj: one spoken (or typed) command → { command, act, slots, confidence, alternatives, ask? }.
// UMD: a classic script in the frame page (window.VRGVoiceParse) and require()-able in Node (tests). No I/O: the registry
// (commands.json, or window.VRGVoiceCommands from commands.js) and the context (catalog items, Lapok, windows) are passed in.
//   const P = VRGVoiceParse;  P.parse(text, { registry, ctx })  ctx = { catalog:[{id,hu,en}], laps:[{id,name}], windows:[{id,kind,title,note,machine,focused}], machines:[…] }
// Words are compared accent-folded and lightly stemmed exactly as Prefilter/prefilter.js does (fold, SUF1-3), then "phonetically"
// (double letters collapsed, ly→j, w→v, ph→f, th→t, ck→k) with an edit distance that grows with the word, so recogniser slips like
// "planert", "bögésző" still land. Fillers (a, az, the, please…) are dropped before matching; a pattern may skip at most two unknown
// words (cost). A slot is resolved against its kind: catalog, lap, window (incl. "ez / this" = the focused one), color, origin,
// machine, level, auth, text (the original words, kept as typed). Low confidence or two close entities → `ask` (≤ 5 words).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGVoiceParse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------ words (= Prefilter/prefilter.js fold + stem)
  const fold = s => String(s == null ? '' : s).normalize('NFC').normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase();
  const SUF3 = ['bol', 'rol', 'tol', 'ban', 'ben', 'nak', 'nek', 'val', 'vel', 'hoz', 'hez'];
  const SUF2 = ['ig', 'ra', 're', 'ba', 'be', 'on', 'en', 'ot', 'at', 'et', 'ok', 'ek', 'ak'];
  const SUF1 = ['k', 't', 's', 'n'];
  function stem(w) {
    if (!w || /\d/.test(w) || w.length < 5) return w;
    for (const s of SUF3) if (w.length >= 7 && w.endsWith(s)) return w.slice(0, -s.length);
    for (const s of SUF2) if (w.length >= 6 && w.endsWith(s)) return w.slice(0, -s.length);
    for (const s of SUF1) if (w.endsWith(s)) return w.slice(0, -1);
    return w;
  }
  const phon = w => String(w).replace(/ly/g, 'j').replace(/w/g, 'v').replace(/ph/g, 'f').replace(/th/g, 't').replace(/ck/g, 'k').replace(/(.)\1+/g, '$1');
  // text → [{ raw, norm, stem, ph, at, end }] over the original string (at/end index the original, so a text slot keeps its spelling)
  function tokenize(text) {
    const orig = String(text == null ? '' : text).normalize('NFC');
    const f = fold(orig).replace(/[’'`]/g, ' ');
    const out = [];
    const re = /[a-z0-9]+/g; let m;
    while ((m = re.exec(f))) { const st = stem(m[0]); out.push({ raw: orig.slice(m.index, m.index + m[0].length), norm: m[0], stem: st, ph: phon(st), at: m.index, end: m.index + m[0].length }); }
    return out;
  }
  function lev(a, b) {
    if (a === b) return 0;
    const n = a.length, m = b.length;
    if (!n) return m; if (!m) return n;
    let prev = Array.from({ length: m + 1 }, (_, j) => j);
    for (let i = 1; i <= n; i++) {
      const cur = [i];
      for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[m];
  }
  const allowed = len => (len <= 4 ? 0 : len <= 7 ? 1 : 2);
  // two word tokens → 1 (same), 0.85 (prefix, ≥ 5 letters), 0.75 (within the edit distance), 0
  function wordSim(a, b) {
    if (!a || !b) return 0;
    if (a.stem === b.stem || a.norm === b.norm) return 1;
    if (a.ph === b.ph) return 0.95;
    const s = a.ph.length <= b.ph.length ? a.ph : b.ph, l = s === a.ph ? b.ph : a.ph;
    if (s.length >= 5 && l.startsWith(s)) return 0.85;
    const d = lev(a.ph, b.ph);
    return d <= allowed(Math.max(a.ph.length, b.ph.length)) ? 0.75 : 0;
  }
  const toks = s => tokenize(s);

  // ------------------------------------------------------------ the registry, prepared once
  const prepared = new WeakMap();
  function prep(reg) {
    if (prepared.has(reg)) return prepared.get(reg);
    const set = list => new Set((list || []).map(x => stem(fold(x))));
    const phrases = list => (list || []).map(p => toks(p)).filter(t => t.length);
    const P = {
      fillers: set(reg.fillers), deixis: set(reg.deixis), wake: phrases(reg.wake),
      yes: phrases(reg.yes), no: phrases(reg.no), auth: phrases(reg.auth),
      levels: Object.entries(reg.levels || {}).map(([lv, words]) => ({ lv, words: phrases(words) })),
      colors: Object.entries(reg.colors || {}).map(([w, c]) => ({ t: toks(w), value: c })),
      origins: Object.entries(reg.origins || {}).map(([w, o]) => ({ t: toks(w), value: o })),
      kinds: Object.entries(reg.kinds || {}).map(([w, k]) => ({ t: toks(w), value: k })),
      machines: phrases(reg.machines),
      commands: (reg.commands || []).map(c => ({
        c, pats: (c.say || []).map(s => s.split(/\s+/).filter(Boolean).flatMap(w => {
          const m = /^\{(\w+)(\?)?\}$/.exec(w);
          if (m) return [{ slot: m[1], opt: !!m[2] }];
          return toks(w).filter(t => !set(reg.fillers).has(t.stem)).map(t => ({ lit: t }));
        })),
      })),
    };
    prepared.set(reg, P);
    return P;
  }
  // does `phrase` (tokens) occur in `t` (tokens) starting at i? → score
  function phraseAt(t, i, phrase) {
    let s = 0;
    for (let k = 0; k < phrase.length; k++) { const w = wordSim(t[i + k], phrase[k]); if (!w) return 0; s += w; }
    return s / phrase.length;
  }
  // the best score of any phrase covering ALL of `t`
  function phraseAll(t, list) {
    let best = 0;
    for (const p of list) if (p.length === t.length) best = Math.max(best, phraseAt(t, 0, p));
    return best;
  }
  function phraseAny(t, list) {
    let best = 0;
    for (const p of list) for (let i = 0; i + p.length <= t.length; i++) best = Math.max(best, phraseAt(t, i, p));
    return best;
  }

  // ------------------------------------------------------------ slot resolution: tokens → { value, score, label, alts }
  // a name (catalog title, Lap name, window title) against the slot's words: mean of the best match per slot word, plus coverage
  function nameScore(slotT, name) {
    const nt = toks(name);
    if (!nt.length || !slotT.length) return 0;
    let sum = 0, cov = new Set();
    for (const s of slotT) {
      let best = 0, bi = -1;
      nt.forEach((n, i) => { const w = wordSim(s, n); if (w > best) { best = w; bi = i; } });
      sum += best; if (bi >= 0 && best) cov.add(bi);
    }
    const mean = sum / slotT.length;
    if (!mean) return 0;
    return Math.min(1, mean * 0.85 + (cov.size / nt.length) * 0.15);
  }
  function rank(cands) {
    cands.sort((a, b) => b.score - a.score);
    const top = cands[0];
    if (!top || top.score < 0.55) return { value: null, score: 0, alts: cands.slice(0, 3) };
    const alts = cands.slice(1, 3).filter(c => c.score >= top.score - 0.08 && c.value !== top.value);
    return { value: top.value, label: top.label, score: top.score, alts };
  }
  function resolve(kind, slotT, P, ctx, raw) {
    const opt = /\?$/.test(kind), k = kind.replace(/\?$/, '');
    const words = slotT.filter(t => !P.fillers.has(t.stem));
    if (!words.length) return opt ? { value: null, score: 1, empty: true } : { value: null, score: 0 };
    if (k === 'text') return { value: raw.trim().replace(/^[:,\s-]+/, ''), score: 1 };
    if (k === 'auth') return { value: phraseAny(words, P.auth) >= 0.75, score: 1 };
    if (k === 'level') { const c = P.levels.map(l => ({ value: l.lv, label: l.lv, score: phraseAll(words, l.words) })); return rank(c); }
    if (k === 'color') return rank(P.colors.map(c => ({ value: c.value, label: c.t.map(x => x.raw).join(' '), score: phraseAll(words, [c.t]) })));
    if (k === 'origin') return rank(P.origins.map(c => ({ value: c.value, label: c.t.map(x => x.raw).join(' '), score: phraseAll(words, [c.t]) })));
    if (k === 'machine') {
      const known = Math.max(phraseAll(words, P.machines), ...(ctx.machines || []).map(m => phraseAll(words, [toks(m)])), 0);
      const text = words.map(w => w.raw).join(' ');
      // a machine nobody named before is still a machine name (0.6): "ez a műhelygép"
      return { value: text, label: text, score: known >= 0.75 ? known : words.length <= 3 ? 0.6 : 0.3 };
    }
    if (k === 'catalog') {
      const c = (ctx.catalog || []).map(it => ({ value: it.id, label: it.hu || it.id, score: Math.max(nameScore(words, it.hu || ''), nameScore(words, it.en || '') * 0.97, nameScore(words, String(it.id).replace(/[.:_-]/g, ' ')) * 0.95) }));
      // a pane kind said by name ("böngésző") opens that kind's catalog item when there is one
      for (const kd of P.kinds) if (phraseAll(words, [kd.t]) >= 0.75) { const it = (ctx.catalog || []).find(x => x.id === kd.value); if (it) c.push({ value: it.id, label: it.hu, score: 0.97 }); }
      return rank(c);
    }
    if (k === 'lap') return rank((ctx.laps || []).map(l => ({ value: l.id, label: l.name, score: nameScore(words, l.name) })));
    if (k === 'window') {
      const wins = ctx.windows || [];
      if (words.length <= 2 && words.every(w => P.deixis.has(w.stem) || P.fillers.has(w.stem) || w.stem === 'ablak' || w.stem === 'window')) {
        const f = wins.find(w => w.focused);
        return f ? { value: f.id, label: f.title || f.kind, score: 1, deixis: true } : { value: null, score: 0.9, deixis: true };
      }
      const rest = words.filter(w => !P.deixis.has(w.stem) && w.stem !== 'ablak' && w.stem !== 'window');
      const kindOf = P.kinds.filter(kd => phraseAny(rest, [kd.t]) >= 0.75).map(kd => kd.value);
      const c = wins.map(w => {
        let s = Math.max(nameScore(rest, w.title || ''), nameScore(rest, w.note || '') * 0.9, nameScore(rest, w.machine || '') * 0.9);
        if (kindOf.includes(w.kind)) s = Math.max(s, 0.9 + (w.focused ? 0.02 : 0));
        return { value: w.id, label: w.title || w.kind, score: s };
      });
      return rank(c);
    }
    return { value: null, score: 0 };
  }

  // ------------------------------------------------------------ pattern matching
  // pats tokens vs input tokens: literals in order (fuzzy), slots take ≥ 1 token (optional ones may take 0), ≤ 2 unknown words skipped
  function matchPat(pat, T) {
    let best = null;
    const lits = pat.filter(p => p.lit).length;
    function go(pi, ti, cost, skips, slots) {
      if (best && cost >= best.cost) return;
      if (pi === pat.length) { if (ti === T.length) best = { cost, slots: { ...slots } }; return; }
      const p = pat[pi];
      if (p.lit) {
        for (let k = 0; k <= Math.min(2 - skips, T.length - ti - 1); k++) {
          const w = wordSim(T[ti + k], p.lit);
          if (w) go(pi + 1, ti + k + 1, cost + (1 - w) + k * 0.5, skips + k, slots);
        }
        return;
      }
      const last = pi === pat.length - 1;
      const min = p.opt ? 0 : 1;
      for (let k = last ? T.length - ti : min; k <= T.length - ti; k++) {
        if (k < min) continue;
        slots[p.slot] = [ti, ti + k];
        go(pi + 1, ti + k, cost, skips, slots);
        delete slots[p.slot];
        if (last) break;
      }
    }
    go(0, 0, 0, 0, {});
    if (!best) return null;
    return { score: Math.max(0, 1 - best.cost / (lits + 1)), lits, slots: best.slots };
  }

  // strip a wake word at the start ("VRG, …") and the fillers
  function clean(text, P) {
    let T = tokenize(text);
    for (const w of P.wake) if (T.length > w.length && phraseAt(T, 0, w) >= 0.95) { T = T.slice(w.length); break; }
    return T.filter(t => !P.fillers.has(t.stem));
  }

  // yes / no / other for a pending confirmation
  function confirmWord(text, registry) {
    const P = prep(registry), T = clean(text, P);
    if (!T.length) return '';
    if (phraseAll(T, P.no) >= 0.75 || (T.length <= 2 && phraseAny(T, P.no) >= 0.95)) return 'no';
    if (phraseAll(T, P.yes) >= 0.75 || (T.length <= 2 && phraseAny(T, P.yes) >= 0.95)) return 'yes';
    return '';
  }

  const ASK_UNKNOWN = { hu: 'Nem értem. Mondd: súgó.', en: "Didn't get that. Say: help." };
  function parse(text, { registry, ctx = {} } = {}) {
    const P = prep(registry || {});
    const orig = String(text == null ? '' : text).normalize('NFC');
    const T = clean(orig, P);
    if (!T.length) return { command: null, act: null, slots: {}, confidence: 0, alternatives: [], ask: ASK_UNKNOWN.hu };
    const results = [];
    for (const { c, pats } of P.commands) {
      let best = null;
      for (const pat of pats) {
        const m = matchPat(pat, T);
        if (!m) continue;
        const slots = {};
        let slotScore = 1, alts = null;
        for (const [name, kind] of Object.entries(c.slots || {})) {
          const span = m.slots[name];
          const st = span ? T.slice(span[0], span[1]) : [];
          const raw = span && st.length ? orig.slice(st[0].at, kind.replace(/\?$/, '') === 'text' ? orig.length : st[st.length - 1].end) : '';
          const r = resolve(kind, st, P, ctx, raw);
          slots[name] = { raw, value: r.value, label: r.label, score: r.score, ...(r.deixis ? { deixis: true } : {}), ...(r.empty ? { empty: true } : {}) };
          slotScore = Math.min(slotScore, r.score);
          if (r.alts && r.alts.length && !alts) alts = { slot: name, list: [r.label ? { value: r.value, label: r.label } : null, ...r.alts.map(a => ({ value: a.value, label: a.label }))].filter(Boolean) };
        }
        const conf = m.score * slotScore * (0.85 + 0.15 * Math.min(1, m.lits / 3));
        if (!best || conf > best.confidence) best = { command: c.id, act: c.act, confirm: !!c.confirm, level: c.level || '', value: c.value, slots, confidence: Math.round(conf * 1000) / 1000, ambiguous: alts };
      }
      if (best && best.confidence > 0) results.push(best);
    }
    results.sort((a, b) => b.confidence - a.confidence);
    const top = results[0];
    const alternatives = results.slice(1, 4).map(r => ({ command: r.command, confidence: r.confidence }));
    if (!top || top.confidence < 0.45) return { command: null, act: null, slots: {}, confidence: top ? top.confidence : 0, alternatives: results.slice(0, 3).map(r => ({ command: r.command, confidence: r.confidence })), ask: ASK_UNKNOWN.hu };
    const out = { ...top, alternatives };
    if (top.ambiguous && top.ambiguous.list.length >= 2) out.ask = 'Melyik: ' + top.ambiguous.list.slice(0, 2).map(x => x.label).join(' vagy ') + '?';
    else if (top.confidence < 0.6) out.ask = 'Úgy érted: ' + top.command + '?';
    delete out.ambiguous;
    if (top.ambiguous) out.choices = top.ambiguous;
    return out;
  }

  // every word the recogniser should be biased towards: the registry's phrases + the context's names
  function vocabulary(registry, ctx = {}) {
    const out = new Set(registry && registry.phrases || []);
    for (const it of ctx.catalog || []) { if (it.hu) out.add(it.hu); if (it.en) out.add(it.en); }
    for (const l of ctx.laps || []) out.add(l.name);
    for (const m of ctx.machines || []) out.add(m);
    return [...out].filter(Boolean);
  }

  // the answer to an ask-back ("Melyik: Planner vagy Kapu?"): the label it names, or "az első / a második / first / second" → index | -1
  const ORD = [['elso', 'egyes', 'first', 'one'], ['masodik', 'kettes', 'second', 'two'], ['harmadik', 'harmas', 'third', 'three']];
  function choose(text, labels, registry) {
    const P = prep(registry || {}), T = clean(text, P);
    if (!T.length) return -1;
    for (let i = 0; i < ORD.length && i < labels.length; i++) if (T.some(t => ORD[i].includes(t.stem) || ORD[i].includes(t.norm))) return i;
    let best = -1, bs = 0.55;
    labels.forEach((l, i) => { const s = nameScore(T, String(l || '')); if (s > bs) { bs = s; best = i; } });
    return best;
  }

  return { parse, confirmWord, choose, vocabulary, tokenize, fold, stem, phon, lev, wordSim, ASK_UNKNOWN };
});
