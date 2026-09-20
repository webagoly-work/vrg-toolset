const fs = require('fs'), zlib = require('zlib');
const MAP = { '0118': 'ő', '0126': 'ű' };
const ESC = { n: '\n', r: '\r', t: '\t', b: '', f: '' };
function streams(file) {
  const s = fs.readFileSync(file).toString('latin1');
  const re = /stream\r?\n/g; let m; const out = [];
  while ((m = re.exec(s))) {
    const st = m.index + m[0].length;
    const e = s.indexOf('endstream', st);
    if (e < 0) continue;
    let d; try { d = zlib.inflateSync(Buffer.from(s.slice(st, e), 'latin1')); } catch (x) { continue; }
    const t = d.toString('latin1');
    if (/\bTd\b/.test(t) && /\bTj\b/.test(t)) out.push(t);
  }
  return out;
}
function unesc(v) {
  return v.replace(/\\([0-7]{1,3})/g, (mm, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\(.)/g, (mm, c) => (ESC[c] !== undefined ? ESC[c] : c));
}
function parsePages(file) {
  const pages = [];
  for (const c of streams(file)) {
    const frags = []; let cur = null;
    const tok = /BT|ET|([-\d.]+)\s+([-\d.]+)\s+Td|\((?:\\.|[^\\()])*\)\s*Tj|<([0-9A-Fa-f]+)>\s*Tj/g;
    let m;
    while ((m = tok.exec(c))) {
      const v = m[0];
      if (v === 'BT') cur = null;
      else if (v === 'ET') { if (cur) { frags.push(cur); cur = null; } }
      else if (m[1] !== undefined) { if (cur) frags.push(cur); cur = { x: +m[1], y: +m[2], text: '' }; }
      else if (m[3] !== undefined) { if (cur) cur.text += (MAP[m[3]] || ''); }
      else { if (cur) cur.text += unesc(v.slice(v.indexOf('(') + 1, v.lastIndexOf(')'))); }
    }
    if (cur) frags.push(cur);
    pages.push(frags);
  }
  return pages;
}
function lines(frags) {
  const rows = new Map();
  for (const f of frags) {
    const key = Math.round(f.y * 2) / 2;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(f);
  }
  return [...rows.keys()].sort((a, b) => b - a)
    .map(y => ({ y, cells: rows.get(y).sort((a, b) => a.x - b.x) }));
}
const NUM = /^[\d\s]+(?:,\d+)?$/;
function extract(file) {
  const pages = parsePages(file);
  const items = []; let cur = null; const meta = { file };
  let descX = null, hasList = false;
  for (const frags of pages) {
    for (const ln of lines(frags)) {
      const c = ln.cells;
      const joined = c.map(z => z.text.trim()).join(' | ');
      const first = (c[0] && c[0].text || '').trim();
      if (/Saját cikkszám/.test(joined)) {
        descX = Math.round(c.find(z => /Saját cikkszám/.test(z.text)).x);
        hasList = /Listaár/.test(joined);
        continue;
      }
      if (/Ajánlat szám|Rendelésszám/.test(joined)) {
        const j = c.map(z => z.text.trim());
        const i = j.findIndex(z => /Ajánlat szám|Rendelésszám/.test(z));
        if (j[i + 1]) meta.orderNo = j[i + 1];
      }
      if (/^Dátum:|Rendelés dátuma/.test(first)) {
        const d = c.map(z => z.text.trim()).find(z => /^\d{4}\.\d{2}\.\d{2}$/.test(z));
        if (d && !meta.date) meta.date = d;
      }
      if (/^Ajánlat$|^Megrendelés visszaigazolás$/.test(first) && !meta.docType) meta.docType = first;
      if (/^\d+\.$/.test(first) && c.length >= 5 && descX !== null) {
        if (cur) items.push(cur);
        const v = c.slice(1).map(z => z.text.trim()).filter(z => z !== '' && z !== '%');
        cur = hasList
          ? { no: +first, cikkszam: v[0] || '', mennyiseg: v[1] || '', egyseg: v[2] || '', listaar: v[3] || '', engedmeny_szazalek: v[4] || '', netto_egysegar: v[5] || '', netto_ertek: (v[6] || '').replace(/\s*Ft$/, ''), nev: '' }
          : { no: +first, cikkszam: v[0] || '', mennyiseg: v[1] || '', egyseg: v[2] || '', listaar: '', engedmeny_szazalek: '', netto_egysegar: v[3] || '', netto_ertek: (v[4] || '').replace(/\s*Ft$/, ''), nev: '' };
        continue;
      }
      if (cur && c.length === 1 && descX !== null && Math.abs(c[0].x - descX) < 8) {
        const t = c[0].text.trim();
        if (t) cur.nev += (cur.nev ? ' ' : '') + t;
      }
    }
  }
  if (cur) items.push(cur);
  if (!meta.date) {                       // fallback: first YYYY.MM.DD anywhere on page 1
    for (const f of pages[0] || []) {
      const m = f.text.match(/\d{4}\.\d{2}\.\d{2}/);
      if (m) { meta.date = m[0]; break; }
    }
  }
  return { meta, items };
}
console.log(JSON.stringify(process.argv.slice(2).map(extract), null, 1));
