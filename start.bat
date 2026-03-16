@echo off
chcp 65001 >nul
cd /d %~dp0
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\start\run-start.ps1"
echo.
pause
