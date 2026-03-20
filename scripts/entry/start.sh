#!/bin/bash
# Repo root, then Mac/Linux launcher
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
exec bash "$ROOT/scripts/start/launcher.sh" "$@"
