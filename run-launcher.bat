@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"
REM exe の cwd が合わない場合の補助。通常は exe を直接実行すればよい
if exist "Gachaboard 1.0.0.exe" (start "" "Gachaboard 1.0.0.exe") else if exist "Gachaboard.exe" (start "" "Gachaboard.exe") else (echo exe が見つかりません。Releases からダウンロードし、このフォルダに配置してください。& pause)
