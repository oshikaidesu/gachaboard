# Gachaboard launcher

Electron desktop launcher: first-run wizard for Discord, starts the stack in Tailscale mode by default, system tray support.

## Development

From the repo root:

```bash
npm run launcher
```

Or:

```bash
cd launcher && npm run start
```

**Note:** The launcher treats the project root (parent of `launcher/`) as the app root. `scripts/win/run.ps1`, `nextjs-web/`, etc. must live directly under that folder.

## Build

```bash
cd launcher
npm run build        # all configured targets
npm run build:win    # Windows portable
npm run build:mac    # macOS (dmg)
npm run build:linux  # Linux (AppImage)
```

Artifacts go to `launcher/dist/`.

## Distribution

Put the built portable exe (e.g. `Gachaboard 0.1.0.exe`) at the **project folder root**. Users clone or unzip the project, place the exe there, and **double-click** it. The exe directory is the app root when no project path is saved. If the working directory is wrong, use `scripts/entry/run-launcher.bat`.

## GitHub Releases

Pushing a `v*` tag runs `.github/workflows/release-build.yml`, which builds and uploads artifacts such as:

- `gachaboard-dist.zip` — full tree (without `node_modules`)
- `Gachaboard 0.1.0.exe` — portable (no installer)
- `Gachaboard Setup 0.1.0.exe` — NSIS installer (if enabled in workflow)

## Updates

Use the in-app “Latest on Releases” link or open [Releases](https://github.com/oshikaidesu/gachaboard/releases). Replace the exe inside your existing project folder; `.env.local` and `data/` stay as-is.
