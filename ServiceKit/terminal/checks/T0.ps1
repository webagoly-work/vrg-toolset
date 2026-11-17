# T0 Alap / Basics: OS, CPU, RAM, free disk, admin, PowerShell, execution policy (read only), antivirus, long paths.
function Invoke-TermCheckT0 {
    $os = Get-KitOS
    $it = @()
    $it += New-TermItem 'os' ($os['name'] + ' (build ' + $os['build'] + ')') 'info'
    $cpu = @(Get-TermWmi 'Win32_Processor' | Select-Object -First 1)
    if ($cpu.Count -gt 0) { $it += New-TermItem 'cpu' (([string]$cpu[0].Name).Trim() + ', ' + $cpu[0].NumberOfLogicalProcessors + ' threads') 'info' }
    $cs = @(Get-TermWmi 'Win32_ComputerSystem')
    if ($cs.Count -gt 0) {
        $gb = [Math]::Round([double]$cs[0].TotalPhysicalMemory / 1GB, 1)
        $st = 'ok'; if ($gb -lt 8) { $st = 'warn' }
        $it += New-TermItem 'ram' ('' + $gb + ' GB') $st
    }
    foreach ($d in @(Get-TermWmi 'Win32_LogicalDisk' 'root\cimv2' 'DriveType = 3')) {
        $free = [Math]::Round([double]$d.FreeSpace / 1GB, 1); $size = [Math]::Round([double]$d.Size / 1GB, 1)
        $st = 'ok'; if ($free -lt 10) { $st = 'warn' }; if ($free -lt 2) { $st = 'bad' }
        $it += New-TermItem ('disk') ([string]$d.DeviceID + ' ' + $free + ' / ' + $size + ' GB free') $st '' @{ drive = [string]$d.DeviceID; freeGB = $free }
    }
    $a = 'no'; if ($os['admin']) { $a = 'yes' }
    $it += New-TermItem 'admin' $a 'info'
    $it += New-TermItem 'psver' $os['ps'] 'info'
    $pol = @()
    try { foreach ($p in @(Get-ExecutionPolicy -List)) { $pol += ([string]$p.Scope + '=' + [string]$p.ExecutionPolicy) } } catch { }
    $it += New-TermItem 'execpol' ($pol -join ', ') 'info' 'The kit uses a process-scoped Bypass; the machine policy is never changed.'
    $av = @(Get-TermWmi 'AntiVirusProduct' 'root\SecurityCenter2' | ForEach-Object { [string]$_.displayName })
    $st = 'ok'; if ($av.Count -eq 0) { $st = 'warn' }
    $it += New-TermItem 'av' ($av -join ', ') $st '' @{ products = $av }
    $lp = Get-TermRegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' 'LongPathsEnabled'
    $st = 'warn'; $v = 'off'; if ([int]$lp -eq 1) { $st = 'ok'; $v = 'on' }
    $it += New-TermItem 'longpath' $v $st
    return @{ tier = 'T0'; items = $it }
}
