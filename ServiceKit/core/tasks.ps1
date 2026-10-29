<#
  ServiceKit background tasks, started by the Dashboard server in a hidden window:
    -Action snapshot -Job <id> -Phase before|after   system snapshot for the before/after comparison
    -Action report   -Job <id>                       client report (HTML + PDF when Edge/Chrome exists)
    -Action close    -Job <id>                       "after" snapshot, then the final report
    -Action verify                                   integrity check of the kit programs
  Progress goes to state\task.json (or state\integrity.json for verify).
  PowerShell 2.0+ compatible.
#>
param(
    [string]$Action = '',
    [string]$Job = '',
    [ValidateSet('before', 'after')][string]$Phase = 'before',
    [string]$Lang = '',
    [string]$FakeData = ''      # test hook: JSON with inventory/before/after to render a report off-Windows
)

$CoreDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $CoreDir 'kit.ps1')
$ErrorActionPreference = 'Continue'

$JobsDir = Join-Path $DataDir 'jobs'
$ReportsDir = Join-Path $DataDir 'reports'
foreach ($d in @($JobsDir, $ReportsDir)) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }
$TaskFile = Join-Path $StateDir 'task.json'
$OS = Get-KitOS
$IsWin = [bool]$OS['windows']
$Settings = Read-KitJson (Join-Path $StateDir 'settings.json') @{}
if (-not $Lang) { $Lang = Get-Key $Settings 'lang' 'hu' }
if ($Lang -ne 'en') { $Lang = 'hu' }
$Fake = $null
if ($FakeData -and (Test-Path $FakeData)) { $Fake = Read-KitJson $FakeData $null }
$script:Started = (Get-Date).ToString('s')

function Set-Task([string]$Ph, [string]$Msg) {
    $o = @{ action = $Action; job = $Job; phase = $Ph; msg = [string]$Msg; started = $script:Started; pid = $PID }
    if ($Ph -ne 'running') { $o['finished'] = (Get-Date).ToString('s') }
    Write-KitJson $TaskFile $o
}

# Shared collectors: W, WDate, Num, Get-Programs, Get-FolderMB, Get-BootMs, Get-Snapshot, Get-SmartInfo, Get-Inventory
. (Join-Path $CoreDir 'collect.ps1')

# ------------------------------------------------------------------ advice
function Get-Advice($Inv, $Snap) {
    $add = { param($lvl, $hu, $en) $script:adv += @{ level = $lvl; hu = $hu; en = $en } }
    $script:adv = @()
    foreach ($d in @($Inv['physical'])) {
        if ($d -and $d['health'] -and $d['health'] -ne 'Healthy') { & $add 'crit' ("Lemez állapota: " + $d['name'] + " – " + $d['health'] + ". Azonnali adatmentés és csere javasolt.") ("Disk health: " + $d['name'] + " – " + $d['health'] + ". Back up now and replace it.") }
    }
    foreach ($d in @($Inv['smart'])) {
        if ($d -and $d['health'] -and $d['health'] -notmatch '^Good') { & $add 'crit' ("SMART: " + $d['model'] + " – " + $d['health'] + ". Adatmentés és lemezcsere javasolt.") ("SMART: " + $d['model'] + " – " + $d['health'] + ". Back up and replace the disk.") }
    }
    $hasSsd = $false; $hasHdd = $false
    foreach ($d in @($Inv['physical'])) { if ($d -and $d['media'] -eq 'SSD') { $hasSsd = $true }; if ($d -and $d['media'] -eq 'HDD' -and $d['bus'] -ne 'USB') { $hasHdd = $true } }
    if ($hasHdd -and -not $hasSsd) { & $add 'warn' 'A rendszer hagyományos merevlemezen (HDD) fut. Egy SSD-re cserélés a legnagyobb gyorsulást adná.' 'The system runs on a hard disk (HDD). Swapping to an SSD would give the biggest speed-up.' }
    foreach ($v in @($Snap['volumes'])) {
        if ($v -and $v['sizeGB'] -gt 0) {
            $pct = 100 * $v['freeGB'] / $v['sizeGB']
            if ($pct -lt 10) { & $add 'warn' ("A " + $v['drive'] + " meghajtón kevés a szabad hely (" + $v['freeGB'] + " GB).") ("Drive " + $v['drive'] + " is low on space (" + $v['freeGB'] + " GB free).") }
        }
    }
    if ($Inv['ramGB']) {
        if ($Inv['ramGB'] -lt 3.5) { & $add 'warn' ("Kevés a memória (" + $Inv['ramGB'] + " GB). Legalább 8 GB javasolt.") ("Low memory (" + $Inv['ramGB'] + " GB). At least 8 GB recommended.") }
        elseif ($Inv['ramGB'] -lt 7.5) { & $add 'info' ("A memória (" + $Inv['ramGB'] + " GB) bővítése érezhetően gyorsítana.") ("Upgrading memory (" + $Inv['ramGB'] + " GB) would help noticeably.") }
    }
    $avs = @($Inv['antivirus'])
    if ($IsWin -or $Fake) {
        if ($avs.Count -eq 0) { & $add 'crit' 'Nem található működő vírusvédelem.' 'No antivirus protection was found.' }
        else {
            $on = $false; $old = $false
            foreach ($x in $avs) { if ($x['enabled']) { $on = $true; if (-not $x['upToDate']) { $old = $true } } }
            if (-not $on) { & $add 'crit' 'A vírusvédelem ki van kapcsolva.' 'Antivirus protection is turned off.' }
            elseif ($old) { & $add 'warn' 'A vírusvédelem adatbázisa elavult.' 'Antivirus signatures are out of date.' }
        }
    }
    if ($Inv['lastUpdateDays'] -gt 60) { & $add 'warn' ("A Windows " + $Inv['lastUpdateDays'] + " napja nem kapott frissítést.") ("Windows has not been updated for " + $Inv['lastUpdateDays'] + " days.") }
    if ("" + $Inv['os'] -match 'Windows (7|8)') { & $add 'warn' 'Ez a Windows verzió már nem kap biztonsági frissítést. Windows 10/11 vagy új gép javasolt.' 'This Windows version no longer receives security updates. Windows 10/11 or a new PC is recommended.' }
    $bat = $Inv['battery']
    if ($bat -and $bat['wearPct'] -ge 30) { & $add 'warn' ("Az akkumulátor kapacitása " + $bat['wearPct'] + "%-kal csökkent. Cserét érdemes tervezni.") ("Battery capacity is down by " + $bat['wearPct'] + "%. Plan a replacement.") }
    if ($Inv['minidumps'] -gt 0 -or $Inv['bugcheck30'] -gt 0) { & $add 'warn' ("A gép kék halállal leállt (" + [Math]::Max([int]$Inv['minidumps'], [int]$Inv['bugcheck30']) + " esemény). Részletek: BlueScreenView.") ("The PC had blue-screen crashes (" + [Math]::Max([int]$Inv['minidumps'], [int]$Inv['bugcheck30']) + " events). Details: BlueScreenView.") }
    if ($Inv['kernelPower30'] -gt 0) { & $add 'warn' ("Váratlan leállás az elmúlt 30 napban: " + $Inv['kernelPower30'] + " alkalom (táp, hőmérséklet vagy áramszünet).") ("Unexpected shutdowns in the last 30 days: " + $Inv['kernelPower30'] + " (power supply, heat or power cuts).") }
    if ($Snap['pendingReboot']) { & $add 'info' 'Függő frissítés miatt újraindítás szükséges.' 'A restart is pending for updates.' }
    if ($Snap['uptimeMin'] -gt 20160) { & $add 'info' 'A gép több mint két hete nem volt újraindítva.' 'The PC has not been restarted for over two weeks.' }
    return ,$script:adv
}

# ------------------------------------------------------------------ report rendering
$L = @{
  hu = @{ title = 'Szerviz jelentés'; interim = 'Közbenső jelentés'; client = 'Ügyfél'; job = 'Munka azonosító'; computer = 'Számítógép'; date = 'Dátum';
          duration = 'Időtartam'; tech = 'Szerviz'; task = 'Feladat'; summary = 'Összefoglaló'; advice = 'Javaslatok'; noAdvice = 'Nincs sürgős teendő.';
          work = 'Elvégzett munka'; notes = 'Jegyzetek'; tools = 'Használt eszközök'; compare = 'Előtte / utána'; metric = 'Mérőszám'; before = 'Előtte'; after = 'Utána';
          change = 'Változás'; startup = 'Indítási elemek'; programs = 'Telepített programok'; freeC = 'Szabad hely'; temp = 'Ideiglenes fájlok'; procs = 'Futó folyamatok';
          memUsed = 'Foglalt memória'; boot = 'Rendszerindítás'; removedProgs = 'Eltávolított programok'; addedProgs = 'Új programok'; removedStartup = 'Kikapcsolt indítási elemek';
          system = 'A gép adatai'; maker = 'Gyártó és modell'; serial = 'Sorozatszám'; os = 'Operációs rendszer'; osInstalled = 'Telepítve'; cpu = 'Processzor'; ram = 'Memória';
          slots = 'foglalat'; gpu = 'Videokártya'; board = 'Alaplap'; bios = 'BIOS'; disks = 'Lemezek'; health = 'Állapot'; volumes = 'Kötetek'; network = 'Hálózat';
          av = 'Vírusvédelem'; updates = 'Utolsó Windows frissítés'; daysAgo = 'napja'; battery = 'Akkumulátor'; wear = 'kopás'; cycles = 'ciklus'; crashes = 'Összeomlások (30 nap)';
          key = 'OEM termékkulcs'; appendix = 'Melléklet: telepített programok'; signature = 'Aláírás'; generated = 'Készült a ServiceKit segítségével'; on = 'be'; off = 'ki'; outdated = 'elavult';
          minutes = 'perc'; hours = 'óra'; cModel = 'Típus'; cIface = 'Csatoló'; cSize = 'Méret'; cHours = 'Üzemóra'; cMedia = 'Fajta'; cBus = 'Busz'; none = 'nincs'; crit = 'Sürgős'; warn = 'Figyelem'; info = 'Tipp'; launched = 'indítva'; mode_admin = 'rendszergazdaként'; mode_sbie = 'dobozban'; mode_wsb = 'Windows Sandboxban' }
  en = @{ title = 'Service report'; interim = 'Interim report'; client = 'Client'; job = 'Job ID'; computer = 'Computer'; date = 'Date';
          duration = 'Duration'; tech = 'Technician'; task = 'Task'; summary = 'Summary'; advice = 'Recommendations'; noAdvice = 'Nothing urgent.';
          work = 'Work done'; notes = 'Notes'; tools = 'Tools used'; compare = 'Before / after'; metric = 'Metric'; before = 'Before'; after = 'After';
          change = 'Change'; startup = 'Startup items'; programs = 'Installed programs'; freeC = 'Free space'; temp = 'Temporary files'; procs = 'Running processes';
          memUsed = 'Memory in use'; boot = 'Boot time'; removedProgs = 'Removed programs'; addedProgs = 'New programs'; removedStartup = 'Disabled startup items';
          system = 'Computer details'; maker = 'Make and model'; serial = 'Serial number'; os = 'Operating system'; osInstalled = 'Installed'; cpu = 'Processor'; ram = 'Memory';
          slots = 'slots'; gpu = 'Graphics'; board = 'Motherboard'; bios = 'BIOS'; disks = 'Disks'; health = 'Health'; volumes = 'Volumes'; network = 'Network';
          av = 'Antivirus'; updates = 'Last Windows update'; daysAgo = 'days ago'; battery = 'Battery'; wear = 'wear'; cycles = 'cycles'; crashes = 'Crashes (30 days)';
          key = 'OEM product key'; appendix = 'Appendix: installed programs'; signature = 'Signature'; generated = 'Generated with ServiceKit'; on = 'on'; off = 'off'; outdated = 'outdated';
          minutes = 'min'; hours = 'h'; cModel = 'Model'; cIface = 'Interface'; cSize = 'Size'; cHours = 'Power-on hours'; cMedia = 'Type'; cBus = 'Bus'; none = 'none'; crit = 'Urgent'; warn = 'Attention'; info = 'Tip'; launched = 'launched'; mode_admin = 'as admin'; mode_sbie = 'in a box'; mode_wsb = 'in Windows Sandbox' }
}
function T([string]$k) { return $L[$Lang][$k] }
function HE($s) { return ConvertTo-HtmlText $s }
function FmtDate([string]$iso, [switch]$Time) {
    if (-not $iso) { return '' }
    try { $d = [datetime]$iso; if ($Time) { return $d.ToString('yyyy.MM.dd. HH:mm') } else { return $d.ToString('yyyy.MM.dd.') } } catch { return $iso }
}
function Row([string]$k, $v) { if ($null -eq $v -or "$v" -eq '') { return '' }; return '<tr><th>' + (HE $k) + '</th><td>' + $v + '</td></tr>' }

function Get-Delta($b, $a, [bool]$HigherBetter, [string]$Unit) {
    if ($null -eq $b -or $null -eq $a) { return '' }
    $d = [double]$a - [double]$b
    if ([Math]::Abs($d) -lt 0.05) { return '<span class="d0">±0</span>' }
    $good = ($d -gt 0) -eq $HigherBetter
    $sign = ''; if ($d -gt 0) { $sign = '+' }
    $txt = $sign + ([Math]::Round($d, 1)).ToString([Globalization.CultureInfo]::InvariantCulture) + $Unit
    if ($good) { return '<span class="dg">' + $txt + '</span>' } else { return '<span class="db">' + $txt + '</span>' }
}

function Find-VolC($snap) {
    foreach ($v in @($snap['volumes'])) { if ($v -and $v['drive'] -eq 'C:') { return $v } }
    $vs = @($snap['volumes']); if ($vs.Count) { return $vs[0] }; return $null
}

function Build-Report($JobData, $Before, $After, $Inv, [bool]$Final) {
    $tech = Read-KitJson (Join-Path $DataDir 'technician.json') @{}
    $client = Get-Key $JobData 'client' @{}
    $snapNow = $After; if (-not $snapNow) { $snapNow = $Before }
    $advice = Get-Advice $Inv $snapNow
    $started = Get-Key $JobData 'started' ''; $ended = Get-Key $JobData 'ended' ''
    if (-not $ended) { $ended = (Get-Date).ToString('s') }
    $durMin = 0; try { $durMin = [int](([datetime]$ended) - ([datetime]$started)).TotalMinutes } catch { }
    $durTxt = '' + $durMin + ' ' + (T 'minutes'); if ($durMin -ge 60) { $durTxt = '' + [int][Math]::Floor($durMin / 60) + ' ' + (T 'hours') + ' ' + ($durMin % 60) + ' ' + (T 'minutes') }
    $title = T 'title'; if (-not $Final) { $title = T 'interim' }

    $sb = New-Object System.Text.StringBuilder
    $w = { param($x) [void]$sb.Append($x) }
    & $w '<!DOCTYPE html><html lang="'; & $w $Lang; & $w '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'
    & $w (HE ($title + ' – ' + (Get-Key $client 'name' '') + ' – ' + $JobData['id'])); & $w '</title><style>'
    & $w @'
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1f2328; font-size: 10.5pt; line-height: 1.45; margin: 0; background: #f4f2ee; }
.page { max-width: 820px; margin: 0 auto; background: #fff; padding: 32px 38px 40px; }
header { display: flex; align-items: flex-start; border-bottom: 3px solid #f2a93b; padding-bottom: 14px; margin-bottom: 18px; }
.brand { flex: 1; }
.brand .co { font-size: 9pt; color: #6b737c; }
h1 { font-size: 20pt; margin: 2px 0 0; letter-spacing: -.3px; }
.meta { text-align: right; font-size: 9pt; color: #4b535c; }
.meta b { color: #1f2328; }
h2 { font-size: 12pt; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e3dfd8; }
h3 { font-size: 10pt; margin: 14px 0 6px; color: #4b535c; text-transform: uppercase; letter-spacing: .6px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; vertical-align: top; padding: 4px 8px 4px 0; border-bottom: 1px solid #f0ece6; }
th { width: 34%; color: #4b535c; font-weight: 600; }
table.grid th { width: auto; background: #f7f5f1; padding: 5px 8px; border-bottom: 1px solid #e3dfd8; }
table.grid td { padding: 5px 8px; }
.cards { display: flex; flex-wrap: wrap; margin: 0 -5px; }
.card { flex: 1 1 30%; margin: 0 5px 10px; border: 1px solid #e3dfd8; border-radius: 8px; padding: 10px 12px; }
.card small { display: block; color: #6b737c; font-size: 8.5pt; }
.card b { font-size: 11pt; }
.adv { border-left: 4px solid #9aa4ae; padding: 6px 10px; margin-bottom: 6px; background: #f7f5f1; border-radius: 0 6px 6px 0; }
.adv.crit { border-color: #c43c3c; background: #fbecec; }
.adv.warn { border-color: #e09a2c; background: #fff5e3; }
.adv.info { border-color: #3b82c4; background: #edf4fb; }
.adv b { margin-right: 6px; }
.dg { color: #157347; font-weight: 600; } .db { color: #b02a2a; font-weight: 600; } .d0 { color: #6b737c; }
.ok { color: #157347; font-weight: 600; } .bad { color: #b02a2a; font-weight: 600; } .mid { color: #9a6200; font-weight: 600; }
ul.tl { list-style: none; padding: 0; margin: 0; }
ul.tl li { padding: 4px 0 4px 64px; position: relative; border-bottom: 1px dashed #eee9e1; }
ul.tl li span.t { position: absolute; left: 0; color: #6b737c; font-variant-numeric: tabular-nums; }
.muted { color: #6b737c; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; background: #9aa4ae; vertical-align: 1px; }
.dot.ok { background: #1f9d68; } .dot.info { background: #3b82c4; } .dot.warn { background: #e09a2c; } .dot.fail { background: #c43c3c; } .dot.skipped { background: #c9c3b8; }
.small { font-size: 8.5pt; }
.cols { column-count: 2; column-gap: 24px; font-size: 8.5pt; }
.cols div { break-inside: avoid; padding: 1px 0; }
.sign { display: flex; margin-top: 40px; }
.sign div { flex: 1; border-top: 1px solid #9aa4ae; margin-right: 30px; padding-top: 4px; font-size: 9pt; color: #6b737c; }
footer { margin-top: 26px; font-size: 8pt; color: #9aa4ae; text-align: center; }
.mono { font-family: Consolas, "Cascadia Mono", monospace; font-size: 9pt; }
@media print { body { background: #fff; } .page { padding: 0; max-width: none; } h2 { break-after: avoid; } tr, .adv, .card { break-inside: avoid; } }
'@
    & $w '</style></head><body><div class="page">'

    # header
    $techLine = (@((Get-Key $tech 'company' ''), (Get-Key $tech 'name' ''), (Get-Key $tech 'phone' ''), (Get-Key $tech 'email' '')) | Where-Object { $_ }) -join ' · '
    & $w '<header><div class="brand"><div class="co">'; & $w (HE $techLine); & $w '</div><h1>'; & $w (HE $title); & $w '</h1></div><div class="meta">'
    & $w ('<div>' + (HE (T 'job')) + ': <b class="mono">' + (HE $JobData['id']) + '</b></div>')
    & $w ('<div>' + (HE (T 'date')) + ': <b>' + (HE (FmtDate $started)) + '</b></div>')
    & $w ('<div>' + (HE (T 'duration')) + ': <b>' + (HE $durTxt) + '</b></div></div></header>')

    # client & task
    & $w '<div class="cards">'
    $cl = '<b>' + (HE (Get-Key $client 'name' '')) + '</b>'
    foreach ($k in @('address', 'phone', 'email')) { $v = Get-Key $client $k ''; if ($v) { $cl += '<br><span class="small">' + (HE $v) + '</span>' } }
    & $w ('<div class="card"><small>' + (HE (T 'client')) + '</small>' + $cl + '</div>')
    $pc = '<b>' + (HE (Get-Key $JobData 'computer' $Inv['computer'])) + '</b><br><span class="small">' + (HE (($Inv['manufacturer'] + ' ' + $Inv['model']).Trim())) + '</span>'
    if ($Inv['serial']) { $pc += '<br><span class="small mono">S/N ' + (HE $Inv['serial']) + '</span>' }
    & $w ('<div class="card"><small>' + (HE (T 'computer')) + '</small>' + $pc + '</div>')
    $task = Get-Key $JobData 'task' ''
    if ($task) { & $w ('<div class="card" style="flex-basis:100%"><small>' + (HE (T 'task')) + '</small>' + (HE $task).Replace("`n", '<br>') + '</div>') }
    & $w '</div>'

    # advice
    & $w ('<h2>' + (HE (T 'advice')) + '</h2>')
    if (@($advice).Count -eq 0) { & $w ('<div class="adv info">' + (HE (T 'noAdvice')) + '</div>') }
    foreach ($a in @($advice | Sort-Object { @{ crit = 0; warn = 1; info = 2 }[$_['level']] })) {
        & $w ('<div class="adv ' + $a['level'] + '"><b>' + (HE (T $a['level'])) + '</b>' + (HE $a[$Lang]) + '</div>')
    }

    # work log
    $notes = @(Get-Key $JobData 'notes' @()); $acts = @(Get-Key $JobData 'actions' @())
    if ($notes.Count -or $acts.Count) {
        & $w ('<h2>' + (HE (T 'work')) + '</h2>')
        $items = @()
        foreach ($n in $notes) { $items += @{ t = $n['t']; html = (HE $n['text']) } }
        foreach ($x in $acts) {
            if ((Get-Key $x 'type' '') -eq 'step') {
                $nm = Get-Key $x 'name' ''; $sm = Get-Key $x 'summary' ''
                if ($Lang -eq 'en') { $nm = Get-Key $x 'nameEn' $nm; $sm = Get-Key $x 'summaryEn' $sm }
                $stc = [string](Get-Key $x 'status' 'ok'); if ($stc -eq 'done') { $stc = 'ok' }
                $items += @{ t = $x['t']; html = '<span class="dot ' + (HE $stc) + '"></span><b>' + (HE $nm) + '</b><br><span class="small">' + (HE $sm) + '</span>' }
                continue
            }
            $name = Get-Key $x 'name' (Get-Key $x 'app' '')
            $mode = Get-Key $x 'mode' ''
            $suffix = ''; if ($mode -and $mode -ne 'normal') { $suffix = ' (' + (T ('mode_' + $mode)) + ')' }
            $items += @{ t = $x['t']; html = '<span class="muted">' + (HE $name) + ' ' + (HE (T 'launched')) + (HE $suffix) + '</span>' }
        }
        & $w '<ul class="tl">'
        foreach ($i in @($items | Sort-Object { $_['t'] })) {
            $tt = ''; try { $tt = ([datetime]$i['t']).ToString('HH:mm') } catch { }
            & $w ('<li><span class="t">' + $tt + '</span>' + $i['html'] + '</li>')
        }
        & $w '</ul>'
    }

    # before / after
    if ($Before -and $After) {
        & $w ('<h2>' + (HE (T 'compare')) + '</h2><table class="grid"><tr><th>' + (HE (T 'metric')) + '</th><th>' + (HE (T 'before')) + '</th><th>' + (HE (T 'after')) + '</th><th>' + (HE (T 'change')) + '</th></tr>')
        $vb = Find-VolC $Before; $va = Find-VolC $After
        $rows = @(
            @((T 'startup'), @($Before['startup']).Count, @($After['startup']).Count, $false, ''),
            @((T 'programs'), @($Before['programs']).Count, @($After['programs']).Count, $false, '')
        )
        if ($vb -and $va) { $rows += ,@(((T 'freeC') + ' ' + $vb['drive']), $vb['freeGB'], $va['freeGB'], $true, ' GB') }
        $rows += ,@((T 'temp'), $Before['tempMB'], $After['tempMB'], $false, ' MB')
        $rows += ,@((T 'procs'), $Before['processes'], $After['processes'], $false, '')
        $rows += ,@((T 'memUsed'), $Before['memUsedMB'], $After['memUsedMB'], $false, ' MB')
        if ($Before['bootMs'] -and $After['bootMs'] -and $Before['bootMs'] -ne $After['bootMs']) { $rows += ,@(((T 'boot') + ' (s)'), (Num ($Before['bootMs'] / 1000)), (Num ($After['bootMs'] / 1000)), $false, ' s') }
        foreach ($r in $rows) {
            if ($null -eq $r[1] -and $null -eq $r[2]) { continue }
            $u = $r[4]
            & $w ('<tr><td>' + (HE $r[0]) + '</td><td>' + (HE ('' + $r[1] + $u)) + '</td><td>' + (HE ('' + $r[2] + $u)) + '</td><td>' + (Get-Delta $r[1] $r[2] $r[3] $u) + '</td></tr>')
        }
        & $w '</table>'
        $bn = @{}; foreach ($p in @($Before['programs'])) { if ($p) { $bn[$p['name']] = $true } }
        $an = @{}; foreach ($p in @($After['programs'])) { if ($p) { $an[$p['name']] = $true } }
        $removed = @(); foreach ($k in @($bn.Keys)) { if (-not $an.ContainsKey($k)) { $removed += $k } }
        $added = @(); foreach ($k in @($an.Keys)) { if (-not $bn.ContainsKey($k)) { $added += $k } }
        $bs = @{}; foreach ($s in @($After['startup'])) { if ($s) { $bs[$s['name'] + '|' + $s['location']] = $true } }
        $offStart = @(); foreach ($s in @($Before['startup'])) { if ($s -and -not $bs.ContainsKey($s['name'] + '|' + $s['location'])) { $offStart += $s['name'] } }
        foreach ($grp in @(@((T 'removedProgs'), $removed), @((T 'removedStartup'), $offStart), @((T 'addedProgs'), $added))) {
            $arr = @($grp[1])
            if ($arr.Count) { & $w ('<h3>' + (HE $grp[0]) + ' (' + $arr.Count + ')</h3><div class="cols">'); foreach ($x in @($arr | Sort-Object)) { & $w ('<div>' + (HE $x) + '</div>') }; & $w '</div>' }
        }
    }

    # system details
    & $w ('<h2>' + (HE (T 'system')) + '</h2><table>')
    & $w (Row (T 'maker') (HE (($Inv['manufacturer'] + ' ' + $Inv['model']).Trim())))
    & $w (Row (T 'serial') ('<span class="mono">' + (HE $Inv['serial']) + '</span>'))
    $osTxt = ($Inv['os'] + ' ' + $Inv['osRelease'] + ' (' + $Inv['osVersion'] + ', ' + $Inv['osArch'] + ')').Trim()
    if ($Inv['os']) { & $w (Row (T 'os') ((HE $osTxt) + '<br><span class="small muted">' + (HE (T 'osInstalled')) + ': ' + (HE (FmtDate $Inv['osInstalled'])) + '</span>')) }
    $cpuTxt = @(); foreach ($c in @($Inv['cpu'])) { if ($c) { $cpuTxt += ((HE $c['name']) + ' <span class="muted small">(' + $c['cores'] + 'C/' + $c['threads'] + 'T)</span>') } }
    & $w (Row (T 'cpu') ($cpuTxt -join '<br>'))
    if ($Inv['ramGB']) {
        $rt = '<b>' + $Inv['ramGB'] + ' GB</b>'
        $mods = @($Inv['ram'])
        if ($mods.Count) {
            $rt += ' <span class="small muted">(' + $mods.Count + ' / ' + $Inv['ramSlots'] + ' ' + (T 'slots')
            if ($Inv['ramMaxGB']) { $rt += ', max ' + $Inv['ramMaxGB'] + ' GB' }
            $rt += ')</span>'
            foreach ($m in $mods) { if ($m) { $rt += '<br><span class="small">' + (HE ($m['slot'] + ': ' + $m['gb'] + ' GB ' + $m['type'] + ' ' + $m['mhz'] + ' MHz ' + $m['maker'] + ' ' + $m['part'])) + '</span>' } }
        }
        & $w (Row (T 'ram') $rt)
    }
    $g = @(); foreach ($x in @($Inv['gpu'])) { if ($x) { $g += ((HE $x['name']) + ' <span class="small muted">' + (HE $x['driver']) + '</span>') } }
    & $w (Row (T 'gpu') ($g -join '<br>'))
    & $w (Row (T 'board') (HE $Inv['board']))
    & $w (Row (T 'bios') (HE $Inv['bios']))
    & $w '</table>'

    $pd = @($Inv['physical']); $sm = @($Inv['smart']); $dk = @($Inv['disks'])
    if ($pd.Count -or $sm.Count -or $dk.Count) {
        & $w ('<h3>' + (HE (T 'disks')) + '</h3><table class="grid">')
        if ($sm.Count) {
            & $w ('<tr><th>' + (HE (T 'cModel')) + '</th><th>' + (HE (T 'cIface')) + '</th><th>' + (HE (T 'cSize')) + '</th><th>' + (HE (T 'health')) + '</th><th>°C</th><th>' + (HE (T 'cHours')) + '</th></tr>')
            foreach ($d in $sm) { $cls = 'ok'; if ($d['health'] -notmatch '^Good') { $cls = 'bad' }
                & $w ('<tr><td>' + (HE $d['model']) + '</td><td>' + (HE $d['interface']) + '</td><td>' + (HE $d['size']) + '</td><td class="' + $cls + '">' + (HE $d['health']) + '</td><td>' + (HE $d['temp']) + '</td><td>' + (HE $d['hours']) + '</td></tr>') }
        } elseif ($pd.Count) {
            & $w ('<tr><th>' + (HE (T 'cModel')) + '</th><th>' + (HE (T 'cMedia')) + '</th><th>' + (HE (T 'cBus')) + '</th><th>' + (HE (T 'cSize')) + '</th><th>' + (HE (T 'health')) + '</th></tr>')
            foreach ($d in $pd) { $cls = 'ok'; if ($d['health'] -ne 'Healthy') { $cls = 'bad' }
                & $w ('<tr><td>' + (HE $d['name']) + '</td><td>' + (HE $d['media']) + '</td><td>' + (HE $d['bus']) + '</td><td>' + $d['sizeGB'] + ' GB</td><td class="' + $cls + '">' + (HE $d['health']) + '</td></tr>') }
        } else {
            & $w ('<tr><th>' + (HE (T 'cModel')) + '</th><th>' + (HE (T 'cIface')) + '</th><th>' + (HE (T 'cSize')) + '</th><th>' + (HE (T 'health')) + '</th></tr>')
            foreach ($d in $dk) { & $w ('<tr><td>' + (HE $d['model']) + '</td><td>' + (HE $d['iface']) + '</td><td>' + $d['sizeGB'] + ' GB</td><td>' + (HE $d['status']) + '</td></tr>') }
        }
        & $w '</table>'
    }
    $vols = @($snapNow['volumes'])
    if ($vols.Count) {
        & $w ('<h3>' + (HE (T 'volumes')) + '</h3><table class="grid"><tr><th></th><th>' + (HE (T 'freeC')) + '</th><th>%</th></tr>')
        foreach ($v in $vols) { if (-not $v) { continue }; $pct = 0; if ($v['sizeGB'] -gt 0) { $pct = [int](100 * $v['freeGB'] / $v['sizeGB']) }
            $cls = 'ok'; if ($pct -lt 10) { $cls = 'bad' } elseif ($pct -lt 20) { $cls = 'mid' }
            & $w ('<tr><td>' + (HE ($v['drive'] + ' ' + $v['label'])) + '</td><td>' + $v['freeGB'] + ' / ' + $v['sizeGB'] + ' GB</td><td class="' + $cls + '">' + $pct + '%</td></tr>') }
        & $w '</table>'
    }

    & $w '<h3>&nbsp;</h3><table>'
    $avs = @($Inv['antivirus']); $avTxt = @()
    foreach ($a in $avs) { if (-not $a) { continue }; $st = '<span class="ok">' + (HE (T 'on')) + '</span>'; if (-not $a['enabled']) { $st = '<span class="bad">' + (HE (T 'off')) + '</span>' } elseif (-not $a['upToDate']) { $st = '<span class="mid">' + (HE (T 'outdated')) + '</span>' }
        $avTxt += ((HE $a['name']) + ' – ' + $st) }
    if ($avTxt.Count) { & $w (Row (T 'av') ($avTxt -join '<br>')) }
    if ($Inv['lastUpdate']) { $cls = 'ok'; if ($Inv['lastUpdateDays'] -gt 60) { $cls = 'bad' } elseif ($Inv['lastUpdateDays'] -gt 35) { $cls = 'mid' }
        & $w (Row (T 'updates') ((HE (FmtDate $Inv['lastUpdate'])) + ' <span class="' + $cls + '">(' + $Inv['lastUpdateDays'] + ' ' + (HE (T 'daysAgo')) + ')</span>')) }
    $b = $Inv['battery']
    if ($b) { $bt = '' + $b['charge'] + '%'; if ($null -ne $b['wearPct']) { $cls = 'ok'; if ($b['wearPct'] -ge 30) { $cls = 'bad' } elseif ($b['wearPct'] -ge 15) { $cls = 'mid' }
        $bt += ' · <span class="' + $cls + '">' + $b['wearPct'] + '% ' + (HE (T 'wear')) + '</span> (' + $b['fullWh'] + ' / ' + $b['designWh'] + ' Wh)' }
        if ($b['cycles']) { $bt += ' · ' + $b['cycles'] + ' ' + (HE (T 'cycles')) }
        & $w (Row (T 'battery') $bt) }
    if ($IsWin -or $Fake) { $cr = [Math]::Max([int]$Inv['minidumps'], [int]$Inv['bugcheck30']); $cls = 'ok'; if ($cr -gt 0 -or $Inv['kernelPower30'] -gt 0) { $cls = 'bad' }
        & $w (Row (T 'crashes') ('<span class="' + $cls + '">BSOD: ' + $cr + ' · Kernel-Power 41: ' + [int]$Inv['kernelPower30'] + '</span>')) }
    $nets = @(); foreach ($n in @($Inv['network'])) { if ($n) { $nets += ((HE $n['name']) + '<br><span class="small mono">' + (HE $n['ip']) + ' · ' + (HE $n['mac']) + '</span>') } }
    if ($nets.Count) { & $w (Row (T 'network') ($nets -join '<br>')) }
    if ($Inv['oemKey']) { & $w (Row (T 'key') ('<span class="mono">' + (HE $Inv['oemKey']) + '</span>')) }
    & $w '</table>'

    $progs = @($snapNow['programs'])
    if ($progs.Count) {
        & $w ('<h2>' + (HE (T 'appendix')) + ' (' + $progs.Count + ')</h2><div class="cols">')
        foreach ($p in $progs) { if ($p) { & $w ('<div>' + (HE $p['name']) + ' <span class="muted">' + (HE $p['version']) + '</span></div>') } }
        & $w '</div>'
    }
    & $w ('<div class="sign"><div>' + (HE (T 'tech')) + '</div><div>' + (HE (T 'client')) + '</div></div>')
    & $w ('<footer>' + (HE (T 'generated')) + ' · ' + (HE ((Get-Date).ToString('yyyy.MM.dd. HH:mm'))) + '</footer></div></body></html>')
    return $sb.ToString()
}

function Find-Browser {
    $c = @()
    foreach ($b in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
        if (-not $b) { continue }
        $c += (Join-Path $b 'Microsoft\Edge\Application\msedge.exe'); $c += (Join-Path $b 'Google\Chrome\Application\chrome.exe')
    }
    foreach ($x in $c) { if (Test-Path $x) { return $x } }
    return $null
}

function Save-Pdf([string]$Html, [string]$Pdf) {
    $br = Find-Browser
    if (-not $br) { return $false }
    try {
        if (Test-Path $Pdf) { Remove-Item $Pdf -Force }
        $prof = Join-Path ([IO.Path]::GetTempPath()) 'ServiceKit-pdf'
        $uri = (New-Object System.Uri($Html)).AbsoluteUri
        $argList = @('--headless', '--disable-gpu', '--no-first-run', '--no-pdf-header-footer', '--print-to-pdf-no-header',
                  ('--user-data-dir="' + $prof + '"'), ('--print-to-pdf="' + $Pdf + '"'), $uri)
        $p = Start-Process -FilePath $br -ArgumentList $argList -PassThru -WindowStyle Hidden
        [void]$p.WaitForExit(60000)
        return (Test-Path $Pdf)
    } catch { return $false }
}

function Get-JobData([string]$Id) {
    $f = Join-Path $JobsDir ($Id + '.json')
    if (-not (Test-Path $f)) { throw "Job not found: $Id" }
    return Read-KitJson $f $null
}

function Invoke-Report([string]$Id, [bool]$Final) {
    $jd = Get-JobData $Id
    if ($Fake) { $inv = $Fake['inventory']; $before = $Fake['before']; $after = $Fake['after'] }
    else {
        Set-Task 'running' 'inventory'
        $inv = Get-Inventory ([bool](Get-Key $jd 'includeKeys' $false)) ([bool](Get-Key $jd 'smart' $true))
        $before = Read-KitJson (Join-Path $JobsDir ($Id + '.before.json')) $null
        $after = Read-KitJson (Join-Path $JobsDir ($Id + '.after.json')) $null
        if (-not $before -and -not $after) { $before = Get-Snapshot }
    }
    if ($Final) { $jd['ended'] = (Get-Date).ToString('s') }
    Set-Task 'running' 'render'
    $dir = Join-Path $ReportsDir $Id
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $html = Build-Report $jd $before $after $inv $Final
    $hf = Join-Path $dir 'report.html'
    Write-KitText $hf $html
    Write-KitJson (Join-Path $dir 'inventory.json') $inv
    $pf = Join-Path $dir 'report.pdf'
    $pdfOk = $false
    if ($IsWin) { Set-Task 'running' 'pdf'; $pdfOk = Save-Pdf $hf $pf }
    $res = @{ html = 'data/reports/' + $Id + '/report.html'; time = (Get-Date).ToString('s'); final = $Final }
    if ($pdfOk) { $res['pdf'] = 'data/reports/' + $Id + '/report.pdf' }
    Write-KitJson (Join-Path $dir 'result.json') $res
}

# ------------------------------------------------------------------ integrity
function Invoke-Verify {
    $file = Join-Path $StateDir 'integrity.json'
    # First baseline programs that were installed before hashing existed (trust on first use).
    $pre = Read-KitJson (Join-Path $StateDir 'hashes.json') @{}
    $inst = Get-Installed
    foreach ($pk in @($inst.Keys)) {
        $missingApp = $false
        foreach ($p in @((Get-Catalog)['packages'])) { if ($p['id'] -eq $pk) { foreach ($a in @($p['apps'])) { if (-not $pre.ContainsKey($a['id'])) { $missingApp = $true } } } }
        if ($missingApp) { try { Update-KitHashes $pk } catch { } }
    }
    $hashes = Read-KitJson (Join-Path $StateDir 'hashes.json') @{}
    $keys = @($hashes.Keys)
    $out = @{ running = $true; started = (Get-Date).ToString('s'); done = 0; total = $keys.Count; results = @() }
    Write-KitJson $file $out
    $res = @()
    foreach ($k in $keys) {
        $e = $hashes[$k]
        $full = Join-Path $ToolsDir $e['path']
        $r = @{ app = [string]$k; pkg = [string](Get-Key $e 'pkg' ''); path = [string]$e['path']; signer = [string](Get-Key $e 'signer' ''); sigStatus = [string](Get-Key $e 'sigStatus' '') }
        if (-not (Test-Path -LiteralPath $full)) { $r['status'] = 'missing' }
        else {
            try {
                $h = Get-KitHash $full
                if ($h -eq $e['sha256']) { $r['status'] = 'ok' } else { $r['status'] = 'changed'; $sg = Get-KitSigner $full; $r['signer'] = $sg['signer']; $r['sigStatus'] = $sg['status'] }
            } catch { $r['status'] = 'error' }
        }
        $res += $r
        $out['done'] = $out['done'] + 1; $out['results'] = $res
        Write-KitJson $file $out
    }
    $out['running'] = $false; $out['finished'] = (Get-Date).ToString('s')
    Write-KitJson $file $out
}

# ------------------------------------------------------------------ main
try {
    switch ($Action) {
        'snapshot' {
            Set-Task 'running' $Phase
            $s = $null
            if ($Fake) { $s = $Fake[$Phase] } else { $s = Get-Snapshot }
            Write-KitJson (Join-Path $JobsDir ($Job + '.' + $Phase + '.json')) $s
            Set-Task 'done' $Phase
        }
        'report' { Set-Task 'running' 'report'; Invoke-Report $Job $false; Set-Task 'done' 'report' }
        'close' {
            Set-Task 'running' 'after'
            $s = $null
            if ($Fake) { $s = $Fake['after'] } else { $s = Get-Snapshot }
            Write-KitJson (Join-Path $JobsDir ($Job + '.after.json')) $s
            Invoke-Report $Job $true
            Set-Task 'done' 'close'
        }
        'verify' { Set-Task 'running' 'verify'; Invoke-Verify; Set-Task 'done' 'verify' }
        default { throw "Unknown action $Action" }
    }
} catch {
    Write-KitLog ("TASK " + $Action + ' failed: ' + $_.Exception.Message) 'ERROR' | Out-Null
    Set-Task 'error' $_.Exception.Message
}
