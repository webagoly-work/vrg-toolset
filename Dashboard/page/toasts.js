// toasts.js — short messages and the jobs strip of the frame (WP-09).
//   VRGToasts.toast({ ok, hu, en })   the D0 shape; also fed by the app.toast event
//   the jobs strip shows one row per job (progress bar, state, Mégse) from the jobs.update events;
//   a jobs.ask event opens the "Kérdés" dialog with the choices main listed.
(function () {
  'use strict';
  const vrg = window.vrg;
  const STATE_HU = { queued: 'Sorban', running: 'Folyamatban', done: 'Kész', failed: 'Hiba', cancelled: 'Megszakítva' };
  const STATE_EN = { queued: 'Queued', running: 'In progress', done: 'Done', failed: 'Failed', cancelled: 'Cancelled' };
  const CHOICE_HU = { skip: 'Kihagy', overwrite: 'Felülír', rename: 'Átnevez', cancel: 'Mégse' };
  const rows = new Map();                                    // job id → row element
  const askQueue = [];
  let asking = false;

  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function host(role, tag) {
    let h = document.querySelector('[data-role="' + role + '"]');
    if (!h) { h = el(tag || 'div', { 'data-role': role }); document.body.appendChild(h); }
    return h;
  }

  function toast(r) {
    r = r || {};
    const d = el('div', { 'data-role': 'toast', class: 'mv-glass' + (r.ok ? '' : ' no') }, String(r.hu || ''));
    if (r.en) d.append(el('span', { class: 'en' }, String(r.en)));
    host('toasts').appendChild(d);
    setTimeout(() => d.remove(), r.ok ? 3500 : 7000);
    return d;
  }

  // ------------------------------------------------------------ jobs strip
  function rowFor(m) {
    let row = rows.get(m.job);
    if (row) return row;
    row = el('div', { 'data-role': 'job', 'data-job': m.job });
    row.append(
      el('span', { 'data-role': 'job-hu' }),
      el('progress', { 'data-role': 'job-bar', max: '1', value: '0' }),
      el('span', { 'data-role': 'job-state' }),
      el('button', { 'data-role': 'job-cancel', type: 'button', title: 'Cancel' }, 'Mégse'),
    );
    row.querySelector('[data-role="job-cancel"]').addEventListener('click', () => { if (vrg && vrg.jobs) vrg.jobs.cancel(m.job); });
    host('jobs').appendChild(row);
    rows.set(m.job, row);
    return row;
  }

  function onUpdate(m) {
    if (!m || typeof m.job !== 'string') return;
    const row = rowFor(m);
    const bar = row.querySelector('[data-role="job-bar"]');
    row.dataset.state = m.state;
    row.querySelector('[data-role="job-hu"]').textContent = m.hu || '';
    const st = row.querySelector('[data-role="job-state"]');
    st.textContent = STATE_HU[m.state] || m.state;
    st.title = STATE_EN[m.state] || '';
    bar.value = m.total > 0 ? Math.min(1, m.done / m.total) : (m.state === 'done' ? 1 : 0);
    if (m.state === 'queued' || m.state === 'running') {
      if (!m.total) bar.removeAttribute('value');
      return;
    }
    row.querySelector('[data-role="job-cancel"]').hidden = true;
    if (m.state === 'failed') toast({ ok: false, hu: 'Hiba: ' + (m.err || m.hu || ''), en: 'Failed: ' + (m.err || '') });
    else if (m.state === 'done') toast({ ok: true, hu: 'Kész: ' + (m.hu || ''), en: 'Done' });
    setTimeout(() => { row.remove(); rows.delete(m.job); }, m.state === 'failed' ? 7000 : 3500);
  }

  // ------------------------------------------------------------ the "Kérdés" dialog
  function nextAsk() {
    if (asking || !askQueue.length) return;
    asking = true;
    const m = askQueue.shift();
    const box = host('ask');
    box.hidden = false;
    box.replaceChildren();
    box.append(el('h3', { 'data-role': 'ask-title' }, 'Kérdés'), el('p', { 'data-role': 'ask-question' }, String(m.question || '')));
    const all = el('input', { type: 'checkbox', 'data-role': 'ask-all' });
    const lbl = el('label', { 'data-role': 'ask-all-label', title: 'Apply to all' });
    lbl.append(all, document.createTextNode(' Mindre alkalmazza'));
    const bar = el('div', { 'data-role': 'ask-choices' });
    const choices = m.choices && m.choices.length ? m.choices : ['cancel'];
    for (const c of choices) {
      const b = el('button', { type: 'button', 'data-choice': c }, CHOICE_HU[c] || c);
      b.addEventListener('click', () => {
        const p = { job: m.job, choice: c };
        if (all.checked) p.all = true;
        box.hidden = true; box.replaceChildren(); asking = false;
        if (vrg && vrg.jobs) vrg.jobs.answer(m.job, c, p.all);
        nextAsk();
      });
      bar.append(b);
    }
    box.append(lbl, bar);
  }

  if (vrg && vrg.on) {
    vrg.on('jobs', 'update', onUpdate);
    vrg.on('jobs', 'ask', m => { askQueue.push(m); nextAsk(); });
    vrg.on('app', 'toast', m => toast(m));
    if (vrg.jobs) vrg.jobs.list().then(r => { if (r && r.ok && Array.isArray(r.jobs)) r.jobs.filter(j => j.state === 'queued' || j.state === 'running').forEach(onUpdate); }).catch(() => {});
  }
  window.VRGToasts = { toast, rows: () => [...rows.keys()] };
})();
