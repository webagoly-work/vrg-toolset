# ServiceKit Terminal - detection: Claude Code installs, session folders, git repos, the worktree plan.
# Read-only except Invoke-TermWorktree. Dot-source after lib.ps1. PowerShell 5.1 compatible, ASCII only.

# ---------------------------------------------------------------- Claude Code installs
# Every place Claude Code is known to land on Windows. The npm .ps1 shim is never used: execution policy
# blocks it on many PCs, so only claude.cmd / claude.exe are launched.
function Get-TermClaudeCandidates {
    $c = @()
    foreach ($g in @(Get-Command 'claude.exe', 'claude.cmd' -CommandType Application -ErrorAction SilentlyContinue)) {
        $c += ,@{ source = 'path'; path = [string]$g.Source; cli = $true }
    }
    if ($env:APPDATA) { $c += ,@{ source = 'npm'; path = (Join-Path $env:APPDATA 'npm\claude.cmd'); cli = $true } }
    if ($env:USERPROFILE) { $c += ,@{ source = 'native'; path = (Join-Path $env:USERPROFILE '.local\bin\claude.exe'); cli = $true } }
    $c += ,@{ source = 'kit'; path = (Join-Path $ToolsDir 'claude\claude.exe'); cli = $true }
    $c += ,@{ source = 'kit'; path = (Join-Path $DataDir 'npm-global\claude.cmd'); cli = $true }
    if ($env:LOCALAPPDATA) {
        $c += ,@{ source = 'desktop'; path = (Join-Path $env:LOCALAPPDATA 'AnthropicClaude\claude.exe'); cli = $false }
        $pk = Join-Path $env:LOCALAPPDATA 'Packages'
        foreach ($d in @(Get-ChildItem -LiteralPath $pk -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue)) {
            $c += ,@{ source = 'desktop-store'; path = $d.FullName; cli = $false }
        }
    }
    return ,$c
}

# Existing installs, de-duplicated, each with its version (CLI only; the desktop app is reported, not run).
function Find-TermClaudeInstalls([switch]$NoVersion) {
    $seen = @{}; $r = @()
    foreach ($c in (Get-TermClaudeCandidates)) {
        $p = [string]$c['path']
        if (-not $p -or -not (Test-Path -LiteralPath $p)) { continue }
        $k = $p.ToLower()
        if ($seen.ContainsKey($k)) { continue }
        $seen[$k] = $true
        $v = ''
        if ($c['cli'] -and -not $NoVersion) { $v = Get-TermVersion $p }
        $isKit = $k.StartsWith($KitRoot.ToLower())
        $r += ,@{ source = $c['source']; path = $p; version = $v; cli = [bool]$c['cli']; kit = $isKit }
    }
    return ,$r
}

# The CLI to launch: the kit copy first (it is ours), then the PC's own.
function Select-TermClaude($Installs) {
    $cli = @($Installs | Where-Object { $_['cli'] })
    $kit = @($cli | Where-Object { $_['kit'] })
    if ($kit.Count -gt 0) { return $kit[0] }
    if ($cli.Count -gt 0) { return $cli[0] }
    return $null
}

# ---------------------------------------------------------------- session folders
# Decodes the body of a JSON string literal (without the quotes).
function ConvertFrom-TermJsonString([string]$Body) {
    $sb = New-Object System.Text.StringBuilder
    $i = 0
    while ($i -lt $Body.Length) {
        $ch = $Body[$i]
        if ($ch -ne '\' -or $i -eq $Body.Length - 1) { [void]$sb.Append($ch); $i++; continue }
        $n = $Body[$i + 1]
        switch -CaseSensitive ([string]$n) {
            'n' { [void]$sb.Append("`n"); $i += 2 }
            'r' { [void]$sb.Append("`r"); $i += 2 }
            't' { [void]$sb.Append("`t"); $i += 2 }
            'b' { [void]$sb.Append([char]8); $i += 2 }
            'f' { [void]$sb.Append([char]12); $i += 2 }
            'u' {
                if ($i + 5 -lt $Body.Length) {
                    $hex = $Body.Substring($i + 2, 4)
                    [void]$sb.Append([char][Convert]::ToInt32($hex, 16)); $i += 6
                } else { [void]$sb.Append($n); $i += 2 }
            }
            default { [void]$sb.Append($n); $i += 2 }
        }
    }
    return $sb.ToString()
}

# The real working folder of a transcript: the first "cwd" field in its first lines.
# Folder names under projects\ are lossy (H:\VRG\Full -> H--VRG-Full), the cwd field is not.
function Get-TermCwdFromJsonl([string]$File, [int]$MaxLines = 50) {
    $rx = New-Object System.Text.RegularExpressions.Regex('"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"')
    $sr = $null
    try {
        $sr = New-Object System.IO.StreamReader($File, [System.Text.Encoding]::UTF8)
        for ($i = 0; $i -lt $MaxLines; $i++) {
            $line = $sr.ReadLine()
            if ($null -eq $line) { break }
            $m = $rx.Match($line)
            if ($m.Success) { return (ConvertFrom-TermJsonString $m.Groups[1].Value) }
        }
    } catch { } finally { if ($sr) { $sr.Close() } }
    return $null
}

# The projects\ folders to scan: the PC's own ~/.claude plus CLAUDE_CONFIG_DIR when set.
function Get-TermProjectRoots {
    $r = @()
    if ($env:USERPROFILE) { $r += (Join-Path $env:USERPROFILE '.claude\projects') }
    if ($env:HOME -and $env:HOME -ne $env:USERPROFILE) { $r += (Join-Path $env:HOME '.claude/projects') }
    if ($env:CLAUDE_CONFIG_DIR) { $r += (Join-Path $env:CLAUDE_CONFIG_DIR 'projects') }
    return ,$r
}

# Recent session folders, newest first: @{ path; sessions; last; exists }.
function Get-TermSessionFolders([string[]]$ProjectRoots, [int]$Max = 30) {
    $by = @{}
    foreach ($root in $ProjectRoots) {
        if (-not $root -or -not (Test-Path -LiteralPath $root)) { continue }
        foreach ($pd in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
            $files = @(Get-ChildItem -LiteralPath $pd.FullName -Filter '*.jsonl' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
            if ($files.Count -eq 0) { continue }
            $cwd = $null
            foreach ($f in ($files | Select-Object -First 5)) { $cwd = Get-TermCwdFromJsonl $f.FullName; if ($cwd) { break } }
            if (-not $cwd) { continue }
            $k = $cwd.TrimEnd('\', '/').ToLower()
            $last = $files[0].LastWriteTime
            if ($by.ContainsKey($k)) {
                $e = $by[$k]
                $e['sessions'] = [int]$e['sessions'] + $files.Count
                if ($last -gt $e['last']) { $e['last'] = $last }
            } else {
                $by[$k] = @{ path = $cwd.TrimEnd('\', '/'); sessions = $files.Count; last = $last; exists = (Test-Path -LiteralPath $cwd) }
            }
        }
    }
    $list = @($by.Values | Sort-Object { $_['last'] } -Descending)
    if ($list.Count -gt $Max) { $list = $list[0..($Max - 1)] }
    return ,$list
}

# ---------------------------------------------------------------- git repos in common places
$script:TermSkipDirs = @('windows', 'program files', 'program files (x86)', 'programdata', '$recycle.bin',
    'system volume information', 'appdata', 'node_modules', 'recovery', 'perflogs', 'msocache', 'intel', 'amd', 'nvidia')

function Get-TermRepoRoots {
    $r = @()
    if ($env:USERPROFILE) {
        foreach ($s in @('Documents', 'source\repos', 'Projects', 'dev', 'code', 'Desktop', 'repos', 'git')) {
            $p = Join-Path $env:USERPROFILE $s
            if (Test-Path -LiteralPath $p) { $r += ,@{ path = $p; depth = 2 } }
        }
    }
    try {
        foreach ($d in [System.IO.DriveInfo]::GetDrives()) {
            if ($d.DriveType -eq [System.IO.DriveType]::Fixed -and $d.IsReady) { $r += ,@{ path = $d.RootDirectory.FullName; depth = 2 } }
        }
    } catch { }
    return ,$r
}

# Breadth-first, time-boxed; skips system, hidden and dot folders; never descends into a repo.
function Find-TermGitRepos($Roots, [int]$Seconds = 5, [int]$Max = 40) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $found = @(); $seen = @{}
    $queue = New-Object System.Collections.Queue
    foreach ($r in $Roots) { $queue.Enqueue(@($r['path'], 0, [int]$r['depth'])) }
    while ($queue.Count -gt 0 -and $sw.Elapsed.TotalSeconds -lt $Seconds -and $found.Count -lt $Max) {
        $item = $queue.Dequeue()
        $dir = [string]$item[0]; $lvl = [int]$item[1]; $maxLvl = [int]$item[2]
        $k = $dir.TrimEnd('\', '/').ToLower()
        if ($seen.ContainsKey($k)) { continue }
        $seen[$k] = $true
        if ($lvl -gt 0 -and (Test-Path -LiteralPath (Join-Path $dir '.git'))) { $found += $dir.TrimEnd('\', '/'); continue }
        if ($lvl -ge $maxLvl) { continue }
        foreach ($c in @(Get-ChildItem -LiteralPath $dir -Directory -ErrorAction SilentlyContinue)) {
            if ($c.Name.StartsWith('.')) { continue }
            if ($script:TermSkipDirs -contains $c.Name.ToLower()) { continue }
            if (($c.Attributes -band [System.IO.FileAttributes]::Hidden) -or ($c.Attributes -band [System.IO.FileAttributes]::System)) { continue }
            $queue.Enqueue(@($c.FullName, ($lvl + 1), $maxLvl))
        }
    }
    return ,$found
}

# ---------------------------------------------------------------- worktree question
# Pure: what to do for a task name. Empty name = the folder itself (the worklines hook guards it).
function Get-TermWorktreePlan([string]$Folder, [string]$Task, [bool]$PathExists, [bool]$BranchExists) {
    $name = ([string]$Task).Trim() -replace '\s+', '-'
    $name = $name -replace '[^A-Za-z0-9._-]', ''
    $name = $name.Trim('.', '-')
    if (-not $name) { return @{ mode = 'self'; path = $Folder; name = ''; branch = '' } }
    $sep = [IO.Path]::DirectorySeparatorChar
    $path = $Folder.TrimEnd('\', '/') + $sep + '.claude' + $sep + 'worktrees' + $sep + $name
    $branch = 'wt/' + $name
    $mode = 'create'
    if ($PathExists) { $mode = 'reopen' } elseif ($BranchExists) { $mode = 'attach' }
    return @{ mode = $mode; path = $path; name = $name; branch = $branch }
}

function Test-TermGitRepo([string]$Folder) {
    $git = Get-TermGit
    if (-not $git) { return $false }
    $r = Invoke-TermExe $git @('-C', $Folder, 'rev-parse', '--is-inside-work-tree') 8
    return ($r['code'] -eq 0 -and $r['out'] -eq 'true')
}

# Resolves the plan against the repo and carries it out. Returns the folder Claude should start in.
function Invoke-TermWorktree([string]$Folder, [string]$Task) {
    $git = Get-TermGit
    $probe = Get-TermWorktreePlan $Folder $Task $false $false
    if ($probe['mode'] -eq 'self') { return $probe }
    $br = Invoke-TermExe $git @('-C', $Folder, 'rev-parse', '--verify', '--quiet', ('refs/heads/' + $probe['branch'])) 8
    $plan = Get-TermWorktreePlan $Folder $Task (Test-Path -LiteralPath $probe['path']) ($br['code'] -eq 0)
    if ($plan['mode'] -eq 'create') {
        $r = Invoke-TermExe $git @('-C', $Folder, 'worktree', 'add', $plan['path'], '-b', $plan['branch'], 'HEAD') 60
    } elseif ($plan['mode'] -eq 'attach') {
        $r = Invoke-TermExe $git @('-C', $Folder, 'worktree', 'add', $plan['path'], $plan['branch']) 60
    } else { $r = @{ code = 0 } }
    $plan['ok'] = ($r['code'] -eq 0)
    $plan['error'] = ([string]$r['err'])
    return $plan
}

# Pure: a workspace name inside the kit.
function Get-TermWorkspacePath([string]$Name) {
    $n = ([string]$Name).Trim() -replace '\s+', '-'
    $n = $n -replace '[^A-Za-z0-9._-]', ''
    $n = $n.Trim('.', '-')
    if (-not $n) { $n = 'munka-' + (Get-Date -Format 'yyyyMMdd-HHmm') }
    return (Join-Path $WorkspaceDir $n)
}
