#!/usr/bin/env node
// VRG Stack — kept so the morning pass and older notes still work.
// Same as:  node stack.js build [--quiet] [--no-archive] [--no-embed] [--rerecord]
'use strict';
const argv = process.argv.slice(2);
require('./lib/pipeline').run({
  quiet: argv.includes('--quiet'), noArchive: argv.includes('--no-archive'),
  noEmbed: argv.includes('--no-embed'), rerecord: argv.includes('--rerecord'),
}).then(r => { if (r.worst === 'fail') process.exitCode = 2; })
  .catch(e => { console.error('build failed, the previous out/ is unchanged: ' + (e && e.stack || e)); process.exitCode = 1; });
