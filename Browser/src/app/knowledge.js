// knowledge.js — Phase 3 of the T line (docs/browser/TRAJECTORIES.md): knowledge and AI (T5), watching the web (T6).
//   #/kutatas            the research notebooks       #/kutatas/<id>   one notebook: notes, quotes, sources; the exports
//   #/figyeles           page watches the VRG Asztal runs (its feed registry, Hírek pane, the phone's Értesítések)
// The reader calls in here: a selected passage → a quote with its source, the page → a source, the page or a notebook → Claude,
// the page → a watch. Claude: in the Asztal a context pack attached to the chat pane (vrg-app://browser/__vrg/claude, nothing is
// sent until the user asks); elsewhere the text goes to the clipboard and claude.ai can be opened.
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.knowledge) return;
  const { h, icon, btn, toast, dialog, when, giveFile } = VB.ui;
  const K = () => VB.views.kit;

  // ------------------------------------------------------------------ Claude
  async function toClaude(ctx, title, text) {
    if (ctx.kind === 'desktop') {
      try {
        const r = await fetch('/__vrg/claude', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, text: text.slice(0, 200000) }), credentials: 'same-origin', cache: 'no-store' });
        const j = await r.json();
        toast(j.ok ? 'ok' : 'warn', j.ok ? 'Claude csevegés' : 'Nem sikerült', j.hu || '');
        return j.ok;
      } catch (e) { toast('warn', 'Nem sikerült', 'Az Asztal nem válaszolt.'); return false; }
    }
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch (e) {}
    const go = await dialog('Küldés Claude-nak', h('div.vb-stack', null,
      h('p.vb-note', null, copied ? 'A szöveg a vágólapon (' + Math.round(text.length / 1000) + ' ezer karakter). Nyisd meg a Claude-ot, és illeszd be.' : 'A vágólap itt nem érhető el; a VRG Asztalban a csevegő panelbe kerül közvetlenül.'),
      h('p.vb-note', null, 'A VRG Asztalban (Alkalmazások → VRG Böngésző) ez egy lépés: a szöveg csomagként a Claude csevegő panelbe kerül.')),
      [{ label: 'Bezárás', value: false }, { label: 'claude.ai megnyitása', value: true, variant: 'primary' }]);
    if (go) ctx.open('https://claude.ai/new', { title: 'Claude', via: 'claude', quiet: true });
    return copied;
  }

  // ------------------------------------------------------------------ the notebook picker (quote / source)
  async function pickNotebook(ctx) {
    const st = ctx.st;
    const list = st.notebooks();
    const sel = h('select.vb-select', { 'aria-label': 'Kutatás' }, list.map(n => h('option', { value: n.id, selected: n.id === st.settings().notebook }, n.title + ' (' + n.items.length + ')')), h('option', { value: '' }, '+ Új kutatás…'));
    const title = h('input.vb-input', { type: 'text', placeholder: 'Az új kutatás címe', 'aria-label': 'Új kutatás címe' });
    const showNew = () => { title.hidden = sel.value !== ''; };
    sel.addEventListener('change', showNew);
    if (!list.length) sel.value = '';
    showNew();
    const ok = await dialog('Melyik kutatásba?', h('div.vb-stack', null, sel, title), [{ label: 'Mégse', value: false }, { label: 'Hozzáadás', value: true, variant: 'primary' }]);
    if (!ok) return null;
    if (sel.value) return sel.value;
    const n = st.addNotebook({ title: title.value || 'Kutatás ' + new Date().toISOString().slice(0, 10) });
    return n ? n.id : null;
  }
  async function addQuote(ctx, q) {
    const id = await pickNotebook(ctx);
    if (!id) return;
    const r = ctx.st.addToNotebook(id, { kind: 'quote', text: q.text, url: q.url, title: q.title });
    toast(r ? 'ok' : 'warn', r ? 'Idézet a kutatásban' : 'Nem fér el', r ? ctx.st.notebook(id).title : 'Legfeljebb 300 elem egy kutatásban.');
  }
  async function addSource(ctx, s) {
    const id = await pickNotebook(ctx);
    if (!id) return;
    const r = ctx.st.addToNotebook(id, { kind: 'source', url: s.url, title: s.title, text: s.excerpt || '' });
    toast(r ? 'ok' : 'warn', r ? 'Forrás a kutatásban' : 'Nem sikerült', ctx.st.notebook(id) ? ctx.st.notebook(id).title : '');
  }
  async function watchPage(ctx, url, title) {
    if (!ctx.on('watch')) { toast('info', 'Figyelés', 'A figyelést a VRG Asztal futtatja: a helyi szerverrel (:8812) vagy az Asztalban érhető el.'); return; }
    const every = h('select.vb-select', { 'aria-label': 'Milyen gyakran' }, [[60, 'óránként'], [360, '6 óránként'], [1440, 'naponta'], [10080, 'hetente']].map(([v, l]) => h('option', { value: v, selected: v === 1440 }, l)));
    const name = h('input.vb-input', { type: 'text', value: title || VB.url.hostOf(url), 'aria-label': 'Megnevezés' });
    const ok = await dialog('Oldal figyelése', h('div.vb-stack', null, h('p.vb-note', null, VB.url.display(url)),
      h('label.vb-stack', null, 'Megnevezés', name), h('label.vb-stack', null, 'Ellenőrzés', every),
      h('p.vb-note', null, 'A VRG Asztal futtatja: ha az oldal szövege változik, a Hírek panelen és a telefon Értesítéseiben jelzi. Az oldal gazdagépe a figyelés idejére engedélyezett lesz.')),
    [{ label: 'Mégse', value: false }, { label: 'Figyelés', value: true, variant: 'primary' }]);
    if (!ok) return;
    const r = await ctx.post('/api/watch', { url, hu: name.value, every: +every.value });
    toast(r.ok ? 'ok' : 'warn', r.ok ? 'Figyelés' : 'Nem sikerült', r.hu || '');
  }

  // a selected passage in the reader → a floating "Idézet" button (mouse and touch)
  function quoteOnSelect(ctx, body, a) {
    const b = h('button.vk-btn.vb-quote-btn', { type: 'button', hidden: true, 'data-variant': 'primary' }, icon('edit'), 'Idézet a kutatásba');
    let text = '';
    const check = () => setTimeout(() => {
      const s = root.getSelection && root.getSelection();
      const t = s && !s.isCollapsed && body.contains(s.anchorNode) ? String(s).replace(/\s+\n/g, '\n').trim() : '';
      text = t.length >= 8 ? t.slice(0, 4000) : '';
      b.hidden = !text;
    }, 10);
    body.addEventListener('mouseup', check); body.addEventListener('touchend', check); body.addEventListener('keyup', check);
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => { const q = text; b.hidden = true; addQuote(ctx, { text: q, url: a.url, title: a.title }); });
    return b;
  }

  // ------------------------------------------------------------------ Kutatás
  function notebooks(ctx, p, go) {
    const { sec, empty } = K();
    const st = ctx.st;
    const out = h('div.vb-view');
    const t = h('input.vb-input', { type: 'text', placeholder: 'Mit kutatsz? pl. Túlfeszültség-védelem családi házban', 'aria-label': 'Kutatás címe' });
    const form = h('form.vb-row', { style: { padding: 0 }, on: { submit: e => { e.preventDefault(); if (!t.value.trim()) return; const n = st.addNotebook({ title: t.value }); if (n) go('#/kutatas/' + n.id); } } },
      t, btn('Új kutatás', { variant: 'primary', icon: 'plus', on: { click: () => form.requestSubmit() } }));
    const list = st.notebooks();
    out.append(h('div.vb-hero', null, h('span.vk-label', null, 'KUTATÁS'), h('h1', null, 'Kutatás'),
      h('p', null, 'Gyűjts idézeteket az Olvasóból (jelöld ki a szöveget → Idézet a kutatásba), forrásokat és saját jegyzetet; a végén egy forrásmegjelöléses Markdown jegyzet lesz belőle, ami a repó docs/research/web mappájába (és onnan a Rétegverembe), egy munka mappájába vagy Claude-hoz megy.'), form));
    out.append(sec('Kutatások', list.length + ' db', null, list.length ? h('div.vb-list', null, list.map(n => h('div.vb-row', null, h('div.vb-row__main', null,
      h('button.vb-row__title', { type: 'button', on: { click: () => go('#/kutatas/' + n.id) } }, n.title),
      h('div.vb-row__meta', null, h('span.vb-tag', null, n.items.length + ' elem'), h('span.vb-tag', null, VB.research.sources(n).length + ' forrás'), n.job ? h('span.vb-tag.vb-tag--job', null, n.job) : null, h('span.vb-tag', null, when(n.updated))))))) : empty('Még nincs kutatás.')));
    return out;
  }
  function notebook(ctx, id, go) {
    const { sec, empty } = K();
    const st = ctx.st;
    const n = st.notebook(id);
    if (!n) return h('div.vb-view', null, empty('Nincs ilyen kutatás.'), btn('Vissza', { click: () => go('#/kutatas') }));
    const out = h('div.vb-view');
    const title = h('input.vb-input', { type: 'text', value: n.title, 'aria-label': 'Cím' });
    const question = h('textarea.vb-textarea', { 'aria-label': 'Kérdés', placeholder: 'A kérdés, amire választ keresel (nem kötelező)' }); question.value = n.question;
    const job = h('input.vb-input', { type: 'text', value: n.job, placeholder: 'Munkaszám (nem kötelező): ide kerül, nem a repóba', 'aria-label': 'Munkaszám', maxlength: 8 });
    const saveHead = () => { const r = st.updateNotebook(n.id, { title: title.value || n.title, question: question.value, job: job.value }); if (job.value.trim() && r && !r.job) toast('warn', 'Munkaszám', 'Alakja: AB12.'); };
    for (const f of [title, question, job]) f.addEventListener('change', saveHead);
    const note = h('textarea.vb-textarea', { 'aria-label': 'Új jegyzet', placeholder: 'Saját jegyzet…' });
    const src = h('input.vb-input', { type: 'url', placeholder: 'https://… forrásként', 'aria-label': 'Forrás címe' });
    const md = () => VB.research.markdown(st.notebook(n.id));
    const exports = h('div.vb-actions', null,
      btn('Markdown másolása', { icon: 'copy', small: true, click: async () => { try { await navigator.clipboard.writeText(md()); toast('ok', 'Vágólapra másolva', n.title); } catch (e) { toast('warn', 'A vágólap nem érhető el', ''); } } }),
      btn('Letöltés (.md)', { icon: 'download', small: true, click: async () => { const how = await giveFile(new Date().toISOString().slice(0, 10) + '_' + n.title.replace(/[^\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ -]+/g, '').slice(0, 60) + '.md', md(), ctx.kind); toast(how === 'failed' ? 'warn' : 'ok', 'Letöltés', how === 'download' ? 'Letöltve.' : how === 'clipboard' ? 'A vágólapon.' : 'Nem sikerült.'); } }),
      ctx.caps.api === null ? null : btn(st.notebook(n.id).job ? 'Mentés a munka mappájába' : 'Mentés a repóba', { icon: 'save', small: true, variant: 'primary', click: async () => {
        const cur = st.notebook(n.id);
        if (!cur.job) {
          const ok = await dialog('Mentés a repóba', h('p.vb-note', null, 'A jegyzet a repó docs/research/web mappájába kerül, és commit után a GitHubra és a Rétegverembe. Ügyfél nevét, címét, munkaszámát ne tartalmazza: munkához kötött jegyzetnél add meg a munkaszámot, akkor a munka mappájába kerül.'),
            [{ label: 'Mégse', value: false }, { label: 'Mentés a repóba', value: true, variant: 'primary' }]);
          if (!ok) return;
        }
        const r = await ctx.post('/api/research', { title: cur.title, md: md(), job: cur.job || undefined });
        toast(r.ok ? 'ok' : 'warn', r.ok ? 'Mentve' : 'Nem sikerült', r.hu || '');
      } }),
      btn('Küldés Claude-nak', { icon: 'send', small: true, click: () => toClaude(ctx, n.title, VB.research.forClaude(st.notebook(n.id))) }),
      btn('Törlés', { icon: 'trash', small: true, variant: 'danger', click: async () => { if (await K().confirmDel(n.title)) { st.removeNotebook(n.id); go('#/kutatas'); } } }));
    out.append(h('div.vb-hero', null, h('span.vk-label', null, 'KUTATÁS'), h('div.vb-form', null, h('label', null, 'Cím', title), h('label', null, 'Munkaszám', job)), h('label.vb-stack', null, 'Kérdés', question), exports));
    const items = n.items;
    const src2 = VB.research.sources(n), num = new Map(src2.map(x => [x.url, x.n]));
    out.append(sec('Jegyzetek, idézetek, források', items.length + ' elem · ' + src2.length + ' forrás', null, h('div.vb-stack', null,
      items.length ? h('div.vb-list', null, items.map((it, i) => h('div.vb-row', null, h('div.vb-row__main', null,
        it.kind === 'quote' ? h('blockquote.vb-quote', null, it.text) : it.kind === 'note' ? h('p', { style: { margin: 0, whiteSpace: 'pre-wrap' } }, it.text) : h('span', null, 'Forrás: ', it.title || it.url),
        h('div.vb-row__meta', null, h('span.vb-tag.vb-tag--kind', null, { quote: 'idézet', note: 'jegyzet', source: 'forrás' }[it.kind]), it.url ? h('button.vb-tag', { type: 'button', title: it.url, on: { click: () => ctx.open(it.url, { title: it.title, via: 'research' }) } }, '[' + num.get(it.url) + '] ' + VB.url.hostOf(it.url)) : null, h('span.vb-tag', null, when(it.at)))),
        h('div.vb-row__acts', null, btn('Fel', { iconOnly: true, icon: 'arrow-up', small: true, disabled: i === 0, click: () => st.moveInNotebook(n.id, i, -1) && go('#/kutatas/' + n.id) }),
          btn('Le', { iconOnly: true, icon: 'arrow-down', small: true, disabled: i === items.length - 1, click: () => st.moveInNotebook(n.id, i, 1) && go('#/kutatas/' + n.id) }),
          btn('Törlés', { iconOnly: true, icon: 'trash', small: true, variant: 'danger', click: () => { st.removeFromNotebook(n.id, i); go('#/kutatas/' + n.id); } }))))) : empty('Üres. Az Olvasóban jelölj ki egy bekezdést → Idézet a kutatásba; vagy írj jegyzetet lent.'),
      h('form.vb-stack', { on: { submit: e => { e.preventDefault(); if (st.addToNotebook(n.id, { kind: 'note', text: note.value })) go('#/kutatas/' + n.id); } } }, note, h('div.vb-actions', null, btn('Jegyzet hozzáadása', { icon: 'plus', on: { click: e => e.target.closest('form').requestSubmit() } }))),
      h('form.vb-row', { style: { padding: 0 }, on: { submit: e => { e.preventDefault(); const u = VB.url.asUrl(src.value.trim()); if (!u) { toast('warn', 'Érvénytelen cím', src.value); return; } if (st.addToNotebook(n.id, { kind: 'source', url: ctx.on('clean') ? VB.url.clean(u).url : u, title: VB.url.hostOf(u) })) go('#/kutatas/' + n.id); } } },
        src, btn('Forrás', { icon: 'link', on: { click: e => e.target.closest('form').requestSubmit() } })))));
    out.append(sec('Előnézet', 'a Markdown jegyzet', null, h('pre.vb-md', null, md())));
    return out;
  }

  // ------------------------------------------------------------------ Figyelés
  function watches(ctx, p, go) {
    const { sec, empty } = K();
    const out = h('div.vb-view');
    out.append(h('div.vb-hero', null, h('span.vk-label', null, 'FIGYELÉS'), h('h1', null, 'Figyelt oldalak'),
      h('p', null, 'Jogszabály, hatósági hír, adatlap vagy ár oldala: a VRG Asztal a beállított gyakorisággal letölti, összeveti a szövegét az előzővel, és ha változott, a Hírek panelen és a telefon Értesítéseiben jelzi. Új figyelés: az Olvasóban a Figyelés gombbal, vagy itt.')));
    if (!ctx.on('watch')) { out.append(empty('A figyelést a VRG Asztal futtatja: a helyi szerverrel (:8812, START → W → B → S) vagy az Asztalban érhető el.')); return out; }
    const url = h('input.vb-input', { type: 'url', placeholder: 'https://… figyelendő oldal', 'aria-label': 'Figyelendő oldal' });
    const form = h('form.vb-row', { style: { padding: 0 }, on: { submit: e => { e.preventDefault(); const u = VB.url.asUrl(url.value.trim()); if (!u) { toast('warn', 'Érvénytelen cím', url.value); return; } watchPage(ctx, u, '').then(() => go('#/figyeles')); } } },
      url, btn('Figyelés…', { variant: 'primary', icon: 'bell', on: { click: () => form.requestSubmit() } }));
    const box = h('div', null, h('p.vb-note', null, 'Betöltés…'));
    out.append(sec('Figyelések', null, null, h('div.vb-stack', null, form, box)));
    ctx.api('/api/watch').then(j => {
      box.textContent = '';
      if (!j.ok) { box.appendChild(empty(j.hu || 'Nem érhető el.')); return; }
      if (!j.watches.length) { box.appendChild(empty('Még nincs figyelt oldal.')); return; }
      box.appendChild(h('div.vb-list', null, j.watches.map(w => h('div.vb-row', null, h('div.vb-row__main', null,
        h('button.vb-row__title', { type: 'button', title: w.url, on: { click: () => ctx.open(w.url, { title: w.hu, via: 'watch' }) } }, w.hu),
        h('span.vb-row__url', null, VB.url.display(w.url)),
        w.last ? h('span.vb-row__snip', null, (w.last.error ? '⚠ ' + w.last.error : w.last.hu) + (w.last.detail && !w.last.error ? ' — ' + w.last.detail : '')) : h('span.vb-row__snip', null, 'Még nem futott: az Asztal a következő percben indítja.'),
        h('div.vb-row__meta', null, h('span.vb-tag', null, w.every >= 1440 ? Math.round(w.every / 1440) + ' naponta' : Math.round(w.every / 60) + ' óránként'),
          w.last && w.last.at ? h('span.vb-tag', null, 'ellenőrizve ' + when(w.last.at)) : null,
          w.last && w.last.changedAt ? h('span.vb-tag.vb-tag--job', null, 'változott ' + when(w.last.changedAt)) : null)),
      h('div.vb-row__acts', null, btn('Figyelés vége', { iconOnly: true, icon: 'trash', small: true, variant: 'danger', click: async () => { const r = await ctx.post('/api/watch', { remove: w.id }); toast(r.ok ? 'ok' : 'warn', 'Figyelés', r.ok ? 'Leállítva: ' + w.hu : (r.hu || '')); go('#/figyeles'); } }))))));
    });
    return out;
  }

  function researchRoute(ctx, p, go, rest) { return rest ? notebook(ctx, rest, go) : notebooks(ctx, p, go); }
  VB.knowledge = { toClaude, addQuote, addSource, watchPage, quoteOnSelect };
  Object.assign(VB.views, { research: researchRoute, watches });
})(typeof window !== 'undefined' ? window : globalThis);
