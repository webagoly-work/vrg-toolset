// autostart.js - "Indítás a Windowszal" on the settings page.
//
// On: a shortcut "Planner CYD makropad.lnk" in the user's Startup folder that opens
// 4 - USB - Makropad.bat minimised, so the macropad is there after every sign-in.
// Off: the shortcut is deleted. Nothing else is touched (no registry, no scheduled task),
// and the user can also remove it by hand: Win+R, shell:startup.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const NAME = 'Planner CYD makropad.lnk';
const BAT = path.join(__dirname, '../../4 - USB - Makropad.bat');

function startupDir() {
  return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'), 'Microsoft/Windows/Start Menu/Programs/Startup');
}

// dir: only for tests (a scratch folder instead of the real Startup folder)
function status(dir) {
  return fs.existsSync(path.join(dir || startupDir(), NAME));
}

function set(on, dir) {
  const lnk = path.join(dir || startupDir(), NAME);
  if (!on) { try { fs.unlinkSync(lnk); } catch (e) { if (e.code !== 'ENOENT') throw e; } return false; }
  if (!fs.existsSync(BAT)) throw new Error('missing: ' + BAT);
  // WScript.Shell writes the .lnk; the paths travel as environment variables, not inside the script
  const ps = '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:CYD_LNK); ' +
    '$s.TargetPath = $env:CYD_BAT; $s.WorkingDirectory = (Split-Path $env:CYD_BAT); ' +
    '$s.WindowStyle = 7; $s.Description = "Planner CYD makropad (Firmware\\planner-cyd)"; $s.Save()';
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps],
    { env: Object.assign({}, process.env, { CYD_LNK: lnk, CYD_BAT: path.resolve(BAT) }), encoding: 'utf8', windowsHide: true });
  if (r.status !== 0 || !fs.existsSync(lnk)) throw new Error((r.stderr || 'shortcut not written').trim().slice(0, 200));
  return true;
}

module.exports = { status, set, startupDir, NAME, BAT };
