// exe-bootstrap.js — the whole app inside "VRG Desktop.exe" (Dashboard/tools/package.js copies it to resources/app/main.js).
// It only finds the repo and runs the repo's shell, so the exe never needs rebuilding when the code changes:
//   1. --repo <dir> on the command line (the START launcher's .cmd passes its own checkout),
//   2. else "repo" in vrg-desktop.json beside the exe (written by package.js),
// and the repo must hold Dashboard/shell/main.js. Anything else: an error box, then quit. All other arguments (--selftest,
// --probe, --start windows …) reach the shell untouched, because it reads process.argv itself.
'use strict';
const path = require('path'), fs = require('fs');

const SHELL = ['Dashboard', 'shell', 'main.js'];

// → { repo, shell } or { err }; exists(file) and the config text are passed in so the choice is testable without Electron
function pickRepo(argv, cfgText, exists) {
  const i = argv.indexOf('--repo');
  let repo = i > 0 && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
  let from = '--repo';
  if (!repo) {
    from = 'vrg-desktop.json';
    let cfg = null;
    try { cfg = JSON.parse(cfgText); } catch (e) { return { err: 'vrg-desktop.json hiányzik vagy hibás / missing or broken' }; }
    repo = cfg && typeof cfg.repo === 'string' ? cfg.repo : '';
  }
  if (!repo || !path.isAbsolute(repo)) return { err: from + ': nem abszolút repó-útvonal / not an absolute repo path: ' + (repo || '(üres)') };
  const shell = path.join(path.resolve(repo), ...SHELL);
  if (!exists(shell)) return { err: from + ': nincs ' + SHELL.join('/') + ' itt / not found in: ' + repo };
  return { repo: path.resolve(repo), shell };
}

function start() {
  const { app, dialog } = require('electron');
  const here = path.dirname(process.execPath);
  let text = '';
  try { text = fs.readFileSync(path.join(here, 'vrg-desktop.json'), 'utf8'); } catch (e) {}
  const r = pickRepo(process.argv, text, f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } });
  if (r.err) {
    if (process.argv.includes('--selftest')) { console.log(JSON.stringify({ ok: false, errors: ['bootstrap: ' + r.err] })); app.exit(1); return; }
    app.whenReady().then(() => { dialog.showErrorBox('VRG Desktop', r.err); app.quit(); });
    return;
  }
  process.env.VRG_DESKTOP_EXE = process.execPath;      // the shell may show where it was started from; nothing depends on it
  require(r.shell);
}

module.exports = { pickRepo, SHELL };
if (require.main === module) start();
