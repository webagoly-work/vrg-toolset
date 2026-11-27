// VRG Stack — S · Kérések (the Founder's asks), S13 of research/STRINGS-PLAN.md (§5, STK-Q24: T → N → P → K → J):
// every prompt the Founder typed and every slash command, from the recordings, clustered. K shows where attention
// went: which pillar the asks were about, which ask came back again and again, which never turned into work.
//
//   collect(sessions, readSteps) → [session with its asks]     from out/recordings (index.json + <sid8>.jsonl)
//     an ask is a recording step with actor user: span 'prompt', or a typed slash command (tool 'command');
//     harness text is left out (a continued session's summary, "[Request interrupted …]", hook feedback, <tags>)
//   layer({ sessions, resolve, has }) → { nodes, edges }
//     S:ask.<sid8>.<seq>   kind ask / command; t = its day; lane = its cluster (or 'single'); state 'committed' when
//                          a commit followed it before the next ask, else 'no commit'
//     S:cluster.<hash>     asks that say the same thing (≥ 2): the words they share; state 'landed' when a commit
//                          followed one of its asks, else 'open'
//     ask → U:run.<sid8> 'asked-in' · cluster → ask 'contains' · ask → what its work touched 'led-to' (the nodes the
//     steps after it touched, until the next ask, w = how many steps) · ask → each node its text names 'mentions'
//     (the join's own resolver: decision ids, GO phrases, paths, commit hashes …)
//   cluster(asks) → Map(ask id → cluster key)                    pure: word sets, numbers folded (S12 ≈ S13), Jaccard
//   nothingLanded(graph) → clusters asked in ≥ 2 sessions where no commit followed any ask (DRIFT.md §13)
//
// Privacy: an ask's text can name a client. It stays in out/ (git-ignored) and the local pages; the connectome data
// that the phone bundle carries gets a neutral title for K nodes (lib/connectome.js), never the words.
'use strict';

const crypto = require('crypto');
const { fold, clip, day } = require('./common');

const NOISE = /^\s*(<|This session is being continued|\[Request interrupted|Stop hook feedback|Caveat: |\[Image #)/;
const STOP = new Set(('a an the and or but if then else of to in on at by for from with without into onto over under up down out off is are was were be been being am do does did done doing have has had it its this that these those there here what which who whom whose how why when where can could should would will shall may might must not no yes ok okay please pls thanks thank you your yours me my mine we our ours us i so too very just also only than as about again more less some any all each every one two now then lets let make sure get got go see use using used look like want need into via etc ' +
  'az és hogy is nem meg de egy ez azt ezt van volt lesz kell lehet csak még már mint mert vagy ha akkor itt ott most minden mi mit ki kit hol hogyan miért amit ami aki ezek azok neki nekem nekünk vele igen nem sem se pedig majd úgy így ahogy legyen kérlek kérem').split(/\s+/).map(fold));

function words(text) {
  const out = new Set();
  for (let w of fold(String(text || '')).toLowerCase().split(/[^a-z0-9#]+/)) {
    if (!w || STOP.has(w)) continue;
    w = w.replace(/\d+/g, '#');               // S12 and S13, M15 and M16: the same ask about the next one
    if (w.length < 2 || w === '#') continue;
    out.add(w);
  }
  return out;
}

// sessions: index.json's sessions; readSteps(sid8) → the recording's steps
function collect(sessions, readSteps) {
  const out = [];
  for (const s of Object.values(sessions || {})) {
    const sid8 = s.sid.slice(0, 8), asks = [];
    let cur = null, seen = null;
    const close = () => { if (!cur) return; cur.touched = [...seen].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, LED); };
    for (const st of readSteps(sid8) || []) {
      const cmd = st.actor === 'user' && st.span === 'execute_tool' && st.tool === 'command';
      if (st.actor === 'user' && (st.span === 'prompt' || cmd)) {
        const text = cmd ? String(st.text || '').replace(/^sk:\S+\s+/, '') : String(st.text || '');
        if ((cmd || !NOISE.test(text)) && text.trim()) {
          close(); cur = { seq: st.seq, t: st.t, kind: cmd ? 'command' : 'ask', text, commits: 0, touched: [] }; seen = new Map(); asks.push(cur);
          continue;
        }
      }
      // what the ask led to: every node the steps after it touched, until the next ask; a commit among them counts
      if (!cur) continue;
      if (st.span === 'commit') cur.commits++;
      for (const id of st.nodes || []) seen.set(id, (seen.get(id) || 0) + 1);
    }
    close();
    if (asks.length) out.push({ sid: s.sid, sid8, title: s.title || '', start: s.start || '', commits: (s.commits || []).length, asks });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

// single link over Jaccard ≥ min on the word sets; candidates only through words no more common than maxDf
function cluster(asks, { min = 0.6, maxDf = 200 } = {}) {
  const sets = asks.map(a => words(a.text)), parent = asks.map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const by = new Map();
  sets.forEach((s, i) => { for (const w of s) (by.get(w) || by.set(w, []).get(w)).push(i); });
  const seen = new Set();
  for (const [, list] of by) {
    if (list.length < 2 || list.length > maxDf) continue;
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const i = list[x], j = list[y], k = i * asks.length + j; if (seen.has(k)) continue; seen.add(k);
      const A = sets[i], B = sets[j]; if (A.size < 2 || B.size < 2) continue;
      let inter = 0; for (const w of A) if (B.has(w)) inter++;
      if (inter / (A.size + B.size - inter) >= min) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  asks.forEach((a, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(i); });
  const out = new Map();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const first = g.map(i => asks[i]).sort((a, b) => (a.id < b.id ? -1 : 1))[0];   // stable: named by its earliest ask
    const key = crypto.createHash('sha1').update(first.id).digest('hex').slice(0, 8);
    for (const i of g) out.set(asks[i].id, key);
  }
  return { of: out, words: sets };
}

const MENTIONS = 12;   // per ask: the rest is noise
const LED = 8;         // per ask: the nodes its work touched most

function layer({ sessions = [], resolve = () => [], has = () => true } = {}) {
  const nodes = [], edges = [], asks = [];
  for (const s of sessions) for (const a of s.asks) asks.push({ ...a, id: `S:ask.${s.sid8}.${a.seq}`, s });
  asks.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.id < b.id ? -1 : 1));
  const C = cluster(asks);
  const groups = new Map();
  asks.forEach((a, i) => { const k = C.of.get(a.id); if (k) (groups.get(k) || groups.set(k, []).get(k)).push(i); });

  asks.forEach((a, i) => {
    const key = C.of.get(a.id);
    nodes.push({ id: a.id, layer: 'S', kind: a.kind, title: clip(a.text.replace(/\s+/g, ' '), 120), brief: clip(a.s.title, 160), t: day(a.t),
      state: a.commits ? 'committed' : 'no commit', lane: key ? 'cluster ' + key : 'single', tier: '', own: [], text: a.text,
      extra: { sid: a.s.sid, at: a.t, cluster: key || '', commits: a.commits || 0 } });
    if (has('U:run.' + a.s.sid8)) edges.push({ a: a.id, b: 'U:run.' + a.s.sid8, rel: 'asked-in' });
    const led = new Set();
    for (const [id, w] of a.touched || []) if (id && id[0] !== 'S' && id[0] !== 'U' && has(id)) { edges.push({ a: a.id, b: id, rel: 'led-to', w }); led.add(id); }
    let n = 0;
    for (const id of resolve(a.text) || []) {
      if (n >= MENTIONS) break;
      if (!id || id[0] === 'S' || id[0] === 'U' || !has(id) || led.has(id)) continue;
      edges.push({ a: a.id, b: id, rel: 'mentions' }); n++;
    }
  });

  for (const [key, idx] of groups) {
    const list = idx.map(i => asks[i]);
    const count = new Map(); for (const i of idx) for (const w of C.words[i]) count.set(w, (count.get(w) || 0) + 1);
    const shared = [...count].filter(([, c]) => c >= Math.max(2, Math.ceil(idx.length / 2))).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 6).map(([w]) => w);
    const sids = [...new Set(list.map(a => a.s.sid8))], landed = list.some(a => a.commits > 0);
    const first = day(list[0].t), last = day(list[list.length - 1].t);
    const id = 'S:cluster.' + key;
    nodes.push({ id, layer: 'S', kind: 'cluster', title: `${shared.join(' ') || clip(list[0].text, 60)} ×${list.length}`,
      brief: `${list.length} asks in ${sids.length} session${sids.length === 1 ? '' : 's'}, ${first}${last !== first ? ' → ' + last : ''}; ${landed ? 'a commit followed at least one of them' : 'no commit followed any of them'}. First: “${clip(list[0].text.replace(/\s+/g, ' '), 120)}”`,
      t: last, state: landed ? 'landed' : 'open', lane: 'cluster ' + key, tier: '', own: [], text: shared.join(' '),
      extra: { asks: list.length, sessions: sids.length, first, last, words: shared } });
    for (const a of list) edges.push({ a: id, b: a.id, rel: 'contains' });
  }
  return { nodes, edges };
}

// clusters asked in ≥ 2 sessions where no commit followed any ask, newest first (DRIFT.md §13)
function nothingLanded(graph, { min = 2 } = {}) {
  const k = n => n.k || n.extra || {};   // the written graph carries it as `k` (pipeline pub), the adapter as extra
  return graph.nodes.filter(n => n.layer === 'S' && n.kind === 'cluster' && n.state === 'open' && (k(n).sessions || 0) >= min)
    .sort((a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : 0));
}

module.exports = { collect, cluster, words, layer, nothingLanded, NOISE };
