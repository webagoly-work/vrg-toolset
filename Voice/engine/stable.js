// stable.js — the stable-prefix rule for pseudo-streaming Whisper (LocalAgreement-2): Whisper re-decodes the whole growing buffer every
// step, and the last words of a hypothesis often change. A word is COMMITTED once two consecutive hypotheses agree on it (and on
// everything before it); committed words never change or disappear. The live text = the committed words + the current hypothesis's
// tail (tentative). The final decode replaces both.
//   const s = createStable(); s.push('szia vrg nyisd') → { committed, tentative, text }; s.reset()
'use strict';

const words = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
// a word compared loosely: case, accents kept, trailing punctuation ignored ("Planner," = "planner")
const key = w => String(w).toLowerCase().replace(/[.,!?;:…"'„”»«()\[\]]+$/u, '').replace(/^["'„»«(\[]+/u, '');

// the number of leading words two lists agree on
function agree(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && key(a[n]) === key(b[n])) n++;
  return n;
}

function createStable() {
  let committed = [], prev = [];
  function push(hyp) {
    const cur = words(hyp);
    // the hypothesis must still start with the committed words; Whisper sometimes rewrites the start, then we keep ours
    const keep = agree(committed, cur) === committed.length;
    const tail = keep ? cur.slice(committed.length) : cur.slice(Math.min(cur.length, committed.length));
    const prevTail = agree(committed, prev) === committed.length ? prev.slice(committed.length) : [];
    const n = agree(prevTail, tail);
    if (n > 0) committed = committed.concat(tail.slice(0, n));
    prev = committed.concat(tail.slice(n));
    const tentative = tail.slice(n);
    return { committed: committed.join(' '), tentative: tentative.join(' '), text: committed.concat(tentative).join(' ') };
  }
  return { push, reset() { committed = []; prev = []; }, committed: () => committed.join(' ') };
}

module.exports = { createStable, agree, words, key };
