// share.js (app) — T9: the Megosztás page (#/megosztas). Three parts, all through serve.js (the shared OneDrive tree is on the PC):
//   Lista megosztása   a named list (bookmarks and / or reading list, narrowed by a tag or a job) → VRG-Megosztott\60_Linkek,
//                      with everything it holds (BRW-Q07 = C: tags, job codes, notes, saved text; never the history)
//   Közös listák       every list in 60_Linkek: look into it, open a link, or merge it into this device (nothing is lost)
//   Vendégoldal        the same picker → 00_START\linkek.html, the page the Kapu's "Linkek (vendég)" button opens without a
//                      sign-in (BRW-Q05 = A). A preview shows exactly what goes and what stays out, and why; the server
//                      filters it again with the PC's job codes.
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.shareView) return;
  const { h, btn, toast, dialog, when } = VB.ui;
  const K = () => VB.views.kit;

  function picker(ctx, onChange) {
    const st = ctx.st;
    const from = h('select.vb-select', { 'aria-label': 'Mit', on: { change: () => onChange() } },
      [['both', 'Könyvjelzők és olvasólista'], ['bookmarks', 'Csak könyvjelzők'], ['reading', 'Csak olvasólista']].map(([v, l]) => h('option', { value: v }, l)));
    const tag = h('input.vb-input', { type: 'text', placeholder: 'címke (nem kötelező)', 'aria-label': 'Címke', on: { input: () => onChange() } });
    const jobs = st.jobs().map(j => j[0]);
    const job = h('select.vb-select', { 'aria-label': 'Munka', on: { change: () => onChange() } }, [h('option', { value: '' }, 'minden munka')].concat(jobs.map(c => h('option', { value: c }, c))));
    const doc = () => VB.share.pick(st.exportAll(), { from: from.value, tag: tag.value, job: job.value });
    return { el: h('div.vb-row', { style: { padding: 0, flexWrap: 'wrap', gap: '8px' } }, from, tag, job), doc };
  }

  const count = d => d.bookmarks.length + ((d['x-bongeszo'] || {}).reading || []).length;

  function shareList(ctx, reload) {
    const name = h('input.vb-input', { type: 'text', placeholder: 'A lista neve, pl. Napelem adatlapok', 'aria-label': 'A lista neve' });
    const by = h('input.vb-input', { type: 'text', value: ctx.st.settings().shareBy || '', placeholder: 'ki osztja meg (nem kötelező)', 'aria-label': 'Ki osztja meg' });
    const info = h('p.vb-note');
    const p = picker(ctx, () => upd());
    const upd = () => { const d = p.doc(); info.textContent = count(d) + ' tétel megy: ' + d.bookmarks.length + ' könyvjelző, ' + (d['x-bongeszo'].reading || []).length + ' olvasnivaló — címkékkel, munkaszámmal, jegyzettel és mentett szöveggel. Az előzmények nem.'; };
    upd();
    const go = btn('Megosztás a közös mappába', { variant: 'primary', icon: 'upload', click: async () => {
      if (!name.value.trim()) { toast('warn', 'Megosztás', 'Adj nevet a listának.'); return; }
      const d = p.doc();
      if (!count(d)) { toast('warn', 'Megosztás', 'A lista üres.'); return; }
      ctx.st.set('shareBy', by.value.trim().slice(0, 60));
      const r = await ctx.post('/api/shared', { name: name.value, by: by.value, doc: d });
      toast(r.ok ? 'ok' : 'warn', 'Megosztás', r.hu || '');
      if (r.ok) reload();
    } });
    return K().sec('Lista megosztása', '60_Linkek · csak akiknek a mappa meg van osztva', null, h('div.vb-stack', null,
      h('label.vb-stack', null, 'Név', name), h('label.vb-stack', null, 'Ki osztja meg', by), p.el, info, h('div.vb-actions', null, go)));
  }

  function lists(ctx, go) {
    const box = h('div', null, h('p.vb-note', null, 'Betöltés…'));
    const load = () => ctx.api('/api/shared').then(j => {
      box.textContent = '';
      if (!j.ok) { box.appendChild(K().empty(j.hu || 'Nem érhető el.')); return; }
      if (!j.lists.length) { box.appendChild(K().empty('Még nincs közös lista a ' + j.folder + ' mappában.')); return; }
      box.appendChild(h('div.vb-list', null, j.lists.map(l => l.bad ? h('div.vb-row', null, h('div.vb-row__main', null, h('span.vb-row__title', null, l.file), h('span.vb-row__snip', null, l.hu))) :
        h('div.vb-row', null, h('div.vb-row__main', null,
          h('span.vb-row__title', null, l.name),
          h('div.vb-row__meta', null, l.by ? h('span.vb-tag', null, l.by) : null, h('span.vb-tag', null, l.bookmarks + ' könyvjelző'), h('span.vb-tag', null, l.reading + ' olvasnivaló'),
            l.mtime ? h('span.vb-tag', null, when(l.mtime)) : null)),
        h('div.vb-row__acts', null,
          btn('Megnézés', { small: true, icon: 'eye', click: () => look(ctx, l) }),
          btn('Betöltés ide', { small: true, icon: 'download', click: () => merge(ctx, l) }))))));
    });
    load();
    return { el: K().sec('Közös listák', '60_Linkek', btn('Frissítés', { small: true, iconOnly: true, icon: 'refresh', click: load }), box), load };
  }

  async function look(ctx, l) {
    const j = await ctx.api('/api/shared', { file: l.file });
    if (!j.ok) { toast('warn', l.name, j.hu || ''); return; }
    const ext = j.doc['x-bongeszo'] || {};
    const rows = (j.doc.bookmarks || []).map(b => ({ url: b.url, title: b.title, note: ((ext.meta || {})[b.url] || {}).note })).concat((ext.reading || []).map(r => ({ url: r.url, title: r.title, note: r.note })));
    dialog(l.name, h('div.vb-list', null, rows.slice(0, 300).map(r => K().row(r.title || VB.url.display(r.url), r.url, r.note ? [h('span.vb-tag', null, r.note.slice(0, 80))] : null,
      () => ctx.open(r.url, { title: r.title, via: 'shared' })))), [{ label: 'Bezárás', value: null }]);
  }

  async function merge(ctx, l) {
    const j = await ctx.api('/api/shared', { file: l.file });
    if (!j.ok) { toast('warn', l.name, j.hu || ''); return; }
    const r = ctx.st.importAll(j.doc);
    toast(r.ok ? 'ok' : 'warn', l.name, r.hu);
  }

  function guestPage(ctx) {
    const title = h('input.vb-input', { type: 'text', value: 'Linkgyűjtemény', 'aria-label': 'A vendégoldal címe' });
    const prev = h('div.vb-stack');
    const p = picker(ctx, () => upd());
    const upd = () => {
      const g = VB.share.guest(p.doc(), { jobs: ctx.st.jobs().map(j => j[0]) });
      prev.textContent = '';
      prev.append(h('p.vb-note', null, g.items.length + ' link kerül a vendégoldalra' + (g.dropped.length ? ', ' + g.dropped.length + ' kimarad:' : '.')),
        g.dropped.length ? h('div.vb-warns', null, g.dropped.slice(0, 50).map(d => h('div.vb-warn', { 'data-level': 'warn' }, (d.title || VB.url.display(d.url)) + ' — ' + d.hu))) : null,
        g.items.length ? h('div.vb-list', null, g.items.slice(0, 50).map(x => K().row(x.title, x.url, null, () => ctx.open(x.url, { title: x.title, via: 'guest' })))) : null);
    };
    upd();
    const status = h('span.vb-note');
    ctx.api('/api/guest').then(j => { status.textContent = j.ok ? (j.exists ? 'Most: ' + j.where + ', ' + when(j.at) : 'Még nincs vendégoldal.') : (j.hu || ''); });
    const go = btn('Vendégoldal mentése', { variant: 'primary', icon: 'save', click: async () => {
      const g = VB.share.guest(p.doc(), { jobs: ctx.st.jobs().map(j => j[0]) });
      const ok = await dialog('Vendégoldal', h('div.vb-stack', null, h('p.vb-note', null, g.items.length + ' link kerül a 00_START\\linkek.html oldalra. Bárki láthatja, aki a Kapu fájlt megkapja, belépés nélkül. Az előző vendégoldalt felülírja (a OneDrive megőrzi a korábbi változatot).')),
        [{ label: 'Mégse', value: false }, { label: 'Mentés', value: true, variant: 'primary' }]);
      if (!ok) return;
      const r = await ctx.post('/api/guest', { title: title.value, doc: p.doc() });
      toast(r.ok ? 'ok' : 'warn', 'Vendégoldal', r.hu || '');
      if (r.ok) status.textContent = 'Most: ' + r.where + ', most mentve.';
    } });
    return K().sec('Vendégoldal', '00_START\\linkek.html · a Kapu „Linkek (vendég)” gombja', null, h('div.vb-stack', null,
      h('p.vb-note', null, 'Nyilvános linkek belépés nélkül. Kimarad: ami nem https, ez a gép vagy a helyi hálózat, magán tárhely (Drive, OneDrive, Dropbox …), titkosnak látszó paraméter, munkaszám vagy munkához kötött link. Jegyzet és címke nem kerül rá.'),
      h('label.vb-stack', null, 'Cím', title), p.el, prev, h('div.vb-actions', null, go, status)));
  }

  function page(ctx, p, go) {
    const out = h('div.vb-view');
    out.append(h('div.vb-hero', null, h('span.vk-label', null, 'MEGOSZTÁS'), h('h1', null, 'Linkek megosztása'),
      h('p', null, 'Listák a közös OneDrive mappában (VRG-Megosztott\\60_Linkek) annak, akivel a mappa meg van osztva, és egy vendégoldal a Kapu mellé, amit belépés nélkül bárki megnyithat.')));
    if (!ctx.on('share')) { out.append(K().empty('A megosztás a PC közös OneDrive mappájába ír: a helyi szerverrel (:8812, START → W → B → S) vagy az Asztalban érhető el.')); return out; }
    const l = lists(ctx, go);
    out.append(shareList(ctx, l.load), l.el, guestPage(ctx));
    return out;
  }

  VB.shareView = { page };
  Object.assign(VB.views, { share: page });
})(typeof window !== 'undefined' ? window : globalThis);
