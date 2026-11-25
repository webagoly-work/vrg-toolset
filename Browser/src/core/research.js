// research.js — Kutatás (T5): a notebook of quotes, notes and sources becomes one sourced Markdown note: every quote and source
// carries a numbered reference [n] to its page, the list of sources (title, URL, the day it was read) closes the note. The
// note goes where the repo keeps its research (docs/research/web/, through serve.js) or into a job's folder, or to Claude.
// Pure: no DOM.
//   VB.research.markdown(nb, { now }) → string        VB.research.sources(nb) → [{ n, url, title, at }]
//   VB.research.forClaude(nb) → the note with a one-line ask in front (what the chat pane gets as a pack)
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.research) return;

  const day = t => { try { return new Date(t).toISOString().slice(0, 10); } catch (e) { return ''; } };
  const oneLine = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const mdEsc = s => oneLine(s).replace(/([\[\]])/g, '\\$1');

  // the sources in the order they first appear; one number per URL
  function sources(nb) {
    const out = [], by = new Map();
    for (const it of (nb && nb.items) || []) {
      if (!it || !it.url || by.has(it.url)) continue;
      const s = { n: out.length + 1, url: it.url, title: oneLine(it.title) || it.url, at: it.at || 0 };
      by.set(it.url, s); out.push(s);
    }
    return out;
  }

  function markdown(nb, o) {
    const n = nb || {}, opt = o || {};
    const src = sources(n), num = new Map(src.map(s => [s.url, s.n]));
    const lines = ['# ' + (oneLine(n.title) || 'Kutatás'), ''];
    if (n.question) lines.push('**Kérdés:** ' + oneLine(n.question), '');
    lines.push('*' + [day(opt.now || Date.now()), 'VRG Böngésző, Kutatás', n.job ? 'munka: ' + n.job : '', src.length + ' forrás'].filter(Boolean).join(' · ') + '*', '');
    const items = (n.items || []).filter(Boolean);
    if (items.length) lines.push('## Jegyzetek és idézetek', '');
    for (const it of items) {
      const ref = it.url ? ' [' + num.get(it.url) + ']' : '';
      if (it.kind === 'quote') lines.push(...String(it.text || '').trim().split(/\n+/).map(l => '> ' + l.trim()), '>' + (ref ? ' —' + ref : ''), '');
      else if (it.kind === 'source') lines.push('- Forrás: ' + mdEsc(it.title || it.url) + ref + (it.text ? ' — ' + oneLine(it.text).slice(0, 300) : ''), '');
      else lines.push(String(it.text || '').trim() + ref, '');
    }
    if (src.length) {
      lines.push('## Források', '');
      for (const s of src) lines.push(s.n + '. [' + mdEsc(s.title) + '](' + s.url + ')' + (s.at ? ' — olvasva ' + day(s.at) : ''));
      lines.push('');
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function forClaude(nb) {
    return 'Ez a kutatási jegyzetem a VRG Böngészőből: idézetek a forrásokkal [n], a végén a források listája. Olvasd el, utána kérdezek róla.\n\n' + markdown(nb);
  }

  const api = { markdown, sources, forClaude };
  VB.research = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
