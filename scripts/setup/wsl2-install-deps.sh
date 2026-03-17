#!/usr/bin/env bash
# WSL2 用: Node.js / Tailscale / Docker Engine を自動インストール
# root で実行すれば sudo 不要（start.bat から wsl -u root で呼ぶ）
set -e

SUDO="sudo"
[[ $(id -u) -eq 0 ]] && SUDO=""
TARGET_USER="${SUDO_USER:-$USER}"
[[ -z "$TARGET_USER" || "$TARGET_USER" == "root" ]] && TARGET_USER=$(getent passwd 1000 2>/dev/null | cut -d: -f1) || true
[[ -z "$TARGET_USER" ]] && TARGET_USER=$(ls /home 2>/dev/null | head -1) || true
[[ -z "$TARGET_USER" ]] && TARGET_USER="root"

echo ""
echo "=== WSL2 依存関係のインストール ==="
echo ""

# Docker Engine（WSL2 内）
if ! dpkg -l docker.io 2>/dev/null | grep -q '^ii'; then
  echo ">>> Docker Engine (docker.io) をインストールしています..."
  $SUDO apt-get update -qq
  if $SUDO apt-get install -y docker.io docker-compose-v2 2>/dev/null; then
    $SUDO usermod -aG docker "$TARGET_USER" 2>/dev/null || true
    $SUDO service docker start 2>/dev/null || true
    echo "    ✓ Docker Engine をインストールしました"
  else
    echo "    ⚠ インストールに失敗しました。手動で: sudo apt install docker.io"
    exit 1
  fi
else
  echo "    ✓ Docker Engine (docker.io) は既にインストール済み"
fi

# Node.js (nvm)
if ! command -v node >/dev/null 2>&1; then
  echo ">>> Node.js をインストールしています (nvm)..."
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    mkdir -p "$NVM_DIR"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    echo "    ✓ nvm をインストールしました"
  fi
  # shellcheck source=/dev/null
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  echo "    ✓ Node.js $(node -v) をインストールしました"
else
  echo "    ✓ Node.js は既にインストール済み: $(node -v)"
fi

# Tailscale
if ! command -v tailscale >/dev/null 2>&1; then
  echo ">>> Tailscale をインストールしています..."
  if curl -fsSL https://tailscale.com/install.sh | sh; then
    echo "    ✓ Tailscale をインストールしました"
  else
    echo "    ⚠ 自動インストールに失敗しました。手動でインストールしてください:"
    echo "       https://tailscale.com/download"
  fi
else
  echo "    ✓ Tailscale は既にインストール済み"
fi
# tailscale を NOPASSWD で実行可能に（start.bat 一発起動・リモート対応）
TAILSCALE_PATH=$(command -v tailscale 2>/dev/null)
if [[ -n "$TAILSCALE_PATH" ]]; then
  echo "$USER ALL=(ALL) NOPASSWD: $TAILSCALE_PATH" 2>/dev/null | sudo tee /etc/sudoers.d/tailscale-nopasswd >/dev/null 2>&1 && \
    echo "    ✓ tailscale をパスワードなしで実行可能にしました" || true
fi

# .env の初回作成（プロジェクトルートで実行されている場合）
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -f "$ROOT_DIR/.env.example" ]] && [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo ">>> .env を作成しています..."
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "    ✓ .env を作成しました"
fi
if [[ ! -f "$ROOT_DIR/nextjs-web/.env.local" ]] && [[ -f "$ROOT_DIR/package.json" ]]; then
  echo ">>> 環境設定を実行しています (npm run setup:env)..."
  (cd "$ROOT_DIR" && npm run setup:env 2>/dev/null) || true
  echo "    ✓ setup:env を実行しました。nextjs-web/.env.local に Discord 認証等を入力してください。"
fi

echo ""
echo "============================================"
echo "  ✓ 依存関係のインストールが完了しました"
echo "============================================"
echo ""
echo "  start.bat を再度ダブルクリックして起動してください。"
echo "  .env.local が未作成の場合は npm run setup:env を実行してください。"
echo ""
