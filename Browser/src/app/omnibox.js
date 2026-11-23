// omnibox.js — the address and search line. What it offers for a typed line, in this order:
//   Gyorsválasz (answers.js) · Megnyitás (a URL, with the Linkellenőr's notes) · Keresés (the engine or a !bang) ·
//   Saját találatok (the local index) · Dokumentumok (serve.js, async) · Webes javaslatok (serve.js, async, opt-in)
// Keys: ↓ ↑ move, Enter runs the selected line, Alt+Enter opens the Keresés page, Esc closes (again: clears),
// Tab on a search-engine line puts its bang in front. Ctrl+L or / (outside a field) focuses it.
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.omnibox) return;
  const { h, icon, highlight } = VB.ui;
  const KIND = { bm: ['star', 'Könyvjelző'], rd: ['list', 'Olvasólista'], hi: ['history', 'Előzmény'], srv: ['server', 'Helyi szerver'], ql: ['link', 'Gyorslink'], eng: ['search', 'Kereső'] };

  function mount(ctx, el, go) {
    const input = h('input', { type: 'text', id: 'vb-q', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'vb-drop', 'aria-autocomplete': 'list',
      autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go', placeholder: 'Cím, keresés, !bang vagy = számítás', 'aria-label': 'Cím vagy keresés' });
    const engBtn = h('button.vb-engine', { type: 'button', title: 'Alapértelmezett kereső (Beállítások)', on: { click: () => go('#/beallitasok') } });
    const drop = h('div.vb-drop', { id: 'vb-drop', role: 'listbox', 'aria-label': 'Javaslatok', hidden: true });
    const live = h('div.vk-sr-only', { role: 'status', 'aria-live': 'polite' });
    el.append(h('div.vb-omni__box', null, icon('search'), input, engBtn), drop, live);

    let items = [], sel = 0, seq = 0, lastQ = '';
    const showEngine = () => { const e = ctx.engine(); engBtn.textContent = e ? e.hu : '—'; };
    showEngine();
    ctx.st.on(w => { if (w === 'settings') showEngine(); });

    function close() { drop.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
    function select(i) {
      if (!items.length) return;
      sel = (i + items.length) % items.length;
      drop.querySelectorAll('.vb-opt').forEach((o, n) => o.setAttribute('aria-selected', String(n === sel)));
      const cur = drop.querySelector('#vb-opt-' + sel);
      if (cur) { input.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); }
    }
    function render(groups, answer) {
      drop.textContent = '';
      items = [];
      if (answer) drop.appendChild(answerCard(answer));
      for (const g of groups) {
        if (!g.items.length) continue;
        drop.appendChild(h('div.vb-drop__group', { role: 'presentation' }, g.label));
        for (const it of g.items) {
          const n = items.length;
          items.push(it);
          drop.appendChild(h('div.vb-opt', { id: 'vb-opt-' + n, role: 'option', 'aria-selected': String(n === 0),
            on: { mousedown: e => e.preventDefault(), click: () => run(n) } },
            icon(it.icon || 'search'),
            h('div.vb-opt__main', null, h('span.vb-opt__label', null, it.mark ? highlight(it.label, it.mark) : it.label), it.hint ? h('span.vb-opt__hint', null, it.hint) : null),
            it.key ? h('span.vb-opt__key', null, it.key) : null));
        }
      }
      sel = 0;
      const show = items.length > 0 || !!answer;
      drop.hidden = !show;
      input.setAttribute('aria-expanded', String(show));
      if (items.length) input.setAttribute('aria-activedescendant', 'vb-opt-0'); else input.removeAttribute('aria-activedescendant');
      live.textContent = items.length ? items.length + ' javaslat' : '';
    }
    function answerCard(a) {
      return h('div.vb-answer', { 'aria-live': 'polite' },
        h('span.vk-label', null, a.title),
        h('span.vb-answer__value', null, a.value),
        (a.lines || []).map(l => h('span.vb-answer__line', null, l)),
        a.warn ? h('span.vb-answer__warn', null, a.warn) : null);
    }

    // the synchronous part: everything that needs no network
    function suggest(raw) {
      const q = raw.trim();
      const groups = [];
      if (!q) {
        const recent = ctx.st.history().slice(0, 6).map(v => ({ icon: 'history', label: v.title || VB.url.display(v.url), hint: VB.url.display(v.url), run: () => ctx.open(v.url, { title: v.title, via: 'omni' }) }));
        groups.push({ label: 'Legutóbb', items: recent });
        return { groups, answer: null };
      }
      const c = VB.url.classify(q, { engines: ctx.engines, engine: ctx.st.settings().engine });
      let answer = null;
      if (ctx.on('answers') && (c.kind === 'answer' || c.kind === 'search')) answer = VB.answers.answer(c.kind === 'answer' ? '=' + c.q : q);
      const first = [];
      if (c.kind === 'url') {
        const notes = ctx.on('linkcheck') ? VB.url.assess(c.url).filter(w => w.level !== 'info') : [];
        first.push({ icon: notes.length ? 'warning' : 'external', label: 'Megnyitás: ' + VB.url.display(c.url), hint: notes.map(n => n.hu).join(' · ') || ctx.caps.how, key: 'Enter', run: () => ctx.open(c.url, { via: 'omni' }) });
        const e = ctx.engine();
        if (e) first.push({ icon: 'search', label: e.hu + ' keresés: ' + q, run: () => ctx.search(q, e, 'omni') });
      } else if (c.kind === 'internal') {
        first.push({ icon: 'home', label: 'VRG oldal: ' + c.page, run: () => go('#/' + (c.page === 'kezdolap' ? '' : c.page) + (c.arg ? '?q=' + encodeURIComponent(c.arg) : '')) });
      } else if (c.kind === 'blocked') {
        first.push({ icon: 'lock', label: c.hu, hint: q, run: () => {} });
      } else if (c.kind === 'search' && c.engine) {
        first.push({ icon: 'search', label: c.engine.hu + ' keresés: ' + (c.q || '(kezdőlap)'), hint: c.bang ? '!' + (c.engine.bangs || [])[0] + ' · ' + ctx.caps.how : c.unknownBang ? 'Ismeretlen bang: !' + c.unknownBang + ' — lásd Súgó' : ctx.caps.how, key: 'Enter',
          run: () => ctx.search(c.q, c.engine, 'omni') });
        first.push({ icon: 'list', label: 'Minden találat: ' + (c.q || q), hint: 'Saját találatok, dokumentumok és az összes kereső egy lapon', key: 'Alt+Enter', run: () => go('#/kereses?q=' + encodeURIComponent(c.q || q)) });
      } else if (c.kind === 'answer') {
        first.push({ icon: 'copy', label: 'Eredmény másolása', hint: answer && answer.copy, run: () => copy(answer && answer.copy) });
      }
      if (answer && answer.copy && c.kind !== 'answer') first.push({ icon: 'copy', label: 'Gyorsválasz másolása: ' + answer.copy, run: () => copy(answer.copy) });
      groups.push({ label: c.kind === 'url' ? 'Cím' : 'Keresés', items: first });
      if (ctx.on('local') && c.kind !== 'blocked') {
        const hits = ctx.ix.search(c.kind === 'search' && c.bang ? c.q : q, { limit: 7 });
        groups.push({ label: 'Saját találatok', items: hits.map(r => hitItem(r.doc, q)) });
      }
      return { groups, answer, c };
    }
    function hitItem(d, q) {
      const [ic, what] = KIND[d.kind] || ['link', ''];
      if (d.kind === 'eng') return { icon: ic, label: d.title, mark: q, hint: what + ' · !' + ((d.ref.bangs || [])[0] || '') + ' · Tab: a bang a sor elejére', engine: d.ref, run: () => { input.value = '!' + (d.ref.bangs || [])[0] + ' '; onInput(); input.focus(); } };
      if (d.kind === 'rd') return { icon: ic, label: d.title, mark: q, hint: what + (d.ref.text ? ' · mentve, offline is' : '') + ' · ' + VB.url.display(d.url), run: () => go('#/olvaso/' + d.ref.id) };
      return { icon: ic, label: d.title, mark: q, hint: what + ' · ' + VB.url.display(d.url), run: () => ctx.open(d.url, { title: d.title, via: 'omni:' + d.kind }) };
    }
    async function copy(text) {
      if (!text) return;
      try { await navigator.clipboard.writeText(text); VB.ui.toast('ok', 'Vágólapra másolva', text); } catch (e) { VB.ui.toast('warn', 'A vágólap nem érhető el', text); }
    }

    // the network part: documents and web suggestions, added when they arrive (an older answer never overwrites a newer one)
    async function later(q, base) {
      const my = ++seq;
      const extra = [];
      const jobs = [];
      if (ctx.on('docs') && q.length >= 3 && !base.answer && !(base.c && base.c.kind === 'url')) jobs.push(ctx.api('/api/docs', { q, limit: 4 }, 4000).then(j => { if (j.ok && j.hits.length) extra.push({ order: 1, label: 'Dokumentumok', items: j.hits.map(d => ({ icon: 'file', label: d.title, mark: q, hint: d.path, run: () => go('#/olvaso?doc=' + encodeURIComponent(d.path)) })) }); }));
      const e = ctx.engine();
      if (ctx.on('suggest') && e && e.suggest && q.length >= 2 && !(base.c && base.c.kind === 'url')) {
        jobs.push(ctx.api('/api/suggest', { src: e.suggest, q }, 3000).then(j => { if (j.ok && j.list.length) extra.push({ order: 2, label: 'Webes javaslatok (' + e.hu + ')', items: j.list.filter(s => s.toLowerCase() !== q.toLowerCase()).slice(0, 6).map(s => ({ icon: 'search', label: s, mark: q, run: () => ctx.search(s, e, 'suggest') })) }); }));
      }
      if (!jobs.length) return;
      await Promise.all(jobs);
      if (my !== seq || input.value.trim() !== q || document.activeElement !== input) return;
      extra.sort((a, b) => a.order - b.order);
      const keep = sel;
      render(base.groups.concat(extra), base.answer);
      select(keep);
    }
    let debounce = null;
    function onInput() {
      const q = input.value;
      lastQ = q;
      const base = suggest(q);
      render(base.groups, base.answer);
      clearTimeout(debounce);
      debounce = setTimeout(() => later(q.trim(), base), 180);
    }
    function run(i) {
      const it = items[i];
      if (!it) return;
      close();
      it.run();
      if (!/^!/.test(input.value)) input.blur();
    }
    input.addEventListener('input', onInput);
    input.addEventListener('focus', () => { input.select(); onInput(); });
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (drop.hidden) onInput(); else select(sel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1); }
      else if (e.key === 'Enter' && e.altKey) { e.preventDefault(); const q = input.value.trim(); if (q) { close(); go('#/kereses?q=' + encodeURIComponent(q)); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (!items.length) onInput(); run(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); if (!drop.hidden) close(); else { input.value = ''; onInput(); close(); } }
      else if (e.key === 'Tab' && !e.shiftKey && items[sel] && items[sel].engine) { e.preventDefault(); items[sel].run(); }
    });
    document.addEventListener('keydown', e => {
      const typing = /^(input|textarea|select)$/i.test((document.activeElement || {}).tagName || '') || (document.activeElement && document.activeElement.isContentEditable);
      if ((e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') || (!typing && e.key === '/' && !e.ctrlKey && !e.altKey)) { e.preventDefault(); input.focus(); }
    });
    return { input, set(v) { input.value = v; }, focus() { input.focus(); }, close, refresh: () => { if (document.activeElement === input) onInput(); }, last: () => lastQ };
  }

  VB.omnibox = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
