// work.js — Phase 2 of the T line (docs/browser/TRAJECTORIES.md): the work context (T3) and datasheets and parts (T4).
//   #/munkak                 the jobs: codes from this device's links and, through serve.js, the PC's jobs folder (codes only)
//   #/munkak/<CODE>          one job: its links, saved pages and datasheets; Térképen; export into the job's folder; labels
//   #/munkak/<CODE>/cimkek   a printable sheet of QR labels (the links and datasheets of the job)
//   #/alkatreszek[?q=&cat=]  the Inventory's parts (baked by build.js, no prices): search, categories
//   #/alkatreszek/<VRG-id>   one part: its datasheet (open, read, save offline with the part id), product pages, searches, a label
// Job codes are the toolset's (AB12; Map/tools/build-jobs.js); nothing here names a client.
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.work) return;
  const { h, icon, btn, toast, dialog, when, giveFile } = VB.ui;
  const K = () => VB.views.kit;
  const CODE_RE = /^[A-Z]{1,3}\d{1,3}$/;

  // ------------------------------------------------------------------ Munkák
  function jobs(ctx, p, go) {
    const { sec, empty } = K();
    const st = ctx.st;
    const out = h('div.vb-view');
    const local = new Map(st.jobs());
    const codeIn = h('input.vb-input', { type: 'text', placeholder: 'Munkaszám, pl. AB12', 'aria-label': 'Munkaszám', autocapitalize: 'characters', maxlength: 8 });
    const form = h('form.vb-row', { style: { padding: 0 }, on: { submit: e => {
      e.preventDefault();
      const c = codeIn.value.trim().toUpperCase();
      if (!CODE_RE.test(c)) { codeIn.setAttribute('aria-invalid', 'true'); toast('warn', 'Munkaszám', 'Alakja: 1–3 nagybetű és 1–3 számjegy, pl. AB12.'); return; }
      go('#/munkak/' + c);
    } } }, codeIn, btn('Megnyitás', { variant: 'primary', icon: 'folder', on: { click: () => form.requestSubmit() } }));
    const list = h('div.vb-list');
    const draw = server => {
      list.textContent = '';
      const codes = new Map();
      for (const [c, n] of local) codes.set(c, { code: c, n, status: '' });
      for (const j of server || []) codes.set(j.code, Object.assign({ n: local.get(j.code) || 0 }, codes.get(j.code) || {}, j));
      const rows = [...codes.values()].sort((a, b) => (b.n > 0) - (a.n > 0) || (a.status === 'folyamatban' ? -1 : 0) - (b.status === 'folyamatban' ? -1 : 0) || a.code.localeCompare(b.code));
      if (!rows.length) { list.appendChild(empty('Még nincs munkához rendelt link. Egy könyvjelzőnél vagy mentett oldalnál add meg a munkaszámot, vagy nyiss meg egy munkát fent.')); return; }
      for (const j of rows.slice(0, 300)) {
        list.appendChild(h('div.vb-row', null, h('div.vb-row__main', null,
          h('button.vb-row__title', { type: 'button', on: { click: () => go('#/munkak/' + j.code) } }, j.code),
          h('div.vb-row__meta', null, j.status ? h('span.vb-tag' + (j.status === 'folyamatban' ? '.vb-tag--job' : ''), null, j.status) : null,
            j.n ? h('span.vb-tag.vb-tag--kind', null, j.n + ' anyag') : null, j.to ? h('span.vb-tag', null, j.from ? j.from + ' … ' + j.to : j.to) : null))));
      }
    };
    const note = h('p.vb-note', null, ctx.caps.api === null ? 'Ezen az eszközön a munkák a linkek munkaszámaiból jönnek.' : 'A PC munkamappájának munkaszámai betöltése…');
    out.append(K().sec('Munkák', 'munkaszám szerint: linkek, mentett oldalak, adatlapok', null, h('div.vb-stack', null, form, note, list)));
    draw([]);
    if (ctx.caps.api !== null) ctx.api('/api/jobs').then(j => {
      note.textContent = j.ok ? j.jobs.length + ' munka a PC munkamappájában (csak a munkaszám és az állapot jön át).' : (j.hu || 'A munkamappa nem érhető el.');
      draw(j.ok ? j.jobs : []);
    });
    return out;
  }

  // ------------------------------------------------------------------ one job
  function job(ctx, code, go) {
    const { sec, empty, row, tagEls, bookmarkRow } = K();
    const st = ctx.st;
    if (!CODE_RE.test(code) && !VB.store.JOB_RE.test(code)) return h('div.vb-view', null, empty('Ismeretlen munkaszám: ' + code));
    const mine = st.forJob(code);
    const out = h('div.vb-view');
    const url = h('input.vb-input', { type: 'url', placeholder: 'https://… ehhez a munkához', 'aria-label': 'Cím a munkához' });
    const title = h('input.vb-input', { type: 'text', placeholder: 'Megnevezés (nem kötelező)', 'aria-label': 'Megnevezés' });
    const add = h('form.vb-form', { on: { submit: e => {
      e.preventDefault();
      const u = VB.url.asUrl(url.value.trim());
      if (!u) { toast('warn', 'Érvénytelen cím', url.value); return; }
      const clean = ctx.on('clean') ? VB.url.clean(u).url : u;
      if (st.addBookmark({ url: clean, title: title.value || VB.url.hostOf(clean), job: code })) toast('ok', 'A munkához mentve', code);
    } } }, h('label', null, 'Cím', url), h('label', null, 'Megnevezés', title), btn('Hozzáadás', { variant: 'primary', icon: 'plus', on: { click: () => add.requestSubmit() } }));
    const pdfs = h('input', { type: 'checkbox', id: 'vb-exp-pdf', checked: true });
    const actions = h('div.vb-actions', null,
      ctx.on('servers') ? btn('Térképen', { icon: 'external', small: true, click: () => ctx.open('http://localhost:8802/?job=' + encodeURIComponent(code), { title: code + ' — VRG Térkép', via: 'job' }) }) : null,
      ctx.on('qr') ? btn('QR-címkék', { icon: 'grid', small: true, click: () => go('#/munkak/' + code + '/cimkek') }) : null,
      btn('Mentés fájlba', { icon: 'download', small: true, click: async () => {
        const all = st.exportAll();
        const keep = new Set(mine.bookmarks.map(b => b.url));
        const doc = Object.assign({}, all, { bookmarks: all.bookmarks.filter(b => keep.has(b.url)), history: [],
          'x-bongeszo': { meta: Object.fromEntries(Object.entries(all['x-bongeszo'].meta || {}).filter(([u]) => keep.has(u))), reading: mine.reading, pinned: [] } });
        const how = await giveFile('vrg-web-links-' + code + '.json', JSON.stringify(doc, null, 1), ctx.kind);
        toast(how === 'failed' ? 'warn' : 'ok', code, how === 'download' ? 'Letöltve.' : how === 'clipboard' ? 'A vágólapon (a telefon nem tölt le fájlt).' : 'Nem sikerült.');
      } }));
    const exportBox = ctx.caps.api === null ? null : h('div.vb-set', null,
      h('div.vb-set__txt', null, h('span', null, 'Exportálás a munka mappájába'),
        h('small', null, 'A PC-n a ' + code + ' munka mappájába, a web almappába: links.json (vrg.web-links v1), INDEX.md, a mentett oldalak Markdownként, és ha bejelölöd, az adatlap PDF-ek letöltve.'),
        h('label.vb-row', { style: { padding: 0 } }, pdfs, h('span', null, 'Adatlap PDF-ek letöltése is'))),
      btn('Exportálás', { variant: 'primary', icon: 'save', click: async () => {
        toast('activity', 'Exportálás…', code);
        const r = await ctx.post('/api/jobs/' + encodeURIComponent(code) + '/export', { bookmarks: mine.bookmarks, reading: mine.reading, pdfs: pdfs.checked });
        toast(r.ok ? 'ok' : 'warn', r.ok ? 'Kiírva' : 'Nem sikerült', r.hu || '');
      } }));
    out.append(h('div.vb-hero', null, h('span.vk-label', null, 'MUNKA'), h('h1', null, code),
      h('p', null, 'A munkához rendelt linkek, mentett oldalak és adatlapok ezen az eszközön. Egy linket a Könyvjelzőknél, egy mentett oldalt az Olvasóban rendelsz munkához (Szerkesztés → Munkaszám).'), actions));
    if (exportBox) out.append(exportBox);
    out.append(sec('Linkek', mine.bookmarks.length + ' db', null, h('div.vb-stack', null, h('details.vb-add', { open: !mine.bookmarks.length }, h('summary', null, 'Új link ehhez a munkához'), add),
      mine.bookmarks.length ? h('div.vb-list', null, mine.bookmarks.map(b => bookmarkRow(ctx, b, go))) : empty('Nincs még link ennél a munkánál.'))));
    const sheets = mine.reading.filter(r => r.kind === 'pdf' || r.part), pages = mine.reading.filter(r => !(r.kind === 'pdf' || r.part));
    const readRow = r => row(r.title, r.url, [r.kind === 'pdf' ? h('span.vb-tag.vb-tag--kind', null, 'PDF') : null, r.part ? h('span.vb-tag', null, r.part) : null,
      r.text ? h('span.vb-tag.vb-tag--kind', null, 'offline') : null, ...tagEls(Object.assign({}, r, { job: '' })), h('span.vb-tag', null, when(r.added))], () => go('#/olvaso/' + r.id));
    out.append(h('div.vb-cols', null,
      sec('Adatlapok', sheets.length + ' db', null, sheets.length ? h('div.vb-list', null, sheets.map(readRow)) : empty('Adatlapot az Alkatrészeknél vagy az Olvasóban mentesz ide (a munkaszámmal).')),
      sec('Mentett oldalak', pages.length + ' db', null, pages.length ? h('div.vb-list', null, pages.map(readRow)) : empty('Nincs mentett oldal ennél a munkánál.'))));
    return out;
  }

  // ------------------------------------------------------------------ QR label sheet (print)
  function labels(ctx, code, go) {
    const { empty } = K();
    const mine = ctx.st.forJob(code);
    const items = mine.bookmarks.map(b => ({ title: b.title, url: b.url, id: code }))
      .concat(mine.reading.map(r => ({ title: r.title, url: r.url, id: r.part || code })));
    return sheet(ctx, code + ' — QR-címkék', items, go, '#/munkak/' + code);
  }
  function sheet(ctx, heading, items, go, back) {
    const out = h('div.vb-view');
    const size = h('select.vb-select', { 'aria-label': 'Címkeméret', on: { change: () => grid.dataset.size = size.value } },
      [['m', '70 × 37 mm (3 × 8, A4)'], ['l', '105 × 74 mm (2 × 4, A4)'], ['s', '52,5 × 29,7 mm (4 × 10, A4)']].map(([v, l]) => h('option', { value: v }, l)));
    const grid = h('div.vb-labels', { 'data-size': 'm' }, items.map(it => label(it)));
    out.append(h('div.vb-hero.vb-noprint', null, h('span.vk-label', null, 'QR-CÍMKÉK'), h('h1', null, heading),
      h('p', null, 'Szekrényre, dobozra, alkatrészre: a telefon kamerája a QR-ből megnyitja az adatlapot vagy a linket. Nyomtatás előtt válassz címkeméretet.'),
      h('div.vb-actions', null, size, btn('Nyomtatás', { variant: 'primary', icon: 'file', click: () => root.print() }), btn('Vissza', { icon: 'arrow-left', click: () => go(back) }))));
    out.append(items.length ? grid : K().empty('Nincs mit címkére tenni: ennél a munkánál nincs link vagy adatlap.'));
    return out;
  }
  function label(it) {
    const r = VB.qr && VB.qr.qrEncode(it.url, { ecc: 'M', border: 1 });
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    if (r && r.ok) {
      svg.setAttribute('viewBox', '0 0 ' + r.w + ' ' + r.w); svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR: ' + it.url);
      const bg = document.createElementNS(ns, 'rect'); bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#ffffff');
      const p = document.createElementNS(ns, 'path'); const d = [];
      for (let y = 0; y < r.n; y++) for (let x = 0; x < r.n; x++) if (r.get(x, y)) d.push('M' + (x + r.border) + ',' + (y + r.border) + 'h1v1h-1z');
      p.setAttribute('d', d.join('')); p.setAttribute('fill', '#000000');
      svg.append(bg, p);
    }
    return h('div.vb-label', null, h('div.vb-label__qr', null, svg),
      h('div.vb-label__txt', null, h('b', null, String(it.title || '').slice(0, 90)), h('span', null, it.id || ''), h('small', null, VB.url.hostOf(it.url))));
  }

  // ------------------------------------------------------------------ Alkatrészek
  const partsOf = ctx => ctx.data.parts || [];
  function parts(ctx, p, go) {
    const { sec, empty } = K();
    const all = partsOf(ctx);
    const out = h('div.vb-view');
    if (!all.length) return h('div.vb-view', null, empty('A Készlet katalógusa nincs beépítve (Inventory/data/vrg-inventory.json).'));
    const q = h('input.vb-input', { type: 'search', placeholder: 'Név, gyártó, cikkszám, VRG-azonosító…', 'aria-label': 'Alkatrész keresése', value: p.q || '' });
    const cats = [...new Set(all.map(x => x.cat.split(' / ')[0]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hu'));
    const cat = p.cat || '';
    const list = h('div');
    const ix = VB.engine.createIndex({ fields: { title: 3, tags: 3, text: 1 } });
    for (const x of all) ix.add({ id: x.id, title: x.name, tags: [x.id, x.brand, x.pn, x.gtin], text: x.cat, ref: x });
    const draw = () => {
      list.textContent = '';
      const f = q.value.trim();
      let rows = f ? ix.search(f, { limit: 200 }).map(r => r.doc.ref) : all.slice();
      if (cat) rows = rows.filter(x => x.cat.startsWith(cat));
      list.appendChild(rows.length ? h('div.vb-list', null, rows.slice(0, 200).map(x => partRow(ctx, x, go, f))) : empty('Nincs ilyen alkatrész.'));
    };
    q.addEventListener('input', draw);
    out.append(sec('Alkatrészek', all.length + ' cikk a Készletből · ' + all.filter(x => x.sheet).length + ' adatlappal', null, h('div.vb-stack', null,
      h('div.vb-row', { style: { padding: 0 } }, q),
      h('select.vb-select', { 'aria-label': 'Kategória', on: { change: e => go('#/alkatreszek' + (e.target.value || q.value ? '?' : '') + [e.target.value ? 'cat=' + encodeURIComponent(e.target.value) : '', q.value ? 'q=' + encodeURIComponent(q.value) : ''].filter(Boolean).join('&')) } },
        h('option', { value: '' }, 'Minden kategória'), cats.map(c => h('option', { value: c, selected: cat === c }, c + ' (' + all.filter(x => x.cat.startsWith(c)).length + ')'))),
      list)));
    draw();
    return out;
  }
  function partRow(ctx, x, go, query) {
    const saved = ctx.st.forPart(x.id).length;
    return h('div.vb-row', null, h('div.vb-row__main', null,
      h('button.vb-row__title', { type: 'button', title: x.name, on: { click: () => go('#/alkatreszek/' + x.id) } }, query ? VB.ui.highlight(x.name, query) : x.name),
      h('div.vb-row__meta', null, h('span.vb-tag.vb-tag--kind', null, x.id), x.brand ? h('span.vb-tag', null, x.brand) : null, x.pn ? h('span.vb-tag', null, x.pn) : null,
        x.sheet ? h('span.vb-tag', null, 'adatlap') : null, saved ? h('span.vb-tag.vb-tag--job', null, saved + ' mentve') : null)));
  }
  function part(ctx, id, go) {
    const { sec, empty, row } = K();
    const x = partsOf(ctx).find(y => y.id === id);
    if (!x) return h('div.vb-view', null, empty('Nincs ilyen cikk a Készletben: ' + id));
    const st = ctx.st;
    const saved = st.forPart(id);
    const q = x.pn || x.name;
    const eng = idE => ctx.engines.find(e => e.id === idE);
    const jobIn = h('input.vb-input', { type: 'text', placeholder: 'Munkaszám (nem kötelező)', 'aria-label': 'Munkaszám', autocapitalize: 'characters', maxlength: 8 });
    const readSheet = () => go('#/olvaso?url=' + encodeURIComponent(x.sheet) + '&part=' + encodeURIComponent(x.id) + (jobIn.value.trim() ? '&job=' + encodeURIComponent(jobIn.value.trim().toUpperCase()) : ''));
    const out = h('div.vb-view');
    out.append(h('div.vb-hero', null, h('span.vk-label', null, 'ALKATRÉSZ · ' + x.id), h('h1', null, x.name),
      h('div.vb-row__meta', null, x.brand ? h('span.vb-tag', null, x.brand) : null, x.pn ? h('span.vb-tag', null, 'cikkszám ' + x.pn) : null, x.gtin ? h('span.vb-tag', null, 'GTIN ' + x.gtin) : null, x.cat ? h('span.vb-tag', null, x.cat) : null)));
    out.append(sec('Adatlap', x.sheet ? VB.url.hostOf(x.sheet) : 'a Készletben nincs gyártói link', null, x.sheet ? h('div.vb-stack', null,
      h('div.vb-actions', null,
        ctx.on('reader') ? btn('Olvasás és mentés', { variant: 'primary', icon: 'eye', click: readSheet }) : null,
        btn('Megnyitás', { icon: 'external', click: () => ctx.open(x.sheet, { title: x.name + ' — adatlap', via: 'part' }) }),
        btn('Olvasólistára', { icon: 'list', click: () => { const r = st.addReading({ url: x.sheet, title: x.name + ' — adatlap', part: x.id, job: jobIn.value, kind: /\.pdf(\?|$)/i.test(x.sheet) ? 'pdf' : '' }); toast(r ? 'ok' : 'warn', r ? 'Az olvasólistán' : 'Nem sikerült', x.id); } }),
        ctx.on('qr') ? btn('QR-címke', { icon: 'grid', click: () => go('#/alkatreszek/' + x.id + '/cimke') }) : null),
      h('label.vb-row', { style: { padding: 0 } }, h('span.vb-note', null, 'Munkához:'), jobIn),
      ctx.on('reader') ? null : h('p.vb-note', null, ctx.kind === 'mobile' ? 'A telefonon az adatlap a böngészőben nyílik; a PC menti el szövegként (Olvasás és mentés), az itt is olvasható lesz.' : 'Az Olvasó nézethez a helyi szerver kell.')) : empty('A Készletben nincs gyártói link ehhez a cikkhez; keress lent.')));
    out.append(sec('Mentett adatlapok', saved.length + ' db', null, saved.length ? h('div.vb-list', null, saved.map(r => row(r.title, r.url, [r.text ? h('span.vb-tag.vb-tag--kind', null, 'offline') : null, r.job ? h('a.vb-tag.vb-tag--job', { href: '#/munkak/' + r.job }, r.job) : null, h('span.vb-tag', null, when(r.added))], () => go('#/olvaso/' + r.id)))) : empty('Még nincs mentve. Az „Olvasás és mentés” a szövegét is elteszi offline.')));
    out.append(sec('Termékoldalak és keresés', 'keresés erre: ' + q.slice(0, 60), null, h('div.vb-engines', null,
      x.vendors.map(v => btn('Termékoldal: ' + v.v, { small: true, icon: 'external', click: () => ctx.open(v.url, { title: x.name + ' — ' + v.v, via: 'part' }) })),
      ['datasheet', 'tme', 'mouser', 'farnell', 'arukereso'].map(eng).filter(Boolean).map(e => btn(e.hu, { small: true, icon: 'search', click: () => ctx.search(q, e, 'part') })))));
    return out;
  }
  function partLabel(ctx, id, go) {
    const x = partsOf(ctx).find(y => y.id === id);
    if (!x) return h('div.vb-view', null, K().empty('Nincs ilyen cikk: ' + id));
    const items = [x.sheet ? { title: x.name, url: x.sheet, id: x.id + (x.pn ? ' · ' + x.pn : '') } : null].concat(x.vendors.slice(0, 1).map(v => ({ title: x.name + ' (' + v.v + ')', url: v.url, id: x.id }))).filter(Boolean);
    return sheet(ctx, x.id + ' — QR-címke', items, go, '#/alkatreszek/' + id);
  }

  // the router's entry points (main.js NAV): #/munkak[/<CODE>[/cimkek]] and #/alkatreszek[/<id>[/cimke]]
  function jobsRoute(ctx, p, go, rest, more) {
    if (!rest) return jobs(ctx, p, go);
    const code = String(rest).toUpperCase();
    return more === 'cimkek' ? labels(ctx, code, go) : job(ctx, code, go);
  }
  function partsRoute(ctx, p, go, rest, more) {
    if (!rest) return parts(ctx, p, go);
    return more === 'cimke' ? partLabel(ctx, rest, go) : part(ctx, rest, go);
  }

  VB.work = { jobsRoute, partsRoute, CODE_RE };
  Object.assign(VB.views, { jobs: jobsRoute, parts: partsRoute });
})(typeof window !== 'undefined' ? window : globalThis);
