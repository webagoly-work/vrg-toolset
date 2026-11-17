# T4 VM: firmware virtualization, hypervisor, Hyper-V / Windows Sandbox / VM Platform / WSL feature state, edition, free RAM and disk.
# Win32_OptionalFeature is read without admin; Get-WindowsOptionalFeature would need it.
function Get-TermFeatureState([string]$Name) {
    $f = @(Get-TermWmi 'Win32_OptionalFeature' 'root\cimv2' ("Name = '" + $Name + "'"))
    if ($f.Count -eq 0) { return 'absent' }
    switch ([int]$f[0].InstallState) { 1 { return 'enabled' } 2 { return 'disabled' } 3 { return 'absent' } default { return 'unknown' } }
}

function Invoke-TermCheckT4 {
    $it = @()
    $os = Get-KitOS
    $cpu = @(Get-TermWmi 'Win32_Processor' | Select-Object -First 1)
    $virt = $null; if ($cpu.Count -gt 0) { $virt = $cpu[0].VirtualizationFirmwareEnabled }
    $cs = @(Get-TermWmi 'Win32_ComputerSystem')
    $hyp = $false; if ($cs.Count -gt 0) { $hyp = [bool]$cs[0].HypervisorPresent }
    # With a hypervisor already running, Windows reports firmware virtualization as off; it is in fact on.
    if ($hyp) { $it += New-TermItem 'virt' 'on (hypervisor running)' 'ok' }
    elseif ($virt -eq $true) { $it += New-TermItem 'virt' 'on' 'ok' }
    elseif ($virt -eq $false) { $it += New-TermItem 'virt' 'off' 'bad' }
    else { $it += New-TermItem 'virt' 'unknown' 'warn' }
    $isHome = ([string]$os['name']) -match 'Home|Otthoni'
    $ed = 'ok'; if ($isHome) { $ed = 'warn' }
    $it += New-TermItem 'edition' $os['name'] $ed '' @{ home = $isHome; build = $os['build'] }
    foreach ($f in @(@('hyperv', 'Microsoft-Hyper-V-All'), @('sandbox', 'Containers-DisposableClientVM'), @('vmp', 'VirtualMachinePlatform'), @('wslfeat', 'Microsoft-Windows-Subsystem-Linux'))) {
        $s = Get-TermFeatureState $f[1]
        $st = 'info'; if ($s -eq 'enabled') { $st = 'ok' } elseif ($s -eq 'disabled') { $st = 'warn' }
        $it += New-TermItem $f[0] $s $st '' @{ feature = $f[1]; state = $s }
    }
    $osw = @(Get-TermWmi 'Win32_OperatingSystem')
    if ($osw.Count -gt 0) {
        $gb = [Math]::Round([double]$osw[0].FreePhysicalMemory / 1MB, 1)
        $st = 'ok'; if ($gb -lt 4) { $st = 'warn' }
        $it += New-TermItem 'freeram' ('' + $gb + ' GB') $st
    }
    $c = @(Get-TermWmi 'Win32_LogicalDisk' 'root\cimv2' "DeviceID = 'C:'")
    if ($c.Count -gt 0) {
        $gb = [Math]::Round([double]$c[0].FreeSpace / 1GB, 1)
        $st = 'ok'; if ($gb -lt 20) { $st = 'warn' }
        $it += New-TermItem 'freedisk' ('C: ' + $gb + ' GB') $st
    }
    return @{ tier = 'T4'; items = $it }
}
