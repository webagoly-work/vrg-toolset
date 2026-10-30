<#
  backup-e2e.ps1 - drives the real BACKUP menu (vrg-ui.ps1 -Menu backup -Keys) against throwaway folders:
  a copy of the registry whose "backup" paths all point into %TEMP%\VRG. Nothing real is touched.

    powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\backup-e2e.ps1 [-Keep]
#>
param([switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
$ui = Join-Path $here 'vrg-ui.ps1'
$GitExe = Join-Path (Split-Path (Split-Path $here -Parent) -Parent) 'tools\git\cmd\git.exe'
if (-not (Test-Path $GitExe)) { $GitExe = 'git' }

$fails = 0; $n = 0
function Check($name, $ok) { $script:n++; if ($ok) { "  ok   $name" } else { $script:fails++; "  FAIL $name" } }
function G($dir) { $ErrorActionPreference = 'Continue'; & $GitExe -C $dir @args 2>$null }
function Put($rel, $text) {
  $f = Join-Path $root $rel; New-Item -ItemType Directory -Force -Path (Split-Path $f) | Out-Null
  [IO.File]::WriteAllText($f, $text, (New-Object Text.UTF8Encoding $false))
}
function Txt($rel) { $f = Join-Path $root $rel; if (Test-Path -LiteralPath $f) { [IO.File]::ReadAllText($f) } else { $null } }
function Run($keys) {
  $ErrorActionPreference = 'Continue'
  & powershell -NoProfile -ExecutionPolicy Bypass -File $ui -Menu backup -Registry $script:reg -Keys $keys *> (Join-Path $root 'last.log')
  $LASTEXITCODE
}

$root = Join-Path $env:TEMP ('VRG\bke2e-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $root | Out-Null
try {
  Put 'full\A\one.txt' "1`n"; Put 'full\B\b.txt' "b`n"; Put 'full\tools\node\x' 'x'; Put 'backup\installers\node-v1-win-x64.zip' 'z'
  $repo = Join-Path $root 'full\repo'
  G $root init -q -b main $repo | Out-Null; G $repo config user.name t | Out-Null; G $repo config user.email t@localhost | Out-Null
  Put 'full\repo\r.txt' "r`n"; G $repo add -A | Out-Null; G $repo commit -q -m r1 | Out-Null

  $r = Get-Content -LiteralPath (Join-Path $here 'vrg-menu.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $b = $r.backup
  $b.from = "$root\full"; $b.dest = "$root\backup\code\work"; $b.archive = "$root\backup\archive"; $b.logs = "$root\backup\logs"
  $b.installers = "$root\backup\installers"; $b.folders = @('A', 'B')
  $b.repos = @([pscustomobject]@{ name = 'repo'; path = $repo; bare = "$root\backup\code\repo.git" })
  $script:reg = Join-Path $root 'menu.json'
  [IO.File]::WriteAllText($reg, ($r | ConvertTo-Json -Depth 40), (New-Object Text.UTF8Encoding $false))

  'menu'
  $code = Run '1x2x3x5xQ'
  Check '1 sync, 2 integrity, 3 report, 5 installers, Q -> exit 0' ($code -eq 0)
  Check 'sync copied the folders' ((Txt 'backup\code\work\A\one.txt') -eq "1`n" -and (Txt 'backup\code\work\B\b.txt') -eq "b`n")
  Check 'bare repo has main' ([string](G "$root\backup\code\repo.git" rev-parse main) -eq [string](G $repo rev-parse main))
  Check 'log + manifest written' (@(Get-ChildItem "$root\backup\logs" -Filter 'sync-*.json').Count -eq 1 -and (Test-Path "$root\backup\logs\manifest.tsv"))
  $log = [IO.File]::ReadAllText((Join-Path $root 'last.log'))
  Check 'integrity screen said all files match' ($log.Contains('mind egyezik'))
  Check 'installer screen listed node as present' ($log -match 'tools\\node\s.*megvan')

  'restore'
  Put 'full\A\one.txt' "elrontva`n"
  $code = Run '4A\one.txt{enter}1I4{enter}4nope\x.txt{enter}4A\one.txt{enter}1NxQ'
  Check '4, path, version 1, I; empty and wrong paths; N cancels -> exit 0' ($code -eq 0)
  Check 'one.txt back from the backup' ((Txt 'full\A\one.txt') -eq "1`n")
  $saved = @(Get-ChildItem "$root\backup\archive\restore" -Recurse -Filter one.txt)
  Check 'the spoiled copy was saved first, once (N restored nothing)' ($saved.Count -eq 1 -and [IO.File]::ReadAllText($saved[0].FullName) -eq "elrontva`n")
  Check 'wrong path got the not-synced message' ([IO.File]::ReadAllText((Join-Path $root 'last.log')).Contains('Nem szinkroniz'))   # ASCII part: this file has no BOM
}
finally {
  if ($Keep) { "kept: $root" } else { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
}
''
if ($fails) { "$fails / $n FAILED"; exit 1 } else { "Rendben: $n / $n" }
