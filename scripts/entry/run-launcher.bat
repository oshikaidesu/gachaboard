@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0..\.."
REM Helper when EXE cwd is wrong; normally double-click the portable EXE in this folder.
if exist "Gachaboard 0.1.0.exe" (start "" "Gachaboard 0.1.0.exe") else if exist "Gachaboard.exe" (start "" "Gachaboard.exe") else (echo No launcher EXE found. Download from Releases and place it in the repo root. & pause)
