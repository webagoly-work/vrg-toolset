// Boot: theme, embedded data, then the gate. The page renders at once from what this browser
// remembers and re-renders after the companion and GitHub have answered.

const KP_THEMES = [['melyviz', '#93d3e6'], ['amber', '#e6a532'], ['light', '#f4efe6'], ['slate', '#4fb0d0'], ['green', '#57c07a']];
const KP_THEME_NAMES = { melyviz: 'Mélyvíz', amber: 'Borostyán', light: 'Világos', slate: 'Pala', green: 'Zöld' };

const kpData = { access: null, pubkey: null, tools: [] };

function kpSetTheme(t) {
  if (!KP_THEMES.some(([n]) => n === t)) t = 'melyviz';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.classList.toggle('mv', t === 'melyviz');
  kpStore.set('theme', t);
  document.getElementById('kpThemes').replaceChildren(...KP_THEMES.map(([n, c]) => kpEl('button', {
    class: 'kp-swatch' + (n === t ? ' sel' : ''), style: 'background:' + c,
    title: KP_THEME_NAMES[n], 'aria-label': KP_THEME_NAMES[n], onclick: () => kpSetTheme(n)
  })));
}

async function kpBoot() {
  kpData.access = kpEmbedded('kpAccess');
  kpData.pubkey = kpEmbedded('kpPubkey');
  kpData.tools = kpEmbedded('kpTools') || [];
  kpSetTheme(kpStore.get('theme', 'melyviz'));
  document.getElementById('kpBuild').textContent = 'build ' + KP_BUILD;
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
