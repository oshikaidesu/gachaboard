@echo off
chcp 65001 >nul
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start\start.ps1"
if errorlevel 1 pause
