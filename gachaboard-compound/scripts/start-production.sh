#!/usr/bin/env bash
# Gachaboard 本番サーバー起動スクリプト (Mac / Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/common.sh"
cd "$ROOT_DIR"

echo "=== Gachaboard 本番サーバー起動 ==="

echo ">>> 1. 依存サービス起動 (PostgreSQL, MinIO, Sync Server)"
docker compose up -d

echo ">>> 2. パッケージ・DB セットアップ"
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push

echo ">>> 3. ビルド"
# npm run build

echo ">>> 4. 本番サーバー起動"
# npm start &
npm run dev &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true; exit" EXIT INT TERM

echo "    サーバーの起動を待機中..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -qE "200|302|307"; then
    echo "    準備完了 (${i}秒)"
    break
  fi
  sleep 1
  if [ $i -eq 60 ]; then
    echo "    ⚠ タイムアウト。ブラウザは手動で http://localhost:3000 を開いてください"
    break
  fi
done

open_app_url "http://localhost:3000"

wait $SERVER_PID
