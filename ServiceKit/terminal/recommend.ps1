# ServiceKit Terminal - check results -> suggestions from the ServiceKit catalog only (D7).
# install / update / uninstall / command / hint. Nothing is executed here; uninstall suggestions are never run
# without the user ticking them in the Installs view. Pure. PowerShell 5.1, ASCII only.

# check item id -> catalog package that provides it
$script:TermProvides = @{
    'T1.git' = 'portablegit'; 'T1.node' = 'node'; 'T1.python' = 'python'; 'T1.vscode' = 'vscode'; 'T1.pwsh7' = 'pwsh'; 'T1.gh' = 'gh'
    'T2.claude' = 'claude-code'; 'T3.esptool' = 'esptool'; 'T3.arduino' = 'arduino-cli'
}
# minimum versions Claude Code's tool chain expects
$script:TermMinVersion = @{ 'T1.node' = '18.0'; 'T1.git' = '2.30'; 'T1.python' = '3.9' }

function Find-TermPackage($Catalog, [string]$Id) {
    foreach ($p in @($Catalog['packages'])) { if ([string]$p['id'] -eq $Id) { return $p } }
    return $null
}

function New-TermRec([string]$Action, [string]$Pkg, [string]$Reason, $SizeMB = $null, [string]$Command = '', [string]$Name = '') {
    return @{ action = $Action; pkg = $Pkg; name = $Name; reason = $Reason; sizeMB = $SizeMB; command = $Command }
}

function Get-TermRecommendations($Results, $Catalog, $Installed, $Ledger, [string]$KitRoot) {
    $out = @()
    $byId = @{}
    foreach ($r in @($Results)) { foreach ($it in @($r['items'])) { $byId[[string]$r['tier'] + '.' + [string]$it['id']] = $it } }
    if (-not $Installed) { $Installed = @{} }
    foreach ($k in @($byId.Keys | Sort-Object)) {
        $it = $byId[$k]
        $st = [string]$it['status']
        if ($script:TermProvides.ContainsKey($k)) {
            $pkgId = $script:TermProvides[$k]
            $p = Find-TermPackage $Catalog $pkgId
            if ($p -and $st -eq 'missing' -and -not $Installed.ContainsKey($pkgId)) {
                $out += ,(New-TermRec 'install' $pkgId ($k + ' missing') (Get-Key $p 'sizeMB' $null) '' ([string]$p['name']))
            }
            if ($p -and $st -eq 'ok' -and $script:TermMinVersion.ContainsKey($k)) {
                $v = [string](Get-Key (Get-Key $it 'data' @{}) 'version' '')
                $c = Compare-TermVersionSafe $v $script:TermMinVersion[$k]
                if ($null -ne $c -and $c -lt 0) { $out += ,(New-TermRec 'update' $pkgId ($k + ' ' + $v + ' < ' + $script:TermMinVersion[$k]) (Get-Key $p 'sizeMB' $null) '' ([string]$p['name'])) }
            }
        }
    }
    # hints and commands (the user runs them; admin ones say so)
    $tls = $byId['T2.tls']
    if ($tls -and [string]$tls['status'] -eq 'bad') {
        $out += ,(New-TermRec 'hint' '' ('HTTPS is intercepted (' + [string](Get-Key (Get-Key $tls 'data' @{}) 'product' '?') + '). Export that product''s root CA to a .pem and set profile.extraCaCerts; the launcher then sets NODE_EXTRA_CA_CERTS. For uv/Python also set UV_SYSTEM_CERTS=1.'))
    }
    foreach ($n in @('T2.net_anthropic', 'T2.net_github')) {
        if ($byId[$n] -and [string]$byId[$n]['status'] -eq 'bad') { $out += ,(New-TermRec 'hint' '' ($n + ' unreachable: check the network, the proxy (T2.proxy) and the firewall.')) }
    }
    $lp = $byId['T0.longpath']
    if ($lp -and [string]$lp['status'] -eq 'warn') {
        $out += ,(New-TermRec 'command' '' 'Long paths are off (deep node_modules can fail). Admin:' 'New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force')
    }
    $virt = $byId['T4.virt']
    if ($virt -and [string]$virt['status'] -eq 'bad') { $out += ,(New-TermRec 'hint' '' 'Virtualization is off in the BIOS/UEFI (Intel VT-x / AMD-V): turn it on for Sandbox, Hyper-V or VirtualBox.') }
    $ed = $byId['T4.edition']; $sb = $byId['T4.sandbox']
    $isHome = $false; if ($ed) { $isHome = [bool](Get-Key (Get-Key $ed 'data' @{}) 'home' $false) }
    if ($isHome) {
        foreach ($vm in @('virtualbox', 'qemu')) {
            $p = Find-TermPackage $Catalog $vm
            if ($p -and -not $Installed.ContainsKey($vm)) { $out += ,(New-TermRec 'install' $vm 'Home edition: no Windows Sandbox or Hyper-V' (Get-Key $p 'sizeMB' $null) '' ([string]$p['name'])) }
        }
    } elseif ($sb -and [string](Get-Key (Get-Key $sb 'data' @{}) 'state' '') -eq 'disabled') {
        $out += ,(New-TermRec 'command' '' 'Windows Sandbox is off. Admin, then restart:' 'Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All')
    }
    $com = $byId['T3.comports']
    if ($com -and @(Get-Key (Get-Key $com 'data' @{}) 'ports' @()).Count -gt 0) {
        $none = $true
        foreach ($d in @('T3.drv_ch340', 'T3.drv_cp210x', 'T3.drv_ftdi')) { if ($byId[$d] -and [string]$byId[$d]['status'] -eq 'ok') { $none = $false } }
        if ($none) { $out += ,(New-TermRec 'hint' '' 'COM ports but no CH340 / CP210x / FTDI driver: install the board vendor''s driver (WCH, Silicon Labs or FTDI site).') }
    }
    # uninstall suggestions: listed only
    $cl = $byId['T2.claude']
    if ($cl) {
        $src = @(Get-Key (Get-Key $cl 'data' @{}) 'sources' @())
        if (($src -contains 'npm') -and ($src -contains 'native')) {
            $out += ,(New-TermRec 'uninstall' '' 'Claude Code is installed twice on this PC (npm and native); the older one can shadow the other.' $null 'npm uninstall -g @anthropic-ai/claude-code')
        }
    }
    foreach ($row in @($Ledger)) {
        if (-not $row) { continue }
        $ps = @(Get-Key $row 'paths' @())
        if ($ps.Count -eq 0) { continue }
        $gone = $true
        foreach ($p in $ps) { if (Test-Path -LiteralPath (Resolve-TermKitPath $KitRoot ([string]$p))) { $gone = $false } }
        if ($gone) { $out += ,(New-TermRec 'uninstall' ([string]$row['pkg']) 'ledger row whose files are gone (forget it)' $null 'ledger') }
    }
    return $out
}

function Compare-TermVersionSafe([string]$A, [string]$B) {
    if (Get-Command Compare-TermVersion -CommandType Function -ErrorAction SilentlyContinue) { return (Compare-TermVersion $A $B) }
    return $null
}

# Kit-relative ledger paths resolve against the kit root (the drive letter changes between PCs).
function Resolve-TermKitPath([string]$KitRoot, [string]$P) {
    if ([IO.Path]::IsPathRooted($P)) { return $P }
    return (Join-Path $KitRoot $P)
}

function Format-TermRecommendation($X) {
    $a = [string]$X['action']
    $size = ''; if ($null -ne $X['sizeMB'] -and [string]$X['sizeMB'] -ne '') { $size = ', ' + $X['sizeMB'] + ' MB' }
    $nm = [string]$X['name']; if (-not $nm) { $nm = [string]$X['pkg'] }
    switch ($a) {
        'install' { return ('install ' + $nm + ' (portable' + $size + '): ' + $X['reason']) }
        'update' { return ('update ' + $nm + $size + ': ' + $X['reason']) }
        'uninstall' { $c = ''; if ($X['command'] -and $X['command'] -ne 'ledger') { $c = '  ->  ' + $X['command'] }; return ('uninstall ' + $nm + ': ' + $X['reason'] + $c) }
        'command' { return ($X['reason'] + '  ' + $X['command']) }
        default { return ([string]$X['reason']) }
    }
}
