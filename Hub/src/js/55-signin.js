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
    kpSigninRow('Engedélyezett lista', kpDot('off'), 'még nincs beállítva'),
    kpSigninRow('Kapu segéd', kpDot('off'), 'nem fut',
      kpEl('button', { class: 'kp-btn', onclick: () => kpToast('Indítsd a Hub\\VRG Kapu.cmd-vel — a segéd a következő lépésekben készül el') }, 'Hogyan indítom?')));
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
  b.replaceChildren('Belépések ', kpDot(gh), kpDot(kpOdTick() ? 'ok' : 'off'), kpDot('off'));
  b.title = 'GitHub: ' + (kpGh.login ? kpGh.login + ' · ' + (KP_GH_ACCESS_HU[kpGh.access] || '?') : 'nincs belépve') +
    ' · OneDrive: ' + (kpOdTick() ? 'jelölve' : 'nincs jelölve') + ' · Engedélyezett lista: még nincs';
}

function kpSigninChanged() {
  kpRenderSigninDots();
  if (kpBoard.layout) kpBoardRender();
}

function kpBanner() {
  const el = document.getElementById('kpBanner');
  const show = kpIsFile() || !kpStore.available();
  el.hidden = !show;
  if (show) el.innerHTML = kpMdInline(KP_FILE_BANNER);
}

async function kpSigninInit() {
  document.getElementById('kpSignin').addEventListener('click', kpSigninOpen);
  kpRenderSigninDots();
  kpBanner();
  if (kpGh.token) { await kpGhIdentify(kpData.topology.repo); kpSigninChanged(); }
}
