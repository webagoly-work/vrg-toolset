# ServiceKit Terminal - the phone gate: disclosure banner, GitHub device flow, access-log issue, deny poller, wipe.
# Nothing here stores, replays or bypasses an approval: GitHub's device flow and Claude Code's own /login do the
# signing in, and the owner approves both on their phone. Dot-source after lib.ps1. PowerShell 5.1, ASCII only.

# ---------------------------------------------------------------- facts for the access log (pure formatting below)
function Get-TermLocalIPv4 {
    $r = @()
    try {
        foreach ($a in @(Get-WmiObject Win32_NetworkAdapterConfiguration -Filter 'IPEnabled = TRUE' -ErrorAction Stop)) {
            foreach ($ip in @($a.IPAddress)) { if ($ip -match '^\d+\.\d+\.\d+\.\d+$' -and $ip -notmatch '^127\.') { $r += $ip } }
        }
    } catch {
        try { foreach ($ip in [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName())) { if ($ip.AddressFamily -eq 'InterNetwork') { $r += $ip.ToString() } } } catch { }
    }
    return @($r | Select-Object -Unique)
}

function Get-TermAccessFacts($Prof, [string]$Folder, [bool]$Trusted) {
    $os = Get-KitOS
    $now = Get-Date
    $tz = ''
    try { $tz = [System.TimeZoneInfo]::Local.Id } catch { }
    $f = @{
        utc = $now.ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + 'Z'
        local = $now.ToString('yyyy-MM-dd HH:mm:ss')
        tz = $tz
        computer = [Environment]::MachineName
        user = ([Environment]::UserDomainName + '\' + [Environment]::UserName)
        os = ([string]$os['name'] + ' (build ' + $os['build'] + ')')
        ipv4 = @(Get-TermLocalIPv4)
        kit = $KitRoot
        folder = $Folder
        trusted = $Trusted
        version = $TermVersion
        publicIp = ''
    }
    if ($Prof['publicIp'] -and $Prof['publicIpService']) {
        try { $f['publicIp'] = ([string](Get-KitWebString $Prof['publicIpService'])).Trim() } catch { $f['publicIp'] = 'lookup failed' }
    }
    return $f
}

function Format-TermAccessTitle($F) {
    return ('Access ' + $F['computer'] + ' ' + ([string]$F['utc']).Substring(0, 16) + 'Z')
}

function Format-TermMdCell([string]$S) { return ([string]$S).Replace('|', '\|').Replace("`r", ' ').Replace("`n", ' ') }

function Format-TermAccessBody($F) {
    $mode = 'ephemeral'; if ($F['trusted']) { $mode = 'TRUSTED (credentials kept on this PC)' }
    $rows = @(
        @('Time (UTC)', $F['utc']), @('Time (local)', ([string]$F['local'] + ' ' + $F['tz'])), @('Computer', $F['computer']),
        @('Windows user', $F['user']), @('OS', $F['os']), @('Local IPv4', (@($F['ipv4']) -join ', ')),
        @('Kit path', $F['kit']), @('Folder', $F['folder']), @('Mode', $mode), @('Launcher', ('ServiceKit Terminal ' + $F['version']))
    )
    if ($F['publicIp']) { $rows += ,@('Public IP', $F['publicIp']) }
    $lines = @('ServiceKit Terminal access.', '', '| | |', '|---|---|')
    foreach ($r in $rows) { $lines += ('| ' + $r[0] + ' | ' + (Format-TermMdCell ([string]$r[1])) + ' |') }
    $lines += ''
    $lines += 'To end this session: add the label `deny`, or comment `/deny`. Only comments by the owner count.'
    return ($lines -join "`n")
}

# Pure: does the issue tell this session to stop (or, with D6, to go)? Only the owner's comments count;
# labels can only be set by people with write or triage access to the private repo.
function Test-TermDenySignal($Issue, $Comments, [string]$Owner) {
    $r = @{ deny = $false; allow = $false; by = ''; reason = '' }
    foreach ($l in @(Get-Key $Issue 'labels' @())) {
        $n = ''; if ($l -is [System.Collections.IDictionary]) { $n = [string](Get-Key $l 'name' '') } else { $n = [string]$l }
        if ($n.ToLower() -eq 'deny') { $r['deny'] = $true; $r['reason'] = 'label'; return $r }
    }
    foreach ($c in @($Comments)) {
        $u = Get-Key $c 'user' $null
        $login = [string](Get-Key $u 'login' '')
        if (-not $Owner -or $login.ToLower() -ne $Owner.ToLower()) { continue }
        $body = ([string](Get-Key $c 'body' '')).Trim()
        if ($body -match '^/deny(\s|$)') { $r['deny'] = $true; $r['by'] = $login; $r['reason'] = 'comment'; return $r }
        if ($body -match '^/allow(\s|$)') { $r['allow'] = $true; $r['by'] = $login }
    }
    return $r
}

# ---------------------------------------------------------------- gh (GitHub CLI) in the kit's config dir
function Get-TermGh {
    foreach ($c in @((Join-Path $ToolsDir 'gh\bin\gh.exe'), (Join-Path $ToolsDir 'gh\gh.exe'))) { if (Test-Path -LiteralPath $c) { return $c } }
    $g = Get-Command 'gh.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($g) { return $g.Source }
    return $null
}

function Set-TermGhEnv([string]$GhDir) {
    if (-not (Test-Path -LiteralPath $GhDir)) { New-Item -ItemType Directory -Path $GhDir -Force | Out-Null }
    $env:GH_CONFIG_DIR = $GhDir
    # A token in the PC's environment would override the kit's config and skip the phone approval.
    $env:GH_TOKEN = ''; $env:GITHUB_TOKEN = ''; $env:GH_ENTERPRISE_TOKEN = ''
    $env:GH_PROMPT_DISABLED = ''
    $env:GH_NO_UPDATE_NOTIFIER = '1'
    # No browser opens on this PC: the owner enters the code on the phone. The URL is appended to a no-op.
    $env:GH_BROWSER = 'cmd.exe /c rem'
    $env:GIT_CONFIG_GLOBAL = Join-Path $DataDir 'home\.gitconfig'
    $h = Join-Path $DataDir 'home'; if (-not (Test-Path -LiteralPath $h)) { New-Item -ItemType Directory -Path $h -Force | Out-Null }
}

# gh api call; the request body goes through a file, never through the command line. Returns parsed JSON or $null.
function Invoke-TermGhApi([string]$Gh, [string]$Method, [string]$Endpoint, $Body) {
    $argl = @('api', '-X', $Method, $Endpoint)
    $tmp = $null
    if ($null -ne $Body) {
        $tmp = Join-Path $StateDir ('gh-body-' + [Guid]::NewGuid().ToString('N') + '.json')
        Write-KitText $tmp (ConvertTo-KitJson $Body)
        $argl += @('--input', $tmp)
    }
    try {
        $r = Invoke-TermExe $Gh $argl 30
    } finally { if ($tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue } }
    if ($r['code'] -ne 0) { Write-KitLog ('gh api ' + $Method + ' ' + $Endpoint + ' failed: ' + $r['err']) 'WARN' | Out-Null; return $null }
    if (-not $r['out']) { return @{} }
    try { return (ConvertFrom-KitJson $r['out']) } catch { return $null }
}

# Interactive device flow in this console. gh prints a one-time code; the owner types it at github.com/login/device
# on their phone and approves. The token is a file inside GH_CONFIG_DIR (D9), removed by the wipe.
function Start-TermGhLogin([string]$Gh) {
    Write-TermBoth 'ghDevice' 'Cyan'
    & $Gh auth login --hostname github.com --web --git-protocol https --insecure-storage
    return ($LASTEXITCODE -eq 0)
}

function Get-TermGhLogin([string]$Gh) {
    $u = Invoke-TermGhApi $Gh 'GET' 'user' $null
    if ($u) { return [string](Get-Key $u 'login' '') }
    return ''
}

function Stop-TermGhLogin([string]$Gh) {
    if ($Gh) { [void](Invoke-TermExe $Gh @('auth', 'logout', '--hostname', 'github.com') 20) }
}

# 'private' | 'public' | 'missing' | 'error'
function Get-TermRepoVisibility([string]$Gh, [string]$Repo) {
    $r = Invoke-TermExe $Gh @('api', ('repos/' + $Repo)) 20
    if ($r['code'] -ne 0) {
        if (([string]$r['err'] + [string]$r['out']) -match 'Not Found|404') { return 'missing' }
        return 'error'
    }
    try { $j = ConvertFrom-KitJson $r['out'] } catch { return 'error' }
    if ([bool](Get-Key $j 'private' $false)) { return 'private' }
    return 'public'
}

function New-TermAccessRepo([string]$Gh, [string]$Repo) {
    $r = Invoke-TermExe $Gh @('repo', 'create', $Repo, '--private', '--description', 'ServiceKit Terminal access log') 30
    return ($r['code'] -eq 0)
}

# ---------------------------------------------------------------- wipe
# What a wipe removes for a given set of config dirs. Pure.
function Get-TermWipeTargets($Dirs) {
    return @(
        (Join-Path $Dirs['claude'] '.credentials.json'),
        (Join-Path $Dirs['claude'] '.claude.json'),
        $Dirs['gh'],
        $TermLaunchFile,
        $TermBriefFile,
        $TermBriefQueue
    )
}

function Invoke-TermWipe($Dirs) {
    $done = @()
    foreach ($t in (Get-TermWipeTargets $Dirs)) {
        if (Test-Path -LiteralPath $t) {
            try { Remove-TermTree $t; $done += $t } catch { Write-KitLog ('wipe failed: ' + $t) 'WARN' | Out-Null }
        }
    }
    Remove-Item Env:\GH_CONFIG_DIR -ErrorAction SilentlyContinue
    return $done
}

# At start: a session left behind by a closed window or a crash is wiped now, unless this PC is trusted.
function Invoke-TermStaleWipe {
    $s = Read-TermSession
    $eph = Get-TermConfigDirs $false
    $left = @((Get-TermWipeTargets $eph) | Where-Object { Test-Path -LiteralPath $_ })
    if (-not $s -and $left.Count -eq 0) { return '' }
    if ($s) {
        $pidv = [int](Get-Key $s 'pid' 0)
        $alive = $false
        if ($pidv -gt 0) { $alive = [bool](Get-Process -Id $pidv -ErrorAction SilentlyContinue) }
        $sameMachine = ([string](Get-Key $s 'machine' '') -eq (Get-TermMachineId))
        if ($alive -and $sameMachine) { return '' }
    }
    $done = @(Invoke-TermWipe $eph)
    Clear-TermSession
    return ($done -join ', ')
}

# ---------------------------------------------------------------- the Claude window
# A per-session .cmd (no secrets in it): Kit Shell environment, then this session's config dirs, then Claude.
function New-TermLaunchFile($Dirs, [string]$Folder, [string]$ClaudeExe, $Prof) {
    $lines = @(
        '@echo off',
        'rem ServiceKit Terminal session launcher (generated, deleted at the end of the session)',
        ('call "' + (Join-Path $CoreDir 'kitshell.cmd') + '"'),
        ('set "CLAUDE_CONFIG_DIR=' + $Dirs['claude'] + '"'),
        'rem The owner''s GitHub token stays with the launcher: Claude gets no gh config and no token variables.',
        'set "GH_CONFIG_DIR="',
        'set "GH_TOKEN="',
        'set "GITHUB_TOKEN="',
        ('set "SKT_SESSION=' + $TermSessionFile + '"')
    )
    if (-not $Dirs['trusted']) {
        # Ephemeral: git must not store a password in the PC's Credential Manager, which the wipe cannot reach.
        $lines += @('set "GIT_CONFIG_COUNT=1"', 'set "GIT_CONFIG_KEY_0=credential.helper"', 'set "GIT_CONFIG_VALUE_0="')
    }
    if ($Prof['extraCaCerts']) { $lines += ('set "NODE_EXTRA_CA_CERTS=' + $Prof['extraCaCerts'] + '"') }
    $lines += @(
        ('cd /d "' + $Folder + '"'),
        'title ServiceKit Terminal - Claude',
        ('call "' + $ClaudeExe + '"'),
        'if errorlevel 1 pause'
    )
    Write-TermCrlf $TermLaunchFile $lines
    return $TermLaunchFile
}

function Stop-TermProcessTree([int]$ProcId) {
    if ($ProcId -le 0) { return }
    try { [void](Invoke-TermExe (Join-Path $env:SystemRoot 'System32\taskkill.exe') @('/T', '/F', '/PID', [string]$ProcId) 20) } catch { }
}

function Get-TermGitHead([string]$Folder) {
    $git = Get-TermGit
    if (-not $git) { return '' }
    $r = Invoke-TermExe $git @('-C', $Folder, 'rev-parse', 'HEAD') 10
    if ($r['code'] -eq 0) { return [string]$r['out'] }
    return ''
}

# ---------------------------------------------------------------- the whole session
function Show-TermBanner($Prof) {
    Write-Term ''
    Write-TermBoth 'bannerTitle' 'Yellow'
    foreach ($lang in @('hu', 'en')) {
        $old = $script:TermLang; Set-TermLang $lang
        $col = 'White'; if ($lang -eq 'en') { $col = 'DarkGray' }
        Write-Term ([string]::Format((TT 'bannerWhat'), $Prof['accessRepo'], $Prof['githubUser'])) $col
        if ($Prof['publicIp']) { Write-Term ([string]::Format((TT 'bannerPublicIp'), $Prof['publicIpService'])) $col }
        Write-Term ([string]::Format((TT 'bannerBriefs'), $Prof['briefMinutes'])) $col
        Write-Term (TT 'bannerDeny') $col
        Write-Term (TT 'bannerEnd') $col
        Write-Term ''
        Set-TermLang $old
    }
    return (Test-TermYes (Read-TermLine (TT 'bannerAsk')))
}

function Invoke-TermSession($Prof, $Claude, [string]$Folder, [bool]$Trusted) {
    $dirs = Get-TermConfigDirs $Trusted
    if (-not (Show-TermBanner $Prof)) { Write-Term ('  ' + (TT 'cancelled')) 'Yellow'; return }
    $gh = Get-TermGh
    if (-not $gh) { Write-TermBoth 'ghMissing' 'Red'; return }
    $old = Read-TermSession
    if ($old) {
        $op = [int](Get-Key $old 'pid' 0)
        if ($op -gt 0 -and (Get-Process -Id $op -ErrorAction SilentlyContinue)) { Write-TermBoth 'sessionAlive' 'Red'; return }
    }
    if (-not $Trusted) {
        # Ephemeral: never reuse a token, so every session needs the owner's approval on the phone.
        foreach ($t in @($dirs['gh'], (Join-Path $dirs['claude'] '.credentials.json'))) { if (Test-Path -LiteralPath $t) { Remove-TermTree $t } }
    }
    Set-TermGhEnv $dirs['gh']

    $issueNo = 0; $repo = $Prof['accessRepo']; $proc = $null; $ended = 'session ended'
    try {
        # 1. the owner approves this PC on the phone
        $login = Get-TermGhLogin $gh
        if (-not $login) {
            if (-not (Start-TermGhLogin $gh)) { Write-TermBoth 'ghFailed' 'Red'; return }
            $login = Get-TermGhLogin $gh
        }
        if (-not $login -or $login.ToLower() -ne ([string]$Prof['githubUser']).ToLower()) {
            Write-Term ([string]::Format((TT 'ghWrongUser'), $login, $Prof['githubUser'])) 'Red'
            Stop-TermGhLogin $gh
            return
        }
        # 2. the log repo must be private (D1)
        Write-Term ('  ' + (TT 'repoCheck') + ': ' + $repo) 'DarkGray'
        $vis = Get-TermRepoVisibility $gh $repo
        if ($vis -eq 'missing') {
            if (-not (Test-TermYes (Read-TermLine ([string]::Format((TT 'repoMissing'), $repo))))) { return }
            if (-not (New-TermAccessRepo $gh $repo)) { Write-Term (TT 'repoCreateFail') 'Red'; return }
            $vis = Get-TermRepoVisibility $gh $repo
        }
        if ($vis -ne 'private') { Write-TermBoth 'repoPublic' 'Red'; return }

        # 3. the access entry; GitHub Mobile notifies the owner
        $facts = Get-TermAccessFacts $Prof $Folder $Trusted
        $issue = Invoke-TermGhApi $gh 'POST' ('repos/' + $repo + '/issues') @{ title = (Format-TermAccessTitle $facts); body = (Format-TermAccessBody $facts) }
        if (-not $issue -or -not (Get-Key $issue 'number' $null)) { Write-TermBoth 'issueFail' 'Red'; return }
        $issueNo = [int]$issue['number']
        Write-Term ('  ' + (TT 'issueOk') + ': ' + (Get-Key $issue 'html_url' '')) 'Green'
        $since = (Get-Date).ToUniversalTime().AddMinutes(-1).ToString('yyyy-MM-ddTHH:mm:ssZ')

        # optional second approval (D6)
        if ($Prof['requireAllow']) {
            Write-Term ('  ' + (TT 'waitAllow')) 'Cyan'
            $until = (Get-Date).AddMinutes(10); $ok = $false
            while ((Get-Date) -lt $until) {
                $sig = Get-TermIssueSignal $gh $repo $issueNo $since $Prof['githubUser']
                if ($sig['deny']) { $ended = 'denied before start'; return }
                if ($sig['allow']) { $ok = $true; break }
                Start-Sleep -Seconds 10
            }
            if (-not $ok) { Write-Term ('  ' + (TT 'allowTimeout')) 'Yellow'; $ended = 'no /allow within 10 minutes'; return }
        }

        # 4. Claude in its own window, with the kit's config dir and hooks
        [void](Set-TermClaudeSettings $dirs['claude'])
        $head = Get-TermGitHead $Folder
        $launch = New-TermLaunchFile $dirs $Folder $Claude['path'] $Prof
        Write-TermBoth 'claudeLogin' 'Cyan'
        $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c ""' + $launch + '""') -WorkingDirectory $Folder -PassThru
        # If this launcher window is closed (no finally runs then), Windows ends Claude with it.
        $job = Add-TermKillOnClose $proc
        if (-not $job) { Write-TermBoth 'noKillOnClose' 'Yellow' }
        Write-TermSession @{
            pid = $proc.Id; machine = (Get-TermMachineId); repo = $repo; issue = $issueNo; owner = $Prof['githubUser']
            folder = $Folder; startHead = $head; trusted = $Trusted; briefMinutes = $Prof['briefMinutes']; launcher = $PID
            started = (Get-Date).ToUniversalTime().ToString('s') + 'Z'
        }

        # 5. watch: deny or Claude's exit
        Write-Term ([string]::Format((TT 'running'), $Prof['pollSeconds'])) 'Gray'
        $next = Get-Date
        while ($true) {
            if ($proc.HasExited) { break }
            Send-TermBriefQueue $gh $repo $issueNo
            if ((Get-Date) -ge $next) {
                $next = (Get-Date).AddSeconds([Math]::Max(15, [int]$Prof['pollSeconds']))
                $sig = Get-TermIssueSignal $gh $repo $issueNo $since $Prof['githubUser']
                if ($sig['deny']) {
                    Stop-TermProcessTree $proc.Id
                    $ended = 'DENIED by the owner (' + $sig['reason'] + '); logged out at ' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + 'Z'
                    $Trusted = $false
                    Write-Term ''
                    Write-TermBoth 'denied' 'Red'
                    break
                }
            }
            Start-Sleep -Seconds 2
        }
    } finally {
        # Runs on a normal end, on deny and on Ctrl+C. A closed window is caught by the next start (Invoke-TermStaleWipe).
        if ($proc -and -not $proc.HasExited) { Stop-TermProcessTree $proc.Id; if ($ended -eq 'session ended') { $ended = 'stopped from the launcher (Ctrl+C)' } }
        if ($issueNo -gt 0) {
            Start-Sleep -Seconds 2
            Send-TermBriefQueue $gh $repo $issueNo
            $wipeNote = 'credentials wiped'; if ($Trusted) { $wipeNote = 'trusted PC: credentials kept' }
            [void](Invoke-TermGhApi $gh 'POST' ('repos/' + $repo + '/issues/' + $issueNo + '/comments') @{ body = ($ended + '; ' + $wipeNote + '.') })
            if ($ended -match '^DENIED') { [void](Invoke-TermGhApi $gh 'PATCH' ('repos/' + $repo + '/issues/' + $issueNo) @{ state = 'closed' }) }
        }
        if ($Trusted) {
            Write-Term ('  ' + (TT 'keptTrusted')) 'Yellow'
            foreach ($t in @($TermLaunchFile, $TermBriefFile)) { Remove-Item -LiteralPath $t -Force -ErrorAction SilentlyContinue }
        } else {
            Stop-TermGhLogin $gh
            $done = @(Invoke-TermWipe $dirs)
            Write-Term ('  ' + (TT 'wiped') + ': ' + $done.Count) 'Green'
        }
        Clear-TermSession
        Remove-Item Env:\GH_CONFIG_DIR -ErrorAction SilentlyContinue
        Write-Term ('  ' + (TT 'ended')) 'Cyan'
    }
}

# Briefs written by the Claude hooks (which hold no GitHub token) wait in a queue; the launcher posts them.
function Send-TermBriefQueue([string]$Gh, [string]$Repo, [int]$No) {
    if ($No -le 0 -or -not (Test-Path -LiteralPath $TermBriefQueue)) { return }
    foreach ($f in @(Get-ChildItem -LiteralPath $TermBriefQueue -Filter '*.json' -File -ErrorAction SilentlyContinue | Sort-Object Name)) {
        $b = Read-KitJson $f.FullName $null
        $body = [string](Get-Key $b 'body' '')
        if ($body) { [void](Invoke-TermGhApi $Gh 'POST' ('repos/' + $Repo + '/issues/' + $No + '/comments') @{ body = $body }) }
        Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
    }
}

# A Windows job object with KILL_ON_JOB_CLOSE: the Claude window dies with this launcher even when its console is
# closed with the X (PowerShell runs no finally block then). Returns $null when it cannot be set up.
function Add-TermKillOnClose($Proc) {
    if (-not $TermIsWin) { return $null }
    try {
        if (-not ('SkTermJob' -as [type])) {
            Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SkTermJob {
    [StructLayout(LayoutKind.Sequential)] struct BASIC { public long a; public long b; public uint LimitFlags; public UIntPtr c; public UIntPtr d; public uint e; public UIntPtr f; public uint g; public uint h; }
    [StructLayout(LayoutKind.Sequential)] struct IOC { public ulong a, b, c, d, e, f; }
    [StructLayout(LayoutKind.Sequential)] struct EXT { public BASIC Basic; public IOC Io; public UIntPtr p1, p2, p3, p4; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr a, string n);
    [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr j, int c, ref EXT i, uint l);
    [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr j, IntPtr p);
    public static IntPtr Bind(IntPtr process) {
        IntPtr j = CreateJobObject(IntPtr.Zero, null);
        if (j == IntPtr.Zero) return IntPtr.Zero;
        EXT x = new EXT(); x.Basic.LimitFlags = 0x2000;
        if (!SetInformationJobObject(j, 9, ref x, (uint)Marshal.SizeOf(typeof(EXT)))) return IntPtr.Zero;
        if (!AssignProcessToJobObject(j, process)) return IntPtr.Zero;
        return j;
    }
}
'@
        }
        $h = [SkTermJob]::Bind($Proc.Handle)
        if ($h -eq [IntPtr]::Zero) { return $null }
        $script:TermJobHandle = $h
        return $h
    } catch { Write-KitLog ('kill-on-close: ' + $_.Exception.Message) 'WARN' | Out-Null; return $null }
}

# Issue + owner comments since the session started -> the deny / allow signal. A failed poll is not a deny.
function Get-TermIssueSignal([string]$Gh, [string]$Repo, [int]$No, [string]$Since, [string]$Owner) {
    $issue = Invoke-TermGhApi $Gh 'GET' ('repos/' + $Repo + '/issues/' + $No) $null
    $comments = Invoke-TermGhApi $Gh 'GET' ('repos/' + $Repo + '/issues/' + $No + '/comments?per_page=100&since=' + $Since) $null
    if (-not $issue) { return @{ deny = $false; allow = $false } }
    return (Test-TermDenySignal $issue @($comments) $Owner)
}
