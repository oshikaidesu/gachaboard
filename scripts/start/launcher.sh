#!/bin/bash
# 起動ランチャー（start.sh / start.command 共用）
# Mac と Linux で同じ UX を提供
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$ROOT_DIR"
mkdir -p "${ROOT_DIR}/.gachaboard"
LOCK_FILE="${ROOT_DIR}/.gachaboard/start.lock"

# ── 二重起動防止 ──
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

# ── --reset / --dev が渡されたらモード選択をスキップ ──
for arg in "$@"; do
  if [[ "$arg" == "--reset" ]] || [[ "$arg" == "--dev" ]]; then
    exec bash scripts/start/tailscale.sh "$@"
  fi
done

# ── .env の存在チェック ──
if [[ ! -f ".env" ]] && [[ -f ".env.example" ]]; then
  cp .env.example .env
  echo ""
  echo "  .env を .env.example から作成しました。"
  echo "  Discord OAuth 等を編集してから再度起動してください。"
  echo ""
  echo "Enter キーを押すと終了します..."
  read -r
  rm -f "$LOCK_FILE" 2>/dev/null || true
  exit 0
fi
if [[ ! -f ".env" ]]; then
  echo ""
  echo "============================================"
  echo "  .env が未作成です（初回セットアップ）"
  echo "============================================"
  echo ""
  echo "  ターミナルで以下を実行してください:"
  echo ""
  echo "    cd $ROOT_DIR"
  echo "    cp .env.example .env"
  echo "    # .env を開いて Discord OAuth 等を入力"
  echo ""
  echo "  Node.js がある場合: npm run setup:env"
  echo ""
  echo "============================================"
  echo ""
  echo "Enter キーを押すと終了します..."
  read -r
  rm -f "$LOCK_FILE" 2>/dev/null || true
  exit 1
fi

# ── 起動モード選択 ──
CAN_RUN_TAILSCALE=false
CAN_RUN_LOCAL=false
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  CAN_RUN_LOCAL=true
  command -v tailscale >/dev/null 2>&1 && CAN_RUN_TAILSCALE=true
fi

if [[ "$CAN_RUN_TAILSCALE" == true ]]; then
  if [[ ! -f "nextjs-web/.env.local" ]]; then
    echo ""
    echo "  nextjs-web/.env.local が未作成です。npm run setup:env を実行してください。"
    echo ""
    echo "Enter キーを押すと終了します..."
    read -r
    rm -f "$LOCK_FILE" 2>/dev/null || true
    exit 1
  fi
  echo "✓ 必須ツール確認済み（Node.js, Tailscale）"
  echo ""
  echo "  起動モードを選んでください（Enter で 1 を選択）:"
  echo ""
  echo "    1) 本番モード（既存ビルドで起動・デフォルト）"
  echo "    2) ビルドを再生成してから本番モードで起動"
  echo "    3) 開発モードで起動（ホットリロード）"
  echo ""
  read -r -p "  1 / 2 / 3 [1]: " choice
  choice="${choice:-1}"

  if [[ "$choice" == "2" ]]; then
    echo ""
    echo ">>> ビルドを再生成しています..."
    (cd nextjs-web && npx prisma generate && npm run build) || { echo "ビルドに失敗しました"; rm -f "$LOCK_FILE" 2>/dev/null; exit 1; }
    echo ""
    exec bash scripts/start/tailscale.sh "$@"
  elif [[ "$choice" == "3" ]]; then
    exec bash scripts/start/tailscale.sh --dev "$@"
  else
    exec bash scripts/start/tailscale.sh "$@"
  fi
fi

if [[ "$CAN_RUN_LOCAL" == true ]]; then
  echo ""
  echo "  Tailscale モードには tailscale が必要です。"
  echo "  ローカルで起動するには: bash scripts/start/local.sh"
  echo ""
  echo "  tailscale をインストール: brew install tailscale (Mac) / 各 OS の手順は https://tailscale.com/download"
  echo ""
  echo "  今すぐローカルモードで起動しますか？ [y/N]"
  read -r -p "  " run_local
  if [[ "$run_local" == "y" ]] || [[ "$run_local" == "Y" ]]; then
    exec bash scripts/start/local.sh "$@"
  fi
  rm -f "$LOCK_FILE" 2>/dev/null || true
  exit 0
fi

# ── Node.js 未インストール ──
echo ""
echo "============================================"
echo "  Gachaboard を起動するには Node.js が必要です"
echo "============================================"
echo ""
echo "  Mac:    brew install node"
echo "  Linux:  https://nodejs.org/ または nvm でインストール"
echo "  Windows: start.bat を使用"
echo ""
if command -v docker >/dev/null 2>&1; then
  echo "  Docker で全コンテナ起動する場合: docker compose --profile app up -d"
  echo ""
fi
echo "============================================"
echo ""
echo "Enter キーを押すと閉じます..."
read -r
rm -f "$LOCK_FILE" 2>/dev/null || true
exit 1
