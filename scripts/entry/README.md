# Entry scripts (double-click / first command)

Everything you run **before** digging into `scripts/start/` or `scripts/win/` lives here.

| File | Purpose |
|------|---------|
| `start.bat` | Windows menu → `scripts/win/run.ps1` (after `cd` to repo root) |
| `run-launcher.bat` | Start portable **`Gachaboard 0.1.0.exe`** or **`Gachaboard.exe`** in repo root |
| `!-Gachaboard.bat` | Same as `run-launcher.bat`; sorts first in Explorer in this folder |
| `start.sh` | Mac/Linux → `scripts/start/launcher.sh` |
| `start.command` | macOS double-click → same as `start.sh` |

If macOS says “permission denied”: `chmod +x scripts/entry/start.sh scripts/entry/start.command`
