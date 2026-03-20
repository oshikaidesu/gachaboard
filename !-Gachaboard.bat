@echo off
REM エクスプローラー一覧の先頭に置くためファイル名を「!-」で開始しています（run-launcher.bat と同等）。
chcp 65001 >nul 2>nul
cd /d "%~dp0"
call "%~dp0run-launcher.bat"
