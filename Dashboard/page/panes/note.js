// note.js — "Mentés fejlesztői jegyzetként" (WP-25): a small dialog that leaves a dev note in the Divergence outbox.
// VRGNote.open({ text, source:{ kind, ref }, label? }) shows the dialog over the frame; VRGPanes.note mounts the same form in a pane.
// The page sends a topic, a title, a text and a source label through vrg.note.save; main runs tools/divergence.js jot. Nothing is pushed here:
// the next Push on the Divergence board carries the note to the vrg-devnotes branch.
// The pure helpers are also exported for node --test (module.exports, only when `module` exists).
(function () {
  'use strict';

  // ------------------------------------------------------------ pure helpers
  const TITLE_MAX = 80, TOPIC_RE = /^[a-z0-9-]{1,40}$/, SOURCE_KINDS = ['url', 'file', 'node', 'term', 'chat'];
  const SOURCE_HU = { term: 'terminál', chat: 'csevegés' };

  // first non-empty line of the text, whitespace collapsed, at most 80 characters, cut on code points
  function defaultTitle(text) {
    const line = String(text == null ? '' : text).split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).find(Boolean) || '';
    const cp = Array.from(line);
    return cp.length > TITLE_MAX ? cp.slice(0, TITLE_MAX).join('') : line;
  }

  // the read-only source line: the URL, the file display path, the node id, "terminál" or "csevegés"
  function sourceLabel(source, label) {
    if (label) return String(label).slice(0, 500);
    if (!source || !SOURCE_KINDS.includes(source.kind)) return '';
    return SOURCE_HU[source.kind] || String(source.ref == null ? '' : source.ref).slice(0, 500);
  }

  // the payload for vrg.note.save, or { err } with the Hungarian reason
  function payload(f) {
    const topic = String(f.topic == null ? '' : f.topic).trim().toLowerCase().replace(/[\s_]+/g, '-');
    const text = String(f.text == null ? '' : f.text).slice(0, 64 * 1024);
    if (!TOPIC_RE.test(topic)) return { err: 'Érvénytelen téma (a-z, 0-9, kötőjel).' };
    if (!text.trim()) return { err: 'A jegyzet szövege üres.' };
    const p = { topic, title: (String(f.title || '').trim() || defaultTitle(text)).slice(0, 120) || 'Jegyzet', text };
    if (f.source && SOURCE_KINDS.includes(f.source.kind)) p.source = { kind: f.source.kind, ref: String(f.source.ref == null ? '' : f.source.ref).slice(0, 500) };
    return p;
  }

  const api = { defaultTitle, sourceLabel, payload, TITLE_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined') return;

  // ------------------------------------------------------------ the form
  const vrg = window.vrg;
  const el = (tag, attrs, text) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const field = (label, en, input) => {
    const l = el('label', { 'data-role': 'note-field', title: en });
    l.append(el('span', {}, label), input);
    return l;
  };

  // builds the form into `host`; onSaved() runs after a successful save
  function form(host, draft, onSaved) {
    draft = draft || {};
    const text = String(draft.text == null ? '' : draft.text);
    const topic = el('select', { 'data-role': 'note-topic' }), topicFree = el('input', { type: 'text', 'data-role': 'note-topic-free', maxlength: '40', placeholder: 'új téma' });
    const title = el('input', { type: 'text', 'data-role': 'note-title', maxlength: '120' });
    const body = el('textarea', { 'data-role': 'note-text', rows: '8' });
    const src = el('input', { type: 'text', 'data-role': 'note-source', readonly: '' });
    const save = el('button', { type: 'button', 'data-role': 'note-save', title: 'Save' }, 'Mentés');
    const msg = el('p', { 'data-role': 'note-msg' });
    title.value = defaultTitle(text); body.value = text; src.value = sourceLabel(draft.source, draft.label);
    host.replaceChildren(field('Téma', 'Topic', topic), topicFree, field('Cím', 'Title', title), field('Szöveg', 'Text', body), field('Forrás', 'Source', src), save, msg);

    if (vrg && vrg.note) vrg.note.topics().then(r => {
      const list = r && r.ok && Array.isArray(r.topics) ? r.topics : [];
      for (const t of list) topic.append(el('option', { value: t }, t));
      if (!list.length) topic.hidden = true;
    }).catch(() => {});

    save.addEventListener('click', async () => {
      const p = payload({ topic: topicFree.value.trim() || topic.value, title: title.value, text: body.value, source: draft.source });
      if (p.err) { msg.textContent = p.err; return; }
      save.disabled = true;
      let r = null;
      try { r = vrg && vrg.note ? await vrg.note.save(p) : null; } catch (e) {}
      save.disabled = false;
      if (!r || !r.ok) { msg.textContent = (r && r.hu) || 'A jegyzet nem mentődött.'; return; }
      const done = 'Jegyzet mentve. A következő Push viszi a vrg-devnotes ágra.';
      if (window.VRGToasts) window.VRGToasts.toast({ ok: true, hu: done, en: 'Note saved. The next Push carries it to the vrg-devnotes branch.' });
      msg.textContent = done;
      const open = el('button', { type: 'button', 'data-role': 'note-open-divergence', title: 'Open Divergence' }, 'Divergencia megnyitása');
      open.addEventListener('click', () => { if (vrg && vrg.act) vrg.act('srv:divergence'); });
      msg.append(' ', open);
      if (onSaved) onSaved(r);
    });
    return { topic, topicFree, title, body, src, save, msg };
  }

  // ------------------------------------------------------------ the dialog over the frame
  let box = null;
  function open(draft) {
    close();
    box = el('div', { 'data-role': 'note-dialog', role: 'dialog', 'aria-label': 'Mentés fejlesztői jegyzetként', class: 'mv-glass' });
    const head = el('h3', { 'data-role': 'note-title-bar', title: 'Save as a dev note' }, 'Mentés fejlesztői jegyzetként');
    const x = el('button', { type: 'button', 'data-role': 'note-close', title: 'Close' }, 'Bezár');
    x.addEventListener('click', close);
    const inner = el('div', { 'data-role': 'note-form' });
    box.append(head, inner, x);
    box.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.body.appendChild(box);
    const f = form(inner, draft);
    f.body.focus();
    return f;
  }
  function close() { if (box) { box.remove(); box = null; } }

  window.VRGNote = { open, close, form, ...api };

  // the pane kind: the same form, empty
  const P = window.VRGPanes = window.VRGPanes || {};
  P.note = {
    mount(el0, state) { this.root = el0; el0.innerHTML = ''; form(el0, state && typeof state === 'object' ? state : {}); },
    unmount() { if (this.root) this.root.innerHTML = ''; this.root = null; },
    state() { return {}; },
  };
})();
