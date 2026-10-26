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

let kpToastTimer = null;
function kpToast(msg) {
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

const kpCard = (cls, title, ...body) => kpEl('section', { class: 'kp-card' + (cls ? ' ' + cls : '') }, kpEl('h2', {}, title), ...body);
const kpBtn = (label, onclick, cls, title) => kpEl('button', { class: 'kp-btn' + (cls ? ' ' + cls : ''), onclick, title }, label);

async function kpSignOut() {
  kpGhSignOut();
  await kpAccessRefresh();
  kpRender();
}

function kpLoginCard() {
  const input = kpEl('input', { class: 'kp-in', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'github_pat_…', 'aria-label': 'GitHub token' });
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
    kpEl('div', { class: 'kp-row' }, input, go),
    msg,
    kpEl('div', { class: 'kp-row' }, kpBtn('Token oldal megnyitása (új ablak)', () => kpOpen(KP_LOGIN.ghToken))),
    kpEl('details', { class: 'kp-wiz' }, kpEl('summary', {}, 'Hogyan kapok tokent? (5 lépés)'),
      kpEl('ol', {}, ...KP_WIZARD.map(([a, b]) => kpEl('li', {}, a, kpEl('div', { class: 'kp-muted' }, b))))),
    kpEl('p', { class: 'kp-note' }, KP_TOKEN_NOTE, ' ', KP_ACCESS_NOTE));
}

function kpClosedCard() {
  return kpCard('', 'Nincs hozzáférés',
    kpEl('p', { class: 'kp-bad' }, kpL1Why()),
    kpEl('p', { class: 'kp-muted' }, 'Belépve: ' + kpGh.login),
    kpEl('div', { class: 'kp-row' }, kpBtn('Kijelentkezés', kpSignOut)));
}

function kpToolRow(t) {
  const open = kpComp.on
    ? kpBtn('Megnyitás', () => kpCompTool(t.path))
    : kpEl('a', { class: 'kp-btn', href: kpToolHref(t), target: '_blank', rel: 'noopener' }, 'Megnyitás');
  const folder = kpComp.on ? kpBtn('Mappa', () => kpCompFolder(t.dir), '', t.dir) : kpBtn('Mappa', () => kpToast(KP_NO_COMP), 'off', KP_NO_COMP);
  return kpEl('li', { class: 'kp-tool' }, kpEl('span', { class: 'kp-key', title: 'Billentyű a START.cmd-ben' }, t.key),
    kpEl('div', { class: 'kp-tool-t' }, kpEl('div', {}, t.name), kpEl('div', {}, t.path)), open, folder);
}

function kpOpenCards() {
  const start = kpComp.on
    ? kpBtn('▶ START.cmd indítása', kpCompStart, 'kp-primary big')
    : kpBtn('▶ START.cmd indítása', () => kpToast(KP_NO_COMP), 'kp-primary big off', KP_NO_COMP);
  return [
    kpCard('soon', 'Irányítópult — készül',
      kpEl('p', {}, 'Ide jön a közös irányítópult. Addig a START.cmd a kapu: minden program, build, teszt és mappa onnan érhető el.')),
    kpCard('', 'START.cmd — az indítópult',
      kpEl('p', {}, 'Új parancssor-ablakban nyílik; a számok és betűk ugyanazok, mint eddig. Minden eszköznél a böngészőválasztóban van „Mappa megnyitása” is.'),
      kpEl('div', { class: 'kp-row' }, start, kpComp.on ? kpBtn('Planner mappa', () => kpCompFolder('Planner')) : null),
      kpComp.on ? null : kpEl('p', { class: 'kp-muted' }, KP_NO_COMP + ' Vagy indítsd közvetlenül: Planner\\START.cmd.')),
    kpCard('', 'Eszközök',
      kpEl('p', { class: 'kp-muted' }, 'A START.cmd eszközlistája, ugyanazokkal a billentyűkkel.'),
      kpData.tools.length ? kpEl('ul', { class: 'kp-tools' }, ...kpData.tools.map(kpToolRow)) : kpEl('p', { class: 'kp-bad' }, 'A build nem találta a START.cmd eszközlistáját.'))
  ];
}

function kpRender() {
  const state = kpGateState();
  const main = document.getElementById('kpMain');
  if (state === 'login') main.replaceChildren(kpLoginCard());
  else if (state === 'checking') main.replaceChildren(kpCard('', 'Belépés', kpEl('p', { class: 'kp-muted' }, 'Ellenőrzés a GitHubon…')));
  else if (state === 'closed') main.replaceChildren(kpClosedCard());
  else main.replaceChildren(...kpOpenCards());

  const who = document.getElementById('kpWho');
  who.replaceChildren(...(kpGh.login ? [kpGh.login + (kpAccess.role ? ' · ' + (kpAccess.role === 'owner' ? 'Tulajdonos' : 'tag') : '') + ' ',
    kpEl('a', { href: '#', onclick: e => { e.preventDefault(); kpSignOut(); } }, 'Kijelentkezés')] : []));

  const msgs = [];
  if (kpIsFile() || !kpStore.available()) msgs.push(KP_FILE_BANNER);
  if (kpAccess.state === 'invalid') msgs.push(KP_GATE_BADSIG);
  if (kpGh.login && kpGh.error) msgs.push('Nincs kapcsolat a GitHubbal — a legutóbbi belépéssel nyílt a Kapu.');
  const b = document.getElementById('kpBanner');
  b.hidden = !msgs.length;
  b.replaceChildren(...msgs.flatMap((m, i) => (i ? [kpEl('br'), m] : [m])));
  document.getElementById('kpMode').textContent = kpComp.on ? 'teljes mód · Kapu segéd: localhost:' + window.KP_COMPANION.port : 'csak linkek mód';
}
