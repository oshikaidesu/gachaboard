# ASCII-only launcher: loads start.ps1 as UTF-8 then runs it (avoids CP932 parse errors)
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
Set-Location $RootDir
$startPath = Join-Path $ScriptDir "start.ps1"
$script = Get-Content -LiteralPath $startPath -Raw -Encoding UTF8
Invoke-Expression $script
