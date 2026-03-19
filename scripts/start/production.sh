#!/usr/bin/env bash
# Gachaboard 本番サーバー起動 (Mac / Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SCRIPTS_DIR")"
source "$SCRIPTS_DIR/lib/common.sh"
cd "$ROOT_DIR"

echo "=== Gachaboard 本番サーバー起動 ==="

check_required || exit 1
check_env_exists "$ROOT_DIR" || exit 1
ensure_env_symlink "$ROOT_DIR"

echo ">>> 1. ポート変数を同期"
bash "$SCRIPTS_DIR/lib/sync-env-ports.sh" 2>/dev/null || true
echo ">>> 2. 依存サービス起動 (PostgreSQL, MinIO, Sync Server)"
run_native_services || exit 1
wait_for_postgres || exit 1

echo ">>> 3. パッケージ・DB セットアップ"
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy || { npx prisma migrate resolve --applied 20250318120000_init && npx prisma migrate deploy; } || exit 1

echo ">>> 4. 本番サーバー起動（既存ビルド）"
# ビルドが必要な場合: npm run build
if [[ -f ../.env ]]; then
  port_val=$(grep -E '^PORT=' ../.env 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  [[ -n "$port_val" ]] && export PORT="$port_val"
fi
APP_URL="http://localhost:${PORT:-18580}"
kill_app_port "${PORT:-18580}"
npm run start &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true; exit" EXIT INT TERM

echo "    サーバーの起動を待機中..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" 2>/dev/null | grep -qE "200|302|307"; then
    echo "    準備完了 (${i}秒)"
    break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo "    ⚠ タイムアウト。ブラウザは手動で $APP_URL を開いてください"
    break
  fi
done

open_app_url "$APP_URL"

wait $SERVER_PID
