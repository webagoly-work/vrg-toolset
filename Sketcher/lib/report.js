// Sketcher/lib/report.js — the Felmérési jegyzőkönyv (WP M50, F5): one printable Hungarian document of a field survey.
//
// The Desktop Sketcher page builds it from the open survey at run time (nothing of it is stored or committed: the
// client's data stays in the user's file); the browser's print dialog makes the PDF. It is the takeoff
// (Sketcher/lib/takeoff.js: scope, work items, decisions, questions, notes, rooms with their wants) plus what only the
// page has: the photos it was given (object URLs, never saved), the drawing and the site as SVG, the client's contact.
//
// Style: Varler Papír (shared/varler-doc/varler-doc.css, docs/research/2026-11-06_varler-document-style.md): warm ink,
// no area darker than the wash, one red accent (here: ⚑ open / Tisztázandó), hanging section numerals, hairline tables,
// Bahnschrift for figures. Unlike the Költségvetési Tervezet the length is not known in advance, so the browser
// paginates (A4, 14 mm margins, no fixed footers to overlap: D-81), sections and photos never split.
//
//   const R = require('./report.js');   // or window.VRGReport in the page
//   const m = R.model(kit, survey, takeoff, { now, roomName, photoUrl, planSvg, siteSvg, siteLines });
//   const html = R.html(m);              // a whole document: open it in a window and print
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRGReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = x => { const r = Math.round((+x || 0) * 10) / 10; return String(r).replace('.', ','); };
  const pad2 = n => String(n).padStart(2, '0');
  // a date in the Hungarian form, without the locale tables (Node and every browser give the same)
  const day = at => { if (typeof at !== 'number' || !(at > 1e11)) return ''; const d = new Date(at); return d.getFullYear() + '. ' + pad2(d.getMonth() + 1) + '. ' + pad2(d.getDate()) + '.'; };
  const time = at => { if (typeof at !== 'number' || !(at > 1e11)) return ''; const d = new Date(at); return day(at) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

  // ---- the model: everything the document shows, already in words -----------------------------------------------
  function model(kit, s, t, o) {
    o = o || {};
    const roomName = o.roomName || (id => id || ''), photoUrl = o.photoUrl || (() => null);
    const caps = (s && s.captures) || [];
    const purposes = (kit && kit.purposes) || [];
    const pLabel = id => purposes.find(p => p.id === id) || { id, label: id, sym: '◉', color: '#888' };
    const shot = c => ({ id: c.id, kind: c.kind || 'photo', url: photoUrl(c), caption: c.note || '', at: time(c.at), room: c.room ? roomName(c.room) : '',
      phase: c.phase || '', pair: c.pair || '', signer: c.signer || '', durationMs: c.durationMs || 0, privacy: !!c.privacy });
    // photos by purpose, in the kit's order; a video is listed, not shown; a signature has its own section; audio too
    const photos = [], seen = new Set();
    purposes.concat(caps.map(c => pLabel(c.purpose || 'egyeb'))).forEach(p => {
      if (seen.has(p.id)) return; seen.add(p.id);
      const list = caps.filter(c => (c.purpose || 'egyeb') === p.id && c.kind !== 'signature' && c.kind !== 'audio');
      if (list.length) photos.push({ id: p.id, label: p.label, sym: p.sym, color: p.color, items: list.map(shot) });
    });
    const signatures = caps.filter(c => c.kind === 'signature').map(shot);
    const audio = caps.filter(c => c.kind === 'audio').map(shot);
    const site = (s && s.site) || {};
    const cl = s && s.client && typeof s.client === 'object' ? s.client : null;
    const client = cl && (cl.name || cl.phone || cl.email) ? { name: cl.name || '', phone: cl.phone || '', email: cl.email || '', address: site.address || '' } : null;
    const tq = (t && t.questions) || [];
    return {
      title: 'Felmérési jegyzőkönyv',
      name: (s && s.name) || (t && t.source && t.source.name) || 'Felmérés',
      id: (s && s.id) || '',
      date: day(o.now || Date.now()),
      surveyed: day(firstAt(s)),
      address: site.address || '',
      client,
      variant: (t && t.source && t.source.variant) || '',
      counts: (t && t.counts) || {},
      scope: (t && t.scope) || [],
      items: (t && t.items) || [],
      decisions: (t && t.decisions) || [],
      checks: (t && t.checks) || [],
      answered: tq.filter(q => q.state === 'answered'),
      open: tq.filter(q => q.state !== 'answered'),
      notes: (t && t.notes) || [],
      memos: (t && t.memos) || [],
      rooms: (t && t.rooms) || [],
      photos, signatures, audio,
      planSvg: o.planSvg || '',
      site: { address: site.address || '', lat: num(site.lat), lon: num(site.lon), footprint: site.footprint || null, svg: o.siteSvg || '', lines: o.siteLines || [] },
    };
  }
  const num = x => typeof x === 'number' && isFinite(x) ? x : null;
  function firstAt(s) {
    let a = Infinity;
    if (!s) return 0;
    (s.entries || []).forEach(e => { if (e.at > 1e11 && e.at < a) a = e.at; });
    (s.captures || []).forEach(c => { if (c.at > 1e11 && c.at < a) a = c.at; });
    return isFinite(a) ? a : (s.updated > 1e11 ? s.updated : 0);
  }

  // ---- the document ---------------------------------------------------------------------------------------------
  const CSS = `
:root{--paper:#fff;--desk:#efebe5;--ink:#2f2c28;--ink-2:#6b645b;--ink-3:#9b9389;--rule:#d9d3ca;--rule-2:#ebe6de;--wash:#f5f2ed;--taupe:#b8ad9e;--vez:#b5452f;
  --serif:"Sitka Banner","Sitka Display","Sitka Heading",Constantia,Georgia,serif;--serif-t:"Sitka Text","Sitka Small",Constantia,Georgia,serif;
  --sans:Bahnschrift,"DIN Alternate","Segoe UI",Arial,sans-serif}
@page{size:A4;margin:14mm 14mm 14mm 22mm}
*{box-sizing:border-box}
html{background:var(--desk)}
body{margin:0;font:400 9.2pt/1.5 var(--sans);color:var(--ink);font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}
b{font-weight:600}
.lap{width:210mm;margin:10mm auto;background:var(--paper);padding:14mm 14mm 16mm 22mm;box-shadow:0 1px 2px rgba(60,50,40,.08)}
.bar{position:sticky;top:0;display:flex;gap:8px;justify-content:center;padding:8px;background:var(--desk);z-index:2}
.bar button{font:inherit;padding:6px 14px;border:.5pt solid var(--ink-2);background:var(--paper);color:var(--ink);border-radius:3px;cursor:pointer}
@media print{html{background:none}.lap{margin:0;padding:0;width:auto;box-shadow:none}.bar{display:none}}
.fej{display:grid;grid-template-columns:1fr auto;align-items:end;gap:6mm;margin-bottom:6mm}
.cim{position:relative;margin:0;font:400 21pt/1 var(--serif);letter-spacing:.14em;text-transform:uppercase}
.cim::before{content:"";position:absolute;right:calc(100% + 4mm);top:55%;width:18mm;border-top:.25pt solid var(--ink-2)}
.cim::after{content:"";position:absolute;right:calc(100% + 3.2mm);top:calc(55% - 1.1pt);width:2.6pt;height:2.6pt;border-radius:50%;background:var(--paper);box-shadow:0 0 0 .5pt var(--ink-2)}
.alcim{margin:3mm 0 0;font:italic 400 10pt/1.3 var(--serif-t);color:var(--ink-2)}
.kelt{font-size:7.6pt;letter-spacing:.06em;color:var(--ink-3);text-align:right}
.meta{display:grid;grid-template-columns:repeat(4,1fr);border-top:.4pt solid var(--ink-2);margin:0 0 6mm;padding:0}
.meta>div{padding:2mm 3mm 2.2mm 0;border-bottom:.25pt solid var(--rule)}
.meta>div.w2{grid-column:span 2}.meta>div.w4{grid-column:span 4}
.lbl{display:block;font-size:6.6pt;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin:0 0 .6mm}
.szak{break-inside:auto}
.sz{position:relative;margin:7mm 0 3mm;padding-bottom:1.6mm;border-bottom:.25pt solid var(--rule);break-after:avoid}
.sz h2{margin:0;font:400 10.5pt/1.2 var(--sans);font-weight:500;letter-spacing:.16em;text-transform:uppercase}
.sz .n{position:absolute;right:calc(100% + 5mm);top:-2.2mm;font:400 20pt/1 var(--serif);color:var(--taupe)}
h3{margin:4mm 0 1.5mm;font:italic 400 10pt/1.2 var(--serif-t);break-after:avoid}
p{margin:0 0 2mm}.halk{color:var(--ink-2)}.apro{font-size:7.6pt;color:var(--ink-3)}
table{width:100%;border-collapse:collapse}
th{font-size:6.6pt;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);text-align:left;padding:1.6mm 2mm 1.4mm;background:var(--wash);border-bottom:.4pt solid var(--ink-2)}
td{padding:1.3mm 2mm;border-bottom:.25pt solid var(--rule-2);vertical-align:top}
tr{break-inside:avoid}
td.n,th.n{text-align:right;white-space:nowrap}td.i{width:7mm;color:var(--ink-3)}
.keep td{color:var(--ink-3)}
.vez{color:var(--vez)}
ul.lista{margin:0;padding:0;list-style:none}ul.lista li{padding:1.1mm 0;border-bottom:.25pt solid var(--rule-2);break-inside:avoid}
.chip{display:inline-block;margin-left:1.5mm;padding:0 1.6mm;border:.25pt solid var(--rule);border-radius:2mm;font-size:7.4pt;color:var(--ink-2)}
.fotok{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
figure{margin:0;break-inside:avoid}
figure img{display:block;width:100%;height:42mm;object-fit:cover;border:.25pt solid var(--rule)}
figure .nincs{display:flex;align-items:center;justify-content:center;height:42mm;background:var(--wash);color:var(--ink-3);font-size:7.6pt}
figcaption{margin-top:1mm;font-size:7.6pt;color:var(--ink-2)}
.alairas{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm}
.alairas img{width:100%;max-height:34mm;object-fit:contain;border-bottom:.4pt solid var(--ink-2)}
.rajz svg{display:block;width:100%;max-height:120mm}#helyszinrajz svg{max-height:80mm}
.rajz svg *{vector-effect:non-scaling-stroke}
#nyitott{columns:2;column-gap:8mm}#nyitott li{break-inside:avoid}
.rajz svg .fl{fill:#f5f2ed;stroke:none}.rajz svg .edge{stroke:#6b645b;stroke-width:1.2px;fill:none}.rajz svg .est{stroke:#b8ad9e;stroke-dasharray:6 4;stroke-width:1.2px}
.rajz svg .lbl{fill:#2f2c28;text-anchor:middle;font-family:var(--sans)}.rajz svg .lbl.e{fill:#9b9389}
.rajz svg .dev.tervezett{fill:#b5452f}.rajz svg .dev.meglevo{fill:#6b645b}.rajz svg .wedge{fill:none;stroke:none}
.rajz svg .so{fill:#f5f2ed;stroke:#6b645b;stroke-width:1.6px}.rajz svg .sp{fill:none;stroke:#b5452f;stroke-width:1.2px}.rajz svg .sb{stroke:#2f2c28;stroke-width:2.4px}
.rajz svg text{fill:#6b645b}
.lab{margin-top:10mm;font-size:7.4pt;color:var(--ink-3);border-top:.25pt solid var(--rule);padding-top:2mm}
`;

  function html(m) {
    let n = 0;
    const sec = (title, body, sub) => body ? '<section class="szak"><div class="sz"><span class="n">' + (++n) + '</span><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + body + '</section>' : '';
    const flags = it => (it.est ? '≈' : '') + ((it.open || []).length ? ' <span class="vez" title="nyitott döntés">⚑</span>' : '');
    let h = '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(m.title + ' — ' + m.name) + '</title><style>' + CSS + '</style></head><body>' +
      '<div class="bar"><button onclick="window.print()">Nyomtatás / PDF</button></div><div class="lap" id="jk">';
    h += '<header class="fej"><div><h1 class="cim">' + esc(m.title) + '</h1><p class="alcim">' + esc(m.name) + (m.address && m.address !== m.name ? ' · ' + esc(m.address) : '') + '</p></div>' +
      '<div class="kelt">Kelt: ' + esc(m.date) + (m.id ? '<br>' + esc(m.id) : '') + '</div></header>';
    const c = m.counts || {};
    h += '<dl class="meta">' +
      '<div class="w2"><span class="lbl">Helyszín</span>' + esc(m.address || '—') + '</div>' +
      '<div><span class="lbl">Felmérés napja</span>' + esc(m.surveyed || m.date) + '</div>' +
      '<div><span class="lbl">Változat</span>' + esc(m.variant || 'eredeti') + '</div>' +
      (m.client ? '<div class="w2" id="ugyfel"><span class="lbl">Ügyfél</span>' + esc(m.client.name || '—') + '</div>' +
        '<div><span class="lbl">Telefon</span>' + esc(m.client.phone || '—') + '</div><div><span class="lbl">E-mail</span>' + esc(m.client.email || '—') + '</div>' : '') +
      '<div><span class="lbl">Helyiségek</span>' + (c.rooms || 0) + (c.areaM2 ? ' · ' + fmt(c.areaM2) + ' m²' : '') + '</div>' +
      '<div><span class="lbl">Tételek</span>' + (c.items || 0) + (c.est ? ' (≈ ' + c.est + ')' : '') + '</div>' +
      '<div><span class="lbl">Kérdések</span>' + (c.answered || 0) + ' megválaszolva · ' + (c.questionsOpen || 0) + ' nyitott</div>' +
      '<div><span class="lbl">Fotók</span>' + (c.photos || 0) + '</div></dl>';

    // 1 the job
    h += sec('A munka', m.scope.length ? '<table id="munkakor"><tbody>' + m.scope.map(g => '<tr><td style="width:30%" class="halk">' + esc(g.label) + '</td><td>' +
      g.items.map(i => esc(i.sym + ' ' + i.label) + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ') + '</td></tr>').join('') + '</tbody></table>' : '<p class="halk">A munkakör még nincs kijelölve.</p>');
    // 2 the work items (the Munkakör lap)
    h += sec('Munkakör lap', m.items.length ? '<table id="tetelek"><thead><tr><th></th><th>Tétel</th><th class="n">Mennyiség</th><th></th><th>Megjegyzés</th></tr></thead><tbody>' +
      m.items.map(it => '<tr class="tetel' + (it.work === false ? ' keep' : '') + '" data-id="' + esc(it.id) + '"><td class="i">' + esc(it.sym) + '</td><td>' + esc(it.label) + '</td><td class="n"><b>' + fmt(it.qty) + '</b> ' + esc(it.unit) +
        '</td><td>' + flags(it) + '</td><td class="apro">' + esc(it.note || '') + '</td></tr>').join('') + '</tbody></table>' +
      (m.decisions.length ? '<h3>Döntésre vár</h3><ul class="lista">' + m.decisions.map(d => '<li class="vez">' + (d.state === 'later' ? '⏱ ' : '⚑ ') + esc(d.label) + '</li>').join('') + '</ul>' : '') +
      (m.checks.length ? '<h3>Ellenőrizni</h3><ul class="lista">' + m.checks.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')
      : '<p class="halk">Még nincs tétel.</p>', '≈ becsült mennyiség · ⚑ nyitott döntés változtathat rajta · a jegyzőkönyv árat nem tartalmaz.');
    // 3 the questions
    h += sec('Kérdések és válaszok', (m.answered.length ? '<table id="valaszok"><tbody>' + m.answered.map(q => '<tr><td style="width:45%">' + esc(q.label) + '</td><td>' +
      esc((q.options || []).join(', ')) + (q.text ? (q.options && q.options.length ? ' — ' : '') + '„' + esc(q.text) + '”' : '') + '</td></tr>').join('') + '</tbody></table>' : '') +
      (m.open.length ? '<h3>Nyitott kérdések</h3><ul class="lista" id="nyitott">' + m.open.map(q => '<li>' + (q.state === 'later' ? '⏱ ' : q.state === 'skip' ? '⊘ ' : '○ ') + esc(q.label) + '</li>').join('') + '</ul>' : ''));
    // 4 the notes
    h += sec('Jegyzetek', m.notes.length || m.memos.length ? '<ul class="lista" id="jegyzetek">' + m.notes.map(x => '<li' + (x.open ? ' class="vez"' : '') + '>' + (x.open ? '⚑ Tisztázandó: ' : '') +
      esc(x.text || '(csak címke)') + (x.chips || []).map(ch => '<span class="chip">' + esc(ch) + '</span>').join('') + (x.room ? ' <span class="apro">· ' + esc(x.room) + '</span>' : '') + '</li>').join('') +
      m.memos.map(x => '<li>✎ ' + esc(x.text) + ' <span class="apro">(a vázlaton)</span></li>').join('') + '</ul>' : '');
    // 5 the rooms with their wants
    h += sec('Helyiségek', m.rooms.length ? '<table id="helyisegek"><thead><tr><th>Helyiség</th><th class="n">Terület</th><th>Ügyfél igényei</th></tr></thead><tbody>' +
      m.rooms.map(r => '<tr data-room="' + esc(r.id) + '"><td>' + esc(r.name) + '</td><td class="n">' + (r.est ? '≈ ' : '') + fmt(r.areaM2) + ' m²</td><td>' +
        ((r.wants || []).map(w => esc(w.sym + ' ' + w.label) + ' ×' + w.qty).join(', ') || '<span class="apro">—</span>') + '</td></tr>').join('') + '</tbody></table>' : '');
    // 6 the drawing
    h += sec('Vázlat', m.planSvg && /<svg/.test(m.planSvg) ? '<div class="rajz" id="rajz">' + m.planSvg + '</div><p class="apro">Piros: tervezett pont · szürke: meglévő · szaggatott fal: becsült méret.</p>' : '');
    // 7 the photos by purpose
    const fig = p => '<figure data-cap="' + esc(p.id) + '">' + (p.kind === 'video' ? '<div class="nincs">▶ videó ' + esc(p.id) + '</div>' : p.url ? '<img src="' + esc(p.url) + '" alt="">' : '<div class="nincs">' + esc(p.id) + ' (nincs csatolva)</div>') +
      '<figcaption>' + esc([p.caption, p.room, p.phase === 'elotte' ? 'előtte' : p.phase === 'utana' ? 'utána' : '', p.at].filter(Boolean).join(' · ')) + '</figcaption></figure>';
    h += sec('Fotók', m.photos.map(g => '<h3>' + esc(g.sym + ' ' + g.label) + ' <span class="apro">(' + g.items.length + ')</span></h3><div class="fotok">' + g.items.map(fig).join('') + '</div>').join('') +
      (m.audio.length ? '<h3>🎙 Hangjegyzetek</h3><ul class="lista" id="hang">' + m.audio.map(a => '<li>' + esc(a.id) + ' · ' + esc(dur(a.durationMs)) + (a.caption ? ' · ' + esc(a.caption) : '') + ' <span class="apro">' + esc(a.at) + '</span></li>').join('') + '</ul>' : ''));
    // 8 the site
    const si = m.site, fp = si.footprint;
    h += sec('Helyszín', si.address || si.svg || si.lat != null ? '<dl class="meta"><div class="w2"><span class="lbl">Cím</span>' + esc(si.address || '—') + '</div>' +
      '<div class="w2"><span class="lbl">Koordináta</span>' + (si.lat != null && si.lon != null ? si.lat.toFixed(5) + ', ' + si.lon.toFixed(5) : '—') + '</div>' +
      (fp ? '<div class="w4"><span class="lbl">Épület a térképen</span>' + fmt(fp.w) + ' × ' + fmt(fp.d) + ' m · ' + fmt(fp.area) + ' m²</div>' : '') + '</dl>' +
      (si.svg ? '<div class="rajz" id="helyszinrajz">' + si.svg + '</div>' : '') + (si.lines.length ? '<ul class="lista" id="elhelyezes">' + si.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') : '');
    // 9 the signature
    h += sec('Aláírás', m.signatures.length ? '<div class="alairas">' + m.signatures.map(x => '<figure data-cap="' + esc(x.id) + '">' + (x.url ? '<img src="' + esc(x.url) + '" alt="aláírás">' : '<div class="nincs">✍ ' + esc(x.id) + '</div>') +
      '<figcaption><b>' + esc(x.signer || '—') + '</b> · ' + esc(x.at) + (x.caption ? '<br>' + esc(x.caption) : '') + '</figcaption></figure>').join('') + '</div>' : '');
    h += '<div class="lab">A jegyzőkönyv a VRG Sketcher felméréséből készült (' + esc(m.date) + '). Becsült (≈) mennyiségek a helyszíni vázlatból; az ajánlat a pontos tervből készül.</div>';
    return h + '</div></body></html>';
  }
  const dur = ms => { const t = Math.round((ms || 0) / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  return { model, html, day };
});
