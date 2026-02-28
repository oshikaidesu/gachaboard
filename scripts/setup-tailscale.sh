#!/usr/bin/env bash
# =============================================================================
# setup-tailscale.sh
#
# Tailscale ホスト名が変わったときに、全設定ファイルを一括更新するスクリプト。
#
# 使い方:
#   chmod +x scripts/setup-tailscale.sh
#   ./scripts/setup-tailscale.sh
#
# または新しいホスト名を引数で渡す:
#   ./scripts/setup-tailscale.sh uooooooooooo.tail16829c.ts.net
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------- 1. Tailscale ホスト名を取得 ----------

if [[ $# -ge 1 ]]; then
  NEW_HOST="$1"
  echo "ホスト名を引数から取得: $NEW_HOST"
else
  # tailscale コマンドで自動取得を試みる
  TAILSCALE_BIN=""
  for candidate in \
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale" \
    "$(which tailscale 2>/dev/null || true)"; do
    if [[ -x "$candidate" ]]; then
      TAILSCALE_BIN="$candidate"
      break
    fi
  done

  if [[ -n "$TAILSCALE_BIN" ]]; then
    NEW_HOST=$("$TAILSCALE_BIN" status --json 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Self']['DNSName'].rstrip('.'))" \
      2>/dev/null || true)
  fi

  if [[ -z "${NEW_HOST:-}" ]]; then
    echo "Tailscale ホスト名を自動取得できませんでした。"
    echo "手動で入力してください（例: uooooooooooo.tail16829c.ts.net）:"
    read -r NEW_HOST
  else
    echo "Tailscale ホスト名を自動取得: $NEW_HOST"
  fi
fi

if [[ -z "$NEW_HOST" ]]; then
  echo "エラー: ホスト名が空です。" >&2
  exit 1
fi

NEW_URL="https://${NEW_HOST}"

# ---------- 2. 現在の設定を読み取る ----------

ENV_FILE="$ROOT_DIR/nextjs-web/.env.local"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
NEXT_CONFIG="$ROOT_DIR/nextjs-web/next.config.ts"

# .env.local から現在のURLを取得
CURRENT_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || echo "")

if [[ "$CURRENT_URL" == "$NEW_URL" ]]; then
  echo "設定は既に最新です: $NEW_URL"
  echo "変更は不要です。"
  exit 0
fi

echo ""
echo "変更内容:"
echo "  現在: ${CURRENT_URL:-（未設定）}"
echo "  新規: $NEW_URL"
echo ""
echo "以下のファイルを更新します:"
echo "  - nextjs-web/.env.local"
echo "  - docker-compose.yml"
echo "  - nextjs-web/next.config.ts"
echo ""
read -r -p "続行しますか？ [y/N]: " confirm
if [[ "${confirm,,}" != "y" ]]; then
  echo "キャンセルしました。"
  exit 0
fi

# ---------- 3. ファイル更新 ----------

# 現在のホスト名（URLからhttps://を除いた部分）
CURRENT_HOST="${CURRENT_URL#https://}"

# .env.local
sed -i.bak \
  "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=${NEW_URL}|g" \
  "$ENV_FILE"
echo "✓ nextjs-web/.env.local を更新"

# docker-compose.yml
sed -i.bak \
  "s|NEXTAUTH_URL:.*tail.*|NEXTAUTH_URL: \"${NEW_URL}\"|g" \
  "$COMPOSE_FILE"
echo "✓ docker-compose.yml を更新"

# next.config.ts — allowedDevOrigins の配列内のホスト名を置換
if [[ -n "$CURRENT_HOST" ]]; then
  sed -i.bak \
    "s|\"${CURRENT_HOST}\"|\"${NEW_HOST}\"|g" \
    "$NEXT_CONFIG"
else
  # 現在のホスト名が不明な場合は tail*.ts.net パターンで置換
  sed -i.bak \
    "s|\"[a-z0-9-]*\.tail[0-9a-z]*\.ts\.net\"|\"${NEW_HOST}\"|g" \
    "$NEXT_CONFIG"
fi
echo "✓ nextjs-web/next.config.ts を更新"

# バックアップファイルを削除
rm -f "$ENV_FILE.bak" "$COMPOSE_FILE.bak" "$NEXT_CONFIG.bak"

# ---------- 4. tailscale serve の再設定 ----------

echo ""
echo "========================================="
echo "ファイル更新完了！"
echo "========================================="
echo ""
echo "次のステップ:"
echo ""
echo "【1】tailscale serve を再設定（ターミナルで実行）:"
echo ""
echo "  # 既存設定をリセット"
echo "  sudo tailscale serve reset"
echo ""
echo "  # Next.js をルートパスで公開"
echo "  sudo tailscale serve --bg --set-path=/ http://localhost:3000"
echo ""
echo "  # sync-server を /ws パスで公開"
echo "  sudo tailscale serve --bg --set-path=/ws http://localhost:5858"
echo ""
echo "  # 設定確認"
echo "  tailscale serve status"
echo ""
echo "【2】Discord Developer Portal でリダイレクトURIを更新:"
echo "  https://discord.com/developers/applications"
echo "  OAuth2 > Redirects に追加:"
echo "  ${NEW_URL}/api/auth/callback/discord"
echo ""
echo "【3】Dockerを再起動:"
echo "  cd $ROOT_DIR"
echo "  docker compose down && docker compose up -d"
echo ""
echo "【4】ブラウザで確認:"
echo "  ${NEW_URL}"
