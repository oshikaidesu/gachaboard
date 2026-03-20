#!/usr/bin/env bash
# Gachaboard 起動（ローカルモード）
# env を localhost 用に切り替え、Postgres/MinIO/sync をネイティブ起動してから Next.js を起動
#
# オプション:
#   --dev    npm run dev（開発モード・ホットリロード）
#   --reset  依存サービスを一度停止してから起動（リセット＆再起動）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SCRIPTS_DIR")"
source "$SCRIPTS_DIR/lib/common.sh"
cd "$ROOT_DIR"

DO_RESET=false
DO_DEV=false
for arg in "$@"; do
  [[ "$arg" == "--reset" ]] && DO_RESET=true
  [[ "$arg" == "--dev" ]] && DO_DEV=true
done

echo "=== Gachaboard 起動（ローカルモード）==="

check_required || exit 1
check_env_exists "$ROOT_DIR" || exit 1
drop_legacy_root_env "$ROOT_DIR"
check_discord_env "$ROOT_DIR" || exit 1

if [[ ! -d "$ROOT_DIR/nextjs-web/node_modules" ]]; then
  echo ">>> nextjs-web の依存をインストールしています（初回のみ）..."
  (cd "$ROOT_DIR/nextjs-web" && npm install) || exit 1
  echo ""
fi
if [[ ! -d "$ROOT_DIR/nextjs-web/sync-server/node_modules" ]]; then
  echo ">>> sync-server の依存をインストールしています（初回のみ）..."
  (cd "$ROOT_DIR/nextjs-web/sync-server" && npm install) || exit 1
  echo ""
fi

echo ">>> 1. ポート変数を同期"
bash "$SCRIPTS_DIR/lib/sync-env-ports.sh" 2>/dev/null || true
echo ">>> 2. env をローカル用に切り替え"
cd nextjs-web
bash scripts/switch-env.sh local
cd "$ROOT_DIR"

echo ">>> 3. 依存サービス起動 (PostgreSQL, MinIO, Sync Server)"
if [[ "$DO_RESET" == true ]]; then
  reset_native_services
fi
if ! run_native_services; then
  echo ""
  echo "❌ 依存サービスの起動に失敗しました。上記のエラーを確認してください。"
  exit 1
fi

wait_for_postgres || exit 1
apply_prisma_schema "$ROOT_DIR"

if [[ "$DO_DEV" != true ]] && [[ ! -f "nextjs-web/.next/BUILD_ID" ]]; then
  echo ">>> 本番ビルドが見つかりません。ビルドを実行します..."
  cd nextjs-web
  npm run build
  cd "$ROOT_DIR"
fi
if [[ "$DO_DEV" == true ]]; then
  echo ">>> 4. アプリ起動（開発モード）"
else
  echo ">>> 4. アプリ起動（本番モード）"
fi
if [[ -f nextjs-web/.env.local ]]; then
  port_val=$(grep -E '^PORT=' nextjs-web/.env.local 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  [[ -n "$port_val" ]] && export PORT="$port_val"
fi
kill_app_port "${PORT:-18580}"
cd nextjs-web
if [[ "$DO_DEV" == true ]]; then
  npm run dev &
else
  npm run start &
fi
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true; rm -f \"\${GACHABOARD_START_LOCK:-}\" 2>/dev/null || true; exit" EXIT INT TERM

APP_URL="http://localhost:${PORT:-18580}"

READY=false
echo "    起動を待機中..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" 2>/dev/null | grep -qE "200|302|307"; then
    echo "    準備完了 (${i}秒)"
    READY=true
    break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo "    ⚠ タイムアウト。ブラウザで $APP_URL を開いてください"
    break
  fi
done

if [[ "$READY" == true ]]; then
  open_app_url "$APP_URL"
fi

echo ""
echo "アクセスURL: $APP_URL"
echo "Discord でログインするには: Discord Developer Portal → OAuth2 → Redirects に追加: $APP_URL/api/auth/callback/discord"
echo "終了: Ctrl+C"
echo "開発モード: bash scripts/start/local.sh --dev"
echo "リセット＆再起動: bash scripts/start/local.sh --reset"
echo ""

wait $SERVER_PID
