# scripts

## Environment variables

- **Only file:** `nextjs-web/.env.local` (not committed)
- **Template:** `.env.example` at repo root (copied by `npm run setup:env` / launcher wizard)

No root `.env` and no symlinks. Legacy root `.env` is migrated or removed on first run of `setup:env` / `drop_legacy_root_env`.

- **Mac/Linux:** `setup/env.sh`
- **Windows:** `setup/env.ps1` (via `run-env.ps1` from `npm run setup:env`)

## Layout

```
scripts/
├── entry/        # All user-facing start helpers (see entry/README.md)
├── lib/
│   ├── common.sh
│   └── sync-env-ports.sh   # updates derived keys in nextjs-web/.env.local
├── start/
│   ├── launcher.sh
│   ├── tailscale.sh
│   ├── local.sh
│   └── production.sh
├── setup/
│   ├── env.sh, env.ps1, run-env-setup.mjs, run-env.ps1
│   ├── reset-all.sh
│   └── tailscale-https.sh
├── win/
│   ├── run.ps1, reset-services.ps1, sync-env-*.ps1, …
└── systemd/
```

## Usage

```bash
./scripts/entry/start.sh
bash scripts/start/tailscale.sh --dev
bash scripts/setup/env.sh
```

**Windows:** double-click `scripts/entry/start.bat`.

### Tailscale + Caddy

`tailscale.sh` may run `setup/tailscale-https.sh` to refresh `config/Caddyfile` from ports in `nextjs-web/.env.local`. Run Caddy separately if needed.
