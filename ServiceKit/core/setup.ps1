<#
  ServiceKit Telepítő / Setup
  Downloads the selected tools from their official sources into <kit>\tools\<id>.

  SETUP.cmd                          -> selection window
  setup.ps1 -Primary -NoGui          -> core tools, no window
  setup.ps1 -Ids sysinternals,putty  -> only these
  setup.ps1 -All -Update             -> everything, re-download installed ones
  setup.ps1 -Target legacy           -> build the kit for Windows 7 / 8.1 machines
#>
param(
    [string]$Ids = '',
    [switch]$All,
    [switch]$Primary,
    [switch]$NoGui,
    [switch]$Update,
    [string]$Lang = '',
    [ValidateSet('auto', 'modern', 'legacy')][string]$Target = 'auto',
    [switch]$NoLaunch
)

$CoreDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $CoreDir 'kit.ps1')
$ErrorActionPreference = 'Continue'

$Cat = Get-Catalog
$OS = Get-KitOS
$Settings = Read-KitJson (Join-Path $StateDir 'settings.json') @{}
if (-not $Lang) { $Lang = Get-Key $Settings 'lang' 'hu' }

$Txt = @{
  hu = @{ title='ServiceKit Telepítő'; pick='Válaszd ki, mit töltsön le a Telepítő. A szürke elemek nem futnak a kiválasztott Windowson.';
          core='Alap'; all='Mind'; none='Semmi'; upd='Telepítettek frissítése'; install='Letöltés és telepítés'; cancel='Mégse';
          target='Cél Windows:'; tAuto='Ez a gép'; tModern='Windows 10 / 11'; tLegacy='Windows 7 / 8.1';
          total='Kiválasztva: {0} csomag, kb. {1} MB'; installed='telepítve'; manual='kézi letöltés'; nowin7='Win7-en nem fut';
          boot='7-Zip előkészítése...'; resolving='Forrás keresése'; downloading='Letöltés'; extracting='Kicsomagolás'; done='Kész';
          failed='HIBA'; skipped='Kihagyva'; manualTitle='Kézi letöltés szükséges';
          manualHelp='Ezeket a gyártó oldaláról kell letölteni (tükörválasztó vagy kattintás kell). Tedd a letöltött fájlt ide: {0} és futtasd újra a Telepítőt.';
          openPages='Megnyissam a letöltőoldalakat? (i/n)'; summary='Összesen: {0} kész, {1} hiba, {2} kézi.'; startDash='Elindítom az Irányítópultot.';
          noSel='Nincs kiválasztott csomag.'; tls='Figyelem: ezen a gépen a TLS 1.2 nem érhető el. Windows 7-en telepítsd a .NET 4.8-at, vagy futtasd a Telepítőt egy újabb gépen.' }
  en = @{ title='ServiceKit Setup'; pick='Choose what Setup should download. Greyed items do not run on the selected Windows.';
          core='Core'; all='All'; none='None'; upd='Update installed'; install='Download and install'; cancel='Cancel';
          target='Target Windows:'; tAuto='This PC'; tModern='Windows 10 / 11'; tLegacy='Windows 7 / 8.1';
          total='Selected: {0} packages, about {1} MB'; installed='installed'; manual='manual download'; nowin7='not on Win7';
          boot='Preparing 7-Zip...'; resolving='Finding source'; downloading='Downloading'; extracting='Extracting'; done='Done';
          failed='ERROR'; skipped='Skipped'; manualTitle='Manual download needed';
          manualHelp='These must be downloaded from the vendor page (mirror picker or click required). Put the downloaded file in {0} and run Setup again.';
          openPages='Open the download pages now? (y/n)'; summary='Total: {0} done, {1} failed, {2} manual.'; startDash='Starting the Dashboard.';
          noSel='Nothing selected.'; tls='Warning: TLS 1.2 is not available on this PC. On Windows 7 install .NET 4.8, or run Setup on a newer PC.' }
}
function T([string]$k) { return $Txt[$Lang][$k] }
if ($Lang -ne 'en') { $Lang = 'hu' }

$Installed = Get-Installed
$Packages = @($Cat['packages'])
$PkgById = @{}; foreach ($p in $Packages) { $PkgById[$p['id']] = $p }

function Get-TargetLegacy([string]$t) {
    if ($t -eq 'legacy') { return $true }
    if ($t -eq 'modern') { return $false }
    return [bool]$OS['legacy']
}

function Test-Usable($p, [bool]$legacy) {
    if (-not $legacy) { return $true }
    return ((Get-Key $p 'win7' 'ok') -ne 'no')
}

# ------------------------------------------------------------------ selection GUI
function Show-Picker {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    [System.Windows.Forms.Application]::EnableVisualStyles()

    $f = New-Object System.Windows.Forms.Form
    $f.Text = T 'title'; $f.Width = 760; $f.Height = 720; $f.StartPosition = 'CenterScreen'
    $f.Font = New-Object System.Drawing.Font('Segoe UI', 9)
    $f.MinimumSize = New-Object System.Drawing.Size(600, 500)

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = T 'pick'; $lbl.Dock = 'Top'; $lbl.Height = 36; $lbl.Padding = New-Object System.Windows.Forms.Padding(8, 8, 8, 0)
    $f.Controls.Add($lbl)

    $tree = New-Object System.Windows.Forms.TreeView
    $tree.CheckBoxes = $true; $tree.Dock = 'Fill'; $tree.HideSelection = $false; $tree.FullRowSelect = $true

    $info = New-Object System.Windows.Forms.Label
    $info.Dock = 'Bottom'; $info.Height = 54; $info.Padding = New-Object System.Windows.Forms.Padding(8, 4, 8, 4)
    $info.BorderStyle = 'FixedSingle'

    $bar = New-Object System.Windows.Forms.FlowLayoutPanel
    $bar.Dock = 'Bottom'; $bar.Height = 76; $bar.Padding = New-Object System.Windows.Forms.Padding(6)

    $tlab = New-Object System.Windows.Forms.Label; $tlab.Text = T 'target'; $tlab.AutoSize = $true; $tlab.Margin = New-Object System.Windows.Forms.Padding(4, 8, 4, 0)
    $tcmb = New-Object System.Windows.Forms.ComboBox; $tcmb.DropDownStyle = 'DropDownList'; $tcmb.Width = 140
    [void]$tcmb.Items.Add((T 'tAuto')); [void]$tcmb.Items.Add((T 'tModern')); [void]$tcmb.Items.Add((T 'tLegacy'))
    $tcmb.SelectedIndex = @{ auto = 0; modern = 1; legacy = 2 }[$Target]

    $mk = { param($text) $b = New-Object System.Windows.Forms.Button; $b.Text = $text; $b.AutoSize = $true; $b.Height = 28; $b }
    $bCore = & $mk (T 'core'); $bAll = & $mk (T 'all'); $bNone = & $mk (T 'none'); $bUpd = & $mk (T 'upd')
    $bGo = & $mk (T 'install'); $bGo.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
    $bCancel = & $mk (T 'cancel')
    $sum = New-Object System.Windows.Forms.Label; $sum.AutoSize = $true; $sum.Margin = New-Object System.Windows.Forms.Padding(8, 8, 4, 0)
    foreach ($c in @($tlab, $tcmb, $bCore, $bAll, $bNone, $bUpd, $bGo, $bCancel, $sum)) { $bar.Controls.Add($c) }

    $f.Controls.Add($tree); $f.Controls.Add($info); $f.Controls.Add($bar)
    $tree.BringToFront()

    $script:busy = $false
    $updSum = {
        $n = 0; $mb = 0
        foreach ($cn in $tree.Nodes) { foreach ($pn in $cn.Nodes) { if ($pn.Checked) { $n++; $mb += [int](Get-Key $PkgById[$pn.Name] 'sizeMB' 0) } } }
        $sum.Text = [string]::Format((T 'total'), $n, $mb)
    }
    $build = {
        $legacy = Get-TargetLegacy (@('auto', 'modern', 'legacy')[$tcmb.SelectedIndex])
        $keep = @{}
        foreach ($cn in $tree.Nodes) { foreach ($pn in $cn.Nodes) { $keep[$pn.Name] = $pn.Checked } }
        $first = ($tree.Nodes.Count -eq 0)
        $script:busy = $true
        $tree.BeginUpdate(); $tree.Nodes.Clear()
        foreach ($c in @($Cat['categories'])) {
            $cn = $tree.Nodes.Add($c['id'], $c[$Lang])
            foreach ($p in $Packages) {
                if ($p['cat'] -ne $c['id']) { continue }
                $tags = @()
                $tags += ('' + (Get-Key $p 'sizeMB' 0) + ' MB')
                if ($Installed.ContainsKey($p['id'])) { $tags += (T 'installed') }
                if ((Get-Key (Get-Key $p 'source' @{}) 'type' '') -eq 'manual') { $tags += (T 'manual') }
                $usable = Test-Usable $p $legacy
                if (-not $usable) { $tags += (T 'nowin7') }
                $pn = $cn.Nodes.Add($p['id'], $p['name'] + '   (' + ($tags -join ', ') + ')')
                if ($first) { $pn.Checked = $usable -and ((Get-Key $p 'tier' 2) -eq 1) -and -not $Installed.ContainsKey($p['id']) }
                else { $pn.Checked = $usable -and [bool]$keep[$p['id']] }
                if (-not $usable) { $pn.ForeColor = [System.Drawing.Color]::Gray }
            }
            $cn.Expand()
        }
        $tree.EndUpdate(); $script:busy = $false
        & $updSum
    }
    $setAll = {
        param($mode)
        $legacy = Get-TargetLegacy (@('auto', 'modern', 'legacy')[$tcmb.SelectedIndex])
        $script:busy = $true
        foreach ($cn in $tree.Nodes) {
            foreach ($pn in $cn.Nodes) {
                $p = $PkgById[$pn.Name]; $ok = Test-Usable $p $legacy
                switch ($mode) {
                    'core' { $pn.Checked = $ok -and ((Get-Key $p 'tier' 2) -eq 1) }
                    'all'  { $pn.Checked = $ok }
                    'none' { $pn.Checked = $false }
                    'upd'  { $pn.Checked = $ok -and $Installed.ContainsKey($p['id']) }
                }
            }
            $cn.Checked = $false
        }
        $script:busy = $false
        & $updSum
    }
    $tree.add_AfterCheck({
        param($s, $e)
        if ($script:busy) { return }
        $script:busy = $true
        if ($e.Node.Level -eq 0) { foreach ($ch in $e.Node.Nodes) { if ($ch.ForeColor -ne [System.Drawing.Color]::Gray) { $ch.Checked = $e.Node.Checked } } }
        $script:busy = $false
        & $updSum
    })
    $tree.add_AfterSelect({
        param($s, $e)
        if ($e.Node.Level -ne 1) { $info.Text = ''; return }
        $p = $PkgById[$e.Node.Name]
        $t = (Get-Key $p 'desc' @{})[$Lang]
        $n = Get-Key $p 'note' $null
        if ($n) { $t += "`r`n" + $n[$Lang] }
        $info.Text = $t
    })
    $tcmb.add_SelectedIndexChanged({ & $build })
    $bCore.add_Click({ & $setAll 'core' }); $bAll.add_Click({ & $setAll 'all' })
    $bNone.add_Click({ & $setAll 'none' }); $bUpd.add_Click({ & $setAll 'upd' })
    $bGo.add_Click({ $f.DialogResult = 'OK'; $f.Close() })
    $bCancel.add_Click({ $f.DialogResult = 'Cancel'; $f.Close() })
    & $build

    if ($f.ShowDialog() -ne 'OK') { return $null }
    $sel = @()
    foreach ($cn in $tree.Nodes) { foreach ($pn in $cn.Nodes) { if ($pn.Checked) { $sel += $pn.Name } } }
    return @{ ids = $sel; target = @('auto', 'modern', 'legacy')[$tcmb.SelectedIndex] }
}

# ------------------------------------------------------------------ progress state
$Prog = @{ running = $true; started = (Get-Date).ToString('s'); total = 0; done = 0; current = $null; items = @{}; log = @() }
$script:LastWrite = [DateTime]::MinValue
function Save-Progress([switch]$Now) {
    if (-not $Now -and (([DateTime]::Now - $script:LastWrite).TotalMilliseconds -lt 300)) { return }
    $script:LastWrite = [DateTime]::Now
    Write-KitJson (Join-Path $StateDir 'progress.json') $Prog
}
function Say([string]$Msg, [string]$Color = 'Gray', [string]$Level = 'INFO') {
    Write-Host $Msg -ForegroundColor $Color
    $line = [string](Write-KitLog $Msg $Level)
    $Prog['log'] = @($Prog['log']) + $line
    if (@($Prog['log']).Count -gt 40) { $Prog['log'] = @($Prog['log'])[-40..-1] }
    Save-Progress -Now
}
function Set-PkgState([string]$Id, [string]$Status, [string]$Msg = '') { $Prog['items'][$Id] = @{ status = [string]$Status; msg = [string]$Msg } }

# ------------------------------------------------------------------ helpers
function Merge-Dir([string]$From, [string]$To) {
    if (-not (Test-Path $To)) { New-Item -ItemType Directory -Path $To -Force | Out-Null }
    $rc = $null
    if ($env:SystemRoot) { $rc = Join-Path $env:SystemRoot 'System32\robocopy.exe' }
    if ($rc -and (Test-Path $rc)) {
        & $rc $From $To /E /MOVE /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "File copy failed (robocopy $LASTEXITCODE)" }
        if (Test-Path $From) { Remove-Item $From -Recurse -Force -ErrorAction SilentlyContinue }
        return
    }
    foreach ($item in @(Get-ChildItem -LiteralPath $From -Force)) {
        $dst = Join-Path $To $item.Name
        if ($item.PSIsContainer) { Merge-Dir $item.FullName $dst }
        else { Copy-Item -LiteralPath $item.FullName -Destination $dst -Force }
    }
    Remove-Item -LiteralPath $From -Recurse -Force
}

function Get-FlatRoot([string]$Dir) {
    $items = @(Get-ChildItem -LiteralPath $Dir -Force)
    if ($items.Count -eq 1 -and $items[0].PSIsContainer) { return $items[0].FullName }
    return $Dir
}

function Find-InboxFile([string]$Pattern) {
    if (-not $Pattern) { return $null }
    $hit = @(Get-ChildItem -LiteralPath $InboxDir -Force -ErrorAction SilentlyContinue |
        Where-Object { -not $_.PSIsContainer -and $_.Name -match $Pattern } | Sort-Object LastWriteTime -Descending)
    if ($hit.Count -gt 0) { return $hit[0].FullName }
    return $null
}

function Install-File([string]$Id, [string]$File, [string]$Format, $Src, [string]$PkgDir) {
    $sub = Get-Key $Src 'subdir' ''
    $dest = $PkgDir; if ($sub) { $dest = Join-Path $PkgDir $sub }
    if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
    $name = [IO.Path]::GetFileName($File)
    if ($Format -eq 'exe' -or $Format -eq 'installer' -or $Format -eq 'iso') {
        # Single files: drop older versions of the same program first.
        $stem = ($name -replace '[-_. ]v?\d[\d._a-z-]*\.(exe|msi|iso)$', '')
        foreach ($old in @(Get-ChildItem -LiteralPath $dest -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer -and $_.Name -ne $name -and $_.Name.StartsWith($stem) -and $_.Extension -eq [IO.Path]::GetExtension($name) })) {
            Remove-Item -LiteralPath $old.FullName -Force -ErrorAction SilentlyContinue
        }
        $target = Join-Path $dest $name
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
        if ($File.StartsWith($DownDir)) { Move-Item -LiteralPath $File -Destination $target -Force }
        else { Copy-Item -LiteralPath $File -Destination $target -Force }
        return
    }
    $stage = Join-Path $ToolsDir ('_staging\' + $Id)
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    Expand-KitArchive $File $stage
    $root = $stage
    if ((Get-Key $Src 'strip' $true) -ne $false) { $root = Get-FlatRoot $stage }
    Merge-Dir $root $dest
    if ($File.StartsWith($DownDir) -and (Test-Path -LiteralPath $File)) { Remove-Item -LiteralPath $File -Force }
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue }
}

function Invoke-PostSteps($p, [string]$PkgDir) {
    $flags = @(Get-Key $p 'flags' @())
    foreach ($fl in $flags) {
        switch ($fl) {
            'vscode-data' { $exe = Find-KitExe $p['id'] @{ exe = 'Code.exe' }
                            if ($exe) { $d = Join-Path (Split-Path $exe) 'data'; if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null } } }
            'portable-ini' { $exe = Find-KitExe $p['id'] $p['apps'][0]
                             if ($exe) { $f = Join-Path (Split-Path $exe) 'portable.ini'; if (-not (Test-Path $f)) { Set-Content -Path $f -Value '' } } }
            'portable-txt' { $exe = Find-KitExe $p['id'] $p['apps'][0]
                             if ($exe) { $f = Join-Path (Split-Path $exe) 'portable.txt'; if (-not (Test-Path $f)) { Set-Content -Path $f -Value '' } } }
        }
    }
}

function Initialize-SevenZip {
    if (Get-SevenZa) { return $true }
    if (-not $OS['windows']) { return $false }
    Say (T 'boot') 'Cyan'
    try {
        $zr = Join-Path $BinDir '7zr.exe'
        if (-not (Test-Path $zr)) { Invoke-KitDownload $Cat['core']['sevenZr']['url'] $zr $null }
        $ex = Resolve-KitSource $Cat['core']['sevenExtra']
        $exFile = Join-Path $BinDir $ex['file']
        Invoke-KitDownload $ex['url'] $exFile $null
        $tmp = Join-Path $BinDir 'extra'
        & $zr x $exFile ("-o" + $tmp) -y | Out-Null
        Copy-Item (Join-Path $tmp '7za.exe') (Join-Path $BinDir '7za.exe') -Force
        foreach ($dll in @('7za.dll', '7zxa.dll')) { $d = Join-Path $tmp $dll; if (Test-Path $d) { Copy-Item $d $BinDir -Force } }
        Remove-Item $tmp -Recurse -Force; Remove-Item $exFile -Force
        return $true
    } catch {
        Say ("7-Zip: " + $_.Exception.Message + " (zip files will still work)") 'Yellow' 'WARN'
        return $false
    }
}

# ------------------------------------------------------------------ main
Write-Host ''
Write-Host ('  ' + (T 'title') + '   ' + $OS['name'] + '  PS ' + $OS['ps']) -ForegroundColor Cyan
Write-Host ''
if (-not $script:TlsOk) { Write-Host (T 'tls') -ForegroundColor Yellow }

$sel = @()
if ($Ids) { $sel = @(($Ids -split '[,;\s]+') | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
elseif ($All -or $Primary) {
    $leg = Get-TargetLegacy $Target
    foreach ($p in $Packages) { if ((Test-Usable $p $leg) -and ($All -or (Get-Key $p 'tier' 2) -eq 1)) { $sel += $p['id'] } }
} elseif ($Update) {
    foreach ($k in @($Installed.Keys)) { if ($PkgById.ContainsKey($k)) { $sel += $k } }
} elseif (-not $NoGui -and $OS['windows']) {
    $r = Show-Picker
    if (-not $r) { exit 1 }
    $sel = @($r['ids']); $Target = $r['target']
    $Update = $true      # in the picker, a ticked item always means "fetch it now"
}
if ($sel.Count -eq 0) { Say (T 'noSel') 'Yellow'; exit 1 }

$legacy = Get-TargetLegacy $Target
$Settings['target'] = $Target; $Settings['lang'] = $Lang
Write-KitJson (Join-Path $StateDir 'settings.json') $Settings

$Prog['total'] = $sel.Count
foreach ($id in $sel) { Set-PkgState $id 'queued' }
Save-Progress -Now

[void](Initialize-SevenZip)
$DownDir = Join-Path $ToolsDir '_downloads'
if (-not (Test-Path $DownDir)) { New-Item -ItemType Directory -Path $DownDir | Out-Null }

$okN = 0; $errN = 0; $manualList = @()
foreach ($id in $sel) {
    $p = $PkgById[$id]
    if (-not $p) { Say "? $id" 'Yellow' 'WARN'; $Prog['done']++; continue }
    $name = $p['name']
    $Prog['current'] = @{ id = $id; name = $name; phase = 'resolve'; bytes = 0; size = 0 }
    Set-PkgState $id 'working'
    if (-not (Test-Usable $p $legacy)) { Say ("  - $name : " + (T 'skipped') + ' (' + (T 'nowin7') + ')') 'DarkGray'; Set-PkgState $id 'skipped' (T 'nowin7'); $Prog['done']++; continue }

    $refresh = (@(Get-Key $p 'flags' @()) -contains 'refresh')
    if ($Installed.ContainsKey($id) -and -not $Update -and -not $refresh) {
        Say ("  = $name : " + (T 'installed')) 'DarkGray'; Set-PkgState $id 'ok' (T 'installed'); $Prog['done']++; $okN++; continue
    }

    $useLegacy = $legacy -and $p.ContainsKey('legacy')
    $srcAll = $p['source']; $fmt = $p['format']
    if ($useLegacy) { $srcAll = $p['legacy']['source']; $fmt = Get-Key $p['legacy'] 'format' $fmt }
    $srcList = @(); if ($srcAll -is [System.Collections.IDictionary]) { $srcList = @($srcAll) } else { $srcList = @($srcAll) }

    $pkgDir = Join-Path $ToolsDir $id
    $versions = @(); $hashes = @(); $failed = $null
    Say ("> $name") 'White'
    foreach ($src in $srcList) {
        try {
            $file = $null
            if ((Get-Key $src 'type' '') -eq 'manual') {
                $file = Find-InboxFile (Get-Key $src 'inbox' '')
                if (-not $file) { throw 'MANUAL' }
                $versions += [IO.Path]::GetFileName($file)
            } else {
                Say ("    " + (T 'resolving') + '...') 'DarkGray'
                $res = Resolve-KitSource $src
                $file = Join-Path $DownDir $res['file']
                $Prog['current']['phase'] = 'download'
                $ua = Get-Key $res 'ua' $KitUA
                Say ("    " + (T 'downloading') + ': ' + $res['url']) 'DarkGray'
                $cb = {
                    param($d, $t)
                    $Prog['current']['bytes'] = $d; $Prog['current']['size'] = $t
                    $pct = 0; if ($t -gt 0) { $pct = [int](100 * $d / $t) }
                    Write-Progress -Activity $name -Status ('{0:N1} / {1:N1} MB' -f ($d / 1MB), ($t / 1MB)) -PercentComplete ([Math]::Max(0, [Math]::Min(100, $pct)))
                    Save-Progress
                }
                Invoke-KitDownload $res['url'] $file $cb $ua
                Write-Progress -Activity $name -Completed
                $versions += $res['file']
                try { $hashes += (Get-KitHash $file) } catch { }
            }
            $Prog['current']['phase'] = 'extract'; Save-Progress -Now
            Say ("    " + (T 'extracting') + '...') 'DarkGray'
            Install-File $id $file $fmt $src $pkgDir
        } catch {
            if ($_.Exception.Message -eq 'MANUAL') { $failed = 'MANUAL' } else { $failed = $_.Exception.Message }
            break
        }
    }

    if ($failed -eq 'MANUAL') {
        Say ("    " + (T 'manual') + ': ' + $p['page']) 'Yellow'
        Set-PkgState $id 'manual' $p['page']; $manualList += $p
    } elseif ($failed) {
        Say ("    " + (T 'failed') + ': ' + $failed) 'Red' 'ERROR'
        Set-PkgState $id 'error' $failed; $errN++
        if (-not $Installed.ContainsKey($id)) { $manualList += $p }
    } else {
        Invoke-PostSteps $p $pkgDir
        $Installed[$id] = @{ date = (Get-Date).ToString('s'); files = ($versions -join ', '); legacy = [bool]$useLegacy; sha256 = [string]($hashes -join ',') }
        try { Update-KitHashes $id } catch { }
        Write-KitJson (Join-Path $StateDir 'installed.json') $Installed
        Say ("    " + (T 'done')) 'Green'
        Set-PkgState $id 'ok'; $okN++
    }
    $Prog['done']++
    Save-Progress -Now
}

$staging = Join-Path $ToolsDir '_staging'
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }

# Offline copy of the catalog and install state for the dashboard's file:// mode.
try {
    $js = 'window.KIT_CATALOG = ' + (Read-KitText (Join-Path $CoreDir 'catalog.json')) + ";`n" +
          'window.KIT_INSTALLED = ' + (ConvertTo-KitJson $Installed) + ";`n"
    Write-KitText (Join-Path $KitRoot 'launcher\data\catalog.js') $js
} catch { }

$Prog['running'] = $false; $Prog['current'] = $null; $Prog['finished'] = (Get-Date).ToString('s')
Write-Host ''
Say ([string]::Format((T 'summary'), $okN, $errN, $manualList.Count)) 'Cyan'

if ($manualList.Count -gt 0) {
    Write-Host ''
    Write-Host ('  ' + (T 'manualTitle')) -ForegroundColor Yellow
    foreach ($m in $manualList) { Write-Host ('   - ' + $m['name'] + '  ' + $m['page']) }
    Write-Host ('  ' + [string]::Format((T 'manualHelp'), $InboxDir)) -ForegroundColor Yellow
    if (-not $NoGui -and $OS['windows']) {
        $a = Read-Host (T 'openPages')
        if ($a -match '^(i|y|igen|yes)') { foreach ($m in $manualList) { Start-Process $m['page']; Start-Sleep -Milliseconds 400 } }
    }
}
Save-Progress -Now

if (-not $NoLaunch -and -not $NoGui -and $OS['windows']) {
    Write-Host (T 'startDash') -ForegroundColor Cyan
    Start-Process -FilePath (Join-Path $KitRoot 'START.cmd') -WorkingDirectory $KitRoot
    Start-Sleep -Seconds 2
}
