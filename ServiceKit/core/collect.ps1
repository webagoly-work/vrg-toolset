# ServiceKit shared data collection (snapshot, inventory, SMART).
# Dot-source after kit.ps1. Expects $OS and $IsWin to be set by the caller.
# PowerShell 2.0+ compatible.

if (-not $OS) { $OS = Get-KitOS }
if ($null -eq $IsWin) { $IsWin = [bool]$OS['windows'] }

function W([string]$Class, [string]$Ns = 'root\cimv2') {
    if (-not $IsWin) { return @() }
    try { return @(Get-WmiObject -Class $Class -Namespace $Ns -ErrorAction Stop) } catch { return @() }
}
function WDate($s) {
    if (-not $s) { return '' }
    try { return ([Management.ManagementDateTimeConverter]::ToDateTime([string]$s)).ToString('s') } catch { return '' }
}
function Num($v, [int]$Digits = 1) { if ($null -eq $v -or "$v" -eq '') { return $null }; return [Math]::Round([double]$v, $Digits) }

# ------------------------------------------------------------------ data collection
function Get-Programs {
    $list = @(); $seen = @{}
    if (-not $IsWin) { return ,$list }
    $roots = @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
               'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
               'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')
    foreach ($r in $roots) {
        if (-not (Test-Path $r)) { continue }
        foreach ($k in @(Get-ChildItem $r -ErrorAction SilentlyContinue)) {
            $p = $null; try { $p = Get-ItemProperty -LiteralPath $k.PSPath -ErrorAction Stop } catch { continue }
            $n = [string]$p.DisplayName
            if (-not $n) { continue }
            if ($p.SystemComponent -eq 1 -or $p.ParentKeyName -or ($p.ReleaseType -match 'Update|Hotfix')) { continue }
            $v = [string]$p.DisplayVersion
            $key = ($n + '|' + $v).ToLower()
            if ($seen.ContainsKey($key)) { continue }
            $seen[$key] = $true
            $size = $null; if ($p.EstimatedSize) { $size = [Math]::Round([double]$p.EstimatedSize / 1024, 1) }
            $list += @{ name = $n; version = $v; publisher = [string]$p.Publisher; sizeMB = $size; installed = [string]$p.InstallDate }
        }
    }
    $sorted = @($list | Sort-Object { $_['name'] })
    return ,$sorted
}

function Get-FolderMB([string[]]$Paths, [int]$Seconds = 8) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    $total = [double]0; $partial = $false
    foreach ($root in $Paths) {
        if (-not $root -or -not (Test-Path -LiteralPath $root)) { continue }
        $stack = New-Object System.Collections.Stack
        $stack.Push($root)
        while ($stack.Count -gt 0) {
            if ((Get-Date) -gt $deadline) { $partial = $true; break }
            $d = $stack.Pop()
            try { foreach ($f in [System.IO.Directory]::GetFiles($d)) { try { $total += (New-Object System.IO.FileInfo($f)).Length } catch { } } } catch { }
            try { foreach ($s in [System.IO.Directory]::GetDirectories($d)) { $stack.Push($s) } } catch { }
        }
    }
    return @{ mb = [Math]::Round($total / 1MB, 0); partial = $partial }
}

function Get-BootMs {
    if (-not $IsWin) { return $null }
    try {
        $e = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Diagnostics-Performance/Operational'; Id = 100 } -MaxEvents 1 -ErrorAction Stop
        $x = [xml]$e.ToXml()
        foreach ($d in $x.Event.EventData.Data) { if ($d.Name -eq 'BootTime') { return [int]$d.'#text' } }
    } catch { }
    return $null
}

function Get-Snapshot {
    $os = @(W 'Win32_OperatingSystem')
    $s = @{ time = (Get-Date).ToString('s'); computer = [string]$env:COMPUTERNAME }
    if ($os.Count) {
        $o = $os[0]
        $s['memTotalMB'] = [int]([double]$o.TotalVisibleMemorySize / 1024)
        $s['memUsedMB'] = [int](([double]$o.TotalVisibleMemorySize - [double]$o.FreePhysicalMemory) / 1024)
        $boot = WDate $o.LastBootUpTime
        if ($boot) { $s['uptimeMin'] = [int]((Get-Date) - [datetime]$boot).TotalMinutes }
    }
    $s['processes'] = @(Get-Process -ErrorAction SilentlyContinue).Count
    $st = @()
    foreach ($x in @(W 'Win32_StartupCommand')) { $st += @{ name = [string]$x.Caption; command = [string]$x.Command; location = [string]$x.Location } }
    $s['startup'] = $st
    $s['programs'] = Get-Programs
    $vols = @()
    foreach ($v in @(W 'Win32_LogicalDisk')) {
        if ([int]$v.DriveType -ne 3 -or -not $v.Size) { continue }
        $vols += @{ drive = [string]$v.DeviceID; label = [string]$v.VolumeName; freeGB = (Num ([double]$v.FreeSpace / 1GB)); sizeGB = (Num ([double]$v.Size / 1GB)) }
    }
    $s['volumes'] = $vols
    $tmpDirs = @(); if ($env:TEMP) { $tmpDirs += $env:TEMP }; if ($env:SystemRoot) { $tmpDirs += (Join-Path $env:SystemRoot 'Temp') }
    $tmp = Get-FolderMB $tmpDirs
    $s['tempMB'] = $tmp['mb']; $s['tempPartial'] = $tmp['partial']
    $s['bootMs'] = Get-BootMs
    $pr = $false
    if ($IsWin) {
        foreach ($k in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending',
                         'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')) { if (Test-Path $k) { $pr = $true } }
    }
    $s['pendingReboot'] = $pr
    return $s
}

function Get-SmartInfo([bool]$Allow) {
    $r = @()
    if (-not $IsWin -or -not $Allow) { return ,$r }
    $exe = Find-KitExe 'crystaldiskinfo' @{ exe = 'DiskInfo64.exe'; exe32 = 'DiskInfo32.exe' } ([bool]$OS['is64'])
    if (-not $exe) { return ,$r }
    $txt = Join-Path (Split-Path $exe) 'DiskInfo.txt'
    try {
        if (Test-Path $txt) { Remove-Item $txt -Force }
        $sp = @{ FilePath = $exe; ArgumentList = '/CopyExit'; PassThru = $true; WorkingDirectory = (Split-Path $exe) }
        if (-not $OS['admin']) { $sp['Verb'] = 'RunAs' }
        $p = Start-Process @sp
        if ($p) { [void]$p.WaitForExit(90000) }
    } catch { return ,$r }
    if (-not (Test-Path $txt)) { return ,$r }
    $lines = [System.IO.File]::ReadAllLines($txt)
    $cur = $null
    foreach ($ln in $lines) {
        $m = [regex]::Match($ln, '^\s*\((\d+)\)\s+(.+?)\s*$')
        if ($m.Success -and $ln -notmatch ':') { if ($cur) { $r += $cur }; $cur = @{ title = $m.Groups[2].Value }; continue }
        if (-not $cur) { continue }
        $kv = [regex]::Match($ln, '^\s*([A-Za-z][A-Za-z /]+?)\s*:\s*(.+?)\s*$')
        if (-not $kv.Success) { continue }
        $k = $kv.Groups[1].Value; $v = $kv.Groups[2].Value
        switch ($k) {
            'Model' { $cur['model'] = $v } 'Serial Number' { $cur['serial'] = $v } 'Interface' { $cur['interface'] = $v }
            'Disk Size' { $cur['size'] = $v } 'Health Status' { $cur['health'] = $v } 'Temperature' { $cur['temp'] = $v }
            'Power On Hours' { $cur['hours'] = $v } 'Power On Count' { $cur['powerOn'] = $v } 'Host Writes' { $cur['writes'] = $v }
        }
        if ($ln -match '^\s*-- S\.M\.A\.R\.T\.') { }
    }
    if ($cur) { $r += $cur }
    $clean = @(); foreach ($d in $r) { if ($d['health']) { $clean += $d } }
    return ,$clean
}

function Get-Inventory([bool]$IncludeKeys, [bool]$Smart) {
    $inv = @{ time = (Get-Date).ToString('s'); computer = [string]$env:COMPUTERNAME; user = [string]$env:USERNAME }
    $cs = @(W 'Win32_ComputerSystem'); $bios = @(W 'Win32_BIOS'); $bb = @(W 'Win32_BaseBoard'); $os = @(W 'Win32_OperatingSystem')
    if ($cs.Count) { $inv['manufacturer'] = [string]$cs[0].Manufacturer; $inv['model'] = [string]$cs[0].Model; $inv['ramGB'] = (Num ([double]$cs[0].TotalPhysicalMemory / 1GB)); $inv['domain'] = [string]$cs[0].Domain }
    if ($bios.Count) { $inv['serial'] = [string]$bios[0].SerialNumber; $inv['bios'] = ([string]$bios[0].SMBIOSBIOSVersion + ' (' + (WDate $bios[0].ReleaseDate).Split('T')[0] + ')') }
    if ($bb.Count) { $inv['board'] = ([string]$bb[0].Manufacturer + ' ' + [string]$bb[0].Product).Trim() }
    if ($os.Count) {
        $o = $os[0]
        $inv['os'] = [string]$o.Caption; $inv['osVersion'] = [string]$o.Version; $inv['osArch'] = [string]$o.OSArchitecture
        $inv['osInstalled'] = (WDate $o.InstallDate); $inv['lastBoot'] = (WDate $o.LastBootUpTime)
        try { $cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop
              $dv = [string]$cv.DisplayVersion; if (-not $dv) { $dv = [string]$cv.ReleaseId }; $inv['osRelease'] = $dv } catch { }
    }
    $cpus = @()
    foreach ($c in @(W 'Win32_Processor')) { $cpus += @{ name = ([string]$c.Name).Trim(); cores = [int]$c.NumberOfCores; threads = [int]$c.NumberOfLogicalProcessors; mhz = [int]$c.MaxClockSpeed } }
    $inv['cpu'] = $cpus
    $mods = @()
    $typeNames = @{ 20 = 'DDR'; 21 = 'DDR2'; 24 = 'DDR3'; 26 = 'DDR4'; 34 = 'DDR5'; 35 = 'LPDDR5' }
    foreach ($m in @(W 'Win32_PhysicalMemory')) {
        $tn = ''; try { $tv = [int]$m.SMBIOSMemoryType; if ($typeNames.ContainsKey($tv)) { $tn = $typeNames[$tv] } } catch { }
        $mods += @{ slot = [string]$m.DeviceLocator; gb = (Num ([double]$m.Capacity / 1GB)); mhz = [int]$m.Speed; maker = ([string]$m.Manufacturer).Trim(); part = ([string]$m.PartNumber).Trim(); type = $tn }
    }
    $inv['ram'] = $mods
    $arr = @(W 'Win32_PhysicalMemoryArray')
    if ($arr.Count) { $inv['ramSlots'] = [int]$arr[0].MemoryDevices; if ($arr[0].MaxCapacity) { $inv['ramMaxGB'] = (Num ([double]$arr[0].MaxCapacity / 1MB) 0) } }
    $gpus = @()
    foreach ($g in @(W 'Win32_VideoController')) { $gpus += @{ name = [string]$g.Name; driver = [string]$g.DriverVersion } }
    $inv['gpu'] = $gpus
    $disks = @()
    foreach ($d in @(W 'Win32_DiskDrive')) {
        $disks += @{ model = ([string]$d.Model).Trim(); sizeGB = (Num ([double]$d.Size / 1GB) 0); iface = [string]$d.InterfaceType; status = [string]$d.Status; index = [int]$d.Index }
    }
    $media = @{ 3 = 'HDD'; 4 = 'SSD'; 5 = 'SCM' }; $health = @{ 0 = 'Healthy'; 1 = 'Warning'; 2 = 'Unhealthy' }; $bus = @{ 7 = 'USB'; 11 = 'SATA'; 17 = 'NVMe'; 8 = 'RAID'; 10 = 'SAS' }
    $pd = @()
    foreach ($x in @(W 'MSFT_PhysicalDisk' 'root\Microsoft\Windows\Storage')) {
        $pd += @{ name = [string]$x.FriendlyName; media = [string]$media[[int]$x.MediaType]; health = [string]$health[[int]$x.HealthStatus];
                  bus = [string]$bus[[int]$x.BusType]; sizeGB = (Num ([double]$x.Size / 1GB) 0) }
    }
    $inv['disks'] = $disks; $inv['physical'] = $pd
    $inv['smart'] = Get-SmartInfo $Smart
    $nics = @()
    foreach ($n in @(W 'Win32_NetworkAdapterConfiguration')) {
        if (-not $n.IPEnabled) { continue }
        $nics += @{ name = [string]$n.Description; ip = ((@($n.IPAddress) | Where-Object { $_ -match '^\d+\.' }) -join ', '); mac = [string]$n.MACAddress;
                    dhcp = [bool]$n.DHCPEnabled; gateway = (@($n.DefaultIPGateway) -join ', '); dns = (@($n.DNSServerSearchOrder) -join ', ') }
    }
    $inv['network'] = $nics
    $avs = @()
    foreach ($a in @(W 'AntiVirusProduct' 'root\SecurityCenter2')) {
        $stv = [int]$a.productState
        $avs += @{ name = [string]$a.displayName; enabled = (($stv -band 0x1000) -ne 0); upToDate = (($stv -band 0x10) -eq 0) }
    }
    $inv['antivirus'] = $avs
    $last = $null; $cnt = 0
    foreach ($h in @(W 'Win32_QuickFixEngineering')) {
        $cnt++
        $dt = $null; try { $dt = [datetime]::Parse([string]$h.InstalledOn, [Globalization.CultureInfo]::InvariantCulture) } catch { try { $dt = [datetime]$h.InstalledOn } catch { } }
        if ($dt -and (-not $last -or $dt -gt $last)) { $last = $dt }
    }
    $inv['hotfixCount'] = $cnt
    if ($last) { $inv['lastUpdate'] = $last.ToString('s'); $inv['lastUpdateDays'] = [int]((Get-Date) - $last).TotalDays }
    $bat = @(W 'Win32_Battery')
    if ($bat.Count) {
        $b = @{ charge = [int]$bat[0].EstimatedChargeRemaining }
        $sd = @(W 'BatteryStaticData' 'root\wmi'); $fc = @(W 'BatteryFullChargedCapacity' 'root\wmi'); $cc = @(W 'BatteryCycleCount' 'root\wmi')
        if ($sd.Count -and $fc.Count -and [double]$sd[0].DesignedCapacity -gt 0) {
            $b['designWh'] = (Num ([double]$sd[0].DesignedCapacity / 1000)); $b['fullWh'] = (Num ([double]$fc[0].FullChargedCapacity / 1000))
            $b['wearPct'] = [int][Math]::Max(0, 100 - 100 * [double]$fc[0].FullChargedCapacity / [double]$sd[0].DesignedCapacity)
        }
        if ($cc.Count) { $b['cycles'] = [int]$cc[0].CycleCount }
        $inv['battery'] = $b
    }
    if ($IsWin) {
        $md = Join-Path $env:SystemRoot 'Minidump'
        $dumps = @(Get-ChildItem -Path $md -Filter '*.dmp' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
        $inv['minidumps'] = $dumps.Count
        if ($dumps.Count) { $inv['lastCrash'] = $dumps[0].LastWriteTime.ToString('s') }
        $kp = 0; $bc = 0
        try {
            foreach ($e in @(Get-EventLog -LogName System -After (Get-Date).AddDays(-30) -EntryType Error -Newest 3000 -ErrorAction Stop)) {
                if ($e.Source -eq 'Microsoft-Windows-Kernel-Power' -and ($e.InstanceId -band 0xFFFF) -eq 41) { $kp++ }
                if ($e.Source -match 'BugCheck|WER-SystemErrorReporting') { $bc++ }
            }
        } catch { }
        $inv['kernelPower30'] = $kp; $inv['bugcheck30'] = $bc
        if ($IncludeKeys) {
            try { $k = @(W 'SoftwareLicensingService')[0].OA3xOriginalProductKey; if ($k) { $inv['oemKey'] = [string]$k } } catch { }
        }
    }
    return $inv
}

