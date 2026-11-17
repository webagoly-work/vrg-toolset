# Parses every .ps1 of the Terminal with the PowerShell parser and fails on syntax errors,
# on non-ASCII bytes and on PowerShell 7-only operators that Windows PowerShell 5.1 cannot run.
$term = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$bad = 0
foreach ($f in @(Get-ChildItem -LiteralPath $term -Recurse -Filter '*.ps1' -File)) {
    $tokens = $null; $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errors)
    foreach ($e in $errors) { Write-Host ('PARSE ' + $f.Name + ':' + $e.Extent.StartLineNumber + ' ' + $e.Message) -ForegroundColor Red; $bad++ }
    foreach ($t in $tokens) {
        $k = [string]$t.Kind
        if ($k -eq 'QuestionQuestion' -or $k -eq 'QuestionQuestionEquals' -or $k -eq 'QuestionDot' -or $k -eq 'QuestionLBracket' -or $k -eq 'AndAnd' -or $k -eq 'OrOr' -or $k -eq 'QuestionMark') {
            Write-Host ('PS7 ' + $f.Name + ':' + $t.Extent.StartLineNumber + ' ' + $k) -ForegroundColor Red; $bad++
        }
    }
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    for ($i = 0; $i -lt $bytes.Length; $i++) { if ($bytes[$i] -gt 127) { Write-Host ('ASCII ' + $f.Name + ' byte ' + $i) -ForegroundColor Red; $bad++; break } }
}
if ($bad -gt 0) { Write-Host ("$bad problem(s)") -ForegroundColor Red; exit 1 }
Write-Host 'parse-check: OK' -ForegroundColor Green
exit 0
