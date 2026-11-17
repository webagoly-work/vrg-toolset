# Pester 5 tests for vm/wsb.ps1 (the pure parts).
BeforeAll {
    $TermDir = Split-Path -Parent $PSScriptRoot
    . (Join-Path $TermDir 'lib.ps1')
    . (Join-Path $TermDir 'vm\wsb.ps1')
}

Describe 'Get-TermSandboxVerdict' {
    It 'Home cannot, old builds cannot, firmware virtualization off cannot' {
        (Get-TermSandboxVerdict @{ windows = $true; home = $true; major = 10; build = 22631; virt = $true; exe = $false })['reason'] | Should -Be 'home'
        (Get-TermSandboxVerdict @{ windows = $true; home = $false; major = 10; build = 17763; virt = $true; exe = $false })['reason'] | Should -Be 'old'
        (Get-TermSandboxVerdict @{ windows = $true; home = $false; major = 10; build = 22631; virt = $false; exe = $false })['reason'] | Should -Be 'novirt'
    }
    It 'feature off gives the enable command; on is available' {
        $v = Get-TermSandboxVerdict @{ windows = $true; home = $false; major = 10; build = 22631; virt = $true; exe = $false }
        $v['reason'] | Should -Be 'off'
        $v['enableCommand'] | Should -Match 'Containers-DisposableClientVM'
        (Get-TermSandboxVerdict @{ windows = $true; home = $false; major = 10; build = 22631; virt = $null; exe = $true })['available'] | Should -BeTrue
    }
}

Describe 'New-TermWsbXml' {
    It 'maps code and tools read-only, exchange writable, and never data' {
        $x = [xml](New-TermWsbXml 'E:\Service & Kit' $false)
        $m = @($x.Configuration.MappedFolders.MappedFolder)
        ($m | Where-Object { $_.SandboxFolder -eq 'C:\Kit\exchange' }).ReadOnly | Should -Be 'false'
        ($m | Where-Object { $_.SandboxFolder -eq 'C:\Kit\tools' }).ReadOnly | Should -Be 'true'
        @($m | Where-Object { $_.HostFolder -match 'data' }).Count | Should -Be 0
        $x.Configuration.Networking | Should -Be 'Disable'
        $x.Configuration.LogonCommand.Command | Should -Match 'kitshell\.cmd'
        $x.Configuration.LogonCommand.Command | Should -Match 'SK_DATA='
    }
    It 'switches networking on' { ([xml](New-TermWsbXml 'E:\K' $true)).Configuration.Networking | Should -Be 'Enable' }
}
