<#
  Offline self-test for vrg-ui.ps1: renders the START main screen and every screen behind it (plain and
  coloured, no git, no port probes) and checks their geometry and that every item is on its screen once.
  Exit 1 on any failure.
    powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\selftest.ps1
#>
$ErrorActionPreference = 'Stop'
$ui = Join-Path (Split-Path $PSScriptRoot -Parent) 'vrg-ui.ps1'
$reg = Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'vrg-menu.json') -Raw -Encoding UTF8 | ConvertFrom-Json
[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
$fail = 0
function Check($ok, $what) { if ($ok) { Write-Output "  ok    $what" } else { Write-Output "  HIBA  $what"; $script:fail++ } }
$rx = [regex]"$([char]27)\[[0-9;]*m"

# One screen: same width on every line (also with colour codes stripped), both cut corners, every item once
# as " <key> <name>", no key twice. $items = what the screen must show.
function Screen($label, $screenArgs, $items) {
  Write-Output "-- $label"
  $plain = @(& powershell -NoProfile -ExecutionPolicy Bypass -File $ui -Render -Plain -Offline @screenArgs)
  $color = @(& powershell -NoProfile -ExecutionPolicy Bypass -File $ui -Render -Offline @screenArgs)
  $widths = @($plain | ForEach-Object { $_.Length } | Sort-Object -Unique)
  Check ($plain.Count -gt 5 -and $widths.Count -eq 1 -and $widths[0] -le 80) "$($plain.Count) sor, mind $($widths -join '/') szeles (<= 80)"
  $cw = @($color | ForEach-Object { $rx.Replace($_, '').Length } | Sort-Object -Unique)
  Check ($color.Count -eq $plain.Count -and $cw.Count -eq 1 -and $cw[0] -eq $widths[0]) "a szines valtozat ugyanolyan szeles"
  Check ($plain[0][0] -eq [char]0x2571 -and $plain[-1][-1] -eq [char]0x2571) "ket levagott sarok"
  $dupes = @($items | ForEach-Object { [string]$_.key } | Group-Object | Where-Object Count -gt 1 | ForEach-Object Name)
  Check (-not $dupes) "nincs ketszer hasznalt billentyu $(if ($dupes) { '(' + ($dupes -join ' ') + ')' })"
  $text = $plain -join "`n"
  $missing = @($items | Where-Object { ([regex]::Matches($text, [regex]::Escape(" $($_.key) $($_.name)"))).Count -ne 1 } | ForEach-Object { "$($_.key) $($_.name)" })
  Check (-not $missing) "minden elem pontosan egyszer ($(@($items).Count)) $(if ($missing) { ': ' + ($missing -join ', ') })"
  $script:lastText = $text
}

$s = $reg.start
$main = @($s.tools) + @($s.projects) + @($s.dev) + @($s.bottom)
Screen 'fokepernyo' @() $main
Check ($script:lastText.Contains($s.title)) "a cim latszik"

$back = [pscustomobject]@{ key = 'X'; name = $reg.ui.back }
foreach ($it in $main) {
  if ($it.menu)     { Screen "$($it.key) $($it.name)" @('-Screen', $it.key) (@($it.menu.items) + $back) }
  if ($it.servers)  { Screen "$($it.key) $($it.name)" @('-Screen', $it.key) (@($reg.servers) + $back) }
  if ($it.programs) { Screen "$($it.key) $($it.name)" @('-Screen', $it.key) (@($reg.programs) + $back) }
  if ($it.prompts)  { Screen "$($it.key) $($it.name)" @('-Screen', $it.key) @($back) }
  if ($it.extras)   { Screen "$($it.key) $($it.name) (bongeszovalaszto)" @('-Screen', $it.key) (@($reg.browsers) + @($it.extras)) }
  if ($it.action -eq 'commit') {
    $i = 0; $repos = @($reg.repos | ForEach-Object { $i++; [pscustomobject]@{ key = [string]$i; name = $_.name } })
    Screen "$($it.key) $($it.name)" @('-Screen', $it.key) ($repos + [pscustomobject]@{ key = 'A'; name = $reg.ui.commitAll } + $back)
    Check ($script:lastText.Contains('conf/.env')) "a megallito fajl latszik"
  }
  if ($it.action -eq 'quit') {
    Screen "$($it.key) kilepes elott" @('-Screen', $it.key) @(
      [pscustomobject]@{ key = 'C'; name = $reg.ui.guardCommit }, [pscustomobject]@{ key = 'L'; name = $reg.ui.guardLeave },
      [pscustomobject]@{ key = 'B'; name = $reg.ui.guardBack })
  }
}
foreach ($m in 'backup', 'otg') {
  Screen "$m fokepernyo" @('-Menu', $m) (@($reg.$m.items) + @($reg.$m.bottom))
  Check ($script:lastText.Contains($reg.$m.title)) "a(z) $m cime latszik"
}
if ($fail) { Write-Output "$fail hiba."; exit 1 }
Write-Output 'Rendben.'
