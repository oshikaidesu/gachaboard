@echo off
chcp 65001 >nul
cd /d %~dp0..\..
powershell -ExecutionPolicy Bypass -File "%~dp0production.ps1"
if errorlevel 1 pause
