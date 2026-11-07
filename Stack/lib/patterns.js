// VRG Stack — pattern finding over recorded sessions (process mining, own code; PM4Py is AGPL).
//
//   dfg(sequences)              directly-follows graph: how often B comes right after A
//                               (Read → Edit 412 times). The basic picture of a process.
//   prefixSpan(seqs, minSup, maxLen)
//                               frequent ordered sub-sequences (gaps allowed) that occur in at
//                               least `minSup` sequences. Pei et al. 2001: grow a prefix one item
//                               at a time, keeping only the suffixes that still contain it.
//   collapse(seq)               A A B B A → A B A (repeats carry no order information)
'use strict';

const collapse = seq => seq.filter((x, i) => i === 0 || x !== seq[i - 1]);

function dfg(sequences) {
  const pairs = new Map(); const starts = new Map(); const ends = new Map();
  for (const s of sequences) {
    if (!s.length) continue;
    starts.set(s[0], (starts.get(s[0]) || 0) + 1);
    ends.set(s[s.length - 1], (ends.get(s[s.length - 1]) || 0) + 1);
    for (let i = 1; i < s.length; i++) { const k = s[i - 1] + ' → ' + s[i]; pairs.set(k, (pairs.get(k) || 0) + 1); }
  }
  const sort = m => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { pairs: sort(pairs), starts: sort(starts), ends: sort(ends) };
}

function prefixSpan(sequences, minSup = 3, maxLen = 4) {
  const out = [];
  const CAP = 5000; // many frequent items can explode the search; stop growing past this many patterns
  // a projection is a list of [sequence index, position after the prefix]
  function grow(prefix, proj) {
    if (prefix.length >= maxLen || out.length >= CAP) return;
    const support = new Map(); // item → set of sequence indexes
    for (const [si, pos] of proj) {
      const s = sequences[si]; const seenHere = new Set();
      for (let i = pos; i < s.length; i++) if (!seenHere.has(s[i])) { seenHere.add(s[i]); (support.get(s[i]) || support.set(s[i], new Set()).get(s[i])).add(si); }
    }
    for (const [item, sis] of [...support.entries()].sort((a, b) => b[1].size - a[1].size || (a[0] < b[0] ? -1 : 1))) {
      if (sis.size < minSup) continue;
      const p = prefix.concat(item);
      if (p.length >= 2) out.push({ seq: p, support: sis.size });
      const next = [];
      for (const [si, pos] of proj) { const s = sequences[si]; const at = s.indexOf(item, pos); if (at >= 0) next.push([si, at + 1]); }
      grow(p, next);
    }
  }
  grow([], sequences.map((_, i) => [i, 0]));
  // keep the longest form of each pattern: drop a pattern when a longer one with equal support contains it
  const contains = (big, small) => { let j = 0; for (const x of big) if (x === small[j]) j++; return j === small.length; };
  return out.filter(p => !out.some(q => q.seq.length > p.seq.length && q.support === p.support && contains(q.seq, p.seq)))
    .sort((a, b) => b.support * b.seq.length - a.support * a.seq.length);
}

module.exports = { dfg, prefixSpan, collapse };
