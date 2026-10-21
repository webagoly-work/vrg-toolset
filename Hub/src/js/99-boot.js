// Boot: theme, embedded data, shell. Later WPs hang their init off kpBoot.

const KP_THEMES = [['amber', '#e6a532'], ['light', '#f4efe6'], ['slate', '#4fb0d0'], ['green', '#57c07a']];
const KP_THEME_NAMES = { amber: 'Borostyán', light: 'Világos', slate: 'Pala', green: 'Zöld' };
const KP_LAYERS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

const kpData = { topology: null, access: null, pubkey: null };

function kpSetTheme(t) {
  if (!KP_THEMES.some(([n]) => n === t)) t = 'amber';
  document.documentElement.setAttribute('data-theme', t);
  kpStore.set('theme', t);
  kpRenderThemes();
}

function kpRenderThemes() {
  const cur = document.documentElement.getAttribute('data-theme');
  const box = document.getElementById('kpThemes');
  box.replaceChildren(...KP_THEMES.map(([t, c]) => kpEl('button', {
    class: 'kp-swatch' + (t === cur ? ' sel' : ''), style: 'background:' + c,
    title: KP_THEME_NAMES[t], 'aria-label': KP_THEME_NAMES[t], 'data-t': t,
    onclick: () => kpSetTheme(t)
  })));
}

function kpRenderRail() {
  document.getElementById('kpRail').replaceChildren(...KP_LAYERS.map(l =>
    kpEl('button', { class: 'on', 'data-layer': l, title: l + ' réteg' }, l)));
}

function kpBoot() {
  kpData.topology = kpEmbedded('kpTopology');
  kpData.access = kpEmbedded('kpAccess');
  kpData.pubkey = kpEmbedded('kpPubkey');
  kpSetTheme(kpStore.get('theme', 'amber'));
  kpRenderRail();
  document.getElementById('kpBuild').textContent = 'build ' + KP_BUILD;
  document.getElementById('kpMode').textContent = kpStore.available() ? '' : 'csak linkek — a böngésző nem enged menteni';
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kpBoot);
  else kpBoot();
}
