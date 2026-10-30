<#
  backup-selftest.ps1 - backup.ps1 against throwaway folders in %TEMP%\VRG: a fake Full (two work folders,
  a git repo), a fake Backup. Nothing real is read or written.

    powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\backup-selftest.ps1 [-Keep]
#>
param([switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
$GitExe = Join-Path (Split-Path (Split-Path $here -Parent) -Parent) 'tools\git\cmd\git.exe'
if (-not (Test-Path $GitExe)) { $GitExe = 'git' }
$R = Get-Content -LiteralPath (Join-Path $here 'vrg-menu.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function P([string]$s) { $s }
. (Join-Path $here 'backup.ps1')

$fails = 0; $n = 0
function Check($name, $ok) { $script:n++; if ($ok) { "  ok   $name" } else { $script:fails++; "  FAIL $name" } }
function G($dir) { $ErrorActionPreference = 'Continue'; & $GitExe -C $dir @args 2>$null }
function Put($rel, $text) {
  $f = Join-Path $root $rel; New-Item -ItemType Directory -Force -Path (Split-Path $f) | Out-Null
  [IO.File]::WriteAllText($f, $text, (New-Object Text.UTF8Encoding $false))
}
function Txt($rel) { $f = Join-Path $root $rel; if (Test-Path -LiteralPath $f) { [IO.File]::ReadAllText($f) } else { $null } }
function Has($rel) { Test-Path -LiteralPath (Join-Path $root $rel) }
function Tick { Start-Sleep -Milliseconds 1100 }    # stamps are per second

$root = Join-Path $env:TEMP ('VRG\bktest-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $root | Out-Null
$repo = Join-Path $root 'full\repo'; $bare = Join-Path $root 'backup\code\repo.git'
$BkOverride = @{
  full = (Join-Path $root 'full'); dest = (Join-Path $root 'backup\code\work'); archive = (Join-Path $root 'backup\archive')
  logs = (Join-Path $root 'backup\logs'); installers = (Join-Path $root 'backup\installers')
  folders = @('A', 'B', 'Gone'); repos = @([pscustomobject]@{ name = 'repo'; path = $repo; bare = $bare })
}
try {
  $acc = 'f' + [char]0x00E1 + 'jl ' + [char]0x0151 + '.txt'
  Put 'full\A\one.txt' "1`n"; Put 'full\A\sub\two.txt' "2`n"; Put "full\A\$acc" "3`n"
  Put 'full\A\node_modules\x.js' 'x'; Put 'full\A\~$lock.docx' 'x'; Put 'full\B\b.txt' "b`n"
  G $root init -q -b main $repo | Out-Null; G $repo config user.name t | Out-Null; G $repo config user.email t@localhost | Out-Null
  Put 'full\repo\r.txt' "r`n"; G $repo add -A | Out-Null; G $repo commit -q -m r1 | Out-Null; G $repo branch side | Out-Null

  'sync'
  $l = BkSync
  Check 'bare repo created, all branches pushed' ($l.repos[0].ok -and $l.repos[0].created -and
        [string](G $bare rev-parse main) -eq [string](G $repo rev-parse main) -and [string](G $bare rev-parse side))
  Check 'backup remote added to the repo' (BkSameDir ([string](G $repo remote get-url backup)) $bare)
  Check 'files copied, accented name too' ((Txt 'backup\code\work\A\sub\two.txt') -eq "2`n" -and (Has "backup\code\work\A\$acc"))
  Check 'node_modules and ~$ files left out' (-not (Has 'backup\code\work\A\node_modules') -and -not (Has 'backup\code\work\A\~$lock.docx'))
  Check 'missing source folder skipped, run marked not ok' (($l.folders | Where-Object name -eq 'Gone').skipped -eq 'nosource' -and -not $l.ok)
  Check 'manifest has the 4 files' ((BkReadManifest (BkCfg)).Count -eq 4 -and $l.manifest.hashed -eq 4)
  Check 'sync log written' ((BkLastReport).stamp -eq $l.stamp)
  $BkOverride.folders = @('A', 'B')

  'nothing lost'
  Tick
  Put 'full\A\one.txt' "1 uj`n"; Remove-Item -LiteralPath (Join-Path $root 'full\A\sub') -Recurse; Put 'full\A\three.txt' "3`n"
  $l2 = BkSync
  $a = "backup\archive\sync\$($l2.stamp)\A"
  $fa = $l2.folders | Where-Object name -eq 'A'
  Check 'counts: 1 new, 1 changed, 1 removed' ($fa.new -eq 1 -and $fa.changed -eq 1 -and $fa.removed -eq 1 -and $l2.ok)
  Check 'backup = source now' ((Txt 'backup\code\work\A\one.txt') -eq "1 uj`n" -and -not (Has 'backup\code\work\A\sub') -and (Has 'backup\code\work\A\three.txt'))
  Check 'old one.txt and the dropped two.txt kept in the archive' ((Txt "$a\one.txt") -eq "1`n" -and (Txt "$a\sub\two.txt") -eq "2`n")
  Check 'manifest re-hashed only the 2 new/changed' ($l2.manifest.hashed -eq 2 -and $l2.manifest.files -eq 4)
  Remove-Item -LiteralPath (Join-Path $root 'full\B\b.txt')
  $l3 = BkSync
  Check 'emptied folder never wipes its backup' (($l3.folders | Where-Object name -eq 'B').skipped -eq 'empty' -and (Has 'backup\code\work\B\b.txt'))
  Put 'full\B\b.txt' "b`n"

  'git'
  $o = Join-Path $root 'other'; G $root clone -q $bare $o | Out-Null; G $o config user.name o | Out-Null; G $o config user.email o@localhost | Out-Null
  Put 'other\o.txt' 'o'; G $o add -A | Out-Null; G $o commit -q -m other | Out-Null; G $o push -q origin main | Out-Null
  $bareMain = [string](G $bare rev-parse main)
  Put 'full\repo\r.txt' "r2`n"; G $repo commit -q -am r2 | Out-Null
  $p = BkPushRepo $BkOverride.repos[0]
  Check 'diverged branch rejected, not forced' (-not $p.ok -and $p.rejected -contains 'refs/heads/main' -and [string](G $bare rev-parse main) -eq $bareMain)
  G $repo remote set-url backup (Join-Path $root 'elsewhere.git') | Out-Null
  $p = BkPushRepo $BkOverride.repos[0]
  Check 'backup remote pointing elsewhere is left alone' ($p.error -eq 'remote' -and [string](G $repo remote get-url backup) -like '*elsewhere.git')
  G $repo remote set-url backup $bare | Out-Null

  'integrity'
  $null = BkSync                                   # B is back; the repo push is rejected, the folders still sync
  $i = BkIntegrity
  Check 'clean: fsck ok, every file matches' ($i.repos[0].ok -and $i.checked -eq 4 -and -not $i.bad.Count -and -not $i.missing.Count -and -not $i.pending.Count)
  $f = Join-Path $root 'backup\code\work\A\three.txt'; $t = (Get-Item -LiteralPath $f).LastWriteTimeUtc
  [IO.File]::WriteAllText($f, "X`n"); (Get-Item -LiteralPath $f).LastWriteTimeUtc = $t       # same size, same time
  Remove-Item -LiteralPath (Join-Path $root "backup\code\work\A\$acc")
  Put 'full\A\four.txt' "4`n"
  $i = BkIntegrity
  Check 'silent change caught by the hash' ($i.bad -contains 'A\three.txt')
  Check 'file gone from the backup caught' ($i.missing -contains "A\$acc")
  Check 'work not yet synced shown as pending' (@($i.pending | Where-Object name -eq 'A').Count -eq 1)

  'restore'
  $v = BkVersions (Join-Path $root 'full\A\one.txt')
  Check 'one.txt: backup + 1 archived version' ($v.versions.Count -eq 2 -and $v.versions[0].label -eq 'backup' -and $v.versions[1].stamp -eq $l2.stamp)
  Put 'full\A\one.txt' "elrontva`n"
  $rs = BkRestore $v $v.versions[1]
  Check 'older version back in place' ($rs.ok -and (Txt 'full\A\one.txt') -eq "1`n")
  Check 'the copy it replaced was saved first' ($rs.saved -and [IO.File]::ReadAllText($rs.saved) -eq "elrontva`n")
  $v = BkVersions 'A\sub'
  Check 'deleted folder found in the archive' ($v.versions.Count -eq 1 -and $v.versions[0].label -eq 'sync')
  $rs = BkRestore $v $v.versions[0]
  Check 'folder restored (not there before: nothing to save)' ($rs.ok -and -not $rs.saved -and (Txt 'full\A\sub\two.txt') -eq "2`n")
  Check 'path outside the synced folders refused' ($null -eq (BkVersions 'C:\Windows\win.ini') -and $null -eq (BkVersions 'repo\r.txt'))

  'installers'
  foreach ($d in 'tools\node', 'tools\dotnet', 'tools\mystery', 'programs\VLC') { New-Item -ItemType Directory -Force -Path (Join-Path $root "full\$d") | Out-Null }
  Put 'backup\installers\zipped\node-v24.0.0-win-x64.zip' 'z'; Put 'backup\installers\vlc-3.0.24-win64.exe' 'z'
  $rows = BkInstallers; $st = @{}; foreach ($x in $rows) { $st[$x.dir] = $x.state }
  Check 'node + VLC found (in subfolders too)' ($st['tools\node'] -eq 'ok' -and $st['programs\VLC'] -eq 'ok')
  Check 'dotnet missing, unknown folder has no rule' ($st['tools\dotnet'] -eq 'missing' -and $st['tools\mystery'] -eq 'norule')
}
finally {
  if ($Keep) { "kept: $root" } else { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
}
''
if ($fails) { "$fails / $n FAILED"; exit 1 } else { "Rendben: $n / $n" }
