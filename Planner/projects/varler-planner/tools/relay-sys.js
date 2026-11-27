// ==========================================================================
// relay-sys.js — the PC's vital signs for VRG Mobile's Vezérlőpult (Fényjel R2, shared/fenyjel/DESIGN.md §7.2).
//
// What phone-relay-server.js needs to answer `sys.stats`: CPU load, memory and the work drive's space, from Node's
// own os / fs (no child process, nothing to install, the same on Windows and Linux). The arithmetic is plain
// functions, so Mobile/tests/relay-sys.js checks it on fixtures without a relay.
//
//   sys.stats -> {type:'sys', payload:{ok, host, cpu, mem:{used,total}, disk:{used,total,root}|null, uptime, cores}}
//                cpu is 0…1 since the previous ask (the first ask takes a 250 ms sample); sizes are bytes;
//                uptime is the PC's, in seconds. Trusted phones only, like every other relay question.
// ==========================================================================
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');

const FIRST_SAMPLE_MS = 250;

/** The busy and total ticks of every core together, from os.cpus(). */
function ticks(cpus) {
  let busy = 0, total = 0;
  for (const c of cpus || []) {
    const t = c && c.times;
    if (!t) continue;
    const all = (t.user || 0) + (t.nice || 0) + (t.sys || 0) + (t.irq || 0) + (t.idle || 0);
    total += all;
    busy += all - (t.idle || 0);
  }
  return { busy, total };
}

/** CPU load between two tick snapshots, 0…1; 0 when nothing moved (or the counters went backwards after a reset). */
function cpuLoad(a, b) {
  const dt = b.total - a.total, db = b.busy - a.busy;
  if (!(dt > 0) || db < 0) return 0;
  return Math.max(0, Math.min(1, db / dt));
}

/** The drive (Windows) or mount root the work folder sits on: what "disk" means to the user. */
function workRoot(dir) {
  const abs = path.resolve(dir || __dirname);
  return path.parse(abs).root || '/';
}

/** {used,total} from an fs.statfs result, or null when the numbers are missing or nonsense. */
function diskOf(st) {
  if (!st || !(st.bsize > 0) || !(st.blocks > 0)) return null;
  const total = st.blocks * st.bsize;
  const free = Math.max(0, Math.min(st.blocks, st.bavail != null ? st.bavail : st.bfree || 0)) * st.bsize;
  return { used: total - free, total };
}

/** Round to a sensible precision for the wire: loads to 0.001, sizes stay whole bytes. */
const r3 = v => Math.round(v * 1000) / 1000;

/**
 * A sampler that remembers the last CPU snapshot, so each ask reports the load since the previous one.
 * deps (for tests): { cpus, totalmem, freemem, hostname, uptime, statfs, now, wait, dir }
 */
function createSampler(deps) {
  const d = Object.assign({
    cpus: () => os.cpus(), totalmem: () => os.totalmem(), freemem: () => os.freemem(),
    hostname: () => os.hostname(), uptime: () => os.uptime(),
    statfs: p => (typeof fs.statfsSync === 'function' ? fs.statfsSync(p) : null),
    wait: ms => new Promise(res => setTimeout(res, ms)),
    dir: path.join(__dirname, '..', '..', '..'),
  }, deps || {});
  let last = null;
  return {
    async sample() {
      if (!last) { last = ticks(d.cpus()); await d.wait(FIRST_SAMPLE_MS); }
      const now = ticks(d.cpus());
      const cpu = cpuLoad(last, now);
      last = now;
      const total = d.totalmem(), free = d.freemem();
      const root = workRoot(d.dir);
      let disk = null;
      try { disk = diskOf(d.statfs(root)); } catch (e) { disk = null; }
      return {
        ok: true,
        host: String(d.hostname() || '').slice(0, 64),
        cpu: r3(cpu),
        cores: (d.cpus() || []).length,
        mem: { used: Math.max(0, total - free), total },
        disk: disk ? { used: disk.used, total: disk.total, root } : null,
        uptime: Math.round(d.uptime() || 0),
      };
    },
  };
}

module.exports = { ticks, cpuLoad, workRoot, diskOf, createSampler, FIRST_SAMPLE_MS };
