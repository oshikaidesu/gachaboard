#!/usr/bin/env bash
# Tailscale HTTPS セットアップの自動化
# - ホスト名取得
# - Caddyfile 生成（Caddy 2.5+ の Tailscale 証明書自動取得を利用）
# - env を Tailscale HTTPS に切り替え
#
# 前提: Admin Console で MagicDNS と HTTPS を有効化済み
#   https://login.tailscale.com/admin/dns → Enable HTTPS
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CADDYFILE="${ROOT_DIR}/Caddyfile"

# ホスト名取得
get_hostname() {
  if [[ -n "${TAILSCALE_HOST:-}" ]]; then
    echo "${TAILSCALE_HOST}"
    return 0
  fi
  if command -v tailscale >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    local dns
    dns=$(tailscale status --json --peers=false 2>/dev/null | jq -r '.Self.DNSName // empty')
    if [[ -n "$dns" && "$dns" != "null" ]]; then
      echo "${dns%.}"
      return 0
    fi
  fi
  return 1
}

echo "=== Tailscale HTTPS セットアップ ==="

HOST=$(get_hostname) || {
  echo "❌ Tailscale ホスト名が取得できませんでした。"
  echo ""
  echo "  TAILSCALE_HOST=your-machine.tail12345.ts.net $0"
  echo "  または: tailscale status --json --peers=false | jq -r .Self.DNSName"
  exit 1
}

echo ">>> ホスト名: $HOST"

# Caddyfile 生成（Caddy 2.5+ は *.ts.net で Tailscale から自動証明書取得）
echo ">>> Caddyfile を生成"
cat > "$CADDYFILE" << EOF
# Gachaboard - Tailscale HTTPS
# Caddy 2.5+ が *.ts.net で Tailscale から自動証明書取得（tailscale cert 不要）
$HOST {
    # Next.js
    reverse_proxy localhost:3000

    # MinIO (Presigned URL 用)
    handle_path /minio/* {
        reverse_proxy localhost:9000
    }
}
EOF

echo "    作成: $CADDYFILE"

# env 切り替え
echo ">>> env を Tailscale HTTPS に切り替え"
cd "${ROOT_DIR}/nextjs-web"
TAILSCALE_HOST="$HOST" bash scripts/switch-env.sh tailscale
cd "$ROOT_DIR"

# Caddy 確認
if ! command -v caddy >/dev/null 2>&1; then
  echo ""
  echo "⚠️  Caddy がインストールされていません。"
  echo "    brew install caddy"
  echo ""
  echo "    インストール後、以下で起動:"
  echo "    caddy run --config $CADDYFILE"
  exit 0
fi

CADDY_VERSION=$(caddy version 2>/dev/null | head -1 || echo "")
echo ""
echo "✓ セットアップ完了"
echo ""
echo "  アクセスURL: https://$HOST"
echo "  Discord Redirect: https://$HOST/api/auth/callback/discord"
echo ""
echo "  起動手順:"
echo "    1. docker compose up -d"
echo "    2. cd nextjs-web && npm run dev"
echo "    3. caddy run --config $CADDYFILE"
echo ""
echo "  または: npm run start:tailscale で 1,2 を実行後、別ターミナルで caddy run"
echo ""
