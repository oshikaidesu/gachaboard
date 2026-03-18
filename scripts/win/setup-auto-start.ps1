# Gachaboard 自動起動の設定（タスクスケジューラ）
# 管理者権限不要。ログオン時に start.bat を実行するタスクを登録する
#
# 実行: PowerShell で
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
#   .\scripts\win\setup-auto-start.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$StartBat = Join-Path $RootDir "start.bat"

if (-not (Test-Path $StartBat)) {
  Write-Host "エラー: start.bat が見つかりません: $StartBat" -ForegroundColor Red
  exit 1
}

$TaskName = "Gachaboard-Start"
$TaskDescription = "Gachaboard をログオン時に起動（Tailscale HTTPS）"
# 最小化で起動（2 = Tailscale HTTPS）。ウィンドウは出るがタスクバーに最小化
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c start /min `"`" `"$StartBat`" 2" -WorkingDirectory $RootDir
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description $TaskDescription -Force
  Write-Host ""
  Write-Host "✓ 自動起動を登録しました: $TaskName" -ForegroundColor Green
  Write-Host ""
  Write-Host "  ログオン時に start.bat 2 (Tailscale) が実行されます。" -ForegroundColor Gray
  Write-Host "  無効化: タスクスケジューラで '$TaskName' を無効にする" -ForegroundColor Gray
  Write-Host "  削除:   Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
  Write-Host ""
} catch {
  Write-Host "エラー: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
