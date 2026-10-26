// Extras: first-steps tour, glossary, installers, link check, PNG / print export, theme, about,
// open questions. Everything a beginner reaches from the ☰ menu.

// ---- glossary
const kpGloss = () => ((kpData.glossary || {}).entries) || [];

// the first occurrence of each term (or one of its alt forms) in an HTML string gets a dotted
// underline + tooltip; text inside tags and links is never touched; Hungarian suffixes may follow
function kpGlossMark(html, entries) {
  const seen = new Set();
  const forms = [];
  for (const e of entries) for (const f of [e.t].concat(e.alt || [])) forms.push({ f, e });
  forms.sort((a, b) => b.f.length - a.f.length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?<![\\p{L}\\d])(' + forms.map(x => esc(kpEsc(x.f))).join('|') + ')(?=-?\\p{Ll}{0,6}(?![\\p{L}\\d]))', 'giu');
  const byForm = new Map(forms.map(x => [kpEsc(x.f).toLowerCase(), x.e]));
  let inLink = 0;
  return html.split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) { if (/^<a[\s>]/i.test(part)) inLink++; else if (/^<\/a>/i.test(part)) inLink--; return part; }
    if (inLink) return part;
    return part.replace(re, m => {
      const e = byForm.get(m.toLowerCase());
      if (!e || seen.has(e.id)) return m;
      seen.add(e.id);
      return '<abbr class="kp-gl" title="' + kpEsc(e.d) + '">' + m + '</abbr>';
    });
  }).join('');
}

function kpGlossOpen(q) {
  const input = kpEl('input', { class: 'kp-in', type: 'search', placeholder: 'Keresés a szótárban…', value: q || '' });
  const list = kpEl('dl', { class: 'kp-gloss' });
  const draw = () => {
    const nq = kpNorm(input.value);
    list.replaceChildren(...kpGloss().filter(e => !nq || kpNorm([e.t].concat(e.alt || [], e.d, e.dEn).join(' ')).includes(nq))
      .flatMap(e => [kpEl('dt', {}, e.t + ((e.alt || []).length ? ' (' + e.alt.join(', ') + ')' : '')), kpEl('dd', {}, e.d, kpEl('div', { class: 'kp-en' }, e.dEn))]));
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', e => e.stopPropagation());
  kpModalOpen('Szótár', input, list);
  draw();
  input.focus();
}

// ---- first steps (03_UI §6), each step on a real element
const KP_TOUR = [
  ['#kpBoard', 'Ez a térkép a cég összes munkája. Fent a részlegek, alattuk a programok.'],
  ['#kpCam [data-id="planner:L1"]', 'Minden elem alatt egy mondat elmondja, mi az. Jobb klikk: rövid és részletes leírás.'],
  ['#kpRail', 'A rétegek: programok, közös mappák, AI dokumentumok, kód. Bal oldalt ki-be kapcsolhatod őket.'],
  ['#kpSignin', 'Belépések: a GitHub fiókoddal nyílnak ki a programok. Kattints ide.'],
  ['#kpLogBtn', 'Munkanapló: a nap végén írd le, mit csináltál — a másik így látja.'],
  ['#kpMenuBtn', 'Elakadtál? A ☰ menüben van a Szótár és ez a bemutató.']
];

function kpTourStart() {
  const root = document.getElementById('kpModal');
  let i = 0;
  const end = () => { root.replaceChildren(); kpStore.set('tourDone', true); };
  const step = () => {
    const [sel, text] = KP_TOUR[i];
    // step 1 needs headers AND program cards readable: a mid zoom over the design department
    if (i === 0) { const d = kpBoard.layout.nodes.find(x => x.id === 'dept:TERV'); if (d) kpCenterOn(d.x + d.w / 2, d.y + 260, 0.55); }
    if (i === 1) { const n = kpBoard.layout.nodes.find(x => x.id === 'planner:L1'); if (n) kpCenterOn(n.x + n.w / 2, n.y + 60, 1); }
    const el = document.querySelector(sel);
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2 - 100, top: innerHeight / 2 - 40, width: 200, height: 80 };
    const pad = 6;
    const hole = kpEl('div', { class: 'kp-tour-hole', style: 'left:' + (r.left - pad) + 'px;top:' + (r.top - pad) + 'px;width:' + (r.width + 2 * pad) + 'px;height:' + (r.height + 2 * pad) + 'px' });
    const bubble = kpEl('div', { class: 'kp-tour-bubble', role: 'dialog', 'aria-label': 'Első lépések' },
      kpEl('div', { class: 'kp-muted' }, 'Első lépések · ' + (i + 1) + ' / ' + KP_TOUR.length), kpEl('p', {}, text),
      kpEl('div', { class: 'kp-pop-row' },
        kpEl('button', { class: 'kp-btn', onclick: end }, 'Kihagyás'),
        kpEl('button', { class: 'kp-btn kp-primary', onclick: () => { i++; if (i < KP_TOUR.length) step(); else end(); } }, i < KP_TOUR.length - 1 ? 'Tovább' : 'Kész')));
    root.replaceChildren(kpEl('div', { class: 'kp-tour' }, hole, bubble));
    // the bubble sits below the highlight when there is room, else above; always on screen
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const below = r.top + r.height + pad + 12;
    const top = r.height > innerHeight * 0.6 ? innerHeight / 2 - bh / 2 : below + bh < innerHeight - 8 ? below : Math.max(8, r.top - pad - 12 - bh);
    bubble.style.left = Math.max(8, Math.min(r.left, innerWidth - bw - 8)) + 'px';
    bubble.style.top = top + 'px';
    bubble.querySelector('.kp-primary').focus();
  };
  step();
}

// ---- installers
function kpInstallers() {
  const f = ((kpData.topology.onedrive || {}).folders || []).find(x => x.id === 'od-inst');
  if (f && f.url) { kpOpen(f.url); return; }
  kpModalOpen('Telepítők', kpEl('p', {}, 'A telepítő mappa linkje még nincs megadva.'),
    kpEl('p', { class: 'kp-muted' }, 'A tulajdonos a OneDrive „20_Telepitok” mappa megosztási linkjét a Telepítők elem szerkesztésével adja meg.'),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn', onclick: () => { kpModalClose(); const c = kpCtx('installers:L1'); if (c && kpCaps.ghWrite) kpEditorOpen(c); else kpToast(KP_WHY.ghWrite); } }, 'Szerkesztés')));
}

// ---- link check: repo paths against the last GitHub tree, local paths through the companion,
// URLs only for being empty (a page cannot test another site's link)
function kpLinkRefs(topo) {
  const out = [];
  for (const p of topo.programs || []) {
    if (p.hidden) continue;
    const o = p.open || {};
    if (o.repo) out.push({ id: p.id + ':L1', t: p.t, kind: 'repo', path: o.repo });
    if ('url' in o && !o.url && !o.repo && !o.local) out.push({ id: p.id + ':L1', t: p.t, kind: 'empty' });
    if (o.local) out.push({ id: p.id + ':L1', t: p.t, kind: 'local', path: '../' + o.local });
    (p.folders || []).forEach((f, i) => {
      const id = p.id + ':L2:f' + i, t = p.t + ' · ' + (f.t || f.ref);
      if (f.local) out.push({ id, t, kind: 'local', path: '../' + f.local });
      else if (f.ref) { const r = ((topo.onedrive || {}).folders || []).find(x => x.id === f.ref); if (r && !r.url) out.push({ id, t, kind: 'empty' }); }
      else if (!f.url) out.push({ id, t, kind: 'empty' });
    });
    (p.agent || []).forEach((a, i) => { if (a.repo) out.push({ id: p.id + ':L3:a' + i, t: p.t + ' · ' + a.t, kind: 'repo', path: a.repo }); });
    ((p.git && p.git.paths) || []).filter(Boolean).forEach(g => out.push({ id: p.id + ':L4:g', t: p.t + ' · git', kind: 'repo', path: g }));
  }
  return out;
}

async function kpLinkCheck() {
  const box = kpModalOpen('Linkellenőrzés', kpEl('p', { class: 'kp-muted' }, 'Ellenőrzés…'));
  const refs = kpLinkRefs(kpData.topology);
  const live = kpLive();
  const known = live && live.repoPaths ? new Set(live.repoPaths) : null;
  const dead = [], unknown = [];
  for (const r of refs.filter(r => r.kind === 'repo')) {
    if (!known) { unknown.push(r); continue; }
    if (!known.has(r.path.replace(/\/+$/, ''))) dead.push(Object.assign({ why: 'nincs a GitHubon (main)' }, r));
  }
  const locals = refs.filter(r => r.kind === 'local');
  if (kpCaps.companion && locals.length) {
    const c = await kpCompCall('check-paths', { paths: locals.map(r => r.path) });
    if (c.status === 200) for (const r of locals) if (!c.json[r.path]) dead.push(Object.assign({ why: 'nincs meg ezen a gépen' }, r));
  } else unknown.push(...locals);
  for (const r of refs.filter(r => r.kind === 'empty')) dead.push(Object.assign({ why: 'üres link' }, r));
  kpStore.set('deadLinks', [...new Set(dead.map(d => d.id))]);
  kpBoardRender();
  box.replaceChildren(box.firstChild,
    kpEl('p', {}, refs.length + ' link · ' + dead.length + ' hibás vagy üres' + (unknown.length ? ' · ' + unknown.length + ' nem ellenőrizhető most' : '')),
    dead.length ? kpEl('ul', { class: 'kp-dead-list' }, ...dead.map(d => kpEl('li', {}, kpEl('a', { href: '#', onclick: e => { e.preventDefault(); kpModalClose();
      const it = kpSearchItems(kpResolveRefs(kpData.topology), 'vision').find(x => x.id === d.id); if (it) kpFlyTo(it); } }, d.t), ' — ' + d.why + (d.path ? ' · ' + d.path : '')))) : null,
    unknown.length ? kpEl('p', { class: 'kp-muted' }, (known ? '' : 'A repó útvonalakhoz előbb Frissíts (⟳). ') + (kpCaps.companion ? '' : 'A helyi mappákhoz a Kapu segéd kell.')) : null);
}
const kpDead = () => new Set(kpStore.get('deadLinks', []));

// ---- export: the whole board as PNG, theme colours inlined so it looks the same outside the page
const KP_PNG_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-weight', 'font-style', 'font-family', 'text-anchor', 'display'];
async function kpExportPng(download) {
  const lay = kpBoard.layout, src = document.getElementById('kpBoard');
  const minX = KP_LABEL_X - 160, pad = 24, w = Math.ceil(lay.width - minX + 2 * pad), h = Math.ceil(lay.height + 2 * pad);
  const klass = src.getAttribute('class');
  src.setAttribute('class', 'kp-board');   // full detail: no level-of-detail classes
  const cam = src.querySelector('#kpCam'), camT = cam.getAttribute('transform');
  cam.setAttribute('transform', 'translate(' + (pad - minX) + ',' + pad + ')');
  const clone = src.cloneNode(true);
  const a = src.querySelectorAll('*'), b = clone.querySelectorAll('*');
  for (let i = 0; i < a.length; i++) {
    const cs = getComputedStyle(a[i]);
    b[i].setAttribute('style', KP_PNG_PROPS.map(p => p + ':' + cs.getPropertyValue(p)).join(';'));
    b[i].removeAttribute('class');
  }
  cam.setAttribute('transform', camT);
  src.setAttribute('class', klass);
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  clone.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  clone.insertBefore(kpEl('rect', { x: 0, y: 0, width: w, height: h, style: 'fill:' + getComputedStyle(document.body).backgroundColor }), clone.firstChild);
  const svgText = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (download !== false) kpDownloadBlob('vrg-kapu-' + kpToday() + '.png', blob);
  return blob;
}
function kpDownloadBlob(name, blob) {
  const a = kpEl('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// print: every department open, the whole board on the page; restored afterwards
let kpPrintSaved = null;
function kpPrintPrep() {
  kpPrintSaved = { collapsed: kpBoard.collapsed, focus: kpBoard.focus, cam: Object.assign({}, kpBoard.cam) };
  kpBoard.collapsed = []; kpBoard.focus = null;
  kpBoardRender(); kpFit();
}
function kpPrintDone() {
  if (!kpPrintSaved) return;
  Object.assign(kpBoard, { collapsed: kpPrintSaved.collapsed, focus: kpPrintSaved.focus });
  kpBoardRender();
  kpBoard.cam = kpPrintSaved.cam; kpApplyCam();
  kpPrintSaved = null;
}

// ---- theme, about, open questions
function kpThemeOpen() {
  kpModalOpen('Téma', kpEl('div', { class: 'kp-pop-row' }, ...KP_THEMES.map(([t, c]) =>
    kpEl('button', { class: 'kp-btn', onclick: () => { kpSetTheme(t); kpModalClose(); } }, kpEl('span', { class: 'kp-sw', style: 'background:' + c }), ' ' + KP_THEME_NAMES[t]))));
}

function kpAboutOpen() {
  const r = kpData.topology.repo, gh = 'https://github.com/' + r.owner + '/' + r.name + '/tree/main/';
  kpModalOpen('Névjegy',
    kpEl('p', {}, kpEl('b', {}, 'VRG Kapu'), ' — a VRG eszközök közös térképe.'),
    kpEl('p', { class: 'kp-muted' }, 'Build ' + KP_BUILD + ' · térkép rev ' + (kpData.topology.rev || '?') + ', ' + kpFmtDate(kpData.topology.updated) + (kpData.topology.updatedBy ? ' · ' + kpData.topology.updatedBy : '')),
    kpEl('ul', {}, kpEl('li', {}, kpEl('a', { href: gh + 'docs/hub', target: '_blank', rel: 'noopener' }, 'A terv (docs/hub)')),
      kpEl('li', {}, kpEl('a', { href: gh + 'Hub', target: '_blank', rel: 'noopener' }, 'A forrás (Hub)'))));
}

function kpQuestionsOpen() {
  const live = kpLive();
  if (!live || !live.decisionFiles) { kpModalOpen('Nyitott kérdések', kpEl('p', {}, 'Frissíts (⟳), hogy a GitHubon lévő döntési fájlok listája betöltődjön.')); return; }
  const r = kpData.topology.repo, base = 'https://github.com/' + r.owner + '/' + r.name + '/blob/main/';
  const progs = (kpData.topology.programs || []).flatMap(p => ((p.git && p.git.paths) || []).filter(Boolean).map(g => ({ p, pre: g.replace(/\/+$/, '') + '/' })));
  const groups = new Map();
  for (const f of live.decisionFiles) {
    let best = null;
    for (const x of progs) if (f.startsWith(x.pre) && (!best || x.pre.length > best.pre.length)) best = x;
    const k = best ? best.p.t : 'Egyéb';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  kpModalOpen('Nyitott kérdések — döntési fájlok', kpEl('p', { class: 'kp-muted' }, live.decisionFiles.length + ' fájl. A megválaszolatlan kérdések számlálása v2.'),
    ...[...groups].map(([t, files]) => kpEl('div', { class: 'kp-ch' }, kpEl('b', {}, t),
      kpEl('ul', {}, ...files.map(f => kpEl('li', {}, kpEl('a', { href: base + f, target: '_blank', rel: 'noopener' }, f)))))));
}

function kpRepoRootOpen() {
  const inp = kpEl('input', { class: 'kp-in', value: kpRepoRoot(), placeholder: 'pl. H:\\Dev-VRG\\VRG-DE\\Planner_VRG_U100' });
  inp.addEventListener('keydown', e => e.stopPropagation());
  kpModalOpen('Helyi repó mappa',
    kpEl('p', { class: 'kp-muted' }, 'Hol van a vrg-toolset ezen a gépen? Ebből készül a programok helyi (file:///) útvonala, ha nem fut a Kapu segéd.'),
    inp, kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn kp-primary', onclick: () => { kpStore.set('repoRoot', inp.value.trim()); kpModalClose(); kpToast('Mentve'); } }, 'Mentés')));
  inp.focus();
}

function kpExtrasInit() {
  KP_MAIN_MENU.push(
    { label: 'Első lépések', run: kpTourStart },
    { label: 'Szótár', run: () => kpGlossOpen() },
    { label: 'Telepítők', run: kpInstallers },
    { label: 'Nyitott kérdések', run: kpQuestionsOpen },
    { label: 'Linkellenőrzés', run: kpLinkCheck },
    { label: 'Export: kép (PNG)', run: () => kpExportPng() },
    { label: 'Nyomtatás', run: () => window.print() },
    { label: 'Téma', run: kpThemeOpen },
    { label: 'Helyi repó mappa…', run: kpRepoRootOpen },
    { label: 'Névjegy', run: kpAboutOpen });
  window.addEventListener('beforeprint', kpPrintPrep);
  window.addEventListener('afterprint', kpPrintDone);
  // first visit in this browser: the tour (automated checks open the page with ?notour). Not from file://:
  // the "csak linkek" banner says settings are not kept, so "tour done" would not be either (it is in ☰)
  if (!kpStore.get('tourDone', false) && kpStore.available() && location.protocol !== 'file:' && !/[?&]notour\b/.test(location.search)) setTimeout(kpTourStart, 600);
}

if (typeof module !== 'undefined') module.exports = { kpGlossMark, kpLinkRefs };
