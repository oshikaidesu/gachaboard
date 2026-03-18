#!/usr/bin/env bash
# ポータブル版: PostgreSQL, MinIO, sync-server をネイティブ起動（Docker 不要）
set -e

ROOT_DIR="${1:-.}"
[[ "$ROOT_DIR" == "." ]] && ROOT_DIR="$(pwd)"
DATA_DIR="${GACHABOARD_DATA_DIR:-$ROOT_DIR/data}"
BIN_DIR="$ROOT_DIR/portable/bin"
mkdir -p "$DATA_DIR" "$BIN_DIR"

POSTGRES_PORT="${POSTGRES_HOST_PORT:-18581}"
MINIO_API_PORT="${MINIO_API_HOST_PORT:-18583}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_HOST_PORT:-18584}"
SYNC_PORT="${SYNC_SERVER_HOST_PORT:-18582}"

PGDATA="$DATA_DIR/postgres"
MINIO_DATA="$DATA_DIR/minio"
SYNC_DATA="$DATA_DIR/sync"

start_postgres() {
  if ! command -v pg_isready >/dev/null 2>&1; then
    echo "❌ PostgreSQL が見つかりません。インストール: sudo apt install postgresql (Ubuntu) / brew install postgresql (Mac)"
    return 1
  fi
  if pg_isready -h 127.0.0.1 -p "$POSTGRES_PORT" -U gachaboard -q 2>/dev/null; then
    return 0
  fi
  if [[ ! -d "$PGDATA" ]]; then
    echo ">>> PostgreSQL を初期化しています（初回のみ）..."
    initdb -D "$PGDATA" -U gachaboard --auth=trust --locale=C
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
    echo "port = $POSTGRES_PORT" >> "$PGDATA/postgresql.conf"
  fi
  echo ">>> PostgreSQL を起動しています..."
  pg_ctl -D "$PGDATA" -l "$DATA_DIR/postgres.log" -o "-p $POSTGRES_PORT" start
  sleep 2
  psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U gachaboard -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='gachaboard'" 2>/dev/null | grep -q 1 || \
    psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U gachaboard -d postgres -c "CREATE DATABASE gachaboard"
  return 0
}

start_minio() {
  MINIO_BIN=""
  if command -v minio >/dev/null 2>&1; then
    MINIO_BIN="minio"
  elif [[ -f "$BIN_DIR/minio" ]] && [[ -x "$BIN_DIR/minio" ]]; then
    MINIO_BIN="$BIN_DIR/minio"
  fi

  if [[ -z "$MINIO_BIN" ]]; then
    echo ">>> MinIO をダウンロードしています（初回のみ）..."
    case "$(uname -s)" in
      Linux)
        arch=$(uname -m)
        case "$arch" in
          x86_64)  minio_arch="linux-amd64" ;;
          aarch64|arm64) minio_arch="linux-arm64" ;;
          *) echo "❌ 未対応のアーキテクチャ: $arch"; return 1 ;;
        esac
        curl -sSL -o "$BIN_DIR/minio" "https://dl.min.io/server/minio/release/${minio_arch}/minio"
        chmod +x "$BIN_DIR/minio"
        MINIO_BIN="$BIN_DIR/minio"
        ;;
      Darwin)
        arch=$(uname -m)
        case "$arch" in
          x86_64)  minio_arch="darwin-amd64" ;;
          arm64)   minio_arch="darwin-arm64" ;;
          *) echo "❌ 未対応のアーキテクチャ: $arch"; return 1 ;;
        esac
        curl -sSL -o "$BIN_DIR/minio" "https://dl.min.io/server/minio/release/${minio_arch}/minio"
        chmod +x "$BIN_DIR/minio"
        MINIO_BIN="$BIN_DIR/minio"
        ;;
      *)
        echo "❌ MinIO の自動ダウンロードは Linux/Mac のみ。手動で portable/bin/minio を配置してください。"
        return 1
        ;;
    esac
  fi

  mkdir -p "$MINIO_DATA"
  if ! pgrep -f "minio.*server" >/dev/null 2>&1; then
    echo ">>> MinIO を起動しています..."
    MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
      "$MINIO_BIN" server "$MINIO_DATA" --console-address "127.0.0.1:$MINIO_CONSOLE_PORT" --address "127.0.0.1:$MINIO_API_PORT" &
    sleep 2
  fi
  for i in $(seq 1 15); do
    if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$MINIO_API_PORT/minio/health/live" 2>/dev/null | grep -q 200; then
      return 0
    fi
    sleep 1
  done
  echo "⚠ MinIO の起動を待機中..."
  return 0
}

start_sync_server() {
  if pgrep -f "sync-server.*server.mjs" >/dev/null 2>&1; then
    return 0
  fi
  echo ">>> sync-server を起動しています..."
  mkdir -p "$SYNC_DATA"
  (cd "$ROOT_DIR/nextjs-web/sync-server" && PORT="$SYNC_PORT" HOST="0.0.0.0" YPERSISTENCE="$SYNC_DATA" node server.mjs &)
  sleep 1
  return 0
}

cd "$ROOT_DIR"
start_postgres || exit 1
start_minio || exit 1
start_sync_server || exit 1
echo ">>> 依存サービス起動完了（PostgreSQL, MinIO, sync-server）"
