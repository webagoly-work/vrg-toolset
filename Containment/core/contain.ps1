# ---------------------------------------------------------------------------
# contain.ps1 - VRG Containment: a disposable, isolated machine on demand.
#
#   contain.ps1                          the menu (CONTAIN.cmd)
#   contain.ps1 -Mode sandbox [box] [path] [-Open]   Windows Sandbox (SANDBOX.cmd)
#   contain.ps1 -Mode stick   [box] [path] [-Disk img]  portable QEMU VM (STICK.cmd)
#   contain.ps1 -Mode setup [-AllowUnsigned]   download + verify QEMU and Debian Live
#   contain.ps1 -Mode verify | status | enable | enable-whpx
#   contain.ps1 -Mode autostart [box] [-Off]   open a sandbox at every sign-in
#   contain.ps1 -Mode pack -Target E:\VRG-Containment   copy the kit to a stick
#
# [box] is a profile id from profiles.json (quarantine, browse, offline);
# [path] a file or folder to hand over read-only. Both can come in any order,
# so dropping a file on SANDBOX.cmd or STICK.cmd just works.
# -DryRun writes the config and prints it without starting anything.
# ASCII only (Windows PowerShell 5.1).
# ---------------------------------------------------------------------------
# Positional words all land in -Rest and are sorted below (profile id or path).
[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$Mode = 'menu',
    [string]$Box = '',
    [string]$Item = '',
    [string]$Disk = '',
    [string]$Target = '',
    [switch]$Open,
    [switch]$DryRun,
    [switch]$Off,
    [switch]$AllowUnsigned,
    [switch]$Pause,
    [Parameter(ValueFromRemainingArguments = $true)] [string[]]$Rest
)

. (Join-Path $PSScriptRoot 'contain-lib.ps1')

function Read-Rest {
    foreach ($r in @($Rest)) {
        if (-not $r) { continue }
        if (-not $script:Box -and (Test-BoxId $r)) { $script:Box = $r; continue }
        if (-not $script:Item -and (Test-Path -LiteralPath $r)) { $script:Item = $r; continue }
        throw ('Not a profile and not an existing file or folder: ' + $r)
    }
}

function Invoke-Mode([string]$m) {
    switch ($m) {
        'sandbox'     { Start-SandboxMode $Box $Item ([bool]$Open) ([bool]$DryRun) | Out-Null }
        'stick'       { Start-StickMode $Box $Item $Disk ([bool]$DryRun) | Out-Null }
        'setup'       { Invoke-Setup ([bool]$AllowUnsigned) }
        'verify'      { $n = Invoke-Verify; if ($n -gt 0) { exit 1 } }
        'status'      { Show-Status }
        'enable'      { Enable-Features $false }
        'enable-whpx' { Enable-Features $true }
        'autostart'   { Set-Autostart $Box ([bool]$Off) }
        'pack'        { Copy-Kit $Target }
        'menu'        { Show-Menu }
        default       { throw ('Unknown mode: ' + $m) }
    }
}

function Show-Menu {
    $boxes = @((Get-Profiles).profiles)
    while ($true) {
        Clear-Host
        Say ''
        Say '  VRG CONTAINMENT  -  eldobhato, elszigetelt gep'
        Say '  ----------------------------------------------'
        Say '  Windows Sandbox (ez a gep, Win10/11 Pro / Enterprise / Education):'
        $i = 1
        foreach ($b in $boxes) { Say ('    ' + $i + '  ' + $b.name.PadRight(15) + $b.hint); $i++ }
        Say '  Pendrive VM (QEMU + Debian Live, barmely Windows, telepites nelkul):'
        foreach ($b in $boxes) { Say ('    ' + $i + '  ' + $b.name.PadRight(15) + $b.hint); $i++ }
        Say ''
        Say '    S  Allapot: mi mukodik ezen a gepen'
        Say '    F  Pendrive VM letoltese es ellenorzese (kb. 4 GB)'
        Say '    E  Windows Sandbox bekapcsolasa (rendszergazda, ujrainditas)'
        Say '    H  Hypervisor Platform bekapcsolasa (gyors pendrive VM)'
        Say '    V  Integritas-ellenorzes'
        Say '    P  Masolas pendrive-ra'
        Say '    A  Inditas a Windows-szal (be / ki)'
        Say '    O  Csere mappa megnyitasa (inbox / outbox)'
        Say '    Q  Kilepes'
        Say ''
        Say '  Fajl atadasa: huzd a fajlt a SANDBOX.cmd vagy a STICK.cmd ikonjara.'
        $k = (Read-Host '  Valassz').Trim().ToUpper()
        if ($k -eq 'Q' -or $k -eq '') { return }
        Say ''
        try {
            $n = 0
            if ([int]::TryParse($k, [ref]$n) -and $n -ge 1 -and $n -le 2 * $boxes.Count) {
                if ($n -le $boxes.Count) { Start-SandboxMode $boxes[$n - 1].id '' $false $false | Out-Null }
                else { Start-StickMode $boxes[$n - 1 - $boxes.Count].id '' '' $false | Out-Null }
            } else {
                switch ($k) {
                    'S' { Show-Status }
                    'F' { Invoke-Setup $false }
                    'E' { Enable-Features $false }
                    'H' { Enable-Features $true }
                    'V' { Invoke-Verify | Out-Null }
                    'P' { Copy-Kit '' }
                    'A' {
                        $auto = Join-Path ([Environment]::GetFolderPath('Startup')) 'VRG Containment.cmd'
                        if (Test-Path -LiteralPath $auto) { Set-Autostart '' $true }
                        else {
                            $id = (Read-Host ('  Melyik profil induljon? (' + (($boxes | ForEach-Object { $_.id }) -join ', ') + ')')).Trim()
                            Set-Autostart $id $false
                        }
                    }
                    'O' { Ensure-Dir $script:Inbox; Ensure-Dir $script:Outbox; Start-Process explorer.exe (Join-Args @($script:Exchange)) }
                    default { Warn ('Nincs ilyen: ' + $k) }
                }
            }
        } catch { Write-Host ('[X] ' + $_.Exception.Message) -ForegroundColor Red }
        Say ''
        Read-Host '  Enter: vissza a menube' | Out-Null
    }
}

$code = 0
try { Read-Rest; Invoke-Mode $Mode }
catch { Write-Host ('[X] ' + $_.Exception.Message) -ForegroundColor Red; $code = 1 }
if ($Pause) { Read-Host 'Enter to close' | Out-Null }
exit $code
