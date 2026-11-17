# ServiceKit Terminal - VM v1: Windows Sandbox. Writes a .wsb that maps the kit's code and tools read-only and
# exchange\ read-write, sets networking as chosen, and opens Kit Shell inside. The kit's data\ folder (credentials,
# client jobs, backups) is never mapped. Enabling the feature is only shown as a command for the user to run.
# Dot-source after lib.ps1. PowerShell 5.1, ASCII only.

$TermWsbFile = Join-Path $StateDir 'terminal-sandbox.wsb'
$TermWsbEnable = 'Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All'

# Pure: the reason Sandbox can or cannot start, from facts gathered by Get-TermSandboxState.
function Get-TermSandboxVerdict($F) {
    if (-not $F['windows']) { return @{ available = $false; reason = 'nonwin'; enableCommand = '' } }
    if ($F['home']) { return @{ available = $false; reason = 'home'; enableCommand = '' } }
    if ([int]$F['major'] -lt 10 -or [int]$F['build'] -lt 18305) { return @{ available = $false; reason = 'old'; enableCommand = '' } }
    if ($F['virt'] -eq $false) { return @{ available = $false; reason = 'novirt'; enableCommand = '' } }
    if (-not $F['exe']) { return @{ available = $false; reason = 'off'; enableCommand = $TermWsbEnable } }
    return @{ available = $true; reason = 'ok'; enableCommand = '' }
}

function Get-TermSandboxState {
    $os = Get-KitOS
    $exe = $false
    if ($env:SystemRoot) { $exe = Test-Path -LiteralPath (Join-Path $env:SystemRoot 'System32\WindowsSandbox.exe') }
    $virt = $null
    if ($os['windows']) {
        try {
            $hyp = [bool](@(Get-WmiObject Win32_ComputerSystem -ErrorAction Stop)[0].HypervisorPresent)
            if ($hyp) { $virt = $true } else { $virt = [bool](@(Get-WmiObject Win32_Processor -ErrorAction Stop)[0].VirtualizationFirmwareEnabled) }
        } catch { }
    }
    $f = @{ windows = [bool]$os['windows']; home = ([string]$os['name'] -match 'Home|Otthoni'); major = $os['major']; build = $os['build']; virt = $virt; exe = $exe }
    return (Get-TermSandboxVerdict $f)
}

function ConvertTo-TermXml([string]$S) { return [System.Security.SecurityElement]::Escape($S) }

# Pure: the .wsb document.
function New-TermWsbXml([string]$KitRoot, [bool]$Net) {
    $netv = 'Disable'; if ($Net) { $netv = 'Enable' }
    $maps = @(
        @((Join-Path $KitRoot 'tools'), 'C:\Kit\tools', 'true'),
        @((Join-Path $KitRoot 'core'), 'C:\Kit\core', 'true'),
        @((Join-Path $KitRoot 'terminal'), 'C:\Kit\terminal', 'true'),
        @((Join-Path $KitRoot 'exchange'), 'C:\Kit\exchange', 'false')
    )
    $mx = @()
    foreach ($m in $maps) {
        $mx += ('    <MappedFolder><HostFolder>' + (ConvertTo-TermXml $m[0]) + '</HostFolder><SandboxFolder>' + $m[1] + '</SandboxFolder><ReadOnly>' + $m[2] + '</ReadOnly></MappedFolder>')
    }
    # Kit Shell keeps its caches in a writable folder inside the sandbox (SK_DATA), because the kit is read-only there.
    $logon = 'cmd.exe /c set SK_DATA=C:\Users\WDAGUtilityAccount\KitData&& start "Kit Shell" cmd.exe /k C:\Kit\core\kitshell.cmd'
    $lines = @(
        '<Configuration>',
        '  <VGpu>Disable</VGpu>',
        ('  <Networking>' + $netv + '</Networking>'),
        '  <ClipboardRedirection>Enable</ClipboardRedirection>',
        '  <PrinterRedirection>Disable</PrinterRedirection>',
        '  <AudioInput>Disable</AudioInput>',
        '  <VideoInput>Disable</VideoInput>',
        '  <MappedFolders>'
    ) + $mx + @(
        '  </MappedFolders>',
        ('  <LogonCommand><Command>' + (ConvertTo-TermXml $logon) + '</Command></LogonCommand>'),
        '</Configuration>'
    )
    return ($lines -join "`r`n")
}

function Start-TermSandbox([bool]$Net) {
    $st = Get-TermSandboxState
    if (-not $st['available']) { return (TT ('wsb_' + $st['reason'])) }
    if (@(Get-Process -Name 'WindowsSandbox', 'WindowsSandboxClient', 'WindowsSandboxRemoteSession' -ErrorAction SilentlyContinue).Count -gt 0) {
        return 'Windows Sandbox is already running (only one at a time).'
    }
    $ex = Join-Path $KitRoot 'exchange'
    if (-not (Test-Path -LiteralPath $ex)) { New-Item -ItemType Directory -Path $ex -Force | Out-Null }
    Write-KitText $TermWsbFile (New-TermWsbXml $KitRoot $Net)
    Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsSandbox.exe') -ArgumentList ('"' + $TermWsbFile + '"') | Out-Null
    $n = 'off'; if ($Net) { $n = 'on' }
    return ((TT 'wsbStarted') + ' (network ' + $n + ', exchange: ' + $ex + ')')
}
