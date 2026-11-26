# sapi-host.ps1 - WP-57 Hang: the SAPI fallback. ONE long-running helper (started once by Voice/tts/tts.js): JSON lines on stdin and
# stdout. This file must stay ASCII (Windows PowerShell 5.1 misreads accents in a BOM-less script); the spoken text arrives base64 UTF-8.
#   in : {"op":"voices"}  {"op":"speak","id":"u1","text":"<base64 utf-8>","voice":"Microsoft Szabolcs","rate":0}  {"op":"stop"}  {"op":"quit"}
#   out: {"ev":"ready"}  {"ev":"voices","voices":[{"name":"...","culture":"hu-HU"}]}  {"ev":"done","id":"u1","ok":true}
#        {"ev":"done","id":"u1","ok":false,"cancelled":true}  {"ev":"error","msg":"..."}
# A new speak cancels the one still playing (tts.js already queues; this is the safety net). Hungarian voices exist only when the
# Hungarian language pack with its speech feature is installed (Settings - Time and language - Speech).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToDefaultAudioDevice()

function Send($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

# Not [Console]::In: on .NET Framework its ReadLineAsync blocks until a line arrives (no 'ready' before the first request, and
# every answer one line late). A StreamReader over the raw stdin stream reads in the background.
$reader = New-Object System.IO.StreamReader -ArgumentList ([Console]::OpenStandardInput()), (New-Object System.Text.UTF8Encoding -ArgumentList $false)
$pending = $reader.ReadLineAsync()
$cur = $null
$curId = $null
$run = $true
Send @{ ev = 'ready' }

while ($run) {
  if ($pending.Wait(40)) {
    $line = $pending.Result
    if ($null -eq $line) { $run = $false; continue }
    $pending = $reader.ReadLineAsync()
    $m = $null
    try { $m = $line | ConvertFrom-Json } catch { Send @{ ev = 'error'; msg = 'bad json' }; continue }
    $op = [string]$m.op
    if ($op -eq 'voices') {
      $list = @()
      foreach ($v in $synth.GetInstalledVoices()) {
        if ($v.Enabled) { $list += @{ name = $v.VoiceInfo.Name; culture = $v.VoiceInfo.Culture.Name } }
      }
      Send @{ ev = 'voices'; voices = $list }
    } elseif ($op -eq 'speak') {
      if ($null -ne $cur) { $synth.SpeakAsyncCancelAll(); Send @{ ev = 'done'; id = $curId; ok = $false; cancelled = $true }; $cur = $null }
      try {
        $text = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String([string]$m.text))
        if ($m.voice) { try { $synth.SelectVoice([string]$m.voice) } catch { Send @{ ev = 'error'; msg = 'no such voice' } } }
        if ($null -ne $m.rate) { $synth.Rate = [Math]::Max(-10, [Math]::Min(10, [int]$m.rate)) }
        $cur = $synth.SpeakAsync($text)
        $curId = [string]$m.id
      } catch {
        Send @{ ev = 'done'; id = [string]$m.id; ok = $false }
        $cur = $null
      }
    } elseif ($op -eq 'stop') {
      if ($null -ne $cur) { $synth.SpeakAsyncCancelAll(); Send @{ ev = 'done'; id = $curId; ok = $false; cancelled = $true }; $cur = $null }
    } elseif ($op -eq 'quit') {
      $run = $false
    }
  }
  if ($null -ne $cur -and $cur.IsCompleted) { Send @{ ev = 'done'; id = $curId; ok = $true }; $cur = $null }
}
$synth.Dispose()
