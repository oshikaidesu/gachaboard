#!/bin/bash
# Mac/Linux 共通起動（launcher に委譲）
# Mac: start.command から呼ばれる（ダブルクリック用）
# Linux: ./start.sh または bash start.sh
cd "$(dirname "$0")"
exec bash scripts/start/launcher.sh "$@"
