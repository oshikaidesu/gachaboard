#!/bin/bash
# Mac でダブルクリックして起動（launcher に委譲）
cd "$(dirname "$0")"
exec bash scripts/start/launcher.sh "$@"
