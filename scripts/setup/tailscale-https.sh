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
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SCRIPTS_DIR")"
mkdir -p "${ROOT_DIR}/config"
CADDYFILE="${ROOT_DIR}/config/Caddyfile"
# 旧配置からの移行（ルートの Caddyfile があれば config/ へ）
[[ -f "${ROOT_DIR}/Caddyfile" ]] && [[ ! -f "$CADDYFILE" ]] && mv "${ROOT_DIR}/Caddyfile" "$CADDYFILE"

# ホスト名取得（jq がなくても grep/sed で動作）
get_hostname() {
  if [[ -n "${TAILSCALE_HOST:-}" ]]; then
    echo "${TAILSCALE_HOST}"
    return 0
  fi
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
    dns=$(echo "$json" | grep -o '"DNSName"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
  fi
  if [[ -n "$dns" && "$dns" != "null" ]]; then
    echo "${dns%.}"
    return 0
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

# Ports from nextjs-web/.env.local (same file Next.js loads)
# Defaults: 18580 (Next.js), 18582 (sync), 18583 (MinIO)
APP_PORT="18580"
SYNC_PORT="18582"
MINIO_PORT="18583"

env_local="${ROOT_DIR}/nextjs-web/.env.local"

for f in "$env_local"; do
  [[ -f "$f" ]] || continue
  p=$(grep -E '^PORT=' "$f" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  if [[ -n "$p" ]]; then
    APP_PORT="$p"
    break
  fi
done

# Sync: SYNC_SERVER_HOST_PORT
for f in "$env_local"; do
  [[ -f "$f" ]] || continue
  p=$(grep -E '^SYNC_SERVER_HOST_PORT=' "$f" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  if [[ -n "$p" ]]; then
    SYNC_PORT="$p"
    break
  fi
done

# MinIO: S3_ENDPOINT のポート、または MINIO_API_HOST_PORT
for f in "$env_local"; do
  [[ -f "$f" ]] || continue
  # S3_ENDPOINT=http://localhost:18583 からポート抽出
  s3=$(grep -E '^S3_ENDPOINT=' "$f" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  if [[ -n "$s3" ]]; then
    p=$(echo "$s3" | sed -n 's|.*:\([0-9]*\)$|\1|p')
    [[ -n "$p" ]] && MINIO_PORT="$p" && break
  fi
  p=$(grep -E '^MINIO_API_HOST_PORT=' "$f" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  if [[ -n "$p" ]]; then
    MINIO_PORT="$p"
    break
  fi
done

# Caddyfile 生成（Caddy 2.5+ は *.ts.net で Tailscale から自動証明書取得）
echo ">>> Caddyfile を生成 (Next.js:$APP_PORT, sync:$SYNC_PORT, MinIO:$MINIO_PORT)"
cat > "$CADDYFILE" << EOF
# Gachaboard - Tailscale HTTPS
# Caddy 2.5+ が *.ts.net で Tailscale から自動証明書取得（tailscale cert 不要）
$HOST {
    # WebSocket（sync-server）: Tailscale / localhost のみ許可（接続時のみチェックで軽い）
    handle_path /ws/* {
        @allow remote_ip 100.64.0.0/10 127.0.0.0/8
        handle @allow {
            reverse_proxy localhost:$SYNC_PORT
        }
        handle {
            respond "Forbidden" 403
        }
    }

    # Next.js
    reverse_proxy localhost:$APP_PORT

    # MinIO (Presigned URL 用)
    handle_path /minio/* {
        reverse_proxy localhost:$MINIO_PORT
    }
}
EOF

echo "    作成: $CADDYFILE"

# env 切り替え
echo ">>> env を Tailscale HTTPS に切り替え"
cd "${ROOT_DIR}/nextjs-web"
TAILSCALE_HOST="$HOST" bash scripts/switch-env.sh tailscale
cd "$ROOT_DIR"

# 起動スクリプトから呼ばれた場合は Caddy の案内を省略（毎回出ると邪魔）
if [[ "${CALLED_FROM_START:-}" == "1" ]]; then
  exit 0
fi

# 直接実行時のみ Caddy の案内を表示
if ! command -v caddy >/dev/null 2>&1; then
  echo ""
  echo "⚠️  Caddy がインストールされていません。"
  echo "    brew install caddy"
  echo ""
  echo "    インストール後、以下で起動:"
  echo "    caddy run --config $CADDYFILE"
  exit 0
fi

echo ""
echo "✓ セットアップ完了"
echo ""
echo "  アクセスURL: https://$HOST"
echo "  Discord Redirect: https://$HOST/api/auth/callback/discord"
echo ""
echo "  起動手順:"
echo "    1. scripts/entry/start.sh または scripts/entry/start.bat でアプリを起動"
echo "    2. 別ターミナルで: caddy run --config $CADDYFILE"
echo ""
echo "  または: npm run start:tailscale で起動後、別ターミナルで caddy run"
echo ""
