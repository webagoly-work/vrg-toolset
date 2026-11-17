# Pester 5 tests for the pure parts of detect.ps1. Run: pwsh -NoProfile -File tests\run-tests.ps1
BeforeAll {
    $TermDir = Split-Path -Parent $PSScriptRoot
    . (Join-Path $TermDir 'lib.ps1')
    . (Join-Path $TermDir 'detect.ps1')
}

Describe 'ConvertFrom-TermJsonString' {
    It 'decodes backslashes, quotes and \u escapes' {
        ConvertFrom-TermJsonString 'H:\\VRG\\Full' | Should -Be 'H:\VRG\Full'
        ConvertFrom-TermJsonString 'a\"b' | Should -Be 'a"b'
        ConvertFrom-TermJsonString 'caf\u00e9' | Should -Be ('caf' + [char]0xE9)
    }
}

Describe 'Get-TermCwdFromJsonl' {
    It 'reads the real path from the first line that has cwd' {
        $f = Join-Path $TestDrive 'a.jsonl'
        Set-Content -LiteralPath $f -Value @('{"type":"summary"}', '{"type":"user","cwd":"H:\\VRG\\Full\\Planner_VRG_U100","sessionId":"x"}') -Encoding UTF8
        Get-TermCwdFromJsonl $f | Should -Be 'H:\VRG\Full\Planner_VRG_U100'
    }
    It 'returns null when no line within the limit has cwd' {
        $f = Join-Path $TestDrive 'b.jsonl'
        Set-Content -LiteralPath $f -Value @('{"a":1}', '{"cwd":"late"}') -Encoding UTF8
        Get-TermCwdFromJsonl $f 1 | Should -BeNullOrEmpty
    }
}

Describe 'Get-TermSessionFolders' {
    It 'merges folders by cwd, counts sessions and sorts newest first' {
        $root = Join-Path $TestDrive 'projects'
        $p1 = Join-Path $root 'H--VRG-Full'; $p2 = Join-Path $root 'C--work'
        New-Item -ItemType Directory -Path $p1, $p2 -Force | Out-Null
        $real1 = Join-Path $TestDrive 'real1'; New-Item -ItemType Directory -Path $real1 | Out-Null
        $j = '{"cwd":"' + ($real1 -replace '\\', '\\') + '"}'
        Set-Content -LiteralPath (Join-Path $p1 's1.jsonl') -Value $j
        Set-Content -LiteralPath (Join-Path $p1 's2.jsonl') -Value $j
        Set-Content -LiteralPath (Join-Path $p2 's3.jsonl') -Value '{"cwd":"C:\\nowhere-xyz"}'
        (Get-Item (Join-Path $p2 's3.jsonl')).LastWriteTime = (Get-Date).AddDays(-3)
        $r = @(Get-TermSessionFolders @($root))
        $r.Count | Should -Be 2
        $r[0]['path'] | Should -Be $real1
        $r[0]['sessions'] | Should -Be 2
        $r[0]['exists'] | Should -BeTrue
        $r[1]['exists'] | Should -BeFalse
    }
}

Describe 'Get-TermWorktreePlan' {
    It 'empty task means the folder itself' {
        (Get-TermWorktreePlan 'C:\r' '   ' $false $false)['mode'] | Should -Be 'self'
    }
    It 'spaces become dashes and the branch is wt/<name>' {
        $p = Get-TermWorktreePlan 'C:\r' 'fix the menu' $false $false
        $p['name'] | Should -Be 'fix-the-menu'
        $p['branch'] | Should -Be 'wt/fix-the-menu'
        $p['mode'] | Should -Be 'create'
        $p['path'] | Should -Match 'worktrees.fix-the-menu$'
    }
    It 'same name reopens, an existing branch is attached' {
        (Get-TermWorktreePlan 'C:\r' 'x' $true $true)['mode'] | Should -Be 'reopen'
        (Get-TermWorktreePlan 'C:\r' 'x' $false $true)['mode'] | Should -Be 'attach'
    }
    It 'drops characters git or Windows would refuse' {
        (Get-TermWorktreePlan 'C:\r' 'a:b*c?' $false $false)['name'] | Should -Be 'abc'
    }
}

Describe 'Find-TermGitRepos' {
    It 'finds repos to depth 2, skips dot and system folders, does not descend into a repo' {
        $r = Join-Path $TestDrive 'scan'
        New-Item -ItemType Directory -Path (Join-Path $r 'a\.git'), (Join-Path $r 'b\c\.git'), (Join-Path $r '.hidden\d\.git'), (Join-Path $r 'a\inner\.git'), (Join-Path $r 'node_modules\e\.git') -Force | Out-Null
        $found = @(Find-TermGitRepos @(@{ path = $r; depth = 2 }) 5 40) | ForEach-Object { Split-Path -Leaf $_ }
        $found | Should -Contain 'a'
        $found | Should -Contain 'c'
        $found | Should -Not -Contain 'd'
        $found | Should -Not -Contain 'inner'
        $found | Should -Not -Contain 'e'
    }
}

Describe 'ConvertTo-AsciiText' {
    It 'folds Hungarian accents and typographic punctuation' {
        $s = 'T' + [char]0xF6 + 'rl' + [char]0xE9 + 's ' + [char]0x2013 + ' ' + [char]0x0151 + [char]0x0171
        ConvertTo-AsciiText $s | Should -Be 'Torles - ou'
    }
}

Describe 'Test-TermProfile' {
    It 'accepts real-looking names and rejects the rest' {
        Test-TermProfile @{ githubUser = 'octo-cat'; accessRepo = 'octo-cat/vrg-access-log' } | Should -BeTrue
        Test-TermProfile @{ githubUser = ''; accessRepo = 'x/y' } | Should -BeFalse
        Test-TermProfile @{ githubUser = 'a b'; accessRepo = 'x/y' } | Should -BeFalse
    }
}
