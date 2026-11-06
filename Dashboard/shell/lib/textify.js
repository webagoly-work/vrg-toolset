// textify.js — HTML → readable text (WP-29). No DOM: a small tokenizer. Drops script / style / nav / footer (and head, svg, templates),
// keeps headings and paragraphs as lines, collapses whitespace.
//   textify(html) → string          title(html) → string (the <title>, decoded)
'use strict';

const DROP = ['script', 'style', 'nav', 'footer', 'head', 'noscript', 'template', 'svg', 'iframe'];
const BLOCK = 'address|article|aside|blockquote|dd|details|div|dl|dt|fieldset|figcaption|figure|form|h[1-6]|header|hr|li|main|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul|br';
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—' };

function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; } catch (x) { return ''; }
    }
    return Object.prototype.hasOwnProperty.call(NAMED, e.toLowerCase()) ? NAMED[e.toLowerCase()] : m;
  });
}

function title(html) {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(String(html == null ? '' : html));
  return m ? decode(m[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim() : '';
}

function textify(html) {
  let s = String(html == null ? '' : html).replace(/<!--[\s\S]*?-->/g, ' ');
  for (const t of DROP) s = s.replace(new RegExp('<' + t + '\\b[^>]*>[\\s\\S]*?<\\/' + t + '\\s*>', 'gi'), ' ');
  s = s.replace(/\s+/g, ' ');                                                          // source line breaks are not line breaks
  s = s.replace(new RegExp('<\\/?(?:' + BLOCK + ')\\b[^>]*>', 'gi'), '\n');           // block boundaries become line breaks
  s = s.replace(/<[^>]*>/g, '');                                                       // the remaining (inline) tags vanish
  return decode(s).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

module.exports = { textify, title, decode };
