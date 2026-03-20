# Windows startup scripts

## Layout

| File | Purpose |
|------|---------|
| **run.ps1** | Main startup (PostgreSQL / MinIO / sync-server + Next.js) |
| **reset-services.ps1** | Stop all services |
| **sync-env-tailscale.ps1** | Update `.env.local` for Tailscale HTTPS |
| **setup-auto-start.ps1** | Register logon task for `scripts/entry/start.bat` |

## Entry point

Double-click **`scripts/entry/start.bat`**.

| Key | Mode |
|-----|------|
| 1 | Tailscale production (default) |
| 2 | Localhost production |
| 3 | Build only |
| 4 | Tailscale development |
| 5 | Local development |
| 6 | Reset and restart |
| 0 | Exit |

## Direct run

`scripts/entry/start.bat` forwards arguments; the menu reads optional 2nd/3rd args if you extend the batch.

## Auto-start

```powershell
.\scripts\win\setup-auto-start.ps1
```
