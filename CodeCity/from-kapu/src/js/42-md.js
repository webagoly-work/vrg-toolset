// Tiny markdown for node texts: headings, bold, italics, code, lists, links (http/https only).
// Everything is escaped first, so no HTML from the data ever reaches the page.

function kpMdInline(s) {
  const codes = [];
  let out = kpEsc(s).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  out = out
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?![*\w])/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
  return out.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[+i] + '</code>');
}

// One plain paragraph comes back inline (no <p>), so short texts drop into any element.
function kpMd(src) {
  const lines = String(src == null ? '' : src).replace(/\r/g, '').split('\n');
  const blocks = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) { blocks.push({ k: 'p', t: para.join(' ') }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if (!line) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flushList(); blocks.push({ k: 'h', n: Math.min(m[1].length + 2, 6), t: m[2] }); continue; }
    if ((m = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/))) {
      flushPara();
      const ordered = /^\d/.test(line);
      if (!list || list.ordered !== ordered) { flushList(); list = { k: 'l', ordered, items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  if (blocks.length === 1 && blocks[0].k === 'p') return kpMdInline(blocks[0].t);
  return blocks.map(b => b.k === 'p' ? '<p>' + kpMdInline(b.t) + '</p>'
    : b.k === 'h' ? '<h' + b.n + '>' + kpMdInline(b.t) + '</h' + b.n + '>'
    : '<' + (b.ordered ? 'ol' : 'ul') + '>' + b.items.map(i => '<li>' + kpMdInline(i) + '</li>').join('') + '</' + (b.ordered ? 'ol' : 'ul') + '>').join('');
}

if (typeof module !== 'undefined') module.exports = { kpMd, kpMdInline };
