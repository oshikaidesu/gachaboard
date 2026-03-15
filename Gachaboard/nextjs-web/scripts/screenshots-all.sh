#!/usr/bin/env bash
# スクリーンショット取得を一括実行（シード → サーバ起動 → 撮影）
set -e
cd "$(dirname "$0")/.."

echo "=== 1. 既存の E2E サーバを停止 ==="
pkill -f "next dev --port 3010" 2>/dev/null || true
pkill -f "y-websocket-server" 2>/dev/null || true
lsof -ti:5860 | xargs kill -9 2>/dev/null || true
lsof -ti:3010 | xargs kill -9 2>/dev/null || true
sleep 2

echo "=== 2. シード投入 ==="
npm run seed:e2e

echo "=== 3. E2E サーバを起動（バックグラウンド） ==="
npm run e2e:server &
E2E_PID=$!
trap "kill $E2E_PID 2>/dev/null || true; exit" EXIT INT TERM

echo "=== 4. サーバの起動を待機 ==="
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3010 2>/dev/null | grep -qE "200|302|307"; then
    echo "  Ready (${i}秒)"
    sleep 3
    break
  fi
  echo "  待機中... ($i/30)"
  sleep 1
  if [ $i -eq 30 ]; then
    echo "❌ タイムアウト: E2E サーバが起動しませんでした"
    exit 1
  fi
done

echo "=== 5. スクリーンショット取得 ==="
npm run screenshots

echo "=== 完了 ==="
kill $E2E_PID 2>/dev/null || true
