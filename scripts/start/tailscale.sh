#!/usr/bin/env bash
# Gachaboard 起動（Tailscale モード）
# env を Tailscale 用に切り替え、Postgres/MinIO/sync をネイティブ起動してから Next.js を起動
#
# オプション:
#   --dev    npm run dev（開発モード・ホットリロード）
#   --reset  依存サービスを一度停止してから起動（リセット＆再起動）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SCRIPTS_DIR")"
source "$SCRIPTS_DIR/lib/common.sh"
cd "$ROOT_DIR"

DO_RESET=false
DO_DEV=false
for arg in "$@"; do
  [[ "$arg" == "--reset" ]] && DO_RESET=true
  [[ "$arg" == "--dev" ]] && DO_DEV=true
done

echo "=== Gachaboard 起動（Tailscale モード）==="

# ── 起動済みチェック（--reset の場合はスキップ）──
if [[ "$DO_RESET" != true ]]; then
  CHECK_PORT="18580"
  if [[ -f "$ROOT_DIR/nextjs-web/.env.local" ]]; then
    pv=$(grep -E '^PORT=' "$ROOT_DIR/nextjs-web/.env.local" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
    [[ -n "$pv" ]] && CHECK_PORT="$pv"
  fi
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${CHECK_PORT}" 2>/dev/null | grep -qE "200|302|307"; then
    echo ""
    echo "  Gachaboard は既に起動しています（:${CHECK_PORT}）"
    echo ""
    echo "  1) ブラウザで開く（そのまま）"
    echo "  2) 再起動する"
    echo "  3) 終了"
    echo ""
    read -r -p "  1 / 2 / 3 [1]: " _already_choice
    _already_choice="${_already_choice:-1}"
    if [[ "$_already_choice" == "2" ]]; then
      echo ""
      echo ">>> 再起動します..."
      kill_app_port "$CHECK_PORT"
      sleep 2
    elif [[ "$_already_choice" == "3" ]]; then
      exit 0
    else
      _ts_host=$(detect_tailscale_host 2>/dev/null) || true
      if [[ -n "$_ts_host" ]]; then
        open_app_url "https://${_ts_host}"
      else
        open_app_url "http://localhost:${CHECK_PORT}"
      fi
      exit 0
    fi
  fi
fi

# ── 0. 前提チェック ──
export GACHABOARD_ROOT="$ROOT_DIR"
check_required tailscale || exit 1
check_env_exists "$ROOT_DIR" || exit 1
drop_legacy_root_env "$ROOT_DIR"
check_discord_env "$ROOT_DIR" || exit 1

if [[ ! -d "$ROOT_DIR/nextjs-web/node_modules" ]]; then
  echo ">>> nextjs-web の依存をインストールしています（初回のみ）..."
  (cd "$ROOT_DIR/nextjs-web" && npm install) || exit 1
  echo ""
fi
if [[ ! -d "$ROOT_DIR/nextjs-web/sync-server/node_modules" ]]; then
  echo ">>> sync-server の依存をインストールしています（初回のみ）..."
  (cd "$ROOT_DIR/nextjs-web/sync-server" && npm install) || exit 1
  echo ""
fi

apply_nextjs_web_patches "$ROOT_DIR" || exit 1

# ── 1. Tailscale ホスト名を取得（未ログインなら tailscale up で誘導）──
if [[ -z "${TAILSCALE_HOST:-}" ]]; then
  echo ">>> Tailscale ホスト名を取得中..."
  TAILSCALE_HOST=$(detect_tailscale_host) || true
fi

if [[ -z "${TAILSCALE_HOST:-}" ]]; then
  echo ""
  echo ">>> Tailscale にログインしていません。ログインを開始します..."
  echo "    ブラウザが開いたら認証を完了してください。"
  echo ""
  AUTH_KEY=""
  if [[ -f "$ROOT_DIR/nextjs-web/.env.local" ]]; then
    AUTH_KEY=$(grep -E '^TAILSCALE_AUTH_KEY=' "$ROOT_DIR/nextjs-web/.env.local" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' | head -1)
  fi
  sudo tailscale up 2>/dev/null || tailscale up 2>/dev/null || true
  echo ""
  echo "    ログイン完了を待機中（最大60秒）..."
  for i in $(seq 1 60); do
    TAILSCALE_HOST=$(detect_tailscale_host) || true
    [[ -n "${TAILSCALE_HOST:-}" ]] && break
    sleep 1
  done
fi
if [[ -z "${TAILSCALE_HOST:-}" ]]; then
  echo ""
  echo "============================================"
  echo "  Tailscale ホスト名が取得できませんでした"
  echo "============================================"
  echo ""
  echo "  ブラウザでログインを完了したら、scripts/entry/start.bat を再度実行してください。"
  echo "  手動でホスト名を指定する場合:"
  echo "    TAILSCALE_HOST=your-machine.tail12345.ts.net bash scripts/start/tailscale.sh"
  echo ""
  echo "  確認: tailscale status"
  echo "============================================"
  exit 1
fi
export TAILSCALE_HOST
echo "    ✓ ホスト名: $TAILSCALE_HOST"

# ── 2. ポート同期と NEXTAUTH_URL（動的・.env に書き込まない）──
echo ">>> ポート変数を同期"
bash "$SCRIPTS_DIR/lib/sync-env-ports.sh" 2>/dev/null || true

# .env / .env.local に残った NEXTAUTH_URL を削除（getBaseUrl がリクエスト Host から動的解決するため不要）
for ef in "$ROOT_DIR/nextjs-web/.env.local"; do
  if [[ -f "$ef" ]] && grep -q '^NEXTAUTH_URL=' "$ef" 2>/dev/null; then
    tmp=$(mktemp)
    grep -v '^NEXTAUTH_URL=' "$ef" > "$tmp" && mv "$tmp" "$ef"
  fi
done
export NEXTAUTH_URL="https://${TAILSCALE_HOST}"

# ── 3. 依存サービスをネイティブ起動（PostgreSQL, MinIO, Sync Server）──
echo ">>> 依存サービス起動 (PostgreSQL, MinIO, Sync Server)"
if [[ "$DO_RESET" == true ]]; then
  reset_native_services
fi
if ! run_native_services; then
  echo ""
  echo "❌ 依存サービスの起動に失敗しました。上記のエラーを確認してください。"
  exit 1
fi

# ── 4. PostgreSQL 待機 → Prisma ──
wait_for_postgres || exit 1
apply_prisma_schema "$ROOT_DIR"

# ── 5. ビルド（本番のみ・既存ビルドがあればスキップ）──
if [[ "$DO_DEV" != true ]] && next_web_prod_build_needed "$ROOT_DIR/nextjs-web"; then
  echo ">>> 本番ビルドを実行します（未作成、または patches/ が最終ビルドより新しいため）..."
  cd nextjs-web
  npm run build
  cd "$ROOT_DIR"
fi

# ── 6. Next.js 起動 ──
if [[ "$DO_DEV" == true ]]; then
  echo ">>> アプリ起動（開発モード）"
else
  echo ">>> アプリ起動（本番モード）"
fi
if [[ -f nextjs-web/.env.local ]]; then
  port_val=$(grep -E '^PORT=' nextjs-web/.env.local 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  [[ -n "$port_val" ]] && export PORT="$port_val"
fi
kill_app_port "${PORT:-18580}"
cd nextjs-web
if [[ "$DO_DEV" == true ]]; then
  npm run dev &
else
  npm run start &
fi
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true; rm -f \"\${GACHABOARD_START_LOCK:-}\" 2>/dev/null || true; exit" EXIT INT TERM

APP_URL="https://${TAILSCALE_HOST}"
READY_URL="http://localhost:${PORT:-18580}"

READY=false
echo "    起動を待機中..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" "$READY_URL" 2>/dev/null | grep -qE "200|302|307"; then
    echo "    ✓ 準備完了 (${i}秒)"
    READY=true
    break
  fi
  sleep 1
done
if [[ "$READY" != true ]]; then
  echo "    ⚠ タイムアウト。ブラウザで $READY_URL を開いてください"
fi

# ── 7. Tailscale Serve を設定（HTTPS） ──
if [[ "$READY" == true ]]; then
  APP_PORT="${PORT:-18580}"
  SYNC_PORT=$(grep -E '^SYNC_SERVER_HOST_PORT=' "${ROOT_DIR}/nextjs-web/.env.local" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  SYNC_PORT="${SYNC_PORT:-18582}"

  if command -v tailscale >/dev/null 2>&1; then
    echo ">>> Tailscale Serve を設定 (/ → :${APP_PORT}, /ws → :${SYNC_PORT})"
    tailscale serve reset 2>/dev/null || true
    tailscale serve --bg "http://127.0.0.1:${APP_PORT}" 2>&1 || true
    MSYS_NO_PATHCONV=1 tailscale serve --bg --set-path='/ws' "http://127.0.0.1:${SYNC_PORT}" 2>&1 || true
    echo "    ✓ Tailscale Serve: HTTPS → localhost:${APP_PORT}, /ws → localhost:${SYNC_PORT}"
  fi
  APP_URL="https://${TAILSCALE_HOST}"
  open_app_url "$APP_URL"
fi

echo ""
echo "============================================"
echo "  ✓ Gachaboard 起動完了"
echo "============================================"
echo ""
[[ -z "${APP_URL:-}" ]] && APP_URL="https://${TAILSCALE_HOST}"
echo "  アクセスURL: $APP_URL （HTTPS）"
echo "  他端末: Tailscale 接続後に同じ URL でアクセスできます"
echo ""
echo "  Discord でログインするには:"
echo "    Discord Developer Portal → アプリ → OAuth2 → Redirects に以下を追加:"
echo "    $APP_URL/api/auth/callback/discord"
echo ""
echo "  よく使うコマンド:"
echo "    本番ビルド: cd nextjs-web && npm run build && cd .. の後 npm start"
echo "    リセット:   scripts/entry/start.bat（メニュー 6）/ bash scripts/start/tailscale.sh --reset"
echo "    状態確認:   cd nextjs-web && npm run status"
echo ""
if [[ "$DO_DEV" == true ]]; then
  echo "  ※ HMR WebSocket が失敗する場合:"
  echo "    tailscale serve reset → 別ターミナルで caddy run --config config/Caddyfile"
  echo ""
fi
echo "  終了: Ctrl+C"
echo ""

wait $SERVER_PID
