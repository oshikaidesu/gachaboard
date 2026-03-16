# ASCII-only launcher: loads env.ps1 as UTF-8 then runs it (avoids CP932 parse errors)
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
Set-Location $RootDir
$envPath = Join-Path $ScriptDir "env.ps1"
$script = Get-Content -LiteralPath $envPath -Raw -Encoding UTF8
Invoke-Expression $script
