// selftest.js — `--selftest`: load the page, plan every act without running it, write the result, quit.
// Flags: --shot <out.png>, --probe <wp> (shell/selftest/<wp>.js, its { ok, errors } is merged in), --run <id>, --scroll <css>.
// createSelftest(ctx) with ctx = { app, getWin, build, R, acts, run, ports, argv, tmp, stopPolling }.
'use strict';
const path = require('path'), fs = require('fs');

function createSelftest(ctx) {
  const { app, build, R, acts, run, ports, argv, tmp } = ctx;
  const arg = name => { const i = argv.indexOf(name); return i > 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const SHOT = !argv.includes('--no-shot') ? (arg('--shot') || arg('--selftest')) : '';
  const PROBE = arg('--probe');
  const upList = () => Object.entries(ports.ports).filter(([, v]) => v).map(([k]) => +k);

  return async function selftest() {
    const win = ctx.getWin();
    const out = { ok: true, errors: [] };
    try {
      await new Promise(r => win.webContents.once('did-finish-load', r));
      await new Promise(r => setTimeout(r, 1200));
      win.webContents.send('vrg:ports', ports.ports);
      await new Promise(r => setTimeout(r, 300));
      out.page = await win.webContents.executeJavaScript(`({ shell: !!window.vrg, tiles: document.querySelectorAll('.tile').length,
        acts: document.querySelectorAll('[data-act]').length, up: document.querySelectorAll('.chip.srv.up').length,
        wbar: !!document.querySelector('.wbar'), title: document.title })`);
      out.claudeFix = R.claudeFix;
      out.portsUp = upList();
      // every id the page carries must resolve; every one is planned dry
      const ids = await win.webContents.executeJavaScript(`[...new Set([...document.querySelectorAll('[data-act]')].map(e => e.dataset.act))]`);
      out.ids = ids.length; out.plans = {};
      for (const id of ids) {
        run.dry = []; const r = await acts.runAct(id);
        // job paths can carry client names: the log keeps only that a path was resolved
        out.plans[id] = { r: r.ok ? 'ok' : 'NO: ' + r.hu, ops: /^job/.test(id) ? run.dry.map(o => Object.keys(o).join('+') + ' (job path)') : run.dry }; run.dry = null;
        if (!r.ok && !/START-ban|nincs telepítve|Nem található|Először/.test(r.hu)) out.errors.push(id + ': ' + r.hu);
      }
      for (const bad of ['../../Windows/System32/calc.exe', 'f:p1:99', 's:Q', 's:S', 'srv:nope', 'line:../x']) {
        run.dry = []; const r = await acts.runAct(bad); run.dry = null;
        if (r.ok) out.errors.push('accepted ' + bad);
      }
      // --probe <wp>: the WP's own probe in shell/selftest/<wp>.js, if it exists
      if (PROBE) {
        const pf = /^[\w-]+$/.test(PROBE) ? path.join(__dirname, '..', 'selftest', PROBE + '.js') : '';
        if (pf && R.exists(pf)) {
          const r = await require(pf)({ win, app, build, C: R.C, runAct: acts.runAct, lookup: acts.lookup, ports: ports.ports, tmp }) || {};
          out.probe = { name: PROBE, ...r };
          if (r.ok === false) out.ok = false;
          for (const e of r.errors || []) out.errors.push(PROBE + ': ' + e);
        }
      }
      // --run <id>: run one act for real (a live check on this PC), then wait for its port if it is a server
      const ri = argv.indexOf('--run');
      if (ri > 0) { const id = argv[ri + 1]; out.run = { id, r: await acts.runAct(id) }; await ports.pollPorts(); out.run.portsUp = upList(); }
      const si = argv.indexOf('--scroll');                             // --scroll <css selector>: capture from there
      if (si > 0) { await win.webContents.executeJavaScript(`document.querySelectorAll('details.stats').forEach(d => { if (!d.matches(${JSON.stringify(argv[si + 1])})) d.open = false; }); (document.querySelector(${JSON.stringify(argv[si + 1])}) || document.body).scrollIntoView(); 1`); await new Promise(r => setTimeout(r, 300)); }
      // a hidden window keeps its first frame; shown off-screen it repaints what the --scroll step changed
      if (SHOT && si > 0) { win.setPosition(-4000, 0); win.showInactive(); await new Promise(r => setTimeout(r, 600)); }
      if (SHOT) { win.setSize(1500, 950); const img = await win.webContents.capturePage(); fs.writeFileSync(SHOT, img.toPNG()); out.shot = SHOT; }
    } catch (e) { out.errors.push(e.stack); }
    out.ok = !out.errors.length;
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'dash-selftest.json'), JSON.stringify(out, null, 1));
    console.log(JSON.stringify({ ok: out.ok, page: out.page, ids: out.ids, portsUp: out.portsUp, errors: out.errors }));
    ctx.stopPolling(); app.exit(out.ok ? 0 : 1);
  };
}

module.exports = { createSelftest };
