// fake-pty.js — the node-pty stand-in for tests: same interface as IPty, echoes what is written. Nothing is spawned.
//   const fake = createFakePty();   fake.spawn(exe, args, opts) → proc     fake.calls = [{ exe, args, opts }]     fake.procs = [proc]
'use strict';
function createFakePty() {
  const calls = [], procs = [];
  let pid = 4000;
  function spawn(exe, args, opts) {
    calls.push({ exe, args, opts });
    const dataCbs = [], exitCbs = [];
    const proc = {
      pid: ++pid, killed: false, cols: opts.cols, rows: opts.rows,
      onData: cb => dataCbs.push(cb),
      onExit: cb => exitCbs.push(cb),
      write: d => { dataCbs.forEach(cb => cb(d)); },
      resize: (c, r) => { proc.cols = c; proc.rows = r; },
      kill: () => { if (proc.killed) return; proc.killed = true; exitCbs.forEach(cb => cb({ exitCode: 0 })); },
      emit: d => dataCbs.forEach(cb => cb(d)),
    };
    procs.push(proc);
    return proc;
  }
  return { spawn, calls, procs };
}
module.exports = { createFakePty };
