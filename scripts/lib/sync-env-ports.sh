#!/usr/bin/env bash
# ポート変数（PORT, POSTGRES_HOST_PORT 等）から派生する値を .env に同期
# ユーザーはポートだけ編集すればよい。DATABASE_URL, S3_*, NEXT_PUBLIC_SYNC_WS_URL 等は自動反映
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
# 正本は nextjs-web/.env.local。プロジェクトルートの .env はそのシンボリックリンク
ENV_FILE="${ROOT_DIR}/.env"
[[ -f "$ENV_FILE" ]] || ENV_FILE="${ROOT_DIR}/nextjs-web/.env.local"
[[ ! -f "$ENV_FILE" ]] && exit 0

# ポート変数を読み取り（デフォルト値付き）
get_var() {
  local key="$1"
  local default="$2"
  local val
  val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  echo "${val:-$default}"
}

PORT=$(get_var PORT 18580)
POSTGRES_HOST_PORT=$(get_var POSTGRES_HOST_PORT 18581)
SYNC_SERVER_HOST_PORT=$(get_var SYNC_SERVER_HOST_PORT 18582)
MINIO_API_HOST_PORT=$(get_var MINIO_API_HOST_PORT 18583)

# 指定キーの値を更新（既存行を置換、なければ追加）
update_env_var() {
  local key="$1"
  local new_val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    tmp=$(mktemp)
    awk -v k="$key" -v v="$new_val" 'index($0, k "=")==1 {print k "=" v; next} {print}' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "${key}=${new_val}" >> "$ENV_FILE"
  fi
}

# DATABASE_URL: localhost:PORT の部分を置換
if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
  current=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2-)
  new_url=$(echo "$current" | sed "s|@localhost:[0-9]*/|@localhost:${POSTGRES_HOST_PORT}/|")
  update_env_var "DATABASE_URL" "$new_url"
fi

# S3_ENDPOINT（内部用は常に localhost）
update_env_var "S3_ENDPOINT" "http://localhost:${MINIO_API_HOST_PORT}"
# S3_PUBLIC_URL: Tailscale（NEXTAUTH_URL が https）のときは空にして getS3PublicUrl() に https://ホスト/minio を導出させる
NEXTAUTH_VAL=$(get_var NEXTAUTH_URL "")
if echo "$NEXTAUTH_VAL" | grep -qE "^https://"; then
  update_env_var "S3_PUBLIC_URL" ""
else
  update_env_var "S3_PUBLIC_URL" "http://localhost:${MINIO_API_HOST_PORT}"
fi

# NEXT_PUBLIC_SYNC_WS_URL, SYNC_SERVER_INTERNAL_URL
update_env_var "NEXT_PUBLIC_SYNC_WS_URL" "ws://localhost:${SYNC_SERVER_HOST_PORT}"
update_env_var "SYNC_SERVER_INTERNAL_URL" "http://127.0.0.1:${SYNC_SERVER_HOST_PORT}"

# NEXTAUTH_URL: localhost の場合のみ PORT を反映
if grep -q "^NEXTAUTH_URL=" "$ENV_FILE"; then
  current=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" | cut -d= -f2-)
  if echo "$current" | grep -qE "^http://localhost:[0-9]+"; then
    update_env_var "NEXTAUTH_URL" "http://localhost:${PORT}"
  fi
fi
