// reader.js — Olvasó nézet: a web page's HTML → its readable text, as plain blocks. No DOM, no markup survives: the page
// renders the blocks with textContent only, so nothing from the fetched site can run in the VRG Böngésző. Scripts, styles,
// navigation, footers, cookie banners, share bars, forms and link-heavy blocks are dropped; <article> / <main> win when
// present. Also: charset decoding (UTF-8, ISO-8859-2 / windows-1250 for Hungarian sites, Latin-1) and a Markdown → blocks
// converter for the repo's documents (the same block shape).
//   extract(html, url) → { title, site, byline, lang, excerpt, blocks: [{ t: 'h1'|'h2'|'h3'|'p'|'li'|'pre'|'quote', text }], links, words, text }
//   decode(buffer, charsetHint) → string        markdown(src, title) → { title, blocks, text, words }
'use strict';

const ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™',
  euro: '€', deg: '°', sup2: '²', sup3: '³', times: '×', middot: '·', laquo: '«', raquo: '»', bdquo: '„', rdquo: '”', ldquo: '“',
  lsquo: '‘', rsquo: '’', sbquo: '‚', bull: '•', frac12: '½', frac14: '¼', plusmn: '±', micro: 'µ', ohm: 'Ω', Omega: 'Ω', phi: 'φ',
  aacute: 'á', Aacute: 'Á', eacute: 'é', Eacute: 'É', iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó', ouml: 'ö', Ouml: 'Ö',
  odblac: 'ő', Odblac: 'Ő', uacute: 'ú', Uacute: 'Ú', uuml: 'ü', Uuml: 'Ü', udblac: 'ű', Udblac: 'Ű', auml: 'ä', Auml: 'Ä',
  szlig: 'ß', ccedil: 'ç', agrave: 'à', egrave: 'è', ecirc: 'ê', ocirc: 'ô', shy: '', zwj: '', zwnj: '', lrm: '', rlm: '', thinsp: ' ', ensp: ' ', emsp: ' ',
};
function entities(s) {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,10});?/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }
    return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : m;
  });
}

function decode(buf, hint) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf || ''));
  let cs = String(hint || '').toLowerCase();
  if (!cs) {
    const head = b.slice(0, 2048).toString('latin1');
    const m = /<meta[^>]+charset=["']?\s*([\w-]+)/i.exec(head);
    if (m) cs = m[1].toLowerCase();
  }
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) cs = 'utf-8';
  const alias = { latin2: 'iso-8859-2', 'iso8859-2': 'iso-8859-2', cp1250: 'windows-1250', latin1: 'windows-1252', 'iso-8859-1': 'windows-1252', 'us-ascii': 'utf-8', utf8: 'utf-8' };
  cs = alias[cs] || cs || 'utf-8';
  try { return new TextDecoder(cs, { fatal: false }).decode(b); } catch (e) { return new TextDecoder('utf-8').decode(b); }
}

const DROP = new Set(['script', 'style', 'noscript', 'svg', 'template', 'iframe', 'object', 'embed', 'canvas', 'form', 'button', 'select',
  'textarea', 'nav', 'footer', 'aside', 'header', 'menu', 'dialog', 'video', 'audio', 'map', 'math']);
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
const BLOCK = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h3', h5: 'h3', h6: 'h3', p: 'p', li: 'li', pre: 'pre', blockquote: 'quote', dt: 'p', dd: 'p',
  figcaption: 'p', caption: 'p', div: 'p', section: 'p', article: 'p', main: 'p', tr: 'row', summary: 'p', address: 'p' };
const NOISE = /(^|[\s_-])(nav|navbar|menu|footer|header|sidebar|side-bar|cookie|consent|gdpr|banner|share|social|sharing|comment|comments|related|recommend|breadcrumb|breadcrumbs|pagination|pager|newsletter|subscribe|promo|advert|ads?|sponsor|popup|modal|toolbar|skip|login|signup|search)([\s_-]|$)/i;

// a forgiving tokenizer: tags (with attributes as a lower-cased string) and text
function* tokenize(html) {
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+|<)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) { yield { k: 'text', v: m[3] }; continue; }
    if (!m[1]) continue;
    const close = m[0][1] === '/';
    yield { k: close ? 'close' : 'open', tag: m[1].toLowerCase(), attrs: m[2] || '', self: /\/>$/.test(m[0]) };
  }
}
const attr = (attrs, name) => { const m = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(' ' + attrs); return m ? entities(m[1] || m[2] || m[3] || '') : ''; };
const meta = (html, re) => { const m = re.exec(html); return m ? entities(m[1]).trim() : ''; };
const squash = s => s.replace(/[\u00a0\s]+/g, ' ').trim();

// the region worth reading: the longest <article>, else <main>, else <body>, else everything
function region(html) {
  for (const tag of ['article', 'main']) {
    const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'gi');
    let best = '', m;
    while ((m = re.exec(html))) if (m[1].length > best.length) best = m[1];
    if (best.replace(/<[^>]+>/g, '').trim().length > 400) return best;
  }
  const b = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return b ? b[1] : html;
}

function blocksOf(html, base) {
  const blocks = [], links = [];
  const stack = [];                 // open elements: { tag, drop, block }
  let cur = null;                   // the block being filled: { t, text, link }
  let dropDepth = 0, inLink = 0, href = '', linkText = '';
  const flush = () => {
    if (cur) {
      if (cur.t === 'row') { cur.t = 'p'; cur.text = cur.text.replace(/^\s*·\s*/, ''); cur.row = true; }
      const text = squash(cur.t === 'pre' ? cur.raw : cur.text);
      const linkShare = text ? squash(cur.link).length / text.length : 0;
      const keep = cur.t === 'pre' ? text.length > 0 : cur.t[0] === 'h' ? text.length >= 2 : text.length >= (cur.t === 'li' || cur.row ? 3 : 25) && linkShare < 0.6;
      if (keep) blocks.push({ t: cur.t, text: cur.t === 'pre' ? cur.raw.replace(/^\n+|\s+$/g, '').slice(0, 8000) : text.slice(0, 6000) });
    }
    cur = null;
  };
  for (const tk of tokenize(html)) {
    if (tk.k === 'open') {
      if (VOID.has(tk.tag) || tk.self) {
        if (tk.tag === 'br' && cur) { cur.text += ' '; cur.raw += '\n'; }
        continue;
      }
      const cls = attr(tk.attrs, 'class') + ' ' + attr(tk.attrs, 'id') + ' ' + attr(tk.attrs, 'role');
      const hidden = /\shidden(\s|=|$)/i.test(' ' + tk.attrs) || /aria-hidden\s*=\s*["']?true/i.test(tk.attrs) || /display\s*:\s*none/i.test(attr(tk.attrs, 'style'));
      const drop = DROP.has(tk.tag) || hidden || (NOISE.test(cls) && !/^(article|main|body|p|h[1-6])$/.test(tk.tag));
      const block = !dropDepth && !drop && BLOCK[tk.tag];
      if (block && !(cur && cur.t === 'pre')) { flush(); cur = { t: block, text: '', raw: '', link: '' }; }
      if (tk.tag === 'a' && !dropDepth) { inLink++; href = attr(tk.attrs, 'href'); linkText = ''; }
      if (tk.tag === 'td' || tk.tag === 'th') { if (cur) cur.text += ' · '; }
      stack.push({ tag: tk.tag, drop, block: !!block });
      if (drop) dropDepth++;
    } else if (tk.k === 'close') {
      // close up to the matching open element (forgiving: unclosed children are closed too)
      let i = stack.length - 1;
      while (i >= 0 && stack[i].tag !== tk.tag) i--;
      if (i < 0) continue;
      while (stack.length > i) {
        const e = stack.pop();
        if (e.drop) dropDepth--;
        if (e.tag === 'a' && inLink) {
          inLink--;
          if (!dropDepth && href) { try { const u = new URL(href, base); if (/^https?:$/.test(u.protocol) && links.length < 80 && !links.some(l => l.url === u.href)) links.push({ url: u.href, text: squash(linkText).slice(0, 120) }); } catch (e2) {} }
          href = '';
        }
        if (e.block && cur && !dropDepth) flush();
      }
    } else if (!dropDepth) {
      const t = entities(tk.v);
      if (!cur) cur = { t: 'p', text: '', raw: '', link: '' };
      cur.text += t; cur.raw += t;
      if (inLink) { cur.link += t; linkText += t; }
    }
  }
  flush();
  // de-duplicate consecutive repeats (sticky headers repeated in the markup)
  return { blocks: blocks.filter((b, i) => !(i && b.text === blocks[i - 1].text)), links };
}

function extract(html, url) {
  const src = String(html || '');
  const head = (/<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(src) || [, src.slice(0, 20000)])[1];
  const ogTitle = meta(head, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || meta(head, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const title = squash(ogTitle || meta(head, /<title[^>]*>([\s\S]*?)<\/title>/i) || '');
  const site = squash(meta(head, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i));
  const byline = squash(meta(head, /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)/i));
  const desc = squash(meta(head, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || meta(head, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i));
  const lang = (/<html[^>]+lang=["']?([a-zA-Z-]{2,10})/i.exec(src) || [, ''])[1].toLowerCase();
  const { blocks, links } = blocksOf(region(src), url);
  // the page title often repeats as the first heading
  if (blocks[0] && blocks[0].t[0] === 'h' && title && squash(blocks[0].text) === title) blocks.shift();
  const text = blocks.map(b => b.text).join('\n');
  const words = text ? text.split(/\s+/).length : 0;
  const excerpt = (desc || (blocks.find(b => b.t === 'p') || {}).text || '').slice(0, 300);
  return { title: title.slice(0, 300), site: site.slice(0, 120), byline: byline.slice(0, 120), lang, excerpt, blocks: blocks.slice(0, 1500), links, words, text: text.slice(0, 200000) };
}

// the repo's Markdown documents → the same blocks (headings, paragraphs, list items, code, quotes, table rows)
function markdown(src, fallbackTitle) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [], code = null, title = '';
  const inline = s => s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1$2').replace(/<[^>]+>/g, '');
  const endPara = () => { if (para.length) { const t = squash(inline(para.join(' '))); if (t) blocks.push({ t: 'p', text: t }); para = []; } };
  for (const line of lines) {
    if (code) { if (/^\s*(```|~~~)/.test(line)) { blocks.push({ t: 'pre', text: code.join('\n').slice(0, 8000) }); code = null; } else code.push(line); continue; }
    if (/^\s*(```|~~~)/.test(line)) { endPara(); code = []; continue; }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { endPara(); const t = squash(inline(h[2])); if (!title && h[1].length === 1) { title = t; continue; } blocks.push({ t: h[1].length === 1 ? 'h1' : h[1].length === 2 ? 'h2' : 'h3', text: t }); continue; }
    const li = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) { endPara(); blocks.push({ t: 'li', text: squash(inline(li[1].replace(/^\[[ xX]\]\s*/, ''))) }); continue; }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) { endPara(); if (q[1].trim()) blocks.push({ t: 'quote', text: squash(inline(q[1])) }); continue; }
    if (/^\s*\|/.test(line)) { endPara(); if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue; blocks.push({ t: 'p', text: squash(inline(line.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim()).join(' · '))) }); continue; }
    if (!line.trim() || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { endPara(); continue; }
    para.push(line.trim());
  }
  if (code) blocks.push({ t: 'pre', text: code.join('\n') });
  endPara();
  const text = blocks.map(b => b.text).join('\n');
  return { title: title || fallbackTitle || '', blocks: blocks.slice(0, 3000), text, words: text ? text.split(/\s+/).length : 0 };
}

module.exports = { extract, decode, markdown, entities, tokenize };
