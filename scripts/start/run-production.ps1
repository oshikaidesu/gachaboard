# ASCII-only launcher: loads production.ps1 as UTF-8 then runs it (avoids CP932 parse errors)
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
Set-Location $RootDir
$productionPath = Join-Path $ScriptDir "production.ps1"
$script = Get-Content -LiteralPath $productionPath -Raw -Encoding UTF8
Invoke-Expression $script
