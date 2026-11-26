# act-host.ps1 -- WP-58 Kez (hands): the ACTION helper of the VRG Asztal's voice shell (Voice/hands/hands.js).
# One long-running Windows PowerShell 5.1 process: JSON lines in on stdin, JSON lines out on stdout. Started once by hands.js and
# kept; never re-spawned per request (a freshly started script process is what Avast blocks, see CLAUDE.md).
#
# THE HARD RULE: spoken words never type into another program. This helper has NO text entry of any kind: it never sets a value,
# never synthesises keys or mouse input, never touches the shared copy buffer. It only uses these UI Automation patterns:
#   Invoke (click a button / menu item / link), Toggle, SelectionItem (tabs, list items), ExpandCollapse, Scroll, Window (state, close),
#   and SetForegroundWindow / ShowWindow for bringing a named top-level window to the front.
# It never acts on a password field, and an elevated window answers "elevated" (UIPI); it never retries.
#
#   in : {"id":"1","op":"ping"}
#        {"id":"2","op":"windows"}
#        {"id":"3","op":"find","hwnd":0,"maxNodes":600,"budgetMs":1500}        hwnd 0 = the foreground window
#        {"id":"4","op":"do","verb":"invoke","hwnd":123,"rid":"42.1.7","arg":"","fg":true}
#        {"id":"5","op":"state","hwnd":123,"rid":"42.1.7"}
#   out: {"id":"3","ok":true,"win":{"hwnd":..,"pid":..,"process":"..","title":"..","state":"normal"},"fg":123,"items":[...],"truncated":false,"ms":80}
#        an item: {"rid":"42.1.7","role":"Button","name":"..","aid":"..","enabled":true,"pw":false,"off":false,"focus":false,
#                  "pat":["invoke","toggle","select","expand","scroll","window"],"toggle":"on|off|indeterminate|","expand":"expanded|collapsed|leaf|partial|",
#                  "selected":true|false|null,"vscroll":-1..100,"rect":[x,y,w,h]}
#        {"id":"4","ok":true,"before":{state},"after":{state},"ms":40}
#        {"id":"4","ok":false,"err":"stale"|"gone"|"disabled"|"password"|"no-pattern"|"elevated"|"no-window"|"bad-request"|"error","msg":"..."}
# This file must stay ASCII: Windows PowerShell 5.1 misreads a BOM-less script with accents. Non-ASCII text is written as \uXXXX.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class VrgKezWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$AE = [System.Windows.Automation.AutomationElement]
$TS = [System.Windows.Automation.TreeScope]
$Walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$PInvoke = [System.Windows.Automation.InvokePattern]::Pattern
$PToggle = [System.Windows.Automation.TogglePattern]::Pattern
$PSelect = [System.Windows.Automation.SelectionItemPattern]::Pattern
$PExpand = [System.Windows.Automation.ExpandCollapsePattern]::Pattern
$PScroll = [System.Windows.Automation.ScrollPattern]::Pattern
$PWindow = [System.Windows.Automation.WindowPattern]::Pattern
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
function Fail([string]$err, [string]$msg) { return '{"ok":false,"err":"' + $err + '","msg":' + (Esc $msg 300) + '}' }
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
function IsGone($e) {
  return ($e.Exception -is [System.Windows.Automation.ElementNotAvailableException]) -or ($e.Exception.InnerException -is [System.Windows.Automation.ElementNotAvailableException])
}
function RidOf($el) { try { return (($el.GetRuntimeId()) -join '.') } catch { return '' } }
function Pat($el, $p) { $o = $null; try { if ($el.TryGetCurrentPattern($p, [ref]$o)) { return $o } } catch { } return $null }

# the window an hwnd names (0 = the foreground window) and its JSON
function WinOf([long]$hwnd) {
  $h = [IntPtr]::Zero
  if ($hwnd -ne 0) { $h = [IntPtr]$hwnd } else { $h = [VrgKezWin]::GetForegroundWindow() }
  if ($h -eq [IntPtr]::Zero -or -not [VrgKezWin]::IsWindow($h)) { return $null }
  return $h
}
function WinJson([IntPtr]$h, $root) {
  [uint32]$procId = 0
  [void][VrgKezWin]::GetWindowThreadProcessId($h, [ref]$procId)
  $state = 'normal'
  $wp = Pat $root $PWindow
  if ($wp -ne $null) { $state = ([string]$wp.Current.WindowVisualState).ToLower() }
  elseif ([VrgKezWin]::IsIconic($h)) { $state = 'minimized' }
  return '{"hwnd":' + $h.ToInt64() + ',"pid":' + $procId + ',"process":' + (Esc (ProcName ([int]$procId)) 80) + ',"title":' + (Esc ([string]$root.Current.Name) 300) + ',"state":"' + $state + '"}'
}

# the state of one element, for planning and for verifying after an action
function StateJson($el) {
  $tg = ''; $ex = ''; $sel = 'null'; $vs = '-1'
  $p = Pat $el $PToggle; if ($p -ne $null) { $tg = ([string]$p.Current.ToggleState).ToLower() }
  $p = Pat $el $PExpand; if ($p -ne $null) { $ex = ([string]$p.Current.ExpandCollapseState).ToLower() -replace 'partiallyexpanded', 'partial' -replace 'leafnode', 'leaf' }
  $p = Pat $el $PSelect; if ($p -ne $null) { $sel = B $p.Current.IsSelected }
  $p = Pat $el $PScroll; if ($p -ne $null) { $vs = N $p.Current.VerticalScrollPercent }
  $ws = ''
  $p = Pat $el $PWindow; if ($p -ne $null) { $ws = ([string]$p.Current.WindowVisualState).ToLower() }
  return '{"toggle":"' + $tg + '","expand":"' + $ex + '","selected":' + $sel + ',"vscroll":' + $vs + ',"window":"' + $ws + '","enabled":' + (B $el.Current.IsEnabled) + '}'
}

function ItemJson($el) {
  $c = $el.Current
  $role = ([string]$c.ControlType.ProgrammaticName) -replace '^ControlType\.', ''
  $pw = $false
  try { $pw = [bool]$c.IsPassword } catch { $pw = $false }
  $pats = @()
  if ((Pat $el $PInvoke) -ne $null) { $pats += '"invoke"' }
  if ((Pat $el $PToggle) -ne $null) { $pats += '"toggle"' }
  if ((Pat $el $PSelect) -ne $null) { $pats += '"select"' }
  if ((Pat $el $PExpand) -ne $null) { $pats += '"expand"' }
  if ((Pat $el $PScroll) -ne $null) { $pats += '"scroll"' }
  if ((Pat $el $PWindow) -ne $null) { $pats += '"window"' }
  $r = $c.BoundingRectangle
  $rect = '[' + (N $r.X) + ',' + (N $r.Y) + ',' + (N $r.Width) + ',' + (N $r.Height) + ']'
  $st = StateJson $el
  return '{"rid":' + (Esc (RidOf $el) 120) + ',"role":' + (Esc $role 40) + ',"name":' + (Esc ([string]$c.Name) 200) + ',"aid":' + (Esc ([string]$c.AutomationId) 80) +
    ',"enabled":' + (B $c.IsEnabled) + ',"pw":' + (B $pw) + ',"off":' + (B $c.IsOffscreen) + ',"focus":' + (B $c.HasKeyboardFocus) +
    ',"pat":[' + ($pats -join ',') + '],' + $st.Substring(1, $st.Length - 2) + ',"rect":' + $rect + '}'
}

# every actionable element of a window (one with at least one of the allowed patterns), within the node and time budget
function Op-Find($req) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $max = 600; if ($req.maxNodes) { $max = [math]::Min([math]::Max([int]$req.maxNodes, 10), 2000) }
  $budget = 1500; if ($req.budgetMs) { $budget = [math]::Min([math]::Max([int]$req.budgetMs, 200), 5000) }
  $h = WinOf ([long]$req.hwnd)
  if ($h -eq $null) { return (Fail 'no-window' 'no such window') }
  $root = $AE::FromHandle($h)
  $win = WinJson $h $root
  $items = New-Object System.Collections.Generic.List[string]
  $stack = New-Object System.Collections.Stack
  $stack.Push(@($root, 0))
  $seen = 0; $truncated = $false
  while ($stack.Count -gt 0) {
    if ($seen -ge $max -or $sw.ElapsedMilliseconds -gt $budget) { $truncated = $true; break }
    $item = $stack.Pop(); $el = $item[0]; $d = [int]$item[1]
    $seen++
    try {
      $j = ItemJson $el
      if ($j -match '"pat":\[\S') { $items.Add($j) }
      if ([bool]$el.Current.IsOffscreen -and $d -ge 1) { continue }
    } catch { if (IsDenied $_) { throw } else { continue } }
    $kids = New-Object System.Collections.Generic.List[object]
    try {
      $k = $Walker.GetFirstChild($el)
      while ($k -ne $null -and $kids.Count -lt 300) { $kids.Add($k); $k = $Walker.GetNextSibling($k) }
    } catch { if (IsDenied $_) { throw } }
    for ($i = $kids.Count - 1; $i -ge 0; $i--) { $stack.Push(@($kids[$i], ($d + 1))) }
  }
  $fg = [VrgKezWin]::GetForegroundWindow().ToInt64()
  return '{"ok":true,"win":' + $win + ',"fg":' + $fg + ',"items":[' + ($items -join ',') + '],"truncated":' + (B $truncated) + ',"ms":' + $sw.ElapsedMilliseconds + '}'
}

function Op-Windows($req) {
  $skip = @('Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Progman', 'WorkerW')
  $out = New-Object System.Collections.Generic.List[string]
  $all = $AE::RootElement.FindAll($TS::Children, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($w in $all) {
    if ($out.Count -ge 60) { break }
    try {
      $c = $w.Current
      $name = [string]$c.Name
      if ($name.Trim().Length -eq 0 -or $skip -contains [string]$c.ClassName) { continue }
      $h = [IntPtr]$c.NativeWindowHandle
      $out.Add('{"hwnd":' + $c.NativeWindowHandle + ',"pid":' + $c.ProcessId + ',"process":' + (Esc (ProcName ([int]$c.ProcessId)) 80) +
        ',"title":' + (Esc $name 300) + ',"min":' + (B ([VrgKezWin]::IsIconic($h))) + '}')
    } catch { continue }
  }
  $fg = [VrgKezWin]::GetForegroundWindow().ToInt64()
  return '{"ok":true,"fg":' + $fg + ',"windows":[' + ($out -join ',') + ']}'
}

# the element a plan named, found again by its RuntimeId inside its window; $null when it is gone
function Resolve($root, [string]$rid) {
  if ($rid -eq '' -or $rid -eq $null) { return $root }
  if ((RidOf $root) -eq $rid) { return $root }
  $ids = [int[]]($rid.Split('.') | ForEach-Object { [int]$_ })
  $cond = New-Object System.Windows.Automation.PropertyCondition($AE::RuntimeIdProperty, $ids)
  return $root.FindFirst($TS::Descendants, $cond)
}

function Op-State($req) {
  $h = WinOf ([long]$req.hwnd)
  if ($h -eq $null -or [long]$req.hwnd -eq 0) { return (Fail 'no-window' 'no such window') }
  $root = $AE::FromHandle($h)
  $el = Resolve $root ([string]$req.rid)
  $fg = [VrgKezWin]::GetForegroundWindow().ToInt64()
  if ($el -eq $null) { return '{"ok":true,"exists":false,"fg":' + $fg + ',"win":' + (WinJson $h $root) + '}' }
  return '{"ok":true,"exists":true,"fg":' + $fg + ',"win":' + (WinJson $h $root) + ',"state":' + (StateJson $el) + '}'
}

function Op-Do($req) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $verb = [string]$req.verb
  $arg = [string]$req.arg
  if ([long]$req.hwnd -eq 0) { return (Fail 'bad-request' 'no hwnd') }
  $h = WinOf ([long]$req.hwnd)
  if ($h -eq $null) { return (Fail 'stale' 'the window is gone') }
  # bring a named window to the front: the only verb that does not require it to be in front already
  if ($verb -eq 'focus-window') {
    $before = [VrgKezWin]::GetForegroundWindow().ToInt64()
    if ([VrgKezWin]::IsIconic($h)) { [void][VrgKezWin]::ShowWindow($h, 9) }
    [void][VrgKezWin]::SetForegroundWindow($h)
    Start-Sleep -Milliseconds 120
    $after = [VrgKezWin]::GetForegroundWindow().ToInt64()
    return '{"ok":true,"before":{"fg":' + $before + '},"after":{"fg":' + $after + '},"ms":' + $sw.ElapsedMilliseconds + '}'
  }
  if ($req.fg -and [VrgKezWin]::GetForegroundWindow() -ne $h) { return (Fail 'stale' 'another window is in front now') }
  $root = $AE::FromHandle($h)
  $el = Resolve $root ([string]$req.rid)
  if ($el -eq $null) { return (Fail 'gone' 'the element is not there any more') }
  $pw = $false
  try { $pw = [bool]$el.Current.IsPassword } catch { $pw = $false }
  if ($pw) { return (Fail 'password' 'a password field is never touched') }
  if (-not [bool]$el.Current.IsEnabled) { return (Fail 'disabled' 'the element is disabled') }
  $before = StateJson $el
  switch ($verb) {
    'invoke' {
      $p = Pat $el $PInvoke
      if ($p -ne $null) { $p.Invoke() }
      else { $s = Pat $el $PSelect; if ($s -ne $null) { $s.Select() } else { return (Fail 'no-pattern' 'no Invoke or SelectionItem') } }
    }
    'toggle' { $p = Pat $el $PToggle; if ($p -eq $null) { return (Fail 'no-pattern' 'no Toggle') }; $p.Toggle() }
    'select' { $p = Pat $el $PSelect; if ($p -eq $null) { return (Fail 'no-pattern' 'no SelectionItem') }; $p.Select() }
    'expand' { $p = Pat $el $PExpand; if ($p -eq $null) { return (Fail 'no-pattern' 'no ExpandCollapse') }; $p.Expand() }
    'collapse' { $p = Pat $el $PExpand; if ($p -eq $null) { return (Fail 'no-pattern' 'no ExpandCollapse') }; $p.Collapse() }
    'scroll' {
      $p = Pat $el $PScroll
      if ($p -eq $null) { return (Fail 'no-pattern' 'no Scroll') }
      $NA = [System.Windows.Automation.ScrollAmount]::NoAmount
      switch ($arg) {
        'up' { $p.Scroll($NA, [System.Windows.Automation.ScrollAmount]::SmallDecrement) }
        'down' { $p.Scroll($NA, [System.Windows.Automation.ScrollAmount]::SmallIncrement) }
        'page-up' { $p.Scroll($NA, [System.Windows.Automation.ScrollAmount]::LargeDecrement) }
        'page-down' { $p.Scroll($NA, [System.Windows.Automation.ScrollAmount]::LargeIncrement) }
        'top' { $p.SetScrollPercent([System.Windows.Automation.ScrollPattern]::NoScroll, 0) }
        'bottom' { $p.SetScrollPercent([System.Windows.Automation.ScrollPattern]::NoScroll, 100) }
        default { return (Fail 'bad-request' 'scroll needs up, down, page-up, page-down, top or bottom') }
      }
    }
    'window' {
      $p = Pat $el $PWindow
      if ($p -eq $null) { return (Fail 'no-pattern' 'no Window') }
      $VS = [System.Windows.Automation.WindowVisualState]
      switch ($arg) {
        'minimize' { $p.SetWindowVisualState($VS::Minimized) }
        'maximize' { $p.SetWindowVisualState($VS::Maximized) }
        'restore' { $p.SetWindowVisualState($VS::Normal) }
        'close' { $p.Close() }
        default { return (Fail 'bad-request' 'window needs minimize, maximize, restore or close') }
      }
    }
    default { return (Fail 'bad-request' 'unknown verb') }
  }
  Start-Sleep -Milliseconds 150
  $after = '{"exists":false}'
  try {
    if ([VrgKezWin]::IsWindow($h)) {
      $el2 = Resolve ($AE::FromHandle($h)) ([string]$req.rid)
      if ($el2 -ne $null) { $st = StateJson $el2; $after = '{"exists":true,' + $st.Substring(1) }
    }
  } catch { $after = '{"exists":false}' }
  return '{"ok":true,"before":' + $before + ',"after":' + $after + ',"ms":' + $sw.ElapsedMilliseconds + '}'
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
      'windows' { $body = Op-Windows $req }
      'find' { $body = Op-Find $req }
      'state' { $body = Op-State $req }
      'do' { $body = Op-Do $req }
      'quit' { Out-Line ('{"id":"' + $id + '","ok":true,"bye":true}'); exit 0 }
      default { $body = '{"ok":false,"err":"bad-request","msg":"unknown op"}' }
    }
  } catch {
    if (IsDenied $_) { $body = '{"ok":false,"err":"elevated","msg":"access denied (UIPI: the window runs elevated)"}' }
    elseif (IsGone $_) { $body = '{"ok":false,"err":"gone","msg":"the element is not there any more"}' }
    elseif ($_.Exception -is [System.InvalidOperationException]) { $body = '{"ok":false,"err":"error","msg":' + (Esc ('invalid operation: ' + [string]$_.Exception.Message) 300) + '}' }
    else { $body = '{"ok":false,"err":"error","msg":' + (Esc ([string]$_.Exception.Message) 300) + '}' }
  }
  Out-Line ('{"id":"' + $id + '",' + $body.Substring(1))
}
