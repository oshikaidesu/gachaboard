#!/usr/bin/env bash
# Gachaboard 起動（Tailscale モード）
# env を Tailscale 用に切り替え、Docker と Next.js を起動
#
# オプション:
#   --dev    npm run dev（開発モード・ホットリロード）
#   --reset  Docker を一度停止してから起動（リセット＆再起動）
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

echo "=== Gachaboard 起動（Tailscale モード）==="

check_required tailscale || exit 1
check_env_exists "$ROOT_DIR" || exit 1
ensure_env_symlink "$ROOT_DIR"

echo ">>> 1. ポート変数を同期"
bash "$SCRIPTS_DIR/lib/sync-env-ports.sh" 2>/dev/null || true
echo ">>> 2. env を Tailscale 用に切り替え"
cd nextjs-web
bash scripts/switch-env.sh tailscale
cd "$ROOT_DIR"

echo ">>> 2.5 Caddyfile を更新（ポートを .env に合わせる）"
CALLED_FROM_START=1 bash "$SCRIPTS_DIR/setup/tailscale-https.sh" || true

echo ">>> 3. 依存サービス起動 (PostgreSQL, MinIO, Sync Server)"
if [[ "$DO_RESET" == true ]]; then
  reset_docker
fi
if ! run_docker_compose_up; then
  echo ""
  echo "❌ Docker サービスの起動に失敗しました。上記のエラーを確認してください。"
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
if [[ -f .env ]]; then
  port_val=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2- | tr -d '"\r')
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

# 表示用 URL（.env から取得。.env は .env.local へのシンボリックリンク）
APP_URL=$(grep '^NEXTAUTH_URL=' "${ROOT_DIR}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"\r' || echo "http://localhost:${PORT:-18580}")
# 起動確認は localhost で行う（Caddy 未起動時も Next.js は localhost で応答する）
READY_URL="http://localhost:${PORT:-18580}"

READY=false
echo "    起動を待機中..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" "$READY_URL" 2>/dev/null | grep -qE "200|302|307"; then
    echo "    準備完了 (${i}秒)"
    READY=true
    break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo "    ⚠ タイムアウト。ブラウザで $READY_URL を開いてください"
    break
  fi
done

if [[ "$READY" == true ]]; then
  # Next.js が起動したあとで Tailscale Serve を設定（502 防止: 転送先が確実に listen している状態にする）
  APP_PORT="${PORT:-18580}"
  SYNC_PORT=$(grep -E '^SYNC_SERVER_HOST_PORT=' "${ROOT_DIR}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  SYNC_PORT="${SYNC_PORT:-18582}"
  if command -v tailscale >/dev/null 2>&1; then
    echo ">>> 5. Tailscale Serve を設定 (/ → :${APP_PORT}, /ws → :${SYNC_PORT})"
    tailscale serve reset 2>/dev/null || true
    tailscale serve --bg "http://127.0.0.1:${APP_PORT}" 2>&1 || true
    tailscale serve --bg --set-path /ws "http://127.0.0.1:${SYNC_PORT}" 2>&1 || true
    echo "    Tailscale Serve: https → localhost:${APP_PORT}, /ws → localhost:${SYNC_PORT}"
  fi
  open_app_url "$APP_URL"
fi

echo ""
echo "アクセスURL: $APP_URL"
echo "スマホ等は Tailscale 接続後に同じ URL でアクセスできます。"
if [[ "$DO_DEV" == true ]]; then
  echo ""
  echo "※ HMR WebSocket が失敗する場合: tailscale serve reset の後、"
  echo "   別ターミナルで caddy run --config Caddyfile を起動（HTTPS で Caddy 経由アクセス）。"
fi
echo "終了: Ctrl+C"
echo "開発モード: bash scripts/start/tailscale.sh --dev"
echo "リセット＆再起動: bash scripts/start/tailscale.sh --reset"
echo ""

wait $SERVER_PID
