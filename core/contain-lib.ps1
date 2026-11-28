# ---------------------------------------------------------------------------
# contain-lib.ps1 - VRG Containment: the functions behind contain.ps1.
#
# Two ways to open a disposable, isolated machine for untrusted things
# (a client's file, a link, an unknown program):
#
#   sandbox  Windows Sandbox on the host. Built into Windows 10/11 Pro,
#            Enterprise and Education; a fresh Windows every time, wiped on
#            close. Config = a .wsb file written per session.
#   stick    a portable QEMU + a Debian Live ISO in runtime\, run from the
#            folder or a USB stick with nothing installed. Works on Home
#            too; fast with Windows Hypervisor Platform (WHPX), slow without.
#
# Both read the same profiles (profiles.json): network, clipboard, inbox
# (read-only into the machine), outbox (writable, Sandbox mode only).
#
# Windows PowerShell 5.1 compatible. Keep this file ASCII: 5.1 misreads
# accents in a BOM-less script. Console text is ASCII too.
# Dot-source it; contain.ps1 dispatches, test\selftest.ps1 tests it.
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

function Set-KitRoot([string]$root) {
    $script:Kit = $root
    $script:ProfilesFile = Join-Path $root 'profiles.json'
    $script:SourcesFile = Join-Path $root 'sources.json'
    $script:Runtime = Join-Path $root 'runtime'
    $script:Sessions = Join-Path $script:Runtime 'sessions'
    $script:Downloads = Join-Path $script:Runtime 'downloads'
    $script:QemuDir = Join-Path $script:Runtime 'qemu'
    $script:GuestDir = Join-Path $script:Runtime 'guest'
    $script:ManifestFile = Join-Path $script:Runtime 'manifest.json'
    $script:QemuHashFile = Join-Path $script:Runtime 'qemu.sha256'
    $script:Exchange = Join-Path $root 'exchange'
    $script:Inbox = Join-Path $script:Exchange 'inbox'
    $script:Outbox = Join-Path $script:Exchange 'outbox'
}
Set-KitRoot (Split-Path -Parent $PSScriptRoot)

# In-guest paths (Windows Sandbox side).
$GuestRoot = 'C:\Containment'
$GuestInbox = 'C:\Containment\inbox'
$GuestOutbox = 'C:\Containment\outbox'

# vvfat (the stick's read-only inbox drive) is FAT16: about 500 MB at most.
$StickInboxLimitMB = 480

# ------------------------------------------------------------------ small helpers
function Say([string]$m) { Write-Host $m }
function Note([string]$m) { Write-Host ('    ' + $m) -ForegroundColor DarkGray }
function Warn([string]$m) { Write-Host ('[!] ' + $m) -ForegroundColor Yellow }
function Good([string]$m) { Write-Host ('[OK] ' + $m) -ForegroundColor Green }

function Ensure-Dir([string]$p) {
    if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

function Read-TextFile([string]$p) { return [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }

function Write-TextFile([string]$p, [string]$t) {
    Ensure-Dir (Split-Path -Parent $p)
    [IO.File]::WriteAllText($p, $t, (New-Object Text.UTF8Encoding($false)))
}

# Every file this kit reads opens with { format, version }; refuse a stranger.
function Read-Format([string]$p, [string]$format) {
    if (-not (Test-Path -LiteralPath $p)) { throw ('Missing file: ' + $p) }
    $j = (Read-TextFile $p) | ConvertFrom-Json
    if ($j.format -ne $format) { throw ($p + ': format is "' + $j.format + '", expected "' + $format + '"') }
    if ([int]$j.version -gt 1) { throw ($p + ': version ' + $j.version + ' is newer than this kit reads (1). Update the kit.') }
    return $j
}

function Get-Flag($obj, [string]$name, [bool]$default) {
    $v = $obj.$name
    if ($null -eq $v) { return $default }
    return [bool]$v
}

function EnDis([bool]$b) { if ($b) { return 'Enable' } return 'Disable' }

function Esc-Xml([string]$s) { return [System.Security.SecurityElement]::Escape($s) }

# Quote for a Windows command line (CommandLineToArgvW rules).
function Join-Args([string[]]$list) {
    $out = @()
    foreach ($a in $list) {
        if ($null -eq $a -or $a -eq '') { $out += '""'; continue }
        if ($a -notmatch '[\s"]') { $out += $a; continue }
        $s = [regex]::Replace($a, '(\\*)"', { param($m) ($m.Groups[1].Value * 2) + '\"' })
        $s = [regex]::Replace($s, '(\\+)$', { param($m) $m.Groups[1].Value * 2 })
        $out += '"' + $s + '"'
    }
    return ($out -join ' ')
}

function Get-FolderSizeMB([string]$p) {
    $sum = 0
    foreach ($f in @(Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer })) { $sum += $f.Length }
    return [Math]::Ceiling($sum / 1MB)
}

function Test-Admin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}

# ------------------------------------------------------------------ profiles
function Get-Profiles { return (Read-Format $script:ProfilesFile 'vrg-containment-profiles') }

function Get-Box([string]$id) {
    $cfg = Get-Profiles
    if (-not $id) { $id = [string]$cfg.default }
    foreach ($p in @($cfg.profiles)) { if ($p.id -eq $id) { return $p } }
    $ids = @($cfg.profiles | ForEach-Object { $_.id }) -join ', '
    throw ('No such profile: "' + $id + '" (profiles: ' + $ids + ')')
}

function Test-BoxId([string]$id) {
    foreach ($p in @((Get-Profiles).profiles)) { if ($p.id -eq $id) { return $true } }
    return $false
}

# ------------------------------------------------------------------ the host
function Get-HostInfo {
    $os = $null; $cpu = $null; $cs = $null
    try { $os = Get-CimInstance Win32_OperatingSystem } catch { try { $os = Get-WmiObject Win32_OperatingSystem } catch { } }
    try { $cpu = @(Get-CimInstance Win32_Processor)[0] } catch { try { $cpu = @(Get-WmiObject Win32_Processor)[0] } catch { } }
    try { $cs = Get-CimInstance Win32_ComputerSystem } catch { try { $cs = Get-WmiObject Win32_ComputerSystem } catch { } }
    $caption = ''; $build = 0; $sku = 0; $ramMB = 0
    if ($os) { $caption = [string]$os.Caption; $build = [int]$os.BuildNumber; $sku = [int]$os.OperatingSystemSKU; $ramMB = [int]([int64]$os.TotalVisibleMemorySize / 1024) }
    # 98-101 are the Home SKUs; the caption check catches localised names.
    $isHome = (@(98, 99, 100, 101) -contains $sku) -or ($caption -match 'Home|Otthoni')
    $wsbExe = ''; $whpx = $false
    if ($env:SystemRoot) {
        $wsbExe = Join-Path $env:SystemRoot 'System32\WindowsSandbox.exe'
        # The Windows Hypervisor Platform feature ships this DLL; QEMU's WHPX needs it.
        # (A running hypervisor alone, e.g. Windows 11's VBS, is not enough.)
        $whpx = Test-Path -LiteralPath (Join-Path $env:SystemRoot 'System32\WinHvPlatform.dll')
    }
    if (-not ($wsbExe -and (Test-Path -LiteralPath $wsbExe))) {
        $g = Get-Command WindowsSandbox.exe -ErrorAction SilentlyContinue
        if ($g) { $wsbExe = $g.Source }
    }
    $hv = $false; if ($cs -and $cs.HypervisorPresent) { $hv = $true }
    $fw = $null; if ($cpu) { $fw = $cpu.VirtualizationFirmwareEnabled }
    return [pscustomobject]@{
        caption = $caption; build = $build; isHome = $isHome; ramMB = $ramMB
        wsbExe = $wsbExe; wsb = [bool]($wsbExe -and (Test-Path -LiteralPath $wsbExe))
        hypervisor = $hv; virtFirmware = $fw; whpx = $whpx
        # With Hyper-V running, Windows reports the firmware flag as False: the hypervisor counts.
        virt = ($hv -or ($fw -eq $true))
        admin = (Test-Admin)
    }
}

# Why Windows Sandbox cannot start here, or '' when it can.
function Get-SandboxBlocker($h) {
    if ($h.wsb) { return '' }
    if ($h.build -gt 0 -and $h.build -lt 18305) { return 'Windows Sandbox needs Windows 10 1903 (build 18305) or newer. Use STICK mode.' }
    if ($h.isHome) { return 'Windows Sandbox is not part of Windows Home. Use STICK mode (it runs on Home).' }
    if (-not $h.virt) { return 'Virtualisation is off in the BIOS/UEFI (Intel VT-x / AMD-V, SVM). Turn it on, then run "Windows Sandbox bekapcsolasa".' }
    return 'Windows Sandbox is not turned on. Menu E (needs administrator, then a restart).'
}

function Test-SandboxRunning {
    return (@(Get-Process -Name 'WindowsSandbox', 'WindowsSandboxClient', 'WindowsSandboxRemoteSession' -ErrorAction SilentlyContinue).Count -gt 0)
}

# ------------------------------------------------------------------ inbox staging
# The machine never sees the original: a file or folder handed over is copied
# into exchange\inbox\<stamp>\ and only that copy is mapped (read-only).
function New-SessionInbox([string]$item) {
    Ensure-Dir $script:Inbox; Ensure-Dir $script:Outbox
    if (-not $item) { return [pscustomobject]@{ dir = $script:Inbox; name = '' } }
    if (-not (Test-Path -LiteralPath $item)) { throw ('Not found: ' + $item) }
    $full = (Resolve-Path -LiteralPath $item).ProviderPath
    $dir = Join-Path $script:Inbox (Get-Date -Format 'yyyyMMdd-HHmmss')
    Ensure-Dir $dir
    Copy-Item -LiteralPath $full -Destination $dir -Recurse -Force
    return [pscustomobject]@{ dir = $dir; name = (Split-Path -Leaf $full) }
}

# ------------------------------------------------------------------ Windows Sandbox
function Get-SandboxMemoryMB($box, [int]$hostRamMB) {
    $want = 4096; if ($box.memoryMB) { $want = [int]$box.memoryMB }
    if ($hostRamMB -gt 0) { $half = [int]($hostRamMB / 2); if ($want -gt $half) { $want = $half } }
    if ($want -lt 2048) { $want = 2048 }
    return $want
}

function New-WsbConfig($box, [string]$inboxDir, [string]$outboxDir, [string]$itemName, [bool]$open, [int]$memMB) {
    $clip = Get-Flag $box 'clipboard' $false
    $L = @('<Configuration>')
    $L += '  <VGpu>' + (EnDis (Get-Flag $box 'vgpu' $false)) + '</VGpu>'
    $L += '  <Networking>' + (EnDis (Get-Flag $box 'network' $false)) + '</Networking>'
    $L += '  <ClipboardRedirection>' + (EnDis $clip) + '</ClipboardRedirection>'
    $L += '  <PrinterRedirection>' + (EnDis (Get-Flag $box 'printer' $false)) + '</PrinterRedirection>'
    $L += '  <AudioInput>' + (EnDis (Get-Flag $box 'audioIn' $false)) + '</AudioInput>'
    $L += '  <VideoInput>' + (EnDis (Get-Flag $box 'videoIn' $false)) + '</VideoInput>'
    # Protected Client = the sandbox's own window runs in an AppContainer. It also
    # blocks copy/paste, so it follows the clipboard switch.
    $L += '  <ProtectedClient>' + (EnDis (-not $clip)) + '</ProtectedClient>'
    if ($memMB -gt 0) { $L += '  <MemoryInMB>' + $memMB + '</MemoryInMB>' }
    $maps = @()
    if ($inboxDir) {
        $maps += '    <MappedFolder><HostFolder>' + (Esc-Xml $inboxDir) + '</HostFolder><SandboxFolder>' + $GuestInbox + '</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>'
    }
    if ($outboxDir) {
        $maps += '    <MappedFolder><HostFolder>' + (Esc-Xml $outboxDir) + '</HostFolder><SandboxFolder>' + $GuestOutbox + '</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>'
    }
    if ($maps.Count -gt 0) { $L += '  <MappedFolders>'; $L += $maps; $L += '  </MappedFolders>' }
    $cmd = 'explorer.exe C:\Users\WDAGUtilityAccount\Desktop'
    if ($inboxDir) { $cmd = 'explorer.exe ' + $GuestInbox }
    if ($inboxDir -and $itemName) {
        $inGuest = $GuestInbox + '\' + $itemName
        if ($open) { $cmd = 'cmd.exe /c start "" "' + $inGuest + '"' }
        else { $cmd = 'explorer.exe /select,"' + $inGuest + '"' }
    }
    $L += '  <LogonCommand><Command>' + (Esc-Xml $cmd) + '</Command></LogonCommand>'
    $L += '</Configuration>'
    return (($L -join "`r`n") + "`r`n")
}

function Start-SandboxMode([string]$boxId, [string]$item, [bool]$open, [bool]$dryRun) {
    $box = Get-Box $boxId
    $h = Get-HostInfo
    if (-not $dryRun) {
        $why = Get-SandboxBlocker $h
        if ($why) { throw $why }
        if (Test-SandboxRunning) { throw 'A Windows Sandbox is already open. Close it first (Windows runs one at a time).' }
    }
    $inboxDir = ''; $name = ''
    if (Get-Flag $box 'inbox' $true) { $s = New-SessionInbox $item; $inboxDir = $s.dir; $name = $s.name }
    elseif ($item) { Warn ('Profile "' + $box.id + '" has no inbox: ' + $item + ' is not passed in.') }
    $outboxDir = ''
    if (Get-Flag $box 'outbox' $true) { Ensure-Dir $script:Outbox; $outboxDir = $script:Outbox }
    $mem = Get-SandboxMemoryMB $box $h.ramMB
    $xml = New-WsbConfig $box $inboxDir $outboxDir $name $open $mem
    $wsb = Join-Path $script:Sessions ('sandbox-' + $box.id + '.wsb')
    Write-TextFile $wsb $xml
    Say ('Windows Sandbox: ' + $box.name + ' (' + $box.id + ')')
    Note ('network ' + (EnDis (Get-Flag $box 'network' $false)) + ', clipboard ' + (EnDis (Get-Flag $box 'clipboard' $false)) + ', memory ' + $mem + ' MB')
    if ($inboxDir) { Note ('inbox (read-only)  ' + $inboxDir + '  ->  ' + $GuestInbox) }
    if ($outboxDir) { Note ('outbox (writable) ' + $outboxDir + '  ->  ' + $GuestOutbox) }
    Note ('config ' + $wsb)
    if ($dryRun) { Say 'Dry run: not started.'; return $wsb }
    Start-Process -FilePath $h.wsbExe -ArgumentList (Join-Args @($wsb)) | Out-Null
    Good 'Started. Closing its window throws everything inside away.'
    return $wsb
}

# ------------------------------------------------------------------ the stick VM (QEMU)
function Get-Manifest {
    if (-not (Test-Path -LiteralPath $script:ManifestFile)) { return $null }
    return (Read-Format $script:ManifestFile 'vrg-containment-runtime')
}

function Find-QemuExe {
    $m = Get-Manifest
    $cands = @()
    if ($m -and $m.qemu -and $m.qemu.dir) { $cands += (Join-Path $script:Kit $m.qemu.dir) }
    $cands += $script:QemuDir
    foreach ($d in $cands) {
        foreach ($n in @('qemu-system-x86_64w.exe', 'qemu-system-x86_64.exe')) {
            $p = Join-Path $d $n
            if (Test-Path -LiteralPath $p) { return $p }
        }
    }
    return ''
}

function Find-GuestIso {
    $m = Get-Manifest
    if ($m -and $m.guest -and $m.guest.file) {
        $p = Join-Path $script:GuestDir $m.guest.file
        if (Test-Path -LiteralPath $p) { return $p }
    }
    $any = @(Get-ChildItem -LiteralPath $script:GuestDir -Filter '*.iso' -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
    if ($any.Count -gt 0) { return $any[0].FullName }
    return ''
}

function Get-StickMemoryMB($box, [int]$hostRamMB) { return (Get-SandboxMemoryMB $box $hostRamMB) }

# A comma inside a -drive value is written twice.
function Esc-QemuOpt([string]$s) { return $s.Replace(',', ',,') }

function Get-QemuArgs($box, [string]$iso, [string]$disk, [string]$inboxDir, [int]$memMB) {
    $cpus = 2; if ($box.cpus) { $cpus = [int]$box.cpus }
    $a = @('-name', ('VRG-Containment-' + $box.id), '-machine', 'q35')
    # WHPX when Windows Hypervisor Platform is on; else QEMU falls back to TCG (slow, but works).
    $a += @('-accel', 'whpx,kernel-irqchip=off', '-accel', 'tcg')
    $a += @('-m', [string]$memMB, '-smp', [string]$cpus, '-vga', 'std', '-rtc', 'base=utc')
    $a += @('-device', 'qemu-xhci,id=xhci', '-device', 'usb-tablet,bus=xhci.0')
    if (Get-Flag $box 'network' $false) { $a += @('-nic', 'user,model=virtio-net-pci') }
    else { $a += @('-nic', 'none') }
    if ($disk) {
        # Bring-your-own image (e.g. your licensed Windows): never written, snapshot=on.
        $a += @('-drive', ('file=' + (Esc-QemuOpt $disk) + ',media=disk,snapshot=on'))
    }
    if ($iso) { $a += @('-drive', ('file=' + (Esc-QemuOpt $iso) + ',media=cdrom,readonly=on')) }
    if ($iso) { $a += @('-boot', 'order=d') } else { $a += @('-boot', 'order=c') }
    if ($inboxDir) {
        # The inbox as a read-only USB stick inside the guest (FAT16 view of the folder).
        $a += @('-drive', ('if=none,id=inbox,format=raw,readonly=on,file=fat:16:' + (Esc-QemuOpt $inboxDir)))
        $a += @('-device', 'usb-storage,bus=xhci.0,drive=inbox,removable=on')
    }
    return ,$a
}

function Start-StickMode([string]$boxId, [string]$item, [string]$disk, [bool]$dryRun) {
    $box = Get-Box $boxId
    $h = Get-HostInfo
    $qemu = Find-QemuExe
    $iso = Find-GuestIso
    if (-not $dryRun) {
        if (-not $qemu) { throw 'The stick runtime is not downloaded yet. Menu F (SETUP: QEMU + Debian Live, about 4 GB).' }
        if (-not $iso -and -not $disk) { throw ('No guest ISO in ' + $script:GuestDir + '. Menu F downloads Debian Live.') }
    }
    if ($disk -and -not (Test-Path -LiteralPath $disk)) { throw ('Disk image not found: ' + $disk) }
    if ($disk) { $iso = '' }
    $inboxDir = ''
    if (Get-Flag $box 'inbox' $true) {
        $s = New-SessionInbox $item; $inboxDir = $s.dir
        $mb = Get-FolderSizeMB $inboxDir
        if ($mb -gt $StickInboxLimitMB) {
            throw ('The inbox is ' + $mb + ' MB; the stick VM shows at most ' + $StickInboxLimitMB + ' MB. Empty ' + $script:Inbox + ' or hand over a single file.')
        }
    } elseif ($item) { Warn ('Profile "' + $box.id + '" has no inbox: ' + $item + ' is not passed in.') }
    $mem = Get-StickMemoryMB $box $h.ramMB
    $qa = Get-QemuArgs $box $iso $disk $inboxDir $mem
    $line = Join-Args $qa
    Write-TextFile (Join-Path $script:Sessions ('stick-' + $box.id + '.cmdline.txt')) ($qemu + ' ' + $line + "`r`n")
    Say ('Stick VM: ' + $box.name + ' (' + $box.id + ')')
    Note ('network ' + (EnDis (Get-Flag $box 'network' $false)) + ', clipboard off, memory ' + $mem + ' MB')
    if ($iso) { Note ('guest ' + (Split-Path -Leaf $iso) + ' (live, runs from RAM, nothing kept)') }
    if ($disk) { Note ('disk ' + $disk + ' (snapshot: changes are dropped)') }
    if ($inboxDir) { Note ('inbox (read-only USB drive in the guest) ' + $inboxDir) }
    if (Get-Flag $box 'outbox' $true) { Note 'outbox: none in stick mode, nothing comes out of the VM.' }
    if (-not $h.whpx) { Warn 'Windows Hypervisor Platform is off: the VM uses software emulation and is slow. Menu H turns it on.' }
    if ($dryRun) { Say 'Dry run: not started.'; return $line }
    $bin = Split-Path -Parent $qemu
    $proc = Start-Process -FilePath $qemu -ArgumentList $line -WorkingDirectory $bin -PassThru
    Start-Sleep -Seconds 3
    if ($proc.HasExited -and $proc.ExitCode -ne 0) {
        # The windowless build shows no errors: run the console one here to see why.
        Warn ('QEMU stopped at once (exit ' + $proc.ExitCode + '). Running it again in this window to show the reason:')
        $console = Join-Path $bin 'qemu-system-x86_64.exe'
        Push-Location $bin
        try { & $console @qa } finally { Pop-Location }
        return $line
    }
    Good 'Started. At the Debian menu press Enter (Live system). Power off = everything inside is gone.'
    return $line
}

# ------------------------------------------------------------------ setup: download + verify the stick runtime
function Enable-Tls12 {
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch { }
}

function Get-WebText([string]$url) {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing
    $c = $r.Content
    if ($c -is [byte[]]) { return [Text.Encoding]::UTF8.GetString($c) }
    return [string]$c
}

function Invoke-Download([string]$url, [string]$dest) {
    Say ('  <- ' + $url)
    Ensure-Dir (Split-Path -Parent $dest)
    $tmp = $dest + '.part'
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    $ok = $false
    if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
        try { Start-BitsTransfer -Source $url -Destination $tmp -Description 'VRG Containment' -ErrorAction Stop; $ok = $true }
        catch { Warn ('BITS failed (' + $_.Exception.Message + '), downloading directly.') }
    }
    if (-not $ok) {
        $pp = $ProgressPreference; $ProgressPreference = 'SilentlyContinue'
        try { Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing } finally { $ProgressPreference = $pp }
    }
    Move-Item -LiteralPath $tmp -Destination $dest -Force
}

function Get-Hash([string]$p, [string]$alg) { return (Get-FileHash -LiteralPath $p -Algorithm $alg).Hash.ToLower() }

function Find-7z {
    # Self-contained: a 7z.exe + 7z.dll dropped into the kit's tools\ folder wins,
    # then an installed 7-Zip. Nothing outside the kit and the system is looked at.
    $c = @((Join-Path $script:Kit 'tools\7z.exe'))
    if ($env:ProgramFiles) { $c += (Join-Path $env:ProgramFiles '7-Zip\7z.exe') }
    if (${env:ProgramFiles(x86)}) { $c += (Join-Path ${env:ProgramFiles(x86)} '7-Zip\7z.exe') }
    foreach ($p in $c) { if (Test-Path -LiteralPath $p) { return $p } }
    $g = Get-Command 7z.exe -ErrorAction SilentlyContinue
    if ($g) { return $g.Source }
    return ''
}

function Select-Newest([string]$text, [string]$pattern) {
    $best = ''; $bestKey = ''
    foreach ($m in [regex]::Matches($text, $pattern)) {
        $key = $m.Value; if ($m.Groups.Count -gt 1) { $key = $m.Groups[1].Value }
        if ($key -gt $bestKey) { $bestKey = $key; $best = $m.Value }
    }
    return $best
}

function Get-RelPath([string]$p) {
    $root = $script:Kit.TrimEnd('\') + '\'
    if ($p.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { return $p.Substring($root.Length) }
    return $p
}

function Install-Qemu($q, [bool]$allowUnsigned) {
    Say 'QEMU for Windows'
    $url = [string]$q.pin
    if (-not $url) {
        $index = [string]$q.index
        $html = Get-WebText $index
        $file = Select-Newest $html $q.pattern
        if (-not $file) {
            # Older builds sit in year folders (2024/, 2025/): look in the newest one.
            $year = Select-Newest $html '(20\d\d)/'
            if ($year) { $index = $index + $year; $file = Select-Newest (Get-WebText $index) $q.pattern }
        }
        if (-not $file) { throw ('No installer matching ' + $q.pattern + ' on ' + $q.index) }
        $url = $index + $file
    }
    $file = [IO.Path]::GetFileName(([Uri]$url).AbsolutePath)
    $dl = Join-Path $script:Downloads $file
    if (-not (Test-Path -LiteralPath $dl)) { Invoke-Download $url $dl } else { Note ('already downloaded: ' + $file) }

    # The checksum sits next to the installer, as setup.exe.sha512 or setup.sha512.
    $want = ''
    foreach ($cu in @(($url + $q.checksum), (($url -replace '\.exe$', '') + $q.checksum))) {
        try {
            $m = [regex]::Match((Get-WebText $cu), '[0-9a-fA-F]{128}')
            if ($m.Success) { $want = $m.Value.ToLower(); Note ('checksum: ' + $cu); break }
        } catch { }
    }
    if (-not $want) { Warn ('No published SHA-512 next to ' + $url) }
    $have = Get-Hash $dl 'SHA512'
    if ($want -and $have -ne $want) {
        Remove-Item -LiteralPath $dl -Force
        throw 'QEMU installer: SHA-512 does not match the published one. Deleted; run setup again.'
    }
    if ($want) { Good 'SHA-512 matches the published checksum.' }

    $sig = Get-AuthenticodeSignature -LiteralPath $dl
    $signer = ''; if ($sig.SignerCertificate) { $signer = [string]$sig.SignerCertificate.Subject }
    $signed = ([string]$sig.Status -eq 'Valid') -and ($signer -match [regex]::Escape([string]$q.signer))
    if ($signed) { Good ('Signed: ' + $signer) } else { Warn ('Signature: ' + $sig.Status + ' ' + $signer) }
    if (-not $signed -and -not $want) {
        if (-not $allowUnsigned) { throw 'The installer has neither a published checksum nor a valid signature, so it is not used. Check it by hand, then run setup with -AllowUnsigned.' }
        Warn 'Used without checksum or signature (-AllowUnsigned).'
    }

    if (Test-Path -LiteralPath $script:QemuDir) { Remove-Item -LiteralPath $script:QemuDir -Recurse -Force }
    $seven = Find-7z
    if ($seven) {
        Note ('extracting with ' + $seven)
        & $seven x $dl ('-o' + $script:QemuDir) -y | Out-Null
        if ($LASTEXITCODE -ne 0) { throw ('7-Zip could not extract ' + $dl) }
    } else {
        Warn '7-Zip not found: running the QEMU installer itself into the kit folder (it asks for administrator rights).'
        Start-Process -FilePath $dl -ArgumentList ('/S /D=' + $script:QemuDir) -Verb RunAs -Wait
    }
    $exe = @(Get-ChildItem -LiteralPath $script:QemuDir -Recurse -Filter 'qemu-system-x86_64.exe' -ErrorAction SilentlyContinue)
    if ($exe.Count -eq 0) { throw ('qemu-system-x86_64.exe not found after extracting into ' + $script:QemuDir) }
    $bin = $exe[0].DirectoryName
    # Only the x86_64 machine is needed: dropping the other emulators saves most of the space.
    foreach ($f in @(Get-ChildItem -LiteralPath $bin -Filter 'qemu-system-*.exe')) {
        if ($f.Name -notmatch '^qemu-system-x86_64w?\.exe$') { Remove-Item -LiteralPath $f.FullName -Force }
    }
    foreach ($junk in @('$PLUGINSDIR', 'uninstall.exe')) {
        $p = Join-Path $script:QemuDir $junk
        if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force }
    }
    Write-QemuHashes
    Good ('QEMU ready in ' + $bin)
    return [ordered]@{ file = $file; url = $url; sha512 = $have; checksumPublished = [bool]$want; signer = $signer; signature = [string]$sig.Status; dir = (Get-RelPath $bin) }
}

function Write-QemuHashes {
    $rows = @()
    $root = $script:QemuDir.TrimEnd('\') + '\'
    foreach ($f in @(Get-ChildItem -LiteralPath $script:QemuDir -Recurse -Force | Where-Object { -not $_.PSIsContainer } | Sort-Object FullName)) {
        $rows += ((Get-Hash $f.FullName 'SHA256') + "`t" + $f.FullName.Substring($root.Length))
    }
    Write-TextFile $script:QemuHashFile (($rows -join "`n") + "`n")
}

function Install-Guest($g) {
    Say ('Guest: ' + $g.name)
    $base = [string]$g.base; $only = ''
    if ($g.pin) { $u = [string]$g.pin; $base = $u.Substring(0, $u.LastIndexOf('/') + 1); $only = $u.Substring($u.LastIndexOf('/') + 1) }
    $sums = Get-WebText ($base + $g.sums)
    $want = ''; $file = ''
    foreach ($m in [regex]::Matches($sums, ('(?m)^([0-9a-fA-F]{64})\s+\*?(' + $g.pattern + ')\s*$'))) {
        $n = $m.Groups[2].Value
        if ($only -and $n -ne $only) { continue }
        if ($n -gt $file) { $file = $n; $want = $m.Groups[1].Value.ToLower() }
    }
    if (-not $file) { throw ('No ISO matching ' + $g.pattern + ' in ' + $base + $g.sums) }
    $dest = Join-Path $script:GuestDir $file
    if ((Test-Path -LiteralPath $dest) -and ((Get-Hash $dest 'SHA256') -eq $want)) {
        Note ('already here and verified: ' + $file)
    } else {
        $drive = New-Object IO.DriveInfo([IO.Path]::GetPathRoot($script:Kit))
        if ($drive.AvailableFreeSpace -lt 4.5GB) { throw ('Not enough space on ' + $drive.Name + ': the ISO needs about 4 GB.') }
        Invoke-Download ($base + $file) $dest
        Note 'checking SHA-256 (a minute for a 3 GB file)'
        $have = Get-Hash $dest 'SHA256'
        if ($have -ne $want) { Remove-Item -LiteralPath $dest -Force; throw ('SHA-256 of ' + $file + ' does not match ' + $g.sums + '. Deleted; run setup again.') }
    }
    Good ('SHA-256 matches ' + $g.sums + ': ' + $file)
    foreach ($old in @(Get-ChildItem -LiteralPath $script:GuestDir -Filter '*.iso' | Where-Object { $_.Name -ne $file -and $_.Name -match $g.pattern })) {
        Note ('removing the older ' + $old.Name); Remove-Item -LiteralPath $old.FullName -Force
    }
    return [ordered]@{ name = [string]$g.name; file = $file; url = ($base + $file); sha256 = $want }
}

function Invoke-Setup([bool]$allowUnsigned) {
    Enable-Tls12
    $src = Read-Format $script:SourcesFile 'vrg-containment-sources'
    Ensure-Dir $script:Runtime
    $q = Install-Qemu $src.qemu $allowUnsigned
    $g = Install-Guest $src.guest
    $man = [ordered]@{ format = 'vrg-containment-runtime'; version = 1; written = (Get-Date -Format 's'); qemu = $q; guest = $g }
    Write-TextFile $script:ManifestFile (($man | ConvertTo-Json -Depth 5) + "`n")
    $dl = $script:Downloads
    if (Test-Path -LiteralPath $dl) { Remove-Item -LiteralPath $dl -Recurse -Force }
    Good ('Stick runtime ready. Manifest: ' + $script:ManifestFile)
}

# ------------------------------------------------------------------ integrity
function Invoke-Verify {
    $bad = 0
    $m = Get-Manifest
    if (-not $m) { Warn 'No stick runtime yet (menu F).'; return 0 }
    $iso = Join-Path $script:GuestDir $m.guest.file
    if (-not (Test-Path -LiteralPath $iso)) { Warn ('missing ' + $iso); $bad++ }
    elseif ((Get-Hash $iso 'SHA256') -ne $m.guest.sha256) { Warn ('CHANGED ' + $iso); $bad++ }
    else { Good ('guest ISO unchanged: ' + $m.guest.file) }
    if (-not (Test-Path -LiteralPath $script:QemuHashFile)) { Warn 'qemu.sha256 missing'; $bad++ }
    else {
        $n = 0
        foreach ($row in @((Read-TextFile $script:QemuHashFile) -split "`n" | Where-Object { $_ })) {
            $parts = $row -split "`t", 2
            $p = Join-Path $script:QemuDir $parts[1]
            $n++
            if (-not (Test-Path -LiteralPath $p)) { Warn ('missing ' + $parts[1]); $bad++; continue }
            if ((Get-Hash $p 'SHA256') -ne $parts[0]) { Warn ('CHANGED ' + $parts[1]); $bad++ }
        }
        if ($bad -eq 0) { Good ('QEMU unchanged: ' + $n + ' files') }
    }
    if ($bad -gt 0) { Warn ('' + $bad + ' problem(s). Run setup again (menu F) before trusting this runtime.') }
    return $bad
}

# ------------------------------------------------------------------ status
function Show-Status {
    $h = Get-HostInfo
    Say ('Host: ' + $h.caption + ' (build ' + $h.build + '), RAM ' + [int]($h.ramMB / 1024) + ' GB, admin: ' + $h.admin)
    Say ('Virtualisation: firmware ' + $h.virtFirmware + ', hypervisor running ' + $h.hypervisor + ', Hypervisor Platform (WHPX) ' + $h.whpx)
    $why = Get-SandboxBlocker $h
    if ($why) { Warn ('SANDBOX mode: ' + $why) } else { Good 'SANDBOX mode: Windows Sandbox is available.' }
    $q = Find-QemuExe; $iso = Find-GuestIso
    if ($q -and $iso) {
        Good ('STICK mode: ' + (Get-RelPath $q) + ' + ' + (Split-Path -Leaf $iso))
        if (-not $h.whpx) { Warn 'STICK mode will be slow: Windows Hypervisor Platform is off (menu H).' }
    } else { Warn 'STICK mode: runtime not downloaded (menu F).' }
    $auto = Join-Path ([Environment]::GetFolderPath('Startup')) 'VRG Containment.cmd'
    if (Test-Path -LiteralPath $auto) { Say ('Autostart: on (' + $auto + ')') } else { Say 'Autostart: off' }
    Say 'Profiles:'
    foreach ($p in @((Get-Profiles).profiles)) { Note ($p.id + '  ' + $p.name + ' - ' + $p.hint) }
}

# ------------------------------------------------------------------ turning Windows features on
function Enable-Features([bool]$whpx) {
    if (-not (Test-Admin)) {
        $mode = 'enable'; if ($whpx) { $mode = 'enable-whpx' }
        $self = Join-Path $script:Kit 'core\contain.ps1'
        Say 'Asking for administrator rights...'
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList (Join-Args @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $self, '-Mode', $mode, '-Pause'))
        return
    }
    $h = Get-HostInfo
    $features = @()
    if ($whpx) { $features += 'HypervisorPlatform' }
    elseif ($h.isHome) { throw 'Windows Home has no Windows Sandbox. Use STICK mode; menu H speeds it up.' }
    else { $features += 'Containers-DisposableClientVM' }
    if (-not $h.virt) { Warn 'Virtualisation looks off in the BIOS/UEFI; the feature turns on, but it will not start until VT-x / AMD-V is enabled there.' }
    $restart = $false
    foreach ($f in $features) {
        Say ('Turning on ' + $f + ' ...')
        $r = Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart
        if ($r.RestartNeeded) { $restart = $true }
        Good ($f + ' is on.')
    }
    if ($restart) { Warn 'Restart Windows to finish.' }
}

# ------------------------------------------------------------------ autostart
function Set-Autostart([string]$boxId, [bool]$off) {
    $f = Join-Path ([Environment]::GetFolderPath('Startup')) 'VRG Containment.cmd'
    if ($off) {
        if (Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f -Force; Good 'Autostart off.' } else { Say 'Autostart was already off.' }
        return
    }
    $box = Get-Box $boxId
    $launcher = Join-Path $script:Kit 'SANDBOX.cmd'
    if ($launcher -match '[^\x20-\x7E]') { throw ('The kit path has non-ASCII characters, cmd.exe would misread it: ' + $launcher) }
    try {
        $type = (New-Object IO.DriveInfo([IO.Path]::GetPathRoot($script:Kit))).DriveType
        if ([string]$type -eq 'Removable') { Warn 'The kit is on a removable drive: autostart works only while the stick is in, under the same drive letter.' }
    } catch { }
    $t = "@echo off`r`nrem Written by VRG Containment (menu A). Delete this file to stop it.`r`n" +
         'if exist "' + $launcher + '" call "' + $launcher + '" ' + $box.id + "`r`n"
    [IO.File]::WriteAllText($f, $t, [Text.Encoding]::ASCII)
    Good ('Autostart on: the ' + $box.name + ' sandbox opens at every sign-in. (' + $f + ')')
}

# ------------------------------------------------------------------ copy to a stick
function Copy-Kit([string]$target) {
    if (-not $target) { $target = Read-Host 'Target folder (e.g. E:\VRG-Containment)' }
    if (-not $target) { return }
    $target = [IO.Path]::GetFullPath($target)
    if ($target.StartsWith($script:Kit, [StringComparison]::OrdinalIgnoreCase)) { throw 'The target is inside the kit itself.' }
    $drive = New-Object IO.DriveInfo([IO.Path]::GetPathRoot($target))
    if (-not $drive.IsReady) { throw ('Drive not ready: ' + $drive.Name) }
    $iso = Find-GuestIso
    if ($iso -and ($drive.DriveFormat -match 'FAT') -and ((Get-Item -LiteralPath $iso).Length -ge 4GB)) {
        throw ($drive.Name + ' is ' + $drive.DriveFormat + ': the ISO is over 4 GB. Format the stick as exFAT or NTFS.')
    }
    $need = 0
    foreach ($f in @(Get-ChildItem -LiteralPath $script:Kit -Recurse -Force | Where-Object { -not $_.PSIsContainer })) { $need += $f.Length }
    if ($drive.AvailableFreeSpace -lt $need) { throw ('Not enough space on ' + $drive.Name + ': ' + [Math]::Ceiling($need / 1GB) + ' GB needed.') }
    Say ('Copying the kit to ' + $target + ' ...')
    $xd = @($script:Exchange, $script:Sessions, $script:Downloads, (Join-Path $script:Kit 'test'))
    & robocopy.exe $script:Kit $target /E /R:1 /W:1 /NFL /NDL /NJH /NP /XD $xd | Out-Null
    if ($LASTEXITCODE -ge 8) { throw ('robocopy failed (exit ' + $LASTEXITCODE + ').') }
    Ensure-Dir (Join-Path $target 'exchange\inbox'); Ensure-Dir (Join-Path $target 'exchange\outbox')
    Good 'Copied. Checking the copy...'
    $saved = $script:Kit
    try { Set-KitRoot $target; $bad = Invoke-Verify } finally { Set-KitRoot $saved }
    if ($bad -eq 0) { Good ('The stick is ready: ' + $target + '\CONTAIN.cmd') }
}
