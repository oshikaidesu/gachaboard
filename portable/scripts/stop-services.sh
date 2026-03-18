#!/usr/bin/env bash
# ネイティブ起動した PostgreSQL, MinIO, sync-server を停止（--reset 用）
set -e

ROOT_DIR="${1:-.}"
[[ "$ROOT_DIR" == "." ]] && ROOT_DIR="$(pwd)"
DATA_DIR="${GACHABOARD_DATA_DIR:-$ROOT_DIR/data}"
PGDATA="$DATA_DIR/postgres"

# PostgreSQL
if [[ -d "$PGDATA" ]] && [[ -f "$PGDATA/postmaster.pid" ]]; then
  echo ">>> PostgreSQL を停止しています..."
  if command -v pg_ctl >/dev/null 2>&1; then
    pg_ctl -D "$PGDATA" stop -m fast 2>/dev/null || true
  fi
  rm -f "$PGDATA/postmaster.pid" 2>/dev/null || true
  sleep 1
fi

# MinIO（minio server プロセス）
if pgrep -f "minio.*server" >/dev/null 2>&1; then
  echo ">>> MinIO を停止しています..."
  pkill -f "minio.*server" 2>/dev/null || true
  sleep 1
fi

# sync-server（node server.mjs を nextjs-web/sync-server で起動したもの）
if pgrep -f "nextjs-web/sync-server.*server.mjs" >/dev/null 2>&1; then
  echo ">>> sync-server を停止しています..."
  pkill -f "nextjs-web/sync-server.*server.mjs" 2>/dev/null || true
  sleep 1
fi
# より広いパターン（cwd が sync-server のとき）
if pgrep -f "sync-server.*server.mjs" >/dev/null 2>&1; then
  pkill -f "sync-server.*server.mjs" 2>/dev/null || true
  sleep 1
fi

echo ">>> 依存サービスの停止が完了しました"
