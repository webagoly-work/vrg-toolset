<#
  ServiceKit playbook step runner.
    playbook.ps1 -Run <runId> -Step <index>
  Reads state\playbooks\<runId>\run.json, runs one routine and writes the result to
  state\playbooks\<runId>\<index>.json (status, bilingual summary, details, files).
  The Dashboard server starts it hidden, elevated when the step needs admin rights.
  PowerShell 2.0+ compatible. Output parsing avoids localized text wherever possible.
#>
param([string]$Run = '', [int]$Step = -1, [string]$Routine = '', [string]$ParamsFile = '')

$CoreDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $CoreDir 'kit.ps1')
$ErrorActionPreference = 'Continue'
$OS = Get-KitOS
$IsWin = [bool]$OS['windows']
. (Join-Path $CoreDir 'collect.ps1')

$PbDir = Join-Path $StateDir 'playbooks'
$RunDir = Join-Path $PbDir $Run
$ResFile = Join-Path $RunDir ('' + $Step + '.json')
$LogFile = Join-Path $RunDir ('' + $Step + '.log')

# ------------------------------------------------------------------ result helpers
$script:R = @{ status = 'ok'; hu = ''; en = ''; details = @(); files = @() }
$Rank = @{ ok = 0; info = 1; warn = 2; fail = 3; skipped = 0 }
function Set-Status([string]$s) { if ($Rank[$s] -gt $Rank[$script:R['status']]) { $script:R['status'] = $s } }
function Say([string]$s, [string]$hu, [string]$en) { Set-Status $s; $script:R['hu'] = $hu; $script:R['en'] = $en }
function Skip([string]$hu, [string]$en) { $script:R['status'] = 'skipped'; $script:R['hu'] = $hu; $script:R['en'] = $en }
function D([string]$line) { if (@($script:R['details']).Count -lt 80) { $script:R['details'] = @($script:R['details']) + $line } }
function F([string]$full) {
    if ($full -and $full.StartsWith($KitRoot)) { $script:R['files'] = @($script:R['files']) + ($full.Substring($KitRoot.Length).TrimStart('\', '/').Replace('\', '/')) }
}
function Log([string]$s) { try { Add-Content -Path $LogFile -Value $s -Encoding UTF8 } catch { } }
function Need-Win { if (-not $IsWin) { Skip 'Csak Windowson fut.' 'Runs on Windows only.'; return $false }; return $true }
function Need-Build([int]$Major, [int]$Minor, [string]$What) {
    $v = [int]$OS['major'] * 100 + [int]$OS['minor']
    if ($v -lt ($Major * 100 + $Minor)) { Skip ('Ezen a Windows verzión nem érhető el: ' + $What) ('Not available on this Windows version: ' + $What); return $false }
    return $true
}
function Need-Admin { if (-not $OS['admin']) { Say 'fail' 'Rendszergazdai jog kell ehhez a lépéshez.' 'This step needs administrator rights.'; return $false }; return $true }
function MB($bytes) { return [Math]::Round([double]$bytes / 1MB, 1) }

# Runs a console program, returns @{ code; out = lines }. Handles OEM and UTF-16 output.
function Invoke-Cmd([string]$File, [string]$Arguments, [int]$TimeoutSec = 600) {
    $o = [IO.Path]::GetTempFileName(); $e = [IO.Path]::GetTempFileName()
    $code = -1; $lines = @()
    try {
        $p = Start-Process -FilePath $File -ArgumentList $Arguments -NoNewWindow -PassThru -RedirectStandardOutput $o -RedirectStandardError $e
        if (-not $p.WaitForExit($TimeoutSec * 1000)) { try { $p.Kill() } catch { }; $code = -2 } else { $code = $p.ExitCode }
        foreach ($f in @($o, $e)) {
            $b = [IO.File]::ReadAllBytes($f)
            if ($b.Length -eq 0) { continue }
            $enc = $null
            if ($b.Length -gt 3 -and $b[1] -eq 0 -and $b[3] -eq 0) { $enc = [Text.Encoding]::Unicode }
            else { try { $enc = [Text.Encoding]::GetEncoding([Globalization.CultureInfo]::CurrentCulture.TextInfo.OEMCodePage) } catch { $enc = [Text.Encoding]::Default } }
            $txt = $enc.GetString($b).Replace("`r", "`n")
            foreach ($l in $txt.Split("`n")) { $t = $l.Trim(); if ($t) { $lines += $t } }
        }
    } catch { $lines += $_.Exception.Message }
    finally { Remove-Item $o, $e -ErrorAction SilentlyContinue }
    Log ("> " + $File + ' ' + $Arguments + "   [exit " + $code + "]")
    foreach ($l in $lines) { Log $l }
    return @{ code = $code; out = $lines }
}
function Tail($lines, [int]$n = 6) { $a = @($lines); if ($a.Count -le $n) { return $a }; return $a[($a.Count - $n)..($a.Count - 1)] }

function Get-DirBytes([string]$Path, [int]$Seconds = 15) {
    $r = Get-FolderMB @($Path) $Seconds
    return [double]$r['mb'] * 1MB
}

# Deletes files older than $Hours in a folder; returns @{ bytes; files; locked }.
function Clear-Folder([string]$Path, [int]$Hours = 24) {
    $res = @{ bytes = [double]0; files = 0; locked = 0 }
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return $res }
    $limit = (Get-Date).AddHours(-$Hours)
    foreach ($f in @(Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer })) {
        if ($f.LastWriteTime -gt $limit) { continue }
        $len = $f.Length
        try { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop; $res['bytes'] += $len; $res['files']++ } catch { $res['locked']++ }
    }
    foreach ($d in @(Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer } | Sort-Object { $_.FullName.Length } -Descending)) {
        try { if (@(Get-ChildItem -LiteralPath $d.FullName -Force -ErrorAction Stop).Count -eq 0) { Remove-Item -LiteralPath $d.FullName -Force -ErrorAction Stop } } catch { }
    }
    return $res
}

function Get-Primary {
    foreach ($n in @(W 'Win32_NetworkAdapterConfiguration')) {
        if (-not $n.IPEnabled -or -not $n.DefaultIPGateway) { continue }
        $ip = $null; $mask = $null
        $ips = @($n.IPAddress); $masks = @($n.IPSubnet)
        for ($i = 0; $i -lt $ips.Count; $i++) { if ($ips[$i] -match '^\d+\.\d+\.\d+\.\d+$') { $ip = $ips[$i]; $mask = $masks[$i]; break } }
        if ($ip) { return @{ ip = $ip; mask = $mask; gateway = (@($n.DefaultIPGateway) | Where-Object { $_ -match '^\d+\.' } | Select-Object -First 1); name = [string]$n.Description; dns = (@($n.DNSServerSearchOrder) -join ', '); mac = [string]$n.MACAddress } }
    }
    return $null
}

$script:BackupDir = $null
function Get-BackupDir([string]$Sub) {
    if (-not $script:BackupDir) {
        $name = $script:RunDef['job']
        if (-not $name) { $name = ([string]$env:COMPUTERNAME + '-' + (Get-Date).ToString('yyyyMMdd')) }
        $script:BackupDir = Join-Path (Join-Path $DataDir 'backups') $name
    }
    $d = $script:BackupDir; if ($Sub) { $d = Join-Path $d $Sub }
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    return $d
}

function Write-Csv([string]$Path, [string[]]$Header, $Rows) {
    $lines = @(($Header | ForEach-Object { '"' + $_ + '"' }) -join ';')
    foreach ($r in @($Rows)) { $c = @(); foreach ($h in $Header) { $c += ('"' + ([string]$r[$h]).Replace('"', '""') + '"') }; $lines += ($c -join ';') }
    $enc = New-Object System.Text.UTF8Encoding($true)
    [IO.File]::WriteAllText($Path, (($lines -join "`r`n") + "`r`n"), $enc)
}

# ------------------------------------------------------------------ routines: checks
function R-sys-overview($P) {
    if (-not (Need-Win)) { return }
    $o = @(W 'Win32_OperatingSystem'); $cs = @(W 'Win32_ComputerSystem')
    if ($cs.Count) { D ('Gép / PC: ' + $cs[0].Manufacturer + ' ' + $cs[0].Model) }
    if ($o.Count) {
        D ('Windows: ' + $o[0].Caption + ' ' + $o[0].Version)
        $boot = WDate $o[0].LastBootUpTime
        if ($boot) {
            $days = [Math]::Round(((Get-Date) - [datetime]$boot).TotalDays, 1)
            D ('Uptime: ' + $days + ' d')
            if ($days -gt 14) { Say 'warn' ('A gép ' + $days + ' napja nem volt újraindítva.') ('No restart for ' + $days + ' days.') }
        }
    }
    $pr = $false
    foreach ($k in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')) { if (Test-Path $k) { $pr = $true } }
    try { $pfro = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -Name PendingFileRenameOperations -ErrorAction Stop).PendingFileRenameOperations; if ($pfro) { D 'PendingFileRenameOperations: yes' } } catch { }
    if ($pr) { Say 'warn' 'Újraindítás függőben (frissítés). Javítás előtt indítsd újra.' 'A restart is pending (updates). Restart before repairs.' }
    if (-not $script:R['hu']) { Say 'ok' 'Rendszer áttekintve, nincs függő újraindítás.' 'System reviewed, no pending restart.' }
}

function R-disk-health($P) {
    if (-not (Need-Win)) { return }
    $bad = 0; $hdd = $false; $ssd = $false
    foreach ($d in @(W 'MSFT_PhysicalDisk' 'root\Microsoft\Windows\Storage')) {
        $media = @{ 3 = 'HDD'; 4 = 'SSD' }[[int]$d.MediaType]; $hs = @{ 0 = 'Healthy'; 1 = 'Warning'; 2 = 'Unhealthy' }[[int]$d.HealthStatus]
        if ($media -eq 'HDD' -and [int]$d.BusType -ne 7) { $hdd = $true }; if ($media -eq 'SSD') { $ssd = $true }
        D ($d.FriendlyName + ' · ' + $media + ' · ' + [Math]::Round([double]$d.Size / 1GB) + ' GB · ' + $hs)
        if ($hs -and $hs -ne 'Healthy') { $bad++ }
    }
    if ((Get-Key $P 'smart' 'true') -eq 'true') {
        foreach ($s in @(Get-SmartInfo $true)) {
            D ('SMART ' + $s['model'] + ': ' + $s['health'] + ' · ' + $s['temp'] + ' · ' + $s['hours'])
            if ($s['health'] -notmatch '^Good') { $bad++ }
        }
    }
    $low = @()
    foreach ($v in @(W 'Win32_LogicalDisk')) {
        if ([int]$v.DriveType -ne 3 -or -not $v.Size) { continue }
        $pct = [int](100 * [double]$v.FreeSpace / [double]$v.Size)
        D ($v.DeviceID + ' ' + [Math]::Round([double]$v.FreeSpace / 1GB, 1) + ' / ' + [Math]::Round([double]$v.Size / 1GB) + ' GB free (' + $pct + '%)')
        if ($pct -lt 10) { $low += $v.DeviceID }
    }
    if ($bad) { Say 'fail' 'Romló lemez! Azonnal ments adatot, utána csere.' 'Failing disk! Back up data now, then replace it.' }
    elseif ($low.Count) { Say 'warn' ('Kevés a szabad hely: ' + ($low -join ', ')) ('Low free space: ' + ($low -join ', ')) }
    elseif ($hdd -and -not $ssd) { Say 'info' 'A lemezek egészségesek. A rendszer HDD-n fut: SSD-re cserélve sokat gyorsulna.' 'Disks are healthy. The system runs on an HDD: an SSD would speed it up a lot.' }
    else { Say 'ok' 'A lemezek egészségesek, van szabad hely.' 'Disks are healthy with enough free space.' }
}

function R-av-status($P) {
    if (-not (Need-Win)) { return }
    $avs = @(W 'AntiVirusProduct' 'root\SecurityCenter2')
    if ($avs.Count -eq 0) {
        if ([int]$OS['major'] -ge 6 -and -not ("" + $OS['name'] -match 'Server')) { Say 'fail' 'Nem található vírusvédelem.' 'No antivirus found.' } else { Skip 'A Biztonsági központ nem érhető el (szerver?).' 'Security Center not available (server?).' }
        return
    }
    $on = $false; $old = $false
    foreach ($a in $avs) {
        $st = [int]$a.productState; $en = (($st -band 0x1000) -ne 0); $up = (($st -band 0x10) -eq 0)
        D ($a.displayName + ' · ' + @{ $true = 'ON'; $false = 'OFF' }[$en] + ' · ' + @{ $true = 'up to date'; $false = 'OUTDATED' }[$up])
        if ($en) { $on = $true; if (-not $up) { $old = $true } }
    }
    if (-not $on) { Say 'fail' 'A vírusvédelem ki van kapcsolva.' 'Antivirus is turned off.' }
    elseif ($old) { Say 'warn' 'A vírusvédelem adatbázisa elavult.' 'Antivirus signatures are outdated.' }
    else { Say 'ok' 'A vírusvédelem be van kapcsolva és naprakész.' 'Antivirus is on and up to date.' }
}

function R-update-status($P) {
    if (-not (Need-Win)) { return }
    $last = $null; $n = 0
    foreach ($h in @(W 'Win32_QuickFixEngineering')) {
        $n++; $dt = $null
        try { $dt = [datetime]::Parse([string]$h.InstalledOn, [Globalization.CultureInfo]::InvariantCulture) } catch { try { $dt = [datetime]$h.InstalledOn } catch { } }
        if ($dt -and (-not $last -or $dt -gt $last)) { $last = $dt }
    }
    D ('Hotfixes: ' + $n)
    try {
        $sess = New-Object -ComObject Microsoft.Update.Session
        $hc = $sess.CreateUpdateSearcher().GetTotalHistoryCount()
        if ($hc -gt 0) {
            foreach ($e in @($sess.CreateUpdateSearcher().QueryHistory(0, [Math]::Min(30, $hc)))) {
                if ($e.Date -and (-not $last -or $e.Date -gt $last) -and [int]$e.ResultCode -eq 2) { $last = $e.Date }
                if ([int]$e.ResultCode -eq 4 -or [int]$e.ResultCode -eq 5) { D ('FAILED ' + $e.Date.ToString('yyyy-MM-dd') + ' ' + $e.Title) }
            }
        }
    } catch { }
    if (-not $last) { Say 'warn' 'Nem állapítható meg az utolsó frissítés ideje.' 'Could not determine the last update.'; return }
    $days = [int]((Get-Date) - $last).TotalDays
    D ('Last update: ' + $last.ToString('yyyy-MM-dd') + ' (' + $days + ' d)')
    if ("" + $OS['name'] -match 'Windows (7|8)') { Say 'warn' 'Ez a Windows már nem kap biztonsági frissítést.' 'This Windows no longer gets security updates.' }
    if ($days -gt 60) { Say 'warn' ('' + $days + ' napja nem volt frissítés.') ('No updates for ' + $days + ' days.') }
    elseif (-not $script:R['hu']) { Say 'ok' ('Utolsó frissítés ' + $days + ' napja.') ('Last update ' + $days + ' days ago.') }
}

function R-crash-events($P) {
    if (-not (Need-Win)) { return }
    $days = [int](Get-Key $P 'days' '30')
    $kp = 0; $bc = 0; $whea = 0; $disk = 0
    try {
        foreach ($e in @(Get-EventLog -LogName System -After (Get-Date).AddDays(-$days) -EntryType Error, Warning -Newest 5000 -ErrorAction Stop)) {
            $id = $e.InstanceId -band 0xFFFF
            if ($e.Source -eq 'Microsoft-Windows-Kernel-Power' -and $id -eq 41) { $kp++ }
            elseif ($e.Source -match 'BugCheck|WER-SystemErrorReporting') { $bc++ }
            elseif ($e.Source -match 'WHEA') { $whea++ }
            elseif (($e.Source -eq 'disk' -and ($id -eq 7 -or $id -eq 51 -or $id -eq 153)) -or ($e.Source -eq 'Ntfs' -and $id -eq 55)) { $disk++ }
        }
    } catch { D ('EventLog: ' + $_.Exception.Message) }
    $dumps = @(Get-ChildItem -Path (Join-Path $env:SystemRoot 'Minidump') -Filter '*.dmp' -ErrorAction SilentlyContinue)
    D ('Kernel-Power 41: ' + $kp); D ('BugCheck: ' + $bc); D ('Minidump: ' + $dumps.Count); D ('WHEA: ' + $whea); D ('Disk/NTFS errors: ' + $disk)
    if ($disk -gt 0) { Say 'fail' ('Lemezhibák az eseménynaplóban (' + $disk + '). Ellenőrizd a lemezt!') ('Disk errors in the event log (' + $disk + '). Check the disk!') }
    if ($whea -gt 0) { Say 'warn' ('Hardverhiba-jelzések (WHEA): ' + $whea) ('Hardware error reports (WHEA): ' + $whea) }
    if ($bc -gt 0 -or $dumps.Count -gt 0) { Say 'warn' ('Kék halál: ' + [Math]::Max($bc, $dumps.Count) + ' alkalom. BlueScreenView megmutatja az okát.') ('Blue screens: ' + [Math]::Max($bc, $dumps.Count) + '. BlueScreenView shows the cause.') }
    elseif ($kp -gt 0) { Say 'warn' ('Váratlan leállás: ' + $kp + ' alkalom (táp, hő, áramszünet).') ('Unexpected shutdowns: ' + $kp + ' (power, heat, outages).') }
    if (-not $script:R['hu']) { Say 'ok' ('Nincs összeomlás az elmúlt ' + $days + ' napban.') ('No crashes in the last ' + $days + ' days.') }
}

$SuspectRx = '(\\AppData\\Local\\Temp\\|\\Windows\\Temp\\|\\Users\\Public\\|\\ProgramData\\[^\\]+\.(exe|dll|vbs|js)|powershell(\.exe)?\s.*(-enc|-e\s|-w\s+hidden|-windowstyle\s+hidden|downloadstring|iex)|mshta|wscript|cscript|regsvr32\s.*(http|scrobj)|rundll32\s.*(\\temp\\|\\appdata\\|javascript:)|cmd(\.exe)?\s+/c\s+start\s+/min)'

function R-startup-review($P) {
    if (-not (Need-Win)) { return }
    $items = @(W 'Win32_StartupCommand'); $sus = 0
    foreach ($s in $items) {
        $flag = ''
        if (([string]$s.Command) -match $SuspectRx) { $flag = '  <-- !'; $sus++ }
        D ([string]$s.Caption + ' = ' + [string]$s.Command + $flag)
    }
    if ($sus) { Say 'warn' ('' + $sus + ' gyanús indítási elem (ideiglenes mappa, rejtett szkript). Nézd át az Autoruns-ban.') ('' + $sus + ' suspicious startup items (temp folder, hidden script). Review in Autoruns.') }
    elseif ($items.Count -gt 12) { Say 'info' ('' + $items.Count + ' indítási elem: érdemes ritkítani.') ('' + $items.Count + ' startup items: worth trimming.') }
    else { Say 'ok' ('' + $items.Count + ' indítási elem, gyanús nincs.') ('' + $items.Count + ' startup items, none suspicious.') }
}

function R-sched-tasks-check($P) {
    if (-not (Need-Win)) { return }
    $svc = $null
    try { $svc = New-Object -ComObject Schedule.Service; $svc.Connect() } catch { Skip 'A Feladatütemező nem érhető el.' 'Task Scheduler not available.'; return }
    $sus = 0; $total = 0
    $stack = New-Object System.Collections.Stack; $stack.Push($svc.GetFolder('\'))
    while ($stack.Count -gt 0) {
        $f = $stack.Pop()
        try { foreach ($sub in @($f.GetFolders(0))) { $stack.Push($sub) } } catch { }
        try { $tasks = @($f.GetTasks(1)) } catch { $tasks = @() }
        foreach ($t in $tasks) {
            $total++
            try {
                $x = [xml]$t.Xml
                foreach ($ex in @($x.Task.Actions.Exec)) {
                    if (-not $ex) { continue }
                    $cmd = ([string]$ex.Command + ' ' + [string]$ex.Arguments).Trim()
                    if ($cmd -match $SuspectRx) { $sus++; D ($t.Path + ' = ' + $cmd) }
                }
            } catch { }
        }
    }
    D ('Tasks checked: ' + $total)
    if ($sus) { Say 'warn' ('' + $sus + ' gyanús ütemezett feladat. Nézd át az Autoruns Scheduled Tasks fülén.') ('' + $sus + ' suspicious scheduled tasks. Review them on the Autoruns Scheduled Tasks tab.') }
    else { Say 'ok' ('' + $total + ' ütemezett feladat, gyanús nincs.') ('' + $total + ' scheduled tasks, none suspicious.') }
}

function R-browser-policy-check($P) {
    if (-not (Need-Win)) { return }
    $found = 0
    foreach ($root in @('HKLM:\SOFTWARE\Policies', 'HKCU:\SOFTWARE\Policies')) {
        foreach ($b in @('Google\Chrome', 'Microsoft\Edge', 'Mozilla\Firefox', 'BraveSoftware\Brave')) {
            $k = Join-Path $root $b
            if (-not (Test-Path $k)) { continue }
            $props = @(); try { $props = @((Get-Item $k).Property) } catch { }
            $subs = @(Get-ChildItem $k -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName })
            D ($k + ': ' + (($props + $subs) -join ', '))
            foreach ($bad in @('ExtensionInstallForcelist', 'DefaultSearchProviderSearchURL', 'HomepageLocation', 'RestoreOnStartupURLs', 'ProxyServer', 'ProxyMode')) {
                if (($props + $subs) -contains $bad) { $found++ }
            }
        }
    }
    if ($found) { Say 'warn' ('Böngésző házirendek kényszerítenek beállítást (' + $found + '). Céges gépen ez normális, otthoni gépen gyakran kártevő.') ('Browser policies force settings (' + $found + '). Normal on company PCs, often malware on home PCs.') }
    else { Say 'ok' 'Nincs kényszerített böngésző házirend.' 'No forced browser policies.' }
}

function R-hosts-check($P) {
    if (-not (Need-Win)) { return }
    $h = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
    if (-not (Test-Path $h)) { Say 'warn' 'A hosts fájl hiányzik.' 'The hosts file is missing.'; return }
    $n = 0
    foreach ($l in [IO.File]::ReadAllLines($h)) { $t = $l.Trim(); if ($t -and -not $t.StartsWith('#')) { $n++; D $t } }
    if ($n -gt 2) { Say 'warn' ('A hosts fájlban ' + $n + ' egyedi bejegyzés van. Ellenőrizd, nem irányít-e át oldalakat.') ('The hosts file has ' + $n + ' custom entries. Check for redirects.') }
    else { Say 'ok' 'A hosts fájl tiszta.' 'The hosts file is clean.' }
}

function R-proxy-check($P) {
    if (-not (Need-Win)) { return }
    $is = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
    $p = $null; try { $p = Get-ItemProperty $is -ErrorAction Stop } catch { }
    $warn = $false
    if ($p) {
        if ([int]$p.ProxyEnable -eq 1) { D ('ProxyServer: ' + $p.ProxyServer); $warn = $true }
        if ($p.AutoConfigURL) { D ('AutoConfigURL: ' + $p.AutoConfigURL); $warn = $true }
    }
    $wh = Invoke-Cmd 'netsh.exe' 'winhttp show proxy' 30
    foreach ($l in $wh['out']) { if ($l -match '(\d+\.\d+\.\d+\.\d+|[a-z0-9.-]+):\d+') { D ('WinHTTP: ' + $l); $warn = $true } }
    if ($warn) { Say 'warn' 'Proxy van beállítva. Otthoni gépen ez gyakran kártevő vagy régi beállítás maradványa.' 'A proxy is set. On a home PC this is often malware or a leftover setting.' }
    else { Say 'ok' 'Nincs proxy beállítva.' 'No proxy configured.' }
}

function R-net-diag($P) {
    if (-not (Need-Win)) { return }
    $pr = Get-Primary
    if (-not $pr) { Say 'fail' 'Nincs aktív hálózati kapcsolat átjáróval (kábel, Wi-Fi vagy DHCP hiba).' 'No active connection with a gateway (cable, Wi-Fi or DHCP problem).'; return }
    D ('Adapter: ' + $pr['name']); D ('IP: ' + $pr['ip'] + ' / ' + $pr['mask'] + '  GW: ' + $pr['gateway'] + '  DNS: ' + $pr['dns'])
    if ($pr['ip'] -match '^169\.254\.') { Say 'fail' 'Nincs érvényes IP-cím (169.254.x.x): a router DHCP-je nem válaszol.' 'No valid IP (169.254.x.x): the router DHCP is not answering.'; return }
    $ping = New-Object System.Net.NetworkInformation.Ping
    $png = { param($h) try { $r = $ping.Send($h, 1500); if ($r.Status -eq 'Success') { return [int]$r.RoundtripTime } } catch { }; return -1 }
    $g = & $png $pr['gateway']; D ('Ping gateway: ' + @{ $true = "$g ms"; $false = 'FAIL' }[$g -ge 0])
    $i = & $png '8.8.8.8'; D ('Ping 8.8.8.8: ' + @{ $true = "$i ms"; $false = 'FAIL' }[$i -ge 0])
    $dnsOk = $false; try { $a = [Net.Dns]::GetHostAddresses('www.microsoft.com'); $dnsOk = ($a.Count -gt 0) } catch { }
    D ('DNS www.microsoft.com: ' + @{ $true = 'OK'; $false = 'FAIL' }[$dnsOk])
    $http = $false
    try { $wc = New-Object Net.WebClient; $t = $wc.DownloadString('http://www.msftconnecttest.com/connecttest.txt'); $http = ($t -match 'Microsoft Connect Test') ; D ('HTTP: ' + @{ $true = 'OK'; $false = 'unexpected content (captive portal?)' }[$http]) } catch { D ('HTTP: FAIL ' + $_.Exception.Message) }
    if ($g -lt 0 -and $i -lt 0) { Say 'fail' 'A router sem válaszol: kábel, Wi-Fi kapcsolat vagy a router a hibás.' 'The router does not answer: cable, Wi-Fi link or the router is at fault.' }
    elseif ($i -lt 0 -and -not $dnsOk) { Say 'fail' 'A router elérhető, az internet nem: szolgáltató vagy router WAN hiba. Indítsd újra a routert.' 'Router reachable, internet not: ISP or router WAN fault. Restart the router.' }
    elseif (-not $dnsOk) { Say 'fail' 'Van internet, de a névfeloldás (DNS) hibás. Futtasd a DNS ürítést, vagy állíts be 1.1.1.1-et.' 'Internet works but DNS fails. Flush DNS or set 1.1.1.1.' }
    elseif (-not $http) { Say 'warn' 'A DNS működik, de a weboldal nem töltődik: proxy, tűzfal vagy bejelentkező oldal (hotel Wi-Fi).' 'DNS works but web fails: proxy, firewall or a captive portal.' }
    else {
        if ($i -gt 150) { Say 'warn' ('Működik, de lassú a válaszidő (' + $i + ' ms).') ('Working but latency is high (' + $i + ' ms).') }
        else { Say 'ok' ('Az internet működik (' + $i + ' ms).') ('Internet works (' + $i + ' ms).') }
    }
}

function R-perf-snapshot($P) {
    if (-not (Need-Win)) { return }
    $a = @{}; foreach ($p in @(Get-Process -ErrorAction SilentlyContinue)) { try { $a[$p.Id] = $p.TotalProcessorTime.TotalMilliseconds } catch { } }
    Start-Sleep -Seconds 3
    $rows = @()
    foreach ($p in @(Get-Process -ErrorAction SilentlyContinue)) {
        $c = 0; try { if ($a.ContainsKey($p.Id)) { $c = ($p.TotalProcessorTime.TotalMilliseconds - $a[$p.Id]) / 30 / [Environment]::ProcessorCount } } catch { }
        $rows += @{ name = $p.ProcessName; cpu = [Math]::Round($c, 1); mem = (MB $p.WorkingSet64) }
    }
    D '-- CPU %'; foreach ($r in @($rows | Sort-Object { $_['cpu'] } -Descending | Select-Object -First 6)) { D ('  ' + $r['name'] + '  ' + $r['cpu'] + '%') }
    D '-- RAM MB'; foreach ($r in @($rows | Sort-Object { $_['mem'] } -Descending | Select-Object -First 6)) { D ('  ' + $r['name'] + '  ' + $r['mem']) }
    $o = @(W 'Win32_OperatingSystem'); $memPct = 0
    if ($o.Count) { $memPct = [int](100 - 100 * [double]$o[0].FreePhysicalMemory / [double]$o[0].TotalVisibleMemorySize); D ('RAM used: ' + $memPct + '% of ' + [Math]::Round([double]$o[0].TotalVisibleMemorySize / 1MB, 1) + ' GB') }
    $cpu = @(W 'Win32_Processor'); $load = 0; foreach ($c in $cpu) { $load += [int]$c.LoadPercentage }; if ($cpu.Count) { $load = [int]($load / $cpu.Count); D ('CPU load: ' + $load + '%') }
    $plan = Invoke-Cmd 'powercfg.exe' '/getactivescheme' 20
    $pg = ''; foreach ($l in $plan['out']) { $m = [regex]::Match($l, '[0-9a-f]{8}-[0-9a-f-]{27}'); if ($m.Success) { $pg = $m.Value } }
    $planName = @{ '381b4222-f694-41f0-9685-ff5bb260df2e' = 'Balanced'; '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c' = 'High performance'; 'a1841308-3bcb-4fda-a4f5-ed11bb9e3c6b' = 'Power saver'; 'e9a42b02-d5df-448d-aa00-03f14749eb61' = 'Ultimate' }[$pg]
    if (-not $planName) { $planName = 'Custom ' + $pg }
    D ('Power plan: ' + $planName)
    $hdd = $false; foreach ($d in @(W 'MSFT_PhysicalDisk' 'root\Microsoft\Windows\Storage')) { if ([int]$d.MediaType -eq 3 -and [int]$d.BusType -ne 7) { $hdd = $true } }
    $tips = @(); $tipsEn = @()
    if ($memPct -gt 85) { $tips += 'kevés a memória'; $tipsEn += 'memory is short' }
    if ($load -gt 80) { $tips += 'magas CPU terhelés'; $tipsEn += 'high CPU load' }
    if ($hdd) { $tips += 'HDD (SSD-csere javasolt)'; $tipsEn += 'HDD (SSD swap advised)' }
    if ($planName -eq 'Power saver') { $tips += 'energiatakarékos mód'; $tipsEn += 'power saver plan' }
    if ($tips.Count) { Say 'warn' ('Lassító tényezők: ' + ($tips -join ', ') + '.') ('Slowdown factors: ' + ($tipsEn -join ', ') + '.') }
    else { Say 'ok' 'Nincs nyilvánvaló lassító tényező.' 'No obvious slowdown factor.' }
}

function R-battery-check($P) {
    if (-not (Need-Win)) { return }
    $bat = @(W 'Win32_Battery')
    if (-not $bat.Count) { Skip 'Nincs akkumulátor (asztali gép).' 'No battery (desktop PC).'; return }
    $sd = @(W 'BatteryStaticData' 'root\wmi'); $fc = @(W 'BatteryFullChargedCapacity' 'root\wmi'); $cc = @(W 'BatteryCycleCount' 'root\wmi')
    $wear = $null
    if ($sd.Count -and $fc.Count -and [double]$sd[0].DesignedCapacity -gt 0) {
        $wear = [int][Math]::Max(0, 100 - 100 * [double]$fc[0].FullChargedCapacity / [double]$sd[0].DesignedCapacity)
        D ('Design: ' + [Math]::Round([double]$sd[0].DesignedCapacity / 1000, 1) + ' Wh, full: ' + [Math]::Round([double]$fc[0].FullChargedCapacity / 1000, 1) + ' Wh, wear: ' + $wear + '%')
    }
    if ($cc.Count) { D ('Cycles: ' + $cc[0].CycleCount) }
    if ([int]$OS['major'] * 100 + [int]$OS['minor'] -ge 602) {
        $f = Join-Path (Get-BackupDir '') 'battery-report.html'
        [void](Invoke-Cmd 'powercfg.exe' ('/batteryreport /output "' + $f + '"') 60)
        if (Test-Path $f) { F $f }
    }
    if ($null -eq $wear) { Say 'info' 'Akkumulátor megvan, a kopás nem olvasható ki. Nézd meg a jelentést.' 'Battery found, wear unreadable. See the report.' }
    elseif ($wear -ge 30) { Say 'warn' ('Az akkumulátor ' + $wear + '%-ot kopott: cserét érdemes tervezni.') ('Battery wear ' + $wear + '%: plan a replacement.') }
    else { Say 'ok' ('Az akkumulátor rendben (' + $wear + '% kopás).') ('Battery OK (' + $wear + '% wear).') }
}

function Get-TempTargets {
    $t = @()
    if ($env:TEMP) { $t += $env:TEMP }
    $t += (Join-Path $env:SystemRoot 'Temp')
    $t += (Join-Path $env:ProgramData 'Microsoft\Windows\WER\ReportQueue')
    $t += (Join-Path $env:ProgramData 'Microsoft\Windows\WER\ReportArchive')
    if ($env:LOCALAPPDATA) { $t += (Join-Path $env:LOCALAPPDATA 'CrashDumps') }
    return $t
}

function R-temp-size($P) {
    if (-not (Need-Win)) { return }
    $sum = 0
    foreach ($d in (Get-TempTargets)) { $b = Get-DirBytes $d 10; $sum += $b; if ($b -gt 0) { D ($d + ': ' + (MB $b) + ' MB') } }
    $do = Join-Path $env:SystemRoot 'SoftwareDistribution\DeliveryOptimization'
    $b = Get-DirBytes $do 10; if ($b -gt 0) { D ('Delivery Optimization: ' + (MB $b) + ' MB') }
    $sum += $b
    if ($sum -gt 2GB) { Say 'info' ('' + [Math]::Round($sum / 1GB, 1) + ' GB ideiglenes adat takarítható.') ('' + [Math]::Round($sum / 1GB, 1) + ' GB of temporary data can be cleaned.') }
    else { Say 'ok' ('' + (MB $sum) + ' MB ideiglenes adat.') ('' + (MB $sum) + ' MB of temporary data.') }
}

function R-printer-status($P) {
    if (-not (Need-Win)) { return }
    $sp = Get-Service -Name Spooler -ErrorAction SilentlyContinue
    D ('Spooler: ' + $sp.Status)
    $off = 0
    foreach ($p in @(W 'Win32_Printer')) {
        $flags = @(); if ($p.Default) { $flags += 'default' }; if ($p.WorkOffline) { $flags += 'OFFLINE'; $off++ }
        D ($p.Name + ' · ' + $p.PortName + ' · ' + ($flags -join ', '))
    }
    $jobs = @(W 'Win32_PrintJob'); D ('Jobs in queue: ' + $jobs.Count)
    foreach ($j in $jobs) { D ('  ' + $j.Name + ' · ' + $j.JobStatus) }
    if ($sp.Status -ne 'Running') { Say 'fail' 'A nyomtatásvezérlő szolgáltatás nem fut.' 'The print spooler is not running.' }
    elseif ($jobs.Count -gt 0) { Say 'warn' ('' + $jobs.Count + ' elakadt feladat a sorban: a sor ürítése segíthet.') ('' + $jobs.Count + ' stuck jobs in the queue: clearing it may help.') }
    elseif ($off) { Say 'warn' 'Van offline jelölésű nyomtató: ellenőrizd az IP-címét és a portot.' 'A printer is marked offline: check its IP and port.' }
    else { Say 'ok' 'A nyomtatási rendszer rendben.' 'Printing looks fine.' }
}

function R-activation-check($P) {
    if (-not (Need-Win)) { return }
    $lic = $null
    try { $lic = @(Get-WmiObject -Query "SELECT Name, LicenseStatus, PartialProductKey FROM SoftwareLicensingProduct WHERE ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL" -ErrorAction Stop) } catch { }
    if (-not $lic) { Say 'warn' 'Az aktiválás állapota nem olvasható ki.' 'Activation status could not be read.'; return }
    $names = @{ 0 = 'Unlicensed'; 1 = 'Licensed'; 2 = 'OOB grace'; 3 = 'OOT grace'; 4 = 'Non-genuine grace'; 5 = 'Notification'; 6 = 'Extended grace' }
    $ok = $false
    foreach ($l in $lic) { D ($l.Name + ' · ' + $names[[int]$l.LicenseStatus] + ' · *****-' + $l.PartialProductKey); if ([int]$l.LicenseStatus -eq 1) { $ok = $true } }
    if ($ok) { Say 'ok' 'A Windows aktiválva van.' 'Windows is activated.' } else { Say 'warn' 'A Windows nincs aktiválva.' 'Windows is not activated.' }
}

function R-restore-status($P) {
    if (-not (Need-Win)) { return }
    $pts = @(); try { $pts = @(Get-WmiObject -Namespace root\default -Class SystemRestore -ErrorAction Stop) } catch { }
    foreach ($p in @($pts | Select-Object -Last 5)) { D ((WDate $p.CreationTime) + ' · ' + $p.Description) }
    if (-not $pts.Count) { Say 'warn' 'Nincs visszaállítási pont (lehet, hogy ki van kapcsolva).' 'No restore points (protection may be off).' }
    else { Say 'ok' ('' + $pts.Count + ' visszaállítási pont van.') ('' + $pts.Count + ' restore points exist.') }
}

# OUI hints for common network and smart-home vendors. A hint, not proof.
$Oui = @{}
foreach ($x in @('B827EB', 'DCA632', 'E45F01', 'D83ADD', '28CDC1', '2CCF67')) { $Oui[$x] = 'Raspberry Pi' }
foreach ($x in @('240AC4', '246F28', '2462AB', '30AEA4', '3C71BF', '40F520', '483FDA', '4C11AE', '5CCF7F', '600194', '68C63A', '7C9EBD', '807D3A', '840D8E', '84CCA8', '84F3EB', '8CAAB5', '94B97E', '98F4AB', 'A020A6', 'A4CF12', 'AC67B2', 'B4E62D', 'BCDDC2', 'C44F33', 'C82B96', 'CC50E3', 'D8BFC0', 'DC4F22', 'E8DB84', 'ECFABC', '083AF2', '10521C', '349454', '58BF25', '78E36D', '2CF432', 'C8C9A3', 'E09806', '18FE34')) { $Oui[$x] = 'Espressif (ESP: Shelly, Sonoff, Tasmota...)' }
foreach ($x in @('24A43C', '44D9E7', '687251', '788A20', '802AA8', 'B4FBE4', 'F09FC2', 'FCECDA', '7483C2', 'E063DA')) { $Oui[$x] = 'Ubiquiti' }
foreach ($x in @('4C5E0C', '64D154', '6C3B6B', 'B869F4', 'CC2DE0', 'D4CA6D', 'E48D8C', '744D28', '488F5A', 'DC2C6E')) { $Oui[$x] = 'MikroTik' }
foreach ($x in @('3CA62F', '7CFF4D', 'C80E14', '444E6D', '2C91AB', 'DC396F')) { $Oui[$x] = 'AVM (FRITZ!)' }
foreach ($x in @('50C7BF', '98DAC4', 'AC84C6', '6032B1', 'B04E26', '1C3BF3', 'C006C3', '5CA6E6')) { $Oui[$x] = 'TP-Link' }
foreach ($x in @('4419B6', '54C415', 'C056E3', 'BCAD28', '4CBD8F', '2857BE')) { $Oui[$x] = 'Hikvision' }
foreach ($x in @('3CEF8C', 'E0508B', '9002A9', '4C11BF')) { $Oui[$x] = 'Dahua' }
foreach ($x in @('001788', 'ECB5FA')) { $Oui[$x] = 'Philips Hue (Signify)' }
foreach ($x in @('000E58', '5CAAFD', '949F3E', 'B8E937', '48A6B8', '7828CA')) { $Oui[$x] = 'Sonos' }
foreach ($x in @('F4F5D8', 'F4F5E8', '546009', '30FD38')) { $Oui[$x] = 'Google (Nest, Chromecast)' }
foreach ($x in @('44650D', '74C246', 'F0272D', '6837E9', 'FC65DE', '0C47C9')) { $Oui[$x] = 'Amazon (Echo, Fire)' }
foreach ($x in @('286C07', '640980', '7811DC', '7C49EB')) { $Oui[$x] = 'Xiaomi' }
$Oui['001132'] = 'Synology'; $Oui['504F94'] = 'Loxone'; $Oui['70EE50'] = 'Netatmo'

function Get-Vendor([string]$Mac) {
    $h = ($Mac -replace '[^0-9A-Fa-f]', '').ToUpper()
    if ($h.Length -lt 6) { return '' }
    if ($Oui.ContainsKey($h.Substring(0, 6))) { return $Oui[$h.Substring(0, 6)] }
    $second = [Convert]::ToInt32($h.Substring(1, 1), 16)
    if (($second -band 2) -ne 0) { return '(véletlen MAC – telefon/tablet? / random MAC – phone?)' }
    return ''
}

function ConvertTo-UInt32([string]$Ip) { $b = [Net.IPAddress]::Parse($Ip).GetAddressBytes(); [Array]::Reverse($b); return [BitConverter]::ToUInt32($b, 0) }
function ConvertFrom-UInt32([uint32]$N) { $b = [BitConverter]::GetBytes($N); [Array]::Reverse($b); return (New-Object Net.IPAddress(, $b)).ToString() }

function R-lan-scan($P) {
    if (-not (Need-Win)) { return }
    $pr = Get-Primary
    if (-not $pr) { Say 'fail' 'Nincs aktív hálózat.' 'No active network.'; return }
    $ip = ConvertTo-UInt32 $pr['ip']; $mask = ConvertTo-UInt32 $pr['mask']
    if ($mask -lt (ConvertTo-UInt32 '255.255.255.0')) { $mask = ConvertTo-UInt32 '255.255.255.0' }
    $net = $ip -band $mask; $bc = $net -bor (-bnot $mask -band [uint32]::MaxValue)
    $targets = @(); for ($n = [uint32]($net + 1); $n -lt $bc; $n++) { $targets += (ConvertFrom-UInt32 $n) }
    D ('Range: ' + (ConvertFrom-UInt32 ($net + 1)) + ' - ' + (ConvertFrom-UInt32 ($bc - 1)) + ' (' + $targets.Count + ')')
    $pool = [RunspaceFactory]::CreateRunspacePool(1, 64); $pool.Open()
    $sb = {
        param($h)
        $res = @($h, -1, '')
        try { $p = New-Object System.Net.NetworkInformation.Ping; $r = $p.Send($h, 500); if ($r.Status -eq 'Success') { $res[1] = [int]$r.RoundtripTime } } catch { }
        if ($res[1] -ge 0) { try { $res[2] = [System.Net.Dns]::GetHostEntry($h).HostName } catch { } }
        return ,$res
    }
    $jobs = @()
    foreach ($t in $targets) {
        $ps = [System.Management.Automation.PowerShell]::Create(); $ps.RunspacePool = $pool
        [void]$ps.AddScript($sb).AddArgument($t)
        $jobs += @{ ps = $ps; h = $ps.BeginInvoke() }
    }
    $alive = @{}
    foreach ($j in $jobs) {
        try { $o = $j.ps.EndInvoke($j.h); foreach ($r in $o) { if ($r -and $r[1] -ge 0) { $alive[$r[0]] = @{ ms = $r[1]; name = $r[2] } } } } catch { }
        $j.ps.Dispose()
    }
    $pool.Close()
    $arp = Invoke-Cmd 'arp.exe' '-a' 30
    $devs = @{}
    foreach ($l in $arp['out']) {
        $m = [regex]::Match($l, '^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F]{2}([-:][0-9a-fA-F]{2}){5})')
        if (-not $m.Success) { continue }
        $a = $m.Groups[1].Value; $mac = $m.Groups[2].Value.ToUpper().Replace('-', ':')
        if ($mac -eq 'FF:FF:FF:FF:FF:FF' -or $mac.StartsWith('01:00:5E')) { continue }
        $u = ConvertTo-UInt32 $a; if ($u -le $net -or $u -ge $bc) { continue }
        $devs[$a] = @{ ip = $a; mac = $mac }
    }
    foreach ($k in @($alive.Keys)) { if (-not $devs.ContainsKey($k)) { $devs[$k] = @{ ip = $k; mac = '' } } }
    $devs[$pr['ip']] = @{ ip = $pr['ip']; mac = ([string]$pr['mac']).ToUpper(); self = $true }
    $rows = @()
    foreach ($k in @($devs.Keys | Sort-Object { ConvertTo-UInt32 $_ })) {
        $d = $devs[$k]
        $row = @{ IP = $d['ip']; MAC = $d['mac']; Vendor = (Get-Vendor $d['mac']); Name = ''; Ping = '' }
        if ($alive.ContainsKey($k)) { $row['Name'] = $alive[$k]['name']; $row['Ping'] = '' + $alive[$k]['ms'] + ' ms' }
        if ($d['self']) { $row['Name'] = 'this PC / ez a gép' }
        if ($k -eq $pr['gateway']) { $row['Name'] = ('router / átjáró ' + $row['Name']).Trim() }
        $rows += $row
        D ($row['IP'] + '  ' + $row['MAC'] + '  ' + $row['Vendor'] + '  ' + $row['Name'])
    }
    $csv = Join-Path (Get-BackupDir 'survey') ('lan-' + (Get-Date).ToString('HHmm') + '.csv')
    Write-Csv $csv @('IP', 'MAC', 'Vendor', 'Name', 'Ping') $rows; F $csv
    Say 'ok' ('' + $rows.Count + ' eszköz a hálózaton. A lista a jelentés mellé mentve.') ('' + $rows.Count + ' devices on the network. List saved with the report.')
}

function R-wifi-survey($P) {
    if (-not (Need-Win)) { return }
    $r = Invoke-Cmd 'netsh.exe' 'wlan show networks mode=bssid' 60
    if ($r['code'] -ne 0 -or -not (@($r['out']) -match '^BSSID')) {
        Skip 'Nincs Wi-Fi adapter, vagy a WLAN szolgáltatás nem fut.' 'No Wi-Fi adapter, or the WLAN service is not running.'; return
    }
    $rows = @(); $ssid = ''; $cur = $null
    foreach ($l in $r['out']) {
        $m = [regex]::Match($l, '^SSID\s+\d+\s*:\s*(.*)$')
        if ($m.Success) { $ssid = $m.Groups[1].Value.Trim(); if (-not $ssid) { $ssid = '(hidden)' }; continue }
        $m = [regex]::Match($l, '^BSSID\s+\d+\s*:\s*([0-9a-fA-F:]{17})')
        if ($m.Success) { if ($cur) { $rows += $cur }; $cur = @{ SSID = $ssid; BSSID = $m.Groups[1].Value.ToUpper(); Signal = ''; Channel = ''; Band = '' }; continue }
        if (-not $cur) { continue }
        $kv = [regex]::Match($l, '^[^:]+:\s*(.+)$'); if (-not $kv.Success) { continue }
        $v = $kv.Groups[1].Value.Trim()
        if (-not $cur['Signal'] -and $v -match '^(\d+)\s*%$') { $cur['Signal'] = $matches[1]; continue }
        if ($v -match '6\s*GHz') { $cur['Band'] = '6 GHz' }
        if (-not $cur['Channel'] -and $v -match '^\d{1,3}$' -and [int]$v -ge 1 -and [int]$v -le 233) { $cur['Channel'] = $v }
    }
    if ($cur) { $rows += $cur }
    $count = @{}
    foreach ($w in $rows) {
        if (-not $w['Band']) { if ($w['Channel'] -and [int]$w['Channel'] -le 14) { $w['Band'] = '2.4 GHz' } else { $w['Band'] = '5 GHz' } }
        $dbm = ''; if ($w['Signal']) { $dbm = [int]([int]$w['Signal'] / 2 - 100) }; $w['dBm'] = '' + $dbm
        if ($w['Band'] -eq '2.4 GHz' -and $w['Channel']) {
            $ch = [int]$w['Channel']
            foreach ($c in @(1, 6, 11)) { if ([Math]::Abs($ch - $c) -le 2) { $count[$c] = [int]$count[$c] + 1 } }
        }
    }
    foreach ($w in @($rows | Sort-Object { - [int]('0' + $_['Signal']) })) { D ($w['Signal'] + '%  ch ' + $w['Channel'] + '  ' + $w['Band'] + '  ' + $w['SSID']) }
    $best = 1; foreach ($c in @(6, 11)) { if ([int]$count[$c] -lt [int]$count[$best]) { $best = $c } }
    D ('2.4 GHz load: ch1=' + [int]$count[1] + '  ch6=' + [int]$count[6] + '  ch11=' + [int]$count[11])
    $ci = Invoke-Cmd 'netsh.exe' 'wlan show interfaces' 30
    foreach ($l in $ci['out']) { if ($l -match '^SSID\s*:\s*(.+)$') { D ('Connected: ' + $matches[1]) }; if ($l -match ':\s*(\d+)\s*%$') { D ('Connected signal: ' + $matches[1] + '%') } }
    $csv = Join-Path (Get-BackupDir 'survey') ('wifi-' + (Get-Date).ToString('HHmm') + '.csv')
    Write-Csv $csv @('SSID', 'BSSID', 'Signal', 'dBm', 'Channel', 'Band') $rows; F $csv
    Say 'ok' ('' + $rows.Count + ' hozzáférési pont. 2,4 GHz-en a legkevésbé zsúfolt csatorna: ' + $best + '.') ('' + $rows.Count + ' access points. Least crowded 2.4 GHz channel: ' + $best + '.')
}

function R-port-check($P) {
    if (-not (Need-Win)) { return }
    $hosts = [string](Get-Key $P 'hosts' '')
    if (-not $hosts) { $pr = Get-Primary; if ($pr) { $hosts = $pr['gateway'] } }
    $ports = [string](Get-Key $P 'ports' '22,80,443,502,554,1883,8080,8123')
    $names = @{ 22 = 'SSH'; 80 = 'HTTP'; 443 = 'HTTPS'; 502 = 'Modbus TCP'; 554 = 'RTSP'; 1883 = 'MQTT'; 8883 = 'MQTT TLS'; 8080 = 'HTTP alt'; 8123 = 'Home Assistant'; 5000 = 'Synology'; 3389 = 'RDP'; 445 = 'SMB'; 1880 = 'Node-RED'; 6052 = 'ESPHome' }
    $open = 0
    foreach ($h in ($hosts -split '[,;\s]+')) {
        if (-not $h) { continue }
        if ($h -notmatch '^[A-Za-z0-9.\-]{1,253}$') { D ('Skipped invalid host: ' + $h); continue }
        $list = @()
        foreach ($pt in ($ports -split '[,;\s]+')) {
            if ($pt -notmatch '^\d{1,5}$') { continue }
            $c = New-Object Net.Sockets.TcpClient
            try { $ar = $c.BeginConnect($h, [int]$pt, $null, $null); $ok = $ar.AsyncWaitHandle.WaitOne(600, $false) -and $c.Connected } catch { $ok = $false } finally { $c.Close() }
            if ($ok) { $open++; $nm = $names[[int]$pt]; $list += ('' + $pt + $(if ($nm) { ' ' + $nm } else { '' })) }
        }
        D ($h + ': ' + $(if ($list.Count) { $list -join ', ' } else { '-' }))
    }
    Say 'ok' ('' + $open + ' nyitott port.') ('' + $open + ' open ports.')
}

function R-programs-export($P) {
    if (-not (Need-Win)) { return }
    $progs = Get-Programs
    $rows = @(); foreach ($p in $progs) { $rows += @{ Name = $p['name']; Version = $p['version']; Publisher = $p['publisher']; SizeMB = '' + $p['sizeMB']; Installed = $p['installed'] } }
    $f = Join-Path (Get-BackupDir '') 'programs.csv'
    Write-Csv $f @('Name', 'Version', 'Publisher', 'SizeMB', 'Installed') $rows; F $f
    Say 'ok' ('' + $rows.Count + ' program listája mentve.') ('List of ' + $rows.Count + ' programs saved.')
}

function R-user-folders-size($P) {
    if (-not (Need-Win)) { return }
    $total = 0
    $shell = $null; try { $shell = New-Object -ComObject Shell.Application } catch { }
    $known = @(@('Desktop', [Environment]::GetFolderPath('Desktop')), @('Documents', [Environment]::GetFolderPath('MyDocuments')),
               @('Pictures', [Environment]::GetFolderPath('MyPictures')), @('Music', [Environment]::GetFolderPath('MyMusic')),
               @('Videos', (Join-Path $env:USERPROFILE 'Videos')), @('Downloads', (Join-Path $env:USERPROFILE 'Downloads')))
    foreach ($k in $known) { $b = Get-DirBytes $k[1] 25; $total += $b; D ($k[0] + ': ' + [Math]::Round($b / 1GB, 2) + ' GB  (' + $k[1] + ')') }
    $od = $env:OneDrive; if ($od -and (Test-Path $od)) { D ('OneDrive: ' + $od + ' (cloud, may be partly offline)') }
    D ('Other profiles: ' + ((@(Get-ChildItem (Split-Path $env:USERPROFILE) -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer -and $_.Name -notmatch '^(Public|Default|All Users|Default User)$' }) | ForEach-Object { $_.Name }) -join ', '))
    Say 'ok' ('A felhasználói mappák kb. ' + [Math]::Round($total / 1GB, 1) + ' GB-ot foglalnak (ennyi hely kell a mentéshez).') ('User folders take about ' + [Math]::Round($total / 1GB, 1) + ' GB (space needed for the backup).')
}

# ------------------------------------------------------------------ routines: actions
function R-restore-point($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    if ("" + $OS['name'] -match 'Server') { Skip 'Szerveren nincs rendszer-visszaállítás.' 'No System Restore on servers.'; return }
    $sr = $null; try { $sr = [wmiclass]'\\.\root\default:SystemRestore' } catch { Say 'fail' 'A rendszer-visszaállítás nem érhető el.' 'System Restore is not available.'; return }
    try { [void]$sr.Enable(($env:SystemDrive + '\')) } catch { }
    $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore'
    $had = $null; try { $had = (Get-ItemProperty $key -Name SystemRestorePointCreationFrequency -ErrorAction Stop).SystemRestorePointCreationFrequency } catch { }
    try { Set-ItemProperty $key -Name SystemRestorePointCreationFrequency -Value 0 -Type DWord -ErrorAction Stop } catch { }
    $desc = 'ServiceKit ' + (Get-Date).ToString('yyyy-MM-dd HH:mm'); if ($script:RunDef['job']) { $desc = 'ServiceKit ' + $script:RunDef['job'] }
    $rc = -1; try { $rc = [int]($sr.CreateRestorePoint($desc, 12, 100)).ReturnValue } catch { D $_.Exception.Message }
    if ($null -eq $had) { Remove-ItemProperty $key -Name SystemRestorePointCreationFrequency -ErrorAction SilentlyContinue } else { Set-ItemProperty $key -Name SystemRestorePointCreationFrequency -Value $had -Type DWord -ErrorAction SilentlyContinue }
    D ('Return: ' + $rc + '  ' + $desc)
    if ($rc -eq 0) { Say 'ok' 'Visszaállítási pont létrehozva.' 'Restore point created.' }
    else { Say 'warn' 'Nem sikerült visszaállítási pontot létrehozni (ki van kapcsolva vagy kevés a hely).' 'Could not create a restore point (disabled or low space).' }
}

function R-enable-restore($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    try { [void]([wmiclass]'\\.\root\default:SystemRestore').Enable(($env:SystemDrive + '\')) } catch { Say 'fail' 'Nem sikerült bekapcsolni.' 'Could not enable it.'; return }
    $r = Invoke-Cmd 'vssadmin.exe' ('resize shadowstorage /for=' + $env:SystemDrive + ' /on=' + $env:SystemDrive + ' /maxsize=5%') 60
    Say 'ok' 'Rendszervédelem bekapcsolva a C: meghajtón (max. 5% hely).' 'System protection enabled on C: (max 5% space).'
}

function R-temp-cleanup($P) {
    if (-not (Need-Win)) { return }
    $freed = 0; $files = 0; $locked = 0
    foreach ($d in (Get-TempTargets)) {
        $r = Clear-Folder $d 24
        $freed += $r['bytes']; $files += $r['files']; $locked += $r['locked']
        if ($r['files']) { D ($d + ': ' + (MB $r['bytes']) + ' MB, ' + $r['files'] + ' files') }
    }
    D ('Locked/in use (left): ' + $locked)
    Say 'ok' ('' + (MB $freed) + ' MB felszabadítva (' + $files + ' fájl).') ('' + (MB $freed) + ' MB freed (' + $files + ' files).')
}

function R-recycle-empty($P) {
    if (-not (Need-Win)) { return }
    $sh = New-Object -ComObject Shell.Application
    $rb = $sh.NameSpace(10); $n = 0; $bytes = 0
    foreach ($i in @($rb.Items())) { $n++; try { $bytes += [double]$i.Size } catch { } }
    if ($n -eq 0) { Say 'ok' 'A Lomtár már üres.' 'The Recycle Bin is already empty.'; return }
    if (Get-Command Clear-RecycleBin -ErrorAction SilentlyContinue) { Clear-RecycleBin -Force -ErrorAction SilentlyContinue }
    else { foreach ($i in @($rb.Items())) { try { Remove-Item -LiteralPath $i.Path -Recurse -Force -ErrorAction Stop } catch { } } }
    Say 'ok' ('Lomtár ürítve: ' + $n + ' elem, ' + (MB $bytes) + ' MB.') ('Recycle Bin emptied: ' + $n + ' items, ' + (MB $bytes) + ' MB.')
}

function R-do-cache-clean($P) {
    if (-not (Need-Win)) { return }
    if (-not (Get-Command Delete-DeliveryOptimizationCache -ErrorAction SilentlyContinue)) { Skip 'Ezen a Windowson nincs Kézbesítésoptimalizálás gyorsítótár.' 'No Delivery Optimization cache on this Windows.'; return }
    if (-not (Need-Admin)) { return }
    $d = Join-Path $env:SystemRoot 'SoftwareDistribution\DeliveryOptimization'; $before = Get-DirBytes $d 10
    try { Delete-DeliveryOptimizationCache -Force -ErrorAction Stop } catch { D $_.Exception.Message }
    $after = Get-DirBytes $d 10
    Say 'ok' ('' + (MB ($before - $after)) + ' MB frissítési gyorsítótár törölve.') ('' + (MB ($before - $after)) + ' MB update cache removed.')
}

function Invoke-Dism([string]$DismArgs, [string]$What, [int]$Timeout = 3600) {
    $r = Invoke-Cmd 'dism.exe' $DismArgs $Timeout
    foreach ($l in (Tail $r['out'] 4)) { D $l }
    if ($r['code'] -eq 0) { Say 'ok' ($What + ': sikeres.') ($What + ': success.') }
    elseif ($r['code'] -eq 3010) { Say 'ok' ($What + ': sikeres, újraindítás szükséges.') ($What + ': success, restart required.') }
    elseif ($r['code'] -eq -2) { Say 'fail' ($What + ': időtúllépés.') ($What + ': timed out.') }
    else { Say 'fail' ($What + ': hiba (kód ' + $r['code'] + '). Internet kapcsolat kell hozzá.') ($What + ': failed (code ' + $r['code'] + '). It needs internet access.') }
}

function R-dism-component-cleanup($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Build 6 2 'DISM StartComponentCleanup')) { return }; if (-not (Need-Admin)) { return }
    Invoke-Dism '/Online /Cleanup-Image /StartComponentCleanup' 'Összetevő-tisztítás / Component cleanup' 3600
}

function R-dism-restore($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Build 6 2 'DISM RestoreHealth')) { return }; if (-not (Need-Admin)) { return }
    Invoke-Dism '/Online /Cleanup-Image /RestoreHealth' 'DISM RestoreHealth' 3600
}

function R-sfc($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    $start = (Get-Date).AddSeconds(-5).ToString('yyyy-MM-dd HH:mm:ss')
    $r = Invoke-Cmd (Join-Path $env:SystemRoot 'System32\sfc.exe') '/scannow' 3600
    $cbs = Join-Path $env:SystemRoot 'Logs\CBS\CBS.log'
    $repaired = 0; $cannot = 0; $seen = 0
    if (Test-Path $cbs) {
        try {
            $fs = New-Object IO.FileStream($cbs, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]'ReadWrite, Delete')
            $sr = New-Object IO.StreamReader($fs)
            while ($null -ne ($l = $sr.ReadLine())) {
                if ($l.Length -lt 19 -or $l.Substring(0, 19).CompareTo($start) -lt 0) { continue }
                if ($l -match '\[SR\]') { $seen++ }
                if ($l -match '\[SR\] Cannot repair member file') { $cannot++; if ($cannot -le 10) { D $l.Substring([Math]::Max(0, $l.IndexOf('[SR]'))) } }
                elseif ($l -match '\[SR\] Repairing corrupted file|\[SR\] Repaired file') { $repaired++ }
            }
            $sr.Close()
        } catch { D ('CBS.log: ' + $_.Exception.Message) }
    }
    D ('Exit: ' + $r['code'] + '  [SR] lines: ' + $seen + '  repaired: ' + $repaired + '  cannot repair: ' + $cannot)
    if ($cannot) { Say 'fail' ('Az SFC ' + $cannot + ' sérült fájlt nem tudott javítani. Futtasd a DISM RestoreHealth-et, majd újra az SFC-t.') ('SFC could not repair ' + $cannot + ' files. Run DISM RestoreHealth, then SFC again.') }
    elseif ($repaired) { Say 'warn' ('Az SFC ' + $repaired + ' sérült fájlt javított. Indítsd újra a gépet.') ('SFC repaired ' + $repaired + ' corrupt files. Restart the PC.') }
    elseif ($seen -gt 0 -or $r['code'] -eq 0) { Say 'ok' 'Az SFC nem talált sérült rendszerfájlt.' 'SFC found no corrupt system files.' }
    else { foreach ($l in (Tail $r['out'] 3)) { D $l }; Say 'warn' 'Az SFC nem futott le rendesen (függő javítás? indítsd újra a gépet).' 'SFC did not complete (pending repair? restart the PC).' }
}

function R-chkdsk-scan($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    $drv = $env:SystemDrive
    if ([int]$OS['major'] * 100 + [int]$OS['minor'] -ge 602) { $r = Invoke-Cmd 'chkdsk.exe' ($drv + ' /scan') 3600 } else { $r = Invoke-Cmd 'chkdsk.exe' $drv 3600 }
    foreach ($l in (Tail $r['out'] 3)) { D $l }
    switch ($r['code']) {
        0 { Say 'ok' 'A fájlrendszer hibátlan.' 'The file system has no errors.' }
        1 { Say 'ok' 'Hibák voltak, a chkdsk kijavította őket.' 'Errors were found and fixed.' }
        default { Say 'warn' 'Fájlrendszer hibát talált: ütemezd a javítást a következő indításra.' 'File system errors found: schedule a repair for the next restart.' }
    }
}

function R-chkdsk-schedule($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    $r = Invoke-Cmd 'fsutil.exe' ('dirty set ' + $env:SystemDrive) 30
    if ($r['code'] -eq 0) { Say 'ok' 'Lemezellenőrzés ütemezve a következő újraindításra.' 'Disk check scheduled for the next restart.' }
    else { foreach ($l in $r['out']) { D $l }; Say 'fail' 'Nem sikerült ütemezni.' 'Could not schedule it.' }
}

function R-net-reset($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    $a = Invoke-Cmd 'netsh.exe' 'winsock reset' 60; $b = Invoke-Cmd 'netsh.exe' 'int ip reset' 60; $c = Invoke-Cmd 'ipconfig.exe' '/flushdns' 30
    D ('winsock: ' + $a['code'] + '  ip: ' + $b['code'] + '  dns: ' + $c['code'])
    Say 'ok' 'Hálózati beállítások alaphelyzetben. Indítsd újra a gépet.' 'Network stack reset. Restart the PC.'
}

function R-dns-flush($P) {
    if (-not (Need-Win)) { return }
    $r = Invoke-Cmd 'ipconfig.exe' '/flushdns' 30
    if ($r['code'] -eq 0) { Say 'ok' 'DNS gyorsítótár ürítve.' 'DNS cache flushed.' } else { Say 'fail' 'Nem sikerült.' 'Failed.' }
}

function R-time-sync($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    $s = Get-Service w32time -ErrorAction SilentlyContinue
    if ($s -and $s.Status -ne 'Running') { try { Set-Service w32time -StartupType Automatic; Start-Service w32time } catch { } }
    $r = Invoke-Cmd 'w32tm.exe' '/resync /force' 60
    D ('Time: ' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))
    if ($r['code'] -eq 0) { Say 'ok' 'Az óra szinkronizálva.' 'Clock synchronized.' } else { foreach ($l in $r['out']) { D $l }; Say 'warn' 'Az időszinkron nem sikerült (nincs internet vagy tartományi gép).' 'Time sync failed (no internet or domain PC).' }
}

function R-wu-reset($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    $svcs = @('wuauserv', 'bits', 'cryptsvc')
    foreach ($s in $svcs) { try { Stop-Service $s -Force -ErrorAction Stop } catch { D ('stop ' + $s + ': ' + $_.Exception.Message) } }
    $stamp = (Get-Date).ToString('yyyyMMddHHmm')
    foreach ($d in @((Join-Path $env:SystemRoot 'SoftwareDistribution'), (Join-Path $env:SystemRoot 'System32\catroot2'))) {
        if (Test-Path $d) { try { Rename-Item $d ((Split-Path $d -Leaf) + '.old-' + $stamp) -ErrorAction Stop; D ('renamed ' + $d) } catch { D ('rename ' + $d + ': ' + $_.Exception.Message) } }
    }
    foreach ($s in $svcs) { try { Start-Service $s -ErrorAction Stop } catch { D ('start ' + $s + ': ' + $_.Exception.Message) } }
    if (Test-Path (Join-Path $env:SystemRoot 'System32\UsoClient.exe')) { [void](Invoke-Cmd 'UsoClient.exe' 'StartScan' 30) } else { [void](Invoke-Cmd 'wuauclt.exe' '/detectnow' 30) }
    Say 'ok' 'A Windows Update alaphelyzetben, keresés elindítva. A régi mappák .old néven megmaradtak.' 'Windows Update reset and a scan started. The old folders were kept as .old.'
}

function Get-MpCmd {
    foreach ($p in @((Join-Path $env:ProgramFiles 'Windows Defender\MpCmdRun.exe'), (Join-Path $env:ProgramData 'Microsoft\Windows Defender\Platform'))) {
        if ($p.EndsWith('.exe') -and (Test-Path $p)) { return $p }
        if (Test-Path $p) { $x = @(Get-ChildItem $p -Filter MpCmdRun.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending); if ($x.Count) { return $x[0].FullName } }
    }
    return $null
}

function R-defender-update($P) {
    if (-not (Need-Win)) { return }
    $mp = Get-MpCmd; if (-not $mp) { Skip 'A Microsoft Defender nincs a gépen (más vírusirtó?).' 'Microsoft Defender is not present (other antivirus?).'; return }
    $r = Invoke-Cmd $mp '-SignatureUpdate' 900
    foreach ($l in (Tail $r['out'] 2)) { D $l }
    if ($r['code'] -eq 0) { Say 'ok' 'Defender adatbázis frissítve.' 'Defender signatures updated.' } else { Say 'warn' 'A frissítés nem sikerült (nincs internet, vagy másik vírusirtó aktív).' 'Update failed (no internet, or another antivirus is active).' }
}

function R-defender-scan($P) {
    if (-not (Need-Win)) { return }
    $mp = Get-MpCmd; if (-not $mp) { Skip 'A Microsoft Defender nincs a gépen.' 'Microsoft Defender is not present.'; return }
    $type = '1'; if ((Get-Key $P 'full' 'false') -eq 'true') { $type = '2' }
    $r = Invoke-Cmd $mp ('-Scan -ScanType ' + $type) 14400
    foreach ($l in (Tail $r['out'] 4)) { D $l }
    switch ($r['code']) {
        0 { Say 'ok' 'A Defender vizsgálat nem talált kártevőt.' 'Defender found no threats.' }
        2 { Say 'fail' 'A Defender kártevőt talált! Nézd meg: Windows Biztonság > Fenyegetésvédelem > Védelmi előzmények.' 'Defender found threats! See Windows Security > Virus protection > Protection history.' }
        default { Say 'warn' ('A vizsgálat nem futott le (kód ' + $r['code'] + '). Másik vírusirtó aktív?') ('Scan did not complete (code ' + $r['code'] + '). Another antivirus active?') }
    }
}

function R-spooler-reset($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    try { Stop-Service Spooler -Force -ErrorAction Stop } catch { D $_.Exception.Message }
    $q = Join-Path $env:SystemRoot 'System32\spool\PRINTERS'; $n = 0
    foreach ($f in @(Get-ChildItem $q -Force -ErrorAction SilentlyContinue)) { try { Remove-Item $f.FullName -Force -ErrorAction Stop; $n++ } catch { } }
    try { Start-Service Spooler -ErrorAction Stop } catch { D $_.Exception.Message }
    $st = (Get-Service Spooler).Status
    if ($st -eq 'Running') { Say 'ok' ('Nyomtatási sor ürítve (' + $n + ' fájl), a szolgáltatás újraindult.') ('Print queue cleared (' + $n + ' files), spooler restarted.') }
    else { Say 'fail' 'A nyomtatásvezérlő nem indult el újra.' 'The spooler did not restart.' }
}

function R-hibernate-off($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    $h = Join-Path $env:SystemDrive 'hiberfil.sys'; $b = 0
    try { $b = (Get-Item -LiteralPath $h -Force -ErrorAction Stop).Length } catch { }
    $r = Invoke-Cmd 'powercfg.exe' '/h off' 30
    if ($r['code'] -eq 0) { Say 'ok' ('Hibernálás kikapcsolva, ' + [Math]::Round($b / 1GB, 1) + ' GB felszabadult.') ('Hibernation off, ' + [Math]::Round($b / 1GB, 1) + ' GB freed.') } else { Say 'fail' 'Nem sikerült.' 'Failed.' }
}

function R-power-balanced($P) {
    if (-not (Need-Win)) { return }
    $r = Invoke-Cmd 'powercfg.exe' '/setactive 381b4222-f694-41f0-9685-ff5bb260df2e' 30
    if ($r['code'] -eq 0) { Say 'ok' 'Kiegyensúlyozott energiaséma beállítva.' 'Balanced power plan set.' } else { Say 'warn' 'Nem sikerült (gyártói séma?).' 'Failed (vendor plan?).' }
}

function Get-Winget {
    $w = Get-Command winget.exe -ErrorAction SilentlyContinue; if ($w) { return $w.Path }
    $x = @(Get-ChildItem (Join-Path $env:ProgramFiles 'WindowsApps') -Filter winget.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)
    if ($x.Count) { return $x[0].FullName }
    return $null
}

function R-winget-upgrade($P) {
    if (-not (Need-Win)) { return }
    $wg = Get-Winget; if (-not $wg) { Skip 'A winget nem érhető el (Windows 10 1809+ kell). Használd a Patch My PC-t.' 'winget not available (needs Windows 10 1809+). Use Patch My PC.'; return }
    $r = Invoke-Cmd $wg 'upgrade --all --silent --accept-source-agreements --accept-package-agreements --disable-interactivity' 3600
    foreach ($l in (Tail $r['out'] 8)) { if ($l -notmatch '^[\s\-\\|/█▒]+$') { D $l } }
    if ($r['code'] -eq 0) { Say 'ok' 'A programok frissítése lefutott.' 'Program updates finished.' } else { Say 'warn' ('A winget befejezte, de nem minden sikerült (kód ' + $r['code'] + ').') ('winget finished, not everything succeeded (code ' + $r['code'] + ').') }
}

function R-winget-install($P) {
    if (-not (Need-Win)) { return }
    $wg = Get-Winget; if (-not $wg) { Skip 'A winget nem érhető el.' 'winget not available.'; return }
    $ids = [string](Get-Key $P 'packages' '')
    $ok = 0; $bad = @()
    foreach ($id in ($ids -split '[,;\s]+')) {
        if (-not $id) { continue }
        if ($id -notmatch '^[A-Za-z0-9][A-Za-z0-9.\-_+]{1,100}$') { $bad += $id; continue }
        $r = Invoke-Cmd $wg ('install --id ' + $id + ' -e --silent --accept-source-agreements --accept-package-agreements --disable-interactivity') 1800
        if ($r['code'] -eq 0) { $ok++; D ('OK ' + $id) } else { $bad += $id; D ('FAIL ' + $id + ' (' + $r['code'] + ')') }
    }
    if ($bad.Count) { Say 'warn' ('' + $ok + ' telepítve, nem sikerült: ' + ($bad -join ', ')) ('' + $ok + ' installed, failed: ' + ($bad -join ', ')) }
    else { Say 'ok' ('' + $ok + ' program telepítve.') ('' + $ok + ' programs installed.') }
}

function R-driver-export($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Build 6 3 'dism /export-driver')) { return }; if (-not (Need-Admin)) { return }
    $d = Get-BackupDir 'drivers'
    $r = Invoke-Cmd 'dism.exe' ('/online /export-driver /destination:"' + $d + '"') 3600
    $n = @(Get-ChildItem $d -Recurse -Filter *.inf -ErrorAction SilentlyContinue).Count
    $mb = MB (Get-DirBytes $d 20)
    if ($r['code'] -eq 0) { F $d; Say 'ok' ('' + $n + ' illesztőprogram mentve (' + $mb + ' MB).') ('' + $n + ' drivers exported (' + $mb + ' MB).') }
    else { foreach ($l in (Tail $r['out'] 3)) { D $l }; Say 'fail' 'Az illesztőprogramok mentése nem sikerült.' 'Driver export failed.' }
}

function R-wifi-export($P) {
    if (-not (Need-Win)) { return }; if (-not (Need-Admin)) { return }
    $d = Get-BackupDir 'wifi'
    $r = Invoke-Cmd 'netsh.exe' ('wlan export profile key=clear folder="' + $d + '"') 60
    $n = @(Get-ChildItem $d -Filter *.xml -ErrorAction SilentlyContinue).Count
    if ($n) { F $d; Say 'ok' ('' + $n + ' Wi-Fi profil mentve, jelszóval együtt. Bizalmas: a munka végén töröld vagy titkosítsd.') ('' + $n + ' Wi-Fi profiles saved with passwords. Confidential: delete or encrypt after the job.') }
    else { Skip 'Nincs mentett Wi-Fi profil (vagy nincs Wi-Fi).' 'No saved Wi-Fi profiles (or no Wi-Fi).' }
}

function R-keys-export($P) {
    if (-not (Need-Win)) { return }
    $f = Join-Path (Get-BackupDir '') 'product-keys.txt'
    $lines = @('ServiceKit ' + (Get-Date).ToString('yyyy-MM-dd HH:mm') + '  ' + $env:COMPUTERNAME, '')
    try { $k = @(W 'SoftwareLicensingService')[0].OA3xOriginalProductKey; if ($k) { $lines += ('OEM (BIOS) key: ' + $k) } else { $lines += 'OEM (BIOS) key: none' } } catch { }
    $pk = Find-KitExe 'produkey' @{ exe = 'ProduKey.exe' } ([bool]$OS['is64'])
    if ($pk) {
        $tmp = Join-Path (Get-BackupDir '') 'produkey.txt'
        $p = Start-Process -FilePath $pk -ArgumentList ('/stext "' + $tmp + '"') -PassThru -WindowStyle Hidden
        [void]$p.WaitForExit(60000)
        if (Test-Path $tmp) { $lines += ''; $lines += [IO.File]::ReadAllLines($tmp); Remove-Item $tmp -Force }
    } else { $lines += ''; $lines += 'ProduKey not installed: Office and other keys were not read.' }
    $enc = New-Object System.Text.UTF8Encoding($true); [IO.File]::WriteAllText($f, ($lines -join "`r`n"), $enc); F $f
    $n = @($lines | Where-Object { $_ -match 'Product Key|OEM \(BIOS\) key: [A-Z0-9]' }).Count
    Say 'ok' ('Termékkulcsok mentve (' + $n + '). Bizalmas adat.') ('Product keys saved (' + $n + '). Confidential.')
}

function R-bookmarks-backup($P) {
    if (-not (Need-Win)) { return }
    $dst = Get-BackupDir 'bookmarks'; $n = 0
    $roots = @(@('Chrome', 'Google\Chrome\User Data'), @('Edge', 'Microsoft\Edge\User Data'), @('Brave', 'BraveSoftware\Brave-Browser\User Data'))
    foreach ($b in $roots) {
        $ud = Join-Path $env:LOCALAPPDATA $b[1]
        if (-not (Test-Path $ud)) { continue }
        foreach ($prof in @(Get-ChildItem $ud -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer -and ($_.Name -eq 'Default' -or $_.Name -like 'Profile *') })) {
            $bm = Join-Path $prof.FullName 'Bookmarks'
            if (Test-Path $bm) { Copy-Item $bm (Join-Path $dst ($b[0] + '-' + ($prof.Name -replace ' ', '') + '-Bookmarks.json')) -Force; $n++; D ($b[0] + ' / ' + $prof.Name) }
        }
    }
    $ff = Join-Path $env:APPDATA 'Mozilla\Firefox\Profiles'
    foreach ($prof in @(Get-ChildItem $ff -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer })) {
        $bb = Join-Path $prof.FullName 'bookmarkbackups'
        if (Test-Path $bb) { $t = Join-Path $dst ('Firefox-' + $prof.Name); Copy-Item $bb $t -Recurse -Force; $n++; D ('Firefox / ' + $prof.Name) }
    }
    if ($n) { F $dst; Say 'ok' ('' + $n + ' böngészőprofil könyvjelzői mentve.') ('Bookmarks saved from ' + $n + ' browser profiles.') }
    else { Skip 'Nem található böngésző könyvjelző.' 'No browser bookmarks found.' }
}

function R-explorer-restart($P) {
    if (-not (Need-Win)) { return }
    Get-Process explorer -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
    Say 'ok' 'Az Intéző újraindítva.' 'Explorer restarted.'
}

# Test hook used by the kit's own test run; harmless everywhere.
function R-selftest($P) {
    D ('Run: ' + $Run + '  Step: ' + $Step); D ('Param x = ' + (Get-Key $P 'x' '(none)'))
    Start-Sleep -Seconds ([int](Get-Key $P 'sleep' '1'))
    $f = Join-Path (Get-BackupDir 'selftest') 'hello.txt'; Set-Content -Path $f -Value 'ok'; F $f
    if ((Get-Key $P 'fail' 'false') -eq 'true') { Say 'fail' 'Szándékos hiba.' 'Intentional failure.' } else { Say 'ok' 'Önteszt rendben.' 'Self-test OK.' }
}

# ------------------------------------------------------------------ main
$script:RunDef = @{}
$result = @{ status = 'running'; started = (Get-Date).ToString('s'); pid = $PID }
try {
    if (-not $Routine) {
        $script:RunDef = Read-KitJson (Join-Path $RunDir 'run.json') $null
        if (-not $script:RunDef) { throw "Run not found: $Run" }
        $st = @($script:RunDef['steps'])[$Step]
        if (-not $st) { throw "Step not found: $Step" }
        $Routine = [string]$st['routine']
        $params = @{}; foreach ($k in @((Get-Key $st 'params' @{}).Keys)) { $params[$k] = [string]$st['params'][$k] }
        if ($ParamsFile -and (Test-Path $ParamsFile)) { $in = Read-KitJson $ParamsFile @{}; foreach ($k in @($in.Keys)) { $params[$k] = [string]$in[$k] } }
        Write-KitJson $ResFile $result
    } else { $params = @{}; if ($ParamsFile) { $params = Read-KitJson $ParamsFile @{} } }
    $fn = Get-Command ('R-' + $Routine) -CommandType Function -ErrorAction SilentlyContinue
    if (-not $fn) { throw "Unknown routine: $Routine" }
    & $fn $params
    if (-not $script:R['hu']) { Say 'ok' 'Kész.' 'Done.' }
} catch {
    Set-Status 'fail'; $script:R['hu'] = 'Hiba: ' + $_.Exception.Message; $script:R['en'] = 'Error: ' + $_.Exception.Message
    Log ('ERROR ' + $_.Exception.Message)
}
$result['status'] = $script:R['status']; $result['summary'] = @{ hu = $script:R['hu']; en = $script:R['en'] }
$result['details'] = @($script:R['details']); $result['files'] = @($script:R['files'])
$result['finished'] = (Get-Date).ToString('s'); $result['admin'] = [bool]$OS['admin']
if ($Run) { Write-KitJson $ResFile $result } else { ConvertTo-KitJson $result }
