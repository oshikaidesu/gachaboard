# プロジェクト内の wslconfig を %USERPROFILE%\.wslconfig にコピーして適用
# 実行: PowerShell で .\scripts\setup\setup-wslconfig.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Src = Join-Path $ScriptDir "wslconfig"
$Dst = Join-Path $env:USERPROFILE ".wslconfig"

if (-not (Test-Path $Src)) {
  Write-Host "エラー: wslconfig が見つかりません: $Src" -ForegroundColor Red
  exit 1
}

Copy-Item -Path $Src -Destination $Dst -Force
Write-Host ""
Write-Host ">>> wslconfig を適用しました: $Dst" -ForegroundColor Green
Write-Host ""
Write-Host "反映のため wsl --shutdown を実行します..." -ForegroundColor Yellow
wsl --shutdown
Write-Host "✓ 完了。WSL を起動すると設定が反映されます。" -ForegroundColor Green
Write-Host ""
