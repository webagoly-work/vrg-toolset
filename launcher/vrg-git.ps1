<#
  vrg-git.ps1 - the launchers' change tracker and commit flow, dot-sourced by vrg-ui.ps1 (and by
  test\git-selftest.ps1 against a throwaway repo). No screens here, only data: vrg-ui.ps1 draws it.

    VgState  $dir                 branch, changes (M/A/D/R), commits not on any remote, origin or not
    VgBlocked $dir $changes       what must not be committed: secret-looking names or contents, files > 5 MB
    VgCommitPush $dir $message    git add -A + commit on the current branch + push to origin/launcher-collect;
                                  not a fast-forward -> launcher-collect-YYYY-MM-DD (then -2 ... -9).
                                  Never --force, never any other branch on origin (main stays untouched).

  Needs $GitExe (the git to run). Stays ASCII for the same reason as vrg-ui.ps1.
#>

$VgCollect = 'launcher-collect'
$VgMaxBytes = 5MB
$VgScanBytes = 1MB                     # contents are scanned only in text files up to this size
$VgSecretName = @(
  '\.(pem|key|pfx|p12|kdbx|ppk)$', '(^|/)\.env(\.[^/]*)?$', '(^|/)\.?credentials[^/]*\.json$',
  '(^|/)id_(rsa|dsa|ecdsa|ed25519)$', '(^|/)\.(npmrc|netrc|git-credentials)$', '(^|/)secrets?\.[^/]*$'
)
$VgHarmless = '\.(example|sample|template|dist)$'           # .env.example and friends hold no secrets
$VgSecretText = New-Object Text.RegularExpressions.Regex (
  '(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}' +
  '|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)')
try { [Console]::OutputEncoding = New-Object Text.UTF8Encoding $false } catch { }   # git prints paths as UTF-8

function VgGit($dir, [string[]]$a) { $ErrorActionPreference = 'Continue'; & $GitExe -C $dir @a 2>$null }
function VgRun($dir, [string[]]$a) {             # exit code and every line, stderr included
  $ErrorActionPreference = 'Continue'
  $out = @(& $GitExe -C $dir @a 2>&1 | ForEach-Object { "$_" })
  [pscustomobject]@{ code = $LASTEXITCODE; out = $out }
}
function VgIsRepo($dir) { $dir -and (Test-Path -LiteralPath (Join-Path $dir '.git')) }

# One entry per file, untracked folders listed file by file (-uall), so the counts and the checks see
# exactly what "git add -A" would stage.
function VgChanges($dir) {
  $raw = (@(VgGit $dir @('status', '--porcelain=v1', '-z', '-uall')) -join "`n").Split([char]0)
  $list = @()
  for ($i = 0; $i -lt $raw.Count; $i++) {
    $e = $raw[$i]; if ($e.Length -lt 4) { continue }
    $x = $e[0]; $y = $e[1]; $path = $e.Substring(3)
    if ($x -eq 'R' -or $x -eq 'C') { $i++ }      # the original name follows a rename
    $kind = $(if ($x -eq 'D' -or $y -eq 'D') { 'D' } elseif ($x -eq 'R') { 'R' } elseif ($x -eq '?' -or $x -eq 'A') { 'A' } else { 'M' })
    $list += [pscustomobject]@{ kind = $kind; path = $path }
  }
  ,$list
}

function VgState($dir, $name) {
  $s = [pscustomobject]@{ name = $name; path = $dir; git = $false; branch = ''; changes = @(); ahead = 0
                          origin = $false; counts = @{ M = 0; A = 0; D = 0; R = 0 }; dirty = $false }
  if (-not (VgIsRepo $dir)) { return $s }
  $s.git = $true
  $s.branch = [string](VgGit $dir @('rev-parse', '--abbrev-ref', 'HEAD'))
  $s.changes = VgChanges $dir
  foreach ($c in $s.changes) { $s.counts[$c.kind]++ }
  $s.origin = [bool](VgGit $dir @('remote', 'get-url', 'origin'))
  # unpushed = not on origin (GitHub); a local backup remote does not count as pushed
  $s.ahead = [int](VgGit $dir @('rev-list', '--count', 'HEAD', '--not', $(if ($s.origin) { '--remotes=origin' } else { '--remotes' })))
  $s.dirty = $s.changes.Count -gt 0 -or $s.ahead -gt 0
  $s
}

function VgBlocked($dir, $changes) {
  $bad = @()
  foreach ($c in $changes) {
    if ($c.kind -eq 'D') { continue }
    $p = $c.path.Replace('\', '/'); $lp = $p.ToLowerInvariant()
    if (-not ($lp -match $VgHarmless) -and ($VgSecretName | Where-Object { $lp -match $_ })) {
      $bad += [pscustomobject]@{ path = $p; why = 'name'; size = 0 }; continue
    }
    $f = Join-Path $dir $c.path
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { continue }
    $len = (Get-Item -LiteralPath $f).Length
    if ($len -gt $VgMaxBytes) { $bad += [pscustomobject]@{ path = $p; why = 'large'; size = $len }; continue }
    if ($len -gt $VgScanBytes -or $len -eq 0) { continue }
    $bytes = [IO.File]::ReadAllBytes($f)
    if ([Array]::IndexOf($bytes, [byte]0, 0, [Math]::Min($bytes.Length, 8000)) -ge 0) { continue }   # binary
    if ($VgSecretText.IsMatch([Text.Encoding]::UTF8.GetString($bytes))) {
      $bad += [pscustomobject]@{ path = $p; why = 'content'; size = $len }
    }
  }
  ,$bad
}

# The branch names tried in order; none of them is ever main.
function VgTargets([datetime]$day) {
  $d = $day.ToString('yyyy-MM-dd')
  @($VgCollect, "$VgCollect-$d") + @(2..9 | ForEach-Object { "$VgCollect-$d-$_" })
}

function VgPush($dir, [datetime]$day) {
  $log = @()
  $old = $env:GIT_TERMINAL_PROMPT; $env:GIT_TERMINAL_PROMPT = '0'    # a sign-in window may come up, a hidden prompt never
  try {
    foreach ($t in VgTargets $day) {
      if ($t -notlike "$VgCollect*") { throw "refusing to push to $t" }
      $r = VgRun $dir @('push', '--porcelain', 'origin', "HEAD:refs/heads/$t")
      $log += $r.out
      if ($r.code -eq 0) { return [pscustomobject]@{ ok = $true; branch = $t; log = $log } }
      if (-not (($r.out -join "`n") -match 'rejected|non-fast-forward|fetch first')) {
        return [pscustomobject]@{ ok = $false; branch = $t; log = $log }    # offline, no rights...: no fallback
      }
    }
    [pscustomobject]@{ ok = $false; branch = ''; log = $log }
  } finally { $env:GIT_TERMINAL_PROMPT = $old }
}

# Result: blocked (nothing done), committed (new commit or not), push result. A repo with nothing to
# commit but unpushed commits only pushes.
function VgCommitPush($dir, [string]$message, [datetime]$day = (Get-Date)) {
  $res = [pscustomobject]@{ blocked = @(); committed = $false; commitLog = @(); push = $null; error = '' }
  if (-not (VgIsRepo $dir)) { $res.error = 'nogit'; return $res }
  $changes = VgChanges $dir
  $res.blocked = VgBlocked $dir $changes
  if ($res.blocked.Count) { return $res }
  if (-not (VgGit $dir @('remote', 'get-url', 'origin'))) { $res.error = 'noorigin'; return $res }
  if ($changes.Count) {
    $a = VgRun $dir @('add', '-A'); $res.commitLog += $a.out
    if ($a.code) { $res.error = 'add'; return $res }
    $c = VgRun $dir @('commit', '-q', '-m', $message); $res.commitLog += $c.out
    if ($c.code) { $res.error = 'commit'; return $res }
    $res.committed = $true
  }
  if ([int](VgGit $dir @('rev-list', '--count', 'HEAD', '--not', '--remotes=origin')) -eq 0) { return $res }   # origin has it all
  $res.push = VgPush $dir $day
  if (-not $res.push.ok) { $res.error = 'push' }
  $res
}
