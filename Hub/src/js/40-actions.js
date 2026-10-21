// Actions: one registry for every surface (RCO menu now; top bar and palette later).
//   id, label (UI text), alt (label when toggled), g (group: menus separate groups),
//   at (surfaces), need ('companion' | 'github' | 'log': greyed with the reason until it exists),
//   when(ctx) -> false greys it with whyNot, sub (submenu), run(ctx)

const kpCaps = { companion: false, github: false, log: false };
const KP_WHY = {
  companion: 'Ehhez fusson a Kapu segéd — indítsd a VRG Kapu.cmd-vel',
  github: 'Ehhez GitHub belépés kell — Belépések',
  log: 'A Munkanapló a következő lépésekben készül el'
};
const KP_FAV_MAX = 8;
const KP_CLAUDE_WEB = 'https://claude.ai/code';

const KP_ACT = [
  { id: 'short', label: 'Rövid leírás', g: 'info', at: ['rco'], run: c => kpDrawerOpen(c.node.id, 'short') },
  { id: 'long', label: 'Részletes leírás', g: 'info', at: ['rco'], run: c => kpDrawerOpen(c.node.id, 'long') },
  { id: 'open', label: 'Megnyitás új ablakban', g: 'open', at: ['rco'], gate: 'L1', when: c => !!kpTarget(c).kind, whyNot: 'Ennek az elemnek nincs megnyitható célja',
    run: c => kpMainAction(c.node) },
  { id: 'preview', label: 'Előnézet (legfrissebb a GitHubról)', g: 'open', at: ['rco'], gate: 'L1', need: 'github',
    when: c => c.node.kind === 'program' && !!(c.prog && c.prog.open && c.prog.open.repo), whyNot: 'Csak a repóban lévő programoknál',
    run: c => kpToast('Előnézet — itt ne dolgozz, nem marad meg') },
  { id: 'copy', label: 'Link másolása', g: 'open', at: ['rco'], when: c => !!(kpTarget(c).href || kpTarget(c).path), whyNot: 'Ennek az elemnek nincs linkje',
    run: c => { const t = kpTarget(c); kpCopy(t.href || t.path); } },
  { id: 'folder', label: 'Mappa megnyitása ezen a gépen', g: 'open', at: ['rco'], need: 'companion', run: () => {} },
  { id: 'term', label: 'Terminál itt', g: 'open', at: ['rco'], need: 'companion', run: () => {} },
  { id: 'claude', label: 'Claude Code itt', g: 'open', at: ['rco'], sub: [
    { id: 'claude-local', label: 'helyi', need: 'companion', run: () => {} },
    { id: 'claude-web', label: 'web', run: () => kpOpen(KP_CLAUDE_WEB) },
    { id: 'claude-prompt', label: 'indító prompt másolása', run: c => kpCopy(kpStartPrompt(c), 'Az indító prompt a vágólapon') }
  ] },
  { id: 'claim', label: 'Foglalás…', alt: 'Foglalás feloldása', g: 'work', at: ['rco'], need: 'github',
    toggled: c => !!(c.prog && c.prog.claim), when: c => !!c.prog, whyNot: 'Csak programot lehet foglalni', run: () => {} },
  { id: 'log', label: 'Bejegyzés a munkanaplóba', g: 'work', at: ['rco'], need: 'log', run: () => {} },
  { id: 'fav', label: 'Kedvencekhez', alt: 'Kedvencek közül ki', g: 'work', at: ['rco'],
    toggled: c => kpFavs().includes(c.node.id), when: c => kpFavable(c.node), whyNot: 'Ezt nem lehet kedvencnek jelölni',
    run: c => kpFavToggle(c.node.id) },
  { id: 'edit', label: 'Szerkesztés…', g: 'edit', at: ['rco'], need: 'github', run: () => {} },
  { id: 'add', label: 'Új elem ide…', g: 'edit', at: ['rco'], need: 'github', run: () => {} }
];

// enabled + reason for one action in one context
function kpActState(a, c) {
  if (a.gate === 'L1' && c.node.kind === 'program' && !kpL1Open()) return { on: false, why: '⛔ ' + kpL1Why() };
  if (a.need && !kpCaps[a.need]) return { on: false, why: KP_WHY[a.need] };
  if (a.when && !a.when(c)) return { on: false, why: a.whyNot || '' };
  return { on: true, why: '' };
}

// ---- context: the layout node + its program / source record
function kpCtx(nodeId) {
  const node = kpBoard.layout && kpBoard.layout.nodes.find(n => n.id === nodeId);
  if (!node) return null;
  const prog = node.progId ? (kpData.topology.programs || []).find(p => p.id === node.progId) || null : null;
  return { node, prog, src: node.src || prog };
}

function kpRepoRoot() {
  const saved = kpStore.get('repoRoot', '');
  if (saved) return saved;
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    const p = decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, '$1');
    const i = p.toLowerCase().lastIndexOf('/hub/dist/');
    if (i > 0) return p.slice(0, i).replace(/\//g, '\\');
  }
  return '';
}
// 'local' paths in the topology are relative to the VRG-DE folder, the repo's parent
const kpLocalRoot = () => kpRepoRoot().replace(/[\\/][^\\/]+[\\/]?$/, '');

// what a click on this node reaches: {href, kind, path?}
function kpTarget(c) {
  const n = c.node, ctx = { repo: kpData.topology.repo, localRoot: kpLocalRoot() };
  if (n.kind === 'program') {
    const o = (c.prog && c.prog.open) || {};
    if (o.url) return { href: o.url, kind: 'url' };
    if (o.repo) {
      const gh = kpLinkFor({ repo: o.repo }, ctx);
      const root = kpRepoRoot();
      return { href: gh.href, kind: 'repo-tool', path: root ? root + '\\' + o.repo.replace(/\//g, '\\') : '', repo: o.repo };
    }
    if (o.local) return kpLinkFor({ local: o.local }, ctx);
    return {};
  }
  if (n.kind === 'folder' || n.kind === 'local') {
    const f = n.src || {};
    if (f.url) return { href: f.url, kind: 'url' };
    if (f.local) return kpLinkFor({ local: f.local }, ctx);
    return { kind: 'empty-folder' };
  }
  if (n.kind === 'agent' || n.kind === 'go') return n.src && n.src.repo ? kpLinkFor({ repo: n.src.repo }, ctx) : n.src && n.src.local ? kpLinkFor({ local: n.src.local }, ctx) : {};
  if (n.kind === 'git') {
    const p = ((n.src || {}).paths || [])[0];
    return p ? kpLinkFor({ repo: p }, ctx) : {};
  }
  return {};
}

function kpStartPrompt(c) {
  const p = c.prog;
  const docs = (p && p.agent) || [];
  const go = docs.find(a => a.go);
  if (go) return '`' + go.go + '` — olvasd el a `' + go.repo + '`-t és csináld, amit ír.';
  const first = docs.find(a => a.repo);
  const name = p ? p.t : c.node.title.join(' ');
  return first ? 'Olvasd el a `' + first.repo + '`-t, aztán dolgozzunk ezen: ' + name + '.' : 'Dolgozzunk ezen: ' + name + '.';
}

// ---- main action (click / Enter)
function kpMainAction(node) {
  const c = kpCtx(node.id);
  if (!c) return;
  if (node.kind === 'summary') { kpBoard.collapsed = kpBoard.collapsed.filter(d => d !== node.dept); kpStore.set('collapsed', kpBoard.collapsed); kpBoardRender(); return; }
  if (node.kind === 'roadmap' || node.kind === 'slot') { kpDrawerOpen(node.id, 'short'); return; }
  if (node.kind === 'go') { kpCopy(kpStartPrompt(c), 'Az indító prompt a vágólapon — illeszd be a Claude Code-ba'); return; }
  if (node.kind === 'program' && !kpL1Open()) { kpGatePopover(node); return; }
  const t = kpTarget(c);
  if (t.kind === 'repo-tool') { kpToolPopover(node, t); return; }
  if (t.kind === 'local') { kpPathPopover(node, t.path, 'Helyi mappa — a Kapu segéd nélkül másold ki az útvonalat.'); return; }
  if (t.kind === 'empty-folder' || (node.kind === 'folder' && !t.href)) { kpToast('Még nincs megosztási link — Szerkesztés'); return; }
  if (t.href) { kpOpen(t.href); return; }
  kpDrawerOpen(node.id, 'short');
}

function kpOpen(href) { window.open(href, '_blank', 'noopener'); }

function kpCopy(text, msg) {
  const done = () => kpToast(msg || 'Másolva');
  try {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, () => kpCopyOld(text, done)); return; }
  } catch (e) { /* fall through */ }
  kpCopyOld(text, done);
}
function kpCopyOld(text, done) {
  const ta = kpEl('textarea', { style: 'position:fixed;left:-9999px' });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { kpToast('Nem sikerült másolni'); }
  ta.remove();
}

let kpToastTimer = null;
function kpToast(msg) {
  let t = document.getElementById('kpToast');
  if (!t) { t = kpEl('div', { id: 'kpToast', class: 'kp-toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(kpToastTimer);
  kpToastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---- popovers (anchored under a node)
function kpNodeScreenRect(node) {
  const g = document.querySelector('#kpCam [data-id="' + CSS.escape(node.id) + '"]');
  return g ? g.getBoundingClientRect() : { left: innerWidth / 2, bottom: innerHeight / 2, top: innerHeight / 2 };
}

function kpPopoverClose() { const p = document.getElementById('kpPop'); if (p) p.remove(); }

function kpPopover(node, ...kids) {
  kpPopoverClose();
  kpMenuClose();
  const r = kpNodeScreenRect(node);
  const p = kpEl('div', { id: 'kpPop', class: 'kp-pop', role: 'dialog' },
    kpEl('button', { class: 'kp-x', title: 'Bezárás (Esc)', onclick: kpPopoverClose }, '×'), ...kids);
  document.body.append(p);
  const w = p.offsetWidth, h = p.offsetHeight;
  p.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  p.style.top = (r.bottom + 6 + h < innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
  return p;
}

function kpToolPopover(node, t) {
  const pathRow = t.path
    ? kpEl('div', { class: 'kp-pop-row' }, kpEl('code', { class: 'kp-path' }, 'file:///' + t.path.replace(/\\/g, '/')),
        kpEl('button', { class: 'kp-btn', onclick: () => kpCopy('file:///' + t.path.replace(/\\/g, '/')) }, 'Másolás'))
    : kpEl('div', { class: 'kp-pop-row kp-muted' }, 'Add meg egyszer, hol van a repó ezen a gépen:');
  const rootIn = kpEl('input', { class: 'kp-in', value: kpRepoRoot(), placeholder: 'pl. H:\\Dev-VRG\\VRG-DE\\Planner_VRG_U100' });
  kpPopover(node,
    kpEl('div', { class: 'kp-pop-h' }, node.title.join(' ')),
    kpEl('div', { class: 'kp-pop-row kp-muted' }, 'A helyi példány nyílik, ahogy a START.cmd nyitja.' + (t.path ? ' A Kapu segéd nélkül másold be a böngészőbe:' : '')),
    pathRow,
    kpEl('div', { class: 'kp-pop-row' }, kpEl('label', { class: 'kp-muted' }, 'Helyi repó mappa'), rootIn,
      kpEl('button', { class: 'kp-btn', onclick: () => { kpStore.set('repoRoot', rootIn.value.trim()); kpToolPopover(node, kpTarget(kpCtx(node.id))); } }, 'Mentés')),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn', onclick: () => kpOpen(t.href) }, 'Megnyitás a GitHubon')));
}

function kpGatePopover(node) {
  kpPopover(node,
    kpEl('div', { class: 'kp-pop-h' }, '⛔ ' + node.title.join(' ')),
    kpEl('div', { class: 'kp-pop-row' }, kpL1Why()),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn', onclick: () => { kpPopoverClose(); kpSigninOpen(); } }, 'Belépések'),
      kpEl('button', { class: 'kp-btn', onclick: () => kpDrawerOpen(node.id, 'long') }, 'Részletes leírás')));
}

function kpPathPopover(node, path, note) {
  kpPopover(node,
    kpEl('div', { class: 'kp-pop-h' }, node.title.join(' ')),
    kpEl('div', { class: 'kp-pop-row kp-muted' }, note),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('code', { class: 'kp-path' }, path || '(add meg a helyi repó mappát)'),
      path ? kpEl('button', { class: 'kp-btn', onclick: () => kpCopy(path) }, 'Másolás') : null));
}

// ---- RCO menu
function kpMenuClose() { const m = document.getElementById('kpMenu'); if (m) m.remove(); }

function kpMenuOpen(nodeId, x, y) {
  const c = kpCtx(nodeId);
  if (!c || ['origin', 'band', 'more'].includes(c.node.kind)) return;
  kpMenuClose();
  kpPopoverClose();
  const items = [];
  let lastG = null;
  for (const a of KP_ACT.filter(a => a.at.includes('rco'))) {
    if (lastG && a.g !== lastG) items.push(kpEl('div', { class: 'kp-sep', role: 'separator' }));
    lastG = a.g;
    items.push(kpMenuItem(a, c));
  }
  const m = kpEl('div', { id: 'kpMenu', class: 'kp-menu', role: 'menu' }, ...items);
  document.body.append(m);
  m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + 'px';
  const first = m.querySelector('.kp-mi:not(.off)');
  if (first) first.focus();
}

function kpMenuItem(a, c) {
  const st = kpActState(a, c);
  const label = a.alt && a.toggled && a.toggled(c) ? a.alt : a.label;
  const el = kpEl('div', { class: 'kp-mi' + (st.on ? '' : ' off') + (a.sub ? ' has-sub' : ''), role: 'menuitem', tabindex: '-1',
    title: st.why || null, 'aria-disabled': st.on ? null : 'true', 'data-act': a.id }, label);
  if (a.sub) {
    el.append(kpEl('span', { class: 'kp-mi-arrow' }, '▸'),
      kpEl('div', { class: 'kp-submenu', role: 'menu' }, ...a.sub.map(s => kpMenuItem(s, c))));
    return el;
  }
  if (st.on) el.addEventListener('click', e => { e.stopPropagation(); kpMenuClose(); a.run(c); });
  return el;
}

// ---- favourites
const kpFavs = () => kpStore.get('favs', []);
const kpFavable = n => !['origin', 'band', 'more', 'roadmap', 'summary'].includes(n.kind);
function kpFavToggle(id) {
  let f = kpFavs();
  if (f.includes(id)) f = f.filter(x => x !== id);
  else if (f.length >= KP_FAV_MAX) { kpToast('Legfeljebb ' + KP_FAV_MAX + ' kedvenc lehet'); return; }
  else f = f.concat(id);
  kpStore.set('favs', f);
  kpRenderStrip();
}

// title for a favourite even when its node is not drawn right now
function kpFavTitle(id) {
  const n = kpBoard.layout && kpBoard.layout.nodes.find(x => x.id === id);
  if (n) return n.full || n.title.join(' ');
  const it = kpSearchItems(kpResolveRefs(kpData.topology), 'vision').find(x => x.id === id);
  return it ? it.t : null;
}

function kpRenderStrip() {
  const strip = document.getElementById('kpStrip');
  const favs = kpFavs().map(id => ({ id, t: kpFavTitle(id) })).filter(f => f.t);
  if (!favs.length) { strip.replaceChildren(); return; }
  strip.replaceChildren(kpEl('span', { class: 'kp-strip-l' }, '★ Kedvencek:'),
    ...favs.map(f => kpEl('button', { class: 'kp-fav', onclick: () => {
      const it = kpSearchItems(kpResolveRefs(kpData.topology), 'vision').find(x => x.id === f.id);
      if (it && it.kind === 'program' && kpBoard.view === 'now' && (kpData.topology.programs.find(p => p.id === it.progId) || {}).status === 'v2') kpSetView('vision');
      if (it) kpFlyTo(it);
    } }, f.t)));
}

if (typeof module !== 'undefined') module.exports = { KP_ACT, KP_WHY, kpCaps };
