// WP-14 probe (real Electron, real node-pty): cmd echo, PowerShell major version, both Claude accounts report the same
// --version (args override in this probe only), and after killAll no probe child is alive. A profile whose exe is not on this PC is skipped.
'use strict';
const os = require('os'), path = require('path');
module.exports = async function probe({ C }) {
  const errors = [];
  const ptyLib = require('../lib/pty.js');
  const full = C.paths.FULL;
  const profiles = ptyLib.readProfiles(path.join(__dirname, '..', '..', 'config', 'profiles.json'));
  const pty = ptyLib.createPty({
    profiles, expand: s => C.expand(s), env: process.env,
    spawn: ptyLib.nodePtySpawn(ptyLib.loadNodePty(path.join(full, 'tools', 'js-libs', 'node-pty'))),
  });
  const out = {}, pids = [];
  pty.on('data', e => { out[e.term] = (out[e.term] || '') + e.data; });
  const wait = async (f, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (f()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const avail = id => (pty.profiles().find(p => p.id === id) || {}).available === true;
  const start = (id, o) => { const r = pty.open(id, os.tmpdir(), o); if (r.term) pids.push(r.pid); return r; };

  try {
    for (const [id, input, want] of [['cmd', 'echo VRG_OK\r', 'VRG_OK'], ['pwsh', '$PSVersionTable.PSVersion.Major\r', '5']]) {
      if (!avail(id)) { errors.push(id + ': profile unavailable'); continue; }
      const r = start(id);
      if (!r.term) { errors.push(id + ': ' + JSON.stringify(r)); continue; }
      await new Promise(res => setTimeout(res, id === 'pwsh' ? 2000 : 500));
      pty.write(r.term, input);
      const plain = () => (out[r.term] || '').replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07]*\x07/g, '');
      if (!(await wait(() => (id === 'cmd' ? plain().includes(want) : /(^|[\r\n])5[\r\n]/.test(plain())), 5000))) errors.push(id + ': no ' + want + ' in output: ' + JSON.stringify(plain().slice(-200)));
    }

    const ver = {};
    for (const id of ['claude-a', 'claude-b']) {
      if (!avail(id)) continue;                                              // Claude Code not installed on this PC
      const r = start(id, { args: ['--version'] });
      if (!r.term) { errors.push(id + ': ' + JSON.stringify(r)); continue; }
      if (!(await wait(() => /\d+\.\d+\.\d+/.test(out[r.term] || ''), 15000))) { errors.push(id + ': no version'); continue; }
      ver[id] = out[r.term].match(/\d+\.\d+\.\d+[^\r\n]*/)[0].trim();
    }
    if (ver['claude-a'] && ver['claude-b'] && ver['claude-a'] !== ver['claude-b']) errors.push('claude versions differ: ' + JSON.stringify(ver));
  } catch (e) {
    errors.push('probe error: ' + e.message);
  } finally {
    pty.killAll();
  }
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
  await wait(() => !pids.some(alive), 5000);
  for (const pid of pids) if (alive(pid)) errors.push('child still alive after killAll: ' + pid);
  return { ok: !errors.length, errors };
};
