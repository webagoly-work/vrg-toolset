# T3 Hardver / VRG: COM ports, USB-serial drivers (CH340, CP210x, FTDI), arduino-cli, esptool.
function Invoke-TermCheckT3 {
    $it = @()
    $ports = @()
    try { $ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object -Unique) } catch { }
    $names = @(Get-TermWmi 'Win32_PnPEntity' 'root\cimv2' "Name LIKE '%(COM%'" | ForEach-Object { [string]$_.Name })
    $st = 'info'; if ($ports.Count -gt 0) { $st = 'ok' }
    $v = 'none'; if ($names.Count -gt 0) { $v = $names -join '; ' } elseif ($ports.Count -gt 0) { $v = $ports -join ', ' }
    $it += New-TermItem 'comports' $v $st '' @{ ports = $ports; names = $names }
    $drv = $null; if ($env:SystemRoot) { $drv = Join-Path $env:SystemRoot 'System32\drivers' }
    foreach ($d in @(@('drv_ch340', @('CH341S64.SYS', 'CH341SER.SYS', 'CH343S64.SYS')), @('drv_cp210x', @('silabser.sys')), @('drv_ftdi', @('ftdibus.sys', 'ftser2k.sys')))) {
        $hit = $null
        if ($drv) { foreach ($f in $d[1]) { if (Test-Path -LiteralPath (Join-Path $drv $f)) { $hit = $f; break } } }
        if ($hit) { $it += New-TermItem $d[0] $hit 'ok' } else { $it += New-TermItem $d[0] '' 'missing' }
    }
    $it += New-TermToolItem 'arduino' @('arduino-cli\arduino-cli.exe') @('arduino-cli.exe') 'version'
    $it += New-TermToolItem 'esptool' @('esptool\esptool.exe') @('esptool.exe', 'esptool.py') 'version'
    return @{ tier = 'T3'; items = $it }
}
