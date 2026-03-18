#!/usr/bin/env bash
# 全データリセット（新規で使い直すとき用）
# 依存サービスを停止し、data/postgres, data/minio, data/sync および sync-server 永続化・一時ファイルを削除
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/lib/common.sh"
cd "$ROOT_DIR"

echo "=== Gachaboard 全データリセット ==="
echo ""
echo "以下が削除されます:"
echo "  - 依存サービス（PostgreSQL, MinIO, sync-server）の停止"
echo "  - data/postgres, data/minio, data/sync"
echo "  - nextjs-web/sync-server/sync-data（Hocuspocus SQLite）"
echo "  - nextjs-web/uploads/tmp（ffmpeg 一時ファイル）"
echo ""
read -p "実行してよいですか? [y/N] " -n 1 -r
echo
if [[ ! "$REPLY" =~ ^[yY]$ ]]; then
  echo "キャンセルしました。"
  exit 0
fi

reset_native_services

DATA_DIR="${GACHABOARD_DATA_DIR:-$ROOT_DIR/data}"
for dir in "$DATA_DIR/postgres" "$DATA_DIR/minio" "$DATA_DIR/sync"; do
  if [[ -d "$dir" ]]; then
    echo ">>> 削除: $dir"
    rm -rf "$dir"
  fi
done

SYNC_DATA="$ROOT_DIR/nextjs-web/sync-server/sync-data"
if [[ -d "$SYNC_DATA" ]]; then
  echo ">>> 削除: $SYNC_DATA"
  rm -rf "$SYNC_DATA"
fi

UPLOADS_TMP="$ROOT_DIR/nextjs-web/uploads/tmp"
if [[ -d "$UPLOADS_TMP" ]]; then
  echo ">>> 削除: $UPLOADS_TMP"
  rm -rf "$UPLOADS_TMP"
fi

echo ""
echo "✅ リセット完了。"
echo ""
echo "起動するには:"
echo "  npm run start:local     # ローカルモード"
echo "  npm run start:tailscale # Tailscale モード"
echo "  npm run dev:local       # 開発モード（ローカル）"
echo ""
