/* VRG Stack: neuron addresses and gate kinds (NC, research/NEURON-CODES.md).
   An axiom neuron is the connector of one 12 / 24 / 48 / 120 / 220 / 400 KB run of a file's 2 KB nodes.
   Its address is 6 characters: 1 gate letter + a 5-character root.
     root  = Crockford base32 (lowercase, no i l o u): 2 chars of hash(file id) = the family, shared by all of a
             file's neurons, + 3 chars of hash("<file id>|<KB>|<index>") = the run;
             stable while the file keeps its id and the run its place; like a short git hash, any unique prefix finds it.
     gate  = what the neuron does with a signal (see GATES). It is derived from the file's facts, so it can change
             when the facts do (a decision gets answered, a pathway parks); the root never does.
   Collisions: the roots are made unique within one build (a clash re-hashes with a salt, in a stable order).
   Plain script: works in the pages (window.NEURONS) and in node (module.exports). */
(function (root) {
  'use strict';
  const AXIOM_KB = [12, 24, 48, 120, 220, 400];
  const B32 = '0123456789abcdefghjkmnpqrstvwxyz';

  // The gate catalogue. in / out: how many vectors come in / go out. w: change of signal strength.
  // Letters avoid the digits' look-alikes and are never 0-9, so the first character always names the gate.
  const GATES = {
    r: { name: 'relay', hu: 'továbbító', in: 1, out: 1, w: 0, rule: '1 → 1: továbbadja a következő címnek · passes the signal to the next address' },
    f: { name: 'fork', hu: 'elágazás', in: 1, out: 2, w: 0, rule: '1 → 2: két párhuzamos címre küldi · sends to two parallel addresses' },
    m: { name: 'merge', hu: 'összefutás', in: 2, out: 1, w: 0, rule: '2+ → 1: több vektort egy címre von össze · merges vectors into one address' },
    g: { name: 'gate', hu: 'kapu', in: 1, out: 1, w: 0, rule: 'megállít, amíg a feltétel nem teljesül (pl. a döntés megvan) · stops the vector until its condition holds' },
    x: { name: 'switch', hu: 'váltó', in: 1, out: 2, w: 0, rule: '1 → egyik a kettőből, állapot szerint · routes to one of two by state' },
    t: { name: 'threshold', hu: 'küszöb', in: 3, out: 1, w: 0, rule: 'k az n-ből: akkor tüzel, ha elég bemenet aktív · fires when k of its n inputs are active' },
    a: { name: 'amplify', hu: 'erősítő', in: 1, out: 1, w: +1, rule: '+1 pont a jelerősséghez · adds one point of signal strength' },
    d: { name: 'damp', hu: 'csillapító', in: 1, out: 1, w: -1, rule: '−1 pont a jelerősségből · removes one point of signal strength' },
    n: { name: 'inhibit', hu: 'gátló', in: 1, out: 1, w: 0, rule: 'a beérkező jel elnémítja a szomszédot (felváltott tudás) · an incoming signal silences its neighbour (superseded knowledge)' },
    h: { name: 'hold', hu: 'tároló', in: 1, out: 1, w: 0, rule: 'megtartja a jelet, amíg ki nem olvassák (memória) · latches the signal until it is read (memory)' },
    c: { name: 'clock', hu: 'ütem', in: 0, out: 1, w: 0, rule: 'magától tüzel, ütemre (futások, ütemezés) · fires on its own rhythm (runs, schedules)' },
    s: { name: 'source', hu: 'forrás', in: 0, out: 1, w: 0, rule: 'innen indul a vektor (session-indítás, brief) · a vector starts here (session start, brief)' },
    e: { name: 'end', hu: 'kimenet', in: 1, out: 0, w: 0, rule: 'itt hagyja el a jel a rendszert (commit, merge) · the signal leaves the system here (commit, merge)' },
  };

  function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; }   // FNV-1a + murmur finaliser
  function b32(n, len) { let s = ''; for (let i = 0; i < len; i++) { s = B32[n & 31] + s; n >>>= 5; } return s; }
  // root = 2-char family (the file: every neuron of a file shares it) + 3-char run (tier + index, salted on a clash)
  const familyOf = fileId => b32(fnv(fileId), 2);
  const rootOf = (fileId, kb, j, salt) => familyOf(fileId) + b32(fnv(fileId + '|' + kb + '|' + j + (salt ? '#' + salt : '')), 3);

  const DAY = 864e5;
  /* the role of a file's head neuron (its highest-tier run): from the file's own facts.
     f: { kind, layer, line, line2, degree, last, lineState } */
  function roleOf(f, now) {
    const k = f.kind || '', age = f.last ? (now - f.last) / DAY : 1e9;
    if (k === 'session start' || k === 'brief' || k === 'codephrase') return 's';
    if (k === 'commit' || k === 'merge') return 'e';
    if (k === 'run' || k === 'day' || k === 'scheduled task') return 'c';
    if (k === 'agent' || k === 'agent tool' || k === 'council') return 't';
    if (f.layer === 'Q') return f.lineState === 'waiting' ? 'g' : 'x';
    if (f.lineState === 'absorbed' || f.lineState === 'ended') return 'n';
    if (f.line >= 0 && f.line2 >= 0) return 'f';
    if ((f.degree || 0) >= 8) return 'm';
    if (k.startsWith('memory')) return 'h';
    if (age < 3) return 'a';
    if (age > 30 && (f.lineState === 'parked' || f.line < 0)) return 'd';
    return 'r';
  }

  /* every axiom neuron of every file: [{ addr, root, gate, file, tier, kb, j, w, kids }]
     files: [{ id, n (2 KB nodes), kind, layer, line, line2, degree, last, lineState }]; unit = bytes per node */
  function build(files, unit, now) {
    now = now || Date.now();
    const TN = AXIOM_KB.map(kb => Math.max(1, Math.round(kb * 1024 / unit)));
    const out = [], seen = new Set();
    for (const f of files) {
      const first = out.length, idx = [];
      TN.forEach((c, t) => {
        const m = Math.floor(f.n / c); idx[t] = [];
        for (let j = 0; j < m; j++) {
          let salt = 0, r = rootOf(f.id, AXIOM_KB[t], j, 0);
          while (seen.has(r)) r = rootOf(f.id, AXIOM_KB[t], j, ++salt);
          seen.add(r); idx[t].push(out.length);
          out.push({ root: r, gate: 'r', file: f.id, tier: t, kb: AXIOM_KB[t], j, w: t + 1, kids: [] });
        }
      });
      if (out.length === first) continue;
      // the tree: a run's neuron holds the neurons of the tier below that fall inside it
      for (let t = 1; t < TN.length; t++) for (const i of idx[t]) { const x = out[i], c0 = TN[t - 1], s0 = x.j * TN[t], e0 = s0 + TN[t]; for (let jj = Math.ceil(s0 / c0); jj * c0 < e0 && jj < idx[t - 1].length; jj++) x.kids.push(idx[t - 1][jj]); }
      // the head: the last neuron of the highest tier; it carries the file's role
      let top = TN.length - 1; while (!idx[top].length) top--;
      const head = out[idx[top][idx[top].length - 1]], g = roleOf(f, now);
      head.gate = g; head.w = Math.max(1, Math.min(9, head.w + GATES[g].w));
      if (g === 's') out[idx[0][0]].gate = 's';                       // a source starts at its first run too
      if (g === 'e') out[idx[0][idx[0].length - 1]].gate = 'e';       // an end leaves from its last run
    }
    for (const x of out) { x.addr = x.gate + x.root; x.kids = x.kids.map(i => out[i].gate + out[i].root); }
    return out;
  }

  /* find by any unique prefix of the root (with or without the gate letter) */
  function find(list, q) {
    q = String(q || '').toLowerCase(); const r = q.length === 6 ? q.slice(1) : q;
    const hit = list.filter(x => x.addr === q || x.root.startsWith(r));
    return hit.length === 1 ? hit[0] : hit;
  }

  const API = { AXIOM_KB, GATES, B32, familyOf, rootOf, roleOf, build, find };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.NEURONS = API;
})(typeof window !== 'undefined' ? window : this);
