# Pester 5 tests for ledger.ps1: read/write, uninstall planning (dry run) and the full-uninstall plan.
BeforeAll {
    $TermDir = Split-Path -Parent $PSScriptRoot
    . (Join-Path $TermDir 'lib.ps1')
    . (Join-Path $TermDir 'ledger.ps1')
    $sep = [IO.Path]::DirectorySeparatorChar
}

Describe 'ledger read / write' {
    It 'starts empty, adds rows, and a re-install of the same pkg replaces its row' {
        $p = Join-Path $TestDrive 'ledger.json'
        @(Read-TermLedger $p).Count | Should -Be 0
        [void](Add-TermLedgerEntry $p @{ pkg = 'ripgrep'; kind = 'portable'; paths = @('tools\ripgrep'); sha256 = 'aa'; sizeMB = 2 })
        [void](Add-TermLedgerEntry $p @{ pkg = 'jq'; kind = 'portable'; paths = @('tools\jq') })
        [void](Add-TermLedgerEntry $p @{ pkg = 'ripgrep'; kind = 'portable'; paths = @('tools\ripgrep'); sha256 = 'bb' })
        $rows = @(Read-TermLedger $p)
        $rows.Count | Should -Be 2
        ($rows | Where-Object { $_['pkg'] -eq 'ripgrep' })['sha256'] | Should -Be 'bb'
    }
    It 'removes a row by id' {
        $p = Join-Path $TestDrive 'l2.json'
        $r = Add-TermLedgerEntry $p @{ pkg = 'x'; kind = 'download'; paths = @('tools\x\a.iso') }
        Remove-TermLedgerRow $p $r['id']
        @(Read-TermLedger $p).Count | Should -Be 0
    }
}

Describe 'Test-TermPathInside / Test-TermDeletable' {
    It 'only paths below a kit data folder may be deleted, never the folder itself or code' {
        $k = Join-Path $TestDrive 'kit'
        Test-TermDeletable $k (Join-Path $k ('tools' + $sep + 'jq')) | Should -BeTrue
        Test-TermDeletable $k (Join-Path $k 'tools') | Should -BeFalse
        Test-TermDeletable $k (Join-Path $k ('core' + $sep + 'kit.ps1')) | Should -BeFalse
        Test-TermDeletable $k (Join-Path $TestDrive 'elsewhere') | Should -BeFalse
        Test-TermDeletable $k (Join-Path $k ('tools' + $sep + '..' + $sep + '..' + $sep + 'x')) | Should -BeFalse
    }
}

Describe 'Get-TermUninstallPlan (dry run)' {
    It 'plans deletes inside the kit, commands for installed rows, and refuses the rest' {
        $k = Join-Path $TestDrive 'kit'
        $rows = @(
            @{ id = '1'; pkg = 'jq'; kind = 'portable'; paths = @('tools\jq') },
            @{ id = '2'; pkg = 'ws'; kind = 'workspace'; paths = @('workspace\demo') },
            @{ id = '3'; pkg = 'vbox'; kind = 'installed'; uninstall = 'winget uninstall --id Oracle.VirtualBox' },
            @{ id = '4'; pkg = 'odd'; kind = 'installed' },
            @{ id = '5'; pkg = 'evil'; kind = 'portable'; paths = @('C:\Windows') }
        )
        $plan = @(Get-TermUninstallPlan $rows $k)
        $plan[0]['action'] | Should -Be 'delete'; $plan[0]['ok'] | Should -BeTrue
        $plan[1]['ok'] | Should -BeTrue
        $plan[2]['action'] | Should -Be 'command'; $plan[2]['command'] | Should -Match 'winget'
        $plan[3]['ok'] | Should -BeFalse
        $plan[4]['ok'] | Should -BeFalse
    }
}

Describe 'Get-TermFullUninstallPlanCore' {
    It 'lists the kit data folders and credentials, keeps the launcher files' {
        $k = Join-Path $TestDrive 'kit'
        $plan = Get-TermFullUninstallPlanCore $k @(@{ id = '3'; pkg = 'vbox'; kind = 'installed'; uninstall = 'u' }) @('X:\Local\ServiceKitTerminal') @('TERMINAL.cmd', 'START.cmd', 'core', 'terminal', 'tools', 'data', 'state', 'README.md')
        $names = @($plan['delete'] | ForEach-Object { Split-Path -Leaf $_ })
        foreach ($n in @('data', 'tools', 'workspace', 'reports', 'logs', 'envs', 'state')) { $names | Should -Contain $n }
        $plan['delete'] | Should -Contain 'X:\Local\ServiceKitTerminal'
        (Split-Path -Leaf $plan['delete'][-1]) | Should -Be 'state'
        $plan['commands'].Count | Should -Be 1
        $plan['keep'] | Should -Contain 'TERMINAL.cmd'
        $plan['keep'] | Should -Contain 'core'
        $plan['keep'] | Should -Not -Contain 'tools'
    }
}
