// The page side of the Kapu segéd: present only when the page is served by Hub/companion/server.js
// (which injects window.KP_COMPANION = {token, port}). Without it the buttons that start
// something stay greyed and the tool links open as plain files.

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
  if (typeof window === 'undefined' || !window.KP_COMPANION) return null;
  try { const r = await fetch('/api/status'); return r.ok ? await r.json() : null; } catch (e) { return null; }
}

function kpCompDone(r, ok) {
  if (r.status === 200) kpToast(r.json && r.json.dryRun ? 'Próba: ' + r.json.exe + ' ' + (r.json.args || []).join(' ') + (r.json.cwd ? ' @ ' + r.json.cwd : '') : ok);
  else if (r.status === 403) kpToast('Ez a mappa nincs az engedélyezettek között (Hub/companion/config.json → roots)');
  else kpToast((r.json && r.json.error) || 'A Kapu segéd hibát jelzett (' + r.status + ')');
  return r;
}
const kpCompStart = () => kpCompCall('open-start', {}).then(r => kpCompDone(r, 'A START.cmd új ablakban indul'));
const kpCompTool = path => kpCompCall('open-tool', { path }).then(r => kpCompDone(r, 'Megnyitva, ahogy a START.cmd nyitja'));
const kpCompFolder = dir => kpCompCall('open-folder', { dir }).then(r => kpCompDone(r, 'Mappa megnyitva'));
