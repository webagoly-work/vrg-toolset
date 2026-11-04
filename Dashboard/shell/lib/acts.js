// acts.js — act ids → registry items (the allow-list) and what an act does.
// createActs({ R, run, ports, log }) returns { act, lookup, runAct }.
'use strict';
const path = require('path');
const { execFile } = require('child_process');

// the first prompt of a "continue" session; it only reads, so nothing runs before the user says so
const CONTINUE = 'Continue this dev line: read CLAUDE.md in this folder, check the real state, then tell me where it stands and the next step.';

function createActs({ R, run, ports, log = () => {} }) {
  const { say, T, ui, Q, argList, exists } = R;
  const P = s => R.expand(s);

  async function act(it) {                                            // vrg-ui.ps1 Act, minus the console-only kinds
    const C = R.C;
    if (it.action || it.phase || it.menu || it.servers || it.programs || it.prompts)
      return say(false, 'Ez a START-ban fut.', 'This one runs in START.');
    if (it.steps) {
      const cwd = it.cwd ? P(it.cwd) : C.paths.REPO;
      const lines = it.steps.map(s => ('call ' + Q(P(s.exe)) + ' ' + argList(s.args).join(' ')).replace(/%/g, '%%') + ' || goto :fail');
      const then = it.then ? P(it.then) : '';
      const b = then && (C.menu.browsers || []).find(x => x.exe && exists(P(x.exe)));
      if (then) lines.push(b ? `start "" ${Q(P(b.exe))} ${argList(b.args).join(' ')} ${Q(then)}`.replace(/%/g, '%%') : `start "" "${then}"`);
      lines.push('echo.', 'echo   Kesz.', 'goto :end', ':fail', 'echo.', 'echo   HIBA, a tovabbi lepesek elmaradtak.', ':end', 'echo.', 'pause');
      run.runBat(it.name, cwd, lines, 'start');
      return say(true, T(ui('window'), { name: it.name }), 'runs in its own window');
    }
    if (it.groups) {                                                  // Zen: one window per group, the rest as tabs
      const exe = P(it.exe); if (!exists(exe)) return say(false, T(ui('missing'), { path: exe }), 'not found');
      for (const g of it.groups) {
        const pages = g.map(P).filter(x => /^https?:/.test(x) || exists(x));
        for (let i = 0; i < pages.length; i++) {
          run.startExe(it.name, exe, [i ? '-new-tab' : '-new-window', Q(pages[i])], path.dirname(exe));
          if (!i && !run.dry) await new Promise(r => setTimeout(r, 3000));
        }
      }
      return say(true, T(ui('opened'), { name: it.name }), 'opened');
    }
    if (it.path) {
      const p = P(it.path); if (!exists(p)) return say(false, T(ui('missing'), { path: p }), 'not found');
      let warn = '';
      if (it.before) {
        if (run.dry) run.dry.push({ before: P(it.before.exe), args: (it.before.args || []).map(P) });
        else warn = await new Promise(res => execFile(P(it.before.exe), (it.before.args || []).map(P), { timeout: 120e3, windowsHide: true },
          e => res(e ? T(ui('beforeFailed'), { note: String(it.before.note || '').replace(/…$/, '') }) : '')));
      }
      run.openDoc(p, it.name);
      return say(!warn, warn || T(ui('opened'), { name: it.name }), warn ? 'opened, the step before failed' : 'opened');
    }
    if (it.exe) {
      const need = R.needs(it); if (need && !exists(need)) return say(false, T(ui('missing'), { path: need }), 'not installed');
      if (it.ensure && !exists(P(it.ensure.path))) return say(false, 'Először a START-ból indítsd: ' + (it.ensure.note || ''), 'Run it from START once first (it downloads what it needs).');
      if (it.server) { const s = R.server(it.server); if (s && !(await ports.up(s.port))) { const err = ports.startServer(s, it.serverArgs || []); if (err) return say(false, err, 'not found'); } }
      const exe = P(it.exe);
      run.startExe(it.name, exe, argList(it.args), it.cwd ? P(it.cwd) : /\\/.test(exe) ? path.dirname(exe) : C.paths.REPO);
      return say(true, T(ui('started'), { name: it.name }), 'started');
    }
    if (it.server) { const s = R.server(it.server); return s ? ports.openServer(s) : say(false, 'Ismeretlen szerver', 'unknown server'); }
    if (it.url) { run.openUrl(P(it.url)); return say(true, T(ui('opened'), { name: it.name }), 'opened'); }
    if (it.folder) { const f = P(it.folder); if (!exists(f)) return say(false, T(ui('missing'), { path: f }), 'not found');
      run.openPath(f); return say(true, T(ui('opened'), { name: it.name }), 'opened'); }
    return say(false, 'Nincs teendő', 'nothing to do');
  }

  function lookup(id) {
    const C = R.C;
    if (typeof id !== 'string' || id.length > 80) return null;
    let m;
    if ((m = id.match(/^s:([^/]+(?:\/[^/]+)?)$/))) return C.startActs[id] ? { item: C.startActs[id] } : null;
    if ((m = id.match(/^srv:([\w-]+)$/))) { const s = R.server(m[1]); return s ? { item: { server: s.id, name: s.name } } : null; }
    if ((m = id.match(/^f:([a-z]\d+):(\d+)$/))) {
      const f = C.data.features.find(x => x.id === m[1]); const l = f && f.links[+m[2]];
      if (!l || l.act !== id) return null;
      if (l.kind === 'folder') return { item: { folder: l.path, name: f.title } };
      if (l.kind === 'doc') return { item: { path: l.path, name: f.title } };
      if (l.kind === 'program') return { item: { exe: l.path, name: f.title } };   // START.cmd, BACKUP.cmd … from features.json
      return null;
    }
    // D2: Claude Code is START → C → 1 from the registry; only the folder (DevLog) or the codephrase (GO-*.md) changes
    if ((m = id.match(/^cont:([\w-]+)$/))) {
      const l = C.data.lines.find(x => x.id === m[1]); const c = C.claude && C.startActs[C.claude];
      if (!l || l.contAct !== id || !c) return null;
      return { item: { ...c, name: 'Claude · ' + l.name, cwd: l.sessionPath, args: [...(c.args || []), CONTINUE] } };
    }
    if ((m = id.match(/^go:([A-Z0-9]+)$/))) {
      const g = C.data.go.find(x => x.name === m[1]); const c = C.claude && C.startActs[C.claude];
      if (!g || !g.act || !c) return null;
      return { item: { ...c, name: 'Claude · GO ' + g.name, args: [...(c.args || []), 'GO ' + g.name] } };
    }
    if ((m = id.match(/^godoc:([A-Z0-9]+)$/))) { const g = C.data.go.find(x => x.name === m[1]); return g ? { doc: g.file, name: 'GO ' + g.name } : null; }
    // D4: jobs by anonymised code; the folder and document paths come from collect()'s private map, never from the page
    if ((m = id.match(/^job:([A-Z]{1,3}\d{1,3}(?:-[A-Z]{2,4})?)$/))) { const p = C.jobsPriv[m[1]]; return p && p.folder ? { item: { folder: p.folder, name: m[1] } } : null; }
    if ((m = id.match(/^jobdoc:([A-Z]{1,3}\d{1,3}(?:-[A-Z]{2,4})?)$/))) { const p = C.jobsPriv[m[1]]; return p && p.doc ? { doc: p.doc, name: m[1] } : null; }
    if ((m = id.match(/^line:([\w-]+)$/))) { const l = C.data.lines.find(x => x.id === m[1]); return l && l.sessionPath ? { item: { folder: l.sessionPath, name: l.name } } : null; }
    if ((m = id.match(/^linedoc:([\w-]+)$/))) { const l = C.data.lines.find(x => x.id === m[1]); return l && l.docPath ? { doc: l.docPath, name: l.name } : null; }
    return null;
  }

  async function runAct(id) {
    const hit = lookup(id);
    if (!hit) { log('refused', id); return say(false, 'Nincs a nyilvántartásban: ' + id, 'Not in the registry.'); }
    if (hit.doc) { run.openPath(hit.doc); return say(true, T(ui('opened'), { name: hit.name }), 'opened'); }
    try { const r = await act(hit.item); log(id, r.ok ? 'ok' : 'no', r.hu); return r; }
    catch (e) { log(id, 'error', e.message); return say(false, e.message, 'error'); }
  }

  return { act, lookup, runAct };
}

module.exports = { createActs, CONTINUE };
