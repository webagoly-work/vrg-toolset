// netbar.js — the title bar's corner metrics (WP-49b): Wi-Fi signal, ping, jitter, loss, DNS, link rate, traffic, CPU, RAM as
// colour-coded numbers next to each other, just left of the window buttons, in both primary views. ◉ hides / shows the row
// (setting net.show); ▾ lists every metric with a switch each (net.metrics, the order of the list). Values come from main
// (vrg.desktop.netSample, lib/netmeter.js) every 2 s while the row is shown and the window is visible; hidden = nothing is sampled.
//   window.VRGNetBar = { refresh(), state() }
(function () {
  'use strict';
  const vrg = window.vrg, G = window.VRGNetGrade;
  const bar = document.querySelector('[data-role="wbar"]');
  if (!bar || !G) return;
  const call = (fn, p) => (vrg && vrg.call ? vrg.call('desktop', fn, p || {}) : Promise.resolve(null));
  const setting = (k, v) => (vrg && vrg.call ? vrg.call('app', 'setting', v === undefined ? { k } : { k, v }) : Promise.resolve({}));
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v; else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c && c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };

  const S = { show: true, list: G.DEFAULT.slice(), last: null, timer: 0, menu: null };
  const row = h('div', { 'data-role': 'netbar' });
  bar.insertBefore(row, bar.querySelector('[data-w="min"]'));

  function draw() {
    row.textContent = '';
    if (S.show) {
      const v = (S.last && S.last.values) || {};
      for (const id of S.list) {
        const m = G.METRICS.find(x => x.id === id); if (!m) continue;
        const g = G.grade(id, v[id]);
        row.append(h('span', { class: 'nm', 'data-metric': id, 'data-grade': g, title: m.hu + ' / ' + m.en + (id === 'wifi' && S.last && S.last.ssid ? ' · ' + S.last.ssid : '') + (id === 'ping' && S.last && S.last.target ? ' · ' + S.last.target : '') },
          h('span', { class: 'k' }, m.short), h('span', { class: 'v' }, G.fmt(id, v[id]))));
      }
      row.append(h('button', { type: 'button', class: 'nb', 'data-role': 'net-menu', title: 'Mérőszámok ki / be / Metrics', onclick: e => { e.stopPropagation(); toggleMenu(); } }, '▾'));
    }
    row.append(h('button', { type: 'button', class: 'nb', 'data-role': 'net-toggle', 'aria-pressed': String(S.show), title: S.show ? 'Mérőszámok elrejtése / Hide metrics' : 'Hálózat és gép mérőszámai / Show metrics',
      onclick: e => { e.stopPropagation(); setShow(!S.show); } }, S.show ? '◉' : '◎'));
  }

  async function tick() {
    if (!S.show || document.hidden) return;
    const r = await call('netSample').catch(() => null);
    if (!r || !r.values) return;
    S.last = r; draw();
    if (S.menu) for (const l of S.menu.querySelectorAll('[data-choice]')) {   // only the numbers: a checkbox under the mouse stays put
      const id = l.dataset.choice, s = l.querySelector('.v');
      if (s) { s.textContent = G.fmt(id, r.values[id]); s.dataset.grade = G.grade(id, r.values[id]); }
    }
  }
  function schedule() { clearInterval(S.timer); S.timer = 0; if (S.show) { tick(); S.timer = setInterval(tick, 2000); } }
  async function setShow(on) { S.show = !!on; closeMenu(); await setting('net.show', S.show); draw(); schedule(); }
  async function setList(list) { S.list = list; await setting('net.metrics', S.list); draw(); }

  function closeMenu() { if (S.menu) { S.menu.remove(); S.menu = null; call('cover', { on: false }); document.removeEventListener('mousedown', outside, true); draw(); } }
  const outside = e => { if (S.menu && !S.menu.contains(e.target) && !row.contains(e.target)) closeMenu(); };
  function fillMenu() {
    const box = S.menu; if (!box) return;
    box.textContent = '';
    box.append(h('div', { class: 'hd' }, 'Mérőszámok', h('span', { class: 'en' }, 'Metrics')));
    const v = (S.last && S.last.values) || {};
    const order = S.list.concat(G.IDS.filter(id => !S.list.includes(id)));
    for (const id of order) {
      const m = G.METRICS.find(x => x.id === id), on = S.list.includes(id);
      box.append(h('label', { 'data-choice': id }, h('input', { type: 'checkbox', checked: on,
        onchange: e => setList(e.target.checked ? S.list.concat(id) : S.list.filter(x => x !== id)).then(fillMenu) }),
        h('span', { class: 't' }, m.hu, h('span', { class: 'en' }, m.en)), h('span', { class: 'v', 'data-grade': G.grade(id, v[id]) }, G.fmt(id, v[id]))));
    }
    box.append(h('div', { class: 'ft' }, h('button', { type: 'button', 'data-role': 'net-all', onclick: () => setList(G.IDS.slice()).then(fillMenu) }, 'Mind'),
      h('button', { type: 'button', 'data-role': 'net-default', onclick: () => setList(G.DEFAULT.slice()).then(fillMenu) }, 'Alap'),
      h('span', { class: 'note' }, 'zöld jó · sárga gyenge · piros rossz')));
  }
  function toggleMenu() {
    if (S.menu) { closeMenu(); return; }
    call('cover', { on: true });                                       // the native views sit above the page: hide them meanwhile
    S.menu = h('div', { 'data-role': 'net-menu-box', role: 'dialog', 'aria-label': 'Mérőszámok' });
    document.body.append(S.menu);
    fillMenu();
    document.addEventListener('mousedown', outside, true);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.menu) { e.stopPropagation(); closeMenu(); } }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  (async () => {
    const a = await setting('net.show').catch(() => ({})), b = await setting('net.metrics').catch(() => ({}));
    if (a && typeof a.v === 'boolean') S.show = a.v;
    if (b && G.validList(b.v)) S.list = b.v;
    draw(); schedule();
  })();

  window.VRGNetBar = { refresh: tick, state: () => ({ show: S.show, list: S.list.slice(), last: S.last, menu: !!S.menu }) };
})();
