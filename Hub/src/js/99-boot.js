// Boot: theme, embedded data, then the gate. The page renders at once from what this browser
// remembers and re-renders after the companion and GitHub have answered.
// Look and keyboard come from the VRG UI Kit (shared/vrg-ui-kit), inlined in index.html: window.VK.

// the kit's themes; Mélyvíz is the Kapu's default (dev-side app, decision 4A of the kit)
const KP_THEMES = ['melyviz', 'dark', 'light', 'contrast'];
const KP_THEME_NAMES = { melyviz: 'Mélyvíz', dark: 'Éj', light: 'Papír', contrast: 'Kontraszt' };
// themes of the pre-kit Kapu, mapped to the nearest kit theme so a remembered choice keeps working
const KP_THEME_OLD = { amber: 'dark', slate: 'melyviz', green: 'dark' };

const kpData = { access: null, pubkey: null, tools: [] };

function kpThemeName(t) {
  t = KP_THEME_OLD[t] || t;
  return KP_THEMES.includes(t) ? t : 'melyviz';
}

function kpSetTheme(t) {
  t = kpThemeName(t);
  const html = document.documentElement;
  html.setAttribute('data-vk-theme', t);
  html.classList.remove('mv');           // the kit draws Mélyvíz itself; the old mv base layer stays off
  kpStore.set('theme', t);
  const group = document.getElementById('kpThemes');
  group.replaceChildren(...KP_THEMES.map(n => kpEl('button', {
    class: 'vk-btn vk-btn--sm', type: 'button', role: 'radio', 'aria-checked': n === t ? 'true' : 'false',
    tabindex: n === t ? '0' : '-1', onclick: () => { kpSetTheme(n); group.querySelector('[aria-checked="true"]').focus(); }
  }, KP_THEME_NAMES[n])));
  document.dispatchEvent(new CustomEvent('vk:theme', { detail: { theme: t } }));
}

// arrows move the theme choice (a radio group); Shift+Arrow stays free for the kit's region hop
function kpThemeKeys(e) {
  if (e.shiftKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
  const i = KP_THEMES.indexOf(document.documentElement.getAttribute('data-vk-theme'));
  const n = KP_THEMES[(i + (/Right|Down/.test(e.key) ? 1 : -1) + KP_THEMES.length) % KP_THEMES.length];
  e.preventDefault();
  kpSetTheme(n);
  document.querySelector('#kpThemes [aria-checked="true"]').focus();
}

// Every verb of the page is a kit registry action, so the palette (Ctrl+K) reaches all of them.
function kpRegisterActions() {
  if (typeof VK === 'undefined' || !VK.actions) return;
  const A = VK.actions;
  A.setContext(() => ({ state: kpGateState(), comp: kpComp.on }));
  A.register({ id: 'kapu.start', label: 'START.cmd indítása', group: 'Kapu', icon: 'play', keys: ['mod+enter'],
    hint: 'Új parancssor-ablakban, a Kapu segéden át', when: c => c.state === 'open', reason: 'Előbb lépj be',
    run: c => (c.comp ? kpStartClick() : kpToast(KP_NO_COMP)) });
  A.register({ id: 'kapu.signout', label: 'Kijelentkezés', group: 'Kapu', icon: 'unlock', when: () => !!kpGh.login, run: () => kpSignOut() });
  A.register({ id: 'kapu.token', label: 'Token oldal megnyitása', group: 'Kapu', icon: 'external',
    hint: 'GitHub → Fine-grained tokens', run: () => kpOpen(KP_LOGIN.ghToken) });
  KP_THEMES.forEach(t => A.register({ id: 'kapu.theme.' + t, label: 'Téma: ' + KP_THEME_NAMES[t], group: 'Megjelenés', icon: 'eye',
    checked: () => document.documentElement.getAttribute('data-vk-theme') === t, run: () => kpSetTheme(t) }));
  kpData.tools.forEach(t => A.register({ id: 'kapu.tool.' + t.key, label: 'Megnyitás: ' + t.name, group: 'Eszközök',
    icon: 'external', hint: 'START billentyű: ' + t.key + ' · ' + t.path, keywords: [t.key, t.path],
    when: c => c.state === 'open', reason: 'Előbb lépj be', run: () => kpToolOpen(t) }));
  if (VK.palette) VK.palette.attach({ placeholder: 'Eszköz, téma vagy parancs…' });
  A.bindKeys(document);
}

async function kpBoot() {
  kpData.access = kpEmbedded('kpAccess');
  kpData.pubkey = kpEmbedded('kpPubkey');
  kpData.tools = kpEmbedded('kpTools') || [];
  kpSetTheme(kpStore.get('theme', 'melyviz'));
  document.getElementById('kpThemes').addEventListener('keydown', kpThemeKeys);
  document.getElementById('kpBuild').textContent = 'build ' + KP_BUILD;
  kpRegisterActions();
  document.getElementById('kpCmd').addEventListener('click', () => (typeof VK !== 'undefined' && VK.actions ? VK.actions.run('palette.open') : null));
  if (typeof VK !== 'undefined' && VK.focus) VK.focus.enableHop();
  kpGhLoad();
  await kpAccessRefresh();
  kpRender();
  kpComp.status = await kpCompStatus();
  kpComp.on = !!(kpComp.status && kpComp.status.ok);
  kpRender();
  if (kpGh.token) {
    await kpGhIdentify(KP_REPO);
    await kpAccessRefresh();
    kpRender();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kpBoot);
  else kpBoot();
}
