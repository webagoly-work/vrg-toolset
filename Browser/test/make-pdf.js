// make-pdf.js — a tiny valid PDF for the reader tests (INVENTED text): pages of lines in Helvetica, WinAnsi (Latin-1 accents),
// with a correct xref table. makePdf([['Title line', 'line 2'], ['page 2']], { title }) → Buffer
'use strict';
function esc(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function makePdf(pages, o) {
  const opt = o || {};
  const objs = [];                                   // [n, body]
  const add = body => { objs.push(body); return objs.length; };
  const catalog = add(null), pagesObj = add(null), font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const lines of pages) {
    let y = 760, stream = 'BT /F1 12 Tf\n';
    for (const l of lines) {
      if (l === '') { y -= 30; continue; }
      stream += '1 0 0 1 72 ' + y + ' Tm (' + esc(l) + ') Tj\n';
      y -= 16;
    }
    stream += 'ET';
    const content = add('<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream');
    kids.push(add('<< /Type /Page /Parent ' + pagesObj + ' 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ' + font + ' 0 R >> >> /Contents ' + content + ' 0 R >>'));
  }
  objs[catalog - 1] = '<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>';
  objs[pagesObj - 1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
  const info = opt.title ? add('<< /Title (' + esc(opt.title) + ') >>') : 0;
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((b, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + b + '\nendobj\n'; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o2 => String(o2).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R' + (info ? ' /Info ' + info + ' 0 R' : '') + ' >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
module.exports = { makePdf };
