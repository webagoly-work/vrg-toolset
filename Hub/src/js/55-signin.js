// Belépések: one row per platform, the token wizard, the three top-bar dots, layer gating v1.

const KP_LOGIN = {
  github: 'https://github.com/login',
  ghToken: 'https://github.com/settings/personal-access-tokens/new',
  onedrive: 'https://onedrive.live.com/',
  claude: 'https://claude.ai/code'
};
const KP_FILE_BANNER = 'Csak linkek mód — a beállítások nem maradnak meg. Teljes mód: indítsd a `Hub\\VRG Kapu.cmd`-t.';
const KP_TOKEN_NOTE = 'A token csak ebben a böngészőben marad. Ne küldd el senkinek, ne tedd fájlba.';
const KP_WIZARD = [
  ['Nyisd meg a GitHubot, és lépj be a saját fiókoddal.', 'github.com → jobb felül a profilképed → Settings'],
  ['Bal oldalt, legalul: Developer settings.', 'Personal access tokens → Fine-grained tokens → Generate new token'],
  ['Adj nevet (pl. „VRG Kapu”), lejárat: 90 nap.', 'Repository access: Only select repositories → vrg-toolset'],
  ['Jogosultságok a repóhoz:', 'Permissions → Contents: Read and write · Metadata: Read-only'],
  ['Generate token → másold ki, és illeszd be ide lent.', 'A token egyszer látszik — ha elveszik, csinálj újat']
];

const kpOdTick = () => kpStore.get('odTick', false) === true;
const kpIsFile = () => typeof location !== 'undefined' && location.protocol === 'file:';

// which platform a layer waits for; null when it is open
function kpLayerLock(layer) {
  if ((layer === 'L3' || layer === 'L4') && !kpGhHasRepo()) return 'GitHub';
  if (layer === 'L2' && !kpOdTick()) return 'OneDrive';
  return null;
}

function kpModalOpen(title, ...body) {
  const root = document.getElementById('kpModal');
  const close = () => root.replaceChildren();
  const box = kpEl('div', { class: 'kp-dialog', role: 'dialog', 'aria-label': title },
    kpEl('div', { class: 'kp-dialog-h' }, kpEl('div', { class: 'kp-dialog-t' }, title),
      kpEl('button', { class: 'kp-x', title: 'Bezárás (Esc)', onclick: close }, '×')),
    ...body.filter(Boolean));
  const back = kpEl('div', { class: 'kp-backdrop', onclick: e => { if (e.target === back) close(); } }, box);
  root.replaceChildren(back);
  return box;
}
const kpModalClose = () => document.getElementById('kpModal').replaceChildren();

function kpDot(state) { return kpEl('span', { class: 'kp-dot ' + state }, state === 'ok' ? '●' : state === 'warn' ? '◐' : '○'); }

function kpSigninRow(name, dot, status, ...buttons) {
  return kpEl('div', { class: 'kp-si-row' }, kpEl('div', { class: 'kp-si-name' }, name), dot,
    kpEl('div', { class: 'kp-si-status' }, ...[].concat(status)), kpEl('div', { class: 'kp-si-btns' }, ...buttons.filter(Boolean)));
}

function kpSigninOpen() {
  const gh = kpGh.login
    ? ['ellenőrizve: ', kpEl('b', {}, kpGh.login), ' · hozzáférés: ' + (KP_GH_ACCESS_HU[kpGh.access] || '?')]
    : [kpGh.error || (kpGh.token ? 'ellenőrzés…' : 'nincs belépve')];
  const ghDot = kpGhHasRepo() ? 'ok' : kpGh.login ? 'warn' : 'off';
  if (kpGh.rate != null) gh.push(kpEl('div', { class: 'kp-muted' }, 'GitHub keret: ' + kpGroup(kpGh.rate) + ' / ' + kpGroup(kpGh.rateLimit || 5000)));
  const od = kpEl('label', { class: 'kp-si-tick' }, kpEl('input', { type: 'checkbox', checked: kpOdTick(),
    onchange: e => { kpStore.set('odTick', e.target.checked); kpSigninChanged(); kpSigninOpen(); } }), ' Be vagyok jelentkezve');
  kpModalOpen('Belépések',
    kpEl('p', { class: 'kp-muted' }, 'Minden réteg a saját platformján nyílik ki. A Kapu nem tárol jelszót.'),
    kpSigninRow('GitHub', kpDot(ghDot), gh,
      kpEl('button', { class: 'kp-btn', onclick: () => kpOpen(KP_LOGIN.github) }, 'Bejelentkezés (új ablak)'),
      kpEl('button', { class: 'kp-btn', onclick: kpWizardOpen }, kpGh.token ? 'Új token…' : 'Token…'),
      kpGh.token ? kpEl('button', { class: 'kp-btn', onclick: () => { kpGhSignOut(); kpSigninChanged(); kpSigninOpen(); } }, 'Kijelentkezés') : null),
    kpSigninRow('OneDrive', kpDot(kpOdTick() ? 'ok' : 'off'), [kpOdTick() ? 'jelölve ebben a böngészőben' : 'nincs ellenőrizve', od],
      kpEl('button', { class: 'kp-btn', onclick: () => kpOpen(KP_LOGIN.onedrive) }, 'Bejelentkezés (új ablak)')),
    kpSigninRow('Claude', kpDot('none'), '– saját fiók',
      kpEl('button', { class: 'kp-btn', onclick: () => kpOpen(KP_LOGIN.claude) }, 'Claude Code megnyitása')),
    kpSigninRow('Engedélyezett lista', kpDot(kpListDot()), kpListText()),
    kpSigninRow('Kapu segéd', kpDot('off'), 'nem fut',
      kpEl('button', { class: 'kp-btn', onclick: () => kpToast('Indítsd a Hub\\VRG Kapu.cmd-vel — a segéd a következő lépésekben készül el') }, 'Hogyan indítom?')),
    kpEl('p', { class: 'kp-note' }, KP_ACCESS_NOTE));
}

const kpListDot = () => kpAccess.state === 'valid' ? (kpL1Open() ? 'ok' : 'warn') : kpAccess.state === 'none' ? 'off' : 'bad';
function kpListText() {
  const a = kpAccess;
  if (a.state === 'none') return 'még nincs beállítva';
  if (a.state === 'unsigned') return 'nincs aláírva — a programok zárva maradnak';
  if (a.state === 'invalid') return '✗ aláírás érvénytelen — a programok zárva maradnak';
  if (a.state === 'nocrypto') return 'ez a böngésző nem tud aláírást ellenőrizni';
  return '✓ aláírás rendben · ' + a.people + ' fő · ' + (a.me ? 'te: ' + (a.role === 'owner' ? 'Tulajdonos' : 'tag') : kpGh.login ? 'te nem szerepelsz rajta' : 'lépj be a GitHubbal');
}

function kpWizardOpen() {
  const input = kpEl('input', { class: 'kp-in', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'github_pat_…', 'aria-label': 'GitHub token' });
  const msg = kpEl('div', { class: 'kp-wiz-msg', role: 'status' });
  const save = kpEl('button', { class: 'kp-btn kp-primary' }, 'Ellenőrzés és mentés');
  save.addEventListener('click', async () => {
    save.disabled = true;
    msg.textContent = 'Ellenőrzés a GitHubon…';
    const r = await kpGhSetToken(input.value, kpData.topology.repo);
    input.value = '';
    save.disabled = false;
    kpSigninChanged();
    if (!r.ok) { msg.textContent = r.error; msg.className = 'kp-wiz-msg bad'; return; }
    msg.className = 'kp-wiz-msg ok';
    msg.textContent = 'Rendben: ' + kpGh.login + ' · ' + (KP_GH_ACCESS_HU[kpGh.access] || '') + (kpStore.available() ? '' : ' — csak ennek a lapnak a bezárásáig (csak linkek mód)');
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save.click(); e.stopPropagation(); });
  kpModalOpen('GitHub token — 5 lépés',
    kpEl('ol', { class: 'kp-wiz' }, ...KP_WIZARD.map(([a, b]) => kpEl('li', {}, a, kpEl('div', { class: 'kp-muted' }, b)))),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn', onclick: () => kpOpen(KP_LOGIN.ghToken) }, 'Token oldal megnyitása (új ablak)')),
    kpEl('div', { class: 'kp-pop-row' }, input, save),
    msg,
    kpEl('p', { class: 'kp-note' }, KP_TOKEN_NOTE),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn', onclick: kpSigninOpen }, '← Vissza a Belépésekhez')));
  input.focus();
}

// top-bar dots: GitHub · OneDrive · allowed list
function kpRenderSigninDots() {
  const b = document.getElementById('kpSignin');
  if (!b) return;
  const gh = kpGhHasRepo() ? 'ok' : kpGh.login ? 'warn' : 'off';
  b.replaceChildren('Belépések ', kpDot(gh), kpDot(kpOdTick() ? 'ok' : 'off'), kpDot(kpListDot()));
  b.title = 'GitHub: ' + (kpGh.login ? kpGh.login + ' · ' + (KP_GH_ACCESS_HU[kpGh.access] || '?') : 'nincs belépve') +
    ' · OneDrive: ' + (kpOdTick() ? 'jelölve' : 'nincs jelölve') + ' · Engedélyezett lista: ' + kpListText();
}

async function kpSigninChanged() {
  await kpAccessRefresh();
  kpBanner();
  kpRenderSigninDots();
  if (kpBoard.layout) kpBoardRender();
}

function kpBanner() {
  const el = document.getElementById('kpBanner');
  const msgs = [];
  if (kpIsFile() || !kpStore.available()) msgs.push(kpMdInline(KP_FILE_BANNER));
  if (kpAccess.state === 'invalid') msgs.push(kpEsc(KP_GATE_BADSIG));
  const last = kpStore.get('lastRefresh', null), live = kpStore.get('live', null);
  if (kpStore.get('stale', false) && last) msgs.push(kpEsc('Nincs internet — a ' + kpFmtDate(last) + ' állapotot látod.'));
  if (live && live.self && live.self !== KP_BUILD) msgs.push(kpEsc('Új Kapu verzió elérhető — frissíts: git pull (vagy a Kapu segéd), aztán nyisd meg újra.'));
  el.hidden = !msgs.length;
  el.innerHTML = msgs.join('<br>');
}

async function kpSigninInit() {
  document.getElementById('kpSignin').addEventListener('click', kpSigninOpen);
  await kpSigninChanged();
  if (kpGh.token) { await kpGhIdentify(kpData.topology.repo); await kpSigninChanged(); }
}
