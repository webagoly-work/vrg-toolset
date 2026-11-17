# ServiceKit Terminal - the ledger: every download, extract, install or folder the kit creates, in <kit>\state\ledger.json.
#   {id, pkg, kind: portable|installed|download|workspace, paths[], source, sha256, sizeMB, time, uninstall}
# Paths are stored relative to the kit root, because the drive letter of a stick changes between PCs.
# Uninstall only removes what the ledger recorded, inside the kit; things the kit did not create are never touched.
# Dot-sourced by terminal.ps1, server.ps1 and core\setup.ps1, so this file stays PowerShell 2.0-safe (Windows 7). ASCII only.

function Get-TermLedgerPath { return (Join-Path $StateDir 'ledger.json') }

function Read-TermLedger([string]$Path) {
    $d = Read-KitJson $Path $null
    if ($null -eq $d) { return ,@() }
    $rows = Get-Key $d 'rows' $null
    if ($null -eq $rows) { return ,@() }
    return ,@($rows)
}

function Write-TermLedger([string]$Path, $Rows) {
    Write-KitJson $Path @{ version = 1; rows = @($Rows) }
}

# Adds a row, or replaces the row of the same pkg + kind (a re-install updates it). Returns the row.
function Add-TermLedgerEntry([string]$Path, $Entry) {
    $rows = @(Read-TermLedger $Path)
    $pkg = [string](Get-Key $Entry 'pkg' '')
    $kind = [string](Get-Key $Entry 'kind' 'portable')
    $row = @{
        id = ($pkg + '@' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))
        pkg = $pkg; kind = $kind
        paths = @(Get-Key $Entry 'paths' @())
        source = [string](Get-Key $Entry 'source' '')
        sha256 = [string](Get-Key $Entry 'sha256' '')
        sizeMB = (Get-Key $Entry 'sizeMB' $null)
        time = ((Get-Date).ToUniversalTime().ToString('s') + 'Z')
        uninstall = [string](Get-Key $Entry 'uninstall' '')
    }
    $keep = @()
    foreach ($r in $rows) { if (-not ([string](Get-Key $r 'pkg' '') -eq $pkg -and [string](Get-Key $r 'kind' '') -eq $kind)) { $keep += ,$r } }
    $keep += ,$row
    Write-TermLedger $Path $keep
    return $row
}

function Remove-TermLedgerRow([string]$Path, [string]$Id) {
    $keep = @()
    foreach ($r in @(Read-TermLedger $Path)) { if ([string](Get-Key $r 'id' '') -ne $Id) { $keep += ,$r } }
    Write-TermLedger $Path $keep
}

function Get-TermFolderMB([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    $sum = 0
    foreach ($f in @(Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue)) { if (-not $f.PSIsContainer) { $sum += $f.Length } }
    return [Math]::Round($sum / 1MB, 1)
}

# ---------------------------------------------------------------- path rules (pure)
function Get-TermFullPath([string]$KitRoot, [string]$P) {
    if ([IO.Path]::IsPathRooted($P)) { return [IO.Path]::GetFullPath($P) }
    return [IO.Path]::GetFullPath((Join-Path $KitRoot $P))
}

function Test-TermPathInside([string]$Root, [string]$Path) {
    $sep = [string][IO.Path]::DirectorySeparatorChar
    $r = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/') + $sep
    $p = [IO.Path]::GetFullPath($Path).TrimEnd('\', '/') + $sep
    return ($p.Length -gt $r.Length -and $p.StartsWith($r, [System.StringComparison]::OrdinalIgnoreCase))
}

# Only these kit folders hold things the kit created; code folders are never a delete target.
$script:TermDeletableTop = @('tools', 'workspace', 'reports', 'data', 'envs', 'logs', 'state')

# A single ledger row may only remove something below one of those folders (tools\x, never tools itself).
function Test-TermDeletable([string]$KitRoot, [string]$Full) {
    if (-not (Test-TermPathInside $KitRoot $Full)) { return $false }
    $rel = [IO.Path]::GetFullPath($Full).Substring(([IO.Path]::GetFullPath($KitRoot).TrimEnd('\', '/')).Length).Trim('\', '/')
    $parts = @($rel -split '[\\/]' | Where-Object { $_ })
    if ($parts.Count -lt 2) { return $false }
    return ($script:TermDeletableTop -contains $parts[0].ToLower())
}

# ---------------------------------------------------------------- uninstall plan (pure)
function Get-TermUninstallPlan($Rows, [string]$KitRoot) {
    $plan = @()
    foreach ($r in @($Rows)) {
        if (-not $r) { continue }
        $kind = [string](Get-Key $r 'kind' '')
        $s = @{ id = [string](Get-Key $r 'id' ''); pkg = [string](Get-Key $r 'pkg' ''); kind = $kind; action = ''; paths = @(); command = ''; ok = $true; reason = '' }
        if ($kind -eq 'installed') {
            $s['action'] = 'command'
            $s['command'] = [string](Get-Key $r 'uninstall' '')
            if (-not $s['command']) { $s['ok'] = $false; $s['reason'] = 'no uninstall command was recorded' }
        } elseif ($kind -eq 'portable' -or $kind -eq 'workspace' -or $kind -eq 'download') {
            $s['action'] = 'delete'
            foreach ($p in @(Get-Key $r 'paths' @())) {
                $full = Get-TermFullPath $KitRoot ([string]$p)
                if (-not (Test-TermDeletable $KitRoot $full)) { $s['ok'] = $false; $s['reason'] = 'outside the kit folders it may delete: ' + $full }
                $s['paths'] += $full
            }
            if ($s['paths'].Count -eq 0) { $s['action'] = 'forget' }
        } else { $s['ok'] = $false; $s['reason'] = 'unknown kind: ' + $kind }
        $plan += ,$s
    }
    return ,$plan
}

function Format-TermPlanStep($S) {
    switch ([string]$S['action']) {
        'delete' { return ('delete ' + (@($S['paths']) -join ', ')) }
        'command' { return ('run: ' + $S['command']) }
        'forget' { return 'forget the ledger row' }
        default { return [string]$S['action'] }
    }
}

# Carries out one confirmed step and drops its ledger row. Returns a short result.
function Invoke-TermPlanStep($S, [string]$KitRoot) {
    if (-not $S['ok']) { return ('skipped: ' + $S['reason']) }
    $lp = Get-TermLedgerPath
    switch ([string]$S['action']) {
        'delete' {
            $fail = @()
            foreach ($p in @($S['paths'])) {
                if (-not (Test-TermDeletable $KitRoot $p)) { $fail += $p; continue }
                if (Test-Path -LiteralPath $p) { try { Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop } catch { $fail += $p } }
            }
            if ($fail.Count -gt 0) { return ('not deleted (in use?): ' + ($fail -join ', ')) }
            if ($S['id']) { Remove-TermLedgerRow $lp $S['id'] }
            return 'deleted'
        }
        'command' {
            # Shown in its own window so the person sees and answers the uninstaller.
            $p = Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c ' + $S['command'] + ' & pause') -Wait -PassThru
            if ($p.ExitCode -eq 0 -and $S['id']) { Remove-TermLedgerRow $lp $S['id'] }
            return ('exit code ' + $p.ExitCode)
        }
        'forget' { if ($S['id']) { Remove-TermLedgerRow $lp $S['id'] }; return 'forgotten' }
    }
    return 'nothing to do'
}

# ---------------------------------------------------------------- full uninstall (plan is pure, given the top-level names)
function Get-TermFullUninstallPlanCore([string]$KitRoot, $Rows, [string[]]$ExtraDirs, [string[]]$TopLevel) {
    $seen = @{}
    $add = { param($p) $k = ([string]$p).ToLower(); if (-not $seen.ContainsKey($k)) { $seen[$k] = $true; $script:TermPlanDel += $p } }
    $script:TermPlanDel = @()
    foreach ($s in @(Get-TermUninstallPlan $Rows $KitRoot)) { if ($s['action'] -eq 'delete' -and $s['ok']) { foreach ($p in $s['paths']) { & $add $p } } }
    foreach ($d in @('data', 'tools', 'workspace', 'reports', 'logs', 'envs')) { & $add (Get-TermFullPath $KitRoot $d) }
    foreach ($x in @($ExtraDirs)) { if ($x) { & $add $x } }
    & $add (Get-TermFullPath $KitRoot 'state')
    $del = $script:TermPlanDel
    $cmds = @()
    foreach ($s in @(Get-TermUninstallPlan $Rows $KitRoot)) { if ($s['action'] -eq 'command' -and $s['ok']) { $cmds += ,$s } }
    $gone = @('data', 'tools', 'workspace', 'reports', 'logs', 'envs', 'state')
    $keep = @()
    foreach ($t in @($TopLevel)) { if ($gone -notcontains ([string]$t).ToLower()) { $keep += $t } }
    return @{ delete = $del; commands = $cmds; keep = $keep }
}

function Get-TermFullUninstallPlan([string]$KitRoot, $Rows, $TrustedDirs) {
    $extra = @()
    if ($TrustedDirs) {
        $root = Split-Path -Parent ([string]$TrustedDirs['claude'])
        if ($root -and (Test-Path -LiteralPath $root)) { $extra += $root }
    }
    $top = @()
    foreach ($i in @(Get-ChildItem -LiteralPath $KitRoot -Force -ErrorAction SilentlyContinue)) { $top += $i.Name }
    return (Get-TermFullUninstallPlanCore $KitRoot $Rows $extra $top)
}

function Invoke-TermFullDelete($Plan) {
    $ok = 0; $fail = @()
    foreach ($p in @($Plan['delete'])) {
        if (-not (Test-Path -LiteralPath $p)) { continue }
        try { Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop; $ok++ } catch { $fail += $p }
    }
    $r = '' + $ok
    if ($fail.Count -gt 0) { $r += '; not deleted (in use?): ' + ($fail -join ', ') }
    return $r
}

# ---------------------------------------------------------------- open
function Open-TermLedgerItem($Row, [string]$What) {
    $ps = @(Get-Key $Row 'paths' @())
    if ($ps.Count -eq 0) { return }
    $full = Get-TermFullPath $KitRoot ([string]$ps[0])
    if (-not (Test-Path -LiteralPath $full)) { return }
    if ($What -eq 'file') {
        $target = $full
        if (Test-Path -LiteralPath $full -PathType Container) {
            $exe = $null
            try {
                foreach ($p in @((Get-Catalog)['packages'])) {
                    if ([string]$p['id'] -eq [string](Get-Key $Row 'pkg' '')) { $exe = Find-KitExe $p['id'] @($p['apps'])[0] ([bool](Get-KitOS)['is64']) }
                }
            } catch { }
            if ($exe) { $target = $exe }
        }
        if (Test-Path -LiteralPath $target -PathType Leaf) { Start-Process -FilePath 'explorer.exe' -ArgumentList ('/select,"' + $target + '"') | Out-Null; return }
    }
    Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $full + '"') | Out-Null
}
