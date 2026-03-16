@echo off
chcp 65001 >nul
cd /d %~dp0..\..
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0run-production.ps1"
if errorlevel 1 pause
