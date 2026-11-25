// VRG Stack — the diff dialog of the write gateway (S6; research/STRINGS-PLAN.md §4). Every page that writes into a
// source goes through it: the server's preview diff is shown, nothing is written until "Beírás" is pressed, and a file
// changed meanwhile is refused (the page shows the new diff). After the write the stack is rebuilt (POST /api/build), so
// the Döntésnapló and Rétegverem (live, /api/events) show the answer. Never commits.
//
//   StackEdit.available()                 true when the page is served by serve.js (not file://, not the phone bundle)
//   StackEdit.answer(op, { onDone })      op = { file, id, choice | own, text, note, page } (lib/edit.js, decisions)
//   StackEdit.markDone(op, { onDone })    op = { thread, item, page } (lib/edit-threads.js: off the not-yet list, onto built)
(function (root) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CSS = `
  .se-back { position: fixed; inset: 0; background: rgba(4,10,14,.72); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .se-box { background: var(--mv-panel-solid, #121c24); color: var(--mv-text, #e8f0f6); border: 1px solid var(--mv-accent, #93d3e6); width: min(760px, 100%); max-height: 92vh; overflow: auto;
    padding: 14px 16px; font: 13px/1.45 var(--mv-sans, "Segoe UI", system-ui, sans-serif); box-shadow: 0 18px 48px rgba(0,0,0,.6); }
  .se-box h2 { font: 600 15px var(--mv-voice, Bahnschrift, sans-serif); letter-spacing: .06em; text-transform: uppercase; margin: 0 0 4px; }
  .se-box .se-sub { font: 12px var(--mv-mono, Consolas, monospace); color: #95a0a8; overflow-wrap: anywhere; }
  .se-box pre { font: 12px/1.5 var(--mv-mono, Consolas, monospace); background: rgba(255,255,255,.03); border: 1px solid rgba(232,240,246,.15); padding: 8px 10px; margin: 10px 0;
    white-space: pre-wrap; overflow-wrap: anywhere; max-height: 46vh; overflow: auto; }
  .se-box pre .a { color: #8bcca1; background: rgba(139,204,161,.1); display: block; } .se-box pre .r { color: #e88f8f; background: rgba(232,143,143,.1); display: block; text-decoration: line-through; text-decoration-color: rgba(232,143,143,.5); } .se-box pre .h { color: #95a0a8; display: block; }
  .se-box label { display: flex; gap: 8px; align-items: center; font-size: 12px; color: #95a0a8; }
  .se-box input { flex: 1; min-width: 0; font: 13px var(--mv-sans, sans-serif); background: #0a141c; color: #e8f0f6; border: 1px solid rgba(232,240,246,.2); padding: 5px 8px; }
  .se-box input[type=checkbox] { flex: 0 0 auto; width: 16px; height: 16px; padding: 0; accent-color: var(--mv-accent, #93d3e6); }
  .se-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 10px; }
  .se-row button { font: 12px var(--mv-mono, Consolas, monospace); background: #121c24; color: #c6ced4; border: 1px solid rgba(232,240,246,.2); padding: 6px 12px; cursor: pointer; }
  .se-row button.pri { color: #0a141c; background: var(--mv-accent, #93d3e6); border-color: var(--mv-accent, #93d3e6); }
  .se-row button:disabled { opacity: .45; cursor: default; }
  .se-msg { font: 12px var(--mv-mono, Consolas, monospace); min-height: 1.4em; margin-top: 6px; } .se-msg.err { color: #e4877d; } .se-msg.ok { color: #8bcca1; }`;
  let styled = false;
  const available = () => /^https?:$/.test(location.protocol) && !root.STACK_BUNDLE;
  async function post(url, data) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), cache: 'no-store' });
    let d = null; try { d = await r.json(); } catch (e) { d = { ok: false, msg: 'HTTP ' + r.status }; }
    if (!r.ok || !d.ok) { const e = new Error(d.msg || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return d;
  }
  function paint(diff) {
    return diff.split('\n').filter(Boolean).map(l => l.startsWith('+') && !l.startsWith('+++') ? `<span class="a">${esc(l)}</span>` : l.startsWith('-') && !l.startsWith('---') ? `<span class="r">${esc(l)}</span>` : /^(---|\+\+\+|@@)/.test(l) ? `<span class="h">${esc(l)}</span>` : esc(l) + '\n').join('');
  }
  // the next `changed` (a build finished) or a failed live build on /api/events, at most `ms` long
  function liveDone(ms) {
    return new Promise(ok => {
      // the shared server connection when the page has it (lib/live.js), else one of its own for this wait
      if (root.StackLive && StackLive.served) {
        const offs = []; const done = r => { offs.forEach(f => f()); clearTimeout(t2); ok(r); };
        const t2 = setTimeout(() => done({ ok: false, msg: 'nem jött jelzés (START R → B) · no signal' }), ms);
        offs.push(StackLive.on('changed', d => done({ ok: true, kind: (d && d.build && d.build.kind) || 'build' })));
        offs.push(StackLive.on('live', d => { if (d && d.state === 'error') done({ ok: false, msg: d.msg || 'hiba' }); }));
        return;
      }
      let es = null; const end = r => { try { es && es.close(); } catch (e) {} clearTimeout(t); ok(r); };
      const t = setTimeout(() => end({ ok: false, msg: 'nem jött jelzés (START R → B) · no signal' }), ms);
      try { es = new EventSource('/api/events'); } catch (e) { end({ ok: false, msg: 'no EventSource' }); return; }
      es.addEventListener('changed', ev => { let d = {}; try { d = JSON.parse(ev.data); } catch (e) {} end({ ok: true, kind: (d.build && d.build.kind) || 'build' }); });
      es.addEventListener('live', ev => { let d = {}; try { d = JSON.parse(ev.data); } catch (e) {} if (d.state === 'error') end({ ok: false, msg: d.msg || 'hiba' }); });
    });
  }
  function answer(op, o = {}) { return open(Object.assign({ editor: 'decisions' }, op), o); }
  function markDone(op, o = {}) { return open(Object.assign({ editor: 'threads', toBuilt: true }, op), o); }
  function open(op, o = {}) {
    const threads = op.editor === 'threads';
    if (!styled) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
    const back = document.createElement('div'); back.className = 'se-back';
    back.innerHTML = threads ? `<div class="se-box" role="dialog" aria-modal="true" aria-label="Késznek jelölés">
      <h2>Kész · ${esc(op.item)}</h2>
      <div class="se-sub">notes/devlog/threads.js · a(z) ${esc(op.thread)} szál teendői közül le · off the thread's not-yet list</div>
      <label style="margin-top:10px"><input type="checkbox" class="se-built" ${op.toBuilt !== false ? 'checked' : ''}> a kész listára is · onto its built list too</label>`
      : `<div class="se-box" role="dialog" aria-modal="true" aria-label="Válasz beírása">
      <h2>Válasz beírása · ${esc(op.id)}</h2>
      <div class="se-sub">${esc(op.file)} · egy sor a kérdés alá, a mai dátummal · one dated line under the question</div>
      <label style="margin-top:10px">Megjegyzés <i>note</i><input class="se-note" maxlength="200" placeholder="nem kötelező · optional" value="${esc(op.note || '')}"></label>`;
    back.firstElementChild.insertAdjacentHTML('beforeend', `
      <pre class="se-diff">előnézet… · preview…</pre>
      <div class="se-msg"></div>
      <div class="se-row"><button class="se-cancel">Mégse · cancel</button><button class="se-go pri" disabled>✎ Beírás · write</button></div>`);
    document.body.appendChild(back);
    const $ = s => back.querySelector(s), msg = (t, k) => { $('.se-msg').textContent = t; $('.se-msg').className = 'se-msg' + (k ? ' ' + k : ''); };
    let hash = '', done = false, t = 0;
    const close = () => { back.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape' && !$('.se-go').dataset.busy) close(); };
    document.addEventListener('keydown', key);
    const field = $(threads ? '.se-built' : '.se-note');
    const cur = () => threads ? Object.assign({}, op, { toBuilt: field.checked }) : Object.assign({}, op, { note: field.value });
    const where = r => threads ? `${r.file}: ${r.item} ${r.toBuilt ? 'a kész listán' : 'levéve'}` : `${r.file}, ${r.at}. sor`;
    async function preview() {
      $('.se-go').disabled = true; hash = '';
      try { const d = await post('/api/edit/preview', { op: cur() }); hash = d.hash; $('.se-diff').innerHTML = paint(d.diff); msg(threads ? 'a teendők közül le' + (d.toBuilt ? ', a kész listára fel · off the not-yet list, onto built' : ' · off the not-yet list') : `a ${d.line}. sor alá kerül, ${d.at}. sornak · goes in as line ${d.at}`); $('.se-go').disabled = false; }
      catch (e) { $('.se-diff').textContent = '—'; msg(e.message, 'err'); }
    }
    if (threads) field.onchange = () => preview(); else field.oninput = () => { clearTimeout(t); t = setTimeout(preview, 350); };
    $('.se-cancel').onclick = () => { close(); if (done && o.onDone) o.onDone(); };
    back.addEventListener('click', e => { if (e.target === back && !$('.se-go').dataset.busy) close(); });
    $('.se-go').onclick = async () => {
      if (done) { close(); if (o.onDone) o.onDone(); return; }
      const go = $('.se-go'); go.disabled = true; go.dataset.busy = '1';
      try {
        const r = await post('/api/edit/apply', { op: cur(), hash });
        done = true; msg(`beírva: ${where(r)} · written. Újraépítés… · rebuilding…`, 'ok'); field.disabled = true;
        let lv = null; try { lv = await (await fetch('/api/live', { cache: 'no-store' })).json(); } catch (e) { lv = null; }
        if (lv && lv.on) {
          // the server watches the DECISIONS files (S5): its live build follows; wait for it instead of a full one
          const out = await liveDone(30000);
          if (out.ok) msg(`beírva: ${where(r)}; a Stack élőben frissült (${out.kind}) · written, the stack updated live`, 'ok');
          else msg(`beírva: ${where(r)}; az élő frissítés: ${out.msg} · written; ${out.msg}`, 'err');
        } else {
          try { const b = await post('/api/build', {}); msg(`beírva: ${where(r)}; a Stack újraépült (${Math.round(b.ms / 1000)} s) · written and rebuilt`, 'ok'); }
          catch (e) { msg(`beírva: ${where(r)}; az újraépítés nem futott: ${e.message} (START R → B) · written; rebuild by hand`, 'err'); }
        }
        go.textContent = 'Kész · done'; go.disabled = false;
      } catch (e) {
        if (e.status === 409 && /changed since/.test(e.message)) { await preview(); msg('A fájl közben változott: fent az új diff, nézd át újra, aztán Beírás. · The file changed meanwhile: check the new diff above.', 'err'); }
        else { msg(e.message, 'err'); go.disabled = false; }
      } finally { delete go.dataset.busy; }
    };
    preview(); field.focus();
    return { close };
  }
  root.StackEdit = { available, answer, markDone };
})(typeof self !== 'undefined' ? self : this);
