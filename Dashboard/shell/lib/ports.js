// ports.js — server ports probed on 127.0.0.1, starting and opening registry servers.
// createPorts({ R, run, onChange }): onChange(ports) is called when the probe result changes.
'use strict';
const net = require('net');
const path = require('path');

function up(port) {
  return new Promise(res => {
    const k = net.connect({ host: '127.0.0.1', port }); let done = false;
    const end = v => { if (!done) { done = true; k.destroy(); res(v); } };
    k.setTimeout(300, () => end(false)); k.on('connect', () => end(true)); k.on('error', () => end(false));
  });
}

function createPorts({ R, run, onChange = () => {} }) {
  const P = { up, ports: {} };
  P.startServer = (s, extra = []) => {
    const cwd = s.cwd ? R.expand(s.cwd) : R.C.paths.REPO;
    if (s.bat) { const f = R.expand(s.bat); if (!R.exists(f)) return R.T(R.ui('missing'), { path: f });
      run.runBat(String(s.port), path.dirname(f), [`call "${f}"`], 'min'); return ''; }
    const js = R.expand(s.js), node = R.expand('{node}');
    if (!R.exists(js)) return R.T(R.ui('missing'), { path: js });
    if (!R.exists(node)) return R.T(R.ui('missing'), { path: node });
    run.runBat(String(s.port), cwd, [`"${node}" "${js}" ${R.argList([...(s.args || []), ...extra]).join(' ')}`.replace(/%/g, '%%')], 'min');
    return '';
  };
  P.pollPorts = async () => {
    const list = R.C.menu.servers || [];
    const res = await Promise.all(list.map(s => up(s.port)));
    const next = Object.fromEntries(list.map((s, i) => [s.port, res[i]]));
    if (JSON.stringify(next) !== JSON.stringify(P.ports)) { P.ports = next; onChange(P.ports); }
    return P.ports;
  };
  P.openServer = async s => {
    const { say, T, ui } = R;
    if (await up(s.port)) { run.openUrl(R.serverUrl(s)); return say(true, T(ui('opened'), { name: s.name }), 'opened'); }
    const err = P.startServer(s); if (err) return say(false, err, 'not found');
    if (s.self || run.dry) return say(true, T(ui('started'), { name: s.name }), 'started');
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await up(s.port)) { P.pollPorts(); run.openUrl(R.serverUrl(s)); return say(true, T(ui('opened'), { name: s.name }), 'started and opened'); }
    }
    return say(false, T(ui('noAnswer'), { port: s.port }), 'no answer in 10 s');
  };
  return P;
}

module.exports = { createPorts, up };
