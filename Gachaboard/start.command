#!/bin/bash
# Mac でダブルクリックして起動（Tailscale 開発モード）
cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"
LOCK_FILE="${ROOT_DIR}/.gachaboard-start.lock"

# ── 二重起動防止（ダブルクリックで2つターミナルが出ないよう先頭でロック取得）──
take_lock() {
  if ( set -o noclobber; echo $$ > "$LOCK_FILE" ) 2>/dev/null; then
    return 0
  fi
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if [[ -n "$LOCK_PID" ]] && [[ "$LOCK_PID" != "$$" ]] && kill -0 "$LOCK_PID" 2>/dev/null; then
    return 1
  fi
  rm -f "$LOCK_FILE" 2>/dev/null || true
  ( set -o noclobber; echo $$ > "$LOCK_FILE" ) 2>/dev/null
}
if ! take_lock; then
  echo ""
  echo "  Gachaboard は既に起動中です。"
  echo "  このウィンドウは閉じて、先に起動した方のターミナルをご利用ください。"
  echo ""
  echo "Enter キーを押すと閉じます..."
  read -r
  exit 1
fi
export GACHABOARD_START_LOCK="$LOCK_FILE"

# ── 必須ツールの存在チェック ──
missing=()
command -v docker >/dev/null 2>&1 || missing+=("docker")
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  missing+=("node")
fi
command -v tailscale >/dev/null 2>&1 || missing+=("tailscale")
# Caddy は必須にしない（Tailscale Serve で HTTPS する場合は不要）

if [[ ${#missing[@]} -gt 0 ]]; then
  echo ""
  echo "============================================"
  echo "  Gachaboard を起動するには以下が必要です"
  echo "============================================"
  echo ""
  echo "  ❌ 未インストール:"
  for m in "${missing[@]}"; do
    case "$m" in
      node) echo "     - Node.js（npm 同梱）" ;;
      *)    echo "     - $m" ;;
    esac
  done
  echo ""
  echo "  📦 Mac でのインストール手順:"
  echo "  ─────────────────────────────"
  step=1
  for m in "${missing[@]}"; do
    case "$m" in
      docker)    echo "  ${step}) Docker Desktop をインストール"
                 echo "     https://docs.docker.com/desktop/install/mac-install/"
                 echo ""; step=$((step+1)) ;;
      node)      echo "  ${step}) Node.js をインストール（npm 同梱）"
                 echo "     brew install node"
                 echo "     または https://nodejs.org/ からダウンロード"
                 echo ""; step=$((step+1)) ;;
      tailscale) echo "  ${step}) Tailscale をインストール"
                 echo "     brew install tailscale"
                 echo "     または https://tailscale.com/download"
                 echo ""; step=$((step+1)) ;;
    esac
  done
  echo "  インストール後、再度ダブルクリックしてください。"
  echo "============================================"
  echo ""
  echo "Enter キーを押すと終了します..."
  read -r
  rm -f "$LOCK_FILE" 2>/dev/null || true
  exit 1
fi

echo "✓ 必須ツール インストール確認済み"

# ── .env の存在チェック ──
if [[ ! -f "nextjs-web/.env.local" ]]; then
  echo ""
  echo "============================================"
  echo "  .env が未作成です（初回セットアップ）"
  echo "============================================"
  echo ""
  echo "  ターミナルで以下を実行してください:"
  echo ""
  echo "    cd $(pwd)"
  echo "    npm run setup:env"
  echo ""
  echo "  その後 nextjs-web/.env.local を開いて"
  echo "  Discord OAuth 等を入力してください。"
  echo ""
  echo "============================================"
  echo ""
  echo "Enter キーを押すと終了します..."
  read -r
  rm -f "$LOCK_FILE" 2>/dev/null || true
  exit 1
fi

exec bash scripts/start/tailscale.sh
