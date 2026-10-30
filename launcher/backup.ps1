<#
  backup.ps1 - the BACKUP menu's work, dot-sourced by vrg-ui.ps1 (and test\backup-selftest.ps1 against
  throwaway folders). No screens here, only data; vrg-ui.ps1 draws it. Settings: vrg-menu.json "backup".

    BkSync         git push --all/--tags to each repo's bare backup (created on first use, never --force)
                   + the work folders copied into Backup\code\work. Nothing is ever lost: a file the
                   backup would overwrite or drop is moved to Backup\archive\sync\<stamp>\ first.
                   Writes Backup\logs\sync-<stamp>.json and the SHA-256 manifest.
    BkIntegrity    git fsck on the bare repos + every backed-up file re-hashed against the manifest,
                   + what changed in the work folders since the last sync.
    BkLastReport   the newest sync log.
    BkVersions / BkRestore   one file or folder back from the backup or an archived version; the current
                   copy is saved to Backup\archive\restore\<stamp>\ first. Overwrites, never deletes.
    BkInstallers   every tools\ and programs\ folder has an installer in Backup\installers.

  Needs $GitExe and P (token resolver) from vrg-ui.ps1, or $BkOverride for tests. ASCII, as vrg-ui.ps1.
#>

function BkCfg {
  $b = $R.backup
  $c = [pscustomobject]@{
    full      = P $b.from;  dest = P $b.dest;  archive = P $b.archive;  logs = P $b.logs;  installers = P $b.installers
    folders   = @($b.folders);  repos = @($b.repos | ForEach-Object { [pscustomobject]@{ name = $_.name; path = P $_.path; bare = P $_.bare } })
    xd        = @($b.excludeDirs);  xf = @($b.excludeFiles);  rules = @($b.installerRules)
  }
  if ($BkOverride) { foreach ($k in $BkOverride.Keys) { $c.$k = $BkOverride[$k] } }
  $c
}
function BkLong([string]$p) { if ($p.StartsWith('\\?\')) { $p } else { '\\?\' + $p } }   # paths past 260 characters
function BkStamp { (Get-Date).ToString('yyyyMMdd-HHmmss') }
function BkPats($list) { @($list | ForEach-Object { New-Object Management.Automation.WildcardPattern $_, 'IgnoreCase' }) }
function BkHit($name, $pats) { foreach ($p in $pats) { if ($p.IsMatch($name)) { return $true } }; $false }

# rel path -> size + UTC write time; excluded folders and files skipped, junctions never followed
function BkWalk($root, $xd, $xf) {
  $map = @{}
  $lr = BkLong $root
  if (-not [IO.Directory]::Exists($lr)) { return $map }
  $pd = BkPats $xd; $pf = BkPats $xf
  $cut = $lr.TrimEnd('\').Length + 1
  $stack = New-Object Collections.Stack; $stack.Push((New-Object IO.DirectoryInfo $lr))
  while ($stack.Count) {
    foreach ($e in $stack.Pop().EnumerateFileSystemInfos()) {
      if ($e -is [IO.DirectoryInfo]) {
        if (($e.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (BkHit $e.Name $pd)) { continue }
        $stack.Push($e)
      } elseif (-not (BkHit $e.Name $pf)) {
        $map[$e.FullName.Substring($cut)] = [pscustomobject]@{ len = $e.Length; t = $e.LastWriteTimeUtc.Ticks }
      }
    }
  }
  $map
}
# what a mirror of $src onto $dst would do; same size and write time within 2 s = unchanged
function BkDiff($src, $dst) {
  $new = @(); $changed = @(); $extra = @()
  foreach ($k in $src.Keys) {
    if (-not $dst.ContainsKey($k)) { $new += $k; continue }
    $a = $src[$k]; $b = $dst[$k]
    if ($a.len -ne $b.len -or [Math]::Abs($a.t - $b.t) -gt 20000000) { $changed += $k }
  }
  foreach ($k in $dst.Keys) { if (-not $src.ContainsKey($k)) { $extra += $k } }
  [pscustomobject]@{ new = $new; changed = $changed; extra = $extra }
}
function BkMove($from, $to) {
  [void][IO.Directory]::CreateDirectory((BkLong (Split-Path $to)))
  [IO.File]::Move((BkLong $from), (BkLong $to))
}
function BkHash($file) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $s = [IO.File]::OpenRead((BkLong $file))
  try { -join ($sha.ComputeHash($s) | ForEach-Object { $_.ToString('x2') }) } finally { $s.Dispose(); $sha.Dispose() }
}
function BkRobocopy($src, $dst, $c, [switch]$Mirror) {
  $a = @($src, $dst, $(if ($Mirror) { '/MIR' } else { '/E' }), '/XJ', '/COPY:DAT', '/DCOPY:T', '/R:1', '/W:1', '/NP', '/NFL', '/NDL', '/NJH', '/NJS')
  if ($c.xd.Count) { $a += '/XD'; $a += $c.xd }
  if ($c.xf.Count) { $a += '/XF'; $a += $c.xf }
  $ErrorActionPreference = 'Continue'
  $out = @(& robocopy.exe @a 2>&1 | ForEach-Object { "$_" })
  [pscustomobject]@{ code = $LASTEXITCODE; out = $out }     # robocopy: 0-7 = fine, 8+ = something failed
}

# ------------------------------------------------------------------ manifest (hash, size, time, path; tab-separated)
function BkManifestFile($c) { Join-Path $c.logs 'manifest.tsv' }
function BkReadManifest($c) {
  $m = @{}; $f = BkManifestFile $c
  if (Test-Path -LiteralPath $f) {
    foreach ($l in [IO.File]::ReadAllLines($f)) { $p = $l.Split("`t"); if ($p.Count -eq 4) { $m[$p[3]] = [pscustomobject]@{ hash = $p[0]; len = [long]$p[1]; t = [long]$p[2] } } }
  }
  $m
}
function BkWriteManifest($c) {                   # re-hashes only files whose size or time changed
  $old = BkReadManifest $c; $lines = New-Object Collections.Generic.List[string]; $hashed = 0
  foreach ($name in $c.folders) {
    $map = BkWalk (Join-Path $c.dest $name) @() @()
    foreach ($rel in ($map.Keys | Sort-Object)) {
      $key = "$name\$rel"; $e = $map[$rel]; $o = $old[$key]
      $h = $(if ($o -and $o.len -eq $e.len -and $o.t -eq $e.t) { $o.hash } else { $hashed++; BkHash (Join-Path $c.dest $key) })
      $lines.Add("$h`t$($e.len)`t$($e.t)`t$key")
    }
  }
  [void][IO.Directory]::CreateDirectory($c.logs)
  [IO.File]::WriteAllLines((BkManifestFile $c), $lines, (New-Object Text.UTF8Encoding $false))
  [pscustomobject]@{ files = $lines.Count; hashed = $hashed }
}

# ------------------------------------------------------------------ git: bare backup repos
function BkGit($dir, [string[]]$a) {
  $ErrorActionPreference = 'Continue'
  $out = @(& $GitExe -C $dir @a 2>&1 | ForEach-Object { "$_" })
  [pscustomobject]@{ code = $LASTEXITCODE; out = $out }
}
function BkSameDir($a, $b) { ($a -replace '[\\/]+', '\').TrimEnd('\') -ieq ($b -replace '[\\/]+', '\').TrimEnd('\') }
function BkPushRepo($r) {
  $res = [pscustomobject]@{ name = $r.name; ok = $false; created = $false; rejected = @(); error = ''; log = @() }
  if (-not (Test-Path -LiteralPath (Join-Path $r.path '.git'))) { $res.error = 'nogit'; return $res }
  if (-not (Test-Path -LiteralPath (Join-Path $r.bare 'HEAD'))) {
    [void][IO.Directory]::CreateDirectory($r.bare)
    $head = [string](BkGit $r.path @('rev-parse', '--abbrev-ref', 'HEAD')).out   # HEAD = the repo's branch, so clones check it out
    $i = BkGit $r.bare @('init', '-q', '--bare', '-b', $(if ($head -and $head -ne 'HEAD') { $head } else { 'main' })); $res.log += $i.out
    if ($i.code) { $res.error = 'init'; return $res }
    $res.created = $true
  }
  $url = [string](BkGit $r.path @('remote', 'get-url', 'backup')).out
  if (-not $url -or $url -match '^(error|fatal)') { $null = BkGit $r.path @('remote', 'add', 'backup', $r.bare.Replace('\', '/')) }
  elseif (-not (BkSameDir $url $r.bare)) { $res.error = 'remote'; $res.log += "backup = $url"; return $res }   # someone else's target: leave it
  foreach ($what in '--all', '--tags') {
    $p = BkGit $r.path @('push', '--porcelain', 'backup', $what); $res.log += $p.out
    foreach ($l in $p.out) { if ($l -match '^!\s+(\S+):') { $res.rejected += $Matches[1] } }
    if ($p.code -and -not $res.rejected.Count) { $res.error = 'push'; return $res }
  }
  $res.ok = -not $res.rejected.Count
  if (-not $res.ok) { $res.error = 'rejected' }
  $res
}

# ------------------------------------------------------------------ sync
function BkSyncFolder($c, $name, $stamp) {
  $src = Join-Path $c.full $name; $dst = Join-Path $c.dest $name
  $res = [pscustomobject]@{ name = $name; new = 0; changed = 0; removed = 0; skipped = ''; code = 0; bytes = 0 }
  $sm = BkWalk $src $c.xd $c.xf
  $dm = BkWalk $dst $c.xd $c.xf
  if (-not [IO.Directory]::Exists((BkLong $src))) { $res.skipped = 'nosource'; return $res }
  if (-not $sm.Count -and $dm.Count) { $res.skipped = 'empty'; return $res }      # an emptied folder never wipes its backup
  $d = BkDiff $sm $dm
  $arch = Join-Path $c.archive "sync\$stamp\$name"
  foreach ($rel in @($d.changed) + @($d.extra)) { BkMove (Join-Path $dst $rel) (Join-Path $arch $rel) }
  $rc = BkRobocopy $src $dst $c -Mirror
  $res.code = $rc.code; $res.new = $d.new.Count; $res.changed = $d.changed.Count; $res.removed = $d.extra.Count
  foreach ($k in @($d.new) + @($d.changed)) { $res.bytes += $sm[$k].len }
  $res
}
function BkSync([scriptblock]$progress) {
  $c = BkCfg; $stamp = BkStamp; $t = [Diagnostics.Stopwatch]::StartNew()
  $log = [pscustomobject]@{ stamp = $stamp; when = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'); repos = @(); folders = @(); manifest = $null; seconds = 0; ok = $true }
  foreach ($r in $c.repos) {
    if ($progress) { & $progress $r.name }
    $p = BkPushRepo $r; $log.repos += $p; if (-not $p.ok) { $log.ok = $false }
  }
  [void][IO.Directory]::CreateDirectory($c.dest)
  foreach ($n in $c.folders) {
    if ($progress) { & $progress $n }
    $f = BkSyncFolder $c $n $stamp; $log.folders += $f
    if ($f.code -ge 8 -or $f.skipped) { $log.ok = $false }
  }
  if ($progress) { & $progress 'SHA-256' }
  $log.manifest = BkWriteManifest $c
  $log.seconds = [Math]::Round($t.Elapsed.TotalSeconds, 1)
  [void][IO.Directory]::CreateDirectory($c.logs)
  [IO.File]::WriteAllText((Join-Path $c.logs "sync-$stamp.json"), ($log | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding $false))
  $log
}
function BkLastReport {
  $c = BkCfg
  $f = Get-ChildItem -LiteralPath $c.logs -Filter 'sync-*.json' -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1
  if (-not $f) { return $null }
  Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
}

# ------------------------------------------------------------------ integrity
function BkIntegrity([scriptblock]$progress) {
  $c = BkCfg
  $res = [pscustomobject]@{ repos = @(); bad = @(); missing = @(); unlisted = @(); checked = 0; pending = @(); manifest = $false }
  foreach ($r in $c.repos) {
    if ($progress) { & $progress $r.name }
    if (-not (Test-Path -LiteralPath (Join-Path $r.bare 'HEAD'))) { $res.repos += [pscustomobject]@{ name = $r.name; ok = $false; why = 'nobare' }; continue }
    $f = BkGit $r.bare @('fsck', '--no-progress', '--no-dangling')
    $res.repos += [pscustomobject]@{ name = $r.name; ok = ($f.code -eq 0); why = $(if ($f.code) { ($f.out | Select-Object -First 2) -join ' ' } else { '' }) }
  }
  $m = BkReadManifest $c
  $res.manifest = $m.Count -gt 0
  if ($progress) { & $progress 'SHA-256' }
  $seen = @{}
  foreach ($name in $c.folders) {
    $map = BkWalk (Join-Path $c.dest $name) @() @()
    foreach ($rel in $map.Keys) {
      $key = "$name\$rel"; $seen[$key] = 1
      if (-not $m.ContainsKey($key)) { $res.unlisted += $key; continue }
      $res.checked++
      if ((BkHash (Join-Path $c.dest $key)) -ne $m[$key].hash) { $res.bad += $key }
    }
    $d = BkDiff (BkWalk (Join-Path $c.full $name) $c.xd $c.xf) (BkWalk (Join-Path $c.dest $name) $c.xd $c.xf)
    $n = $d.new.Count + $d.changed.Count + $d.extra.Count
    if ($n) { $res.pending += [pscustomobject]@{ name = $name; n = $n } }
  }
  foreach ($k in $m.Keys) { if (-not $seen.ContainsKey($k)) { $res.missing += $k } }
  $res
}

# ------------------------------------------------------------------ restore
# "jobs\CLA\a.xlsx" or "H:\VRG\Full\jobs\CLA\a.xlsx" -> folder + rel, or $null when it is not in a synced folder
function BkWhere($c, [string]$path) {
  $p = $path.Trim().Trim('"').Replace('/', '\').TrimEnd('\')
  $full = $c.full.TrimEnd('\') + '\'
  if ($p.StartsWith($full, [StringComparison]::OrdinalIgnoreCase)) { $p = $p.Substring($full.Length) }
  $parts = $p.Split('\', 2)
  $f = @($c.folders | Where-Object { $_ -ieq $parts[0] }) | Select-Object -First 1
  if (-not $f) { return $null }
  [pscustomobject]@{ folder = $f; rel = $(if ($parts.Count -gt 1) { $parts[1] } else { '' }) }
}
# newest first: the current backup, then every archived copy (sync\<stamp> and restore\<stamp>)
function BkVersions($path) {
  $c = BkCfg; $w = BkWhere $c $path
  if (-not $w) { return $null }
  $tail = $(if ($w.rel) { "$($w.folder)\$($w.rel)" } else { $w.folder })
  $list = @()
  $cur = Join-Path $c.dest $tail
  if (Test-Path -LiteralPath $cur) { $list += [pscustomobject]@{ label = 'backup'; stamp = ''; path = $cur } }
  foreach ($kind in 'sync', 'restore') {
    $root = Join-Path $c.archive $kind
    foreach ($d in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
      $p = Join-Path $d.FullName $tail
      if (Test-Path -LiteralPath $p) { $list += [pscustomobject]@{ label = $kind; stamp = $d.Name; path = $p } }
    }
  }
  $first = @($list | Where-Object { $_.label -eq 'backup' })
  $rest = @($list | Where-Object { $_.label -ne 'backup' } | Sort-Object stamp -Descending)
  [pscustomobject]@{ where = $w; target = (Join-Path $c.full $tail); tail = $tail; versions = @($first) + $rest }
}
function BkRestore($v, $version) {
  $c = BkCfg; $stamp = BkStamp
  $res = [pscustomobject]@{ saved = ''; code = 0; ok = $false }
  $isDir = Test-Path -LiteralPath $version.path -PathType Container
  if (Test-Path -LiteralPath $v.target) {
    $save = Join-Path $c.archive "restore\$stamp\$($v.tail)"
    if ($isDir) { $rc = BkRobocopy $v.target $save $c; if ($rc.code -ge 8) { $res.code = $rc.code; return $res } }
    else { [void][IO.Directory]::CreateDirectory((BkLong (Split-Path $save))); [IO.File]::Copy((BkLong $v.target), (BkLong $save), $true) }
    $res.saved = $save
  }
  if ($isDir) { $rc = BkRobocopy $version.path $v.target $c; $res.code = $rc.code; $res.ok = $rc.code -lt 8 }
  else {
    [void][IO.Directory]::CreateDirectory((BkLong (Split-Path $v.target)))
    [IO.File]::Copy((BkLong $version.path), (BkLong $v.target), $true); $res.ok = $true
  }
  $res
}

# ------------------------------------------------------------------ installers
# One row per folder in tools\ and programs\: the installer found for it, or none, or no rule at all.
function BkInstallers {
  $c = BkCfg
  $have = @(Get-ChildItem -LiteralPath $c.installers -Recurse -File -ErrorAction SilentlyContinue)
  $rows = @()
  foreach ($kind in 'tools', 'programs') {
    foreach ($d in @(Get-ChildItem -LiteralPath (Join-Path $c.full $kind) -Directory -ErrorAction SilentlyContinue | Where-Object { -not $_.Name.StartsWith('.') } | Sort-Object Name)) {   # .npm-cache and friends are no tools
      $rule = $c.rules | Where-Object { $_.dir -ieq "$kind\$($d.Name)" } | Select-Object -First 1
      if (-not $rule) { $rows += [pscustomobject]@{ dir = "$kind\$($d.Name)"; state = 'norule'; file = ''; note = '' }; continue }
      $hit = @($have | Where-Object { $f = $_; @($rule.match) | Where-Object { $f.Name -like $_ } }) | Select-Object -First 1
      $rows += [pscustomobject]@{ dir = "$kind\$($d.Name)"; state = $(if ($hit) { 'ok' } else { 'missing' })
                                  file = $(if ($hit) { $hit.FullName.Substring($c.installers.TrimEnd('\').Length + 1) } else { '' }); note = [string]$rule.note }
    }
  }
  ,$rows
}
