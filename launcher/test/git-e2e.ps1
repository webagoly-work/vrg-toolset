<#
  git-e2e.ps1 - drives the real START screen loop (vrg-ui.ps1 -Keys) against throwaway repos: S menu, the
  commit message editor, the exit guard (C / L / B, Esc, Ctrl+C) and blocked files. A copy of the registry
  points "repos" at two clones of a local bare origin in %TEMP%\VRG; nothing real is touched.

    powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\git-e2e.ps1 [-Keep]
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
function Put($dir, $rel, $text) {
  $f = Join-Path $dir $rel; New-Item -ItemType Directory -Force -Path (Split-Path $f) | Out-Null
  [IO.File]::WriteAllText($f, $text, (New-Object Text.UTF8Encoding $false))
}
function Sha($dir, $ref) { [string](G $dir rev-parse --verify -q $ref) }
function Run($keys) {                            # the launcher with these keys; returns its exit code
  $ErrorActionPreference = 'Continue'
  & powershell -NoProfile -ExecutionPolicy Bypass -File $ui -Menu start -Registry $script:reg -Keys $keys *> (Join-Path $root 'last.log')
  $LASTEXITCODE
}

$root = Join-Path $env:TEMP ('VRG\gite2e-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$origin = Join-Path $root 'origin.git'; $a = Join-Path $root 'a'; $c = Join-Path $root 'c'
New-Item -ItemType Directory -Force -Path $root | Out-Null
try {
  G $root init -q --bare -b main $origin | Out-Null
  G $root clone -q $origin $a | Out-Null
  G $a config user.name 'VRG teszt' | Out-Null; G $a config user.email 'teszt@localhost' | Out-Null
  Put $a 'readme.txt' "egy`n"; G $a add -A | Out-Null; G $a commit -q -m init | Out-Null; G $a push -q origin main | Out-Null
  G $root clone -q $origin $c | Out-Null
  $mainSha = Sha $origin 'refs/heads/main'

  $r = Get-Content -LiteralPath (Join-Path $here 'vrg-menu.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $r.repos = @([pscustomobject]@{ name = 'Teszt'; path = $a }, [pscustomobject]@{ name = 'Ures'; path = $c })
  $script:reg = Join-Path $root 'menu.json'
  [IO.File]::WriteAllText($reg, ($r | ConvertTo-Json -Depth 40), (New-Object Text.UTF8Encoding $false))
  $date = Get-Date -Format 'yyyy-MM-dd'
  $fajl = 'f' + [char]0x00E1 + 'jl'

  'S menu'
  Put $a 'readme.txt' "ketto`n"
  $code = Run 'S1 e2e{enter}xQ'
  Check 'S, 1, edited message, Enter, key, Q -> exit 0' ($code -eq 0)
  Check 'commit message = default + edit' ([string](G $a log -1 --format=%s) -eq "launcher: $date, 1 $fajl e2e")
  Check 'pushed to origin/launcher-collect' ((Sha $origin 'refs/heads/launcher-collect') -eq (Sha $a HEAD))

  'exit guard'
  Put $a 'readme.txt' "harom`n"; $before = Sha $a HEAD
  $code = Run 'QL'
  Check 'Q, L -> leaves without committing' ($code -eq 0 -and (Sha $a HEAD) -eq $before -and @(G $a status --porcelain).Count -eq 1)
  $code = Run 'QB{esc}C{enter}x'
  Check 'Q, B back, Esc, C, Enter, key -> commits, pushes, exits' ($code -eq 0 -and (Sha $a HEAD) -ne $before -and
        (Sha $origin 'refs/heads/launcher-collect') -eq (Sha $a HEAD))
  Put $a 'readme.txt' "negy`n"; $before = Sha $a HEAD
  $code = Run '{ctrlc}L'
  Check 'Ctrl+C goes to the guard too' ($code -eq 0 -and (Sha $a HEAD) -eq $before)
  $code = Run 'S1{esc}xQL'
  Check 'Esc in the message editor commits nothing' ($code -eq 0 -and (Sha $a HEAD) -eq $before)

  'blocked'
  Put $a '.env' "X=1`n"
  $code = Run 'S1AxQCxL'
  Check 'blocked repo: S 1 / A / guard C all refuse, then leave' ($code -eq 0 -and (Sha $a HEAD) -eq $before)
  Check '.env never reached origin' (-not (G $origin ls-tree -r --name-only refs/heads/launcher-collect | Where-Object { $_ -eq '.env' }))
  Remove-Item -LiteralPath (Join-Path $a '.env')

  'other'
  Check 'keys used up -> exit 1 (the test harness itself works)' ((Run 'S') -ne 0)
  Check 'origin main never moved' ((Sha $origin 'refs/heads/main') -eq $mainSha)
}
finally {
  if ($Keep) { "kept: $root" } else { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
}
''
if ($fails) { "$fails / $n FAILED"; exit 1 } else { "Rendben: $n / $n" }
