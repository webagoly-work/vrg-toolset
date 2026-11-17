# ServiceKit Terminal shared library. Dot-source it:  . (Join-Path $TermDir 'lib.ps1')
# Windows PowerShell 5.1 compatible (no ??, ?., ternary, && / ||). ASCII only: Hungarian text is in text.json.
# Console output goes through Write-Term, which folds accents to ASCII.

if (-not $TermDir) { $TermDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$CoreDir = Join-Path (Split-Path -Parent $TermDir) 'core'
. (Join-Path $CoreDir 'kit.ps1')

$TermVersion     = '0.1.0'
$TermSessionFile = Join-Path $StateDir 'terminal-session.json'
$TermTrustFile   = Join-Path $StateDir 'terminal-trust.json'
$TermLaunchFile  = Join-Path $StateDir 'terminal-launch.cmd'
$TermBriefFile   = Join-Path $StateDir 'terminal-brief.txt'
$TermBriefQueue  = Join-Path $StateDir 'terminal-briefs'
$WorkspaceDir    = Join-Path $KitRoot 'workspace'
$TermReportsDir  = Join-Path $KitRoot 'reports'
$TermIsWin       = ([Environment]::OSVersion.Platform -eq 'Win32NT')

# ---------------------------------------------------------------- text
$script:TermText = $null
$script:TermLang = 'hu'

function Get-TermTextTable {
    if (-not $script:TermText) {
        $script:TermText = ConvertFrom-KitJson (Read-KitText (Join-Path $TermDir 'text.json'))
    }
    return $script:TermText
}

function Set-TermLang([string]$Lang) { if ($Lang -eq 'en' -or $Lang -eq 'hu') { $script:TermLang = $Lang } }

# One string in the current language; falls back to English, then to the key itself.
function TT([string]$Key) {
    $t = Get-TermTextTable
    $l = Get-Key $t $script:TermLang $null
    $v = Get-Key $l $Key $null
    if ($null -eq $v) { $v = Get-Key (Get-Key $t 'en' $null) $Key $Key }
    return [string]$v
}

# Both languages, Hungarian first (the ServiceKit convention).
function TB([string]$Key) {
    $t = Get-TermTextTable
    return @([string](Get-Key (Get-Key $t 'hu' $null) $Key $Key), [string](Get-Key (Get-Key $t 'en' $null) $Key $Key))
}

# Accents and typographic punctuation -> ASCII, so the console code page cannot garble them.
function ConvertTo-AsciiText([string]$Text) {
    if (-not $Text) { return '' }
    $s = $Text
    $pairs = @(
        @([string][char]0x2013, '-'), @([string][char]0x2014, '-'), @([string][char]0x2026, '...'),
        @([string][char]0x201E, '"'), @([string][char]0x201C, '"'), @([string][char]0x201D, '"'),
        @([string][char]0x2018, "'"), @([string][char]0x2019, "'"), @([string][char]0x00BB, '>>'),
        @([string][char]0x00AB, '<<'), @([string][char]0x2192, '->'), @([string][char]0x00B7, '-')
    )
    foreach ($p in $pairs) { $s = $s.Replace($p[0], $p[1]) }
    $n = $s.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $n.ToCharArray()) {
        $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
        if ($cat -eq [Globalization.UnicodeCategory]::NonSpacingMark) { continue }
        if ([int]$ch -lt 128) { [void]$sb.Append($ch) } else { [void]$sb.Append('?') }
    }
    return $sb.ToString()
}

function Write-Term([string]$Text, [string]$Color = 'Gray') {
    Write-Host (ConvertTo-AsciiText $Text) -ForegroundColor $Color
}

# Hungarian line, then the English line dimmed.
function Write-TermBoth([string]$Key, [string]$Color = 'Gray') {
    $b = TB $Key
    Write-Term $b[0] $Color
    Write-Term ('  ' + $b[1]) 'DarkGray'
}

function Read-TermLine([string]$Prompt) {
    return (Read-Host (ConvertTo-AsciiText $Prompt))
}

function Test-TermYes([string]$Answer) { return ($Answer -match '^\s*(i|igen|y|yes)\s*$') }

# ---------------------------------------------------------------- profile (no secrets, ever)
function Get-TermProfile {
    $p = Read-KitJson (Join-Path $TermDir 'profile.json') $null
    if (-not $p) { $p = Read-KitJson (Join-Path $TermDir 'profile.example.json') @{} }
    $user = [string](Get-Key $p 'githubUser' '')
    $repo = [string](Get-Key $p 'accessRepo' '')
    if (-not $repo -and $user) { $repo = $user + '/vrg-access-log' }
    return @{
        githubUser      = $user
        accessRepo      = $repo
        displayName     = [string](Get-Key $p 'displayName' $user)
        lang            = [string](Get-Key $p 'lang' 'hu')
        publicIp        = [bool](Get-Key $p 'publicIp' $false)
        publicIpService = [string](Get-Key $p 'publicIpService' 'https://api.ipify.org')
        briefMinutes    = [int](Get-Key $p 'briefMinutes' 30)
        requireAllow    = [bool](Get-Key $p 'requireAllow' $false)
        pollSeconds     = [int](Get-Key $p 'pollSeconds' 60)
        extraCaCerts    = [string](Get-Key $p 'extraCaCerts' '')
    }
}

# A profile is usable when the owner and the log repo look like real GitHub names.
function Test-TermProfile($P) {
    if (-not $P) { return $false }
    if ([string]$P['githubUser'] -notmatch '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$') { return $false }
    if ([string]$P['accessRepo'] -notmatch '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$') { return $false }
    return $true
}

# ---------------------------------------------------------------- this PC
function Get-TermMachineId {
    if ($TermIsWin) {
        try {
            $g = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop).MachineGuid
            if ($g) { return [string]$g }
        } catch { }
    }
    return ('name:' + [Environment]::MachineName)
}

function Get-TermTrust {
    $t = Read-KitJson $TermTrustFile @{}
    $id = Get-TermMachineId
    return [bool](Get-Key $t $id $null)
}

function Set-TermTrust([bool]$On) {
    $t = Read-KitJson $TermTrustFile @{}
    $id = Get-TermMachineId
    if ($On) { $t[$id] = @{ name = [Environment]::MachineName; since = (Get-Date).ToUniversalTime().ToString('s') + 'Z' } }
    elseif ($t.ContainsKey($id)) { $t.Remove($id) }
    Write-KitJson $TermTrustFile $t
}

# Ephemeral credentials stay in the kit and are wiped; trusted ones live on this PC, never on the stick (D8).
function Get-TermConfigDirs([bool]$Trusted) {
    if ($Trusted) {
        $base = $env:LOCALAPPDATA
        if (-not $base) { $base = Join-Path $DataDir 'trusted-fallback' }
        $root = Join-Path $base 'ServiceKitTerminal'
        return @{ claude = (Join-Path $root 'claude'); gh = (Join-Path $root 'gh'); trusted = $true }
    }
    return @{ claude = (Join-Path $DataDir 'claude'); gh = (Join-Path $DataDir 'gh'); trusted = $false }
}

# ---------------------------------------------------------------- session state (no secrets)
function Read-TermSession { return (Read-KitJson $TermSessionFile $null) }
function Write-TermSession($S) { Write-KitJson $TermSessionFile $S }
function Clear-TermSession { if (Test-Path -LiteralPath $TermSessionFile) { Remove-Item -LiteralPath $TermSessionFile -Force -ErrorAction SilentlyContinue } }

# Deletes a file or a folder tree without following junctions or symlinks (PowerShell 5.1's Remove-Item -Recurse
# can walk into a junction and delete its target): folders go through cmd's rmdir, which removes the link only.
function Remove-TermTree([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    if (Test-Path -LiteralPath $Path -PathType Container) {
        if ($TermIsWin) {
            [void](Invoke-TermExe (Join-Path $env:SystemRoot 'System32\cmd.exe') @('/d', '/c', 'rmdir', '/s', '/q', $Path) 120)
            if (Test-Path -LiteralPath $Path) { throw ('could not delete ' + $Path) }
            return
        }
    }
    Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
}

# ---------------------------------------------------------------- tools
function Get-TermGit {
    foreach ($c in @((Join-Path $ToolsDir 'portablegit\cmd\git.exe'), (Join-Path $ToolsDir 'portablegit\bin\git.exe'))) {
        if (Test-Path -LiteralPath $c) { return $c }
    }
    $g = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($g) { return $g.Source }
    return $null
}

# Runs a program and returns @{ code; out } within a time limit; never throws.
function Invoke-TermExe([string]$Exe, [string[]]$ArgList, [int]$TimeoutSec = 10, [string]$Cwd = '') {
    $r = @{ code = -1; out = ''; timedOut = $false }
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $Exe
        $psi.Arguments = (($ArgList | ForEach-Object { ConvertTo-TermArg $_ }) -join ' ')
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        if ($Cwd) { $psi.WorkingDirectory = $Cwd }
        $p = [System.Diagnostics.Process]::Start($psi)
        $so = $p.StandardOutput.ReadToEndAsync()
        $se = $p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit($TimeoutSec * 1000)) {
            try { $p.Kill() } catch { }
            $r['timedOut'] = $true
            return $r
        }
        $r['code'] = $p.ExitCode
        $r['out'] = ([string]$so.Result).Trim()
        $r['err'] = ([string]$se.Result).Trim()
    } catch { $r['err'] = $_.Exception.Message }
    return $r
}

# Quotes one argument the way the Windows C runtime parses it.
function ConvertTo-TermArg([string]$A) {
    if ($null -eq $A) { return '""' }
    if ($A -ne '' -and $A -notmatch '[\s"]') { return $A }
    $s = [regex]::Replace($A, '(\\*)"', '$1$1\"')
    $s = [regex]::Replace($s, '(\\+)$', '$1$1')
    return '"' + $s + '"'
}

# First version-looking token of a program's --version output.
function Get-TermVersion([string]$Exe, [string]$Arg = '--version') {
    $r = Invoke-TermExe $Exe @($Arg) 8
    $m = [regex]::Match(([string]$r['out'] + ' ' + [string]$r['err']), '\d+\.\d+(\.\d+)?([.-][0-9A-Za-z]+)?')
    if ($m.Success) { return $m.Value }
    return ''
}

function Write-TermCrlf([string]$Path, [string[]]$Lines) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, (($Lines -join "`r`n") + "`r`n"), $enc)
}

# ---------------------------------------------------------------- Claude settings in the kit's config dir
# Registers the kit hooks (worklines, briefs) and worktree.baseRef; keeps every other setting and hook.
function Set-TermClaudeSettings([string]$ConfigDir) {
    if (-not (Test-Path -LiteralPath $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }
    $file = Join-Path $ConfigDir 'settings.json'
    $s = Read-KitJson $file @{}
    $hooks = Get-Key $s 'hooks' $null
    if (-not ($hooks -is [System.Collections.IDictionary])) { $hooks = @{} }
    $ps = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File '
    $hd = Join-Path $TermDir 'hooks'
    $mine = @{
        SessionStart = ($ps + '"' + (Join-Path $hd 'worklines.ps1') + '"')
        Stop         = ($ps + '"' + (Join-Path $hd 'brief.ps1') + '" -Event Stop')
        SessionEnd   = ($ps + '"' + (Join-Path $hd 'brief.ps1') + '" -Event SessionEnd')
    }
    foreach ($ev in @('SessionStart', 'Stop', 'SessionEnd')) {
        $keep = @()
        foreach ($g in @(Get-Key $hooks $ev @())) {
            $isMine = $false
            foreach ($h in @(Get-Key $g 'hooks' @())) { if ([string](Get-Key $h 'command' '') -match 'terminal[\\/]+hooks[\\/]+') { $isMine = $true } }
            if (-not $isMine) { $keep += ,$g }
        }
        $keep += ,@{ hooks = @(@{ type = 'command'; command = $mine[$ev]; timeout = 60 }) }
        $hooks[$ev] = $keep
    }
    $s['hooks'] = $hooks
    $wt = Get-Key $s 'worktree' $null
    if (-not ($wt -is [System.Collections.IDictionary])) { $wt = @{} }
    $wt['baseRef'] = 'head'
    $s['worktree'] = $wt
    Write-KitJson $file $s
    return $file
}
