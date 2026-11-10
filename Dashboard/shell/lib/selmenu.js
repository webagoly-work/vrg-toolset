// selmenu.js — the selection menu (WP-19): select text anywhere, right-click, get Másolás · Belső keresés · Google · AI keresés · Claude oldalchat · ...
//   build(text, origin, features) → template [{ label, action, text, enabled }, { type:'separator' }, ...] or null for an empty selection
//   createSelMenu({ Menu, clipboard, emit, features }) → { popup(opts), pick(action, text), labels(template) }
// features: { 'search.inner', 'chat.start', 'note.save', ctx } → true when that feature exists; web.open (Google, AI keresés) is on unless false.
// Pure where possible: Electron's Menu and clipboard are passed in, so node --test can load this file.
'use strict';

const SEARCH_MAX = 300, TEXT_MAX = 65536;
const LATER = ' (később)';
const ORIGINS = ['frame', 'term', 'file', 'chat', 'web'];

// the actions that exist for sure; the others wait for their WP (search panel, chat, notes, context pack)
function build(text, origin, features) {
  const t = String(text == null ? '' : text).trim();
  if (!t) return null;
  const f = features && typeof features === 'object' ? features : {};
  const short = t.slice(0, SEARCH_MAX), long = t.slice(0, TEXT_MAX);
  const item = (label, action, body, on) => ({ label: on ? label : label + LATER, action, text: body, enabled: !!on, origin });
  const sep = () => ({ type: 'separator' });
  const web = f['web.open'] !== false;
  return [
    item('Másolás', 'copy', long, true),
    sep(),
    item('Belső keresés', 'search.inner', short, f['search.inner'] === true),
    item('Google', 'google', short, web),
    item('AI keresés', 'ai', short, web),
    sep(),
    item('Claude oldalchat', 'chat', long, f['chat.start'] === true),
    item('Mentés fejlesztői jegyzetként', 'note', long, f['note.save'] === true),
    sep(),
    item('Csomaghoz adás', 'ctx', long, f.ctx === true),
  ];
}

function createSelMenu({ Menu, clipboard, emit = () => {}, features = () => ({}) }) {
  // copy is done here; every other choice goes to the frame as  sel.pick { action, text, origin?, ref? }  (it opens the search panel, a browser tab,
  // the chat, the note dialog). origin = where the text was selected (DESK-Q65 B); ref = the page URL for origin web, so a note gets its source line.
  function pick(action, text, origin, ref) {
    const s = String(text == null ? '' : text).slice(0, TEXT_MAX);
    if (action === 'copy') { try { clipboard.writeText(s); } catch (e) {} return; }
    const m = { action, text: s };
    if (ORIGINS.includes(origin)) m.origin = origin;
    if (m.origin === 'web' && typeof ref === 'string' && /^https?:\/\//i.test(ref)) m.ref = ref.slice(0, 500);
    emit('pick', m);
  }

  const labels = tpl => (tpl || []).map(i => (i.type === 'separator' ? { separator: true } : { label: i.label, enabled: i.enabled }));

  // extra: [{ label, click }] items put in front (web views: "Link megnyitása új lapon")
  function popup({ text, origin, ref, window = null, extra = [] }) {
    const tpl = build(text, origin, features());
    if (!tpl) return false;
    const menu = Menu.buildFromTemplate([
      ...extra.map(x => ({ label: x.label, click: x.click })),
      ...(extra.length ? [{ type: 'separator' }] : []),
      ...tpl.map(i => (i.type === 'separator' ? i : { label: i.label, enabled: i.enabled, click: () => pick(i.action, i.text, origin, ref) })),
    ]);
    menu.popup(window ? { window } : {});
    return true;
  }

  return { popup, pick, labels, build: (text, origin) => build(text, origin, features()) };
}

module.exports = { build, createSelMenu, SEARCH_MAX, TEXT_MAX, ORIGINS };
