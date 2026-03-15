#!/usr/bin/env bash
# 統合 .env のセットアップ
# - 正本: nextjs-web/.env.local
# - プロジェクトルートの .env を nextjs-web/.env.local へのシンボリックリンクに
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SCRIPTS_DIR")"
cd "$ROOT_DIR"

ENV_LOCAL="nextjs-web/.env.local"
ENV_ROOT=".env"

echo "=== Gachaboard 環境変数セットアップ ==="

# 1. 正本 nextjs-web/.env.local を用意
if [[ ! -f "$ENV_LOCAL" ]] && [[ ! -L "$ENV_LOCAL" ]]; then
  # 存在しない: .env.example から作成
  cp .env.example "$ENV_LOCAL"
  echo ">>> $ENV_LOCAL を作成しました（.env.example から）"
  if ! grep -qE "^NEXTAUTH_SECRET=.+" "$ENV_LOCAL" 2>/dev/null; then
    secret=$(openssl rand -base64 32 2>/dev/null || echo "")
    if [[ -n "$secret" ]]; then
      if grep -q "^NEXTAUTH_SECRET=" "$ENV_LOCAL"; then
        tmp=$(mktemp)
        sed "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${secret}|" "$ENV_LOCAL" > "$tmp" && mv "$tmp" "$ENV_LOCAL"
      else
        echo "NEXTAUTH_SECRET=${secret}" >> "$ENV_LOCAL"
      fi
      echo "    NEXTAUTH_SECRET を自動生成しました"
    fi
  fi
  echo "    先頭4つ（Discord OAuth 等）を編集してください。"
elif [[ -L "$ENV_LOCAL" ]]; then
  # シンボリックリンク（旧構成: .env.local -> ../.env）: 正本に移行
  echo ">>> 旧構成を検出（.env.local がシンボリックリンク）。正本に移行します..."
  cp "$ENV_LOCAL" "${ENV_LOCAL}.tmp"
  rm "$ENV_LOCAL"
  mv "${ENV_LOCAL}.tmp" "$ENV_LOCAL"
  echo "    $ENV_LOCAL を通常ファイルにしました"
fi

# 2. プロジェクトルートの .env が通常ファイルなら、内容を正本に移してからシンボリックリンクに差し替え
if [[ -f "$ENV_ROOT" ]] && [[ ! -L "$ENV_ROOT" ]]; then
  echo ">>> プロジェクトルートの .env の内容を正本に移します..."
  cp "$ENV_ROOT" "$ENV_LOCAL"
  rm "$ENV_ROOT"
fi

# 3. プロジェクトルートの .env を nextjs-web/.env.local へのシンボリックリンクに（Mac/Windows 両対応）
if [[ -L "$ENV_ROOT" ]]; then
  target=$(readlink "$ENV_ROOT" 2>/dev/null || readlink -f "$ENV_ROOT" 2>/dev/null)
  if [[ "$target" == *"nextjs-web/.env.local"* ]] || [[ "$target" == *"nextjs-web\.env.local"* ]]; then
    echo ">>> プロジェクトルートの .env は既に $ENV_LOCAL へのシンボリックリンクです"
  else
    node "$SCRIPTS_DIR/setup/create-env-symlink.mjs"
  fi
else
  node "$SCRIPTS_DIR/setup/create-env-symlink.mjs"
fi

# 4. ポート変数から派生する値を同期
bash "$SCRIPTS_DIR/lib/sync-env-ports.sh" 2>/dev/null || true

echo ""
echo "✓ セットアップ完了。$ENV_LOCAL を編集（Discord OAuth 等）してから docker compose up -d と npm run dev を実行してください。"
