#!/usr/bin/env node
// build-etw.js — builds CodeCity/etw (vrg-etw.exe, P11 KV-23) with the portable .NET SDK in Planner/apps/dotnet.
//
//   node CodeCity/tools/build-etw.js     -> CodeCity/etw/bin/publish/ (then the user installs it: docs/city/wp/p11-etw.md)
//
// TraceEvent comes from nuget.org; once packages.lock.json exists the restore runs in locked mode, so a package whose
// content hash differs is refused. This repo's root is baked into the exe (its only file filter).
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..'), DOTNET = path.join(REPO, 'Planner', 'apps', 'dotnet', 'dotnet.exe');
const DIR = path.join(REPO, 'CodeCity', 'etw'), PROJ = path.join(DIR, 'vrg-etw.csproj'), OUT = path.join(DIR, 'bin', 'publish');
if (!fs.existsSync(DOTNET)) { console.error('Nincs .NET SDK: ' + DOTNET + ' (docs/city/README.md §5, CITY-D18)'); process.exit(1); }
const env = Object.assign({}, process.env, {
  DOTNET_ROOT: path.dirname(DOTNET), DOTNET_CLI_HOME: path.join(REPO, '.cache', 'dotnet-home'), NUGET_PACKAGES: path.join(REPO, '.cache', 'nuget'),
  DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1', DOTNET_ADD_GLOBAL_TOOLS_TO_PATH: '0',
  DOTNET_GENERATE_ASPNET_CERTIFICATE: 'false', DOTNET_MULTILEVEL_LOOKUP: '0', MSBUILDDISABLENODEREUSE: '1'
});
const locked = fs.existsSync(path.join(DIR, 'packages.lock.json'));
const r = spawnSync(DOTNET, ['publish', PROJ, '-c', 'Release', '-o', OUT, '--nologo', '-v', 'q', '-p:VrgRepoRoot=' + REPO].concat(locked ? ['-p:RestoreLockedMode=true'] : []),
  { env, stdio: 'inherit', windowsHide: true });
if (r.status !== 0) process.exit(r.status || 1);
console.log('ok  ' + path.relative(REPO, path.join(OUT, 'vrg-etw.exe')) + (locked ? ' (locked restore)' : ' (packages.lock.json written — commit it)'));
