#!/bin/bash
# Mac でダブルクリックして起動（start.sh と同一）
cd "$(dirname "$0")"
exec bash scripts/start/launcher.sh "$@"
