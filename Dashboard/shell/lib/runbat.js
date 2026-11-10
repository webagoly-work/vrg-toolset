// runbat.js — starting things: START-style .cmd files, programs, folders, documents, URLs.
// createRunner({ R, shell, dry, tmp }): `dry` is a list that collects plans instead of running; set runner.dry later to switch.
'use strict';
const path = require('path'), fs = require('fs');
const { spawn } = require('child_process');

function createRunner({ R, shell, dry = null, tmp }) {
  const run = { dry };
  // a .cmd in %TEMP%\VRG that runs `lines`; mode 'start' = its own console, 'min' = minimised, 'hidden' = no console
  run.runBat = (name, cwd, lines, mode) => {
    name = String(name).replace(/[&|<>^%"()]/g, '');                 // a window title, not a command
    const body = ['@echo off', 'chcp 65001 >nul', `title VRG ${name}`, `cd /d "${cwd}"`, ...lines];
    if (run.dry) { run.dry.push({ bat: name, mode, cwd, lines }); return; }
    fs.mkdirSync(tmp, { recursive: true });
    const bat = path.join(tmp, 'dash-' + Math.random().toString(16).slice(2, 10) + '.cmd');
    fs.writeFileSync(bat, body.join('\r\n') + '\r\n', 'utf8');
    const how = mode === 'hidden' ? `"${bat}"` : `start "VRG ${name}"${mode === 'min' ? ' /min' : ''} "${bat}"`;
    spawn('cmd.exe', ['/d', '/c', how], { cwd, detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
  };
  // start a program the way Start-Process does: GUI programs just open, console ones get their own window
  run.startExe = (name, exe, args, cwd) => {
    run.runBat(name, cwd, [`start "" ${R.Q(exe)} ${args.join(' ')}`.replace(/%/g, '%%')], 'hidden');
  };
  run.openPath = p => { if (run.dry) { run.dry.push({ openPath: p }); return; } shell.openPath(p); };
  run.openUrl = u => { if (!/^https?:\/\//.test(u)) return; if (run.dry) { run.dry.push({ url: u }); return; } shell.openExternal(u); };
  // HTML opens in the registry's first browser (START's chooser default), anything else with its Windows program
  run.openDoc = (p, name) => {
    if (/\.html?$/i.test(p)) {
      const b = (R.C.menu.browsers || []).find(x => x.exe && R.exists(R.expand(x.exe)));
      if (b) { run.startExe(name, R.expand(b.exe), [...R.argList(b.args), R.Q(p)], path.dirname(p)); return; }
    }
    run.openPath(p);
  };
  return run;
}

module.exports = { createRunner };
