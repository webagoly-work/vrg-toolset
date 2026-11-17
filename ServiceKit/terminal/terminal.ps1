<#
  ServiceKit Terminal - portable Claude Code launcher with a phone gate.
  Started by TERMINAL.cmd the START.cmd way (process-scoped -ExecutionPolicy Bypass; the machine policy is never changed).

  terminal.ps1                     menu
  terminal.ps1 -Checks T0,T2       run these read-only checks, open the report, exit (used by the Dashboard)
  terminal.ps1 -Action installs    open one screen directly: claude | checks | installs | workshop | sandbox
  terminal.ps1 -Lang en

  Windows PowerShell 5.1 compatible. ASCII only; text is in text.json.
#>
param(
    [string]$Lang = '',
    [string]$Checks = '',
    [string]$Action = '',
    [switch]$NoMenu
)

$TermDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $TermDir 'lib.ps1')
. (Join-Path $TermDir 'detect.ps1')
foreach ($m in @('gate.ps1', 'ledger.ps1', 'recommend.ps1', 'checks\run.ps1', 'vm\wsb.ps1')) {
    $f = Join-Path $TermDir $m
    if (Test-Path -LiteralPath $f) { . $f }
}
$ErrorActionPreference = 'Continue'

$Prof = Get-TermProfile
if ($Lang) { Set-TermLang $Lang } else { Set-TermLang $Prof['lang'] }
try { $Host.UI.RawUI.WindowTitle = 'ServiceKit Terminal' } catch { }

function Test-TermHas([string]$Fn) { return [bool](Get-Command $Fn -CommandType Function -ErrorAction SilentlyContinue) }

function Wait-TermKey { [void](Read-TermLine (TT 'pressEnter')) }

# Version checks start each claude binary, so the menu keeps the list until something may have changed it.
$script:TermInstalls = $null
function Get-TermInstallsCached([switch]$Refresh) {
    if ($Refresh -or $null -eq $script:TermInstalls) { $script:TermInstalls = @(Find-TermClaudeInstalls) }
    return ,$script:TermInstalls
}

# ---------------------------------------------------------------- header
function Show-TermHeader($Installs) {
    $os = Get-KitOS
    Clear-Host
    Write-Term ('  ServiceKit Terminal ' + $TermVersion + '   ' + [Environment]::MachineName + ' \ ' + [Environment]::UserName) 'Cyan'
    $adm = TT 'no'; if ($os['admin']) { $adm = TT 'yes' }
    Write-Term ('  ' + $os['name'] + '   PowerShell ' + $os['ps'] + '   admin: ' + $adm) 'DarkGray'
    Write-Term ''
    if ($Installs.Count -eq 0) { Write-Term ('  ' + (TT 'claudeNone')) 'Yellow' }
    foreach ($i in $Installs) {
        $v = $i['version']; if (-not $v) { $v = '?' }
        $tag = TT ('src_' + $i['source'])
        $col = 'Gray'; if (-not $i['cli']) { $col = 'DarkGray' }
        Write-Term ('  Claude: ' + $tag + '  ' + $v + '  ' + $i['path']) $col
    }
    if (Test-TermProfile $Prof) {
        Write-Term ('  ' + (TT 'profileOk') + ': ' + $Prof['githubUser'] + '  ->  ' + $Prof['accessRepo']) 'Gray'
    } else { Write-Term ('  ' + (TT 'profileMissing')) 'Yellow' }
    $tr = TT 'trustOff'; $tc = 'Gray'; if (Get-TermTrust) { $tr = TT 'trustOn'; $tc = 'Yellow' }
    Write-Term ('  ' + $tr) $tc
    Write-Term ''
}

# ---------------------------------------------------------------- folder choice (P1)
function Select-TermFolder {
    while ($true) {
        Write-Term ('  ' + (TT 'folderTitle')) 'Cyan'
        $sf = @(Get-TermSessionFolders (Get-TermProjectRoots) 9)
        if ($sf.Count -eq 0) { Write-Term ('   ' + (TT 'folderNoRecent')) 'DarkGray' }
        for ($i = 0; $i -lt $sf.Count; $i++) {
            $e = $sf[$i]
            $miss = ''; $col = 'Gray'
            if (-not $e['exists']) { $miss = '  (' + (TT 'missing') + ')'; $col = 'DarkGray' }
            Write-Term ('   ' + ($i + 1) + '  ' + $e['path'] + '   ' + $e['last'].ToString('yyyy-MM-dd HH:mm') + '  ' + $e['sessions'] + ' ' + (TT 'sessions') + $miss) $col
        }
        Write-Term ('   G  ' + (TT 'folderGit')) 'Gray'
        Write-Term ('   W  ' + (TT 'folderWorkspace')) 'Gray'
        Write-Term ('   B  ' + (TT 'folderBrowse')) 'Gray'
        Write-Term ('   ' + (TT 'enterBack')) 'DarkGray'
        $a = ([string](Read-TermLine (TT 'choice'))).Trim()
        if (-not $a) { return $null }
        if ($a -match '^\d$') {
            $n = [int]$a - 1
            if ($n -ge 0 -and $n -lt $sf.Count -and $sf[$n]['exists']) { return $sf[$n]['path'] }
            continue
        }
        switch ($a.ToUpper()) {
            'G' { $p = Select-TermGitRepo; if ($p) { return $p } }
            'W' {
                $name = Read-TermLine (TT 'workspaceName')
                $p = Get-TermWorkspacePath $name
                if (-not (Test-Path -LiteralPath $p)) {
                    New-Item -ItemType Directory -Path $p -Force | Out-Null
                    if (Test-TermHas 'Add-TermLedgerEntry') {
                        Add-TermLedgerEntry (Get-TermLedgerPath) @{ pkg = ('workspace:' + (Split-Path -Leaf $p)); kind = 'workspace'; paths = @('workspace\' + (Split-Path -Leaf $p)); source = 'terminal' } | Out-Null
                    }
                }
                return $p
            }
            'B' { $p = Select-TermBrowse; if ($p) { return $p } }
        }
    }
}

function Select-TermGitRepo {
    Write-Term ('  ' + (TT 'scanning')) 'DarkGray'
    $repos = @(Find-TermGitRepos (Get-TermRepoRoots) 5 20)
    if ($repos.Count -eq 0) { Write-Term ('  ' + (TT 'noRepos')) 'Yellow'; return $null }
    for ($i = 0; $i -lt $repos.Count; $i++) { Write-Term ('   ' + ($i + 1) + '  ' + $repos[$i]) 'Gray' }
    $a = ([string](Read-TermLine (TT 'choice'))).Trim()
    if ($a -match '^\d+$') { $n = [int]$a - 1; if ($n -ge 0 -and $n -lt $repos.Count) { return $repos[$n] } }
    return $null
}

function Select-TermBrowse {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        $d = New-Object System.Windows.Forms.FolderBrowserDialog
        $d.Description = ConvertTo-AsciiText (TT 'folderBrowse')
        if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { return $d.SelectedPath }
        return $null
    } catch {
        $p = ([string](Read-TermLine (TT 'typePath'))).Trim().Trim('"')
        if ($p -and (Test-Path -LiteralPath $p -PathType Container)) { return $p }
        return $null
    }
}

# The worktree question: a task name gives .claude\worktrees\<name> on wt/<name>; empty = the folder itself.
function Select-TermWorktree([string]$Folder) {
    if (-not (Test-TermGitRepo $Folder)) { return $Folder }
    Write-Term ''
    Write-TermBoth 'worktreeAsk' 'Cyan'
    $task = Read-TermLine (TT 'taskName')
    $plan = Invoke-TermWorktree $Folder $task
    if ($plan['mode'] -eq 'self') { Write-Term ('  ' + (TT 'worktreeSelf')) 'DarkGray'; return $Folder }
    if (-not $plan['ok']) { Write-Term ('  ' + (TT 'worktreeFail') + ': ' + $plan['error']) 'Red'; return $null }
    Write-Term ('  ' + (TT ('worktree_' + $plan['mode'])) + ': ' + $plan['path'] + '  [' + $plan['branch'] + ']') 'Green'
    return $plan['path']
}

# ---------------------------------------------------------------- 1: Claude
function Start-TermClaudeFlow {
    $installs = Get-TermInstallsCached
    $claude = Select-TermClaude $installs
    if (-not $claude) {
        Write-TermBoth 'claudeNoneOffer' 'Yellow'
        Wait-TermKey; return
    }
    if (-not (Test-TermProfile $Prof)) { Write-TermBoth 'profileHelp' 'Yellow'; Wait-TermKey; return }
    $folder = Select-TermFolder
    if (-not $folder) { return }
    $start = Select-TermWorktree $folder
    if (-not $start) { Wait-TermKey; return }
    if (-not (Test-TermHas 'Invoke-TermSession')) { Write-Term ('  ' + (TT 'gateMissing')) 'Red'; Wait-TermKey; return }
    Invoke-TermSession -Prof $Prof -Claude $claude -Folder $start -Trusted (Get-TermTrust)
    Wait-TermKey
}

# ---------------------------------------------------------------- 2: checks
function Start-TermChecks([string]$Tiers) {
    if (-not (Test-TermHas 'Invoke-TermTierChecks')) { Write-Term ('  ' + (TT 'notYet')) 'Yellow'; Wait-TermKey; return }
    if (-not $Tiers) {
        Write-Term ('  ' + (TT 'checksTitle')) 'Cyan'
        foreach ($t in @('T0', 'T1', 'T2', 'T3', 'T4')) { Write-Term ('   ' + $t.Substring(1) + '  ' + (TT ('tier_' + $t))) 'Gray' }
        Write-Term ('   A  ' + (TT 'all')) 'Gray'
        $a = ([string](Read-TermLine (TT 'tierPick'))).Trim()
        if (-not $a) { return }
        if ($a.ToUpper() -eq 'A') { $Tiers = 'T0,T1,T2,T3,T4' }
        else { $Tiers = ((($a -split '[,;\s]+') | Where-Object { $_ -match '^\d$' } | ForEach-Object { 'T' + $_ }) -join ',') }
    }
    $list = @(($Tiers -split '[,;\s]+') | ForEach-Object { $_.Trim().ToUpper() } | Where-Object { $_ -match '^T[0-4]$' })
    if ($list.Count -eq 0) { return }
    $res = Invoke-TermTierChecks $list
    foreach ($r in $res['results']) {
        Write-Term ''
        Write-Term ('  ' + $r['tier'] + '  ' + (TT ('tier_' + $r['tier']))) 'Cyan'
        foreach ($it in $r['items']) {
            $col = 'Gray'
            switch ([string]$it['status']) { 'ok' { $col = 'Green' } 'warn' { $col = 'Yellow' } 'bad' { $col = 'Red' } 'missing' { $col = 'Yellow' } }
            Write-Term ('   [' + $it['status'] + '] ' + $it['label'] + ': ' + $it['value']) $col
        }
    }
    $rec = @($res['recommendations'])
    if ($rec.Count -gt 0) {
        Write-Term ''
        Write-Term ('  ' + (TT 'recTitle')) 'Cyan'
        foreach ($x in $rec) { Write-Term ('   - ' + (Format-TermRecommendation $x)) 'Gray' }
    }
    Write-Term ''
    Write-Term ('  ' + (TT 'reportAt') + ': ' + $res['html']) 'DarkGray'
    if ($TermIsWin) { try { Start-Process $res['html'] } catch { } }
    if (-not $NoMenu) { Wait-TermKey }
}

# ---------------------------------------------------------------- 3: installs (ledger)
function Show-TermInstalls {
    if (-not (Test-TermHas 'Read-TermLedger')) { Write-Term ('  ' + (TT 'notYet')) 'Yellow'; Wait-TermKey; return }
    while ($true) {
        Clear-Host
        $path = Get-TermLedgerPath
        $rows = @(Read-TermLedger $path)
        Write-Term ('  ' + (TT 'installsTitle')) 'Cyan'
        if ($rows.Count -eq 0) { Write-Term ('   ' + (TT 'ledgerEmpty')) 'DarkGray' }
        for ($i = 0; $i -lt $rows.Count; $i++) {
            $r = $rows[$i]
            $p0 = ''; $ps = @(Get-Key $r 'paths' @()); if ($ps.Count -gt 0) { $p0 = [string]$ps[0] }
            $mb = Get-Key $r 'sizeMB' ''
            Write-Term ('   ' + ($i + 1) + '  [' + $r['kind'] + '] ' + $r['pkg'] + '  ' + $p0 + '  ' + $mb + ' MB  ' + (Get-Key $r 'time' '')) 'Gray'
        }
        Write-Term ''
        Write-Term ('  ' + (TT 'foundTitle')) 'Cyan'
        foreach ($f in @(Get-TermFoundOnPc)) { Write-Term ('   ' + $f) 'DarkGray' }
        Write-Term ''
        Write-Term ('  ' + (TT 'installsKeys')) 'Gray'
        $a = ([string](Read-TermLine (TT 'choice'))).Trim()
        if (-not $a) { return }
        $m = [regex]::Match($a, '^([OoFfUu])\s*([\d,\s]+)$')
        if ($m.Success) {
            $idx = @(($m.Groups[2].Value -split '[,\s]+') | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ - 1 } | Where-Object { $_ -ge 0 -and $_ -lt $rows.Count })
            $sel = @(); foreach ($n in $idx) { $sel += ,$rows[$n] }
            switch ($m.Groups[1].Value.ToUpper()) {
                'O' { foreach ($r in $sel) { Open-TermLedgerItem $r 'folder' } }
                'F' { foreach ($r in $sel) { Open-TermLedgerItem $r 'file' } }
                'U' { Invoke-TermUninstallUi $sel }
            }
            continue
        }
        if ($a.ToUpper() -eq 'X') { Invoke-TermFullUninstallUi; return }
    }
}

# Things on the PC the kit did not create: listed read-only, never deleted by the kit.
function Get-TermFoundOnPc {
    $r = @()
    foreach ($i in @(Find-TermClaudeInstalls -NoVersion)) { if (-not $i['kit']) { $r += ('Claude (' + $i['source'] + '): ' + $i['path']) } }
    foreach ($n in @('git.exe', 'node.exe', 'python.exe', 'gh.exe', 'code.cmd')) {
        $g = Get-Command $n -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($g -and -not ([string]$g.Source).ToLower().StartsWith($KitRoot.ToLower())) { $r += ($n + ': ' + $g.Source) }
    }
    if ($r.Count -eq 0) { $r += (TT 'foundNone') }
    return ,$r
}

function Invoke-TermUninstallUi($Sel) {
    $plan = @(Get-TermUninstallPlan $Sel $KitRoot)
    foreach ($s in $plan) {
        Write-Term ''
        Write-Term ('  ' + $s['pkg'] + ': ' + (Format-TermPlanStep $s)) 'White'
        if (-not $s['ok']) { Write-Term ('   ' + (TT 'planRefused') + ': ' + $s['reason']) 'Red'; continue }
        if (-not (Test-TermYes (Read-TermLine (TT 'confirmEach')))) { continue }
        $out = Invoke-TermPlanStep $s $KitRoot
        Write-Term ('   ' + $out) 'Green'
    }
    Wait-TermKey
}

function Invoke-TermFullUninstallUi {
    $plan = Get-TermFullUninstallPlan $KitRoot @(Read-TermLedger (Get-TermLedgerPath)) (Get-TermConfigDirs $true)
    Clear-Host
    Write-TermBoth 'fullTitle' 'Red'
    foreach ($p in $plan['delete']) { Write-Term ('   del  ' + $p) 'Gray' }
    foreach ($c in $plan['commands']) { Write-Term ('   cmd  ' + $c['pkg'] + ': ' + $c['command']) 'Gray' }
    Write-Term ('  ' + (TT 'fullKeeps')) 'DarkGray'
    foreach ($k in $plan['keep']) { Write-Term ('   keep ' + $k) 'DarkGray' }
    $a = ([string](Read-TermLine (TT 'fullConfirm'))).Trim()
    if ($a -ne 'TORLES' -and $a -ne 'DELETE') { Write-Term ('  ' + (TT 'cancelled')) 'Yellow'; Wait-TermKey; return }
    foreach ($c in $plan['commands']) {
        if (Test-TermYes (Read-TermLine ($c['pkg'] + ': ' + (TT 'confirmEach')))) { [void](Invoke-TermPlanStep $c $KitRoot) }
    }
    $done = Invoke-TermFullDelete $plan
    Write-Term ('  ' + (TT 'fullDone') + ': ' + $done) 'Green'
    Wait-TermKey
}

# ---------------------------------------------------------------- 4: Agent Workshop (P5)
function Show-TermWorkshop {
    $cat = Get-Catalog
    $inst = Get-Installed
    $pk = @(@($cat['packages']) | Where-Object { @(Get-Key $_ 'groups' @()) -contains 'agent-workshop' })
    Write-Term ('  ' + (TT 'workshopTitle')) 'Cyan'
    if ($pk.Count -eq 0) { Write-Term ('   ' + (TT 'notYet')) 'Yellow'; Wait-TermKey; return }
    $missing = @()
    foreach ($p in $pk) {
        $ok = $inst.ContainsKey([string]$p['id'])
        $st = TT 'missing'; $col = 'Yellow'
        if ($ok) { $st = TT 'installed'; $col = 'Green' } else { $missing += [string]$p['id'] }
        $ver = Get-Key $p 'version' ''
        Write-Term ('   ' + $p['name'] + '  ' + $ver + '  ' + $p['sizeMB'] + ' MB  [' + $st + ']') $col
    }
    if ($missing.Count -eq 0) { Write-Term ('  ' + (TT 'workshopAll')) 'Green'; Wait-TermKey; return }
    if (Test-TermYes (Read-TermLine ((TT 'workshopInstall') + ' (' + ($missing -join ', ') + ')'))) {
        $argl = '-NoProfile -ExecutionPolicy Bypass -File ' + (ConvertTo-TermArg (Join-Path $CoreDir 'setup.ps1')) + ' -NoGui -NoLaunch -Ids ' + ($missing -join ',')
        Start-Process -FilePath 'powershell.exe' -ArgumentList $argl -Wait
    }
    Wait-TermKey
}

# ---------------------------------------------------------------- 5: sandbox (P6)
function Start-TermSandboxUi {
    if (-not (Test-TermHas 'Start-TermSandbox')) { Write-Term ('  ' + (TT 'notYet')) 'Yellow'; Wait-TermKey; return }
    $st = Get-TermSandboxState
    if (-not $st['available']) {
        Write-TermBoth ('wsb_' + $st['reason']) 'Yellow'
        if ($st['enableCommand']) { Write-Term ''; Write-Term ('   ' + $st['enableCommand']) 'White' }
        Wait-TermKey; return
    }
    $net = Test-TermYes (Read-TermLine (TT 'wsbNetAsk'))
    $r = Start-TermSandbox $net
    Write-Term ('  ' + $r) 'Green'
    Wait-TermKey
}

function Start-TermKitShell {
    Start-Process -FilePath 'cmd.exe' -ArgumentList ('/k call ' + (ConvertTo-TermArg (Join-Path $CoreDir 'kitshell.cmd'))) -WorkingDirectory $KitRoot | Out-Null
}

# ---------------------------------------------------------------- main
function Invoke-TermMain {
    if (Test-TermHas 'Invoke-TermStaleWipe') {
        $w = Invoke-TermStaleWipe
        if ($w) { Write-Term ('  ' + (TT 'staleWiped') + ': ' + $w) 'Yellow' }
    }
    if ($Checks) { Start-TermChecks $Checks; return }
    switch ($Action.ToLower()) {
        'claude' { Start-TermClaudeFlow; return }
        'checks' { Start-TermChecks ''; return }
        'installs' { Show-TermInstalls; return }
        'workshop' { Show-TermWorkshop; return }
        'sandbox' { Start-TermSandboxUi; return }
    }
    while ($true) {
        Show-TermHeader (Get-TermInstallsCached)
        foreach ($k in @('m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'mT', 'mL', 'mQ')) { Write-Term ('   ' + (TT $k)) 'Gray' }
        $a = ([string](Read-TermLine (TT 'choice'))).Trim().ToUpper()
        switch ($a) {
            '1' { Start-TermClaudeFlow }
            '2' { Start-TermChecks '' }
            '3' { Show-TermInstalls }
            '4' { Show-TermWorkshop; [void](Get-TermInstallsCached -Refresh) }
            '5' { Start-TermSandboxUi }
            '6' { Start-TermKitShell }
            'T' {
                $on = -not (Get-TermTrust)
                if ($on) { Write-TermBoth 'trustWarn' 'Yellow'; if (-not (Test-TermYes (Read-TermLine (TT 'sure')))) { continue } }
                Set-TermTrust $on
            }
            'L' { if ($script:TermLang -eq 'hu') { Set-TermLang 'en' } else { Set-TermLang 'hu' } }
            'Q' { return }
        }
    }
}

if ($MyInvocation.InvocationName -ne '.') { Invoke-TermMain }
