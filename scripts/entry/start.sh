#!/bin/bash
# Repo root (this file lives in scripts/entry), then Mac/Linux launcher
_ENTRY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$_ENTRY_DIR/../.." && pwd)"
cd "$ROOT" || exit 1
exec bash "$ROOT/scripts/start/launcher.sh" "$@"
