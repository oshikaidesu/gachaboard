#!/bin/bash
# macOS double-click entry (same behavior as start.sh)
_ENTRY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$_ENTRY_DIR/../.." && pwd)"
cd "$ROOT" || exit 1
exec bash "$ROOT/scripts/start/launcher.sh" "$@"
