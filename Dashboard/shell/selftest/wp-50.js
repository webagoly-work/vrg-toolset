// WP-50 probe (real Electron, fake-claude, real node-pty): the Munkamenetek pane over throwaway transcripts (VRG_SESSIONS_ROOTS, set here
// only; the real ~/.claude is never read). Three sessions show newest first, the live one with ÉLŐ and without Folytatás; the account
// edge colours come from computed styles (A = accent, B = warm); the B filter leaves one row; Folytatás starts fake-claude with
// `--resume|<id>` in a term pane; the door refuses a path-looking id and a live resume; Vászon resolves to the Munkavászon at #s=<id>.
// Written by a cloud session that had no Electron: it has not run yet (docs/handoff/2026-11-24_munkamenetek-H.md).
// VRG_SHOTS=<folder>: also writes sessions.png.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async function probe({ win }) {
  const errors = [], info = {};
  const { frame } = win.desk;
  const W = frame.webContents;
  const js = code => W.executeJavaScript(code, true);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = async (f, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await f()) return true; } catch (e) {} await sleep(100); } return false; };
  const SHOTS = process.env.VRG_SHOTS || '';

  const ID1 = 'aaaaaaaa-1111-4111-8111-111111111111', ID2 = 'bbbbbbbb-2222-4222-8222-222222222222', ID3 = 'cccccccc-3333-4333-8333-333333333333';
  const old = { roots: process.env.VRG_SESSIONS_ROOTS, bin: process.env.VRG_CLAUDE_BIN };
  fs.mkdirSync(path.join(os.tmpdir(), 'VRG'), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'VRG', 'desk-test-'));
  const work = path.join(tmp, 'work', 'Planner_VRG_U100'); fs.mkdirSync(work, { recursive: true });
  const line = o => JSON.stringify(o) + '\n';
  const put = (root, id, text, ageMs) => {
    const d = path.join(tmp, root, 'projects', '-work'); fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, id + '.jsonl'); fs.writeFileSync(f, text);
    const t = new Date(Date.now() - ageMs); fs.utimesSync(f, t, t);
  };
  put('a', ID1, line({ type: 'user', cwd: work, gitBranch: 'main', message: { content: 'probe idle session' } }), 3 * 3600e3);
  put('a', ID2, line({ type: 'user', cwd: work, gitBranch: 'main', message: { content: 'probe live session' } }), 5e3);
  put('b', ID3, line({ type: 'user', cwd: work, gitBranch: 'claude/b', message: { content: 'probe account b' } }), 2 * 86400e3);
  process.env.VRG_SESSIONS_ROOTS = 'A=' + path.join(tmp, 'a') + ';B=' + path.join(tmp, 'b');
  process.env.VRG_CLAUDE_BIN = path.join(__dirname, '..', '..', 'test', 'fixtures', 'fake-claude.js');

  const Q = `document.querySelector('[data-pane][data-kind="sessions"]')`;
  try {
    frame.setPosition(-4000, 0); frame.setSize(1600, 1000); frame.showInactive();
    if (!(await wait(() => js(`!!(window.VRGDesk && window.VRGDesk.state().ready)`), 12000))) return { ok: false, errors: ['the VRG Asztal did not become ready'] };
    await js(`window.VRGDesk.setLevel('dev'); window.VRGDesk.setView('desktop'); true`);
    await js(`window.VRGFrame.panes().filter(p => /^sessions-/.test(p)).forEach(p => window.VRGFrame.close(p)); true`);
    const id = await js(`window.VRGFrame.open('sessions', {})`);
    if (!/^sessions-\d+$/.test(String(id))) errors.push('sessions pane id: ' + JSON.stringify(id));
    if (!(await wait(() => js(`!!${Q} && ${Q}.querySelectorAll('[data-role="row"]').length === 3`), 8000))) {
      errors.push('three rows did not show: ' + JSON.stringify(await js(`${Q} ? ${Q}.innerText.slice(0, 400) : 'no pane'`)));
      return { ok: false, errors, info };
    }
    const rows = await js(`[...${Q}.querySelectorAll('[data-role="row"]')].map(r => ({ s: r.dataset.session, a: r.dataset.account, live: r.dataset.live === '1',
      acts: [...r.querySelectorAll('[data-role="acts"] button')].map(b => b.dataset.role).join(','), edge: getComputedStyle(r).borderLeftColor,
      name: r.querySelector('[data-role="name"]').textContent }))`);
    info.rows = rows;
    if (rows.map(r => r.s).join() !== [ID2, ID1, ID3].join()) errors.push('order: ' + rows.map(r => r.s).join());
    if (!rows[0].live || rows[1].live) errors.push('live flags: ' + JSON.stringify(rows.map(r => r.live)));
    if (rows[0].acts !== 'fork,canvas') errors.push('live row buttons: ' + rows[0].acts);
    if (rows[1].acts !== 'resume,fork,remote,canvas') errors.push('idle row buttons: ' + rows[1].acts);
    if (rows[1].name !== 'probe idle session') errors.push('title: ' + rows[1].name);
    const tok = await js(`(() => { const p = document.createElement('i'); document.body.append(p); const out = {};
      for (const k of ['accent', 'warm']) { p.style.color = 'var(--mv-' + k + ')'; out[k] = getComputedStyle(p).color; } p.remove(); return out; })()`);
    if (rows[1].edge !== tok.accent) errors.push('A edge ' + rows[1].edge + ' is not the accent ' + tok.accent);
    if (rows[2].edge !== tok.warm) errors.push('B edge ' + rows[2].edge + ' is not warm ' + tok.warm);
    if (!(await js(`/Munkamenetek/.test(${Q}.innerText) && /Felhő/.test(${Q}.innerText) && /Áthozás/.test(${Q}.innerText)`))) errors.push('bar texts missing');
    if (SHOTS) { await sleep(500); fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, 'sessions.png'), (await W.capturePage()).toPNG()); }

    // the B filter
    await js(`(() => { const s = ${Q}.querySelector('[data-role="account"]'); s.value = 'B'; s.dispatchEvent(new Event('change')); return true; })()`);
    const b = await js(`[...${Q}.querySelectorAll('[data-role="row"]')].map(r => r.dataset.session).join()`);
    if (b !== ID3) errors.push('B filter shows: ' + b);
    await js(`(() => { const s = ${Q}.querySelector('[data-role="account"]'); s.value = 'all'; s.dispatchEvent(new Event('change')); return true; })()`);

    // the door
    const bad = await js(`window.vrg.call('sessions', 'resume', { account: 'A', session: '../${ID1}' })`);
    if (!bad || bad.ok !== false || bad.err !== 'bad-request') errors.push('a path-looking id was accepted: ' + JSON.stringify(bad));
    const live = await js(`window.vrg.sessions.resume('A', '${ID2}')`);
    if (!live || live.err !== 'live') errors.push('a live session was resumed: ' + JSON.stringify(live));
    const cv = await js(`window.vrg.sessions.canvas('B', '${ID3}')`);
    if (!cv || cv.do !== 'web' || !String(cv.url).endsWith('/#s=' + ID3)) errors.push('canvas: ' + JSON.stringify(cv));

    // Folytatás → a term pane with fake-claude --resume|ID1
    await js(`window.__term = ''; window.vrg.on('term', 'data', m => { window.__term += m.data; }); true`);
    await js(`${Q}.querySelector('[data-role="row"][data-session="${ID1}"] [data-role="resume"]').click()`);
    const got = await wait(() => js(`/FAKE_CLAUDE --resume\\|${ID1}/.test(window.__term)`), 15000);
    if (!got) errors.push('no "FAKE_CLAUDE --resume|' + ID1 + '" in the term output: ' + JSON.stringify(await js(`window.__term.slice(0, 300)`)));
    if (!(await wait(() => js(`window.VRGFrame.panes().some(p => /^term-/.test(p))`), 8000))) errors.push('no term pane opened');
  } catch (e) { errors.push('probe error: ' + e.stack); }
  finally {
    for (const [k, v] of [['VRG_SESSIONS_ROOTS', old.roots], ['VRG_CLAUDE_BIN', old.bin]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
  return { ok: !errors.length, errors, info };
};
