# uia-host.ps1 -- WP-56 Szem: a READ-ONLY Windows UI Automation host for the VRG Asztal's screen reader (Voice/screen/screen.js).
# One long-running Windows PowerShell 5.1 process: JSON lines in on stdin, JSON lines out on stdout. Started once by screen.js and
# kept; never re-spawned per request (a freshly started script process is what Avast blocks, see CLAUDE.md).
#   in : {"id":"7","op":"ping"} | {"id":"8","op":"focused","maxNodes":400,"budgetMs":1500} | {"id":"9","op":"windows"}
#   out: {"id":"7","ok":true,"pong":true,"ps":"5.1.x"}
#        {"id":"8","ok":true,"win":{...},"focus":{...},"selection":"...","nodes":[...],"truncated":false,"ms":120}
#        {"id":"9","ok":true,"windows":[{"hwnd":..,"pid":..,"process":"chrome","title":"...","cls":"...","min":false}]}
#        {"id":"8","ok":false,"err":"elevated"|"no-window"|"bad-request"|"error","msg":"..."}
# A node: {"role":"Edit","name":"...","value":"...","aid":"...","cls":"...","off":false,"focus":true,"pw":false,"depth":3,"rect":[x,y,w,h]}
# It only READS properties (Current.*, ValuePattern.Current.Value, TextPattern selection text). It never invokes, sets a value,
# moves the focus or sends input. A password field's value is never read. An elevated window answers "elevated" (UIPI).
# This file must stay ASCII: Windows PowerShell 5.1 misreads a BOM-less script with accents. Non-ASCII text is written as \uXXXX.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class VrgSzemWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$AE = [System.Windows.Automation.AutomationElement]
$VP = [System.Windows.Automation.ValuePattern]::Pattern
$TP = [System.Windows.Automation.TextPattern]::Pattern
$Walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$procNames = @{}

function Esc([string]$s, [int]$max) {
  if ($s -eq $null) { return 'null' }
  if ($max -gt 0 -and $s.Length -gt $max) { $s = $s.Substring(0, $max) }
  $sb = New-Object System.Text.StringBuilder ($s.Length + 8)
  [void]$sb.Append('"')
  foreach ($ch in $s.ToCharArray()) {
    $c = [int]$ch
    if ($c -eq 34) { [void]$sb.Append('\"') }
    elseif ($c -eq 92) { [void]$sb.Append('\\') }
    elseif ($c -lt 32 -or $c -gt 126) { [void]$sb.Append('\u' + $c.ToString('x4')) }
    else { [void]$sb.Append($ch) }
  }
  [void]$sb.Append('"')
  return $sb.ToString()
}
function B($v) { if ($v) { return 'true' } else { return 'false' } }
function N($v) { $d = [double]$v; if ([double]::IsInfinity($d) -or [double]::IsNaN($d)) { return '0' } return ([int][math]::Round($d)).ToString() }
function Out-Line([string]$s) { [Console]::Out.Write($s + "`n"); [Console]::Out.Flush() }
function SafeId($v) { $s = [string]$v; if ($s -match '^[A-Za-z0-9_-]{1,32}$') { return $s } return '0' }
function ProcName([int]$procId) {
  if ($procNames.ContainsKey($procId)) { return $procNames[$procId] }
  $n = ''
  try { $n = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { $n = '' }
  $procNames[$procId] = $n
  return $n
}
function IsDenied($e) {
  $m = [string]$e.Exception.Message
  if ($e.Exception -is [System.UnauthorizedAccessException]) { return $true }
  if ($e.Exception.InnerException -is [System.UnauthorizedAccessException]) { return $true }
  return ($m -match 'Access is denied|E_ACCESSDENIED|0x80070005')
}

# one element -> a JSON node (read-only properties only)
function NodeJson($el, [int]$depth) {
  $c = $el.Current
  $role = ([string]$c.ControlType.ProgrammaticName) -replace '^ControlType\.', ''
  $pw = $false
  try { $pw = [bool]$c.IsPassword } catch { $pw = $false }
  $value = $null
  if (-not $pw) {
    $p = $null
    try { if ($el.TryGetCurrentPattern($VP, [ref]$p)) { $value = [string]$p.Current.Value } } catch { $value = $null }
  }
  $r = $c.BoundingRectangle
  $rect = '[' + (N $r.X) + ',' + (N $r.Y) + ',' + (N $r.Width) + ',' + (N $r.Height) + ']'
  return '{"role":' + (Esc $role 40) + ',"name":' + (Esc ([string]$c.Name) 300) + ',"value":' + (Esc $value 2000) +
    ',"aid":' + (Esc ([string]$c.AutomationId) 80) + ',"cls":' + (Esc ([string]$c.ClassName) 80) + ',"off":' + (B $c.IsOffscreen) +
    ',"focus":' + (B $c.HasKeyboardFocus) + ',"pw":' + (B $pw) + ',"depth":' + $depth + ',"rect":' + $rect + '}'
}

function Op-Focused($req) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $max = 400; if ($req.maxNodes) { $max = [math]::Min([math]::Max([int]$req.maxNodes, 10), 1500) }
  $budget = 1500; if ($req.budgetMs) { $budget = [math]::Min([math]::Max([int]$req.budgetMs, 200), 5000) }
  $h = [VrgSzemWin]::GetForegroundWindow()
  if ($h -eq [IntPtr]::Zero) { return '{"ok":false,"err":"no-window","msg":"no foreground window"}' }
  [uint32]$procId = 0
  [void][VrgSzemWin]::GetWindowThreadProcessId($h, [ref]$procId)
  $root = $AE::FromHandle($h)
  $rc = $root.Current
  $win = '{"hwnd":' + $h.ToInt64() + ',"pid":' + $procId + ',"process":' + (Esc (ProcName ([int]$procId)) 80) + ',"title":' + (Esc ([string]$rc.Name) 300) + ',"cls":' + (Esc ([string]$rc.ClassName) 80) + '}'
  # the focused element, when it belongs to this window's process; its selected text through TextPattern (never a password)
  $focus = 'null'; $sel = 'null'
  try {
    $f = $AE::FocusedElement
    if ($f -ne $null -and $f.Current.ProcessId -eq $procId) {
      $focus = NodeJson $f 0
      if (-not $f.Current.IsPassword) {
        $tp = $null
        if ($f.TryGetCurrentPattern($TP, [ref]$tp)) {
          $parts = @()
          foreach ($range in $tp.GetSelection()) { $parts += $range.GetText(4000) }
          $txt = ($parts -join "`n")
          if ($txt.Trim().Length -gt 0) { $sel = Esc $txt 4000 }
        }
      }
    }
  } catch { if (IsDenied $_) { throw } }
  # depth-first over the control view, within the node and time budget; an offscreen container below depth 1 is not entered
  $nodes = New-Object System.Collections.Generic.List[string]
  $stack = New-Object System.Collections.Stack
  $stack.Push(@($root, 0))
  $truncated = $false
  while ($stack.Count -gt 0) {
    if ($nodes.Count -ge $max -or $sw.ElapsedMilliseconds -gt $budget) { $truncated = $true; break }
    $item = $stack.Pop(); $el = $item[0]; $d = [int]$item[1]
    $off = $false
    try { $nodes.Add((NodeJson $el $d)); $off = [bool]$el.Current.IsOffscreen } catch { if (IsDenied $_) { throw } else { continue } }
    if ($off -and $d -ge 1) { continue }
    $kids = New-Object System.Collections.Generic.List[object]
    try {
      $k = $Walker.GetFirstChild($el)
      while ($k -ne $null -and $kids.Count -lt 200) { $kids.Add($k); $k = $Walker.GetNextSibling($k) }
    } catch { if (IsDenied $_) { throw } }
    for ($i = $kids.Count - 1; $i -ge 0; $i--) { $stack.Push(@($kids[$i], ($d + 1))) }
  }
  return '{"ok":true,"win":' + $win + ',"focus":' + $focus + ',"selection":' + $sel + ',"nodes":[' + ($nodes -join ',') + '],"truncated":' + (B $truncated) + ',"ms":' + $sw.ElapsedMilliseconds + '}'
}

function Op-Windows($req) {
  $skip = @('Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Progman', 'WorkerW')
  $out = New-Object System.Collections.Generic.List[string]
  $all = $AE::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($w in $all) {
    if ($out.Count -ge 60) { break }
    try {
      $c = $w.Current
      $name = [string]$c.Name
      if ($name.Trim().Length -eq 0 -or $skip -contains [string]$c.ClassName) { continue }
      $out.Add('{"hwnd":' + $c.NativeWindowHandle + ',"pid":' + $c.ProcessId + ',"process":' + (Esc (ProcName ([int]$c.ProcessId)) 80) +
        ',"title":' + (Esc $name 300) + ',"cls":' + (Esc ([string]$c.ClassName) 80) + ',"min":' + (B $c.IsOffscreen) + '}')
    } catch { continue }
  }
  return '{"ok":true,"windows":[' + ($out -join ',') + ']}'
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  if ($line.Trim().Length -eq 0) { continue }
  $req = $null
  try { $req = $line | ConvertFrom-Json } catch { Out-Line '{"id":"0","ok":false,"err":"bad-request","msg":"not json"}'; continue }
  $id = SafeId $req.id
  $body = ''
  try {
    switch ([string]$req.op) {
      'ping' { $body = '{"ok":true,"pong":true,"ps":' + (Esc ([string]$PSVersionTable.PSVersion) 20) + '}' }
      'focused' { $body = Op-Focused $req }
      'windows' { $body = Op-Windows $req }
      'quit' { Out-Line ('{"id":"' + $id + '","ok":true,"bye":true}'); exit 0 }
      default { $body = '{"ok":false,"err":"bad-request","msg":"unknown op"}' }
    }
  } catch {
    if (IsDenied $_) { $body = '{"ok":false,"err":"elevated","msg":"access denied (UIPI: the window runs elevated)"}' }
    else { $body = '{"ok":false,"err":"error","msg":' + (Esc ([string]$_.Exception.Message) 300) + '}' }
  }
  Out-Line ('{"id":"' + $id + '",' + $body.Substring(1))
}
