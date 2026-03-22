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
  if [[ -f "$PGDATA/postmaster.pid" ]]; then
    echo ">>> 既存の PostgreSQL を停止しています..."
    pg_ctl -D "$PGDATA" stop -m fast 2>/dev/null || true
    rm -f "$PGDATA/postmaster.pid" 2>/dev/null || true
    sleep 2
  fi
  echo ">>> PostgreSQL を起動しています..."
  pg_ctl -D "$PGDATA" -l "$DATA_DIR/postgres.log" -o "-p $POSTGRES_PORT" start
  sleep 2
  psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U gachaboard -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='gachaboard'" 2>/dev/null | grep -q 1 || \
    psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U gachaboard -d postgres -c "CREATE DATABASE gachaboard"
  return 0
}

# Credential rotation: 起動毎に PostgreSQL パスワードを変更（CREDENTIAL_ROTATION=1 時）
invoke_credential_rotation() {
  [[ "$CREDENTIAL_ROTATION" == "1" ]] || return 0

  local password_file="$PGDATA/.db-password"
  local runtime_url_file="$DATA_DIR/.runtime-db-url"
  local hba="$PGDATA/pg_hba.conf"
  local new_pass current_pass

  new_random_password() {
    openssl rand -base64 24 2>/dev/null | tr -d '+/=' | head -c 32 || tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c 32
  }

  if [[ -f "$password_file" ]]; then
    current_pass=$(cat "$password_file")
    new_pass=$(new_random_password)
    if PGPASSWORD="$current_pass" psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U gachaboard -d postgres -c "ALTER USER gachaboard WITH PASSWORD '$new_pass'" 2>/dev/null; then
      echo "$new_pass" > "$password_file"
      echo ">>> Credential rotation: PostgreSQL password rotated"
    else
      echo ">>> Credential rotation: failed (wrong current password?)" >&2
      new_pass="$current_pass"
    fi
  else
    new_pass=$(new_random_password)
    psql -h 127.0.0.1 -p "$POSTGRES_PORT" -U gachaboard -d postgres -c "ALTER USER gachaboard WITH PASSWORD '$new_pass'" 2>/dev/null
    if [[ -f "$hba" ]] && grep -q '127.0.0.1/32.*trust' "$hba" 2>/dev/null; then
      sed -i.bak 's/127\.0\.0\.1\/32[[:space:]]*trust/127.0.0.1\/32 scram-sha-256/' "$hba"
      pg_ctl -D "$PGDATA" reload 2>/dev/null || true
    fi
    echo "$new_pass" > "$password_file"
    echo ">>> Credential rotation: PostgreSQL password set (first run)"
  fi

  # パスワードは A-Za-z0-9 のみなので URL にそのまま使用可能
  echo "DATABASE_URL=\"postgresql://gachaboard:${new_pass}@localhost:${POSTGRES_PORT}/gachaboard\"" > "$runtime_url_file"
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
  if pgrep -f "minio.*server" >/dev/null 2>&1; then
    echo ">>> 既存の MinIO を停止しています..."
    pkill -f "minio.*server" 2>/dev/null || true
    sleep 2
  fi
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

# MinIO: アプリ用 IAM ユーザーを起動毎に作り直す（CREDENTIAL_ROTATION=1 時）
invoke_minio_app_credential_rotation() {
  [[ "$CREDENTIAL_ROTATION" == "1" ]] || return 0

  local bucket="${S3_BUCKET:-my-bucket}"
  [[ -z "$bucket" ]] && bucket="my-bucket"

  MC_BIN=""
  if command -v mc >/dev/null 2>&1; then
    MC_BIN="mc"
  elif [[ -f "$BIN_DIR/mc" ]] && [[ -x "$BIN_DIR/mc" ]]; then
    MC_BIN="$BIN_DIR/mc"
  else
    echo ">>> MinIO Client (mc) をダウンロードしています（S3 ローテーション用）..."
    case "$(uname -s)" in
      Linux)
        arch=$(uname -m)
        case "$arch" in
          x86_64)  mc_arch="linux-amd64" ;;
          aarch64|arm64) mc_arch="linux-arm64" ;;
          *) echo ">>> MinIO S3 rotation: 未対応アーキテクチャ $arch"; return 0 ;;
        esac
        curl -sSL -o "$BIN_DIR/mc" "https://dl.min.io/client/mc/release/${mc_arch}/mc"
        chmod +x "$BIN_DIR/mc"
        MC_BIN="$BIN_DIR/mc"
        ;;
      Darwin)
        arch=$(uname -m)
        case "$arch" in
          x86_64)  mc_arch="darwin-amd64" ;;
          arm64)   mc_arch="darwin-arm64" ;;
          *) echo ">>> MinIO S3 rotation: 未対応アーキテクチャ $arch"; return 0 ;;
        esac
        curl -sSL -o "$BIN_DIR/mc" "https://dl.min.io/client/mc/release/${mc_arch}/mc"
        chmod +x "$BIN_DIR/mc"
        MC_BIN="$BIN_DIR/mc"
        ;;
      *)
        echo ">>> MinIO S3 rotation: この OS では mc の自動取得は未対応"
        return 0
        ;;
    esac
  fi

  export MC_CONFIG_DIR="$DATA_DIR/mc-config"
  mkdir -p "$MC_CONFIG_DIR"

  local alias_name="gacharb"
  local endpoint="http://127.0.0.1:${MINIO_API_PORT}"

  if ! "$MC_BIN" alias set "$alias_name" "$endpoint" minioadmin minioadmin 2>/dev/null; then
    echo ">>> MinIO S3 rotation: mc alias に失敗しました（MinIO は起動していますか？）"
    return 0
  fi

  "$MC_BIN" mb --ignore-existing "${alias_name}/${bucket}" 2>/dev/null || true

  local app_user_file="$MINIO_DATA/.app-s3-user"
  local runtime_s3_file="$DATA_DIR/.runtime-s3-env"
  local old_key=""
  [[ -f "$app_user_file" ]] && old_key=$(tr -d '\r\n' < "$app_user_file")

  local new_key="gba$(openssl rand -hex 8 2>/dev/null || printf '%x%x' "$RANDOM" "$RANDOM")"
  [[ ${#new_key} -gt 20 ]] && new_key="${new_key:0:20}"
  local new_secret
  new_secret=$(openssl rand -base64 24 2>/dev/null || echo "")
  [[ -z "$new_secret" ]] && new_secret=$(head -c 32 /dev/urandom 2>/dev/null | base64 | head -c 40)

  if ! "$MC_BIN" admin user add "$alias_name" "$new_key" "$new_secret" 2>/dev/null; then
    echo ">>> MinIO S3 rotation: admin user add に失敗しました"
    return 0
  fi

  if ! "$MC_BIN" admin policy attach "$alias_name" readwrite --user "$new_key" 2>/dev/null; then
    echo ">>> MinIO S3 rotation: policy attach に失敗しました"
    "$MC_BIN" admin user remove "$alias_name" "$new_key" 2>/dev/null || true
    return 0
  fi

  if [[ -n "$old_key" && "$old_key" != "$new_key" ]]; then
    "$MC_BIN" admin user remove "$alias_name" "$old_key" 2>/dev/null || true
  fi

  printf '%s' "$new_key" > "$app_user_file"
  {
    echo "AWS_ACCESS_KEY_ID=\"$new_key\""
    echo "AWS_SECRET_ACCESS_KEY=\"$new_secret\""
  } > "$runtime_s3_file"
  echo ">>> MinIO S3 rotation: app access key rotated"
}

start_sync_server() {
  if pgrep -f "sync-server.*server.mjs" >/dev/null 2>&1; then
    echo ">>> 既存の sync-server を停止しています..."
    pkill -f "sync-server.*server.mjs" 2>/dev/null || true
    sleep 1
  fi
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti ":$SYNC_PORT" 2>/dev/null) || true
    if [[ -n "$pids" ]]; then
      echo ">>> ポート $SYNC_PORT を解放しています..."
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
  fi
  echo ">>> sync-server を起動しています..."
  mkdir -p "$SYNC_DATA"
  (cd "$ROOT_DIR/nextjs-web/sync-server" && PORT="$SYNC_PORT" HOST="0.0.0.0" YPERSISTENCE="$SYNC_DATA" node server.mjs &)
  sleep 1
  return 0
}

cd "$ROOT_DIR"
start_postgres || exit 1
invoke_credential_rotation
start_minio || exit 1
invoke_minio_app_credential_rotation
start_sync_server || exit 1
echo ">>> 依存サービス起動完了（PostgreSQL, MinIO, sync-server）"
