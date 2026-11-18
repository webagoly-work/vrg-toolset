#!/usr/bin/env node
// VRG Időjárás — the command line. `node Weather/vrg-weather.js help` lists every command.
//
// Everything the tool does is a command: fetch, fuse, verify, alerts, brief, export … and pipelines are named
// lists of commands (config/pipelines.json) that `run` executes and `daemon` schedules. The page
// (serve.js) calls the same dispatcher. Data: Weather/data/weather.sqlite (outside Git).
//
//   --json            machine output
//   --replay <dir>    read recorded answers from <dir> instead of the network (tests, offline demo)
// Console text is ASCII under the Windows codepage; VRG_UTF8=1 keeps the accents.
'use strict';

const { dispatch, context } = require('./lib/commands');
const { ascii, parseArgs } = require('./lib/common');

(async () => {
  const argv = process.argv.slice(2);
  const a = parseArgs(argv);
  const cmd = a._[0] || 'help';
  if (cmd === 'daemon') {
    const ctx = context({ replay: a.replay || null });
    const { daemon, runPipeline } = require('./lib/pipeline');
    if (a.once) {   // run what is due now, then stop (for a Windows scheduled task every 15 min)
      const due = require('./lib/pipeline').due(ctx.cfg.pipelines.schedule, new Date(), ctx.settings.timezone);
      for (const n of due) { const r = await runPipeline(ctx, n, dispatch, l => console.log(ascii(l))); console.log(ascii(`${n}: ${r.status}`)); }
      if (!due.length) console.log('Most nincs esedekes folyamat.');
      return;
    }
    console.log('VRG Idojaras utemezo fut (Ctrl+C a leallitashoz).');
    daemon(ctx, dispatch, l => console.log(ascii(l)));
    return;
  }
  const ctx = context({ replay: a.replay || null });
  try {
    const r = await dispatch(ctx, argv);
    if (a.json) console.log(JSON.stringify(r.data ?? r, null, 1));
    else if (r.text) console.log(ascii(r.text));
    if (r.ok === false) process.exitCode = 1;
  } catch (e) {
    console.error(ascii('vrg-weather: ' + (e && e.message || e)));
    process.exitCode = 2;
  } finally { ctx.db.close(); }
})();
