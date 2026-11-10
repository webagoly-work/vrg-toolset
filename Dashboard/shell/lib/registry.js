// registry.js — the loaded build.collect() registry and the vrg-ui.ps1 equivalents (tokens, quoting, texts).
// createRegistry({ build, log }) returns the object R the other lib modules receive. R.C is the current registry.
'use strict';
const path = require('path'), fs = require('fs');

function createRegistry({ build, log = () => {} }) {
  const R = { C: null, claudeFix: null };
  R.exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
  R.expand = s => R.C.expand(s);
  R.Q = a => /\s/.test(a) && !a.includes('"') ? '"' + a + '"' : a;           // vrg-ui.ps1 Q
  R.argList = list => (list || []).filter(x => x != null).map(x => R.Q(R.expand(x)));
  R.T = (s, v) => Object.keys(v).reduce((a, k) => a.split('{' + k + '}').join(v[k]), s || '');
  R.ui = k => (R.C.menu.ui || {})[k] || k;
  R.say = (ok, hu, en) => ({ ok, hu, en });
  R.server = id => (R.C.menu.servers || []).find(s => s.id === id);
  R.serverUrl = s => 'http://localhost:' + s.port + (s.open || '/');
  R.needs = it => {
    if (it.needs) return R.expand(it.needs);
    if (it.exe && !/^(cmd|powershell|explorer)\.exe$/i.test(it.exe)) return R.expand(it.exe);
    return '';
  };
  // vrg-ui.ps1 falls back to the program on PATH when the portable one is absent; here also when the portable
  // Claude Code is broken (its claude.cmd points at bin\claude.exe, which a failed self-update can leave missing)
  R.findClaude = () => {
    const portable = R.C.expand('{claude}');
    const exe = path.join(path.dirname(portable), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
    if (R.exists(portable) && (!/claude\.cmd$/i.test(portable) || R.exists(exe))) return null;
    try { return require('child_process').execFileSync('where.exe', ['claude.cmd'], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)[0].trim() || null; }
    catch (e) { return null; }
  };
  R.load = () => {
    R.C = build.collect();
    R.claudeFix = R.findClaude();
    if (R.claudeFix) { const base = R.C.expand; R.C.expand = s => base(String(s == null ? '' : s).split('{claude}').join(R.claudeFix)); log('portable Claude Code is broken, using', R.claudeFix); }
    return R.C;
  };
  return R;
}

module.exports = { createRegistry };
