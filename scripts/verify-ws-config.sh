#!/usr/bin/env bash
# Tailscale HTTPS 経路で /ws の IP 制限と wss が有効か検証する
# - Windows (Tailscale Serve): Caddy は使用しない。tailnet のみ到達 → 同等の保護。
# - Linux/Mac (Caddy): config/Caddyfile に handle_path /ws の IP 制限ブロックがあるか確認。
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CADDYFILE="${ROOT_DIR}/config/Caddyfile"

echo "=== /ws アクセス制限の検証 ==="
echo ""

# Windows かどうか（Tailscale Serve を使う場合は Caddy 不要）
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ -n "$WINDIR" ]]; then
  echo "プラットフォーム: Windows"
  echo "  → Tailscale Serve を使用（Caddy は不要）"
  echo "  → tailnet 内のクライアントのみアクセス可能（同等の制限）"
  echo ""
  echo "確認: scripts/entry/start.bat のオプション 1（Tailscale production）で起動していること"
  echo "  run.ps1 が tailscale serve で Next.js と /ws をプロキシする"
  exit 0
fi

# Linux/Mac: Caddyfile を検証
if [[ ! -f "$CADDYFILE" ]]; then
  echo "⚠ config/Caddyfile が見つかりません"
  echo ""
  echo "  Caddy を使う場合: npm run setup:tailscale-https を実行して Caddyfile を生成"
  echo "  （scripts/setup/tailscale-https.sh）"
  echo ""
  exit 1
fi

echo "プラットフォーム: Linux/Mac（Caddy 使用想定）"
echo "Caddyfile: $CADDYFILE"
echo ""

# handle_path /ws と IP 制限の存在を確認
if grep -q 'handle_path /ws' "$CADDYFILE" && \
   grep -q '100.64.0.0/10' "$CADDYFILE" && \
   grep -q '127.0.0.0/8' "$CADDYFILE"; then
  echo "✓ Caddyfile に /ws の IP 制限ブロックが含まれています"
  echo "  - Tailscale: 100.64.0.0/10"
  echo "  - localhost: 127.0.0.0/8"
  echo ""
  echo "確認: Caddy が起動しており、https（wss）でアクセスしていること"
  echo "  caddy run --config $CADDYFILE"
  exit 0
fi

echo "⚠ Caddyfile に /ws の IP 制限が正しく含まれていません"
echo ""
echo "  npm run setup:tailscale-https を再実行するか、"
echo "  config/Caddyfile に以下を reverse_proxy より前に追加:"
echo ""
echo "  handle_path /ws/* {"
echo "      @allow remote_ip 100.64.0.0/10 127.0.0.0/8"
echo "      handle @allow {"
echo "          reverse_proxy localhost:18582"
echo "      }"
echo "      handle {"
echo "          respond \"Forbidden\" 403"
echo "      }"
echo "  }"
echo ""
exit 1
