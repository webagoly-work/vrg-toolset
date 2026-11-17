# ServiceKit Terminal - briefs, a Claude Code Stop / SessionEnd hook (registered in the kit's Claude settings).
# Comments on the session's access-log issue: repo, branch, worktree, commits since the session started, a diff
# summary and the uncommitted file count. NO prompt text and NO file contents. Stop is throttled (default 30 min);
# SessionEnd always posts. It never interrupts the person at the PC and never fails the session (always exit 0).
# Standalone on purpose (no kit library). PowerShell 5.1, ASCII only.
param([Alias('Event')][string]$HookEvent = 'Stop')

# Pure: is a brief due now? The session start counts as the last brief, so the first Stop waits the full interval.
function Test-TermBriefDue([string]$EventName, [string]$LastIso, [datetime]$Now, [int]$Minutes) {
    if ($EventName -eq 'SessionEnd') { return $true }
    if ($Minutes -le 0) { $Minutes = 30 }
    if (-not $LastIso) { return $true }
    $last = [datetime]::MinValue
    if (-not [datetime]::TryParse($LastIso, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal, [ref]$last)) { return $true }
    return (($Now.ToUniversalTime() - $last).TotalMinutes -ge $Minutes)
}

# Pure: the comment text. Commit subjects go in a code block so an @name in one never notifies anybody.
function Get-TermBriefText([string]$EventName, $Info, [string]$NowIso) {
    $title = 'Brief'; if ($EventName -eq 'SessionEnd') { $title = 'Brief (session end)' }
    $wt = [string]$Info['worktree']; if (-not $wt) { $wt = '-' }
    $commits = @($Info['commits'] | Where-Object { $_ })
    $lines = @(
        ('**' + $title + '** ' + $NowIso),
        '',
        ('- Repo: `' + ([string]$Info['repo']).Replace('`', "'") + '`'),
        ('- Branch: `' + ([string]$Info['branch']).Replace('`', "'") + '`   Worktree: `' + $wt.Replace('`', "'") + '`'),
        ('- Commits since start: ' + $commits.Count)
    )
    if ($commits.Count -gt 0) {
        $lines += '```'
        foreach ($c in ($commits | Select-Object -First 30)) { $lines += ([string]$c).Replace('`', "'") }
        if ($commits.Count -gt 30) { $lines += ('... and ' + ($commits.Count - 30) + ' more') }
        $lines += '```'
    }
    $stat = [string]$Info['diffstat']; if (-not $stat) { $stat = 'no changes' }
    $lines += ('- Changes since start: ' + $stat.Trim())
    $lines += ('- Uncommitted files: ' + [int]$Info['uncommitted'])
    return ($lines -join "`n")
}

function Invoke-TermGitOut([string]$Cwd, [string[]]$ArgList) {
    $out = & git -C $Cwd @ArgList 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return @($out)
}

function Get-TermBriefInfo([string]$Cwd, [string]$StartHead, [string]$StartedIso) {
    $i = @{ repo = ''; branch = ''; worktree = ''; commits = @(); diffstat = ''; uncommitted = 0 }
    $top = Invoke-TermGitOut $Cwd @('rev-parse', '--show-toplevel')
    if (-not $top) { $i['repo'] = $Cwd + ' (not a git repo)'; return $i }
    $i['repo'] = ([string]$top[0]).Trim()
    $b = Invoke-TermGitOut $Cwd @('rev-parse', '--abbrev-ref', 'HEAD'); if ($b) { $i['branch'] = ([string]$b[0]).Trim() }
    $gd = Invoke-TermGitOut $Cwd @('rev-parse', '--absolute-git-dir')
    $cd = Invoke-TermGitOut $Cwd @('rev-parse', '--path-format=absolute', '--git-common-dir')
    if ($gd -and $cd -and ([string]$gd[0]).Trim().ToLower() -ne ([string]$cd[0]).Trim().ToLower()) { $i['worktree'] = $i['repo'] }
    $base = $null
    if ($StartHead -and (Invoke-TermGitOut $Cwd @('cat-file', '-e', ($StartHead + '^{commit}'))) -ne $null) { $base = $StartHead }
    if ($base) {
        $i['commits'] = @(Invoke-TermGitOut $Cwd @('log', '--oneline', '-n', '200', ($base + '..HEAD')))
        $s = Invoke-TermGitOut $Cwd @('diff', '--shortstat', $base)
    } else {
        $i['commits'] = @(Invoke-TermGitOut $Cwd @('log', '--oneline', '-n', '200', ('--since=' + $StartedIso)))
        $s = Invoke-TermGitOut $Cwd @('diff', '--shortstat', 'HEAD')
    }
    if ($s) { $i['diffstat'] = (@($s) -join ' ') }
    $i['uncommitted'] = @(Invoke-TermGitOut $Cwd @('status', '--porcelain') | Where-Object { $_ }).Count
    return $i
}

function Invoke-TermBriefHook {
    try {
        $raw = ''
        try { $raw = [Console]::In.ReadToEnd() } catch { }
        $sf = $env:SKT_SESSION
        if (-not $sf -or -not (Test-Path -LiteralPath $sf)) { exit 0 }
        $s = ConvertFrom-Json -InputObject ([System.IO.File]::ReadAllText($sf))
        $bf = Join-Path (Split-Path -Parent $sf) 'terminal-brief.txt'
        $last = [string]$s.started
        if (Test-Path -LiteralPath $bf) { $last = ([System.IO.File]::ReadAllText($bf)).Trim() }
        $now = (Get-Date).ToUniversalTime()
        if (-not (Test-TermBriefDue $HookEvent $last $now ([int]$s.briefMinutes))) { exit 0 }
        $cwd = ''
        if ($raw) { try { $cwd = [string](ConvertFrom-Json -InputObject $raw).cwd } catch { } }
        if (-not $cwd) { $cwd = [string]$s.folder }
        $info = Get-TermBriefInfo $cwd ([string]$s.startHead) ([string]$s.started)
        $text = Get-TermBriefText $HookEvent $info ($now.ToString('yyyy-MM-dd HH:mm') + 'Z')
        $tmp = Join-Path (Split-Path -Parent $sf) ('terminal-brief-' + [Guid]::NewGuid().ToString('N') + '.json')
        $json = ConvertTo-Json -InputObject @{ body = $text } -Compress
        [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
        try {
            & ([string]$s.gh) api -X POST ('repos/' + [string]$s.repo + '/issues/' + [string]$s.issue + '/comments') --input $tmp 2>$null | Out-Null
        } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
        [System.IO.File]::WriteAllText($bf, $now.ToString('s') + 'Z')
    } catch { }
    exit 0
}

if ($MyInvocation.InvocationName -ne '.') { Invoke-TermBriefHook }
