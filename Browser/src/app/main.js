// main.js — boots the VRG Böngésző: the store, the host, the context; the frame (top bar with the omnibox, the view
// rail, the view, the status line); hash routing; the look (theme, density, narrow layout).
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.main) return;
  const { h, icon, btn, toast, dialog } = VB.ui;

  const NAV = [
    { id: '', hu: 'Kezdőlap', icon: 'home', view: 'home' },
    { id: 'kereses', hu: 'Keresés', icon: 'search', view: 'search' },
    { id: 'konyvjelzok', hu: 'Könyvjelzők', short: 'Jelzők', icon: 'star', view: 'bookmarks', count: c => c.st.bookmarks().length },
    { id: 'elozmenyek', hu: 'Előzmények', icon: 'history', view: 'history', wide: true, count: c => c.st.history().length },
    { id: 'olvaso', hu: 'Olvasó', icon: 'list', view: 'reader', count: c => c.st.reading().filter(r => !r.read).length },
    { id: 'munkak', hu: 'Munkák', icon: 'folder', view: 'jobs', module: 'jobs', count: c => c.st.jobs().length },
    { id: 'alkatreszek', hu: 'Alkatrészek', short: 'Alkatrész', icon: 'socket', view: 'parts', module: 'parts' },
    { id: 'beallitasok', hu: 'Beállítások', icon: 'settings', view: 'settings' },
    { id: 'sugo', hu: 'Súgó', icon: 'question', view: 'help', wide: true },
  ];

  function parse(hash) {
    const s = String(hash || '').replace(/^#\/?/, '');
    const [p, qs] = s.split('?');
    const parts = p.split('/').filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    const params = {};
    for (const [k, v] of new URLSearchParams(qs || '')) params[k] = v;
    return { page: parts[0] || '', rest: parts[1] || '', more: parts[2] || '', params };
  }

  function applyLook(ctx) {
    const s = ctx.st.settings(), html = document.documentElement;
    html.setAttribute('data-vk-theme', ['melyviz', 'dark', 'light', 'contrast'].includes(s.theme) ? s.theme : 'melyviz');
    const narrow = root.matchMedia ? root.matchMedia('(max-width: 720px)').matches : false;
    const coarse = root.matchMedia ? root.matchMedia('(pointer: coarse)').matches : false;
    html.setAttribute('data-vk-density', s.density === 'auto' ? (coarse || narrow ? 'touch' : 'comfortable') : s.density);
    const app = document.querySelector('.vb');
    if (app) app.classList.toggle('vb--narrow', narrow);
    document.dispatchEvent(new CustomEvent('vk:theme'));
  }

  function boot() {
    let storage = null;
    try { storage = root.localStorage; } catch (e) { storage = null; }
    const st = VB.store.create(storage);
    const kind = VB.host.detect(root.location);
    const data = root.VB_DATA || {};
    const ctx = VB.context.create({ store: st, data, kind });
    // T1: the master links (the Asztal's web.json) where this host can reach them; elsewhere the links stay on this device
    const sync = ctx.sync = VB.sync.create({ store: st, kind }).start();
    document.documentElement.dataset.vbHost = kind;

    const omniEl = h('div.vb-omni');
    const lastOpened = () => (st.history()[0] || null);
    const tools = h('div.vb-tools', null,
      btn('Könyvjelző a legutóbb megnyitott oldalra', { iconOnly: true, icon: 'star', click: () => quickAdd(ctx, lastOpened()) }),
      ctx.on('qr') ? btn('Telefonra: QR a legutóbbi oldalról', { iconOnly: true, icon: 'phone', click: () => { const v = lastOpened(); if (v) VB.views.qr(ctx, v.url, v.title); else toast('info', 'Telefonra', 'Előbb nyiss meg egy oldalt.'); } }) : null);
    const top = h('header.vb-top', null, h('a.vb-brand', { href: '#/', title: 'Kezdőlap' }, h('b', null, 'VRG Böngésző'), h('span.vk-label', null, ctx.caps.name)), omniEl, tools);
    const nav = h('nav.vb-nav', { 'aria-label': 'Nézetek', 'data-vk-hop': '' });
    const main = h('main.vb-main', { id: 'vb-main', tabindex: '-1', 'data-vk-hop': '' });
    const status = h('footer.vb-status', { role: 'status' });
    const app = h('div.vb', null, top, nav, main, status);
    document.body.appendChild(app);
    const go = hash => { if (root.location.hash === hash) render(); else root.location.hash = hash; };
    const omni = VB.omnibox.mount(ctx, omniEl, go);

    function drawNav(cur) {
      nav.textContent = '';
      for (const n of NAV) {
        const narrow = app.classList.contains('vb--narrow');
        if (n.wide && narrow) continue;
        if (n.module && !ctx.on(n.module)) continue;
        const cnt = n.count ? n.count(ctx) : 0;
        nav.appendChild(h('a', { href: '#/' + n.id, 'aria-current': cur === n.id ? 'page' : null, title: n.hu }, icon(n.icon), h('span', null, narrow && n.short ? n.short : n.hu), cnt ? h('span.vb-count', null, String(cnt)) : null));
      }
    }
    function drawStatus() {
      status.textContent = '';
      const s = ctx.serverOk();
      VB.ui.add(status, [
        h('span', null, h('span.vk-lamp', { 'data-tone': st.ok ? 'ok' : 'warn' }), ctx.caps.name),
        h('span.vb-status__wide', null, 'kereső: ' + (ctx.engine() ? ctx.engine().hu : '—')),
        h('span.vb-status__wide', null, ctx.ix.size() + ' tétel a saját indexben'),
        ctx.caps.api === null ? null : h('span.vb-status__wide', null, h('span.vk-lamp', { 'data-tone': s === null ? 'off' : s ? 'ok' : 'off' }), s ? 'helyi szerver fut' : s === false ? 'helyi szerver nem fut' : 'helyi szerver …'),
        linksLamp(),
        st.isFull() ? h('span', null, h('span.vk-lamp', { 'data-tone': 'crit' }), 'a tároló megtelt') : null]);
    }
    function linksLamp() {
      const y = sync.status();
      const tone = y.mode === 'local' ? 'off' : y.ok === null ? 'run' : y.ok ? 'ok' : 'warn';
      const pending = st.outbox().length;
      return h('span', { title: 'Könyvjelzők és előzmények: ' + y.hu }, h('span.vk-lamp', { 'data-tone': tone }),
        y.mode === 'local' ? 'könyvjelzők: ezen az eszközön' : 'könyvjelzők: Asztal' + (pending ? ' · ' + pending + ' vár' : ''));
    }
    sync.onChange(() => drawStatus());
    function render(keep) {
      const r = parse(root.location.hash);
      const y = keep === true ? main.scrollTop : 0;
      const n = NAV.find(x => x.id === r.page) || NAV[0];
      drawNav(n.id);
      main.textContent = '';
      let view;
      try { view = VB.views[n.view](ctx, r.params, go, r.rest, r.more); }
      catch (e) { console.error(e); view = h('div.vb-view', null, h('div.vb-warn', { 'data-level': 'crit' }, 'Hiba a nézetben: ' + e.message)); }
      main.appendChild(view);
      main.scrollTop = y;
      document.title = (n.id ? n.hu + ' · ' : '') + 'VRG Böngésző';
      if (n.id === 'kereses' && r.params.q) omni.set(r.params.q);
    }
    root.addEventListener('hashchange', () => render());
    // a list re-draws when its data changes; the reader and the search page keep what they show
    st.on(w => {
      const r = parse(root.location.hash);
      drawNav(r.page); drawStatus();
      if (w === 'outbox') return;
      const list = ['', 'konyvjelzok', 'elozmenyek'].includes(r.page) || (r.page === 'olvaso' && !r.rest && !r.params.url && !r.params.doc);
      // a data change redraws the list where it stands; typing in a filter or a form on that page is not interrupted
      if (list && !(document.activeElement && main.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) render(true);
    });
    ctx.onChange(w => { if (w === 'server' || w === 'index') drawStatus(); });
    if (root.matchMedia) root.matchMedia('(max-width: 720px)').addEventListener('change', () => { applyLook(ctx); render(); });
    applyLook(ctx);
    render();
    drawStatus();
    if (ctx.caps.api !== null && (ctx.on('docs') || ctx.on('reader'))) ctx.health();
    if (root.VK) { try { if (VK.focus && VK.focus.enableHop) VK.focus.enableHop(); if (VK.toast && VK.toast.configure) VK.toast.configure({ position: 'bottom-right', max: 3 }); } catch (e) {} }
    VB.app = { ctx, go, render, omni };
    return VB.app;
  }

  // ☆ in the top bar: the last page opened through the VRG Böngésző (or any URL), as a bookmark or onto the reading list
  async function quickAdd(ctx, last) {
    const url = h('input.vb-input', { type: 'url', value: last ? last.url : '', placeholder: 'https://…' });
    const title = h('input.vb-input', { type: 'text', value: last ? last.title : '' });
    const tags = h('input.vb-input', { type: 'text', placeholder: 'címkék, vesszővel' });
    const job = h('input.vb-input', { type: 'text', placeholder: 'VRG-2611-03' });
    const where = await dialog('Mentés', h('div.vb-stack', null,
      h('p.vb-note', null, 'A legutóbb innen megnyitott oldal; bármelyik cím beírható.'),
      h('label.vb-stack', null, 'Cím', url), h('label.vb-stack', null, 'Megnevezés', title), h('label.vb-stack', null, 'Címkék', tags), h('label.vb-stack', null, 'Munkaszám (nem kötelező)', job)),
    [{ label: 'Mégse', value: null }, { label: 'Olvasólistára', value: 'reading' }, { label: 'Könyvjelző', value: 'bookmark', variant: 'primary' }]);
    if (!where) return;
    const u = VB.url.asUrl(url.value.trim());
    if (!u) { toast('warn', 'Érvénytelen cím', url.value); return; }
    const clean = ctx.on('clean') ? VB.url.clean(u).url : u;
    const doc = { url: clean, title: title.value || VB.url.hostOf(clean), tags: tags.value, job: job.value };
    const r = where === 'bookmark' ? ctx.st.addBookmark(doc) : ctx.st.addReading(doc);
    toast(r ? 'ok' : 'warn', where === 'bookmark' ? 'Könyvjelző' : 'Olvasólista', r ? r.title : 'Nem sikerült menteni.');
    if (r && job.value.trim() && !r.job) toast('warn', 'Munkaszám', 'Nem VRG-ÉÉHH-NN alakú, ezért nem mentettem.');
  }

  VB.main = { boot, parse, applyLook, NAV };
  if (typeof document !== 'undefined' && !root.VB_NO_BOOT) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
