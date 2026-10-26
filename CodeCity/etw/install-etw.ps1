# install-etw.ps1 — copies vrg-etw (P11, KV-23) into C:\Program Files\VRG\Kodvaros-ETW, with its own copy of the
# .NET runtime in .\dotnet, so the elevated task never runs anything from a user-writable folder (H:\ is one).
# You run it yourself, in an elevated PowerShell. It only copies files and prints their hashes: it does not create,
# start or change any scheduled task — that is your step (docs/city/wp/p11-etw.md).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File H:\cwebuser\projects\VRG-DE\Planner_VRG_U100\CodeCity\etw\install-etw.ps1
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$src = Join-Path $PSScriptRoot 'bin\publish'
$dotnet = Join-Path $repo 'Planner\apps\dotnet'
$dst = Join-Path $env:ProgramFiles 'VRG\Kodvaros-ETW'
if (-not (Test-Path (Join-Path $src 'vrg-etw.exe'))) { throw 'Build it first: node CodeCity/tools/build-etw.js' }
if (-not (Test-Path (Join-Path $dotnet 'host\fxr'))) { throw "No .NET in $dotnet (CITY-D18)" }

function Copy-Tree($from, $to, $extra) {
    robocopy $from $to /MIR /NFL /NDL /NJH /NJS /NP @extra | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy $from -> $to failed ($LASTEXITCODE)" }
}
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Tree $src $dst @('/XD', (Join-Path $dst 'dotnet'))
$fxr = Get-ChildItem (Join-Path $dotnet 'host\fxr') -Directory | Sort-Object { [version]$_.Name } | Select-Object -Last 1
$rt = Get-ChildItem (Join-Path $dotnet 'shared\Microsoft.NETCore.App') -Directory | Sort-Object { [version]$_.Name } | Select-Object -Last 1
Copy-Tree $fxr.FullName (Join-Path $dst "dotnet\host\fxr\$($fxr.Name)") @()
Copy-Tree $rt.FullName (Join-Path $dst "dotnet\shared\Microsoft.NETCore.App\$($rt.Name)") @()

Write-Host "Installed: $dst  (.NET $($rt.Name))"
Get-FileHash (Join-Path $dst 'vrg-etw.exe'), (Join-Path $dst 'vrg-etw.dll') -Algorithm SHA256 | ForEach-Object { Write-Host "  $($_.Hash)  $(Split-Path $_.Path -Leaf)" }
Write-Host 'Next: the scheduled task - docs/city/wp/p11-etw.md, step 3 (you create it).'
