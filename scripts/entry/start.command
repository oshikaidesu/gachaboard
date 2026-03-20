#!/bin/bash
# macOS double-click entry (same behavior as start.sh)
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
exec bash "$ROOT/scripts/start/launcher.sh" "$@"
