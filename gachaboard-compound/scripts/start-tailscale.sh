#!/usr/bin/env bash
# Gachaboard 起動スクリプト（Tailscale モード・デフォルト）
# env を Tailscale 用に切り替え、Docker と Next.js を起動
#
# オプション:
#   --reset   Docker を一度停止してから起動（リセット＆再起動）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/common.sh"
cd "$ROOT_DIR"

DO_RESET=false
for arg in "$@"; do
  [[ "$arg" == "--reset" ]] && DO_RESET=true
done

echo "=== Gachaboard 起動（Tailscale モード）==="

# TAILSCALE_HOST を渡す場合: TAILSCALE_HOST=your-machine.tail12345.ts.net bash scripts/start-tailscale.sh
echo ">>> 1. env を Tailscale 用に切り替え"
cd nextjs-web
bash scripts/switch-env.sh tailscale
cd "$ROOT_DIR"

echo ">>> 2. 依存サービス起動 (PostgreSQL, MinIO, Sync Server)"
if [[ "$DO_RESET" == true ]]; then
  reset_docker
fi
if ! run_docker_compose_up; then
  echo ""
  echo "❌ Docker に接続できません。Docker Desktop を起動してから再試行してください。"
  echo "   macOS: open -a Docker"
  exit 1
fi

echo ">>> 3. アプリ起動"
kill_port_3000
cd nextjs-web
npm run dev &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true; exit" EXIT INT TERM

# NEXTAUTH_URL を取得してブラウザで開く
APP_URL=$(grep '^NEXTAUTH_URL=' .env.local 2>/dev/null | cut -d= -f2- || echo "http://localhost:3000")

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
echo "スマホ等は Tailscale 接続後に同じ URL でアクセスできます。"
echo "終了: Ctrl+C"
echo "リセット＆再起動: bash scripts/start-tailscale.sh --reset"
echo ""

wait $SERVER_PID
