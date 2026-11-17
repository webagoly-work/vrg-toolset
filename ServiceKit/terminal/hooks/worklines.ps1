# ServiceKit Terminal - worklines check, a Claude Code SessionStart hook (registered in <kit>\data\claude\settings.json).
# In a repo's MAIN checkout it flags (1) uncommitted files changed in the last 3 hours and (2) other Claude transcripts
# written in the last 30 minutes in the same folder or a parent folder. If either fires it asks Claude to move into a
# new worktree before editing. Silent in a linked worktree or outside git; never blocks (always exit 0).
# Standalone on purpose (no kit library): it runs at every session start. PowerShell 5.1, ASCII only.

# Claude Code names a project folder by replacing every non-alphanumeric character of the path with '-'.
function Get-TermSanitizedName([string]$Path) { return ([string]$Path -replace '[^A-Za-z0-9]', '-') }

# A transcript folder counts when it is the same folder or a parent: the child name starts with the parent name and the
# next character is '-', or the parent name already ends in '-'.
function Test-TermProjectMatch([string]$ProjectName, [string]$Sanitized) {
    if (-not $ProjectName -or -not $Sanitized) { return $false }
    if ($ProjectName -eq $Sanitized) { return $true }
    if ($Sanitized.Length -le $ProjectName.Length) { return $false }
    if (-not $Sanitized.StartsWith($ProjectName, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
    if ($ProjectName.EndsWith('-')) { return $true }
    return ($Sanitized[$ProjectName.Length] -eq '-')
}

# Pure: the hook output for the findings, or $null when there is nothing to say.
function Get-TermWorklinesOutput($RecentFiles, $OtherSessions) {
    $rf = @($RecentFiles | Where-Object { $_ }); $os = @($OtherSessions | Where-Object { $_ })
    if ($rf.Count -eq 0 -and $os.Count -eq 0) { return $null }
    $parts = @()
    if ($rf.Count -gt 0) { $parts += ('' + $rf.Count + ' uncommitted file(s) changed in the last 3 hours: ' + (($rf | Select-Object -First 8) -join ', ')) }
    if ($os.Count -gt 0) { $parts += ('' + $os.Count + ' other Claude session(s) wrote here in the last 30 minutes: ' + (($os | Select-Object -First 5) -join ', ')) }
    $ctx = 'WORKLINES: this is the main checkout and someone else may be working in it. ' + ($parts -join ' ') +
        ' Move into a new worktree before editing (git worktree add .claude/worktrees/<task> -b wt/<task> HEAD); do not touch the main checkout.'
    return @{
        hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $ctx }
        systemMessage = ('Worklines: ' + ($parts -join ' | ') + ' - use a worktree for this task.')
    }
}

function ConvertTo-TermAsciiJson($Obj) {
    $j = ConvertTo-Json -InputObject $Obj -Depth 6 -Compress
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $j.ToCharArray()) { if ([int]$ch -lt 128) { [void]$sb.Append($ch) } else { [void]$sb.Append(('\u{0:x4}' -f [int]$ch)) } }
    return $sb.ToString()
}

function Invoke-TermGitLines([string]$Cwd, [string[]]$ArgList) {
    $out = & git -C $Cwd @ArgList 2>$null
    if ($LASTEXITCODE -ne 0) { return }
    foreach ($o in @($out)) { [string]$o }
}

function Get-TermWorklinesFindings([string]$Cwd, [string]$SessionId, [string[]]$ProjectRoots, [datetime]$Now) {
    $res = @{ applies = $false; recent = @(); others = @() }
    $gd = @(Invoke-TermGitLines $Cwd @('rev-parse', '--absolute-git-dir'))
    $cd = @(Invoke-TermGitLines $Cwd @('rev-parse', '--path-format=absolute', '--git-common-dir'))
    if ($gd.Count -eq 0 -or $cd.Count -eq 0) { return $res }
    $norm = { param($p) ([IO.Path]::GetFullPath(([string]$p).Trim())).TrimEnd('\', '/').ToLower() }
    if ((& $norm $gd[0]) -ne (& $norm $cd[0])) { return $res }   # linked worktree: silent
    $res['applies'] = $true
    $top = @(Invoke-TermGitLines $Cwd @('rev-parse', '--show-toplevel'))
    if ($top.Count -gt 0) {
        $root = ([string]$top[0]).Trim()
        foreach ($l in @(Invoke-TermGitLines $Cwd @('status', '--porcelain', '-uall'))) {
            if (-not $l -or $l.Length -lt 4) { continue }
            $p = $l.Substring(3)
            $ix = $p.IndexOf(' -> '); if ($ix -ge 0) { $p = $p.Substring($ix + 4) }
            $p = $p.Trim('"')
            $full = Join-Path $root $p
            if ((Test-Path -LiteralPath $full -PathType Leaf) -and (Get-Item -LiteralPath $full).LastWriteTime -ge $Now.AddHours(-3)) { $res['recent'] += $p }
        }
    }
    $san = Get-TermSanitizedName ([IO.Path]::GetFullPath($Cwd).TrimEnd('\', '/'))
    foreach ($pr in $ProjectRoots) {
        if (-not $pr -or -not (Test-Path -LiteralPath $pr)) { continue }
        foreach ($d in @(Get-ChildItem -LiteralPath $pr -Directory -ErrorAction SilentlyContinue)) {
            if (-not (Test-TermProjectMatch $d.Name $san)) { continue }
            foreach ($f in @(Get-ChildItem -LiteralPath $d.FullName -Filter '*.jsonl' -File -ErrorAction SilentlyContinue)) {
                if ($f.BaseName -eq $SessionId) { continue }
                if ($f.LastWriteTime -ge $Now.AddMinutes(-30)) { $res['others'] += ($d.Name + '/' + $f.BaseName.Substring(0, [Math]::Min(8, $f.BaseName.Length))) }
            }
        }
    }
    return $res
}

function Invoke-TermWorklinesHook {
    try {
        $raw = [Console]::In.ReadToEnd()
        $in = $null; if ($raw) { $in = ConvertFrom-Json -InputObject $raw }
        $cwd = ''; $sid = ''
        if ($in) { $cwd = [string]$in.cwd; $sid = [string]$in.session_id }
        if (-not $cwd) { $cwd = (Get-Location).Path }
        $roots = @()
        if ($env:CLAUDE_CONFIG_DIR) { $roots += (Join-Path $env:CLAUDE_CONFIG_DIR 'projects') }
        if ($env:USERPROFILE) { $roots += (Join-Path $env:USERPROFILE '.claude\projects') }
        $roots = @($roots | Select-Object -Unique)
        $f = Get-TermWorklinesFindings $cwd $sid $roots (Get-Date)
        if (-not $f['applies']) { exit 0 }
        $o = Get-TermWorklinesOutput $f['recent'] $f['others']
        if ($o) { [Console]::Out.Write((ConvertTo-TermAsciiJson $o)) }
    } catch { }
    exit 0
}

if ($MyInvocation.InvocationName -ne '.') { Invoke-TermWorklinesHook }
