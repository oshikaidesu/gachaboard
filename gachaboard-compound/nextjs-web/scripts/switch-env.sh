#!/usr/bin/env bash
# NEXTAUTH_URL を local / tailscale で切り替える（.env.local を書き換え）
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"
TAILSCALE_HOST="${TAILSCALE_HOST:-uooooooooooo.tail16829c.ts.net}"

case "${1:-}" in
  local)
    NEW_URL="http://localhost:3000"
    MODE="ローカル (localhost)"
    ;;
  tailscale)
    NEW_URL="http://${TAILSCALE_HOST}:3000"
    MODE="Tailscale (${TAILSCALE_HOST})"
    ;;
  *)
    echo "Usage: $0 local | tailscale"
    echo ""
    echo "  local     - NEXTAUTH_URL=http://localhost:3000（通常開発・WebSocket も動作）"
    echo "  tailscale - NEXTAUTH_URL=http://${TAILSCALE_HOST}:3000（スマホからログイン用）"
    echo ""
    echo "別ホストを使う場合: TAILSCALE_HOST=desktop-hn7hdbv-1.tail16829c.ts.net $0 tailscale"
    echo "実行後は Next.js を再起動すること。"
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env.local が見つかりません: $ENV_FILE"
  exit 1
fi

if grep -q '^NEXTAUTH_URL=' "$ENV_FILE"; then
  tmp=$(mktemp)
  sed "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=${NEW_URL}|" "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
else
  echo "NEXTAUTH_URL=${NEW_URL}" >> "$ENV_FILE"
fi

echo "✓ NEXTAUTH_URL を ${MODE} に設定しました: ${NEW_URL}"
echo "  Next.js を起動中なら Ctrl+C で止めてから npm run dev で再起動してください。"
