// mime.js — a small RFC 5322 / 2045 parser for the mail client (WP-27). Pure: bytes in, plain object out.
//   parse(buf|string) → { headers, text, html, attachments:[{ att, name, size, type }] }
//   headers: lower-case name → decoded value (RFC 2047 words decoded, first occurrence wins)
//   html is returned raw: the pane sanitizes it (WP-28). Attachment bytes: non-enumerable `data` (Buffer) on each entry.
//   decodeWords(s) → string      RFC 2047 encoded words (UTF-8, ISO-8859-2, any charset TextDecoder knows)
'use strict';

const MAX_DEPTH = 10;

function decodeCharset(buf, charset) {
  const cs = String(charset || 'utf-8').trim().replace(/^"|"$/g, '').toLowerCase();
  try { return new TextDecoder(cs === 'us-ascii' ? 'utf-8' : cs).decode(buf); } catch (e) { return Buffer.from(buf).toString('latin1'); }
}

// bytes of a quoted-printable string (the string is latin1: one char = one byte)
function qpBytes(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
    else out.push(s.charCodeAt(i) & 255);
  }
  return Buffer.from(out);
}
const qpBody = s => qpBytes(s.replace(/[ \t]+(\r?\n)/g, '$1').replace(/=\r?\n/g, ''));

function decodeWords(s) {
  if (typeof s !== 'string' || !s.includes('=?')) return s;
  const joined = s.replace(/(=\?[^?\s]+\?[bBqQ]\?[^?\s]*\?=)\s+(?==\?[^?\s]+\?[bBqQ]\?)/g, '$1');    // blanks between two words vanish
  return joined.replace(/=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g, (all, cs, enc, text) => {
    const charset = cs.split('*')[0];
    const bytes = enc.toLowerCase() === 'b' ? Buffer.from(text, 'base64') : qpBytes(text.replace(/_/g, ' '));
    return decodeCharset(bytes, charset);
  });
}

// header text arrives as a latin1 string (one char per byte): raw 8-bit values are UTF-8 in practice, else latin1
function rawToUnicode(v) {
  if (!/[\x80-\xff]/.test(v)) return v;
  const b = Buffer.from(v, 'latin1');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return v; }
}

function splitHeadBody(s) {
  if (/^\r?\n/.test(s)) return { head: '', body: s.replace(/^\r?\n/, '') };
  const m = /\r?\n\r?\n/.exec(s);
  return m ? { head: s.slice(0, m.index), body: s.slice(m.index + m[0].length) } : { head: s, body: '' };
}

function parseHeaders(head) {
  const map = Object.create(null);
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const name = line.slice(0, i).trim().toLowerCase();
    if (!(name in map)) map[name] = line.slice(i + 1).trim();
  }
  return map;
}

// "type/sub; a=b; c*=utf-8''%C3%A9; d*0=…" → { value, params } (RFC 2045 parameters, RFC 2231 extensions)
function structured(v) {
  const parts = []; let cur = '', q = false;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === '"') q = !q;
    if (c === '\\' && q && i + 1 < v.length) { cur += c + v[++i]; continue; }
    if (c === ';' && !q) { parts.push(cur); cur = ''; } else cur += c;
  }
  parts.push(cur);
  const value = parts.shift().trim().toLowerCase();
  const plain = Object.create(null), ext = Object.create(null);
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i < 1) continue;
    const key = p.slice(0, i).trim().toLowerCase();
    let val = p.slice(i + 1).trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) val = val.slice(1, -1).replace(/\\(.)/g, '$1');
    const m = /^(.+?)\*(?:(\d+)(\*)?)?$/.exec(key);
    if (!m) { plain[key] = val; continue; }
    (ext[m[1]] = ext[m[1]] || []).push({ n: m[2] === undefined ? 0 : Number(m[2]), star: m[2] === undefined || !!m[3], val });
  }
  const params = Object.assign(Object.create(null), plain);
  for (const base of Object.keys(ext)) {
    const segs = ext[base].sort((a, b) => a.n - b.n);
    let charset = 'utf-8', bytes = '';
    segs.forEach((sg, k) => {
      let val = sg.val;
      if (sg.star) {
        if (k === 0) { const m = /^([^']*)'[^']*'([\s\S]*)$/.exec(val); if (m) { charset = m[1] || 'utf-8'; val = m[2]; } }
        bytes += val.replace(/%([0-9A-Fa-f]{2})/g, (a, h) => String.fromCharCode(parseInt(h, 16)));
      } else bytes += Buffer.from(val, 'utf8').toString('latin1');
    });
    params[base] = decodeCharset(Buffer.from(bytes, 'latin1'), charset);
  }
  for (const k of Object.keys(params)) params[k] = decodeWords(rawToUnicode(params[k]));
  return { value, params };
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function leafBytes(body, cte) {
  cte = String(cte || '').trim().toLowerCase();
  if (cte === 'base64') return Buffer.from(body.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  if (cte === 'quoted-printable') return qpBody(body);
  return Buffer.from(body, 'latin1');
}

function walk(raw, out, depth) {
  const { head, body } = splitHeadBody(raw);
  const h = parseHeaders(head);
  const ct = structured(h['content-type'] || 'text/plain');
  if (depth === 0) for (const k of Object.keys(h)) out.headers[k] = decodeWords(rawToUnicode(h[k]));
  if (ct.value.startsWith('multipart/') && ct.params.boundary && depth < MAX_DEPTH) {
    const re = new RegExp('(?:^|\\r?\\n)--' + esc(ct.params.boundary) + '(--)?[ \\t]*(?:\\r?\\n|$)', 'g');
    let m, last = -1, closed = false;
    const parts = [];
    while ((m = re.exec(body))) {
      if (last >= 0) parts.push(body.slice(last, m.index));
      last = re.lastIndex;
      if (m[1]) { closed = true; break; }
    }
    if (last >= 0 && !closed) parts.push(body.slice(last));
    for (const p of parts) walk(p, out, depth + 1);
    return;
  }
  const cd = structured(h['content-disposition'] || '');
  const name = cd.params.filename || ct.params.name || '';
  const bytes = leafBytes(body, h['content-transfer-encoding']);
  const isText = ct.value === 'text/plain' || ct.value === 'text/html';
  if (name || cd.value === 'attachment' || !isText) {
    out.n++;
    const a = { att: 'a' + out.n, name: name || 'part-' + out.n, size: bytes.length, type: ct.value };
    Object.defineProperty(a, 'data', { value: bytes, enumerable: false });
    out.attachments.push(a);
    return;
  }
  const s = decodeCharset(bytes, ct.params.charset);
  if (ct.value === 'text/html') out.html += out.html ? '\n' + s : s;
  else out.text += out.text ? '\n' + s : s;
}

function parse(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  const out = { headers: Object.create(null), text: '', html: '', attachments: [], n: 0 };
  walk(buf.toString('latin1'), out, 0);
  return { headers: Object.assign({}, out.headers), text: out.text, html: out.html, attachments: out.attachments };
}

module.exports = { parse, decodeWords, decodeCharset };
