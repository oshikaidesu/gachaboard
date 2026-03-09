#!/usr/bin/env bash
# NEXTAUTH_URL を local / tailscale で切り替える（.env.local を書き換え）
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"

# Tailscale ホスト名を自動検出（TAILSCALE_HOST 未設定時）
detect_tailscale_host() {
  if command -v tailscale >/dev/null 2>&1; then
    if command -v jq >/dev/null 2>&1; then
      local dns
      dns=$(tailscale status --json --peers=false 2>/dev/null | jq -r '.Self.DNSName // empty')
      if [[ -n "$dns" && "$dns" != "null" ]]; then
        echo "${dns%.}"  # 末尾の . を削除
        return 0
      fi
    fi
  fi
  return 1
}

case "${1:-}" in
  local)
    NEW_URL="http://localhost:3000"
    MODE="ローカル (localhost)"
    ;;
  tailscale)
    if [[ -z "${TAILSCALE_HOST:-}" ]]; then
      TAILSCALE_HOST=$(detect_tailscale_host) || true
    fi
    if [[ -z "${TAILSCALE_HOST:-}" ]]; then
      echo "Error: Tailscale ホスト名が取得できませんでした。"
      echo ""
      echo "以下のいずれかを実行してください:"
      echo "  1. TAILSCALE_HOST を指定して実行:"
      echo "     TAILSCALE_HOST=your-machine.tail12345.ts.net npm run env:tailscale"
      echo ""
      echo "  2. ホスト名の調べ方:"
      echo "     tailscale status --json --peers=false | jq -r .Self.DNSName"
      echo "     または [Tailscale Admin Console](https://login.tailscale.com/admin/machines) で確認"
      echo ""
      echo "詳細: docs/ENV-AND-DEPLOYMENT-MODES.md の「Tailscale ホスト名の調べ方」を参照"
      exit 1
    fi
    NEW_URL="http://${TAILSCALE_HOST}:3000"
    MODE="Tailscale (${TAILSCALE_HOST})"
    ;;
  *)
    echo "Usage: $0 local | tailscale"
    echo ""
    echo "  local     - NEXTAUTH_URL=http://localhost:3000（通常開発・WebSocket も動作）"
    echo "  tailscale - NEXTAUTH_URL を Tailscale ホストに設定（スマホからログイン用）"
    echo "              TAILSCALE_HOST 未指定時は tailscale status から自動検出を試みます"
    echo ""
    echo "例: TAILSCALE_HOST=your-machine.tail12345.ts.net $0 tailscale"
    echo "実行後は Next.js を再起動すること。"
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env.local が見つかりません: $ENV_FILE"
  echo "先に cp env.local.template .env.local を実行してください。"
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
