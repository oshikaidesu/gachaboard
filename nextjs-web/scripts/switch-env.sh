#!/usr/bin/env bash
# NEXTAUTH_URL を local / tailscale で切り替える
# Edits nextjs-web/.env.local only
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"

# Tailscale ホスト名を自動検出（TAILSCALE_HOST 未設定時）
# tailscale status --json から取得。jq がなくても grep/sed でフォールバック
detect_tailscale_host() {
  if ! command -v tailscale >/dev/null 2>&1; then
    return 1
  fi
  local json
  json=$(tailscale status --json --peers=false 2>/dev/null) || return 1
  [[ -z "$json" ]] && return 1

  local dns
  if command -v jq >/dev/null 2>&1; then
    dns=$(echo "$json" | jq -r '.Self.DNSName // empty')
  else
    # jq なし: grep/sed で "DNSName":"host.tail12345.ts.net." を抽出
    dns=$(echo "$json" | grep -o '"DNSName"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
  fi

  if [[ -n "$dns" && "$dns" != "null" ]]; then
    echo "${dns%.}"  # 末尾の . を削除
    return 0
  fi
  return 1
}

case "${1:-}" in
  local)
    PORT_VAL="18580"
    if [[ -f "$ENV_FILE" ]]; then
      p=$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
      [[ -n "$p" ]] && PORT_VAL="$p"
    fi
    NEW_URL="http://localhost:${PORT_VAL}"
    MODE="ローカル (localhost:${PORT_VAL})"
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
    NEW_URL="https://${TAILSCALE_HOST}"
    MODE="Tailscale HTTPS (${TAILSCALE_HOST})"
    ;;
  *)
    echo "Usage: $0 local | tailscale"
    echo ""
    echo "  local     - NEXTAUTH_URL=http://localhost:18580（通常開発・WebSocket も動作）"
    echo "  tailscale - NEXTAUTH_URL を Tailscale ホストに設定（HTTPS・Caddy 前提）"
    echo "              TAILSCALE_HOST 未指定時は tailscale status から自動検出を試みます"
    echo ""
    echo "例: TAILSCALE_HOST=your-machine.tail12345.ts.net $0 tailscale"
    echo "実行後は Next.js を再起動すること。"
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]] && [[ ! -L "$ENV_FILE" ]]; then
  echo "Error: .env.local が見つかりません: $ENV_FILE"
  echo "先にプロジェクトルートで npm run setup:env を実行するか、cp env.local.template .env.local してください。"
  exit 1
fi

update_env_var() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    tmp=$(mktemp)
    sed "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

update_env_var "NEXTAUTH_URL" "$NEW_URL"

echo "✓ NEXTAUTH_URL を ${MODE} に設定しました: ${NEW_URL}"
echo "  S3_PUBLIC_URL は NEXTAUTH_URL から自動導出（localhost→:9000、それ以外→/minio）"
echo "  Next.js を起動中なら Ctrl+C で止めてから npm run dev で再起動してください。"
if [[ "${MODE}" == Tailscale* ]]; then
  echo ""
  echo "  ※ HTTPS: Tailscale Serve または Caddy のいずれかが必要。docs/user/TAILSCALE_HTTPS_SETUP.md を参照。"
fi
