#!/usr/bin/env node
// build-probe.js — builds CodeCity/probe (vrg-probe.exe, P10 KV-21) with the portable .NET SDK in Planner/apps/dotnet.
//
//   node CodeCity/tools/build-probe.js     -> CodeCity/probe/bin/publish/vrg-probe.exe
//
// Offline (probe/NuGet.config has no source); the SDK's home, NuGet cache and telemetry stay out of the user profile
// (.cache/dotnet-home, .cache/nuget, both gitignored).
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..'), DOTNET = path.join(REPO, 'Planner', 'apps', 'dotnet', 'dotnet.exe');
const PROJ = path.join(REPO, 'CodeCity', 'probe', 'vrg-probe.csproj'), OUT = path.join(REPO, 'CodeCity', 'probe', 'bin', 'publish');
if (!fs.existsSync(DOTNET)) { console.error('Nincs .NET SDK: ' + DOTNET + ' (docs/city/README.md §5, CITY-D18)'); process.exit(1); }
const env = Object.assign({}, process.env, {
  DOTNET_ROOT: path.dirname(DOTNET), DOTNET_CLI_HOME: path.join(REPO, '.cache', 'dotnet-home'), NUGET_PACKAGES: path.join(REPO, '.cache', 'nuget'),
  DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1', DOTNET_ADD_GLOBAL_TOOLS_TO_PATH: '0',
  DOTNET_GENERATE_ASPNET_CERTIFICATE: 'false', DOTNET_MULTILEVEL_LOOKUP: '0', MSBUILDDISABLENODEREUSE: '1'
});
const r = spawnSync(DOTNET, ['publish', PROJ, '-c', 'Release', '-o', OUT, '--nologo', '-v', 'q'], { env, stdio: 'inherit', windowsHide: true });
if (r.status !== 0) process.exit(r.status || 1);
console.log('ok  ' + path.relative(REPO, path.join(OUT, 'vrg-probe.exe')));
