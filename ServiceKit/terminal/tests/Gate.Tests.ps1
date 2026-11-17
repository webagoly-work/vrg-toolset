# Pester 5 tests for the pure parts of gate.ps1 and the two hooks.
BeforeAll {
    $TermDir = Split-Path -Parent $PSScriptRoot
    . (Join-Path $TermDir 'lib.ps1')
    . (Join-Path $TermDir 'gate.ps1')
    . (Join-Path $TermDir 'hooks\worklines.ps1')
    . (Join-Path $TermDir 'hooks\brief.ps1')
    function C([string]$Login, [string]$Body) { return @{ user = @{ login = $Login }; body = $Body } }
}

Describe 'Test-TermDenySignal' {
    It 'a deny label stops the session' {
        (Test-TermDenySignal @{ labels = @(@{ name = 'Deny' }) } @() 'owner')['deny'] | Should -BeTrue
    }
    It 'only the owner''s /deny counts' {
        (Test-TermDenySignal @{ labels = @() } @((C 'stranger' '/deny')) 'owner')['deny'] | Should -BeFalse
        (Test-TermDenySignal @{ labels = @() } @((C 'OWNER' '/deny now')) 'owner')['deny'] | Should -BeTrue
    }
    It 'a mention of /deny inside a sentence is not a deny' {
        (Test-TermDenySignal @{ labels = @() } @((C 'owner' 'do not /deny yet')) 'owner')['deny'] | Should -BeFalse
    }
    It 'recognises the owner''s /allow (D6)' {
        $r = Test-TermDenySignal @{ labels = @() } @((C 'x' '/allow'), (C 'owner' '/allow')) 'owner'
        $r['allow'] | Should -BeTrue
        $r['deny'] | Should -BeFalse
    }
    It 'with no owner configured nothing counts' {
        (Test-TermDenySignal @{ labels = @() } @((C 'owner' '/deny')) '')['deny'] | Should -BeFalse
    }
}

Describe 'Format-TermAccessBody' {
    BeforeAll {
        $F = @{ utc = '2026-11-17 10:20:30Z'; local = '2026-11-17 11:20:30'; tz = 'Central Europe Standard Time'; computer = 'PC-1'
                user = 'DOM\anna'; os = 'Windows 11 Pro (build 26100)'; ipv4 = @('192.168.1.5', '10.0.0.2'); kit = 'E:\ServiceKit'
                folder = 'C:\work|x'; trusted = $false; version = '0.1.0'; publicIp = '' }
    }
    It 'lists every disclosed field and nothing else' {
        $b = Format-TermAccessBody $F
        foreach ($s in @('PC-1', 'DOM\anna', 'build 26100', '192.168.1.5, 10.0.0.2', 'E:\ServiceKit', 'ephemeral', 'ServiceKit Terminal 0.1.0', 'Central Europe')) { $b | Should -Match ([regex]::Escape($s)) }
        $b | Should -Not -Match 'Public IP'
    }
    It 'escapes table separators' { Format-TermAccessBody $F | Should -Match ([regex]::Escape('C:\work\|x')) }
    It 'shows the public IP only when it was looked up' {
        $F2 = $F.Clone(); $F2['publicIp'] = '203.0.113.9'
        Format-TermAccessBody $F2 | Should -Match '203\.0\.113\.9'
    }
    It 'title is Access <PC> <UTC minute>' { Format-TermAccessTitle $F | Should -Be 'Access PC-1 2026-11-17 10:20Z' }
}

Describe 'Get-TermWipeTargets' {
    It 'covers the Claude credentials, the whole gh dir and the generated files' {
        $t = Get-TermWipeTargets @{ claude = 'K\data\claude'; gh = 'K\data\gh' }
        ($t -join '|') | Should -Match 'credentials\.json'
        ($t -join '|') | Should -Match '\.claude\.json'
        $t | Should -Contain $TermBriefQueue
        $t | Should -Contain 'K\data\gh'
        $t | Should -Contain $TermLaunchFile
    }
}

Describe 'New-TermLaunchFile' {
    It 'gives Claude no GitHub token or gh config, and ephemeral git keeps no credentials' {
        $f = New-TermLaunchFile @{ claude = 'K\data\claude'; gh = 'K\data\gh-SECRETDIR'; trusted = $false } 'C:\work' 'C:\kit\claude.exe' @{ extraCaCerts = '' }
        $t = [IO.File]::ReadAllText($f)
        $t | Should -Not -Match 'gh-SECRETDIR'
        $t | Should -Match 'set "GH_TOKEN="'
        $t | Should -Match 'GIT_CONFIG_KEY_0=credential.helper'
        $t | Should -Match 'call "C:\\kit\\claude.exe"'
        $t | Should -Match "`r`n"
        Remove-Item -LiteralPath $f -Force
    }
}

Describe 'worklines hook' {
    It 'sanitizes like Claude Code' { Get-TermSanitizedName 'H:\VRG\Full' | Should -Be 'H--VRG-Full' }
    It 'matches the same folder and parents only' {
        Test-TermProjectMatch 'H--VRG-Full' 'H--VRG-Full' | Should -BeTrue
        Test-TermProjectMatch 'H--VRG' 'H--VRG-Full' | Should -BeTrue
        Test-TermProjectMatch 'H--' 'H--VRG-Full' | Should -BeTrue
        Test-TermProjectMatch 'H--VR' 'H--VRG-Full' | Should -BeFalse
        Test-TermProjectMatch 'H--VRG-Full-x' 'H--VRG-Full' | Should -BeFalse
    }
    It 'says nothing when nothing fired, and asks for a worktree when something did' {
        Get-TermWorklinesOutput @() @() | Should -BeNullOrEmpty
        $o = Get-TermWorklinesOutput @('a.txt') @()
        $o['hookSpecificOutput']['hookEventName'] | Should -Be 'SessionStart'
        $o['hookSpecificOutput']['additionalContext'] | Should -Match 'worktree'
        $o['systemMessage'] | Should -Match 'Worklines'
    }
    It 'flags a recent uncommitted file in a main checkout, and is silent in a linked worktree' -Skip:(-not (Get-Command git -ErrorAction SilentlyContinue)) {
        $r = Join-Path $TestDrive 'repo'; New-Item -ItemType Directory -Path $r | Out-Null
        & git -C $r init -q; & git -C $r -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
        Set-Content -LiteralPath (Join-Path $r 'new.txt') -Value 'x'
        $f = Get-TermWorklinesFindings $r 'sid' @() (Get-Date)
        $f['applies'] | Should -BeTrue
        $f['recent'] | Should -Contain 'new.txt'
        $w = Join-Path $TestDrive 'wt'
        & git -C $r worktree add -q $w -b wt/t HEAD
        (Get-TermWorklinesFindings $w 'sid' @() (Get-Date))['applies'] | Should -BeFalse
    }
}

Describe 'brief hook' {
    It 'is due at session end, and on Stop only after the interval' {
        $now = [datetime]'2026-11-17T12:00:00Z'
        Test-TermBriefDue 'SessionEnd' '2026-11-17T11:59:00Z' $now 30 | Should -BeTrue
        Test-TermBriefDue 'Stop' '2026-11-17T11:45:00Z' $now 30 | Should -BeFalse
        Test-TermBriefDue 'Stop' '2026-11-17T11:00:00Z' $now 30 | Should -BeTrue
    }
    It 'puts commit subjects in a code block and never file contents' {
        $t = Get-TermBriefText 'Stop' @{ repo = 'C:\r'; branch = 'wt/x'; worktree = ''; commits = @('abc123 ping @someone'); diffstat = ' 1 file changed, 2 insertions(+)'; uncommitted = 3 } '2026-11-17 12:00Z'
        $t | Should -Match '```'
        $t | Should -Match 'Commits since start: 1'
        $t | Should -Match 'Uncommitted files: 3'
        $t | Should -Match 'Worktree: `-`'
    }
    It 'reads commits since the start head from a real repo' -Skip:(-not (Get-Command git -ErrorAction SilentlyContinue)) {
        $r = Join-Path $TestDrive 'brief'; New-Item -ItemType Directory -Path $r | Out-Null
        & git -C $r init -q; & git -C $r -c user.email=t@t -c user.name=t commit -q --allow-empty -m one
        $start = (& git -C $r rev-parse HEAD).Trim()
        Set-Content -LiteralPath (Join-Path $r 'f.txt') -Value 'secret content'
        & git -C $r add f.txt; & git -C $r -c user.email=t@t -c user.name=t commit -q -m two
        Set-Content -LiteralPath (Join-Path $r 'g.txt') -Value 'x'
        $i = Get-TermBriefInfo $r $start '2026-01-01T00:00:00Z'
        @($i['commits']).Count | Should -Be 1
        $i['uncommitted'] | Should -Be 1
        $i['diffstat'] | Should -Match '1 file changed'
        (Get-TermBriefText 'SessionEnd' $i 'now') | Should -Not -Match 'secret content'
    }
}
