@echo off
chcp 65001 >nul 2>nul
REM Sorted first in scripts/entry for Explorer; starts portable EXE in repo root.
call "%~dp0run-launcher.bat"
