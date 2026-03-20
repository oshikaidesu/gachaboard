#!/usr/bin/env bash
# Full data reset (PostgreSQL / MinIO / sync data under data/, sync-server sqlite, upload tmp)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
source "$ROOT_DIR/scripts/lib/common.sh"
cd "$ROOT_DIR"

echo "=== Gachaboard full data reset ==="
echo ""
echo "This will:"
echo "  - Stop native services (PostgreSQL, MinIO, sync-server)"
echo "  - Remove data/postgres, data/minio, data/sync"
echo "  - Remove nextjs-web/sync-server/sync-data (Hocuspocus SQLite)"
echo "  - Remove nextjs-web/uploads/tmp"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo
if [[ ! "$REPLY" =~ ^[yY]$ ]]; then
  echo "Cancelled."
  exit 0
fi

reset_native_services

DATA_DIR="${GACHABOARD_DATA_DIR:-$ROOT_DIR/data}"
for dir in "$DATA_DIR/postgres" "$DATA_DIR/minio" "$DATA_DIR/sync"; do
  if [[ -d "$dir" ]]; then
    echo ">>> Removing $dir"
    rm -rf "$dir"
  fi
done

SYNC_DATA="$ROOT_DIR/nextjs-web/sync-server/sync-data"
if [[ -d "$SYNC_DATA" ]]; then
  echo ">>> Removing $SYNC_DATA"
  rm -rf "$SYNC_DATA"
fi

UPLOADS_TMP="$ROOT_DIR/nextjs-web/uploads/tmp"
if [[ -d "$UPLOADS_TMP" ]]; then
  echo ">>> Removing $UPLOADS_TMP"
  rm -rf "$UPLOADS_TMP"
fi

echo ""
echo "Done."
echo ""
echo "Start again:"
echo "  npm run start:local"
echo "  npm run start:tailscale"
echo "  npm run dev:local"
echo ""
