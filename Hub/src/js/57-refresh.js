// Frissítés: live topology, access list, roadmap commits, branches, decision files, own version.
// kpRefreshCore does the network part and returns plain data (testable in Node); kpRefresh applies
// it to the page. Everything fetched is ETag-cached in kpStore, so a second refresh is mostly 304s.

const KP_AUTO_REFRESH_MS = 10 * 60 * 1000;
const KP_COMMITS_PER = 8;
const KP_MAX_BRANCHES = 10;
const KP_DECISION_RE = /(^|\/)(DECISIONS[^/]*\.md|[^/]*-Q-[^/]*\.json)$/;
const KP_SELF_PATH = 'Hub/dist/vrg-kapu.html';

// seed entries + commits, newest first; a commit whose first line equals a seed text shows once
function kpMergeRoadmap(seed, commits) {
  const rows = (commits || []).slice();
  const texts = new Set(rows.map(c => c.t));
  for (const s of seed || []) if (!texts.has(s.t)) rows.push(s);
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// decision files per program: the longest git path prefix wins
function kpDecisionCounts(topo, paths) {
  const progs = (topo.programs || []).flatMap(p => ((p.git && p.git.paths) || []).filter(Boolean).map(g => ({ id: p.id, pre: g.replace(/\/+$/, '') + '/' })));
  const out = Object.fromEntries((topo.programs || []).map(p => [p.id, 0]));
  for (const f of paths) {
    if (!KP_DECISION_RE.test(f)) continue;
    let best = null;
    for (const p of progs) if (f.startsWith(p.pre) && (!best || p.pre.length > best.pre.length)) best = p;
    if (best) out[best.id]++;
  }
  return out;
}

// one ETag-cached call; the derived value (not the raw body) is what persists in kpStore
async function kpGhCached(path, key, derive, opts, stats) {
  const sk = 'etag.' + key;
  const stored = kpStore.get(sk, null);
  stats.requests++;
  const r = await kpGhFetch(path, Object.assign({}, opts, { etag: stored && stored.etag }));
  if (r.status === 304 && stored) { stats.hits++; return { ok: true, value: stored.value, hit: true }; }
  if (r.status === 200) {
    stats.fresh++;
    const value = derive(r.json != null ? r.json : r.text);
    if (r.etag) kpStore.set(sk, { etag: r.etag, value });
    return { ok: true, value, hit: false };
  }
  if (r.status === 0) stats.offline = true;
  return { ok: false, status: r.status, value: stored ? stored.value : null };
}

const kpCommitRow = (c, repo) => ({
  date: ((c.commit && (c.commit.committer || c.commit.author) || {}).date || '').slice(0, 10),
  t: String((c.commit && c.commit.message) || '').split('\n')[0],
  author: (c.author && c.author.login) || ((c.commit && c.commit.author) || {}).name || '',
  sha: c.sha, url: 'https://github.com/' + repo.owner + '/' + repo.name + '/commit/' + c.sha
});

// -> { topology, access, live, status: [[label, text]], stats }
async function kpRefreshCore(topoNow, accessNow, pubkey, onStep) {
  const repo = topoNow.repo, base = '/repos/' + repo.owner + '/' + repo.name;
  const stats = { requests: 0, hits: 0, fresh: 0, offline: false };
  const status = [];
  const step = (label, text) => { status.push([label, text]); if (onStep) onStep(status.slice()); };
  let topology = topoNow, access = accessNow;

  // 1. topology: replace only when it validates
  const t = await kpGhCached(base + '/contents/Hub/data/topology.json?ref=main', 'topology', x => JSON.parse(x), { raw: true }, stats);
  if (t.ok && t.value) {
    const v = kpValidate(t.value);
    if (v.ok) { topology = t.value; step('Topológia', t.hit ? '✓ (változatlan)' : '✓'); }
    else step('Topológia', 'hibás, a régit mutatom');
  } else step('Topológia', stats.offline ? 'nincs kapcsolat' : 'nem elérhető (' + t.status + ')');

  // 2. access list: take it only when its signature verifies
  const a = await kpGhCached(base + '/contents/Hub/data/access.json?ref=main', 'access', x => JSON.parse(x), { raw: true }, stats);
  if (a.ok && a.value) {
    const chk = await kpAccessCheck(a.value, pubkey, null);
    if (chk.valid) { access = a.value; step('Engedélyezett lista', '✓'); }
    else step('Engedélyezett lista', 'aláírás érvénytelen, a régit tartom');
  } else step('Engedélyezett lista', 'nem elérhető');

  // 3. commits per visible program
  const live = { roadmap: {}, branches: {}, decisions: {}, at: new Date().toISOString(), self: null };
  const progs = (topology.programs || []).filter(p => p.status !== 'v2' && p.git);
  let n = 0;
  for (const p of progs) {
    const path = (p.git.paths || [])[0] || '';
    const q = '?sha=main&per_page=' + KP_COMMITS_PER + (path ? '&path=' + encodeURIComponent(path) : '');
    const c = await kpGhCached(base + '/commits' + q, 'commits.' + (path || '_root'), list => list.map(x => kpCommitRow(x, repo)), {}, stats);
    if (c.value) live.roadmap[p.id] = c.value;
    step('Ütemterv', ++n + '/' + progs.length);
  }

  // 4. branches touching a program path
  const br = await kpGhCached(base + '/branches?per_page=100', 'branches', list => list.map(b => ({ name: b.name, sha: b.commit && b.commit.sha })), {}, stats);
  const mainSha = ((br.value || []).find(b => b.name === 'main') || {}).sha;
  const others = (br.value || []).filter(b => b.name !== 'main').slice(0, KP_MAX_BRANCHES);
  for (const b of others) {
    const ck = 'cmp.' + b.name, prev = kpStore.get(ck, null);
    let files = prev && prev.main === mainSha && prev.head === b.sha ? prev.files : null;
    if (!files) {
      stats.requests++;
      const r = await kpGhFetch(base + '/compare/main...' + encodeURIComponent(b.name));
      if (r.status === 200) { stats.fresh++; files = (r.json.files || []).map(f => f.filename); kpStore.set(ck, { main: mainSha, head: b.sha, files }); }
    }
    for (const p of topology.programs || []) {
      const pre = ((p.git && p.git.paths) || []).filter(Boolean);
      if (files && pre.some(g => files.some(f => f.startsWith(g.replace(/\/+$/, '') + '/') || f === g))) (live.branches[p.id] = live.branches[p.id] || []).push(b.name);
    }
  }
  step('Ágak', br.ok ? others.length + ' fejlesztési ág' : 'nem elérhető');

  // 5. decision files
  const tr = await kpGhCached(base + '/git/trees/main?recursive=1', 'tree', j => (j.tree || []).filter(x => x.type === 'blob' && KP_DECISION_RE.test(x.path)).map(x => x.path), {}, stats);
  if (tr.value) live.decisions = kpDecisionCounts(topology, tr.value);
  step('Döntési fájlok', tr.value ? '✓' : 'nem elérhető');

  // 6. our own version
  const self = await kpGhCached(base + '/contents/' + KP_SELF_PATH + '?ref=main', 'self', x => ((String(x).match(/const KP_BUILD = "([0-9a-f]{12})"/) || [])[1] || null), { raw: true }, stats);
  live.self = self.value;
  step('Kapu verzió', self.value && typeof KP_BUILD !== 'undefined' && self.value !== KP_BUILD ? 'új verzió elérhető' : '✓');

  step('Kész', stats.offline ? 'nincs kapcsolat — a tárolt állapotot mutatom'
    : !stats.fresh ? 'minden friss (' + stats.requests + ' kérés, semmi új)' : stats.requests + ' kérés, ' + stats.fresh + ' újdonsággal');
  return { topology, access, live, status, stats };
}

// live data folded into a copy of the topology, so the layout stays pure
function kpApplyLive(topo, live) {
  if (!live) return topo;
  return Object.assign({}, topo, { programs: (topo.programs || []).map(p => Object.assign({}, p, {
    roadmap: kpMergeRoadmap(p.roadmap, live.roadmap[p.id]),
    branches: live.branches[p.id] || [],
    decisions: live.decisions[p.id] || 0
  })) });
}

// ---- page side
const kpLive = () => kpStore.get('live', null);
let kpRefreshing = false;

async function kpRefresh(opts) {
  if (kpRefreshing) return;
  if (!kpGh.token) { kpToast('A frissítéshez GitHub belépés kell — Belépések'); return; }
  kpRefreshing = true;
  const box = kpRefreshBox();
  try {
    const r = await kpRefreshCore(kpData.topology, kpData.access, kpData.pubkey, s => kpRefreshShow(box, s));
    if (r.stats.offline) { kpStore.set('stale', true); }
    else {
      kpData.topology = r.topology;
      kpData.access = r.access;
      kpStore.set('live', r.live);
      kpStore.set('topoCache', r.topology);
      kpStore.set('accessCache', r.access);
      kpStore.set('stale', false);
      kpStore.set('lastRefresh', r.live.at);
    }
    await kpSigninChanged();
    kpRenderRefreshBtn();
    setTimeout(() => box.remove(), opts && opts.keep ? 60000 : 5000);
    return r;
  } finally { kpRefreshing = false; }
}

function kpRefreshBox() {
  let b = document.getElementById('kpRefreshBox');
  if (b) b.remove();
  b = kpEl('div', { id: 'kpRefreshBox', class: 'kp-refresh-box', role: 'status' }, kpEl('div', { class: 'kp-pop-h' }, '⟳ Frissítés'));
  document.body.append(b);
  return b;
}
function kpRefreshShow(box, status) {
  const rows = new Map(status);   // later lines of one label replace earlier ones
  box.replaceChildren(kpEl('div', { class: 'kp-pop-h' }, '⟳ Frissítés'),
    ...[...rows].map(([l, t]) => kpEl('div', { class: 'kp-rf-row' }, kpEl('span', {}, l), kpEl('span', { class: 'kp-muted' }, t))));
}

function kpRenderRefreshBtn() {
  const b = document.getElementById('kpRefresh');
  if (!b) return;
  const at = kpStore.get('lastRefresh', null);
  b.title = 'Legfrissebb állapot a GitHubról · utoljára: ' + (at ? kpFmtDate(at) + ' ' + at.slice(11, 16) : 'még soha');
}

// cached state on open (before the first render): a newer cached topology wins over the baked one
function kpRefreshRestore() {
  const t = kpStore.get('topoCache', null);
  if (t && kpValidate(t).ok && (t.updated || '') >= (kpData.topology.updated || '')) kpData.topology = t;
  const a = kpStore.get('accessCache', null);
  if (a) kpData.access = a;
}

// after sign-in: the button, and a refresh when the last one is older than 10 minutes
function kpRefreshBoot() {
  document.getElementById('kpRefresh').addEventListener('click', () => kpRefresh());
  kpRenderRefreshBtn();
  const at = kpStore.get('lastRefresh', null);
  if (kpGh.token && (!at || Date.now() - Date.parse(at) > KP_AUTO_REFRESH_MS)) kpRefresh();
}

// ---- Mi változott? since the last look
function kpChangesOpen() {
  const since = kpStore.get('lastSeen', null);
  const live = kpLive();
  const topo = kpData.topology;
  const items = [];
  if (!since) items.push(kpEl('p', { class: 'kp-muted' }, 'Ez az első megnyitás ebben a böngészőben — mostantól innen számolunk.'));
  else {
    if ((topo.updated || '') > since.slice(0, 10)) items.push(kpEl('p', {}, 'A térkép változott: ' + kpFmtDate(topo.updated) + (topo.updatedBy ? ' · ' + topo.updatedBy : '')));
    for (const p of topo.programs || []) {
      const fresh = ((live && live.roadmap[p.id]) || []).filter(c => c.date > since.slice(0, 10));
      if (fresh.length) items.push(kpEl('div', { class: 'kp-ch' }, kpEl('b', {}, p.t), kpEl('ul', {}, ...fresh.map(c =>
        kpEl('li', {}, kpFmtDate(c.date) + ' ', kpEl('a', { href: c.url, target: '_blank', rel: 'noopener' }, c.t), c.author ? ' · ' + c.author : '')))));
    }
    if (items.length === 0) items.push(kpEl('p', {}, 'Nincs újdonság ' + kpFmtDate(since) + ' óta.'));
    if (!live) items.push(kpEl('p', { class: 'kp-muted' }, 'Frissíts (⟳), hogy a GitHub újdonságai is látszódjanak.'));
  }
  kpModalOpen('Mi változott?' + (since ? ' — ' + kpFmtDate(since) + ' óta' : ''), ...items);
  kpStore.set('lastSeen', new Date().toISOString());
}

if (typeof module !== 'undefined') module.exports = { kpMergeRoadmap, kpDecisionCounts, kpApplyLive };

// ---- ☰ menu (H11 adds the rest of 03_UI §7)
const KP_MAIN_MENU = [
  { label: 'Mi változott?', run: () => kpChangesOpen() },
  { label: 'Frissítés most', run: () => kpRefresh({ keep: true }) },
  { label: 'Exportálás JSON', run: () => kpExport() },
  { label: 'Importálás JSON…', run: () => kpImport() },
  { label: 'Elrejtett elemek…', run: () => kpHiddenOpen() }
];
function kpMainMenuInit() {
  const b = document.getElementById('kpMenuBtn');
  b.addEventListener('click', () => {
    kpMenuClose();
    const r = b.getBoundingClientRect();
    const m = kpEl('div', { id: 'kpMenu', class: 'kp-menu', role: 'menu' }, ...KP_MAIN_MENU.map(it =>
      kpEl('div', { class: 'kp-mi', role: 'menuitem', tabindex: '-1', onclick: e => { e.stopPropagation(); kpMenuClose(); it.run(); } }, it.label)));
    document.body.append(m);
    m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
    m.style.top = r.bottom + 4 + 'px';
    m.querySelector('.kp-mi').focus();
  });
}
