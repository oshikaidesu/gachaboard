#!/usr/bin/env bash
# 全データリセット（新規で使い直すとき用）
# - Docker: コンテナとボリュームを削除（PostgreSQL / MinIO / sync-server のデータが消える）
# - ローカルで sync-server を動かしている場合: sync-server の永続化ディレクトリを削除
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/lib/common.sh"
cd "$ROOT_DIR"

echo "=== Gachaboard 全データリセット ==="
echo ""
echo "以下が削除されます:"
echo "  - Docker: PostgreSQL / MinIO / sync-server のボリューム（コンテナも停止）"
echo "  - ローカル: nextjs-web/sync-server/sync-data（Hocuspocus SQLite）"
echo "  - ローカル: nextjs-web/uploads/tmp（ffmpeg 一時ファイル）"
echo ""
read -p "実行してよいですか? [y/N] " -n 1 -r
echo
if [[ ! "$REPLY" =~ ^[yY]$ ]]; then
  echo "キャンセルしました。"
  exit 0
fi

reset_docker_volumes

# ローカルで sync-server を動かしているときの永続化ディレクトリ
SYNC_DATA="$ROOT_DIR/nextjs-web/sync-server/sync-data"
if [[ -d "$SYNC_DATA" ]]; then
  echo ">>> 削除: $SYNC_DATA"
  rm -rf "$SYNC_DATA"
fi

# ffmpeg 一時ファイル
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
