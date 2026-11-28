# ---------------------------------------------------------------------------
# selftest.ps1 - VRG Containment, offline. Starts no VM and downloads nothing.
# Runs the real functions against a throwaway kit in %TEMP%\VRG and checks the
# .wsb files and QEMU command lines they produce.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File Containment\test\selftest.ps1
#
# Exit 1 on any failure. ASCII only.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $PSScriptRoot
. (Join-Path $here 'core\contain-lib.ps1')

$fails = 0
function Check([bool]$ok, [string]$what) {
    if ($ok) { Write-Host ('  ok    ' + $what) } else { Write-Host ('  FAIL  ' + $what) -ForegroundColor Red; $script:fails++ }
}

$tmp = Join-Path $env:TEMP ('VRG\containment-selftest-' + (Get-Date -Format 'yyyyMMddHHmmss'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $here 'profiles.json') -Destination $tmp
Copy-Item -LiteralPath (Join-Path $here 'sources.json') -Destination $tmp
Set-KitRoot $tmp

Write-Host 'formats'
$cfg = Get-Profiles
Check ($cfg.profiles.Count -ge 1) 'profiles.json reads'
Check ([bool](Read-Format $script:SourcesFile 'vrg-containment-sources')) 'sources.json reads'
$bad = Join-Path $tmp 'bad.json'; Write-TextFile $bad '{ "format": "something-else", "version": 1 }'
$threw = $false; try { Read-Format $bad 'vrg-containment-profiles' | Out-Null } catch { $threw = $true }
Check $threw 'a stranger format is refused'
$threw = $false; try { Get-Box 'no-such-box' | Out-Null } catch { $threw = $true }
Check $threw 'an unknown profile is refused'

Write-Host 'arguments'
Check ((Join-Args @('a', 'b c', 'd"e')) -eq 'a "b c" "d\"e"') 'Join-Args quotes spaces and quotes'
Check ((Join-Args @('C:\with space\')) -eq '"C:\with space\\"') 'Join-Args doubles a trailing backslash'

Write-Host 'Windows Sandbox config, every profile'
$weird = Join-Path $tmp 'R&D <x> folder'
New-Item -ItemType Directory -Path $weird -Force | Out-Null
$file = Join-Path $weird 'client offer.docx'; Write-TextFile $file 'x'
foreach ($p in @($cfg.profiles)) {
    $wsb = Start-SandboxMode $p.id $file $false $true
    [xml]$x = Read-TextFile $wsb
    $c = $x.Configuration
    Check ($c.Networking -eq (EnDis (Get-Flag $p 'network' $false))) ($p.id + ': networking follows the profile')
    Check ($c.ClipboardRedirection -eq (EnDis (Get-Flag $p 'clipboard' $false))) ($p.id + ': clipboard follows the profile')
    Check ($c.ProtectedClient -eq (EnDis (-not (Get-Flag $p 'clipboard' $false)))) ($p.id + ': protected client unless the clipboard is on')
    Check ([int]$c.MemoryInMB -ge 2048) ($p.id + ': memory at least 2 GB')
    $maps = @($c.MappedFolders.MappedFolder)
    $in = @($maps | Where-Object { $_.SandboxFolder -eq $GuestInbox })
    $out = @($maps | Where-Object { $_.SandboxFolder -eq $GuestOutbox })
    if (Get-Flag $p 'inbox' $true) {
        Check ($in.Count -eq 1 -and $in[0].ReadOnly -eq 'true') ($p.id + ': inbox mapped read-only')
        Check ($in.Count -eq 1 -and $in[0].HostFolder.StartsWith($script:Inbox)) ($p.id + ': only the staged copy is mapped, not the original folder')
        Check (Test-Path -LiteralPath (Join-Path $in[0].HostFolder 'client offer.docx')) ($p.id + ': the file was copied in')
        Check ($c.LogonCommand.Command -like '*client offer.docx*') ($p.id + ': explorer opens on the file')
    } else {
        Check ($in.Count -eq 0) ($p.id + ': no inbox')
    }
    if (Get-Flag $p 'outbox' $true) { Check ($out.Count -eq 1 -and $out[0].ReadOnly -eq 'false') ($p.id + ': outbox writable') }
}
$q = Get-Box 'quarantine'
$x2 = [xml](New-WsbConfig $q $weird '' '' $false 4096)
Check ($x2.Configuration.MappedFolders.MappedFolder.HostFolder -eq $weird) 'a path with & and < survives the XML'

Write-Host 'stick VM command line'
$iso = Join-Path $tmp 'guest, test.iso'
$qa = Get-QemuArgs $q $iso '' $weird 4096
$line = Join-Args $qa
Check ($qa -contains 'none') 'quarantine: -nic none'
Check ($line -like '*whpx*' -and $line -like '*tcg*') 'WHPX first, TCG fallback'
Check ($line -like '*guest,, test.iso*') 'a comma in a path is doubled'
Check ($line -like '*readonly=on,file=fat:16:*') 'inbox is a read-only FAT drive'
$qb = Get-QemuArgs (Get-Box 'browse') $iso '' '' 4096
Check ((Join-Args $qb) -like '*-nic user,model=virtio-net-pci*') 'browse: user-mode network'
Check (-not ((Join-Args $qb) -like '*fat:*')) 'browse: no inbox drive'
$qd = Join-Args (Get-QemuArgs $q '' 'D:\img\win.vhdx' '' 4096)
Check ($qd -like '*snapshot=on*' -and $qd -like '*order=c*') 'own disk image: snapshot, boots from disk'
$line2 = Start-StickMode 'quarantine' $file '' $true
Check ($line2 -like '*fat:16:*') 'dry run of stick mode builds a command line'

Write-Host 'launchers'
foreach ($n in @('CONTAIN.cmd', 'SANDBOX.cmd', 'STICK.cmd')) {
    $b = [IO.File]::ReadAllBytes((Join-Path $here $n))
    $lf = 0; $crlf = 0
    for ($i = 0; $i -lt $b.Length; $i++) { if ($b[$i] -eq 10) { $lf++; if ($i -gt 0 -and $b[$i - 1] -eq 13) { $crlf++ } } }
    Check ($lf -gt 0 -and $lf -eq $crlf) ($n + ' has CRLF line endings')
}

Remove-Item -LiteralPath $tmp -Recurse -Force
Write-Host ''
if ($fails -gt 0) { Write-Host ('' + $fails + ' check(s) failed.') -ForegroundColor Red; exit 1 }
Write-Host 'All checks passed.' -ForegroundColor Green
exit 0
