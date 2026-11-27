#!/usr/bin/env node
// Mobile/tests/relay-sys.js — Vezérlőpult (Fényjel R2): the PC's vital signs for sys.stats (relay-sys.js).
// The arithmetic on fixtures (CPU ticks, the load between two snapshots, statfs to used/total, the work root), the
// sampler with injected readings (first ask samples, later asks report since the previous one), and one real sample
// of this machine so the shape the phone parses is checked against what Node really returns.
//
//   node Mobile/tests/relay-sys.js
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const S = require(path.join(REPO, 'Planner/projects/varler-planner/tools/relay-sys.js'));

let fails = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const cpu = (user, sys, idle) => ({ times: { user, nice: 0, sys, irq: 0, idle } });

(async () => {
  // ---- ticks and load
  const t = S.ticks([cpu(100, 50, 850), cpu(200, 0, 800)]);
  ok(t.busy === 350 && t.total === 2000, 'ticks sums busy and total over every core');
  ok(S.ticks(null).total === 0 && S.ticks([{}]).total === 0, 'ticks tolerates no cores and a core without times');
  ok(Math.abs(S.cpuLoad({ busy: 100, total: 1000 }, { busy: 400, total: 2000 }) - 0.3) < 1e-9, 'cpuLoad: 300 busy of 1000 new ticks = 0.3');
  ok(S.cpuLoad({ busy: 5, total: 10 }, { busy: 5, total: 10 }) === 0, 'cpuLoad: nothing moved = 0');
  ok(S.cpuLoad({ busy: 900, total: 1000 }, { busy: 100, total: 2000 }) === 0, 'cpuLoad: counters reset backwards = 0, never negative');
  ok(S.cpuLoad({ busy: 0, total: 0 }, { busy: 50, total: 40 }) === 1, 'cpuLoad is clamped to 1');

  // ---- disk
  const d = S.diskOf({ bsize: 4096, blocks: 1000, bavail: 250, bfree: 300 });
  ok(d && d.total === 4096000 && d.used === 3072000, 'diskOf: used = total − available (bavail, what the user can write)');
  ok(S.diskOf({ bsize: 4096, blocks: 1000, bfree: 400 }).used === 2457600, 'diskOf falls back to bfree');
  ok(S.diskOf(null) === null && S.diskOf({ bsize: 0, blocks: 10 }) === null, 'diskOf: missing or nonsense numbers = null');
  ok(S.workRoot('/home/user/x') === '/', 'workRoot: a Linux path is on /');

  // ---- the sampler, with injected readings
  let calls = 0, waited = 0;
  const snaps = [[cpu(100, 0, 900)], [cpu(150, 50, 1000)], [cpu(150, 50, 1000)], [cpu(400, 50, 1150)], [cpu(400, 50, 1150)]];
  const s = S.createSampler({
    cpus: () => snaps[Math.min(calls++, snaps.length - 1)], totalmem: () => 16e9, freemem: () => 4e9,
    hostname: () => 'VRG-PC', uptime: () => 3600.4, statfs: () => ({ bsize: 1024, blocks: 100, bavail: 10 }),
    wait: ms => { waited += ms; return Promise.resolve(); }, dir: '/work/repo',
  });
  const a = await s.sample();
  ok(waited === S.FIRST_SAMPLE_MS, 'the first ask takes a short sample');
  ok(a.ok === true && a.host === 'VRG-PC' && a.cpu === 0.5, 'first ask: load over the sample (100 busy of 200 ticks = 0.5)');
  ok(a.mem.used === 12e9 && a.mem.total === 16e9, 'memory used = total − free');
  ok(a.disk && a.disk.used === 92160 && a.disk.total === 102400 && a.disk.root === '/', 'disk of the work root');
  ok(a.uptime === 3600 && a.cores === 1, 'uptime in whole seconds, the core count');
  const b = await s.sample();
  ok(waited === S.FIRST_SAMPLE_MS, 'a later ask does not wait again');
  ok(b.cpu === 0.625, 'a later ask reports the load since the previous ask (250 busy of 400 = 0.625)');
  const broken = S.createSampler({ statfs: () => { throw new Error('no statfs'); }, wait: () => Promise.resolve() });
  ok((await broken.sample()).disk === null, 'a statfs error leaves disk null, the rest still answers');

  // ---- one real sample of this machine: the shape the phone parses (kit-core Sys.kt)
  const real = await S.createSampler().sample();
  ok(real.ok === true && typeof real.host === 'string' && real.cpu >= 0 && real.cpu <= 1, 'a real sample: ok, host, cpu in 0…1');
  ok(real.mem.total > 0 && real.mem.used >= 0 && real.mem.used <= real.mem.total, 'a real sample: memory');
  ok(real.disk === null || (real.disk.total > 0 && real.disk.used <= real.disk.total), 'a real sample: disk or null');
  ok(Number.isInteger(real.uptime) && real.cores >= 1, 'a real sample: uptime and cores');

  console.log(fails ? `\n${fails} of ${count} FAILED` : `\nall ok (${count})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
