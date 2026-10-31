// homeland.js — the Gépország feed on the segéd's side (CITY-D34…D49, docs/city/homeland/04-data-feed.md). vrg-probe's raw
// 'hm' lines come in with cumulative numbers; one 'hm' event per second goes out on the stream with rates, a class and a
// layer for each process. The layer is the kernel's own session number, not a judgement (02-layers-signals.md §2.1).
// Sources are adapters behind one shape (hm.v1): today the probe, nvidia-smi and the one-shot inventory; ETW and sensors
// later. Memory only, nothing written (CITY-D27 A): no command line, no window title and no path ever passes through here.
'use strict';
const fs = require('fs'), path = require('path');

const KERNEL = new Set(['idle', 'system', 'registry', 'memory compression', 'secure system', 'smss.exe', 'csrss.exe', 'wininit.exe']);
const PROTECTED = new Set(['explorer.exe', 'claude.exe', 'dwm.exe', 'winlogon.exe', 'csrss.exe']);   // never closed from the city (CITY-D47 B)

function loadClasses(file) {
  const rules = JSON.parse(fs.readFileSync(file, 'utf8')).rules;
  return rules.map(r => ({ cls: r.cls, place: r.place, names: new Set(r.exe.map(e => e.toLowerCase())) }));
}
function classify(rules, key) {
  for (const r of rules) if (r.names.has(key)) return r;
  return { cls: 'other', place: 'kulvaros' };
}
const layerOf = (key, session, win) => (KERNEL.has(key) ? -3 : win ? 0 : session === 0 ? -2 : -1);

// raw line + last state -> the public event. wins: Map of the probe's windows, fg: the foreground handle
function normalise(m, st, ctx) {
  const dt = st.at ? Math.max(0.2, (m.at - st.at) / 1000) : 1, nLog = Math.max(1, (m.c || []).length);
  const byPid = new Map();
  for (const w of ctx.wins.values()) {
    const e = byPid.get(w.pid) || { n: 0, fg: false };
    e.n++; if (w.h === ctx.fg) e.fg = true;
    byPid.set(w.pid, e);
  }
  const prev = st.procs || new Map(), next = new Map(), procs = [];
  for (const r of m.p || []) {
    const [pid, ppid, session, name, th, cpu, ws, priv, rd, wr, hard, , hint] = r;
    const p = prev.get(pid), key = String(name).toLowerCase();
    const cl = classify(ctx.rules, key), win = byPid.get(pid);
    next.set(pid, [cpu, rd, wr, hard]);
    if (pid === 0) continue;   // the Idle "process" is what is left over, not a tenant
    procs.push({ pid, ppid, exe: String(name).slice(0, 60), key, s: session, th, ws, priv, cls: cl.cls, place: cl.place, layer: layerOf(key, session, win),
      cpu: p ? Math.max(0, (cpu - p[0]) / 1e7 / dt / nLog * 100) : 0, r: p ? Math.max(0, (rd - p[1]) / dt) : 0, w: p ? Math.max(0, (wr - p[2]) / dt) : 0,
      hard: p ? Math.max(0, (hard - p[3]) / dt) : 0, win: win ? win.n : 0, fg: !!(win && win.fg), hint: hint || '', obs: pid === ctx.selfPid || pid === ctx.probePid, ours: PROTECTED.has(key) });
  }
  const prevC = st.cores, cores = (m.c || []).map((c, i) => {
    const q = prevC && prevC[i]; if (!q) return { u: 0, k: 0 };
    const idle = c[0] - q[0], kern = c[1] - q[1] - idle, user = c[2] - q[2], all = Math.max(1, idle + kern + user);
    return { u: 100 * user / all, k: 100 * kern / all };
  });
  st.at = m.at; st.procs = next; st.cores = m.c;
  const s = m.s || {}, mem = m.m || {};
  const disks = (m.d || []).map(d => { const [id, ...letters] = String(d.name).split(' '); return { id: +id, letters, r: d.r, w: d.w, q: d.q, busy: Math.max(0, 100 - d.idle) }; });
  return { at: m.at, ms: m.ms, fixture: false, procs, cores, disks, nics: m.n || [], gpu: Object.assign({}, m.g, ctx.gpu || {}),
    sys: { ctx: s.ctx, sys: s.sys, irq: s.irq, dpc: s.dpc, irqp: s.irqp, mhz: s.mhz, perf: s.perf },
    mem: { total: mem.total, avail: mem.avail, commit: mem.commit, limit: mem.limit, paged: mem.paged, nonpaged: mem.nonpaged, modified: s.modified, standby: (s.sbCore || 0) + (s.sbNorm || 0) + (s.sbRes || 0), free: s.free, faults: s.faults, hard: s.hard, page: s.page } };
}

// nvidia-smi --query-gpu=temperature.gpu,fan.speed,clocks.gr,memory.used,memory.total --format=csv,noheader,nounits
function parseSmi(text) {
  const [temp, fan, mhz, used, total] = String(text).trim().split('\n')[0].split(',').map(v => parseFloat(v));
  return Number.isFinite(temp) ? { temp, fan: Number.isFinite(fan) ? fan : null, mhz, used: used * 1048576, total: total * 1048576 } : null;
}

function create({ emit, send, run, root, selfPid, dry }) {
  const rules = loadClasses(path.join(root, 'homeland-classes.json'));
  const hm = { want: false, st: {}, hw: null, hwBusy: false, gpu: null, smi: null, last: null };
  async function smi() {
    const out = await run('nvidia-smi', ['--query-gpu=temperature.gpu,fan.speed,clocks.gr,memory.used,memory.total', '--format=csv,noheader,nounits'], 4000);
    hm.gpu = parseSmi(out);
  }
  async function inventory() {
    if (hm.hw || hm.hwBusy) return;
    hm.hwBusy = true;
    try {
      const out = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'probe-hw.ps1')], 30000);
      hm.hw = JSON.parse(out);
      emit('hmhw', hm.hw);
    } catch (e) { /* the view works without it */ }
    hm.hwBusy = false;
  }
  return {
    get want() { return hm.want; },
    get hw() { return hm.hw; },
    // the probe (re)started while the view is open, or the page asked
    on() {
      hm.want = true; hm.st = {};
      send({ t: 'hm', on: true });
      if (dry) return;
      inventory(); smi();
      if (!hm.smi) { hm.smi = setInterval(smi, 5000); hm.smi.unref(); }
    },
    off() { hm.want = false; send({ t: 'hm', on: false }); clearInterval(hm.smi); hm.smi = null; },
    gone() { hm.want = false; clearInterval(hm.smi); hm.smi = null; },   // the probe stopped with the last page
    line(m, ctx) {
      if (!hm.want) return;
      hm.last = normalise(m, hm.st, Object.assign({ rules, selfPid, gpu: hm.gpu }, ctx));
      emit('hm', hm.last);
    },
    closable: key => !PROTECTED.has(String(key).toLowerCase()),
  };
}

module.exports = { create, normalise, parseSmi, classify, loadClasses, layerOf, PROTECTED };
