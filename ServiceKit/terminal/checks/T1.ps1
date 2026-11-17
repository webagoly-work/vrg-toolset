# T1 Fejlesztes / Dev: git, node, python, VS Code, winget, WSL, Windows Terminal, PowerShell 7, gh.
function Invoke-TermCheckT1 {
    $it = @()
    $it += New-TermToolItem 'git' @('portablegit\cmd\git.exe') @('git.exe')
    $it += New-TermToolItem 'node' @('node\node.exe') @('node.exe')
    $it += New-TermToolItem 'python' @('python\tools\python.exe', 'python\python.exe') @('python.exe')
    $it += New-TermToolItem 'vscode' @('vscode\bin\code.cmd') @('code.cmd')
    $it += New-TermToolItem 'pwsh7' @('pwsh\pwsh.exe') @('pwsh.exe')
    $it += New-TermToolItem 'gh' @('gh\bin\gh.exe', 'gh\gh.exe') @('gh.exe')
    $it += New-TermToolItem 'winget' @() @('winget.exe')
    # WSL: presence only. Running wsl.exe on a PC without it can start an install prompt.
    $wsl = $null; if ($env:SystemRoot) { $wsl = Join-Path $env:SystemRoot 'System32\wsl.exe' }
    $distros = @()
    try { $distros = @(Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' -ErrorAction Stop | ForEach-Object { [string](Get-ItemProperty $_.PSPath).DistributionName }) } catch { }
    if ($wsl -and (Test-Path -LiteralPath $wsl)) { $it += New-TermItem 'wsl' ('present, distros: ' + ($distros -join ', ')) 'ok' '' @{ distros = $distros } }
    else { $it += New-TermItem 'wsl' '' 'missing' }
    $wt = Find-TermTool @() @('wt.exe')
    if ($wt) { $it += New-TermItem 'wt' $wt 'ok' } else { $it += New-TermItem 'wt' '' 'missing' }
    return @{ tier = 'T1'; items = $it }
}
