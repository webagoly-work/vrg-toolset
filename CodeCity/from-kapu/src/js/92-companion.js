// The page side of the Kapu segéd: present only when the page is served by Hub/companion/server.js
// (which injects window.KP_COMPANION = {token, port}). Without it every action here stays greyed.

const kpComp = { on: false, status: null };

async function kpCompCall(action, body) {
  const c = typeof window !== 'undefined' && window.KP_COMPANION;
  if (!c) return { status: 0, json: { error: 'Kapu segéd nélkül' } };
  try {
    const r = await fetch('/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kapu-Token': c.token }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  } catch (e) { return { status: 0, json: { error: 'A Kapu segéd nem válaszol' } }; }
}

async function kpCompStatus() {
  if (!window.KP_COMPANION) return null;
  try { const r = await fetch('/api/status'); return r.ok ? await r.json() : null; } catch (e) { return null; }
}

// the repo-relative folder a node stands for ('.' = repo root); 'local' paths live next to the repo
function kpNodeDir(c) {
  const n = c.node, p = c.prog, s = n.src || {};
  const dirOf = f => f.split('/').slice(0, -1).join('/') || '.';
  if (n.kind === 'folder' || n.kind === 'local') return s.local ? '../' + s.local : null;
  if (n.kind === 'agent' || n.kind === 'go') return s.repo ? dirOf(s.repo) : s.local ? '../' + s.local : null;
  if (n.kind === 'git') return (s.paths || [])[0] || '.';
  if (n.kind === 'l6folder') return s && s.path ? s.path : null;
  if (p) {
    const g = ((p.git && p.git.paths) || [])[0];
    if (g) return /\.[A-Za-z0-9]+$/.test(g) ? dirOf(g) : g;
    if (p.open && p.open.repo) return dirOf(p.open.repo);
    if (p.open && p.open.local) return '../' + p.open.local;
  }
  return '.';
}

function kpCompDone(r, ok) {
  if (r.status === 200) kpToast(r.json && r.json.dryRun ? 'Próba: ' + r.json.exe + ' ' + (r.json.args || []).join(' ') + (r.json.cwd ? ' @ ' + r.json.cwd : '') : ok);
  else if (r.status === 403) kpToast('Ez a mappa nincs az engedélyezettek között (Hub/companion/config.json → roots)');
  else kpToast((r.json && r.json.error) || 'A Kapu segéd hibát jelzett (' + r.status + ')');
  return r;
}
const kpCompFolder = dir => kpCompCall('open-folder', { dir }).then(r => kpCompDone(r, 'Mappa megnyitva'));
const kpCompTerminal = dir => kpCompCall('open-terminal', { dir }).then(r => kpCompDone(r, 'Terminál megnyitva'));
const kpCompClaude = dir => kpCompCall('open-claude', { dir }).then(r => kpCompDone(r, 'Claude Code indul'));
const kpCompTool = path => kpCompCall('open-tool', { path }).then(r => kpCompDone(r, 'Megnyitva, ahogy a START.cmd nyitja'));

async function kpCompPull() {
  const box = kpModalOpen('Frissítés a GitHubról', kpEl('p', { class: 'kp-muted' }, 'git pull --ff-only fut…'));
  const r = await kpCompCall('git', { cmd: 'pull' });
  const out = r.json ? [r.json.out, r.json.err].filter(Boolean).join('\n').trim() : '';
  box.replaceChildren(box.firstChild,
    kpEl('p', {}, r.status === 200 && r.json.ok ? 'Kész.' : 'Nem sikerült — lehet, hogy helyi változás akadályozza. A kimenet:'),
    kpEl('pre', { class: 'kp-pre' }, out || (r.json && r.json.error) || ''),
    kpEl('div', { class: 'kp-pop-row' }, kpEl('button', { class: 'kp-btn kp-primary', onclick: () => location.reload() }, 'Kapu újratöltése')));
  kpComp.status = await kpCompStatus();
}

function kpCompRow() {
  const s = kpComp.status;
  if (!kpComp.on) return ['nem fut', kpEl('button', { class: 'kp-btn', onclick: () => kpToast('Indítsd a Hub\\VRG Kapu.cmd-vel (START.cmd: H) — a Kapu ekkor a localhost:8795 címen nyílik') }, 'Hogyan indítom?')];
  return ['fut (localhost:' + window.KP_COMPANION.port + ')' + (s && s.branch ? ' · ág: ' + s.branch + (s.dirty ? ' · ' + s.dirty + ' helyi változás' : '') + (s.behind ? ' · ' + s.behind + ' új commit a GitHubon' : '') : ''), null];
}

function kpClaudeMenu(anchor) {
  kpMenuClose();
  const r = anchor.getBoundingClientRect();
  const items = [
    ['helyi', kpComp.on, () => kpCompClaude('.')],
    ['web', true, () => kpOpen(KP_CLAUDE_WEB)],
    ['indító prompt másolása', true, () => kpCopy('Olvasd el a `CLAUDE.md`-t és a `GO-HUB.md`-t, aztán mondd el, hol tartunk.', 'Az indító prompt a vágólapon')]
  ];
  const m = kpEl('div', { id: 'kpMenu', class: 'kp-menu', role: 'menu' }, ...items.map(([label, on, run]) =>
    kpEl('div', { class: 'kp-mi' + (on ? '' : ' off'), role: 'menuitem', tabindex: '-1', title: on ? null : KP_WHY.companion,
      onclick: e => { e.stopPropagation(); if (!on) return; kpMenuClose(); run(); } }, label)));
  document.body.append(m);
  m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
  m.style.top = r.bottom + 4 + 'px';
}

async function kpCompInit() {
  document.getElementById('kpTermBtn').addEventListener('click', () => kpComp.on ? kpCompTerminal('.') : kpToast(KP_WHY.companion));
  document.getElementById('kpClaudeBtn').addEventListener('click', e => kpClaudeMenu(e.currentTarget));
  kpComp.status = await kpCompStatus();
  kpComp.on = !!(kpComp.status && kpComp.status.ok);
  kpCaps.companion = kpComp.on;
  document.getElementById('kpTermBtn').classList.toggle('off', !kpComp.on);
  if (kpComp.on) KP_MAIN_MENU.unshift({ label: 'Frissítés a GitHubról (git pull)', run: kpCompPull });
}
