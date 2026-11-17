# Runs the parse check and every Pester test in this folder. Needs PowerShell 7 or 5.1 with Pester 5.
#   pwsh -NoProfile -File ServiceKit\terminal\tests\run-tests.ps1
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $here 'parse-check.ps1')
if ($LASTEXITCODE -ne 0) { exit 1 }
if (-not (Get-Module -ListAvailable Pester | Where-Object { $_.Version.Major -ge 5 })) {
    Write-Host 'Pester 5 is missing:  Install-Module Pester -Scope CurrentUser -MinimumVersion 5.0' -ForegroundColor Yellow
    exit 2
}
Import-Module Pester -MinimumVersion 5.0
$r = Invoke-Pester -Path $here -PassThru -Output Detailed
if ($r.FailedCount -gt 0) { exit 1 }
exit 0
