<#
  ServiceKit Irányítópult szerver / Dashboard server
  A tiny local web server (127.0.0.1 only) that serves the launcher and tells it
  which kit programs are running. Installs nothing and needs no admin rights.
  PowerShell 2.0+ (Windows 7) compatible.
#>
param([int]$Port = 47800, [switch]$NoBrowser, [int]$WaitPid = 0)

$CoreDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $CoreDir 'kit.ps1')
$ErrorActionPreference = 'Continue'

$LauncherDir = Join-Path $KitRoot 'launcher'
$EnvsDir = Join-Path $KitRoot 'envs'
$ExchangeDir = Join-Path $KitRoot 'exchange'
foreach ($d in @($EnvsDir, $ExchangeDir)) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }

$OS = Get-KitOS
$IsWin = [bool]$OS['windows']
$Token = ([guid]::NewGuid().ToString('N'))
$Cat = Get-Catalog

# ------------------------------------------------------------------ app index
$ToolsLower = $ToolsDir.ToLower()
$Apps = @{}          # appId -> @{ pkg; app }
foreach ($p in @($Cat['packages'])) { foreach ($a in @($p['apps'])) { $Apps[$a['id']] = @{ pkg = $p; app = $a } } }

$script:ExeMap = @{}       # lower-case full path -> appId
$script:AppExe = @{}       # appId -> full path
$script:InstStamp = $null
function Update-ExeMap {
    $f = Join-Path $StateDir 'installed.json'
    $stamp = ''
    if (Test-Path $f) { $stamp = (Get-Item $f).LastWriteTime.Ticks.ToString() }
    if ($stamp -eq $script:InstStamp -and $script:AppExe.Count -gt 0) { return }
    $script:InstStamp = $stamp
    $script:ExeCache = @{}
    $script:ExeMap = @{}; $script:AppExe = @{}
    $inst = Get-Installed
    $cacheFile = Join-Path $StateDir 'exe-cache.json'
    $cache = Read-KitJson $cacheFile @{}
    $newCache = @{}
    foreach ($id in @($Apps.Keys)) {
        $pkgId = $Apps[$id]['pkg']['id']
        $e = $null
        $c = Get-Key $cache $id $null
        if ($c) { $full = Join-Path $ToolsDir $c; if (Test-Path -LiteralPath $full) { $e = $full } }
        if (-not $e -and ($inst.ContainsKey($pkgId) -or (Get-Key $Apps[$id]['app'] 'installed' $null))) {
            $e = Find-KitExe $pkgId $Apps[$id]['app'] ([bool]$OS['is64'])
        }
        if ($e) {
            $script:AppExe[$id] = $e; $script:ExeMap[$e.ToLower()] = $id
            if ($e.ToLower().StartsWith($ToolsLower)) { $newCache[$id] = [string]$e.Substring($ToolsDir.Length).TrimStart('\', '/') }
        }
    }
    Write-KitJson $cacheFile $newCache
}

# ------------------------------------------------------------------ process sampling
$script:PrevCpu = @{}      # pid -> @{ t = 100ns cpu; w = wall ticks }
$script:ProcCache = $null; $script:ProcAt = [DateTime]::MinValue
$script:SysCache = $null;  $script:SysAt = [DateTime]::MinValue
$Cores = [Environment]::ProcessorCount

function Get-KitProcesses {
    if ($script:ProcCache -and (([DateTime]::Now - $script:ProcAt).TotalMilliseconds -lt 900)) { return $script:ProcCache }
    $now = [DateTime]::Now.Ticks
    $list = @(); $seen = @{}
    $rows = @()
    if ($IsWin) {
        try {
            foreach ($p in @(Get-WmiObject Win32_Process -Property ProcessId, Name, ExecutablePath, KernelModeTime, UserModeTime, WorkingSetSize, CreationDate -ErrorAction Stop)) {
                if (-not $p.ExecutablePath) { continue }
                $rows += @{ pid = [int]$p.ProcessId; path = [string]$p.ExecutablePath; cpu = ([double]$p.KernelModeTime + [double]$p.UserModeTime);
                            mem = [double]$p.WorkingSetSize; start = [string]$p.CreationDate }
            }
        } catch { }
    } else {
        foreach ($p in @(Get-Process -ErrorAction SilentlyContinue)) {
            $path = $null; try { $path = $p.Path } catch { }
            if (-not $path) { continue }
            $c = 0; try { $c = $p.TotalProcessorTime.Ticks } catch { }
            $st = ''; try { $st = $p.StartTime.ToString('yyyyMMddHHmmss') } catch { }
            $rows += @{ pid = $p.Id; path = $path; cpu = [double]$c; mem = [double]$p.WorkingSet64; start = $st }
        }
    }
    foreach ($r in $rows) {
        $lp = $r['path'].ToLower()
        $appId = $null
        if ($script:ExeMap.ContainsKey($lp)) { $appId = $script:ExeMap[$lp] }
        elseif (-not $lp.StartsWith($ToolsLower)) { continue }
        $pct = 0.0
        if ($script:PrevCpu.ContainsKey($r['pid'])) {
            $pv = $script:PrevCpu[$r['pid']]
            $dw = $now - $pv['w']
            if ($dw -gt 0) { $pct = [Math]::Round(100.0 * ($r['cpu'] - $pv['t']) / ($dw * $Cores), 1) }
            if ($pct -lt 0) { $pct = 0 }
        }
        $seen[$r['pid']] = @{ t = $r['cpu']; w = $now }
        $rel = $r['path']
        if ($lp.StartsWith($ToolsLower)) { $rel = $r['path'].Substring($ToolsDir.Length).TrimStart('\', '/') }
        $pkgId = ($rel -split '[\\/]')[0]
        $started = ''
        if ($r['start'].Length -ge 14) { $started = $r['start'].Substring(0, 4) + '-' + $r['start'].Substring(4, 2) + '-' + $r['start'].Substring(6, 2) + 'T' + $r['start'].Substring(8, 2) + ':' + $r['start'].Substring(10, 2) + ':' + $r['start'].Substring(12, 2) }
        $list += @{ pid = $r['pid']; app = $appId; pkg = $pkgId; exe = [IO.Path]::GetFileName($r['path']); path = $rel;
                    cpu = $pct; memMB = [Math]::Round($r['mem'] / 1MB, 1); started = $started }
    }
    $script:PrevCpu = $seen
    $script:ProcCache = $list; $script:ProcAt = [DateTime]::Now
    return $list
}

function Get-SysInfo {
    if ($script:SysCache -and (([DateTime]::Now - $script:SysAt).TotalSeconds -lt 3)) { return $script:SysCache }
    $s = @{ cpu = $null; memTotalMB = $null; memFreeMB = $null; diskFreeGB = $null; diskTotalGB = $null; drive = '' }
    if ($IsWin) {
        try { $cpus = @(Get-WmiObject Win32_Processor -Property LoadPercentage -ErrorAction Stop); $sum = 0; foreach ($c in $cpus) { $sum += [int]$c.LoadPercentage }; $s['cpu'] = [int]($sum / [Math]::Max(1, $cpus.Count)) } catch { }
        try { $o = Get-WmiObject Win32_OperatingSystem -Property TotalVisibleMemorySize, FreePhysicalMemory -ErrorAction Stop
              $s['memTotalMB'] = [int]($o.TotalVisibleMemorySize / 1024); $s['memFreeMB'] = [int]($o.FreePhysicalMemory / 1024) } catch { }
    }
    try {
        $root = [IO.Path]::GetPathRoot($KitRoot)
        $di = New-Object System.IO.DriveInfo($root)
        $s['drive'] = $root; $s['diskFreeGB'] = [Math]::Round($di.AvailableFreeSpace / 1GB, 1); $s['diskTotalGB'] = [Math]::Round($di.TotalSize / 1GB, 1)
    } catch { }
    $script:SysCache = $s; $script:SysAt = [DateTime]::Now
    return $s
}

# ------------------------------------------------------------------ safe space
function Get-SbieStart {
    foreach ($b in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramW6432)) {
        if (-not $b) { continue }
        $p = Join-Path $b 'Sandboxie-Plus\Start.exe'; if (Test-Path $p) { return $p }
        $p = Join-Path $b 'Sandboxie\Start.exe'; if (Test-Path $p) { return $p }
    }
    return $null
}

$script:SafeCache = $null
function Get-SafeInfo {
    if ($script:SafeCache) {
        $script:SafeCache['sbie'] = [bool](Get-SbieStart)
        $script:SafeCache['envs'] = Get-Envs
        $script:SafeCache['python'] = [bool](Get-Python)
        return $script:SafeCache
    }
    $wsbExe = $null; if ($env:SystemRoot) { $wsbExe = Join-Path $env:SystemRoot 'System32\WindowsSandbox.exe' }
    $edition = '' + $OS['name']
    $wsbPossible = $IsWin -and ($OS['major'] -ge 10) -and ([int]$OS['build'] -ge 18305) -and ($edition -notmatch 'Home|Otthoni')
    $virt = $null
    if ($IsWin -and $OS['major'] -ge 10) { try { $virt = [bool](@(Get-WmiObject Win32_Processor -Property VirtualizationFirmwareEnabled)[0].VirtualizationFirmwareEnabled) } catch { } }
    $script:SafeCache = @{
        wsb = [bool]($wsbExe -and (Test-Path $wsbExe)); wsbPossible = $wsbPossible; virtualization = $virt; edition = $edition;
        sbie = [bool](Get-SbieStart); sbieBox = 'DefaultBox'; envs = (Get-Envs); python = [bool](Get-Python); exchange = $ExchangeDir
    }
    return $script:SafeCache
}

function Get-Python {
    $p = Find-KitExe 'python' @{ exe = 'python.exe' }
    return $p
}

function Get-Envs {
    $r = @()
    foreach ($d in @(Get-ChildItem -LiteralPath $EnvsDir -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer })) { $r += $d.Name }
    return ,$r
}

function Get-QuotedArg([string]$s) { return '"' + $s.Replace('"', '""') + '"' }

function Start-KitShell([string]$Extra) {
    $shell = Join-Path $CoreDir 'kitshell.cmd'
    $cmd = '/k call ' + (Get-QuotedArg $shell)
    if ($Extra) { $cmd += ' && ' + $Extra }
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList $cmd -WorkingDirectory $KitRoot -PassThru
    return $p.Id
}

function Start-WindowsSandbox([string]$AppId, [bool]$Net) {
    $s = Get-SafeInfo
    if (-not $s['wsb']) { throw 'wsb-missing' }
    if (@(Get-Process -Name 'WindowsSandbox', 'WindowsSandboxClient', 'WindowsSandboxRemoteSession' -ErrorAction SilentlyContinue).Count -gt 0) { throw 'wsb-running' }
    $cmd = 'explorer.exe C:\Kit\tools'
    if ($AppId) {
        $exe = $script:AppExe[$AppId]
        if (-not $exe) { throw 'not-installed' }
        if ($exe.ToLower().StartsWith($ToolsLower)) { $cmd = 'C:\Kit\tools\' + $exe.Substring($ToolsDir.Length).TrimStart('\') }
    }
    $netv = 'Disable'; if ($Net) { $netv = 'Enable' }
    $esc = { param($t) [System.Security.SecurityElement]::Escape($t) }
    $xml = @"
<Configuration>
  <VGpu>Disable</VGpu>
  <Networking>$netv</Networking>
  <ClipboardRedirection>Enable</ClipboardRedirection>
  <PrinterRedirection>Disable</PrinterRedirection>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <MappedFolders>
    <MappedFolder><HostFolder>$(& $esc $ToolsDir)</HostFolder><SandboxFolder>C:\Kit\tools</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$(& $esc $ExchangeDir)</HostFolder><SandboxFolder>C:\Kit\exchange</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>$(& $esc $cmd)</Command></LogonCommand>
</Configuration>
"@
    $wsb = Join-Path $StateDir 'servicekit.wsb'
    Write-KitText $wsb $xml
    Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsSandbox.exe') -ArgumentList (Get-QuotedArg $wsb) | Out-Null
    return 0
}

# ------------------------------------------------------------------ jobs, background tasks, docs
$JobsDir = Join-Path $DataDir 'jobs'
$ReportsDir = Join-Path $DataDir 'reports'
$DocsDir = Join-Path $KitRoot 'docs'
foreach ($d in @($JobsDir, $ReportsDir, $DocsDir)) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }
$ActiveFile = Join-Path $StateDir 'active-job.json'
$TaskFile = Join-Path $StateDir 'task.json'

function Get-Task { return (Read-KitJson $TaskFile $null) }
function Test-TaskBusy {
    $t = Get-Task
    if (-not $t -or $t['phase'] -ne 'running') { return $false }
    $tp = 0; try { $tp = [int]$t['pid'] } catch { }
    if ($tp -gt 0) { if (-not (Get-Process -Id $tp -ErrorAction SilentlyContinue)) { return $false } }
    try { if (((Get-Date) - [datetime]$t['started']).TotalMinutes -gt 15) { return $false } } catch { }
    return $true
}
function Start-KitTask([string]$TaskAction, [string]$JobId, [string]$Extra) {
    if (Test-TaskBusy) { throw 'task-busy' }
    Write-KitJson $TaskFile @{ action = $TaskAction; job = $JobId; phase = 'running'; msg = 'starting'; started = (Get-Date).ToString('s'); pid = 0 }
    $argl = '-NoProfile -ExecutionPolicy Bypass -File ' + (Get-QuotedArg (Join-Path $CoreDir 'tasks.ps1')) + ' -Action ' + $TaskAction
    if ($JobId) { $argl += ' -Job ' + $JobId }
    if ($Extra) { $argl += ' ' + $Extra }
    $lang = Get-Key (Read-KitJson (Join-Path $StateDir 'settings.json') @{}) 'lang' 'hu'
    $argl += ' -Lang ' + $lang
    $sp = @{ FilePath = (Get-PsExe); ArgumentList = $argl; WorkingDirectory = $KitRoot }
    if ($IsWin) { $sp['WindowStyle'] = 'Hidden' }
    Start-Process @sp | Out-Null
}

function Get-JobFile([string]$Id) { return (Join-Path $JobsDir ($Id + '.json')) }
function Read-Job([string]$Id) {
    if ($Id -notmatch '^[A-Za-z0-9-]{4,80}$') { throw 'bad-job' }
    $j = Read-KitJson (Get-JobFile $Id) $null
    if (-not $j) { throw 'no-job' }
    return $j
}
function Save-Job($J) { Write-KitJson (Get-JobFile $J['id']) $J }
function Get-ActiveId { $a = Read-KitJson $ActiveFile $null; if ($a) { return [string]$a['id'] }; return '' }

function Get-ReportResult([string]$Id) { return (Read-KitJson (Join-Path (Join-Path $ReportsDir $Id) 'result.json') $null) }

# Finishes a job whose closing task has completed; returns the active job (or $null).
function Sync-ActiveJob {
    $id = Get-ActiveId
    if (-not $id) { return $null }
    $j = $null; try { $j = Read-Job $id } catch { Remove-Item $ActiveFile -ErrorAction SilentlyContinue; return $null }
    if ($j['status'] -eq 'closing') {
        $t = Get-Task
        if ($t -and $t['job'] -eq $id -and $t['action'] -eq 'close' -and $t['phase'] -ne 'running') {
            if ($t['phase'] -eq 'done') {
                $j['status'] = 'closed'; $j['ended'] = [string]$t['finished']
                $rr = Get-ReportResult $id; if ($rr) { $j['report'] = $rr }
                Save-Job $j
                Remove-Item $ActiveFile -ErrorAction SilentlyContinue
                Update-JobsCsv
                return $null
            } else { $j['status'] = 'open'; Save-Job $j }
        }
    }
    return $j
}

function Add-JobAction([string]$Type, [string]$App, [string]$Name, [string]$Mode) {
    $id = Get-ActiveId; if (-not $id) { return }
    try {
        $j = Read-Job $id
        if ($j['status'] -ne 'open') { return }
        $acts = @(Get-Key $j 'actions' @())
        $acts += @{ t = (Get-Date).ToString('s'); type = $Type; app = $App; name = $Name; mode = $Mode }
        $j['actions'] = $acts
        Save-Job $j
    } catch { }
}

function Get-JobSummary($j) {
    $o = @{ id = $j['id']; client = (Get-Key (Get-Key $j 'client' @{}) 'name' ''); clientId = (Get-Key (Get-Key $j 'client' @{}) 'id' '');
            computer = $j['computer']; task = (Get-Key $j 'task' ''); started = $j['started']; ended = (Get-Key $j 'ended' ''); status = $j['status'];
            notes = @(Get-Key $j 'notes' @()).Count; actions = @(Get-Key $j 'actions' @()).Count }
    $rr = Get-Key $j 'report' $null
    if (-not $rr) { $rr = Get-ReportResult $j['id'] }
    if ($rr) { $o['html'] = Get-Key $rr 'html' ''; $o['pdf'] = Get-Key $rr 'pdf' ''; $o['reportFinal'] = [bool](Get-Key $rr 'final' $false) }
    $o['before'] = (Test-Path (Join-Path $JobsDir ($j['id'] + '.before.json')))
    return $o
}

function Get-AllJobs {
    $list = @()
    foreach ($f in @(Get-ChildItem -LiteralPath $JobsDir -Filter '*.json' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '\.(before|after)\.json$' })) {
        $j = Read-KitJson $f.FullName $null
        if ($j -and $j['id']) { $list += (Get-JobSummary $j) }
    }
    return @($list | Sort-Object { $_['started'] } -Descending)
}

function Update-JobsCsv {
    $sep = ';'
    $lines = @('Munka azonosito;Kezdes;Befejezes;Ugyfel;Gep;Idotartam (perc);Feladat;Jegyzetek;Jelentes')
    foreach ($s in (Get-AllJobs)) {
        if ($s['status'] -ne 'closed') { continue }
        $dur = ''; try { $dur = [int](([datetime]$s['ended']) - ([datetime]$s['started'])).TotalMinutes } catch { }
        $fd = { param($x) try { ([datetime]$x).ToString('yyyy-MM-dd HH:mm') } catch { [string]$x } }
        $cells = @($s['id'], (& $fd $s['started']), (& $fd $s['ended']), $s['client'], $s['computer'], $dur, ([string]$s['task']).Replace("`r", ' ').Replace("`n", ' '), $s['notes'], $s['html'])
        $q = @(); foreach ($c in $cells) { $q += ('"' + ([string]$c).Replace('"', '""') + '"') }
        $lines += ($q -join $sep)
    }
    $enc = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText((Join-Path $DataDir 'jobs.csv'), (($lines -join "`r`n") + "`r`n"), $enc)
}

function Get-Clients { return @(Read-KitJson (Join-Path $DataDir 'clients.json') @()) }
function Save-Client($In) {
    $name = ([string](Get-Key $In 'name' '')).Trim()
    if (-not $name) { throw 'client-name' }
    $all = @(Get-Clients)
    $id = [string](Get-Key $In 'id' '')
    $found = $null
    foreach ($c in $all) { if ($c -and $id -and $c['id'] -eq $id) { $found = $c } }
    if (-not $found) {
        $base = Get-KitSlug $name; $id = $base; $n = 2
        $ids = @{}; foreach ($c in $all) { if ($c) { $ids[$c['id']] = $true } }
        while ($ids.ContainsKey($id)) { $id = $base + '-' + $n; $n++ }
        $found = @{ id = $id; created = (Get-Date).ToString('s') }
        $all += $found
    }
    foreach ($k in @('name', 'phone', 'email', 'address', 'notes')) { $v = Get-Key $In $k $null; if ($null -ne $v) { $found[$k] = ([string]$v).Trim() } }
    Write-KitJson (Join-Path $DataDir 'clients.json') $all
    return $found
}

function Get-Docs {
    $r = @()
    foreach ($f in @(Get-ChildItem -LiteralPath $DocsDir -Recurse -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer -and $_.Name -notmatch '^(README|OLVASS)' })) {
        $rel = $f.FullName.Substring($DocsDir.Length).TrimStart('\', '/')
        $r += @{ path = [string]$rel; name = [string]$f.Name; kb = [int]($f.Length / 1KB); ext = [string]$f.Extension.ToLower().TrimStart('.') }
        if ($r.Count -ge 500) { break }
    }
    return @($r | Sort-Object { $_['path'] })
}

function Open-KitFile([string]$Rel) {
    $Rel = $Rel.Replace('/', '\')
    if (-not $IsWin) { $Rel = $Rel.Replace('\', '/') }
    if ($Rel -match '\.\.' -or $Rel -match '^[\\/]' -or $Rel -match ':') { throw 'bad-path' }
    if ($Rel -notmatch '^(data[\\/]reports|data[\\/]backups|docs|data[\\/]jobs\.csv)') { throw 'bad-path' }
    $full = Join-Path $KitRoot $Rel
    if (-not (Test-Path -LiteralPath $full)) { throw 'no-file' }
    if ($IsWin) { Start-Process -FilePath $full | Out-Null }
}

# ------------------------------------------------------------------ playbooks
$PbRoot = Join-Path $StateDir 'playbooks'
if (-not (Test-Path $PbRoot)) { New-Item -ItemType Directory -Path $PbRoot -Force | Out-Null }
$PbActiveFile = Join-Path $StateDir 'playbook-active.json'
$PbDefs = @{}
foreach ($p in @((Read-KitJson (Join-Path $CoreDir 'playbooks.json') @{ playbooks = @() })['playbooks'])) { $PbDefs[$p['id']] = $p }

function Get-PbActiveId { $a = Read-KitJson $PbActiveFile $null; if ($a) { return [string]$a['id'] }; return '' }
function Get-PbRunDir([string]$RunId) { if ($RunId -notmatch '^[A-Za-z0-9-]{4,80}$') { throw 'bad-run' }; return (Join-Path $PbRoot $RunId) }
function Read-PbRun([string]$RunId) { $r = Read-KitJson (Join-Path (Get-PbRunDir $RunId) 'run.json') $null; if (-not $r) { throw 'no-run' }; return $r }
function Read-PbResult([string]$RunId, [int]$Idx) { return (Read-KitJson (Join-Path (Get-PbRunDir $RunId) ('' + $Idx + '.json')) $null) }
function Write-PbResult([string]$RunId, [int]$Idx, $Res) { Write-KitJson (Join-Path (Get-PbRunDir $RunId) ('' + $Idx + '.json')) $Res }

function Test-PbBusy([string]$RunId) {
    $run = Read-PbRun $RunId
    for ($i = 0; $i -lt @($run['steps']).Count; $i++) { $r = Read-PbResult $RunId $i; if ($r -and $r['status'] -eq 'running') { return $true } }
    return $false
}

# Merges definitions with results, detects dead runners, logs finished steps into the active job.
function Get-PbState {
    $id = Get-PbActiveId
    if (-not $id) { return $null }
    $run = $null; try { $run = Read-PbRun $id } catch { Remove-Item $PbActiveFile -ErrorAction SilentlyContinue; return $null }
    $steps = @()
    for ($i = 0; $i -lt @($run['steps']).Count; $i++) {
        $d = $run['steps'][$i]
        $o = @{}; foreach ($k in @($d.Keys)) { $o[$k] = $d[$k] }
        $r = Read-PbResult $id $i
        if ($r -and $r['status'] -eq 'running') {
            $alive = $false; $rp = 0; try { $rp = [int]$r['pid'] } catch { }
            if ($rp -gt 0) { $alive = [bool](Get-Process -Id $rp -ErrorAction SilentlyContinue) }
            $age = 0; try { $age = ((Get-Date) - [datetime]$r['started']).TotalSeconds } catch { }
            if (-not $alive -and $age -gt 20) {
                $r = @{ status = 'fail'; summary = @{ hu = 'A lépés megszakadt.'; en = 'The step was interrupted.' }; started = $r['started']; finished = (Get-Date).ToString('s') }
                Write-PbResult $id $i $r
            }
        }
        if ($r) {
            foreach ($k in @('status', 'summary', 'details', 'files', 'started', 'finished')) { if ($r.ContainsKey($k)) { $o[$k] = $r[$k] } }
            if ($r['status'] -ne 'running' -and -not $r['logged']) {
                $t = Get-Key $d 'title' @{}; $sm = Get-Key $r 'summary' @{}
                Add-JobStep ([string]$run['pbTitle']['hu'] + ': ' + [string]$t['hu']) ([string]$run['pbTitle']['en'] + ': ' + [string]$t['en']) ([string]$sm['hu']) ([string]$sm['en']) ([string]$r['status'])
                $r['logged'] = $true; Write-PbResult $id $i $r
            }
        } else { $o['status'] = 'pending' }
        $steps += $o
    }
    return @{ id = $id; pb = $run['pb']; title = $run['pbTitle']; job = $run['job']; created = $run['created']; steps = $steps; closed = [bool](Get-Key $run 'closed' $false) }
}

function Add-JobStep([string]$NameHu, [string]$NameEn, [string]$SumHu, [string]$SumEn, [string]$Status) {
    $id = Get-ActiveId; if (-not $id) { return }
    try {
        $j = Read-Job $id
        if ($j['status'] -ne 'open') { return }
        $j['actions'] = @(Get-Key $j 'actions' @()) + @(@{ t = (Get-Date).ToString('s'); type = 'step'; name = $NameHu; nameEn = $NameEn; summary = $SumHu; summaryEn = $SumEn; status = $Status })
        Save-Job $j
    } catch { }
}

function Start-PbRun([string]$PbId, $Include, $Inputs) {
    if (-not $PbDefs.ContainsKey($PbId)) { throw 'unknown-playbook' }
    $cur = Get-PbActiveId
    if ($cur) { try { if (Test-PbBusy $cur) { throw 'step-running' } } catch { if ($_.Exception.Message -eq 'step-running') { throw } } }
    $def = $PbDefs[$PbId]
    $inc = @{}; foreach ($x in @($Include)) { $inc['' + $x] = $true }
    $steps = @(); $i = 0
    foreach ($st in @($def['steps'])) {
        $s = @{}; foreach ($k in @($st.Keys)) { $s[$k] = $st[$k] }
        $s['include'] = [bool]$inc.ContainsKey('' + $i)
        $p = @{}; foreach ($k in @((Get-Key $st 'params' @{}).Keys)) { $p[$k] = [string]$st['params'][$k] }
        $in = Get-Key $Inputs ('' + $i) $null
        if ($in) { foreach ($inp in @(Get-Key $st 'inputs' @())) { $v = Get-Key $in $inp['key'] $null; if ($null -ne $v) { $p[$inp['key']] = ([string]$v).Trim() } } }
        $s['params'] = $p
        $steps += $s; $i++
    }
    $id = (Get-Date).ToString('yyyyMMdd-HHmmss') + '-' + $PbId
    $dir = Get-PbRunDir $id
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Write-KitJson (Join-Path $dir 'run.json') @{ id = $id; pb = $PbId; pbTitle = $def['title']; job = (Get-ActiveId); created = (Get-Date).ToString('s'); steps = $steps }
    for ($k = 0; $k -lt $steps.Count; $k++) { if (-not $steps[$k]['include']) { Write-PbResult $id $k @{ status = 'skipped'; logged = $true; summary = @{ hu = 'Kihagyva.'; en = 'Skipped.' } } } }
    Write-KitJson $PbActiveFile @{ id = $id }
    return $id
}

function Start-PbStep([string]$RunId, [int]$Idx, $Params) {
    $run = Read-PbRun $RunId
    $st = @($run['steps'])[$Idx]
    if (-not $st) { throw 'no-step' }
    if ($st['kind'] -eq 'manual') { throw 'manual-step' }
    if (Test-PbBusy $RunId) { throw 'step-running' }
    $dir = Get-PbRunDir $RunId
    $pf = ''
    if ($Params) {
        $clean = @{}
        foreach ($inp in @(Get-Key $st 'inputs' @())) { $v = Get-Key $Params $inp['key'] $null; if ($null -ne $v) { $clean[$inp['key']] = ([string]$v).Trim() } }
        if ($clean.Count) { $pf = Join-Path $dir ('' + $Idx + '.params.json'); Write-KitJson $pf $clean }
    }
    $argl = '-NoProfile -ExecutionPolicy Bypass -File ' + (Get-QuotedArg (Join-Path $CoreDir 'playbook.ps1')) + ' -Run ' + $RunId + ' -Step ' + $Idx
    if ($pf) { $argl += ' -ParamsFile ' + (Get-QuotedArg $pf) }
    $sp = @{ FilePath = (Get-PsExe); ArgumentList = $argl; WorkingDirectory = $KitRoot; PassThru = $true }
    if ($IsWin) { $sp['WindowStyle'] = 'Hidden' }
    $needAdmin = [bool](Get-Key $st 'admin' $false)
    if ($needAdmin -and -not $OS['admin'] -and $IsWin) { $sp['Verb'] = 'RunAs' }
    Write-PbResult $RunId $Idx @{ status = 'running'; started = (Get-Date).ToString('s'); pid = 0 }
    try { $p = Start-Process @sp }
    catch {
        Write-PbResult $RunId $Idx @{ status = 'fail'; finished = (Get-Date).ToString('s'); summary = @{ hu = 'A rendszergazdai jóváhagyás elmaradt (UAC).'; en = 'Administrator approval was declined (UAC).' } }
        throw 'uac-declined'
    }
    $r = Read-PbResult $RunId $Idx
    if ($r -and $r['status'] -eq 'running' -and $p) { $r['pid'] = $p.Id; Write-PbResult $RunId $Idx $r }
}

function Invoke-PbManual([string]$RunId, [int]$Idx, [string]$What) {
    $run = Read-PbRun $RunId
    $st = @($run['steps'])[$Idx]
    if (-not $st -or $st['kind'] -ne 'manual') { throw 'no-step' }
    switch ($What) {
        'launch' {
            $app = [string](Get-Key $st 'app' '')
            if (-not $app) { throw 'no-app' }
            $procId = Invoke-Launch $app ([string](Get-Key $st 'mode' 'normal'))
            return $procId
        }
        'open' {
            $o = Get-Key $st 'open' $null
            if ($OS['legacy'] -and (Get-Key $st 'openLegacy' $null)) { $o = $st['openLegacy'] }
            if (-not $o) { throw 'nothing-to-open' }
            $sp = @{ FilePath = [string]$o['file'] }
            $a = [string](Get-Key $o 'args' ''); if ($a) { $sp['ArgumentList'] = $a }
            if ($IsWin) { Start-Process @sp | Out-Null }
            return 0
        }
        'folder' {
            $d = Join-Path $DataDir 'backups'
            $j = [string]$run['job']; if ($j) { $d = Join-Path $d $j } else { $d = Join-Path $d ([string]$env:COMPUTERNAME + '-' + (Get-Date).ToString('yyyyMMdd')) }
            if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
            Open-Explorer $d
            return 0
        }
    }
    throw 'bad-manual'
}

function Restart-Elevated {
    if (-not $IsWin) { throw 'windows-only' }
    $argl = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File ' + (Get-QuotedArg (Join-Path $CoreDir 'server.ps1')) + ' -Port ' + $Port + ' -NoBrowser -WaitPid ' + $PID
    try { Start-Process -FilePath (Get-PsExe) -ArgumentList $argl -Verb RunAs -WorkingDirectory $KitRoot | Out-Null } catch { throw 'uac-declined' }
}

# ------------------------------------------------------------------ actions
function Invoke-Launch([string]$AppId, [string]$Mode) {
    Update-ExeMap
    if (-not $Apps.ContainsKey($AppId)) { throw 'unknown-app' }
    $a = $Apps[$AppId]['app']
    $exe = $script:AppExe[$AppId]
    if (-not $exe) { throw 'not-installed' }
    $dir = Split-Path -Parent $exe
    $args0 = Get-Key $a 'args' ''
    if ($Mode -eq 'wsb') { return (Start-WindowsSandbox $AppId $true) }
    if ($Mode -eq 'sbie') {
        $sb = Get-SbieStart
        if (-not $sb) { throw 'sbie-missing' }
        $argl = '/box:DefaultBox ' + (Get-QuotedArg $exe)
        if ($args0) { $argl += ' ' + $args0 }
        $p = Start-Process -FilePath $sb -ArgumentList $argl -WorkingDirectory $dir -PassThru
        return $p.Id
    }
    if ((Get-Key $a 'console' $false) -and $args0) {
        return (Start-KitShell ('cd /d ' + (Get-QuotedArg $dir) + ' && ' + (Get-QuotedArg $exe) + ' ' + $args0))
    }
    $sp = @{ FilePath = $exe; WorkingDirectory = $dir; PassThru = $true }
    if ($args0) { $sp['ArgumentList'] = $args0 }
    if ($Mode -eq 'admin' -and $IsWin) { $sp['Verb'] = 'RunAs' }
    $p = Start-Process @sp
    if ($p) { return $p.Id }
    return 0
}

function Invoke-Setup($Body) {
    $ps = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path $ps)) { $ps = 'powershell.exe' }
    $argl = '-NoProfile -ExecutionPolicy Bypass -STA -File ' + (Get-QuotedArg (Join-Path $CoreDir 'setup.ps1'))
    $ids = @(Get-Key $Body 'ids' @())
    if ($ids.Count -gt 0) {
        $clean = @(); foreach ($i in $ids) { if ("$i" -match '^[a-z0-9-]+$') { $clean += "$i" } }
        $argl += ' -NoGui -NoLaunch -Update -Ids ' + ($clean -join ',')
    }
    $lang = Get-Key $Body 'lang' ''
    if ($lang -eq 'hu' -or $lang -eq 'en') { $argl += ' -Lang ' + $lang }
    Start-Process -FilePath $ps -ArgumentList $argl -WorkingDirectory $KitRoot | Out-Null
}

function Open-Explorer([string]$Path) {
    if ($IsWin) { Start-Process -FilePath 'explorer.exe' -ArgumentList (Get-QuotedArg $Path) | Out-Null }
}

function Invoke-Action([string]$Path, $Body) {
    switch ($Path) {
        '/api/launch' {
            $appId = [string](Get-Key $Body 'app' ''); $mode = [string](Get-Key $Body 'mode' 'normal')
            $procId = Invoke-Launch $appId $mode
            $nm = $appId; if ($Apps.ContainsKey($appId)) { $nm = [string]$Apps[$appId]['app']['name'] }
            Add-JobAction 'launch' $appId $nm $mode
            return @{ ok = $true; pid = $procId }
        }
        '/api/stop' {
            $procId = [int](Get-Key $Body 'pid' 0)
            $known = $false; foreach ($p in (Get-KitProcesses)) { if ($p['pid'] -eq $procId) { $known = $true } }
            if (-not $known) { throw 'not-kit-process' }
            Stop-Process -Id $procId -Force
            $script:ProcAt = [DateTime]::MinValue
            return @{ ok = $true }
        }
        '/api/folder' {
            $what = Get-Key $Body 'what' ''
            $target = $null
            switch ($what) {
                'inbox' { $target = $InboxDir } 'exchange' { $target = $ExchangeDir } 'kit' { $target = $KitRoot }
                'data' { $target = $DataDir } 'logs' { $target = $LogsDir }
                'docs' { $target = Join-Path $KitRoot 'docs' } 'reports' { $target = Join-Path $DataDir 'reports' }
                'backups' { $target = Join-Path $DataDir 'backups'; if (-not (Test-Path $target)) { New-Item -ItemType Directory -Path $target -Force | Out-Null } }
                'job' { $jid = [string](Get-Key $Body 'job' ''); if ($jid -match '^[A-Za-z0-9-]{4,80}$') { $target = Join-Path (Join-Path $DataDir 'reports') $jid } }
                default {
                    $pk = Get-Key $Body 'pkg' ''
                    if ($pk -match '^[a-z0-9-]+$') { $target = Join-Path $ToolsDir $pk }
                }
            }
            if (-not $target -or -not (Test-Path $target)) { throw 'no-folder' }
            Open-Explorer $target
            return @{ ok = $true }
        }
        '/api/page' {
            $pk = Get-Key $Body 'pkg' ''
            foreach ($p in @($Cat['packages'])) { if ($p['id'] -eq $pk) { Start-Process $p['page']; return @{ ok = $true } } }
            throw 'unknown-pkg'
        }
        '/api/setup' { Invoke-Setup $Body; return @{ ok = $true } }
        '/api/shell' { Add-JobAction 'launch' 'kitshell' 'Kit Shell' 'normal'; return @{ ok = $true; pid = (Start-KitShell '') } }
        '/api/venv' {
            $name = '' + (Get-Key $Body 'name' '')
            if ($name -notmatch '^[A-Za-z0-9_-]{1,40}$') { throw 'bad-name' }
            $py = Get-Python
            if (-not $py) { throw 'python-missing' }
            $envDir = Join-Path $EnvsDir $name
            $act = Get-QuotedArg (Join-Path $envDir 'Scripts\activate.bat')
            if (Test-Path $envDir) { $extra = 'call ' + $act }
            else { $extra = (Get-QuotedArg $py) + ' -m venv ' + (Get-QuotedArg $envDir) + ' && call ' + $act }
            $script:SafeCache = $null
            return @{ ok = $true; pid = (Start-KitShell $extra) }
        }
        '/api/venv-delete' {
            $name = '' + (Get-Key $Body 'name' '')
            if ($name -notmatch '^[A-Za-z0-9_-]{1,40}$') { throw 'bad-name' }
            $envDir = Join-Path $EnvsDir $name
            if (Test-Path $envDir) { Remove-Item -LiteralPath $envDir -Recurse -Force }
            $script:SafeCache = $null
            return @{ ok = $true }
        }
        '/api/wsb' {
            $app = Get-Key $Body 'app' ''
            Update-ExeMap
            $r = Start-WindowsSandbox $app ([bool](Get-Key $Body 'net' $false))
            $nm = 'Windows Sandbox'; if ($app -and $Apps.ContainsKey($app)) { $nm = [string]$Apps[$app]['app']['name'] }
            Add-JobAction 'launch' $app $nm 'wsb'
            return @{ ok = $true; pid = $r }
        }
        '/api/wsb-enable' {
            $cmdl = '-NoProfile -Command "Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All; Write-Host; Write-Host ''Restart the PC to finish / Inditsd ujra a gepet''; pause"'
            Start-Process -FilePath 'powershell.exe' -ArgumentList $cmdl -Verb RunAs | Out-Null
            $script:SafeCache = $null
            return @{ ok = $true }
        }
        '/api/sbie-wipe' {
            $sb = Get-SbieStart; if (-not $sb) { throw 'sbie-missing' }
            Start-Process -FilePath $sb -ArgumentList '/box:DefaultBox /terminate' -Wait
            Start-Process -FilePath $sb -ArgumentList '/box:DefaultBox delete_sandbox_silent' | Out-Null
            return @{ ok = $true }
        }
        '/api/settings' {
            $s = Read-KitJson (Join-Path $StateDir 'settings.json') @{}
            foreach ($k in @('lang', 'theme')) { $v = Get-Key $Body $k $null; if ($v -and "$v" -match '^[a-z]{2,8}$') { $s[$k] = "$v" } }
            Write-KitJson (Join-Path $StateDir 'settings.json') $s
            return @{ ok = $true }
        }
        '/api/jobs' { return @{ ok = $true; jobs = @(Get-AllJobs); clients = @(Get-Clients); tech = (Read-KitJson (Join-Path $DataDir 'technician.json') @{}) } }
        '/api/job-get' {
            $j = Read-Job ([string](Get-Key $Body 'id' ''))
            $o = @{ ok = $true; job = $j; summary = (Get-JobSummary $j) }
            return $o
        }
        '/api/job-start' {
            if (Get-ActiveId) { throw 'job-active' }
            $cl = $null
            $cid = [string](Get-Key $Body 'clientId' '')
            if ($cid) { foreach ($c in @(Get-Clients)) { if ($c -and $c['id'] -eq $cid) { $cl = $c } } }
            if (-not $cl) { $cl = Save-Client (Get-Key $Body 'client' @{}) }
            $comp = ([string](Get-Key $Body 'computer' $env:COMPUTERNAME)).Trim(); if (-not $comp) { $comp = [string]$env:COMPUTERNAME }; if (-not $comp) { $comp = 'pc' }
            $id = (Get-Date).ToString('yyyyMMdd-HHmm') + '-' + (Get-KitSlug $comp)
            $n = 2; $base = $id; while (Test-Path (Get-JobFile $id)) { $id = $base + '-' + $n; $n++ }
            $j = @{ id = $id; client = $cl; computer = $comp; task = ([string](Get-Key $Body 'task' '')).Trim(); started = (Get-Date).ToString('s');
                    status = 'open'; notes = @(); actions = @(); includeKeys = [bool](Get-Key $Body 'includeKeys' $false); smart = [bool](Get-Key $Body 'smart' $true) }
            Save-Job $j
            Write-KitJson $ActiveFile @{ id = $id }
            try { Start-KitTask 'snapshot' $id '-Phase before' } catch { }
            return @{ ok = $true; id = $id }
        }
        '/api/job-note' {
            $id = Get-ActiveId; if (-not $id) { throw 'no-active-job' }
            $text = ([string](Get-Key $Body 'text' '')).Trim(); if (-not $text) { throw 'empty' }
            if ($text.Length -gt 4000) { $text = $text.Substring(0, 4000) }
            $j = Read-Job $id
            $j['notes'] = @(Get-Key $j 'notes' @()) + @(@{ t = (Get-Date).ToString('s'); text = $text })
            Save-Job $j
            return @{ ok = $true }
        }
        '/api/job-report' {
            $id = [string](Get-Key $Body 'id' (Get-ActiveId)); if (-not $id) { throw 'no-active-job' }
            [void](Read-Job $id)
            Start-KitTask 'report' $id ''
            return @{ ok = $true }
        }
        '/api/job-close' {
            $id = Get-ActiveId; if (-not $id) { throw 'no-active-job' }
            $j = Read-Job $id
            Start-KitTask 'close' $id ''
            $j['status'] = 'closing'; Save-Job $j
            return @{ ok = $true }
        }
        '/api/job-discard' {
            $id = Get-ActiveId; if (-not $id) { throw 'no-active-job' }
            foreach ($suf in @('.json', '.before.json', '.after.json')) { $f = Join-Path $JobsDir ($id + $suf); if (Test-Path $f) { Remove-Item $f -Force } }
            $rd = Join-Path $ReportsDir $id; if (Test-Path $rd) { Remove-Item $rd -Recurse -Force }
            Remove-Item $ActiveFile -ErrorAction SilentlyContinue
            return @{ ok = $true }
        }
        '/api/client-save' { return @{ ok = $true; client = (Save-Client $Body) } }
        '/api/tech-save' {
            $t = @{}; foreach ($k in @('name', 'company', 'phone', 'email')) { $t[$k] = ([string](Get-Key $Body $k '')).Trim() }
            Write-KitJson (Join-Path $DataDir 'technician.json') $t
            return @{ ok = $true }
        }
        '/api/open-file' { Open-KitFile ([string](Get-Key $Body 'path' '')); return @{ ok = $true } }
        '/api/docs' { return @{ ok = $true; docs = @(Get-Docs) } }
        '/api/verify' { Start-KitTask 'verify' '' ''; return @{ ok = $true } }
        '/api/pb-start' {
            $id = Start-PbRun ([string](Get-Key $Body 'id' '')) (Get-Key $Body 'include' @()) (Get-Key $Body 'inputs' @{})
            return @{ ok = $true; run = $id }
        }
        '/api/pb-step' {
            Start-PbStep ([string](Get-Key $Body 'run' '')) ([int](Get-Key $Body 'step' -1)) (Get-Key $Body 'params' $null)
            return @{ ok = $true }
        }
        '/api/pb-manual' {
            $rid = [string](Get-Key $Body 'run' ''); $idx = [int](Get-Key $Body 'step' -1)
            $r = Invoke-PbManual $rid $idx ([string](Get-Key $Body 'what' ''))
            $run = Read-PbRun $rid; $st = @($run['steps'])[$idx]
            if ((Get-Key $Body 'what' '') -eq 'launch') { Add-JobAction 'launch' ([string]$st['app']) ([string]$Apps[[string]$st['app']]['app']['name']) ([string](Get-Key $st 'mode' 'normal')) }
            return @{ ok = $true; pid = $r }
        }
        '/api/pb-mark' {
            $rid = [string](Get-Key $Body 'run' ''); $idx = [int](Get-Key $Body 'step' -1)
            $run = Read-PbRun $rid; if (-not @($run['steps'])[$idx]) { throw 'no-step' }
            $cur = Read-PbResult $rid $idx; if ($cur -and $cur['status'] -eq 'running') { throw 'step-running' }
            $stt = [string](Get-Key $Body 'status' 'done'); if ($stt -ne 'done' -and $stt -ne 'skipped') { throw 'bad-status' }
            $note = ([string](Get-Key $Body 'note' '')).Trim(); if ($note.Length -gt 1000) { $note = $note.Substring(0, 1000) }
            $sm = @{ hu = 'Elvégezve.'; en = 'Done.' }; if ($stt -eq 'skipped') { $sm = @{ hu = 'Kihagyva.'; en = 'Skipped.' } }
            if ($note) { $sm = @{ hu = $note; en = $note } }
            Write-PbResult $rid $idx @{ status = $stt; summary = $sm; finished = (Get-Date).ToString('s'); logged = ($stt -eq 'skipped' -and -not $note) }
            return @{ ok = $true }
        }
        '/api/pb-close' {
            $rid = Get-PbActiveId
            if ($rid) { if (Test-PbBusy $rid) { throw 'step-running' }; $run = Read-PbRun $rid; $run['closed'] = $true; Write-KitJson (Join-Path (Get-PbRunDir $rid) 'run.json') $run }
            Remove-Item $PbActiveFile -ErrorAction SilentlyContinue
            return @{ ok = $true }
        }
        '/api/elevate' { Restart-Elevated; $script:QuitAt = (Get-Date).AddSeconds(1); return @{ ok = $true } }
        '/api/rescan' { $script:InstStamp = $null; $script:SafeCache = $null; Update-ExeMap; return @{ ok = $true } }
        '/api/quit' { $script:Quit = $true; return @{ ok = $true } }
    }
    throw 'unknown-route'
}

function Get-State {
    Update-ExeMap
    $inst = Get-Installed
    $apps = @{}
    foreach ($k in @($script:AppExe.Keys)) { $apps[$k] = $true }
    $jobSum = $null
    $aj = Sync-ActiveJob
    if ($aj) { $jobSum = Get-JobSummary $aj }
    return @{
        ok = $true; time = (Get-Date).ToString('s'); kit = $KitRoot; version = $Cat['version'];
        os = $OS; sys = (Get-SysInfo); running = @(Get-KitProcesses); installed = $inst; apps = $apps;
        progress = (Read-KitJson (Join-Path $StateDir 'progress.json') $null); safe = (Get-SafeInfo);
        settings = (Read-KitJson (Join-Path $StateDir 'settings.json') @{});
        computer = [string]$env:COMPUTERNAME; job = $jobSum; playbook = (Get-PbState); task = (Get-Task); integrity = (Read-KitJson (Join-Path $StateDir 'integrity.json') $null)
    }
}

# ------------------------------------------------------------------ HTTP plumbing
$Mime = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8';
           '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2' }

function Send-Response($Stream, [int]$Code, [string]$Type, [byte[]]$Body) {
    $reason = @{ 200 = 'OK'; 400 = 'Bad Request'; 403 = 'Forbidden'; 404 = 'Not Found'; 500 = 'Error' }[$Code]
    $h = "HTTP/1.1 $Code $reason`r`nContent-Type: $Type`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`n" +
         "X-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($h)
    $Stream.Write($hb, 0, $hb.Length)
    if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
    $Stream.Flush()
}
function Send-Json($Stream, [int]$Code, $Obj) { Send-Response $Stream $Code 'application/json; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes((ConvertTo-KitJson $Obj))) }

function Read-Request($Client) {
    $Client.ReceiveTimeout = 3000
    $s = $Client.GetStream()
    $buf = New-Object byte[] 65536
    $ms = New-Object System.IO.MemoryStream
    $headEnd = -1
    while ($headEnd -lt 0) {
        $n = $s.Read($buf, 0, $buf.Length)
        if ($n -le 0) { break }
        $ms.Write($buf, 0, $n)
        $txt = [System.Text.Encoding]::ASCII.GetString($ms.ToArray())
        $headEnd = $txt.IndexOf("`r`n`r`n")
        if ($ms.Length -gt 1MB) { break }
    }
    if ($headEnd -lt 0) { return $null }
    $all = $ms.ToArray()
    $head = [System.Text.Encoding]::ASCII.GetString($all, 0, $headEnd)
    $lines = $head -split "`r`n"
    $first = $lines[0] -split ' '
    $hdr = @{}
    for ($i = 1; $i -lt $lines.Count; $i++) { $c = $lines[$i].IndexOf(':'); if ($c -gt 0) { $hdr[$lines[$i].Substring(0, $c).Trim().ToLower()] = $lines[$i].Substring($c + 1).Trim() } }
    $len = 0; if ($hdr.ContainsKey('content-length')) { $len = [int]$hdr['content-length'] }
    if ($len -gt 1MB) { return $null }
    $bodyStart = $headEnd + 4
    while (($all.Length - $bodyStart) -lt $len) {
        $n = $s.Read($buf, 0, $buf.Length); if ($n -le 0) { break }
        $ms.Write($buf, 0, $n); $all = $ms.ToArray()
    }
    $body = ''
    if ($len -gt 0) { $body = [System.Text.Encoding]::UTF8.GetString($all, $bodyStart, [Math]::Min($len, $all.Length - $bodyStart)) }
    $url = $first[1]; $q = $url.IndexOf('?'); if ($q -ge 0) { $url = $url.Substring(0, $q) }
    return @{ method = $first[0]; path = [System.Uri]::UnescapeDataString($url); headers = $hdr; body = $body; stream = $s }
}

function Handle-Request($Client) {
    $req = Read-Request $Client
    if (-not $req) { return }
    $s = $req['stream']
    $hostOk = $false
    $h = '' + $req['headers']['host']
    foreach ($ok in @("127.0.0.1:$Port", "localhost:$Port")) { if ($h -eq $ok) { $hostOk = $true } }
    if (-not $hostOk) { Send-Json $s 403 @{ ok = $false; error = 'bad-host' }; return }

    $path = $req['path']
    try {
        if ($req['method'] -eq 'GET') {
            if ($path -eq '/api/state') { Send-Json $s 200 (Get-State); return }
            if ($path -eq '/api/catalog') { Send-Response $s 200 'application/json; charset=utf-8' ([IO.File]::ReadAllBytes((Join-Path $CoreDir 'catalog.json'))); return }
            if ($path -eq '/' -or $path -eq '/index.html') {
                $html = (Read-KitText (Join-Path $LauncherDir 'index.html')).Replace('__KIT_TOKEN__', $Token).Replace('__KIT_MODE__', 'server')
                Send-Response $s 200 $Mime['.html'] ([System.Text.Encoding]::UTF8.GetBytes($html)); return
            }
            $rel = $path.TrimStart('/').Replace('/', '\')
            if ($rel -match '\.\.' -or $rel -match ':') { Send-Json $s 403 @{ ok = $false }; return }
            $file = Join-Path $LauncherDir $rel
            if (-not $IsWin) { $file = Join-Path $LauncherDir ($path.TrimStart('/')) }
            if (Test-Path $file -PathType Leaf) {
                $ext = [IO.Path]::GetExtension($file).ToLower()
                $type = 'application/octet-stream'; if ($Mime.ContainsKey($ext)) { $type = $Mime[$ext] }
                Send-Response $s 200 $type ([IO.File]::ReadAllBytes($file)); return
            }
            Send-Json $s 404 @{ ok = $false; error = 'not-found' }; return
        }
        if ($req['method'] -eq 'POST') {
            if (('' + $req['headers']['x-kit-token']) -ne $Token) { Send-Json $s 403 @{ ok = $false; error = 'bad-token' }; return }
            $body = @{}; if ($req['body']) { $body = ConvertFrom-KitJson $req['body'] }
            Write-KitLog ("ACTION " + $path + ' ' + $req['body']) | Out-Null
            Send-Json $s 200 (Invoke-Action $path $body); return
        }
        Send-Json $s 400 @{ ok = $false; error = 'method' }
    } catch {
        $msg = $_.Exception.Message
        Write-KitLog ("ERROR " + $path + ': ' + $msg) 'ERROR' | Out-Null
        try { Send-Json $s 500 @{ ok = $false; error = $msg } } catch { }
    }
}

function Open-Dashboard([string]$Url) {
    if ($NoBrowser -or -not $IsWin) { return }
    $cands = @()
    foreach ($b in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
        if (-not $b) { continue }
        $cands += (Join-Path $b 'Microsoft\Edge\Application\msedge.exe')
        $cands += (Join-Path $b 'Google\Chrome\Application\chrome.exe')
    }
    foreach ($c in $cands) {
        if (Test-Path $c) {
            $prof = Join-Path ([IO.Path]::GetTempPath()) 'ServiceKit-browser'
            Start-Process -FilePath $c -ArgumentList ('--app=' + $Url), '--window-size=1400,900', ('--user-data-dir=' + (Get-QuotedArg $prof)) | Out-Null
            return
        }
    }
    Start-Process $Url | Out-Null
}

# ------------------------------------------------------------------ main loop
if ($WaitPid -gt 0) { try { Wait-Process -Id $WaitPid -Timeout 15 -ErrorAction SilentlyContinue } catch { }; Start-Sleep -Milliseconds 300 }
$script:QuitAt = $null
$listener = $null
for ($try = 0; $try -lt 15; $try++) {
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start(); break
    } catch { $listener = $null; $Port++ }
}
if (-not $listener) { Write-Host 'No free port for the dashboard.' -ForegroundColor Red; exit 1 }

$url = "http://127.0.0.1:$Port/"
Write-KitJson (Join-Path $StateDir 'server.json') @{ port = $Port; pid = $PID; started = (Get-Date).ToString('s') }
Write-Host ''
Write-Host "  ServiceKit dashboard: $url" -ForegroundColor Cyan
Write-Host '  Ezt az ablakot hagyd nyitva. Bezárva leáll az Irányítópult.' -ForegroundColor DarkGray
Write-Host '  Keep this window open. Closing it stops the dashboard.' -ForegroundColor DarkGray
Write-KitLog "Dashboard started on $url" | Out-Null
Update-ExeMap
Open-Dashboard $url

$script:Quit = $false
try {
    while (-not $script:Quit) {
        if ($script:QuitAt -and (Get-Date) -gt $script:QuitAt) { break }
        if (-not $listener.Pending()) { Start-Sleep -Milliseconds 25; continue }
        $client = $listener.AcceptTcpClient()
        try { Handle-Request $client } catch { } finally { $client.Close() }
    }
} finally {
    $listener.Stop()
    Remove-Item (Join-Path $StateDir 'server.json') -ErrorAction SilentlyContinue
}
