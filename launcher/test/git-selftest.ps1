<#
  git-selftest.ps1 - the commit flow (vrg-git.ps1) against a throwaway repo: a local bare "origin" and two
  clones in %TEMP%\VRG, removed afterwards. Nothing touches a real repository or the network.

    powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\git-selftest.ps1 [-Keep]
#>
param([switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
$GitExe = Join-Path (Split-Path (Split-Path $here -Parent) -Parent) 'tools\git\cmd\git.exe'
if (-not (Test-Path $GitExe)) { $GitExe = 'git' }
. (Join-Path $here 'vrg-git.ps1')

$fails = 0; $n = 0
function Check($name, $ok) { $script:n++; if ($ok) { "  ok   $name" } else { $script:fails++; "  FAIL $name" } }
function G($dir) { $ErrorActionPreference = 'Continue'; & $GitExe -C $dir @args 2>$null }
function Put($dir, $rel, $text) {
  $f = Join-Path $dir $rel; New-Item -ItemType Directory -Force -Path (Split-Path $f) | Out-Null
  [IO.File]::WriteAllText($f, $text, (New-Object Text.UTF8Encoding $false))
}
function Sha($dir, $ref) { [string](G $dir rev-parse --verify -q $ref) }

$root = Join-Path $env:TEMP ('VRG\gitselftest-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$origin = Join-Path $root 'origin.git'; $a = Join-Path $root 'a'; $b = Join-Path $root 'b'
New-Item -ItemType Directory -Force -Path $root | Out-Null
$day = [datetime]'2026-10-27'
try {
  G $root init -q --bare -b main $origin | Out-Null
  G $root clone -q $origin $a | Out-Null
  foreach ($d in @($a)) { G $d config user.name 'VRG teszt' | Out-Null; G $d config user.email 'teszt@localhost' | Out-Null }
  Put $a 'readme.txt' "egy`n"; G $a add -A | Out-Null; G $a commit -q -m init | Out-Null; G $a push -q origin main | Out-Null
  $mainSha = Sha $origin 'refs/heads/main'
  G $root clone -q $origin $b | Out-Null
  G $b config user.name 'VRG masik' | Out-Null; G $b config user.email 'masik@localhost' | Out-Null

  'state'
  $s = VgState $a 'a'
  Check 'clean clone is not dirty' (-not $s.dirty -and $s.ahead -eq 0 -and $s.origin -and $s.branch -eq 'main')
  $acc = 'mapp' + [char]0x00E1 + ' x/f' + [char]0x00E1 + 'jl ' + [char]0x0151 + '.txt'   # accents + spaces
  Put $a 'readme.txt' "ketto`n"; Put $a 'uj/egy.txt' "1`n"; Put $a 'uj/ketto.txt' "2`n"; Put $a $acc "3`n"
  $s = VgState $a 'a'
  Check 'counts M1 A3 (untracked folder file by file)' ($s.counts.M -eq 1 -and $s.counts.A -eq 3 -and $s.dirty)
  Check 'accented path read back intact' (@($s.changes | Where-Object { $_.path -eq $acc.Replace('\', '/') }).Count -eq 1)
  G $a add -A | Out-Null; G $a commit -q -m 'helyi' | Out-Null
  G $a mv uj/egy.txt uj/harom.txt | Out-Null; G $a rm -q uj/ketto.txt | Out-Null
  $s = VgState $a 'a'
  Check 'rename + delete counted, 1 unpushed' ($s.counts.R -eq 1 -and $s.counts.D -eq 1 -and $s.ahead -eq 1)

  'blocked'
  Put $a '.env' "X=1`n"; Put $a '.env.example' "X=`n"; Put $a 'conf/credentials.json' '{}'
  Put $a 'notes/token.txt' ('push with ' + 'gh' + 'p_' + ('a1' * 18) + "`n")
  Put $a 'notes/key.txt' ('-----BEGIN ' + 'RSA PRIVATE KEY-----' + "`nabc`n")
  $big = Join-Path $a 'media/big.bin'; New-Item -ItemType Directory -Force -Path (Split-Path $big) | Out-Null
  $fs = [IO.File]::Create($big); $fs.SetLength(6MB); $fs.Close()
  $before = Sha $a HEAD
  $r = VgCommitPush $a 'teszt' $day
  $why = @{}; foreach ($x in $r.blocked) { $why[$x.path] = $x.why }
  Check '.env blocked by name' ($why['.env'] -eq 'name')
  Check '.env.example allowed' (-not $why.ContainsKey('.env.example'))
  Check 'credentials.json blocked' ($why['conf/credentials.json'] -eq 'name')
  Check 'token in text blocked' ($why['notes/token.txt'] -eq 'content')
  Check 'private key blocked' ($why['notes/key.txt'] -eq 'content')
  Check '6 MB file blocked' ($why['media/big.bin'] -eq 'large')
  Check 'blocked = nothing committed or pushed' ((Sha $a HEAD) -eq $before -and -not $r.committed -and -not $r.push)
  foreach ($f in '.env', 'conf', 'notes', 'media') { Remove-Item -LiteralPath (Join-Path $a $f) -Recurse -Force }

  'push'
  $r = VgCommitPush $a 'launcher: elso' $day
  Check 'commit + push to launcher-collect' ($r.committed -and $r.push.ok -and $r.push.branch -eq 'launcher-collect' -and -not $r.error)
  Check 'origin/launcher-collect = HEAD' ((Sha $origin 'refs/heads/launcher-collect') -eq (Sha $a HEAD))
  Check 'clean afterwards' (-not (VgState $a 'a').dirty)
  Put $a 'readme.txt' "harom`n"
  $r = VgCommitPush $a 'launcher: masodik' $day
  Check 'second push fast-forwards launcher-collect' ($r.push.ok -and $r.push.branch -eq 'launcher-collect')
  $r = VgCommitPush $a 'semmi' $day
  Check 'nothing to do = no commit, no push' (-not $r.committed -and -not $r.push -and -not $r.error)
  G $a commit -q --allow-empty -m 'csak helyi' | Out-Null
  $r = VgCommitPush $a 'x' $day
  Check 'only unpushed commits: push without commit' (-not $r.committed -and $r.push.ok -and $r.push.branch -eq 'launcher-collect')

  'fallback'
  G $b fetch -q origin | Out-Null; G $b checkout -q -b lc origin/launcher-collect | Out-Null
  Put $b 'mas.txt' "b`n"; G $b add -A | Out-Null; G $b commit -q -m 'b' | Out-Null
  G $b push -q origin HEAD:launcher-collect | Out-Null
  Put $a 'readme.txt' "negy`n"
  $r = VgCommitPush $a 'launcher: elagazott' $day
  Check 'diverged -> launcher-collect-2026-10-27' ($r.push.ok -and $r.push.branch -eq 'launcher-collect-2026-10-27')
  Check 'launcher-collect left as the other clone pushed it' ((Sha $origin 'refs/heads/launcher-collect') -eq (Sha $b HEAD))
  G $b push -q origin "HEAD:launcher-collect-2026-10-27" -f | Out-Null              # the test forces, the launcher never does
  Put $a 'readme.txt' "ot`n"
  $r = VgCommitPush $a 'launcher: megint' $day
  Check 'dated also diverged -> -2' ($r.push.ok -and $r.push.branch -eq 'launcher-collect-2026-10-27-2')
  Check 'origin main never moved' ((Sha $origin 'refs/heads/main') -eq $mainSha)
  Check 'no target is main' (-not (VgTargets $day | Where-Object { $_ -notlike 'launcher-collect*' }))

  'failures'
  $c = Join-Path $root 'noorigin'; G $root init -q -b main $c | Out-Null
  G $c config user.name t | Out-Null; G $c config user.email t@localhost | Out-Null; Put $c 'x.txt' "x`n"
  $r = VgCommitPush $c 'x' $day
  Check 'no origin -> error, nothing committed' ($r.error -eq 'noorigin' -and -not (Sha $c HEAD))
  G $a remote set-url origin (Join-Path $root 'missing.git') | Out-Null
  Put $a 'readme.txt' "hat`n"
  $r = VgCommitPush $a 'x' $day
  Check 'unreachable origin -> push error, no fallback branch tried' ($r.committed -and $r.error -eq 'push' -and $r.push.branch -eq 'launcher-collect')
  Check 'not a repo -> nogit' ((VgCommitPush $root 'x' $day).error -eq 'nogit' -and -not (VgState $root 'r').git)
}
finally {
  if ($Keep) { "kept: $root" } else { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
}
''
if ($fails) { "$fails / $n FAILED"; exit 1 } else { "Rendben: $n / $n" }
