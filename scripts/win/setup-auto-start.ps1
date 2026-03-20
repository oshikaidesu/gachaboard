# Register a scheduled task to run scripts/entry/start.bat at logon (no admin required)
#
# Run in PowerShell:
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
#   .\scripts\win\setup-auto-start.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$StartBat = Join-Path $RootDir "scripts\entry\start.bat"

if (-not (Test-Path $StartBat)) {
  Write-Host "Error: scripts\entry\start.bat not found: $StartBat" -ForegroundColor Red
  exit 1
}

$TaskName = "Gachaboard-Start"
$TaskDescription = "Start Gachaboard at logon (Tailscale HTTPS)"
# Menu default is 1 (Tailscale prod) on Enter; pass 1 explicitly. /min = minimized window.
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c start /min `"`" `"$StartBat`" 1" -WorkingDirectory $RootDir
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description $TaskDescription -Force
  Write-Host ""
  Write-Host "Registered auto-start: $TaskName" -ForegroundColor Green
  Write-Host ""
  Write-Host "  At logon: scripts\entry\start.bat 1 (Tailscale prod, default) runs minimized." -ForegroundColor Gray
  Write-Host "  Disable: Task Scheduler -> disable '$TaskName'" -ForegroundColor Gray
  Write-Host "  Remove:  Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
  Write-Host ""
} catch {
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
