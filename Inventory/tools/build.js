const fs = require('fs'), path = require('path');
const { parseEml } = require('./eml.js');
const { RAW, CACHE, PDFITEMS } = require('./paths.js');
const DIR = RAW;
const ENT = { aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ouml: 'ö', uuml: 'ü', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ouml: 'Ö', Uuml: 'Ü', otilde: 'ő', utilde: 'ű', Otilde: 'Ő', Utilde: 'Ű', nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"' };
const unent = s => s.replace(/&([a-zA-Z]+);/g, (m, n) => (ENT[n] !== undefined ? ENT[n] : m)).replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d));
const txt = h => unent(h.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const num = s => {
  if (!s) return null;
  const t = String(s).replace(/\s|\u00a0/g, '').replace(/Ft$/i, '').replace(/,/, '.');
  const v = parseFloat(t);
  return isNaN(v) ? null : v;
};

// ---------- emails ----------
const emails = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.toLowerCase().endsWith('.eml')) continue;
  const r = parseEml(path.join(DIR, f));
  const html = r.html;
  const h3 = txt((html.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || '');
  let type = 'egyeb';
  if (/^Rendelés visszaigazolás/.test(h3)) type = 'visszaigazolas';
  else if (/^FIGYELEM/.test(h3)) type = 'modositas';
  else if (/megérkezett/i.test(r.subject)) type = 'beerkezes';
  let orderNo = (h3.match(/\(([^)]+)\)/) || [])[1] || '';
  if (!orderNo) orderNo = (txt(html).match(/Megrendelés száma:\s*(\S+)/) || [])[1] || '';
  let kelt = '';
  const km = html.match(/Kelt<\/td>[\s\S]*?<tr>([\s\S]*?)<\/tr>/);
  if (km) kelt = ([...km[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => txt(x[1])))[2] || '';
  if (!kelt) kelt = (txt(html).match(/Rendelés Dátuma:\s*([\d.]+)/) || [])[1] || '';
  const hiv = (txt(html).match(/Hivatkozás:\s*([^\s].*?)\s+(?:Rögzítette|$)/) || [])[1] || '';
  const items = [...html.matchAll(/<tr height="18px"[^>]*>([\s\S]*?)<\/tr>/g)].map(m => {
    const t = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => txt(x[1]));
    const base = { cikkszam: t[0] || '', nev: (t[1] || '').replace(/^\(\s*\)\s*/, '').trim() };
    if (type === 'beerkezes') return { ...base, egyseg: t[2] || '', mennyiseg: t[3] || '' };
    return { ...base, kiszereles: t[2] || '', mennyiseg: t[3] || '', netto_egysegar: num(t[5]), netto_ertek: num(t[6]), brutto_ertek: num(t[7]) };
  }).filter(i => i.cikkszam);
  emails.push({ file: f, type, subject: r.subject, mailDate: r.date, orderNo, kelt, hivatkozas: hiv, items });
}

// ---------- pdfs ----------
const pdfs = JSON.parse(fs.readFileSync(PDFITEMS, 'utf8'));

// ---------- xlsx / freeform cikkszám mentions ----------
const XLSX_HINTS = JSON.parse(fs.readFileSync(__dirname + '/hints.json', 'utf8'));

// ---------- merge ----------
const items = new Map();
const get = c => {
  if (!items.has(c)) items.set(c, {
    daniella_cikkszam: c, names: new Set(), units: new Set(), packs: new Set(),
    price_history: [], listaar: null, engedmeny: null, orders: new Set(), sources: new Set()
  });
  return items.get(c);
};
for (const e of emails) {
  for (const i of e.items) {
    const it = get(i.cikkszam);
    it.sources.add('email:' + e.type);
    if (i.nev) it.names.add(i.nev);
    if (i.kiszereles) it.packs.add(i.kiszereles);
    if (i.egyseg) it.units.add(i.egyseg);
    if (e.orderNo) it.orders.add(e.orderNo);
    if (i.netto_egysegar != null && e.type !== 'beerkezes') {
      it.price_history.push({ date: e.kelt || e.mailDate, order: e.orderNo, netto_egysegar: i.netto_egysegar, src: e.type });
    }
  }
}
for (const p of pdfs) {
  for (const i of p.items) {
    const it = get(i.cikkszam);
    it.sources.add('pdf:' + (p.meta.docType || '?'));
    const nev = (i.nev || '').replace(/\s*Hivatkozás:.*$/, '').replace(/\s+/g, ' ').trim();
    if (nev) it.names.add(nev);
    if (i.egyseg) it.units.add(i.egyseg);
    if (p.meta.orderNo) it.orders.add(p.meta.orderNo);
    const l = num(i.listaar), n = num(i.netto_egysegar);
    if (l != null && i.engedmeny_szazalek) { it.listaar = l; it.engedmeny = i.engedmeny_szazalek; }
    if (n != null) it.price_history.push({ date: p.meta.date, order: p.meta.orderNo, netto_egysegar: n, src: 'pdf' });
  }
}
for (const h of XLSX_HINTS) {
  const it = get(h.cikkszam);
  it.sources.add('xlsx/mail:' + h.src);
  if (h.nev) it.names.add(h.nev);
}

const out = [...items.values()].map(i => {
  i.price_history.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const names = [...i.names];
  return {
    daniella_cikkszam: i.daniella_cikkszam,
    name_variants: names,
    best_name: names.sort((a, b) => b.length - a.length)[0] || '',
    units: [...i.units], packs: [...i.packs],
    listaar_netto: i.listaar, engedmeny_szazalek: i.engedmeny,
    last_netto_egysegar: i.price_history.length ? i.price_history[i.price_history.length - 1].netto_egysegar : null,
    price_history: i.price_history,
    orders: [...i.orders], sources: [...i.sources]
  };
}).sort((a, b) => a.daniella_cikkszam.localeCompare(b.daniella_cikkszam));

fs.writeFileSync(CACHE + '/master.json', JSON.stringify(out, null, 1));
fs.writeFileSync(CACHE + '/emails.json', JSON.stringify(emails, null, 1));
console.log('items:', out.length, '| emails:', emails.length, '| with price:', out.filter(x => x.last_netto_egysegar != null).length, '| with listaar:', out.filter(x => x.listaar_netto != null).length);
