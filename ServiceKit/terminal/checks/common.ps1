# Helpers shared by the tier checks. Every check is read-only. PowerShell 5.1 (and 7), ASCII only.

function New-TermItem([string]$Id, $Value, [string]$Status, [string]$Hint = '', $Data = $null) {
    $v = ''; if ($null -ne $Value) { $v = [string]$Value }
    return @{ id = $Id; label = $Id; value = $v; status = $Status; hint = $Hint; data = $Data }
}

function Get-TermWmi([string]$Class, [string]$Ns = 'root\cimv2', [string]$Filter = '') {
    try {
        if (Get-Command Get-CimInstance -ErrorAction SilentlyContinue) {
            if ($Filter) { return @(Get-CimInstance -ClassName $Class -Namespace $Ns -Filter $Filter -ErrorAction Stop) }
            return @(Get-CimInstance -ClassName $Class -Namespace $Ns -ErrorAction Stop)
        }
        if ($Filter) { return @(Get-WmiObject -Class $Class -Namespace $Ns -Filter $Filter -ErrorAction Stop) }
        return @(Get-WmiObject -Class $Class -Namespace $Ns -ErrorAction Stop)
    } catch { return @() }
}

# First existing program: kit copies first, then PATH.
function Find-TermTool([string[]]$KitRel, [string[]]$Names) {
    foreach ($r in $KitRel) { $p = Join-Path $ToolsDir $r; if (Test-Path -LiteralPath $p) { return $p } }
    foreach ($n in $Names) {
        $g = Get-Command $n -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($g) { return [string]$g.Source }
    }
    return $null
}

function New-TermToolItem([string]$Id, [string[]]$KitRel, [string[]]$Names, [string]$VerArg = '--version') {
    $p = Find-TermTool $KitRel $Names
    if (-not $p) { return (New-TermItem $Id '' 'missing') }
    $v = Get-TermVersion $p $VerArg
    $where = 'PC'; if ($p.ToLower().StartsWith($KitRoot.ToLower())) { $where = 'kit' }
    return (New-TermItem $Id ($v + '  (' + $where + ') ' + $p) 'ok' '' @{ path = $p; version = $v; kit = ($where -eq 'kit') })
}

function Get-TermRegValue([string]$Path, [string]$Name) {
    try { return (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name } catch { return $null }
}

# Pure: compare dotted versions; $null when either side does not parse.
function Compare-TermVersion([string]$A, [string]$B) {
    $ma = [regex]::Match([string]$A, '\d+(\.\d+){0,3}'); $mb = [regex]::Match([string]$B, '\d+(\.\d+){0,3}')
    if (-not $ma.Success -or -not $mb.Success) { return $null }
    $va = $ma.Value; $vb = $mb.Value
    if ($va -notmatch '\.') { $va += '.0' }; if ($vb -notmatch '\.') { $vb += '.0' }
    return ([version]$va).CompareTo([version]$vb)
}
