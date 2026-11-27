// views.js — the VRG Böngésző's pages, one function each: (ctx, params, go) → a node. Routes (location.hash):
//   #/  Kezdőlap · #/kereses?q= Keresés · #/konyvjelzok[?tag=&job=] · #/elozmenyek · #/olvaso · #/olvaso/<id> ·
//   #/olvaso?url= (read a page) · #/olvaso?doc= (a repo document) · #/beallitasok · #/sugo
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.views) return;
  const { h, icon, btn, toggle, marked, highlight, toast, dialog, when, dayLabel, giveFile } = VB.ui;

  const sec = (title, label, extra, ...body) => h('section.vb-sec', null, h('div.vb-sec__head', null, h('h2', null, title), label ? h('span.vk-label', null, label) : null, h('span.vb-grow'), extra), body);
  const empty = text => h('div.vb-empty', null, text);
  const tagEls = x => [(x.job ? h('span.vb-tag.vb-tag--job', null, x.job) : null), ...(x.tags || []).map(t => h('span.vb-tag', null, '#' + t))];
  const ico = s => String(s || '').replace(/[^0-9A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/g, '').slice(0, 2).toUpperCase() || '•';

  function tile(label, sub, mono, onClick, extra) {
    return h('button.vb-tile', { type: 'button', title: sub || label, on: { click: onClick } }, h('span.vb-tile__ico', null, mono), h('span.vb-tile__txt', null, h('b', null, label), sub ? h('small', null, sub) : null), extra || null);
  }

  // ------------------------------------------------------------------ Kezdőlap
  function home(ctx, p, go) {
    const st = ctx.st, s = st.settings();
    const d = new Date();
    const DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
    const greet = d.getHours() < 10 ? 'Jó reggelt' : d.getHours() < 18 ? 'Jó napot' : 'Jó estét';
    const out = h('div.vb-view');
    out.appendChild(h('div.vb-hero', null,
      h('span.vk-label', null, 'VRG BÖNGÉSZŐ · ' + ctx.caps.name.toUpperCase() + ' · ' + d.getFullYear() + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + String(d.getDate()).padStart(2, '0') + '. ' + DAYS[d.getDay()]),
      h('h1', null, greet + '.'),
      h('p', null, 'Írj a címsorba: címet, keresést, ', h('span.vb-code', null, '!bang'), '-et (', h('span.vb-code', null, '!w'), ' Wikipédia, ', h('span.vb-code', null, '!ds'), ' adatlap, ', h('span.vb-code', null, '!tme'), ' alkatrész) vagy számítást (',
        h('span.vb-code', null, '230V 16A'), ', ', h('span.vb-code', null, '2,5mm2 30m 16A'), '). A weboldalak ' + ctx.caps.how + '.')));
    if (ctx.kind === 'file') {
      // from disk nothing is kept (a null origin has no storage); when the server runs, offer to move over to it
      const warn = h('div.vb-warn', { 'data-level': 'warn' }, icon('warning'), 'Fájlból nyitottad meg: így a böngésző semmit nem ment el. Indítsd a helyi szerverről (START → W → B → S, vagy node Browser/serve.js), vagy a VRG Asztalból.');
      out.appendChild(warn);
      ping(8812).then(up => { if (up) warn.appendChild(btn('Megnyitás a helyi szerverről', { small: true, variant: 'primary', click: () => root.location.assign('http://127.0.0.1:8812/' + root.location.hash) })); });
    }
    else if (!st.ok) out.appendChild(h('div.vb-warn', { 'data-level': 'warn' }, icon('warning'), 'A tároló nem írható (privát ablak?): a könyvjelzők és az előzmények csak a lap bezárásáig maradnak meg.'));

    // BRW-Q02: the work line keeps a default search engine, but the user picks it once
    if (!s.engineChosen) {
      const pick = ['google', 'ddg', 'startpage', 'bing'].map(id => ctx.engines.find(e => e.id === id)).filter(Boolean);
      out.appendChild(sec('Melyik kereső legyen az alapértelmezett?', 'egyszer kérdezem · Beállításokban bármikor átállítható', null,
        h('p.vb-note', null, 'A címsor ezzel keres, ha nem adsz meg !bang-et. A DuckDuckGo és a Startpage nem követ.'),
        h('div.vb-actions', null, pick.map(e => btn(e.hu + (e.private ? ' · nem követ' : ''), { variant: e.id === s.engine ? 'primary' : null, click: () => { st.set('engine', e.id); st.set('engineChosen', true); toast('ok', 'Alapértelmezett kereső', e.hu); go('#/'); } })),
          btn('Más…', { click: () => go('#/beallitasok') }))));
    }
    // tiles: pinned bookmarks, then the quick links
    const pins = (s.pinned || []).map(id => st.bookmarks().find(b => b.id === id)).filter(Boolean);
    const tiles = pins.map(b => tile(b.title, VB.url.hostOf(b.url), ico(b.title), () => ctx.open(b.url, { title: b.title, via: 'tile' })))
      .concat((ctx.data.quicklinks || []).filter(q => !pins.some(b => VB.url.hostOf(b.url) === VB.url.hostOf(q.url))).map(q => tile(q.hu, VB.url.hostOf(q.url), q.icon || ico(q.hu), () => ctx.open(q.url, { title: q.hu, via: 'tile' }))));
    out.appendChild(sec('Gyorscsempék', pins.length ? pins.length + ' kitűzött' : 'könyvjelzőt a Könyvjelzők lapon, a gombostűvel tűzhetsz ide', null, h('div.vb-tiles', null, tiles)));

    if (ctx.on('servers') && (ctx.data.servers || []).length) {
      const lamps = new Map();
      const all = sessionStorageGet('vb-servers-all') === '1';
      const shown = ctx.data.servers.filter(sv => all || sv.level === 'user');
      const grid = h('div.vb-tiles', null, shown.map(sv => {
        const lamp = h('span.vk-lamp', { 'data-tone': 'off', title: 'ismeretlen' });
        lamps.set(sv.port, lamp);
        return tile(sv.name, 'localhost:' + sv.port, String(sv.key || '').slice(0, 2), () => ctx.open('http://localhost:' + sv.port + '/', { title: sv.name, via: 'server' }), lamp);
      }));
      out.appendChild(sec('Helyi VRG szerverek', 'START → O · futásjelző', h('div.vb-actions', null,
        btn(all ? 'Csak a fő szerverek' : 'Fejlesztői szerverek is', { small: true, pressed: all, click: () => { sessionStorageSet('vb-servers-all', all ? '0' : '1'); go('#/'); } }),
        btn('Frissítés', { icon: 'refresh', small: true, click: () => probe(lamps) })), grid));
      probe(lamps);
    }
    const unread = st.reading().filter(r => !r.read).slice(0, 5);
    const recent = st.history().slice(0, 8);
    out.appendChild(h('div.vb-cols', null,
      sec('Olvasnivaló', st.reading().length + ' a listán', btn('Mind', { small: true, click: () => go('#/olvaso') }),
        unread.length ? h('div.vb-list', null, unread.map(r => row(r.title, r.url, [r.text ? h('span.vb-tag.vb-tag--kind', null, 'offline') : null, ...tagEls(r)], () => go('#/olvaso/' + r.id)))) : empty('Az olvasólista üres. Oldalt a fenti ☆ gombbal vagy az Olvasó lapon teszel ide.')),
      sec('Legutóbb', 'a VRG Böngészőből nyitott oldalak', btn('Előzmények', { small: true, click: () => go('#/elozmenyek') }),
        recent.length ? h('div.vb-list', null, recent.map(v => row(v.title || VB.url.display(v.url), v.url, [h('span.vb-tag', null, when(v.at))], () => ctx.open(v.url, { title: v.title, via: 'recent' })))) : empty('Még nincs előzmény.'))));
    return out;

    async function probe(map) {
      await Promise.all([...map].map(async ([port, lamp]) => {
        lamp.dataset.tone = 'run'; lamp.title = 'ellenőrzés…';
        const up = await ping(port);
        lamp.dataset.tone = up ? 'ok' : 'off'; lamp.title = up ? 'fut' : 'nem fut';
        lamp.setAttribute('aria-label', up ? 'fut' : 'nem fut');
      }));
    }
  }
  // a local server answers? (no-cors: only "something answered" is visible, which is all a lamp needs)
  async function ping(port) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), 1500);
    try { await fetch('http://127.0.0.1:' + port + '/', { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctl && ctl.signal }); return true; } catch (e) { return false; } finally { if (t) clearTimeout(t); }
  }

  function row(title, url, meta, onOpen, acts, snippet) {
    return h('div.vb-row', null,
      h('div.vb-row__main', null,
        h('button.vb-row__title', { type: 'button', title: url, on: { click: onOpen } }, title),
        url ? h('span.vb-row__url', null, VB.url.display(url)) : null,
        snippet || null,
        meta && meta.filter(Boolean).length ? h('div.vb-row__meta', null, meta) : null),
      acts ? h('div.vb-row__acts', null, acts) : null);
  }

  // ------------------------------------------------------------------ Keresés: the meta-search page
  function search(ctx, p, go) {
    const q = (p.q || '').trim();
    const out = h('div.vb-view');
    const form = h('form.vb-row', { role: 'search', on: { submit: e => { e.preventDefault(); go('#/kereses?q=' + encodeURIComponent(inp.value.trim())); } } });
    const inp = h('input.vb-input', { type: 'search', value: q, placeholder: 'Mit keresel?', 'aria-label': 'Keresés', enterkeyhint: 'search' });
    form.append(inp, btn('Keresés', { variant: 'primary', icon: 'search', on: { click: () => form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')) } }));
    out.appendChild(h('div.vb-hero', null, h('span.vk-label', null, 'VRG KERESŐ'), h('h1', null, q ? 'Találatok: ' + q : 'Keresés'),
      h('p', null, 'Egy lapon: a saját könyvjelzőid, előzményeid és mentett oldalaid teljes szövegben, a repó dokumentumai, és minden keresőmotor egy kattintásra.'), form));
    if (!q) { setTimeout(() => inp.focus(), 0); return out; }

    const c = VB.url.classify(q, { engines: ctx.engines, engine: ctx.st.settings().engine });
    const query = c.kind === 'search' && c.bang ? c.q : q;
    if (ctx.on('answers')) {
      const a = VB.answers.answer(q);
      if (a) out.appendChild(h('div.vb-answer', null, h('span.vk-label', null, a.title), h('span.vb-answer__value', null, a.value), (a.lines || []).map(l => h('span.vb-answer__line', null, l)), a.warn ? h('span.vb-answer__warn', null, a.warn) : null));
    }
    const def = ctx.engine();
    out.appendChild(h('div.vb-actions', null,
      c.kind === 'url' ? btn('Megnyitás: ' + VB.url.display(c.url), { variant: 'primary', icon: 'external', click: () => ctx.open(c.url, { via: 'search' }) }) : null,
      def ? btn(def.hu + ': ' + query, { variant: c.kind === 'url' ? null : 'primary', icon: 'search', click: () => ctx.search(query, def, 'page') }) : null,
      btn('Minden kereső ↓', { click: () => { const w = document.getElementById('vb-web'); if (w) w.scrollIntoView({ behavior: VB.ui && root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } })));

    if (ctx.on('local')) {
      const hits = ctx.ix.search(query, { limit: 40 }).filter(r => r.doc.kind !== 'eng');
      const KH = { bm: 'könyvjelző', rd: 'olvasólista', hi: 'előzmény', srv: 'helyi szerver', ql: 'gyorslink' };
      out.appendChild(sec('Saját találatok', hits.length + ' találat · teljes szöveg, ékezet nélkül is', null,
        hits.length ? h('div.vb-list', null, hits.map(r => {
          const d = r.doc;
          const sn = d.text ? VB.engine.snippet(d.text, query, 220) : null;
          const openIt = d.kind === 'rd' ? () => go('#/olvaso/' + d.ref.id) : () => ctx.open(d.url, { title: d.title, via: 'search:' + d.kind });
          return row(highlight(d.title, query), d.url, [h('span.vb-tag.vb-tag--kind', null, KH[d.kind] || d.kind), ...tagEls(d.ref || {})], openIt, null, sn && sn.text.trim() ? h('span.vb-row__snip', null, marked(sn.text, sn.ranges)) : null);
        })) : empty('Nincs saját találat. A könyvjelzők, az előzmények és a mentett oldalak szövegében keresek.')));
    }
    if (ctx.on('docs')) {
      const box = h('div', null, h('p.vb-note', null, 'Keresés a repó dokumentumaiban…'));
      out.appendChild(sec('Dokumentumok', 'a repó Markdown fájljai, a helyi szerveren át', null, box));
      ctx.api('/api/docs', { q: query, limit: 12 }).then(j => {
        box.textContent = '';
        if (!j.ok) { box.appendChild(h('p.vb-note', null, j.hu || 'A dokumentumkereső nem érhető el.')); return; }
        box.appendChild(j.hits.length ? h('div.vb-list', null, j.hits.map(d => row(highlight(d.title, query), '', [h('span.vb-tag.vb-tag--kind', null, d.path)], () => go('#/olvaso?doc=' + encodeURIComponent(d.path)), null,
          h('span.vb-row__snip', null, marked(d.snippet.text, d.snippet.ranges))))) : empty('Nincs találat ' + j.total + ' dokumentumban.'));
      });
    }
    // the web: every engine, grouped
    const groups = {};
    for (const e of ctx.engines) (groups[e.group] = groups[e.group] || []).push(e);
    const web = sec('Keresés a weben', 'a lap ' + ctx.caps.how, null,
      Object.entries(groups).map(([g, list]) => h('div.vb-stack', null, h('span.vk-label', null, (ctx.data.groups || {})[g] || g),
        h('div.vb-engines', null, list.map(e => { const b = btn(e.hu, { small: true, click: () => ctx.search(query, e, 'page') }); b.appendChild(h('small', null, '!' + (e.bangs || [])[0])); return b; })))));
    web.id = 'vb-web';
    out.appendChild(web);

    return out;
  }

  // ------------------------------------------------------------------ Könyvjelzők
  function bookmarks(ctx, p, go) {
    const st = ctx.st;
    const out = h('div.vb-view');
    const filt = h('input.vb-input', { type: 'search', placeholder: 'Szűrés…', 'aria-label': 'Könyvjelzők szűrése', value: p.q || '' });
    const list = h('div');
    const tag = p.tag || '', job = p.job || '';
    const draw = () => {
      list.textContent = '';
      let all = st.bookmarks().filter(b => (!tag || b.tags.includes(tag)) && (!job || b.job === job));
      const f = filt.value.trim();
      if (f) { const ids = new Set(ctx.ix.search(f, { limit: 500, filter: d => d.kind === 'bm' }).map(r => r.doc.ref.id)); all = all.filter(b => ids.has(b.id)); }
      list.appendChild(all.length ? h('div.vb-list', null, all.map(b => bookmarkRow(ctx, b, go))) : empty(st.bookmarks().length ? 'Nincs a szűrésnek megfelelő könyvjelző.' : 'Még nincs könyvjelző. Adj hozzá egyet fent, vagy egy megnyitott oldal után a fenti ☆ gombbal.'));
    };
    filt.addEventListener('input', draw);

    const url = h('input.vb-input', { type: 'url', placeholder: 'https://…', 'aria-label': 'Cím', required: true });
    const title = h('input.vb-input', { type: 'text', placeholder: 'Cím (nem kötelező)', 'aria-label': 'Megnevezés' });
    const tags = h('input.vb-input', { type: 'text', placeholder: 'címkék, vesszővel', 'aria-label': 'Címkék' });
    const jobIn = h('input.vb-input', { type: 'text', placeholder: 'VRG-2611-03', 'aria-label': 'Munkaszám', pattern: 'VRG-\\d{4}-\\d{2}' });
    const addForm = h('form.vb-form', { on: { submit: e => {
      e.preventDefault();
      const u = VB.url.asUrl(url.value.trim());
      if (!u) { url.setAttribute('aria-invalid', 'true'); toast('warn', 'Érvénytelen cím', url.value); return; }
      if (jobIn.value.trim() && !VB.store.normJob(jobIn.value)) { jobIn.setAttribute('aria-invalid', 'true'); toast('warn', 'Munkaszám', 'Alakja: VRG-ÉÉHH-NN, pl. VRG-2611-03.'); return; }
      const clean = ctx.on('clean') ? VB.url.clean(u).url : u;
      const b = st.addBookmark({ url: clean, title: title.value || VB.url.hostOf(clean), tags: tags.value, job: jobIn.value });
      if (b) { toast('ok', 'Könyvjelző mentve', b.title); url.value = title.value = tags.value = jobIn.value = ''; url.removeAttribute('aria-invalid'); jobIn.removeAttribute('aria-invalid'); }
    } } }, h('label', null, 'Cím', url), h('label', null, 'Megnevezés', title), h('label', null, 'Címkék', tags), h('label', null, 'Munkaszám', jobIn), btn('Hozzáadás', { variant: 'primary', icon: 'plus', on: { click: () => addForm.requestSubmit() } }));

    const chips = h('div.vb-chips', null,
      btn('Mind', { pressed: !tag && !job, click: () => go('#/konyvjelzok') }),
      st.jobs().map(([j, n]) => btn(j + ' · ' + n, { pressed: job === j, click: () => go('#/konyvjelzok?job=' + encodeURIComponent(j)) })),
      st.tags().slice(0, 30).map(([t, n]) => btn('#' + t + ' · ' + n, { pressed: tag === t, click: () => go('#/konyvjelzok?tag=' + encodeURIComponent(t)) })));
    const fold = h('details.vb-add', { open: !st.bookmarks().length }, h('summary', null, 'Új könyvjelző'), addForm);
    out.append(sec('Könyvjelzők', st.bookmarks().length + ' db', libraryButtons(ctx), h('div.vb-stack', null, fold, h('div.vb-row', { style: { padding: 0 } }, filt), chips, list)));
    draw();
    return out;
  }
  function bookmarkRow(ctx, b, go) {
    const st = ctx.st, pinned = (st.settings().pinned || []).includes(b.id);
    return row(b.title, b.url, [...tagEls(b), b.visits ? h('span.vb-tag', null, b.visits + '× megnyitva') : null, b.note ? h('span.vb-tag', null, b.note.slice(0, 60)) : null],
      () => ctx.open(b.url, { title: b.title, via: 'bookmark' }),
      [btn(pinned ? 'Levétel a kezdőlapról' : 'Kitűzés a kezdőlapra', { iconOnly: true, icon: 'pin', small: true, pressed: pinned, click: () => { const s = st.settings().pinned || []; st.set('pinned', pinned ? s.filter(x => x !== b.id) : s.concat(b.id).slice(-24)); } }),
        btn('Olvasólistára', { iconOnly: true, icon: 'list', small: true, click: () => { if (st.addReading({ url: b.url, title: b.title, tags: b.tags, job: b.job })) toast('ok', 'Az olvasólistán', b.title); } }),
        ctx.on('qr') ? btn('Telefonra (QR)', { iconOnly: true, icon: 'phone', small: true, click: () => qr(ctx, b.url, b.title) }) : null,
        btn('Szerkesztés', { iconOnly: true, icon: 'edit', small: true, click: () => editItem(ctx, b, 'bookmark') }),
        btn('Törlés', { iconOnly: true, icon: 'trash', small: true, variant: 'danger', click: async () => { if (await confirmDel(b.title)) { st.removeBookmark(b.id); toast('ok', 'Törölve', b.title); } } })]);
  }
  const confirmDel = t => dialog('Törlés', h('p.vb-note', null, t), [{ label: 'Mégse', value: false }, { label: 'Törlés', value: true, variant: 'danger' }]);
  async function editItem(ctx, x, what) {
    const title = h('input.vb-input', { type: 'text', value: x.title }), tags = h('input.vb-input', { type: 'text', value: (x.tags || []).join(', ') });
    const job = h('input.vb-input', { type: 'text', value: x.job || '', placeholder: 'VRG-2611-03' }), note = h('textarea.vb-textarea', null);
    note.value = x.note || '';
    const ok = await dialog(what === 'bookmark' ? 'Könyvjelző szerkesztése' : 'Olvasnivaló szerkesztése', h('div.vb-stack', null,
      h('p.vb-note', null, VB.url.display(x.url)), h('label.vb-stack', null, 'Megnevezés', title), h('label.vb-stack', null, 'Címkék (vesszővel)', tags),
      h('label.vb-stack', null, 'Munkaszám', job), h('label.vb-stack', null, 'Jegyzet', note)), [{ label: 'Mégse', value: false }, { label: 'Mentés', value: true, variant: 'primary' }]);
    if (!ok) return;
    if (job.value.trim() && !VB.store.normJob(job.value)) { toast('warn', 'Munkaszám', 'Alakja: VRG-ÉÉHH-NN, pl. VRG-2611-03. A többi mező mentve.'); job.value = x.job || ''; }
    const patch = { title: title.value, tags: tags.value, job: job.value, note: note.value };
    if (what === 'bookmark') ctx.st.updateBookmark(x.id, patch); else ctx.st.updateReading(x.id, patch);
  }
  function libraryButtons(ctx) {
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, on: { change: async () => {
      const f = file.files[0]; file.value = '';
      if (!f) return;
      try { const r = ctx.st.importAll(JSON.parse(await f.text())); toast(r.ok ? 'ok' : 'warn', 'Betöltés', r.hu); } catch (e) { toast('error', 'Betöltés', 'A fájl nem olvasható JSON.'); }
    } } });
    return h('div.vb-actions', null, file,
      btn('Mentés fájlba', { icon: 'download', small: true, click: async () => {
        const how = await giveFile('vrg-web-links-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(ctx.st.exportAll(), null, 1), ctx.kind);
        toast(how === 'failed' ? 'warn' : 'ok', 'Mentés', how === 'download' ? 'Letöltve.' : how === 'clipboard' ? 'A mentés a vágólapon van (a telefon nem tölt le fájlt).' : 'Nem sikerült.');
      } }),
      btn('Betöltés fájlból', { icon: 'upload', small: true, click: () => file.click() }));
  }

  // ------------------------------------------------------------------ Előzmények
  function history(ctx, p, go) {
    const st = ctx.st;
    const out = h('div.vb-view');
    const filt = h('input.vb-input', { type: 'search', placeholder: 'Szűrés…', 'aria-label': 'Előzmények szűrése' });
    const list = h('div.vb-stack');
    const draw = () => {
      list.textContent = '';
      const f = VB.engine.fold(filt.value.trim());
      const all = st.history('', 1500).filter(v => !f || VB.engine.fold(v.title + ' ' + v.url).includes(f)).slice(0, 400);
      if (!all.length) { list.appendChild(empty(st.settings().history ? 'Nincs előzmény.' : 'Az előzmények mentése ki van kapcsolva (Beállítások).')); return; }
      let day = '', box = null;
      for (const v of all) {
        const d = dayLabel(v.at);
        if (d !== day) { day = d; box = h('div.vb-list'); list.append(h('span.vk-label', null, d), box); }
        box.appendChild(row(v.title || VB.url.display(v.url), v.url, [h('span.vb-tag', null, when(v.at)), v.count > 1 ? h('span.vb-tag', null, v.count + '×') : null],
          () => ctx.open(v.url, { title: v.title, via: 'history' }),
          [btn('Könyvjelző', { iconOnly: true, icon: 'star', small: true, pressed: !!st.bookmark(v.url), click: () => { if (st.addBookmark({ url: v.url, title: v.title || VB.url.hostOf(v.url) })) toast('ok', 'Könyvjelző mentve', v.title || v.url); } }),
            btn('Törlés az előzményekből', { iconOnly: true, icon: 'close', small: true, click: () => st.removeVisit(v.url) })]));
      }
    };
    filt.addEventListener('input', draw);
    out.append(sec('Előzmények', st.history().length + ' oldal · ' + (ctx.sync && ctx.sync.status().mode === 'master' ? 'az Asztal Böngésző paneljével együtt' : 'ami innen nyílt'), h('div.vb-actions', null,
      btn('Utolsó óra törlése', { small: true, click: () => st.clearHistory(Date.now() - 3600000) }),
      btn('Mind törlése', { small: true, variant: 'danger', click: async () => { if (await confirmDel('Az összes előzmény')) st.clearHistory(); } })),
    h('div.vb-row', { style: { padding: 0 } }, filt), list));
    draw();
    return out;
  }

  // ------------------------------------------------------------------ Olvasó: the reading list and the reader
  function reader(ctx, p, go, rest) {
    if (rest) return readItem(ctx, ctx.st.readingItem(rest), go);
    if (p.url) return readUrl(ctx, p.url, go, null, { part: p.part || '', job: p.job || '' });
    if (p.doc) return readDoc(ctx, p.doc, go);
    const st = ctx.st;
    const out = h('div.vb-view');
    const show = p.show || 'unread';
    const url = h('input.vb-input', { type: 'url', placeholder: 'https://… — olvasásra', 'aria-label': 'Cím olvasásra' });
    const form = h('form.vb-row', { style: { padding: 0 }, on: { submit: e => {
      e.preventDefault();
      const u = VB.url.asUrl(url.value.trim());
      if (!u) { toast('warn', 'Érvénytelen cím', url.value); return; }
      const clean = ctx.on('clean') ? VB.url.clean(u).url : u;
      if (ctx.on('reader')) go('#/olvaso?url=' + encodeURIComponent(clean));
      else { st.addReading({ url: clean, title: VB.url.hostOf(clean) }); url.value = ''; }
    } } }, url, btn(ctx.on('reader') ? 'Olvasás' : 'Listára', { variant: 'primary', icon: ctx.on('reader') ? 'eye' : 'plus', on: { click: () => form.requestSubmit() } }));
    const items = st.reading().filter(r => show === 'all' || (show === 'pdf' ? r.kind === 'pdf' || !!r.part : show === 'read' ? r.read : !r.read));
    out.append(sec('Olvasólista', st.reading().length + ' db · ' + st.reading().filter(r => r.text).length + ' offline mentve', libraryButtons(ctx),
      h('div.vb-stack', null, form,
        ctx.on('reader') ? null : h('p.vb-note', null, ctx.kind === 'mobile' ? 'A telefonon az Olvasó nézet a mentett szöveget mutatja; új oldalt a PC tud letölteni (helyi szerver).' : 'Az Olvasó nézethez a helyi szerver kell (START → W → B).'),
        h('div.vb-chips', null, [['unread', 'Olvasatlan'], ['read', 'Elolvasott'], ['pdf', 'Adatlapok'], ['all', 'Mind']].map(([k, l]) => btn(l, { pressed: show === k, click: () => go('#/olvaso?show=' + k) }))),
        items.length ? h('div.vb-list', null, items.map(r => row(r.title, r.url, [r.kind === 'pdf' ? h('span.vb-tag.vb-tag--kind', null, 'PDF') : null, r.part ? h('span.vb-tag', null, r.part) : null, r.text ? h('span.vb-tag.vb-tag--kind', null, 'offline · ' + Math.max(1, Math.round(r.text.split(/\s+/).length / 200)) + ' perc') : null, ...tagEls(r), h('span.vb-tag', null, when(r.added))],
          () => go('#/olvaso/' + r.id),
          [btn(r.read ? 'Olvasatlannak jelöl' : 'Elolvasottnak jelöl', { iconOnly: true, icon: 'ok', small: true, pressed: r.read, click: () => st.updateReading(r.id, { read: !r.read }) }),
            btn('Eredeti oldal', { iconOnly: true, icon: 'external', small: true, click: () => ctx.open(r.url, { title: r.title, via: 'reading' }) }),
            btn('Törlés', { iconOnly: true, icon: 'trash', small: true, variant: 'danger', click: async () => { if (await confirmDel(r.title)) st.removeReading(r.id); } })]))) : empty('Nincs ilyen olvasnivaló.'))));
    return out;
  }
  // one article: the saved text, or fetched now through serve.js
  function readItem(ctx, r, go) {
    if (!r) return h('div.vb-view', null, empty('Ez az olvasnivaló már nincs a listán.'), btn('Vissza a listához', { click: () => go('#/olvaso') }));
    if (r.text) {
      const blocks = r.text.split('\n').filter(Boolean).map(line => { const m = /^(#{1,3}) (.*)$/.exec(line); return m ? { t: 'h' + (m[1].length + 1), text: m[2] } : /^• /.test(line) ? { t: 'li', text: line.slice(2) } : { t: 'p', text: line }; });
      if (!r.read) setTimeout(() => ctx.st.updateReading(r.id, { read: true }), 1500);
      return article(ctx, { title: r.title, url: r.url, site: r.site, blocks, saved: r.saved, kind: r.kind }, go, r);
    }
    if (ctx.on('reader')) return readUrl(ctx, r.url, go, r);
    return h('div.vb-view', null, sec(r.title, VB.url.display(r.url), null, h('p.vb-note', null, 'Ennek az oldalnak nincs mentett szövege, és itt nincs helyi szerver a letöltéshez.'),
      h('div.vb-actions', null, btn('Eredeti oldal', { variant: 'primary', icon: 'external', click: () => ctx.open(r.url, { title: r.title, via: 'reading' }) }), btn('Vissza', { click: () => go('#/olvaso') }))));
  }
  function readUrl(ctx, url, go, item, link) {
    const box = h('div.vb-view', null, h('div.vb-hero', null, h('span.vk-label', null, 'OLVASÓ NÉZET'), h('h1', null, 'Betöltés…'), h('p', null, VB.url.display(url))));
    ctx.api('/api/reader', { url }, 20000).then(j => {
      box.textContent = '';
      if (!j.ok) {
        box.append(sec('Olvasó nézet', VB.url.display(url), null, h('div.vb-warn', { 'data-level': 'warn' }, icon('warning'), j.hu || 'Nem olvasható.'),
          h('div.vb-actions', null, btn('Eredeti oldal', { variant: 'primary', icon: 'external', click: () => ctx.open(url, { via: 'reader' }) }), btn('Vissza', { click: () => (root.history.length > 1 ? root.history.back() : go('#/olvaso')) }))));
        return;
      }
      box.append(article(ctx, Object.assign(j, link || {}), go, item));
    });
    return box;
  }
  function readDoc(ctx, path, go) {
    const box = h('div.vb-view', null, h('p.vb-note', null, 'Betöltés: ' + path));
    ctx.api('/api/doc', { path }).then(j => {
      box.textContent = '';
      if (!j.ok) { box.append(empty(j.hu || 'A dokumentum nem érhető el.')); return; }
      box.append(article(ctx, { title: j.title, url: '', site: path, blocks: j.blocks, words: j.words, doc: path }, go));
    });
    return box;
  }
  function article(ctx, a, go, item) {
    const st = ctx.st;
    let scale = +(sessionStorageGet('vb-scale') || 1);
    const body = h('div.vb-reader', { style: { '--vb-scale': String(scale) } });
    const setScale = d => { scale = Math.min(1.6, Math.max(0.8, Math.round((scale + d) * 10) / 10)); body.style.setProperty('--vb-scale', String(scale)); sessionStorageSet('vb-scale', String(scale)); };
    const minutes = Math.max(1, Math.round((a.words || a.blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0)) / 200));
    const saveText = () => a.blocks.map(b => (b.t === 'h1' || b.t === 'h2' ? '# ' : b.t === 'h3' ? '## ' : b.t === 'li' ? '• ' : '') + b.text.replace(/\n/g, ' ')).join('\n');
    const bar = h('div.vb-reader__bar', null,
      btn('Vissza', { icon: 'arrow-left', small: true, click: () => go('#/olvaso') }),
      a.url ? btn('Eredeti oldal', { icon: 'external', small: true, click: () => ctx.open(a.url, { title: a.title, via: 'reader' }) }) : null,
      a.url && !a.doc ? btn(item && item.text ? 'Mentve offline' : 'Mentés offline', { icon: 'save', small: true, pressed: !!(item && item.text), click: () => {
        const r = st.addReading({ url: a.url, title: a.title, site: a.site, excerpt: a.excerpt, text: saveText(), kind: a.kind, part: a.part || (item && item.part) || '', job: a.job || (item && item.job) || '' });
        toast(r ? 'ok' : 'warn', r ? 'Mentve offline' : 'Nem fér el', r ? 'Az olvasólistán, internet nélkül is olvasható, és a keresőben teljes szövegben.' : 'A tároló megtelt: törölj régi mentett oldalakat.');
      } }) : null,
      a.url ? btn('Könyvjelző', { icon: 'star', small: true, pressed: !!st.bookmark(a.url), click: () => { if (st.addBookmark({ url: a.url, title: a.title })) toast('ok', 'Könyvjelző mentve', a.title); } }) : null,
      item ? btn('Szerkesztés', { icon: 'edit', small: true, click: () => editItem(ctx, item, 'reading') }) : null,
      ctx.on('qr') && a.url ? btn('Telefonra', { icon: 'phone', small: true, click: () => qr(ctx, a.url, a.title) }) : null,
      ctx.on('research') && a.url ? btn('Kutatáshoz', { icon: 'bulb', small: true, click: () => VB.knowledge.addSource(ctx, { url: a.url, title: a.title, excerpt: a.excerpt }) }) : null,
      VB.knowledge ? btn('Claude-nak', { icon: 'send', small: true, click: () => VB.knowledge.toClaude(ctx, a.title || 'Oldal', (a.url ? 'Forrás: ' + a.url + '\n\n' : '') + saveText()) }) : null,
      ctx.on('watch') && a.url && !a.doc ? btn('Figyelés', { icon: 'bell', small: true, click: () => VB.knowledge.watchPage(ctx, a.url, a.title) }) : null,
      h('span.vb-grow'),
      btn('Kisebb betű', { iconOnly: true, icon: 'zoom-out', small: true, click: () => setScale(-0.1) }),
      btn('Nagyobb betű', { iconOnly: true, icon: 'zoom-in', small: true, click: () => setScale(0.1) }));
    body.append(h('h1', null, a.title || VB.url.display(a.url)),
      h('div.vb-reader__meta', null, a.site ? h('span', null, a.site) : null, a.url ? h('span', null, VB.url.hostOf(a.url)) : null, a.byline ? h('span', null, a.byline) : null, a.kind === 'pdf' ? h('span', null, 'PDF' + (a.pages ? ' · ' + a.pages + ' oldal' : '')) : null, a.part ? h('a', { href: '#/alkatreszek/' + a.part }, a.part) : null, h('span', null, '≈ ' + minutes + ' perc olvasás'),
        a.saved ? h('span', null, 'mentve ' + when(a.saved)) : null));
    for (const b of a.blocks) {
      const tag = b.t === 'quote' ? 'blockquote' : b.t === 'li' ? 'div' : b.t;
      body.appendChild(h(/^(h1|h2|h3|p|pre|blockquote|div)$/.test(tag) ? tag : 'p', { role: b.t === 'li' ? 'listitem' : null, class: b.t === 'li' ? 'vb-li' : null }, b.text));
    }
    if (a.links && a.links.length) body.append(h('h3', null, 'Hivatkozások'), h('div.vb-list', null, a.links.slice(0, 30).map(l => row(l.text || VB.url.display(l.url), l.url, null, () => ctx.open(l.url, { title: l.text, via: 'reader-link' })))));
    const quote = ctx.on('research') && a.url ? VB.knowledge.quoteOnSelect(ctx, body, a) : null;
    return h('div.vb-view', null, bar, body, quote);
  }
  function sessionStorageGet(k) { try { return root.sessionStorage.getItem(k); } catch (e) { return null; } }
  function sessionStorageSet(k, v) { try { root.sessionStorage.setItem(k, v); } catch (e) {} }

  // ------------------------------------------------------------------ Telefonra: a QR of the URL
  function qr(ctx, url, title) {
    const r = VB.qr && VB.qr.qrEncode(url, { ecc: 'M', border: 2 });
    if (!r || !r.ok) { toast('warn', 'QR', (r && r.err) || 'Nem készíthető.'); return; }
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + r.w + ' ' + r.w); svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR-kód: ' + url);
    const bg = document.createElementNS(ns, 'rect'); bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#ffffff');
    const path = document.createElementNS(ns, 'path');
    const d = [];
    for (let y = 0; y < r.n; y++) for (let x = 0; x < r.n; x++) if (r.get(x, y)) d.push('M' + (x + r.border) + ',' + (y + r.border) + 'h1v1h-1z');
    path.setAttribute('d', d.join('')); path.setAttribute('fill', '#000000');
    svg.append(bg, path);
    const local = VB.url.isPrivateHost(new URL(url).hostname);
    dialog('Telefonra', h('div.vb-stack', null, h('div.vb-qr', null, svg), h('p.vb-note', null, title || ''), h('p.vb-note.vb-code', null, VB.url.display(url)),
      local ? h('div.vb-warn', { 'data-level': 'warn' }, 'Helyi cím: a telefon csak ugyanazon a hálózaton, a PC címével éri el (VRG Mobile → Localhost).') : h('p.vb-note', null, 'Olvasd be a telefon kamerájával, vagy a VRG Mobile QR beolvasójával.')));
  }

  // ------------------------------------------------------------------ Részek (T8): what each part of this build may do
  const NEED_HU = { net: 'hálózat', web: 'weboldalak', storage: 'tárhely ezen az eszközön' };
  const hostHu = x => (x === '*' ? 'bármely oldal, amit megnyitsz' : x === 'self' ? 'a saját gazdája (Asztal / helyi szerver)' : x === '127.0.0.1:*' ? 'a PC helyi szerverei' : x === '127.0.0.1:8812' ? 'a helyi szerver (:8812)' : x);
  function parts(ctx, set) {
    const list = (ctx.mods && ctx.mods.parts) || [];
    const plugins = list.filter(x => x.kind === 'plugin');
    const core = list.filter(x => x.kind === 'core');
    const needs = x => (x.needs.length ? x.needs.map(n => NEED_HU[n] || n).join(', ') + (x.hosts.length ? ' — ' + x.hosts.map(hostHu).join(', ') : '') : 'semmi: helyben számol');
    const coreNeeds = { needs: [...new Set(core.flatMap(x => x.needs))], hosts: [...new Set(core.flatMap(x => x.hosts))] };
    const left = (ctx.mods && ctx.mods.without) || [];
    return sec('Részek', 'modules.json · ' + list.length + ' rész', null, h('div.vb-settings', null,
      set('Alap (' + core.length + ' rész)', 'Mindig benne van. Mit használ: ' + needs(coreNeeds) + '.', h('span.vk-lamp', { 'data-tone': 'ok' })),
      plugins.map(x => set(x.hu, x.desc + ' Mit használ: ' + needs(x) + '.', h('span.vk-lamp', { 'data-tone': 'ok' }))),
      left.length ? set('Kihagyva ebből a változatból', left.join(', '), h('span.vk-lamp', { 'data-tone': 'off' })) : null));
  }

  // ------------------------------------------------------------------ Beállítások
  function settings(ctx, p, go) {
    const st = ctx.st, s = st.settings();
    const out = h('div.vb-view');
    const set = (title, hint, control) => h('div.vb-set', null, h('div.vb-set__txt', null, h('span', null, title), hint ? h('small', null, hint) : null), control);
    const select = (value, options, change, label) => { const el = h('select.vb-select', { 'aria-label': label, on: { change: () => change(el.value) } }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l))); return el; };
    const groups = {};
    for (const e of ctx.engines) (groups[e.group] = groups[e.group] || []).push(e);
    const engSel = h('select.vb-select', { 'aria-label': 'Alapértelmezett kereső', on: { change: () => { st.set('engine', engSel.value); st.set('engineChosen', true); toast('ok', 'Alapértelmezett kereső', ctx.engine().hu); } } },
      Object.entries(groups).map(([g, list]) => h('optgroup', { label: (ctx.data.groups || {})[g] || g }, list.map(e => h('option', { value: e.id, selected: e.id === ctx.engine().id }, e.hu + '  !' + (e.bangs || [])[0])))));
    out.append(h('div.vb-actions', null, [['elozmenyek', 'Előzmények', 'history'], ['kutatas', 'Kutatás', 'bulb', 'research'], ['figyeles', 'Figyelés', 'bell', 'watch'], ['sugo', 'Súgó', 'question']]
      .filter(x => !x[3] || ctx.on(x[3])).map(([id, l, ic]) => btn(l, { icon: ic, small: true, click: () => go('#/' + id) }))));
    out.append(sec('Beállítások', 'ezen az eszközön, ' + ctx.caps.name, null, h('div.vb-settings', null,
      set('Alapértelmezett kereső', 'A címsor ezzel keres, ha nincs !bang.', engSel),
      set('Előzmények mentése', 'Ami a VRG Böngészőből nyílik, megjegyzi (legfeljebb ' + st.LIMITS.history + ').', toggle(s.history, v => st.set('history', v), 'Előzmények mentése')),
      set('Téma', 'A VRG UI Kit témái.', select(s.theme, [['melyviz', 'Mélyvíz'], ['dark', 'Éj'], ['light', 'Papír'], ['contrast', 'Kontraszt']], v => { st.set('theme', v); VB.main.applyLook(ctx); }, 'Téma')),
      set('Sűrűség', 'Automatikus: érintőképernyőn és keskeny ablakban nagyobb célpontok.', select(s.density, [['auto', 'Automatikus'], ['comfortable', 'Kényelmes'], ['compact', 'Tömör'], ['touch', 'Érintés']], v => { st.set('density', v); VB.main.applyLook(ctx); }, 'Sűrűség')),
      ctx.kind === 'desktop' ? set('Helyi szerver címe', 'Az Olvasó és a dokumentumkereső innen kérdez (alapból http://127.0.0.1:8812).', serverInput(ctx)) : null)));

    out.append(sec('Modulok', 'mindegyik külön kapcsolható', null, h('div.vb-settings', null, ctx.MODULES.map(m => {
      const avail = ctx.available(m.id);
      const t = toggle(ctx.on(m.id), v => { st.setModule(m.id, v); ctx.rebuild(); }, m.hu);
      if (!avail) t.disabled = true;
      return set(m.hu, m.desc + (avail ? '' : ' — ezen az eszközön nem érhető el.'), t);
    }))));
    out.append(parts(ctx, set));

    const used = st.usage();
    const status = h('span', null, '…');
    if (ctx.caps.api !== null) ctx.health().then(j => { status.textContent = j.ok ? 'fut · v' + j.version + ' · ' + j.docs + ' dokumentum' : 'nem fut'; });
    else status.textContent = 'ezen az eszközön nincs';
    out.append(sec('Adatok', null, null, h('div.vb-settings', null,
      set('Tároló', st.ok ? 'localStorage, ezen az eszközön · ' + Math.round(used / 1024) + ' kB' : 'Nem írható: a lap bezárásakor minden elvész.', h('span.vk-lamp', { 'data-tone': st.ok ? 'ok' : 'warn' })),
      set('Helyi szerver (:8812)', 'Olvasó nézet, dokumentumkereső, webes javaslatok.', status),
      set('Könyvjelzők és előzmények', ctx.sync && ctx.sync.status().mode === 'master' ? 'Az Asztal web.json-ja a fő példány (BRW-Q01): ami itt változik, oda megy, és az Asztal Böngésző paneljének előzményei itt is látszanak. ' + ctx.sync.status().hu + '.' : 'Ezen az eszközön; az Asztallal fájlban cserélhető (vrg.web-links v1).',
        h('span.vk-lamp', { 'data-tone': ctx.sync && ctx.sync.status().mode === 'master' ? (ctx.sync.status().ok ? 'ok' : 'warn') : 'off' })),
      set('Mentés és betöltés', 'Egy vrg.web-links v1 fájl: könyvjelzők és előzmények (az Asztal és a Data Vault is olvassa), mellette a címkék, munkaszámok, az olvasólista és a kitűzések. Az Asztal web.json-ja és a régi VRG Böngésző mentés is betölthető.', libraryButtons(ctx)),
      set('Minden adat törlése', ctx.sync && ctx.sync.status().mode === 'master' ? 'Ezen az eszközön; az Asztal könyvjelzői és előzményei megmaradnak, és a következő egyeztetéskor visszajönnek.' : 'Könyvjelzők, előzmények, olvasólista és beállítások ezen az eszközön.', btn('Törlés', { variant: 'danger', icon: 'trash', click: async () => { if (await confirmDel('Minden VRG Böngésző adat ezen az eszközön')) { st.wipe(); toast('ok', 'Minden adat törölve', ''); go('#/'); } } })))));
    return out;
  }
  function serverInput(ctx) {
    const i = h('input.vb-input', { type: 'url', value: ctx.st.settings().readerServer, 'aria-label': 'Helyi szerver címe' });
    i.addEventListener('change', () => {
      const v = i.value.trim().replace(/\/+$/, '');
      if (!/^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(v)) { i.setAttribute('aria-invalid', 'true'); toast('warn', 'Csak helyi cím', 'Alakja: http://127.0.0.1:8812'); return; }
      i.removeAttribute('aria-invalid'); ctx.st.set('readerServer', v); toast('ok', 'Mentve', 'Újratöltés után érvényes.');
    });
    return i;
  }

  // ------------------------------------------------------------------ Súgó
  function help(ctx) {
    const out = h('div.vb-view');
    const rowsOf = list => list.map(([a, b]) => h('tr', null, h('td', null, h('code', null, a)), h('td', null, b)));
    out.append(h('div.vb-hero', null, h('span.vk-label', null, 'SÚGÓ'), h('h1', null, 'VRG Böngésző'),
      h('p', null, 'Önálló alkalmazás a VRG Asztalon, a VRG Mobile-on és a böngészőben. Ez a kezdőlap, a kereső és a könyvtár; a weboldalakat mindig a gazda saját böngészője jeleníti meg (' + ctx.caps.name + ': ' + ctx.caps.how + '), így annak biztonsági szabályai érvényesek.')));
    out.append(sec('A címsor', null, null, h('table.vb-table', null, h('tbody', null, rowsOf([
      ['index.hu · localhost:8808', 'cím: megnyitja (Tiszta link és Linkellenőr után)'],
      ['kábel méretezés', 'keresés az alapértelmezett keresővel'],
      ['!w Ohm-törvény · Ohm-törvény !w', 'keresés egy adott keresővel (bang)'],
      ['230V 16A · 3x400V 10kW cos 0,9', 'Gyorsválasz: teljesítmény, áram'],
      ['2,5mm2 30m 16A · 1,5mm2 25m 10A al', 'Gyorsválasz: feszültségesés (Cu / Al), irányértékkel'],
      ['230V 50ohm · 12 awg · 2,5 mm2 awg', 'Ohm-törvény, AWG ↔ mm²'],
      ['= 2,5*(3+4) · 100 c f · 5 kW LE · 10 inch mm', 'számológép és átváltás'],
      ['vrg:konyvjelzok · vrg:olvaso · vrg:sugo', 'a VRG Böngésző saját oldalai'],
    ])))));
    out.append(sec('Billentyűk', null, null, h('table.vb-table', null, h('tbody', null, rowsOf([
      ['Ctrl+L vagy /', 'a címsorba'], ['↓ ↑ · Enter', 'javaslat választása, futtatása'], ['Alt+Enter', 'Minden találat a Keresés lapon'],
      ['Tab (kereső soron)', 'a bang a sor elejére'], ['Esc', 'bezárás; újra: törlés'], ['Shift+nyilak', 'ugrás a területek között'],
    ])))));
    out.append(sec('Keresők és bangek', ctx.engines.length + ' kereső', null, h('table.vb-table', null,
      h('thead', null, h('tr', null, h('th', null, 'Bang'), h('th', null, 'Kereső'), h('th', null, 'Csoport'))),
      h('tbody', null, ctx.engines.map(e => h('tr', null, h('td', null, h('code', null, (e.bangs || []).map(b => '!' + b).join(' '))), h('td', null, e.hu + (e.private ? ' · nem követ' : '')), h('td', null, (ctx.data.groups || {})[e.group] || e.group)))))));
    out.append(sec('Adatvédelem', null, null, h('div.vb-stack', null,
      h('p.vb-note', null, 'Minden adat (könyvjelzők, előzmények, olvasólista) ezen az eszközön marad, a VRG Böngésző saját tárolójában; semmit nem küld sehova.'),
      h('p.vb-note', null, 'A webes javaslatok alapból ki vannak kapcsolva: bekapcsolva minden leütés a keresőhöz megy (a helyi szerveren át, süti nélkül).'),
      h('p.vb-note', null, 'Az Olvasó nézet a helyi szerveren (:8812) át tölti le az oldalt: csak nyilvános címet, a PC-re és a helyi hálózatra nem megy, és nem őriz másolatot.'))));
    out.append(h('p.vb-note', null, 'v' + (ctx.data.version || '?') + ' · építve ' + (ctx.data.built || '?') + ' · Browser/README.md'));
    return out;
  }

  VB.views = { home, search, bookmarks, history, reader, settings, help, qr, ping,
    kit: { sec, empty, tagEls, row, tile, bookmarkRow, editItem, libraryButtons, confirmDel, readUrl } };
})(typeof window !== 'undefined' ? window : globalThis);
