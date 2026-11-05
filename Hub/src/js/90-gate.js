// The access page: sign in with GitHub, check the signed allowed list, then hand over to
// START.cmd — the front door until the dashboard exists.

const KP_LOGIN = {
  github: 'https://github.com/login',
  ghToken: 'https://github.com/settings/personal-access-tokens/new'
};
const KP_FILE_BANNER = 'Csak linkek mód — a belépés nem marad meg, és a Kapu nem indít programot. Teljes mód: Hub\\VRG Kapu.cmd (START.cmd: H).';
const KP_TOKEN_NOTE = 'A token csak ebben a böngészőben marad. Ne küldd el senkinek, ne tedd fájlba.';
const KP_NO_COMP = 'Ehhez a Kapu segéd kell: indítsd a Kaput a Hub\\VRG Kapu.cmd-vel (START.cmd: H).';
const KP_WIZARD = [
  ['Nyisd meg a GitHubot, és lépj be a saját fiókoddal.', 'github.com → jobb felül a profilképed → Settings'],
  ['Bal oldalt, legalul: Developer settings.', 'Personal access tokens → Fine-grained tokens → Generate new token'],
  ['Adj nevet (pl. „VRG Kapu”), lejárat: 90 nap.', 'Repository access: Only select repositories → vrg-toolset'],
  ['Jogosultságok a repóhoz:', 'Permissions → Contents: Read-only · Metadata: Read-only'],
  ['Generate token → másold ki, és illeszd be ide.', 'A token egyszer látszik — ha elveszik, csinálj újat']
];

const kpIsFile = () => typeof location !== 'undefined' && location.protocol === 'file:';
function kpOpen(href) { window.open(href, '_blank', 'noopener'); }

const kpHasVK = () => typeof VK !== 'undefined';

// toasts go through the kit (a stack with a countdown MINI); the old single toast stays as a fallback
let kpToastTimer = null;
function kpToast(msg, kind) {
  if (kpHasVK() && VK.toast) { VK.toast.show({ kind: kind || 'info', text: msg }); return; }
  const el = document.getElementById('kpToast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(kpToastTimer);
  kpToastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// 'login' (no identity yet) · 'checking' (token, no answer yet) · 'closed' (not on the list) · 'open'
function kpGateState() {
  if (!kpGh.token) return 'login';
  if (!kpGh.login) return kpGh.error ? 'login' : 'checking';
  return kpL1Open() ? 'open' : 'closed';
}

const kpCard = (cls, title, ...body) => kpEl('section', { class: 'kp-card' + (cls ? ' ' + cls : ''), 'aria-label': title }, kpEl('h2', {}, title), ...body);
// kit buttons: 'kp-primary' → the kit's primary, 'off' → aria-disabled (still focusable, so the toast can explain why)
function kpBtn(label, onclick, cls, title) {
  cls = cls || '';
  return kpEl('button', { type: 'button', class: 'vk-btn kp-btn' + (/\bbig\b/.test(cls) ? ' big' : ''),
    'data-variant': /kp-primary/.test(cls) ? 'primary' : null, 'aria-disabled': /\boff\b/.test(cls) ? 'true' : null, onclick, title }, label);
}

// a MINI (the kit's icon = button = progress) for a Kapu segéd call: spins while it runs, then done / error
function kpMini(icon, label, run, opts) {
  opts = opts || {};
  if (!kpHasVK() || !VK.mini) return kpBtn(label, run, opts.off ? 'off' : '', opts.title);
  const m = VK.mini.create({ icon, label, size: 'sm' });
  m.dataset.cap = 'hidden';
  if (opts.off) { m.setAttribute('aria-disabled', 'true'); VK.mini.set(m, { state: 'off' }); }
  m.addEventListener('click', async () => {
    if (m.dataset.state === 'running') return;
    if (opts.off) { run(); return; }
    VK.mini.set(m, { state: 'running', progress: null });
    let r = null;
    try { r = await run(); } catch (e) { r = { status: 0 }; }
    const ok = !r || r.status === undefined || r.status === 200;
    VK.mini.set(m, { state: ok ? 'done' : 'error', progress: ok ? 1 : undefined });
    setTimeout(() => VK.mini.set(m, { state: 'idle', progress: 0 }), 2400);
  });
  return m;
}

async function kpSignOut() {
  kpGhSignOut();
  await kpAccessRefresh();
  kpRender();
}

function kpLoginCard() {
  const input = kpEl('input', { id: 'kpToken', class: 'vk-field__input kp-in', type: 'password', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'github_pat_…', 'aria-describedby': 'kpTokenHelp' });
  const field = kpEl('div', { class: 'vk-field' },
    kpEl('label', { class: 'vk-field__label', for: 'kpToken' }, 'GitHub token'),
    kpEl('div', { class: 'vk-field__box' }, kpIcon('lock', 'vk-field__icon'), input),
    kpEl('p', { class: 'vk-field__help', id: 'kpTokenHelp' }, KP_TOKEN_NOTE));
  const msg = kpEl('p', { class: 'kp-bad', role: 'status' }, kpGh.error || '');
  const go = kpBtn('Belépés', null, 'kp-primary');
  go.addEventListener('click', async () => {
    go.disabled = true;
    msg.className = 'kp-muted';
    msg.textContent = 'Ellenőrzés a GitHubon…';
    const r = await kpGhSetToken(input.value, KP_REPO);
    input.value = '';
    go.disabled = false;
    if (!r.ok) { msg.className = 'kp-bad'; msg.textContent = r.error; return; }
    await kpAccessRefresh();
    kpRender();
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
  setTimeout(() => input.focus(), 0);
  return kpCard('', 'Belépés',
    kpEl('p', {}, 'A Kapu a GitHub-fiókoddal azonosít, és az aláírt engedélyezett listán nézi meg, hogy neked nyit-e. Jelszót nem tárol.'),
    kpEl('div', { class: 'kp-row' }, field, go),
    msg,
    kpEl('div', { class: 'kp-row' }, kpBtn('Token oldal megnyitása (új ablak)', () => kpOpen(KP_LOGIN.ghToken))),
    kpEl('details', { class: 'kp-wiz' }, kpEl('summary', {}, 'Hogyan kapok tokent? (5 lépés)'),
      kpEl('ol', {}, ...KP_WIZARD.map(([a, b]) => kpEl('li', {}, a, kpEl('div', { class: 'kp-muted' }, b))))),
    kpEl('p', { class: 'kp-note' }, KP_ACCESS_NOTE));
}

function kpClosedCard() {
  return kpCard('', 'Nincs hozzáférés',
    kpEl('p', { class: 'kp-bad' }, kpL1Why()),
    kpEl('p', { class: 'kp-muted' }, 'Belépve: ' + kpGh.login),
    kpEl('div', { class: 'kp-row' }, kpBtn('Kijelentkezés', kpSignOut)));
}

const kpIcon = (name, cls) => (kpHasVK() ? VK.icon(name, cls) : kpEl('span', {}));

// links-only mode opens the tool through a real link (works from file://); full mode through the Kapu segéd
function kpToolOpen(t) {
  if (kpComp.on) return kpCompTool(t.path);
  const a = kpEl('a', { href: kpToolHref(t), target: '_blank', rel: 'noopener' });
  document.body.append(a); a.click(); a.remove();
  return null;
}

function kpToolRow(t) {
  const key = kpHasVK() && VK.kbd ? VK.kbd.chip(t.key) : kpEl('span', { class: 'kp-key' }, t.key);
  key.setAttribute('title', 'Billentyű a START.cmd-ben');
  const open = kpMini('external', 'Megnyitás: ' + t.name, () => kpToolOpen(t));
  const folder = kpComp.on ? kpMini('folder-open', 'Mappa: ' + t.dir, () => kpCompFolder(t.dir))
    : kpMini('folder', 'Mappa — ' + KP_NO_COMP, () => kpToast(KP_NO_COMP, 'warn'), { off: true });
  return kpEl('li', { class: 'kp-tool' }, key,
    kpEl('div', { class: 'kp-tool-t' }, kpEl('div', {}, t.name), kpEl('div', {}, t.path)),
    kpEl('div', { class: 'kp-tool-act' }, open, folder));
}

// the Kapu's emblem (the kit's isometric diorama, kind 'hub') beside the page title
function kpHero(title, text) {
  const em = kpEl('div', { class: 'kp-hero__emblem' });
  if (kpHasVK() && VK.emblem) VK.emblem.render(em, { kind: 'hub', name: 'Kapu', kicker: 'VRG ESZKÖZTÁR', glyph: 'home',
    readout: kpData.tools.length + ' eszköz', seed: 'vrg-kapu', size: 'tile', activity: kpComp.on ? .6 : .2 });
  return kpEl('section', { class: 'kp-hero', 'aria-label': title }, em,
    kpEl('div', { class: 'kp-hero__text' }, kpEl('h1', {}, title), kpEl('p', {}, text)));
}

let kpStarting = false;
async function kpStartClick() {
  if (kpStarting) return;
  kpStarting = true; kpRender();
  try { await kpCompStart(); } finally { kpStarting = false; kpRender(); }
}

function kpOpenCards() {
  const start = kpComp.on
    ? kpBtn(kpStarting ? 'Indul…' : '▶ START.cmd indítása', kpStartClick, 'kp-primary big')
    : kpBtn('▶ START.cmd indítása', () => kpToast(KP_NO_COMP, 'warn'), 'kp-primary big off', KP_NO_COMP);
  if (kpStarting) start.setAttribute('aria-busy', 'true');
  return [
    kpHero('Kapu nyitva', 'A START.cmd és minden eszköze innen indul. Ctrl+K: eszköz, téma vagy parancs keresése.'),
    kpCard('soon', 'Irányítópult — készül',
      kpEl('p', {}, 'Ide jön a közös irányítópult. Addig a START.cmd a kapu: minden program, build, teszt és mappa onnan érhető el.')),
    kpCard('', 'START.cmd — az indítópult',
      kpEl('p', {}, 'Új parancssor-ablakban nyílik; a számok és betűk ugyanazok, mint eddig. Minden eszköznél a böngészőválasztóban van „Mappa megnyitása” is.'),
      kpEl('div', { class: 'kp-row' }, start, kpComp.on ? kpBtn('Planner mappa', () => kpCompFolder('Planner')) : null),
      kpComp.on ? null : kpEl('p', { class: 'kp-muted' }, KP_NO_COMP + ' Vagy indítsd közvetlenül: Planner\\START.cmd.')),
    kpCard('', 'Eszközök',
      kpEl('p', { class: 'kp-muted' }, 'A START.cmd eszközlistája, ugyanazokkal a billentyűkkel. Ikonok: megnyitás és mappa; a kör forog, amíg a Kapu segéd dolgozik.'),
      kpData.tools.length ? kpEl('ul', { class: 'kp-tools' }, ...kpData.tools.map(kpToolRow)) : kpEl('p', { class: 'kp-bad' }, 'A build nem találta a START.cmd eszközlistáját.'))
  ];
}

function kpRender() {
  const state = kpGateState();
  const main = document.getElementById('kpMain');
  if (state === 'login') main.replaceChildren(kpHero('Belépés a Kapun', 'A VRG eszköztár belépőlapja. A GitHub-fiókoddal azonosít, és az aláírt listán nézi meg, hogy neked nyit-e.'), kpLoginCard());
  else if (state === 'checking') main.replaceChildren(kpCard('', 'Belépés', kpEl('p', { class: 'kp-muted' }, 'Ellenőrzés a GitHubon…')));
  else if (state === 'closed') main.replaceChildren(kpClosedCard());
  else main.replaceChildren(...kpOpenCards());

  const who = document.getElementById('kpWho');
  const role = kpAccess.role ? kpEl('span', { class: 'vk-badge', 'data-state': kpAccess.role === 'owner' ? 'inuse' : 'built', 'data-size': 'sm' },
    kpAccess.role === 'owner' ? 'Tulajdonos' : 'tag') : null;
  who.replaceChildren(...(kpGh.login ? [kpEl('span', { class: 'vk-mono' }, kpGh.login), role,
    kpEl('a', { href: '#', onclick: e => { e.preventDefault(); kpSignOut(); } }, 'Kijelentkezés')] : []));

  const msgs = [];
  if (kpIsFile() || !kpStore.available()) msgs.push(KP_FILE_BANNER);
  if (kpAccess.state === 'invalid') msgs.push(KP_GATE_BADSIG);
  if (kpGh.login && kpGh.error) msgs.push('Nincs kapcsolat a GitHubbal — a legutóbbi belépéssel nyílt a Kapu.');
  const b = document.getElementById('kpBanner');
  b.hidden = !msgs.length;
  b.replaceChildren(...msgs.flatMap((m, i) => (i ? [kpEl('br'), m] : [m])));
  const mode = document.getElementById('kpMode');
  mode.replaceChildren(kpEl('span', { class: 'vk-badge', 'data-state': kpComp.on ? 'active' : 'parked', 'data-size': 'sm' },
    kpComp.on ? 'teljes mód · Kapu segéd: localhost:' + window.KP_COMPANION.port : 'csak linkek mód'));
  if (kpHasVK() && VK.actions) VK.actions.touch();
}
