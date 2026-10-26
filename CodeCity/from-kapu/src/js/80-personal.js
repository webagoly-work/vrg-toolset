// Personal layers, never shared and never saved to GitHub:
//   L5 Saját linkek  — the user's own links, in kpStore ('l5'), export / import as a file
//   L6 Helyi célmappa — a folder on this PC (File System Access handle in IndexedDB) the hub can write to

const KP_L5_FILE = 'vrg-kapu-sajat-linkek.json';
const KP_L5_URL_RE = /^(https?:\/\/|file:\/\/\/)/i;
const KP_L6_NOAPI = 'Ez a böngésző nem engedi a mappa választást — a Munkanapló letöltéssel mentsd.';
const KP_L6_TESTFILE = 'vrg-kapu-teszt.txt';

const kpL5 = () => kpStore.get('l5', []);
const kpL5Ok = k => !!(k && k.id && k.t && KP_L5_URL_RE.test(String(k.url || '')));

// merge by id: -> { list, added, updated, rejected }
function kpL5Merge(existing, incoming) {
  const list = existing.slice();
  let added = 0, updated = 0, rejected = 0;
  for (const k of Array.isArray(incoming) ? incoming : []) {
    if (!kpL5Ok(k)) { rejected++; continue; }
    const clean = { id: String(k.id), t: String(k.t), url: String(k.url) };
    if (k.d) clean.d = String(k.d);
    if (k.attach) clean.attach = String(k.attach);
    const i = list.findIndex(x => x.id === clean.id);
    if (i >= 0) { list[i] = clean; updated++; } else { list.push(clean); added++; }
  }
  return { list, added, updated, rejected };
}
const kpL5Report = r => r.added + ' új, ' + r.updated + ' frissített' + (r.rejected ? ', ' + r.rejected + ' elutasítva (csak http(s) és file:/// link)' : '');

function kpPersonal() {
  return { links: kpL5(), folder: kpStore.get('l6', null) };
}

// ---- L5 UI
function kpL5Edit(link, attach) {
  const k = link || { id: 'l' + Date.now().toString(36), t: '', url: '', attach: attach || '' };
  const t = kpEl('input', { class: 'kp-in', value: k.t }), url = kpEl('input', { class: 'kp-in', value: k.url, placeholder: 'https://… vagy file:///…' });
  const d = kpEl('input', { class: 'kp-in', value: k.d || '' });
  const at = kpEl('select', { class: 'kp-in' }, kpEl('option', { value: '' }, '— a Saját csoportba —'),
    ...(kpData.topology.programs || []).filter(p => !p.hidden).map(p => kpEl('option', { value: p.id, selected: k.attach === p.id }, p.t)));
  const row = (l, el) => kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, l), el);
  kpModalOpen(link ? 'Saját link szerkesztése' : 'Új saját link',
    kpEl('p', { class: 'kp-muted' }, 'Csak te látod, csak ebben a böngészőben. Mentéshez: ☰ → Saját linkek exportálása.'),
    row('Név', t), row('Link', url), row('Leírás', d), row('Melyik program alá', at),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn kp-primary', onclick: () => {
      const next = { id: k.id, t: t.value.trim(), url: url.value.trim(), d: d.value.trim(), attach: at.value };
      if (!kpL5Ok(next)) { kpToast('Név és http(s):// vagy file:/// link kell'); return; }
      const r = kpL5Merge(kpL5(), [next]);
      kpStore.set('l5', r.list);
      kpModalClose();
      kpBoardRender();
    } }, 'Mentés')));
  t.focus();
}

function kpL5Delete(id) {
  kpStore.set('l5', kpL5().filter(k => k.id !== id));
  kpBoardRender();
}

function kpL5Export() {
  const blob = new Blob([JSON.stringify(kpL5(), null, 2) + '\n'], { type: 'application/json' });
  const a = kpEl('a', { href: URL.createObjectURL(blob), download: KP_L5_FILE });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function kpL5Import() {
  const inp = kpEl('input', { type: 'file', accept: '.json,application/json' });
  inp.addEventListener('change', async () => {
    let data;
    try { data = JSON.parse(await inp.files[0].text()); } catch (e) { kpToast('Ez nem JSON fájl'); return; }
    const r = kpL5Merge(kpL5(), data);
    kpStore.set('l5', r.list);
    kpBoardRender();
    kpToast('Saját linkek: ' + kpL5Report(r));
  });
  inp.click();
}

// ---- L6: the target folder (kpDest; the WP called it kpTarget, a name the click target already has)
const KP_IDB = { db: 'vrgKapu', store: 'handles', key: 'dest' };

function kpIdb(mode, fn) {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(KP_IDB.db, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => req.result.createObjectStore(KP_IDB.store);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(KP_IDB.store, mode);
      const r = fn(tx.objectStore(KP_IDB.store));
      tx.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => reject(tx.error);
    };
  });
}

const kpDest = {
  supported: () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function',
  async handle() { try { return await kpIdb('readonly', s => s.get(KP_IDB.key)); } catch (e) { return null; } },
  async set(h, path) {
    await kpIdb('readwrite', s => s.put(h, KP_IDB.key));
    kpStore.set('l6', { name: h.name, path: path || (kpStore.get('l6', {}) || {}).path || '' });
  },
  async pick() {
    if (!kpDest.supported()) { kpToast(KP_L6_NOAPI); return null; }
    try {
      const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'vrg-kapu-dest' });
      await kpDest.set(h);
      kpBoardRender();
      kpToast('Célmappa: ' + h.name);
      return h;
    } catch (e) { if (e.name !== 'AbortError') kpToast(KP_L6_NOAPI); return null; }
  },
  // the browser forgets the grant between visits; ask again on use (needs a click)
  async writable() {
    const h = await kpDest.handle();
    if (!h) return null;
    const opt = { mode: 'readwrite' };
    if (h.queryPermission && (await h.queryPermission(opt)) !== 'granted') {
      if (!h.requestPermission || (await h.requestPermission(opt)) !== 'granted') return null;
    }
    return h;
  },
  async write(name, text) {
    const h = await kpDest.writable();
    if (!h) return { ok: false, error: kpStore.get('l6', null) ? 'A böngésző nem adott írási engedélyt a mappára' : 'Nincs célmappa — ☰ Helyi célmappa…' };
    try {
      const f = await h.getFileHandle(name, { create: true });
      const w = await f.createWritable();
      await w.write(text);
      await w.close();
      return { ok: true, name: h.name + '/' + name };
    } catch (e) { return { ok: false, error: 'Írás sikertelen: ' + e.message }; }
  },
  // Future entry point for AI / session exports into this folder. Deliberately empty until that
  // gets its own decision (WP-H8 out of scope): it must not write anything today.
  inbox() { return null; }
};

async function kpDestTest() {
  const r = await kpDest.write(KP_L6_TESTFILE, 'VRG Kapu teszt — ' + new Date().toISOString() + '\n');
  kpToast(r.ok ? 'Megírva: ' + r.name : r.error);
  return r;
}

function kpDestPath() {
  const cur = kpStore.get('l6', null) || {};
  const inp = kpEl('input', { class: 'kp-in', value: cur.path || '', placeholder: 'pl. D:\\VRG-exportok' });
  kpModalOpen('A célmappa teljes útvonala',
    kpEl('p', { class: 'kp-muted' }, 'A böngésző nem árulja el a teljes útvonalat. Ha a Kapu segéd megnyissa a mappát, add meg egyszer.'),
    inp, kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn kp-primary', onclick: () => {
      kpStore.set('l6', Object.assign({}, cur, { path: inp.value.trim() })); kpModalClose(); kpBoardRender(); } }, 'Mentés')));
}

// ---- menus for the personal layers (instead of the shared RCO list)
function kpPersonalMenu(node) {
  const L5 = node.layer === 'L5';
  const link = node.kind === 'l5link' ? node.src : null;
  const hasDest = !!kpStore.get('l6', null);
  return L5 ? [
    ['Új saját link…', () => kpL5Edit(null, link && link.attach)],
    link ? ['Szerkesztés…', () => kpL5Edit(link)] : null,
    link ? ['Törlés', () => kpL5Delete(link.id)] : null,
    ['Saját linkek exportálása', kpL5Export],
    ['Saját linkek importálása…', kpL5Import]
  ].filter(Boolean) : [
    [hasDest ? 'Másik célmappa…' : 'Célmappa választása…', () => kpDest.pick()],
    hasDest ? ['Teszt fájl írása', kpDestTest] : null,
    hasDest ? ['Teljes útvonal megadása…', kpDestPath] : null
  ].filter(Boolean);
}

function kpPersonalMenuOpen(node, x, y) {
  kpMenuClose();
  const m = kpEl('div', { id: 'kpMenu', class: 'kp-menu', role: 'menu' }, ...kpPersonalMenu(node).map(([label, run]) =>
    kpEl('div', { class: 'kp-mi', role: 'menuitem', tabindex: '-1', onclick: e => { e.stopPropagation(); kpMenuClose(); run(); } }, label)));
  document.body.append(m);
  m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + 'px';
  m.querySelector('.kp-mi').focus();
}

function kpPersonalClick(node) {
  if (node.kind === 'l5link') { kpOpen(node.src.url); return; }
  if (node.kind === 'l6folder') {
    if (!kpStore.get('l6', null)) { kpDest.pick(); return; }
    kpPopover(node, kpEl('div', { class: 'kp-pop-h' }, '📁 ' + node.full),
      kpEl('div', { class: 'kp-pop-row kp-muted' }, kpStore.get('l6').path ? kpStore.get('l6').path : 'A megnyitáshoz add meg egyszer a teljes útvonalat (jobb klikk).'),
      kpEl('div', { class: 'kp-pop-row' },
        kpCaps.companion && kpStore.get('l6').path ? kpEl('button', { class: 'kp-btn', onclick: () => kpCompFolder(kpStore.get('l6').path) }, 'Megnyitás') : null,
        kpEl('button', { class: 'kp-btn', onclick: kpDestTest }, 'Teszt fájl írása'),
        kpEl('button', { class: 'kp-btn', onclick: () => kpDest.pick() }, 'Másik mappa…')));
  }
}

if (typeof module !== 'undefined') module.exports = { kpL5Merge, kpL5Ok, kpL5Report };
