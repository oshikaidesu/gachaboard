@echo off
setlocal
chcp 65001 >nul 2>nul
cd /d "%~dp0..\.."
set "GACHABOARD_ROOT=%CD%"
REM Helper when EXE cwd is wrong; normally double-click the portable EXE in repo root.
if exist "%GACHABOARD_ROOT%\Gachaboard 0.1.0.exe" (start "" "%GACHABOARD_ROOT%\Gachaboard 0.1.0.exe") else if exist "%GACHABOARD_ROOT%\Gachaboard.exe" (start "" "%GACHABOARD_ROOT%\Gachaboard.exe") else (echo No launcher EXE found. Download from Releases and place it in the repo root. & pause)
