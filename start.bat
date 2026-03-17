@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"

wsl --status >nul 2>&1
if errorlevel 1 (
  echo.
  echo ============================================
  echo   WSL2 is not installed.
  echo ============================================
  echo.
  echo   WSL2 is required on Windows. Run in Admin PowerShell:
  echo     wsl --install -d Ubuntu
  echo   Then reboot. See docs/user/WSL2-SETUP.md
  echo.
  echo ============================================
  pause
  exit /b 1
)

wsl --cd "%~dp0" bash -c "sed -i 's/\r$//' scripts/setup/wsl2-install-deps.sh scripts/start/tailscale.sh scripts/start/launcher.sh scripts/lib/common.sh 2>/dev/null; bash scripts/start/launcher.sh %*"
echo.
pause
