<#
  vrg-ui.ps1 - the VRG launchers' screens and key loop, in the Melyviz style (docs/city/melyviz.md) drawn
  as an 8-bit terminal: ground #0a141c, ice = keys / you, copper = activity, hairlines, two cut corners.

    powershell -NoProfile -File vrg-ui.ps1 -Menu start                  # interactive (what START.cmd runs)
    powershell -NoProfile -File vrg-ui.ps1 -Render [-Screen P] [-Plain]  # print one screen and exit (self-test)

  Everything shown comes from vrg-menu.json next to this file; Hungarian text lives there (UTF-8), so this
  file stays ASCII: Windows PowerShell 5.1 misreads accents in BOM-less scripts.
  Paths in the registry: {repo} = the repository, {full} = its parent (H:\VRG\Full), {vrg} = one above,
  the shortcuts in the registry's "paths", and {branch} = the repository's current branch.
#>
param(
  [string]$Menu = 'start',
  [switch]$Render,        # one screen to stdout, no input, no screen clearing
  [string]$Screen = '',   # with -Render: the key of a main-screen item whose screen to print ('' = the main screen)
  [switch]$Plain,         # with -Render: no colour codes (for width checks)
  [Alias('NoGit')]
  [switch]$Offline,       # no git and no port probes (deterministic test output)
  [string]$Registry = (Join-Path $PSScriptRoot 'vrg-menu.json'),
  [string]$Keys           # test only (test\git-e2e.ps1): the keys to press, in order, {enter} {esc} {bs}; used up = exit 1
)
$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------------ registry + paths
$Repo = Split-Path $PSScriptRoot -Parent
$Full = Split-Path $Repo -Parent
$Vrg  = Split-Path $Full -Parent
$R  = Get-Content -LiteralPath $Registry -Raw -Encoding UTF8 | ConvertFrom-Json
$UI = $R.ui
$M  = $R.$Menu
if (-not $M) { throw "No menu '$Menu' in $Registry" }
$PathTok = [ordered]@{}; if ($R.paths) { foreach ($p in $R.paths.PSObject.Properties) { $PathTok[$p.Name] = $p.Value } }
$script:BranchName = $null
function P([string]$s) {
  if (-not $s) { return $s }
  for ($i = 0; $i -lt 3 -and $s.Contains('{'); $i++) { foreach ($k in $PathTok.Keys) { $s = $s.Replace('{' + $k + '}', $PathTok[$k]) } }
  $s = $s.Replace('{repo}', $Repo).Replace('{full}', $Full).Replace('{vrg}', $Vrg)
  if ($s.Contains('{branch}')) { $s = $s.Replace('{branch}', (Branch)) }
  $s
}
# A clone without the portable toolchain next to it (a colleague's PC) uses the programs on PATH instead.
foreach ($k in 'node', 'npm', 'claude', 'git') {
  if (-not $PathTok.Contains($k) -or (Test-Path -LiteralPath (P $PathTok[$k]))) { continue }
  $c = Get-Command (Split-Path $PathTok[$k] -Leaf) -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { $PathTok[$k] = $c.Source }
}
function T([string]$s, [hashtable]$v) { foreach ($k in $v.Keys) { $s = $s.Replace('{' + $k + '}', [string]$v[$k]) }; $s }

# Native programs write to stderr freely; with 'Stop' PowerShell 5.1 would turn that into an exception.
$GitExe = P '{git}'; if (-not $GitExe -or -not (Test-Path $GitExe)) { $GitExe = 'git' }
function GitOut { $ErrorActionPreference = 'Continue'; & $GitExe @args 2>$null }
. (Join-Path $PSScriptRoot 'vrg-git.ps1')        # change tracker + commit flow (Vg* functions)
. (Join-Path $PSScriptRoot 'backup.ps1')         # BACKUP menu work (Bk* functions)
function Branch {
  if (-not $script:BranchName) { $script:BranchName = $(if ($Offline) { 'main' } else { [string](GitOut -C $Repo rev-parse --abbrev-ref HEAD) }) }
  $script:BranchName
}

# ------------------------------------------------------------------ colour + glyphs
$E = [char]27
$Tok = @{ bg = '0a141c'; text = 'e8f0f6'; dim = 'a6afb7'; faint = '646d74'; line = '3a4a55'
          ice = '93d3e6'; copper = 'e8a873'; ok = '8bcca1'; warn = 'e3be7b'; crit = 'e4877d' }
function Rgb($hex) { '{0};{1};{2}' -f [Convert]::ToInt32($hex.Substring(0, 2), 16), [Convert]::ToInt32($hex.Substring(2, 2), 16), [Convert]::ToInt32($hex.Substring(4, 2), 16) }
$BG = "$E[48;2;$(Rgb $Tok.bg)m"
function Paint($text, $fg, $back) {             # (names differ from $Tok: PowerShell variables ignore case)
  if ($Plain) { return $text }
  $s = "$E[38;2;$(Rgb $Tok[$fg])m"
  if ($back) { $s += "$E[48;2;$(Rgb $Tok[$back])m" }
  $s + $text + $(if ($back) { $BG } else { '' })
}
$G = @{ h = [string][char]0x2500; v = [string][char]0x2502; cut = [string][char]0x2571; tr = [string][char]0x2510; bl = [string][char]0x2514
        lt = [string][char]0x251C; rt = [string][char]0x2524; td = [string][char]0x252C; tu = [string][char]0x2534; cross = [string][char]0x253C
        up = [string][char]0x2580; dn = [string][char]0x2584; bar = [string][char]0x258C; dot = [string][char]0x00B7; arrow = [string][char]0x203A
        ell = [string][char]0x2026; mid = [string][char]0x25CF; x = [string][char]0x00D7 }
$AnsiRx = [regex]"$E\[[0-9;]*m"
function Vis($s) { $AnsiRx.Replace($s, '').Length }
function Fit($s, $w) {                          # pad or cut a painted string to $w visible columns
  $n = Vis $s
  if ($n -le $w) { return $s + (' ' * ($w - $n)) }
  $plain = $AnsiRx.Replace($s, '')
  (Paint ($plain.Substring(0, $w - 1) + $G.ell) 'dim')
}
function Wrap($text, $w) {                      # plain text into lines of at most $w columns
  $line = ''
  foreach ($word in ($text -split '\s+')) {
    if ($line -and ($line.Length + 1 + $word.Length) -gt $w) { $line; $line = $word } else { $line = $(if ($line) { "$line $word" } else { $word }) }
  }
  if ($line) { $line }
}

$W = 78                                         # inner width; with the two side lines a frame is 80 columns
$LW = 30; $RW = $W - $LW - 1                    # the two columns of the START screen
function Row($inner) { (Paint $G.v 'line') + (Fit $inner $W) + (Paint $G.v 'line') }
function Rule($title, $en, $left = $G.lt, $right = $G.rt) {
  $head = $(if ($title) { (Paint ($G.h + ' ') 'line') + (Paint $title 'dim') + $(if ($en) { ' ' + (Paint $en 'faint') } else { '' }) + ' ' } else { '' })
  (Paint $left 'line') + $head + (Paint ($G.h * ($W - (Vis $head))) 'line') + (Paint $right 'line')
}
function Top($title)    { Rule $title '' $G.cut $G.tr }
function Bottom($title) { Rule $title '' $G.bl $G.cut }
function Key($k, $accent) { if ($accent -and -not $Plain) { "$E[38;2;$(Rgb $Tok.bg)m$E[48;2;$(Rgb $Tok.ice)m$k$BG" } else { Paint $k 'ice' } }
function Ok($s) { Paint $s 'ok' }; function Warn($s) { Paint $s 'warn' }; function Crit($s) { Paint $s 'crit' }

# ------------------------------------------------------------------ the Varler bulb, 8-bit (no text)
$Bulb = @('....III....', '..II...II..', '.I.....G.I.', 'I.....GG..I', 'I...G.GG..I', 'I..GGGG...I',
          'I..GGG....I', '.I..G....I.', '..I.G...I..', '...I...I...', '...CCCCC...', '....CCC....')
$BulbTok = @{ I = 'ice'; G = 'ok'; C = 'copper' }
function BulbRows {
  for ($r = 0; $r -lt $Bulb.Count; $r += 2) {
    $s = ''
    for ($x = 0; $x -lt 11; $x++) {
      $a = $BulbTok[[string]$Bulb[$r][$x]]; $b = $BulbTok[[string]$Bulb[$r + 1][$x]]
      if ($Plain) { $s += $(if ($a -and $b) { [char]0x2588 } elseif ($a) { $G.up } elseif ($b) { $G.dn } else { ' ' }) }
      elseif ($a -and $b) { $s += Paint $G.up $a $b }
      elseif ($a) { $s += Paint $G.up $a }
      elseif ($b) { $s += Paint $G.dn $b }
      else { $s += ' ' }
    }
    $s
  }
}

# ------------------------------------------------------------------ change tracker (vrg-git.ps1)
# One state per work repo in the registry. Offline: a fixed sample (one repo with work and a blocked file,
# one clean), so the self-test draws the commit and exit screens without git.
function States([switch]$Scan) {
  if ($Offline) {
    $a = [pscustomobject]@{ name = $R.repos[0].name; path = P $R.repos[0].path; git = $true; branch = 'main'; ahead = 2; origin = $true
                            counts = @{ M = 3; A = 1; D = 0; R = 0 }; changes = @(1, 2, 3, 4); dirty = $true
                            blocked = @([pscustomobject]@{ path = 'conf/.env'; why = 'name'; size = 0 }) }
    $rest = @($R.repos | Select-Object -Skip 1 | ForEach-Object {
      [pscustomobject]@{ name = $_.name; path = P $_.path; git = $true; branch = 'main'; ahead = 0; origin = $true
                         counts = @{ M = 0; A = 0; D = 0; R = 0 }; changes = @(); dirty = $false; blocked = @() } })
    return @($a) + $rest
  }
  foreach ($r in $R.repos) {
    $s = VgState (P $r.path) $r.name
    $s | Add-Member -NotePropertyName blocked -NotePropertyValue $(if ($Scan -and $s.git) { VgBlocked $s.path $s.changes } else { @() })
    $s
  }
}
function StatusLine($states) {
  $parts = foreach ($s in $states) {
    if (-not $s.git) { Paint "$($s.name) $($UI.nogit)" 'faint'; continue }
    if (-not $s.dirty) { Paint "$($s.name) $($UI.clean)" 'ok'; continue }
    $bits = @(); if ($s.changes.Count) { $bits += "$($s.changes.Count) $($UI.files)" }; if ($s.ahead) { $bits += "$($s.ahead) $($UI.unpushed)" }
    Paint "$($s.name) $($bits -join ', ')" 'copper'
  }
  (Paint $G.bar 'copper') + ' ' + (Paint $UI.changes 'dim') + '  ' + ($parts -join (Paint " $($G.dot) " 'faint'))
}
function Counts($s) {                             # "main · 145 mod. · 14 uj · 13 feltoltetlen"
  $bits = @($s.branch)
  foreach ($k in 'M', 'A', 'D', 'R') { if ($s.counts[$k]) { $bits += "$($s.counts[$k]) $($UI.count.$k)" } }
  if ($s.ahead) { $bits += "$($s.ahead) $($UI.unpushed)" }
  $bits -join " $($G.dot) "
}
function Why($b) {
  if ($b.why -eq 'large') { return T $UI.whyLarge @{ mb = ('{0:0.0}' -f ($b.size / 1MB)) } }
  if ($b.why -eq 'content') { return $UI.whyContent }
  $UI.whyName
}
function RepoItems($states) {
  $i = 0
  foreach ($s in $states) { $i++; [pscustomobject]@{ key = [string]$i; name = $s.name; hint = $(if ($s.git) { Counts $s }); state = $s } }
}
function RepoTag($s) {
  if (-not $s.git) { return Paint $UI.nogit 'faint' }
  if ($s.blocked.Count) { return Crit (T $UI.blockedTag @{ n = $s.blocked.Count }) }
  if ($s.dirty) { return Paint $UI.ready 'copper' }
  Paint $UI.clean 'ok'
}
# The repos, what each would send, and below a repo the files that stop it.
function CommitScreen($states, $msg) {
  $lines = @()
  $lines += Top $UI.commitTitle
  $lines += Row (' ' + (Paint (T $UI.commitTarget @{ collect = $VgCollect; date = (Get-Date -Format 'yyyy-MM-dd') }) 'faint'))
  foreach ($l in Wrap $UI.commitNote ($W - 2)) { $lines += Row (' ' + (Paint $l 'dim')) }
  $lines += Rule '' ''
  foreach ($it in RepoItems $states) {
    $lines += Row ((Item $it ($W - $TagW - 1)) + ' ' + (Fit (RepoTag $it.state) $TagW))
    $bl = @($it.state.blocked)
    foreach ($b in $bl | Select-Object -First 6) { $lines += Row ('     ' + (Crit $G.x) + ' ' + (Paint $b.path 'text') + '  ' + (Paint (Why $b) 'warn')) }
    if ($bl.Count -gt 6) { $lines += Row ('     ' + (Paint (T $UI.andMore @{ n = $bl.Count - 6 }) 'faint')) }
  }
  $lines += Rule '' ''
  $lines += Row ((@([pscustomobject]@{ key = 'A'; name = $UI.commitAll; accent = $true }, $BackItem) | ForEach-Object { (Item $_ 30).TrimEnd() + '   ' }) -join '')
  $lines += Row $(if ($msg) { ' ' + $msg } else { '' })
  $lines += Bottom ''
  $lines
}
$GuardItems = @(
  [pscustomobject]@{ key = 'C'; name = $null; accent = $true }, [pscustomobject]@{ key = 'L'; name = $null }, [pscustomobject]@{ key = 'B'; name = $null; hint = 'Esc' })
function GuardScreen($states) {
  $GuardItems[0].name = $UI.guardCommit; $GuardItems[1].name = $UI.guardLeave; $GuardItems[2].name = $UI.guardBack
  $lines = @()
  $lines += Top $UI.guardTitle
  $lines += Row (' ' + (Paint $UI.guardNote 'dim'))
  $lines += Rule '' ''
  foreach ($s in $states | Where-Object { $_.dirty }) { $lines += Row ('  ' + (Paint $G.mid 'copper') + ' ' + (Paint $s.name 'text') + '  ' + (Paint (Counts $s) 'faint')) }
  $lines += Rule '' ''
  foreach ($it in $GuardItems) { $lines += Row (Item $it $W) }
  $lines += Bottom ''
  $lines
}

# ------------------------------------------------------------------ servers and availability
function Server($id) { $R.servers | Where-Object { $_.id -eq $id } | Select-Object -First 1 }
function Up($port) {
  if ($Offline) { return $false }
  $c = New-Object Net.Sockets.TcpClient
  try { $null = $c.ConnectAsync('127.0.0.1', [int]$port).Wait(250); $c.Connected } catch { $false } finally { $c.Close() }
}
function Needs($it) {                            # the file an item cannot work without ('' = nothing to check)
  if ($it.needs) { return P $it.needs }
  if ($it.exe -and $it.exe -notmatch '^(cmd|powershell|explorer)\.exe$') { return P $it.exe }
  ''
}
function Tag($it) {
  $n = Needs $it
  if ($n -and -not (Test-Path -LiteralPath $n)) { return Paint $UI.notInstalled 'faint' }
  if ($it.port -or $it.server) {
    $s = $(if ($it.port) { $it } else { Server $it.server })
    if ($Offline) { return '' }
    if (Up $s.port) { return Paint $UI.up 'copper' } else { return Paint $UI.down 'faint' }
  }
  ''
}

# ------------------------------------------------------------------ screens
function Header {
  $titles = @((Paint $M.title 'ice'), (Paint $M.subtitle 'dim'), (Paint $Vrg 'faint'), (Paint (Get-Date -Format 'yyyy-MM-dd HH:mm') 'faint'), '', '')
  $i = 0
  foreach ($b in BulbRows) { Row ('  ' + $b + '   ' + $titles[$i]); $i++ }
}
function Item($it, $w) {
  $s = ' ' + (Key $it.key $it.accent) + ' ' + (Paint $it.name 'text')
  $hint = $(if ($it.hint) { P $it.hint } elseif ($it.port) { "localhost:$($it.port)" })
  if ($hint -and (Vis $s) + 2 + $hint.Length -le $w) { $s += '  ' + (Paint $hint 'faint') }   # a hint that does not fit is dropped, not cut
  Fit $s $w
}
function StartScreen($msg, $states) {
  if (-not $msg -and @($states | Where-Object { $_.dirty }).Count) { $msg = Paint $UI.closeLocked 'faint' }
  $lines = @()
  $lines += Top ''
  $lines += Header
  $lines += Row (' ' + (StatusLine $states))
  # column rule: left title, then a T down into the column split, then the right title
  $lh = (Paint ($G.h + ' ') 'line') + (Paint $UI.tools 'dim') + ' ' + (Paint $UI.toolsEn 'faint') + ' '
  $rh = (Paint ($G.h + ' ') 'line') + (Paint $UI.projects 'dim') + ' ' + (Paint $UI.projectsEn 'faint') + ' '
  $lines += (Paint $G.lt 'line') + $lh + (Paint ($G.h * ($LW - (Vis $lh))) 'line') + (Paint $G.td 'line') + $rh + (Paint ($G.h * ($RW - (Vis $rh))) 'line') + (Paint $G.rt 'line')
  $left = @($M.tools | ForEach-Object { Item $_ $LW })
  $right = @($M.projects | ForEach-Object { Fit ((Item $_ ($RW - 2)) + (Paint $G.arrow 'faint')) $RW })
  $dh = (Paint ($G.h + ' ') 'line') + (Paint $UI.dev 'dim') + ' ' + (Paint $UI.devEn 'faint') + ' '
  $right += '<rule>' + $dh + (Paint ($G.h * ($RW - (Vis $dh))) 'line')
  $dev = @($M.dev); $half = [Math]::Floor($RW / 2)
  for ($i = 0; $i -lt $dev.Count; $i += 2) { $right += (Item $dev[$i] $half) + $(if ($i + 1 -lt $dev.Count) { Item $dev[$i + 1] ($RW - $half) } else { ' ' * ($RW - $half) }) }
  $n = [Math]::Max($left.Count, $right.Count)
  for ($i = 0; $i -lt $n; $i++) {
    $l = $(if ($i -lt $left.Count) { $left[$i] } else { ' ' * $LW })
    $r = $(if ($i -lt $right.Count) { $right[$i] } else { ' ' * $RW })
    if ($r.StartsWith('<rule>')) { $lines += (Paint $G.v 'line') + $l + (Paint $G.lt 'line') + $r.Substring(6) + (Paint $G.rt 'line') }
    else { $lines += (Paint $G.v 'line') + $l + (Paint $G.v 'line') + $r + (Paint $G.v 'line') }
  }
  $lines += (Paint $G.lt 'line') + (Paint ($G.h * $LW) 'line') + (Paint $G.tu 'line') + (Paint ($G.h * $RW) 'line') + (Paint $G.rt 'line')
  $lines += Row (($M.bottom | ForEach-Object { (Item $_ 26).TrimEnd() + '   ' }) -join '')
  $lines += Row $(if ($msg) { ' ' + $msg } else { '' })
  $lines += Bottom ''
  $lines
}
# One screen for every submenu: title, where it works, an optional note, the items with a status column
# (FUT / nem fut / nincs telepitve), the fixed keys at the bottom, and the last message.
$TagW = 16
function ListScreen($title, $subtitle, $note, $items, $fixed, $msg) {
  $lines = @()
  $lines += Top $title
  if ($subtitle) { $lines += Row (' ' + (Paint (P $subtitle) 'faint')) }
  if ($note) { foreach ($l in Wrap $note ($W - 2)) { $lines += Row (' ' + (Paint $l 'dim')) } }
  $lines += Rule '' ''
  foreach ($it in $items) { $lines += Row ((Item $it ($W - $TagW - 1)) + ' ' + (Fit (Tag $it) $TagW)) }
  $lines += Rule '' ''
  $lines += Row ((@($fixed) | ForEach-Object { (Item $_ 30).TrimEnd() + '   ' }) -join '')
  $lines += Row $(if ($msg) { ' ' + $msg } else { '' })
  $lines += Bottom ''
  $lines
}
$BackItem = [pscustomobject]@{ key = 'X'; name = $UI.back; hint = 'Esc' }
function BrowserScreen($tool, $msg) {
  $items = @($R.browsers) + @([pscustomobject]@{ key = 'M'; name = $UI.folder }) + @($tool.extras)
  ListScreen $UI.browser $tool.path $tool.name ($items | Where-Object { $_ }) ([pscustomobject]@{ key = '0'; name = $UI.back; hint = 'Esc' }) $msg
}
function MenuScreen($menu, $msg) { ListScreen $menu.title $menu.subtitle $menu.note $menu.items $BackItem $msg }
function ProgramsMenu($it) { [pscustomobject]@{ title = $it.name.ToUpper(); subtitle = '{full}\tools  ' + $G.dot + '  {full}\programs'; items = $R.programs } }
function ServersScreen($msg) {
  ListScreen $UI.servers '' $UI.serversNote $R.servers @([pscustomobject]@{ key = 'A'; name = $UI.openAll }, $BackItem) $msg
}
function PromptItems($dir) {
  $i = 0
  foreach ($f in @(Get-ChildItem -LiteralPath $dir -Filter *.txt -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -First 9)) {
    $i++; [pscustomobject]@{ key = [string]$i; name = $f.BaseName; file = $f.FullName }
  }
}
function PromptsScreen($dir, $msg) { ListScreen $UI.prompts $dir $UI.promptsNote @(PromptItems $dir) $BackItem $msg }

function Show($lines) {
  if ($Render) { $lines | ForEach-Object { $_ }; return }
  [Console]::Write("$BG$E[2J$E[H" + (($lines | ForEach-Object { $_ + "$E[K" }) -join "`n") + "`n$E[K" + (Paint "$($G.arrow) " 'ice'))
}

# ------------------------------------------------------------------ one screen for the self-test
# START has the two-column screen, the change tracker and the exit guard; BACKUP and OTG are one list
# ("items") under the same header.
$UsesGit = -not $M.items
function ListMainScreen($msg) {
  $lines = @()
  $lines += Top ''
  $lines += Header
  if ($M.note) { $lines += Rule '' ''; foreach ($l in Wrap $M.note ($W - 2)) { $lines += Row (' ' + (Paint $l 'dim')) } }
  $lines += Rule '' ''
  foreach ($it in $M.items) { $lines += Row ((Item $it ($W - $TagW - 1)) + ' ' + (Fit (Tag $it) $TagW)) }
  $lines += Rule '' ''
  $lines += Row (($M.bottom | ForEach-Object { (Item $_ 26).TrimEnd() + '   ' }) -join '')
  $lines += Row $(if ($msg) { ' ' + $msg } else { '' })
  $lines += Bottom ''
  $lines
}
function MainScreen($msg, $states) { if ($UsesGit) { StartScreen $msg $states } else { ListMainScreen $msg } }
$Main = $(if ($UsesGit) { @($M.tools) + @($M.projects) + @($M.dev) + @($M.bottom) } else { @($M.items) + @($M.bottom) })
if ($Render) {
  if (-not $Screen) { return MainScreen '' $(if ($UsesGit) { States }) }
  $it = $Main | Where-Object { $_.key -eq $Screen } | Select-Object -First 1
  if (-not $it) { throw "No main-screen key '$Screen'" }
  if ($it.action -eq 'commit') { return CommitScreen (States -Scan) '' }
  if ($it.action -eq 'quit') { return GuardScreen (States) }
  if ($it.menu) { return MenuScreen $it.menu '' }
  if ($it.servers) { return ServersScreen '' }
  if ($it.programs) { return MenuScreen (ProgramsMenu $it) '' }
  if ($it.prompts) { return PromptsScreen (P $it.prompts) '' }
  if ($it.path) { return BrowserScreen $it '' }
  throw "Key '$Screen' has no screen of its own"
}

# ------------------------------------------------------------------ interactive
# Colour codes need virtual-terminal processing; the plain console has it off for PowerShell 5.1. The tiny
# switch is compiled once and cached, so later starts stay fast.
# VrgVt.Close greys the window's close button (X, Alt+F4, taskbar Close) while there is unpushed work, so
# leaving goes through Q and the exit guard. Only the classic console window has one; elsewhere a no-op.
$vtDll = Join-Path $env:LOCALAPPDATA 'VRG\vrg-console-2.dll'
if (-not ('VrgVt' -as [type])) {
  if (-not (Test-Path $vtDll)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $vtDll) | Out-Null
    Add-Type -OutputAssembly $vtDll -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class VrgVt {
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int h);
  [DllImport("kernel32.dll")] static extern bool GetConsoleMode(IntPtr h, out int m);
  [DllImport("kernel32.dll")] static extern bool SetConsoleMode(IntPtr h, int m);
  public static void On() { IntPtr h = GetStdHandle(-11); int m; if (GetConsoleMode(h, out m)) SetConsoleMode(h, m | 4); }
  [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] static extern IntPtr GetSystemMenu(IntPtr w, bool revert);
  [DllImport("user32.dll")] static extern int EnableMenuItem(IntPtr m, uint id, uint flags);
  public static void Close(bool enabled) {
    IntPtr w = GetConsoleWindow(); if (w == IntPtr.Zero) return;
    IntPtr m = GetSystemMenu(w, false); if (m == IntPtr.Zero) return;
    EnableMenuItem(m, 0xF060, enabled ? 0u : 1u);     // SC_CLOSE, MF_ENABLED / MF_GRAYED
  }
}
'@
  }
  Add-Type -Path $vtDll
}
[VrgVt]::On()
[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
$Host.UI.RawUI.WindowTitle = 'VRG ' + $Menu.ToUpper()
try { [Console]::CursorVisible = $false } catch { }   # no real console (redirected): keep going
# Whatever the launcher starts finds the portable Node and git first.
$env:PATH = (Split-Path (P '{node}')) + ';' + (Split-Path $GitExe) + ';' + $env:PATH

$KeyQ = $null
if ($PSBoundParameters.ContainsKey('Keys')) {
  $KeyQ = New-Object 'Collections.Generic.Queue[char]'
  foreach ($c in $Keys.Replace('{enter}', "`r").Replace('{esc}', [string][char]27).Replace('{bs}', [string][char]8).Replace('{ctrlc}', [string][char]3).ToCharArray()) { $KeyQ.Enqueue($c) }
}
function NextKey {                               # Ctrl+C comes in as a key (char 3) and goes to the exit guard
  if ($null -ne $KeyQ) {                         # (not "if ($KeyQ)": an empty queue is false in PowerShell)
    if (-not $KeyQ.Count) { throw 'test keys used up' }
    $c = $KeyQ.Dequeue()
    $k = switch ([int]$c) { 13 { [ConsoleKey]::Enter } 27 { [ConsoleKey]::Escape } 8 { [ConsoleKey]::Backspace } default { [ConsoleKey]::NoName } }
    return New-Object ConsoleKeyInfo $c, $k, $false, $false, $false
  }
  try { [Console]::TreatControlCAsInput = $true } catch { }
  try { [Console]::ReadKey($true) } finally { try { [Console]::TreatControlCAsInput = $false } catch { } }
}
function ReadKey { [string][char]::ToUpperInvariant((NextKey).KeyChar) }
function IsBack($k) { $k -eq 'X' -or $k -eq [string][char]27 }
function Q($a) { if ($a -match '\s' -and $a -notmatch '"') { '"' + $a + '"' } else { $a } }   # quote for a command line
function ArgList($list) { @(@($list) | Where-Object { $null -ne $_ } | ForEach-Object { Q (P $_) }) }

# Steps in this console (the output stays readable until a key), or with window:true in a console of their
# own, for long or interruptible jobs: Ctrl+C there cannot take the launcher down with it.
function RunSteps($it) {
  $cwd = $(if ($it.cwd) { P $it.cwd } else { $Repo })
  if ($it.window) {
    $dir = Join-Path $env:TEMP 'VRG'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $bat = Join-Path $dir ('run-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
    $body = @('@echo off', 'chcp 65001 >nul', "title VRG $($it.name)", "cd /d `"$cwd`"")
    foreach ($s in $it.steps) { $body += ('call ' + (Q (P $s.exe)) + ' ' + ((ArgList $s.args) -join ' ')).Replace('%', '%%') + ' || goto :fail' }
    $body += @('echo.', 'echo   Kesz.', 'goto :end', ':fail', 'echo.', 'echo   HIBA, a tovabbi lepesek elmaradtak.', ':end', 'echo.', 'pause')
    [IO.File]::WriteAllText($bat, ($body -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding $false))
    Start-Process -FilePath $bat
    $script:last = Paint (T $UI.window @{ name = $it.name }) 'ok'
    return $false                                  # nothing to follow up in this console
  }
  [Console]::Write("$BG$E[2J$E[H")
  [Console]::WriteLine((Top (T $UI.running @{ name = $it.name }).ToUpper()) + "$E[K")
  [Console]::WriteLine((Row (' ' + (Paint $cwd 'faint'))) + "$E[K")
  [Console]::WriteLine((Bottom '') + "$E[0m")
  try { [Console]::CursorVisible = $true } catch { }
  $code = 0
  Push-Location -LiteralPath $cwd
  try {
    foreach ($s in $it.steps) {
      $exe = P $s.exe; $a = @(@($s.args) | Where-Object { $null -ne $_ } | ForEach-Object { P $_ })
      try { $ErrorActionPreference = 'Continue'; & $exe @a; $code = $LASTEXITCODE } catch { Write-Host $_.Exception.Message; $code = -1 }
      finally { $ErrorActionPreference = 'Stop' }
      if ($code) { break }
    }
  } finally { Pop-Location }
  try { [Console]::CursorVisible = $false } catch { }
  $res = $(if ($code) { Crit (T $UI.failed @{ code = $code }) } else { Ok $UI.done })
  [Console]::WriteLine("`n$BG" + (Top '') + "$E[K")
  [Console]::WriteLine((Row (' ' + $res)) + "$E[K")
  [Console]::WriteLine((Row (' ' + (Paint $UI.anyKey 'dim'))) + "$E[K")
  [Console]::Write((Bottom '') + "$E[K")
  $null = [Console]::ReadKey($true)
  $script:last = $(if ($code) { Crit (T $UI.failed @{ code = $code }) } else { Ok (T $UI.doneName @{ name = $it.name }) })
  return -not $code
}

function StartServer($s, $extra) {
  $node = P '{node}'
  $cwd = $(if ($s.cwd) { P $s.cwd } else { $Repo })
  if ($s.bat) {
    $f = P $s.bat; if (-not (Test-Path -LiteralPath $f)) { return Crit (T $UI.missing @{ path = $f }) }
    Start-Process cmd.exe -ArgumentList "/c title VRG $($s.port) && call `"$f`"" -WorkingDirectory (Split-Path $f) -WindowStyle Minimized
  } else {
    $js = P $s.js; if (-not (Test-Path -LiteralPath $js)) { return Crit (T $UI.missing @{ path = $js }) }
    if (-not (Test-Path -LiteralPath $node)) { return Crit (T $UI.missing @{ path = $node }) }
    $line = "/c title VRG $($s.port) && `"$node`" `"$js`" " + ((ArgList (@($s.args) + @($extra))) -join ' ')
    Start-Process cmd.exe -ArgumentList $line -WorkingDirectory $cwd -WindowStyle Minimized
  }
  ''
}
function ServerUrl($s) { 'http://localhost:' + $s.port + $(if ($s.open) { $s.open } else { '/' }) }
function OpenServer($s) {
  if (Up $s.port) { Start-Process (ServerUrl $s); return Ok (T $UI.opened @{ name = $s.name }) }
  $err = StartServer $s @(); if ($err) { return $err }
  if ($s.self) { return Ok (T $UI.started @{ name = $s.name }) }   # its own launcher opens the browser
  for ($i = 0; $i -lt 20; $i++) {
    Show (ServersScreen (Paint (T $UI.starting @{ name = $s.name; port = $s.port }) 'copper'))
    Start-Sleep -Milliseconds 500
    if (Up $s.port) { Start-Process (ServerUrl $s); return Ok (T $UI.opened @{ name = $s.name }) }
  }
  Warn (T $UI.noAnswer @{ port = $s.port })
}

function StartExe($it) {
  $exe = P $it.exe; $need = Needs $it
  if ($need -and -not (Test-Path -LiteralPath $need)) { return Crit (T $UI.missing @{ path = $need }) }
  if ($it.ensure -and -not (Test-Path -LiteralPath (P $it.ensure.path))) {
    if (-not (RunSteps ([pscustomobject]@{ name = $it.ensure.note; steps = @($it.ensure) }))) { return $script:last }
  }
  if ($it.server) { $s = Server $it.server; if (-not (Up $s.port)) { $err = StartServer $s @($it.serverArgs); if ($err) { return $err } } }
  $sp = @{ FilePath = $exe }
  $a = ArgList $it.args; if ($a.Count) { $sp.ArgumentList = $a }
  $sp.WorkingDirectory = $(if ($it.cwd) { P $it.cwd } elseif ($exe -match '\\') { Split-Path $exe } else { $Repo })
  try { Start-Process @sp } catch { return Crit $_.Exception.Message }
  Ok (T $UI.started @{ name = $it.name })
}

# Zen and friends: each group becomes a window of its own, the first page opens it and the rest are tabs.
function Tabs($it) {
  $exe = P $it.exe; if (-not (Test-Path -LiteralPath $exe)) { return Crit (T $UI.missing @{ path = $exe }) }
  foreach ($g in $it.groups) {
    $pages = @($g | ForEach-Object { P $_ } | Where-Object { $_ -match '^https?:' -or (Test-Path -LiteralPath $_) })
    for ($i = 0; $i -lt $pages.Count; $i++) {
      Start-Process -FilePath $exe -ArgumentList @($(if ($i) { '-new-tab' } else { '-new-window' }), (Q $pages[$i]))
      if (-not $i) { Start-Sleep -Seconds 3 }      # the first window needs a moment, or the tabs get lost
    }
  }
  Ok (T $UI.opened @{ name = $it.name })
}

function OpenTool($tool) {
  $path = P $tool.path
  if (-not (Test-Path -LiteralPath $path)) { return Crit (T $UI.missing @{ path = $path }) }
  $msg = ''
  if ($tool.before) {
    Show (StartScreen (Paint $tool.before.note 'copper'))
    $exe = P $tool.before.exe; $a = @($tool.before.args | ForEach-Object { P $_ })
    $code = & { $ErrorActionPreference = 'Continue'; & $exe @a *> $null; $LASTEXITCODE }
    if ($code) { $msg = Warn (T $UI.beforeFailed @{ note = $tool.before.note.TrimEnd([char]0x2026) }) }
  }
  while ($true) {
    Show (BrowserScreen $tool $msg)
    $k = ReadKey
    if ($k -eq '0' -or (IsBack $k)) { return '' }
    if ($k -eq 'M') { Start-Process explorer.exe "/select,`"$path`""; return Ok (T $UI.opened @{ name = $UI.folder }) }
    $x = @($tool.extras) | Where-Object { $_ -and $_.key -eq $k } | Select-Object -First 1
    if ($x) { return Act $x }
    $b = $R.browsers | Where-Object { $_.key -eq $k } | Select-Object -First 1
    if (-not $b) { continue }
    if (-not $b.exe) { Start-Process -FilePath $path; return Ok (T $UI.opened @{ name = $tool.name }) }
    $exe = P $b.exe
    if (-not (Test-Path -LiteralPath $exe)) { $msg = Crit (T $UI.noBrowser @{ path = $exe }); continue }
    Start-Process -FilePath $exe -ArgumentList (@(ArgList $b.args) + (Q $path))
    return Ok (T $UI.opened @{ name = $tool.name })
  }
}

function SubMenu($menu) {
  $msg = ''
  while ($true) {
    Show (MenuScreen $menu $msg); $msg = ''
    $k = ReadKey; if (IsBack $k) { return '' }
    $it = $menu.items | Where-Object { $_.key -eq $k } | Select-Object -First 1
    if ($it) { $msg = Act $it }
  }
}
function ServersMenu {
  $msg = ''
  while ($true) {
    Show (ServersScreen $msg); $msg = ''
    $k = ReadKey; if (IsBack $k) { return '' }
    if ($k -eq 'A') {
      $n = 0; foreach ($s in $R.servers) { if (Up $s.port) { Start-Process (ServerUrl $s); $n++ } }
      $msg = Ok (T $UI.opened @{ name = $n }); continue
    }
    $s = $R.servers | Where-Object { $_.key -eq $k } | Select-Object -First 1
    if ($s) { $msg = OpenServer $s }
  }
}
function PromptsMenu($dir) {
  if (-not (Test-Path -LiteralPath $dir)) { return Crit (T $UI.noPrompts @{ path = $dir }) }
  $msg = ''
  while ($true) {
    Show (PromptsScreen $dir $msg); $msg = ''
    $k = ReadKey; if (IsBack $k) { return '' }
    $p = @(PromptItems $dir) | Where-Object { $_.key -eq $k } | Select-Object -First 1
    if (-not $p) { continue }
    $text = Get-Content -LiteralPath $p.file -Raw -Encoding UTF8
    Set-Clipboard -Value $text
    [Console]::Write("$BG$E[2J$E[H" + (Top $p.name.ToUpper()) + "$E[K`n$E[0m")
    [Console]::WriteLine($text)
    [Console]::Write("$BG" + (Row (' ' + (Ok $UI.copied) + '   ' + (Paint $UI.anyKey 'dim'))) + "$E[K`n" + (Bottom '') + "$E[K")
    $null = [Console]::ReadKey($true)
  }
}

# ------------------------------------------------------------------ commit + push, exit guard
# One line of text with a default: Enter takes it, Backspace edits, Esc cancels ($null).
function ReadLine($title, $label, $default) {
  $buf = $default
  while ($true) {
    $shown = $(if ($buf.Length -gt $W - 4) { $G.ell + $buf.Substring($buf.Length - ($W - 5)) } else { $buf })   # long text: its end
    Show @((Top $title), (Row (' ' + (Paint $label 'dim'))), (Row ''), (Row (' ' + (Paint $shown 'text') + (Paint '_' 'ice'))),
           (Row ''), (Row (' ' + (Paint $UI.lineKeys 'faint'))), (Bottom ''))
    $k = NextKey
    if ($k.Key -eq 'Enter') { return $(if ($buf.Trim()) { $buf.Trim() } else { $default }) }
    if ($k.Key -eq 'Escape') { return $null }
    if ($k.Key -eq 'Backspace') { if ($buf.Length) { $buf = $buf.Substring(0, $buf.Length - 1) }; continue }
    if (-not [char]::IsControl($k.KeyChar) -and $buf.Length -lt 400) { $buf += $k.KeyChar }
  }
}
function CommitRun($pick, $message) {
  [Console]::Write("$BG$E[2J$E[H")
  [Console]::WriteLine((Top $UI.commitTitle) + "$E[K")
  $okNames = @(); $bad = 0
  foreach ($s in $pick) {
    [Console]::WriteLine((Row (' ' + (Paint (T $UI.committing @{ name = $s.name }) 'dim'))) + "$E[K")
    $r = VgCommitPush $s.path $message
    $out = @()
    if ($r.blocked.Count) { $out += Crit (T $UI.stillBlocked @{ name = $s.name; n = $r.blocked.Count }) }
    if ($r.committed) { $out += Ok (T $UI.committed @{ name = $s.name; sha = [string](GitOut -C $s.path rev-parse --short HEAD) }) }
    if ($r.push -and $r.push.ok) {
      if ($r.push.branch -eq $VgCollect) { $out += Ok (T $UI.pushed @{ name = $s.name; branch = $r.push.branch }) }
      else { $out += Warn (T $UI.pushedFallback @{ name = $s.name; branch = $r.push.branch; collect = $VgCollect }) }
    }
    if ($r.error) {
      $out += Crit (T $UI.err.($r.error) @{ name = $s.name })
      $tail = @(@($r.commitLog) + @($r.push | ForEach-Object { $_.log }) | Where-Object { "$_".Trim() } | Select-Object -Last 3)
      foreach ($l in $tail) { $out += Paint ('  ' + "$l".Trim()) 'faint' }
    }
    if (-not $r.blocked.Count -and -not $r.committed -and -not $r.push -and -not $r.error) { $out += Paint (T $UI.nothing @{ name = $s.name }) 'faint' }
    if ($r.blocked.Count -or $r.error) { $bad++ } else { $okNames += $s.name }
    foreach ($l in $out) { [Console]::WriteLine((Row ('   ' + $l)) + "$E[K") }
  }
  [Console]::WriteLine((Rule '' '') + "$E[K")
  [Console]::WriteLine((Row (' ' + (Paint $UI.anyKey 'dim'))) + "$E[K")
  [Console]::Write((Bottom '') + "$E[K")
  $null = ReadKey
  if ($bad) { return Crit (T $UI.commitSome @{ ok = $okNames.Count; bad = $bad }) }
  Ok (T $UI.commitDone @{ list = ($okNames -join ', ') })
}
function CommitFlow($pick) {                     # the message (only when there is something to commit), then the run
  $n = [int](@($pick | ForEach-Object { $_.changes.Count }) | Measure-Object -Sum).Sum
  $m = ''
  if ($n) {
    $m = ReadLine $UI.commitTitle (T $UI.messageLabel @{ list = (@($pick | ForEach-Object { $_.name }) -join ', ') }) (T $UI.commitMsg @{ date = (Get-Date -Format 'yyyy-MM-dd'); n = $n })
    if ($null -eq $m) { return '' }
  }
  CommitRun $pick $m
}
function CommitMenu {
  $msg = ''
  while ($true) {
    $st = @(States -Scan)
    Show (CommitScreen $st $msg); $msg = ''
    $k = ReadKey
    if (IsBack $k) { return '' }
    if ($k -eq 'A') { $pick = @($st | Where-Object { $_.git -and $_.dirty -and -not $_.blocked.Count }) }
    elseif ($k -match '^[1-9]$' -and [int]$k -le $st.Count) { $pick = @($st[[int]$k - 1] | Where-Object { $_.git -and $_.dirty }) }
    else { continue }
    if (-not $pick.Count) { $msg = Warn $UI.noneReady; continue }
    if (@($pick | Where-Object { $_.blocked.Count }).Count) { $msg = Crit $UI.fixBlocked; continue }
    $r = CommitFlow $pick
    if ($r) { return $r }
  }
}
# Q, Esc or Ctrl+C with unpushed work: commit + push and leave / leave as it is / back. $true = leave.
function ExitGuard {
  while ($true) {
    $st = @(States)
    if (-not @($st | Where-Object { $_.dirty }).Count) { return $true }
    Show (GuardScreen $st)
    $k = ReadKey
    if ($k -eq 'L') { return $true }
    if ($k -eq 'B' -or (IsBack $k)) { return $false }
    if ($k -ne 'C') { continue }
    $pick = @(States -Scan | Where-Object { $_.git -and $_.dirty })
    if (@($pick | Where-Object { $_.blocked.Count }).Count) { $null = CommitMenu } else { $null = CommitFlow $pick }
  }
}

# ------------------------------------------------------------------ BACKUP (backup.ps1)
# A long job: its title, one line per stage as it goes, the result lines, then a key back to the menu.
function Running($title) { [Console]::Write("$BG$E[2J$E[H"); [Console]::WriteLine((Top $title) + "$E[K") }
function Line($s) { [Console]::WriteLine((Row (' ' + $s)) + "$E[K") }
function Done {
  [Console]::WriteLine((Rule '' '') + "$E[K"); Line (Paint $UI.anyKey 'dim'); [Console]::Write((Bottom '') + "$E[K")
  $null = ReadKey
}
$Step = { param($what) Line (Paint ($G.arrow + ' ' + $what + $G.ell) 'faint') }
function Size($b) { if ($b -ge 1MB) { '{0:0.0} MB' -f ($b / 1MB) } elseif ($b -ge 1KB) { '{0:0} kB' -f ($b / 1KB) } else { "$b B" } }
function StampText($s) { if ($s -match '^(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)$') { "$($Matches[1])-$($Matches[2])-$($Matches[3]) $($Matches[4]):$($Matches[5])" } else { $s } }
function First($list, $n) { @($list | Select-Object -First $n) + @(if (@($list).Count -gt $n) { Paint (T $UI.andMore @{ n = @($list).Count - $n }) 'faint' }) }

function SyncLines($log) {
  $out = @(Paint (T $UI.bkWhen @{ when = $log.when; seconds = $log.seconds }) 'dim')
  foreach ($r in @($log.repos)) {
    if ($r.ok) { $out += Ok (T $(if ($r.created) { $UI.bkRepoNew } else { $UI.bkRepoOk }) @{ name = $r.name }) }
    elseif ($r.error -eq 'rejected') { $out += Warn (T $UI.bkRejected @{ name = $r.name; list = ((@($r.rejected) | ForEach-Object { $_ -replace '^refs/heads/', '' }) -join ', ') }) }
    else { $out += Crit (T $UI.bkErr.($r.error) @{ name = $r.name }) }
  }
  $moved = 0
  foreach ($f in @($log.folders)) {
    $name = $f.name.PadRight(22)
    if ($f.skipped) { $out += Crit ($name + $UI.bkSkip.($f.skipped)); continue }
    if ($f.code -ge 8) { $out += Crit ($name + (T $UI.bkCopyFail @{ code = $f.code })); continue }
    $moved += $f.changed + $f.removed
    if (-not ($f.new + $f.changed + $f.removed)) { $out += (Paint $name 'text') + (Paint $UI.bkSame 'faint'); continue }
    $out += (Paint $name 'text') + (Paint (T $UI.bkCounts @{ new = $f.new; changed = $f.changed; removed = $f.removed; size = (Size $f.bytes) }) 'copper')
  }
  if ($log.manifest) { $out += Paint (T $UI.bkManifest @{ files = $log.manifest.files; hashed = $log.manifest.hashed }) 'dim' }
  if ($moved) { $out += Paint (T $UI.bkArchived @{ n = $moved; path = ((BkCfg).archive + '\sync\' + $log.stamp) }) 'warn' }
  $out
}
function BackupSync {
  Running $UI.bkSyncTitle
  $log = BkSync $Step
  foreach ($l in SyncLines $log) { Line $l }
  Done
  if ($log.ok) { Ok $UI.bkSyncOk } else { Warn $UI.bkSyncWarn }
}
function BackupReport {
  $log = BkLastReport
  if (-not $log) { return Warn $UI.bkNoReport }
  Running $UI.bkReportTitle
  foreach ($l in SyncLines $log) { Line $l }
  Done; ''
}
function BackupIntegrity {
  Running $UI.bkIntTitle
  $i = BkIntegrity $Step
  $bad = 0
  foreach ($r in $i.repos) {
    if ($r.ok) { Line (Ok (T $UI.bkFsckOk @{ name = $r.name })) }
    else { $bad++; Line (Crit (T $UI.bkFsckBad @{ name = $r.name; why = $(if ($r.why -eq 'nobare') { $UI.bkNoBare } else { $r.why }) })) }
  }
  if (-not $i.manifest) { $bad++; Line (Warn $UI.bkNoManifest) }
  else {
    if ($i.bad.Count -or $i.missing.Count) { $bad++ }
    Line $(if ($i.bad.Count) { Crit (T $UI.bkHashBad @{ n = $i.checked; bad = $i.bad.Count }) } else { Ok (T $UI.bkHashOk @{ n = $i.checked }) })
    foreach ($f in First $i.bad 6) { Line ('   ' + (Crit $G.x) + ' ' + (Paint $f 'text')) }
    if ($i.missing.Count) { Line (Crit (T $UI.bkMissing @{ n = $i.missing.Count })); foreach ($f in First $i.missing 4) { Line ('   ' + (Paint $f 'text')) } }
    if ($i.unlisted.Count) { Line (Paint (T $UI.bkUnlisted @{ n = $i.unlisted.Count }) 'faint') }
  }
  if ($i.pending.Count) { Line (Paint (T $UI.bkPending @{ list = ((@($i.pending) | ForEach-Object { "$($_.name) $($_.n)" }) -join ', ') }) 'copper') }
  else { Line (Ok $UI.bkInSync) }
  Done
  if ($bad) { Crit $UI.bkIntBad } else { Ok $UI.bkIntOk }
}
function VersionName($v) {
  if ($v.label -eq 'backup') { return $UI.bkVerBackup }
  T $(if ($v.label -eq 'sync') { $UI.bkVerSync } else { $UI.bkVerRestore }) @{ when = (StampText $v.stamp) }
}
function BackupRestore {
  $c = BkCfg
  $path = ReadLine $UI.bkRestoreTitle (T $UI.bkRestoreAsk @{ list = ($c.folders -join ', ') }) ''
  if (-not $path) { return '' }
  $v = BkVersions $path
  if (-not $v) { return Warn (T $UI.bkNotSynced @{ path = $path }) }
  if (-not $v.versions.Count) { return Warn (T $UI.bkNoVersion @{ path = $v.tail }) }
  $i = 0; $items = @($v.versions | Select-Object -First 9 | ForEach-Object { $i++; [pscustomobject]@{ key = [string]$i; name = (VersionName $_); v = $_ } })
  while ($true) {
    $lines = @((Top $UI.bkRestoreTitle), (Row (' ' + (Paint $v.target 'text'))))
    foreach ($l in Wrap $UI.bkRestoreNote ($W - 2)) { $lines += Row (' ' + (Paint $l 'dim')) }
    $lines += Rule '' ''
    foreach ($it in $items) { $lines += Row (Item $it $W) }
    $lines += Rule '' ''; $lines += Row (Item $BackItem $W); $lines += Bottom ''
    Show $lines
    $k = ReadKey
    if (IsBack $k) { return '' }
    $pick = $items | Where-Object { $_.key -eq $k } | Select-Object -First 1
    if (-not $pick) { continue }
    Show @((Top $UI.bkRestoreTitle), (Row (' ' + (Paint (T $UI.bkConfirm @{ name = $pick.name }) 'text'))), (Row (' ' + (Paint $v.target 'faint'))),
           (Row ''), (Row ((Item ([pscustomobject]@{ key = 'I'; name = $UI.yes; accent = $true }) 20) + (Item ([pscustomobject]@{ key = 'N'; name = $UI.no }) 20))), (Bottom ''))
    if ((ReadKey) -ne 'I') { continue }
    $r = BkRestore $v $pick.v
    if (-not $r.ok) { return Crit (T $UI.bkRestoreFail @{ code = $r.code }) }
    return Ok $(if ($r.saved) { T $UI.bkRestored @{ path = $v.tail; saved = $r.saved } } else { T $UI.bkRestoredNew @{ path = $v.tail } })
  }
}
function BackupInstallers {
  $rows = BkInstallers
  Running $UI.bkInstTitle
  Line (Paint (BkCfg).installers 'faint')
  [Console]::WriteLine((Rule '' '') + "$E[K")
  foreach ($r in $rows) {
    $tag = $(switch ($r.state) { 'ok' { Ok $UI.bkInstOk } 'missing' { Crit $UI.bkInstMissing } default { Paint $UI.bkInstNoRule 'faint' } })
    $info = $(if ($r.file) { $r.file } else { $r.note })
    Line ((Paint $r.dir.PadRight(30) 'text') + (Fit $tag 14) + (Paint $info 'faint'))
  }
  $n = @{ ok = 0; missing = 0; norule = 0 }; foreach ($r in $rows) { $n[$r.state]++ }
  [Console]::WriteLine((Rule '' '') + "$E[K")
  Line (Paint (T $UI.bkInstSum @{ ok = $n.ok; missing = $n.missing; norule = $n.norule }) 'dim')
  Done
  if ($n.missing -or $n.norule) { Warn (T $UI.bkInstSum @{ ok = $n.ok; missing = $n.missing; norule = $n.norule }) } else { Ok $UI.bkInstAll }
}

# Every item, wherever it sits, goes through here; the registry's fields say what it is.
function Act($it) {
  if ($it.action -eq 'commit') { return CommitMenu }
  switch ($it.action) {
    'backup-sync' { return BackupSync }          'backup-integrity' { return BackupIntegrity }
    'backup-report' { return BackupReport }      'backup-restore' { return BackupRestore }
    'backup-installers' { return BackupInstallers }
  }
  if ($it.phase)    { return Warn (T $UI.soon @{ phase = $it.phase }) }
  if ($it.menu)     { return SubMenu $it.menu }
  if ($it.servers)  { return ServersMenu }
  if ($it.programs) { return SubMenu (ProgramsMenu $it) }
  if ($it.prompts)  { return PromptsMenu (P $it.prompts) }
  if ($it.steps)    { $ok = RunSteps $it; if ($ok -and $it.then) { return OpenTool ([pscustomobject]@{ name = $it.name; path = $it.then }) }; return $script:last }
  if ($it.groups)   { return Tabs $it }
  if ($it.path)     { return OpenTool $it }
  if ($it.exe)      { return StartExe $it }
  if ($it.server)   { return OpenServer (Server $it.server) }
  if ($it.url)      { Start-Process (P $it.url); return Ok (T $UI.opened @{ name = $it.name }) }
  if ($it.folder)   { $f = P $it.folder; if (-not (Test-Path -LiteralPath $f)) { return Crit (T $UI.missing @{ path = $f }) }
                      Start-Process explorer.exe (Q $f); return Ok (T $UI.opened @{ name = $it.name }) }
  ''
}

$msg = ''
try {
  while ($true) {
    $st = $(if ($UsesGit) { @(States) } else { @() })
    try { [VrgVt]::Close(-not @($st | Where-Object { $_.dirty }).Count) } catch { }
    Show (MainScreen $msg $st); $msg = ''
    $k = ReadKey
    $it = $Main | Where-Object { $_.key -eq $k } | Select-Object -First 1
    if ($k -eq [string][char]27 -or $k -eq [string][char]3 -or ($it -and $it.action -eq 'quit')) { if (-not $UsesGit -or (ExitGuard)) { break }; continue }
    if (-not $it) { continue }
    $msg = Act $it
  }
}
finally {
  try { [VrgVt]::Close($true) } catch { }
  [Console]::Write("$E[0m$E[2J$E[H"); try { [Console]::CursorVisible = $true } catch { }
}
if ($null -ne $KeyQ -and $KeyQ.Count) { [Console]::WriteLine("test keys left over: $($KeyQ.Count)"); exit 2 }   # a test pressed more than was asked
