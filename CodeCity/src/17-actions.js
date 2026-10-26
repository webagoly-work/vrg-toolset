// 17-actions.js — right-click menu (RCO) over buildings and districts, and the Kódváros segéd client
// (live workspace P2, KV-05). One action registry for every surface (RCO now, the Ctrl+K palette next),
// in the Kapu registry's shape (from-kapu/src/js/40-actions.js):
//   id, label, g (group: separators between groups), need ('companion' | 'root': greyed with the
//   reason until present), when(ctx) -> false greys it with whyNot, run(ctx).
// ctx = { file, dir, rel (repo-relative path, '' = the repo), dirRel (its folder, '.' = the repo) }.
// The segéd (CodeCity/companion.js) injects window.KV_COMPANION = {token, port}. Without it the launch
// items stay greyed with a Hungarian reason; the Claude deep links still work whenever the repo's
// folder on this machine is known — from the segéd, or from this page's own file:// address.
// CITY-D10 A: nothing here writes; every item opens, launches or copies.

const kv = { on: false, match: false, status: null, root: '', menu: null };
const KV_WHY = {
  companion: 'Ehhez fusson a Kódváros segéd — START.cmd: K, majd S) Élő mód',
  other: 'Ez a város nem a segéd repójának a térképe — a segéd csak a saját repójában nyit',
  root: 'Nem tudom, hol van ez a repó ezen a gépen — nyisd meg a START.cmd K → S) Élő móddal',
  vscode: 'A hordozható VS Code nem található (Planner/apps/vscode)'
};
const KV_CLAUDE_CLI = 'claude-cli://open?cwd=';      // Claude Code in a terminal, in that folder
const KV_CLAUDE_APP = 'claude://code/new?folder=';  // the Claude app, a new Code session on that folder

async function kvCall(action, body) {
  const c = window.KV_COMPANION;
  if (!c) return { status: 0, json: { error: 'Kódváros segéd nélkül' } };
  try {
    const r = await fetch('/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kodvaros-Token': c.token }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  } catch (e) { return { status: 0, json: { error: 'A Kódváros segéd nem válaszol' } }; }
}
function kvDone(r, ok) {
  if (r.status === 200) kvToast(r.json && r.json.dryRun ? 'Próba: ' + r.json.exe + ' ' + (r.json.args || []).join(' ') + (r.json.cwd ? ' @ ' + r.json.cwd : '') : ok);
  else if (r.status === 403) kvToast('Ez a hely nincs az engedélyezettek között (CodeCity/companion.config.json → roots)');
  else kvToast((r.json && r.json.error) || 'A Kódváros segéd hibát jelzett (' + r.status + ')');
}

// this repo's folder on disk: the segéd knows it; a file:// page under CodeCity/dist/ can work it out
function kvRootFromPage(name) {
  if (location.protocol !== 'file:') return '';
  const p = decodeURIComponent(location.pathname).replace(/^\/([A-Za-z]:)/, '$1');
  const i = p.toLowerCase().lastIndexOf('/codecity/dist/');
  const root = i > 0 ? p.slice(0, i) : '';
  return root && root.split('/').pop() === name ? root.replace(/\//g, '\\') : '';
}
async function kvInit() {
  const name = current.city.repo.name;
  if (window.KV_COMPANION) {
    try { const r = await fetch('/api/status'); kv.status = r.ok ? await r.json() : null; } catch (e) { kv.status = null; }
  }
  kv.on = !!(kv.status && kv.status.ok);
  kv.match = kv.on && String(kv.status.repo).split(/[\\/]/).pop() === name;
  kv.root = kv.match ? kv.status.repo : kvRootFromPage(name);
}
// once per loaded city: dropping another city.json in re-checks whether it is the segéd's repo
const kvReady = () => (kv.for === current.city && kv.ready) || (kv.for = current.city, kv.ready = kvInit());
const kvAbs = rel => kv.root + (rel && rel !== '.' ? '\\' + rel.replace(/\//g, '\\') : '');

function kvToast(msg) {
  let t = $('kv-toast');
  if (!t) { t = document.createElement('div'); t.id = 'kv-toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(kvToast.t); kvToast.t = setTimeout(() => { t.hidden = true; }, 4000);
}
function kvCopy(text, ok) {
  const done = () => kvToast(ok || 'A vágólapon: ' + text);
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt('Másold ki:', text));
  else prompt('Másold ki:', text);
}
function kvLink(url) { const a = document.createElement('a'); a.href = url; a.rel = 'noopener'; a.click(); }

// ---- history: the commits that touched a file, or any file of a district (newest first)
function kvHistory(c) {
  const city = current.city, set = new Set();
  const files = c.file ? [c.file] : city.files.filter(f => !c.rel || f.p.startsWith(c.rel + '/'));
  for (const f of files) for (const ci of replay.touch[f.i] || []) set.add(ci);
  const list = [...set].sort((a, b) => b - a), shown = list.slice(0, 40);
  const rows = shown.map(ci => { const k = city.commits[ci];
    return `<li data-ci="${ci}" title="Ugrás erre a commitra">${new Date(k[0] * 1000).toLocaleDateString('hu-HU')} <span class="dim">${esc(k[4])}</span> ${esc(k[3])}` +
      ` <span class="dim">— ${esc(city.authors[k[1]] || '')}${k[2] >= 0 ? ' · ügynök' : ''}</span></li>`; }).join('');
  openPanel((c.rel || city.repo.name) + (c.file ? '' : '/') + ' — előzmények', [['Commitok', hu(list.length)]],
    `<ul class="kv-hist">${rows}</ul>` + (list.length > shown.length ? `<p class="dim">… és még ${hu(list.length - shown.length)} régebbi</p>` : ''));
  $('panel').querySelectorAll('li[data-ci]').forEach(li => { li.onclick = () => { tlPause(); applyTime(+li.dataset.ci, 260); }; });
}

const KV_ACT = [
  { id: 'details', label: 'Részletek', g: 'info', run: c => (c.file ? showFile(c.file) : showDir(c.dir)) },
  { id: 'history', label: 'Előzmények (commitok)', g: 'info', run: kvHistory },
  { id: 'folder', label: 'Mappa megnyitása (Explorer)', g: 'open', need: 'companion',
    run: c => kvCall('open-folder', { dir: c.dirRel }).then(r => kvDone(r, 'Mappa megnyitva')) },
  { id: 'vscode', label: 'Megnyitás VS Code-ban', g: 'open', need: 'companion',
    run: c => (c.file ? kvCall('open-file', { path: c.rel }) : kvCall('open-vscode', { dir: c.dirRel })).then(r => kvDone(r, 'VS Code nyílik')) },
  { id: 'term', label: 'Terminál itt', g: 'open', need: 'companion',
    run: c => kvCall('open-terminal', { dir: c.dirRel }).then(r => kvDone(r, 'Terminál megnyitva')) },
  { id: 'claude', label: 'Claude Code itt', g: 'claude', need: 'root',
    run: c => (kv.match ? kvCall('open-claude', { dir: c.dirRel }).then(r => kvDone(r, 'Claude Code indul'))
      : (kvLink(KV_CLAUDE_CLI + encodeURIComponent(kvAbs(c.dirRel))), kvToast('Claude Code indul (claude-cli:// link)'))) },
  { id: 'claude-app', label: 'Claude app: új munkamenet itt', g: 'claude', need: 'root',
    run: c => { kvLink(KV_CLAUDE_APP + encodeURIComponent(kvAbs(c.dirRel))); kvToast('A Claude app nyílik (claude:// link)'); } },
  { id: 'copy', label: 'Útvonal másolása', g: 'copy',
    run: c => kvCopy(kv.root ? kvAbs(c.rel) : c.rel) },
  { id: 'copy-rel', label: 'Repón belüli útvonal másolása', g: 'copy', when: c => !!c.rel, whyNot: 'Ez maga a repó',
    run: c => kvCopy(c.rel) }
];

function kvActState(a, c) {
  if (a.need === 'companion' && !kv.match) return { on: false, why: kv.on ? KV_WHY.other : KV_WHY.companion };
  if (a.need === 'root' && !kv.root) return { on: false, why: KV_WHY.root };
  if (a.when && !a.when(c)) return { on: false, why: a.whyNot || '' };
  return { on: true, why: '' };
}
function kvCtx(hit) {
  if (hit.file) { const rel = hit.file.p, d = rel.split('/').slice(0, -1).join('/'); return { file: hit.file, rel, dirRel: d || '.' }; }
  const rel = hit.dir.path || ''; return { dir: hit.dir, rel, dirRel: rel || '.' };
}

function kvMenuClose() { if (kv.menu) { kv.menu.remove(); kv.menu = null; } }
async function onContext(e) {
  kvMenuClose();
  const hit = pickAt(e);
  if (!hit) return;
  await kvReady();
  const c = kvCtx(hit);
  const m = document.createElement('div');
  m.id = 'kv-menu'; m.setAttribute('role', 'menu');
  m.innerHTML = `<div class="kv-mh">${esc(c.rel || current.city.repo.name)}${c.file ? '' : '/'}</div>` + KV_ACT.map((a, k) => {
    const s = kvActState(a, c), sep = k && KV_ACT[k - 1].g !== a.g ? '<hr>' : '';
    return sep + `<div class="kv-mi${s.on ? '' : ' off'}" role="menuitem" data-k="${k}"${s.on ? ' tabindex="-1"' : ' aria-disabled="true"'}>${esc(a.label)}` +
      (s.on ? '' : `<small>${esc(s.why)}</small>`) + '</div>';
  }).join('');
  m.addEventListener('click', ev => {
    const it = ev.target.closest('.kv-mi');
    if (!it || it.classList.contains('off')) return;
    kvMenuClose(); KV_ACT[+it.dataset.k].run(c);
  });
  document.body.append(m); kv.menu = m; $('tip').hidden = true;
  m.style.left = Math.max(4, Math.min(e.clientX, innerWidth - m.offsetWidth - 4)) + 'px';
  m.style.top = Math.max(4, Math.min(e.clientY, innerHeight - m.offsetHeight - 4)) + 'px';
}
addEventListener('pointerdown', e => { if (kv.menu && !kv.menu.contains(e.target)) kvMenuClose(); }, true);
addEventListener('keydown', e => { if (e.key === 'Escape') kvMenuClose(); });
addEventListener('wheel', () => kvMenuClose(), { passive: true });
