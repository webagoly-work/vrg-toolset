// pty-host.js — the child host for the child-host mode (not used while PTY.md says in-process). JSON lines over stdio:
//   in : {"op":"open","id":"t1","exe":"…","args":[…],"cwd":"…","env":{…},"cols":100,"rows":30} {"op":"write","id":"t1","data":"…"}
//        {"op":"resize","id":"t1","cols":80,"rows":24} {"op":"kill","id":"t1"}
//   out: {"ev":"data","id":"t1","data":"…"} {"ev":"exit","id":"t1","code":0} {"ev":"error","id":"t1"}
// serve(spawn, input, output) works with node-pty's spawn or with test/fixtures/fake-pty.js; run directly it uses node-pty.
'use strict';
const readline = require('readline');

function serve(spawn, input, output) {
  const procs = new Map();
  const send = o => { try { output.write(JSON.stringify(o) + '\n'); } catch (e) {} };
  const rl = readline.createInterface({ input });
  rl.on('line', line => {
    let m; try { m = JSON.parse(line); } catch (e) { return; }
    if (!m || typeof m.id !== 'string') return;
    if (m.op === 'open') {
      if (procs.has(m.id) || typeof m.exe !== 'string' || !Array.isArray(m.args)) return send({ ev: 'error', id: m.id });
      try {
        const p = spawn(m.exe, m.args, { cwd: m.cwd, env: m.env, cols: m.cols || 100, rows: m.rows || 30 });
        procs.set(m.id, p);
        p.onData(d => send({ ev: 'data', id: m.id, data: d }));
        p.onExit(e => { procs.delete(m.id); send({ ev: 'exit', id: m.id, code: e && e.exitCode | 0 }); });
      } catch (e) { send({ ev: 'error', id: m.id }); }
      return;
    }
    const p = procs.get(m.id);
    if (!p) return;
    if (m.op === 'write' && typeof m.data === 'string') p.write(m.data);
    else if (m.op === 'resize') { try { p.resize(m.cols, m.rows); } catch (e) {} }
    else if (m.op === 'kill') { try { p.kill(); } catch (e) {} }
  });
  rl.on('close', () => { for (const p of procs.values()) { try { p.kill(); } catch (e) {} } });
  return { procs };
}

module.exports = { serve };

if (require.main === module) {
  const { loadNodePty, nodePtySpawn } = require('./lib/pty.js');
  serve(nodePtySpawn(loadNodePty()), process.stdin, process.stdout);
}
