#!/usr/bin/env bash
# Gachaboard 起動（Tailscale モード）
# env を Tailscale 用に切り替え、Docker と Next.js を起動
#
# オプション:
#   --dev    npm run dev（開発モード・ホットリロード）
#   --reset  Docker を一度停止してから起動（リセット＆再起動）
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SCRIPTS_DIR")"
source "$SCRIPTS_DIR/lib/common.sh"
cd "$ROOT_DIR"
# WSL2: docker.io を優先し、Docker Desktop の設定を無視
if [[ -f /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
  export PATH="/usr/bin:$PATH"
  mkdir -p "$ROOT_DIR/.gachaboard"
  DOCKER_WSL_DIR="$ROOT_DIR/.gachaboard/docker-wsl2"
  if [[ -d "$ROOT_DIR/.docker-wsl2" ]] && [[ ! -d "$DOCKER_WSL_DIR" ]]; then
    mv "$ROOT_DIR/.docker-wsl2" "$DOCKER_WSL_DIR"
  fi
  mkdir -p "$DOCKER_WSL_DIR"
  [[ ! -f "$DOCKER_WSL_DIR/config.json" ]] && echo '{}' > "$DOCKER_WSL_DIR/config.json"
  export DOCKER_CONFIG="$DOCKER_WSL_DIR"
fi

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
  if [[ -f "$ROOT_DIR/.env" ]]; then
    pv=$(grep -E '^PORT=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
    [[ -n "$pv" ]] && CHECK_PORT="$pv"
  fi
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${CHECK_PORT}" 2>/dev/null | grep -qE "200|302|307"; then
    echo ""
    echo "  Gachaboard は既に起動しています"
    echo "  http://localhost:${CHECK_PORT}"
    echo ""
    exit 0
  fi
fi

# ── 0. 前提チェック ──
export GACHABOARD_ROOT="$ROOT_DIR"
check_required tailscale || exit 1
check_env_exists "$ROOT_DIR" || exit 1
ensure_env_symlink "$ROOT_DIR"
check_discord_env "$ROOT_DIR" || exit 1

if [[ ! -d "$ROOT_DIR/nextjs-web/node_modules" ]]; then
  echo ">>> nextjs-web の依存をインストールしています（初回のみ）..."
  (cd "$ROOT_DIR/nextjs-web" && npm install) || exit 1
  echo ""
fi

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
  # sudo は CMD からの WSL 起動だと TTY がなくパスワード入力できない。
  # wsl -u root で root として直接実行すればパスワード不要。
  AUTH_KEY=""
  if [[ -f "$ROOT_DIR/.env" ]]; then
    AUTH_KEY=$(grep -E '^TAILSCALE_AUTH_KEY=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"'\''\r' | head -1)
  fi
  WSL_EXE=""
  for p in /mnt/c/Windows/System32/wsl.exe /mnt/c/WINDOWS/System32/wsl.exe; do
    [[ -x "$p" ]] && WSL_EXE="$p" && break
  done
  if [[ -n "$WSL_EXE" ]]; then
    if [[ -n "$AUTH_KEY" ]]; then
      "$WSL_EXE" -u root -e tailscale up --auth-key="$AUTH_KEY" 2>/dev/null || true
    else
      "$WSL_EXE" -u root -e tailscale up 2>/dev/null || true
    fi
  else
    sudo tailscale up 2>/dev/null || tailscale up 2>/dev/null || true
  fi
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
  echo "  ブラウザでログインを完了したら、start.bat を再度実行してください。"
  echo "  手動でホスト名を指定する場合:"
  echo "    TAILSCALE_HOST=your-machine.tail12345.ts.net bash scripts/start/tailscale.sh"
  echo ""
  echo "  確認: tailscale status"
  echo "============================================"
  exit 1
fi
export TAILSCALE_HOST
echo "    ✓ ホスト名: $TAILSCALE_HOST"

# ── 2. env を Tailscale 用に切り替え ──
echo ">>> ポート変数を同期"
bash "$SCRIPTS_DIR/lib/sync-env-ports.sh" 2>/dev/null || true
echo ">>> env を Tailscale 用に切り替え"
cd nextjs-web
bash scripts/switch-env.sh tailscale
cd "$ROOT_DIR"
sync_env_to_root "$ROOT_DIR"

# Caddyfile 生成（Caddy を使う人向け。Tailscale Serve だけなら不要なので失敗しても続行）
CALLED_FROM_START=1 bash "$SCRIPTS_DIR/setup/tailscale-https.sh" 2>/dev/null || true

# ── 3. Docker で依存サービスを起動 ──
echo ">>> 依存サービス起動 (PostgreSQL, MinIO, Sync Server)"
if [[ "$DO_RESET" == true ]]; then
  reset_docker
fi
if ! run_docker_compose_up; then
  echo ""
  echo "❌ Docker サービスの起動に失敗しました。上記のエラーを確認してください。"
  exit 1
fi

# ── 4. PostgreSQL 待機 → Prisma ──
wait_for_postgres || exit 1
apply_prisma_schema "$ROOT_DIR"

# ── 5. ビルド（本番のみ・既存ビルドがあればスキップ）──
if [[ "$DO_DEV" != true ]] && [[ ! -f "nextjs-web/.next/BUILD_ID" ]]; then
  echo ">>> 本番ビルドが見つかりません。ビルドを実行します..."
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
if [[ -f .env ]]; then
  port_val=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2- | tr -d '"\r')
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
  SYNC_PORT=$(grep -E '^SYNC_SERVER_HOST_PORT=' "${ROOT_DIR}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"\r')
  SYNC_PORT="${SYNC_PORT:-18582}"
  if command -v tailscale >/dev/null 2>&1; then
    echo ">>> Tailscale Serve を設定 (/ → :${APP_PORT}, /ws → :${SYNC_PORT})"
    if _is_wsl2; then
      for p in /mnt/c/Windows/System32/wsl.exe /mnt/c/WINDOWS/System32/wsl.exe; do
        if [[ -x "$p" ]]; then
          "$p" -u root -e tailscale set --operator="$USER" 2>/dev/null || true
          break
        fi
      done
    fi
    tailscale serve reset 2>/dev/null || true
    tailscale serve --bg "http://127.0.0.1:${APP_PORT}" 2>&1 || true
    MSYS_NO_PATHCONV=1 tailscale serve --bg --set-path='/ws' "http://127.0.0.1:${SYNC_PORT}" 2>&1 || true
    echo "    ✓ Tailscale Serve: HTTPS → localhost:${APP_PORT}, /ws → localhost:${SYNC_PORT}"
  fi
  open_app_url "$APP_URL"
fi

echo ""
echo "============================================"
echo "  ✓ Gachaboard 起動完了"
echo "============================================"
echo ""
echo "  アクセスURL: $APP_URL （HTTPS）"
echo "  他端末: Tailscale 接続後に同じ URL でアクセスできます"
echo ""
echo "  Discord でログインするには:"
echo "    Discord Developer Portal → アプリ → OAuth2 → Redirects に以下を追加:"
echo "    $APP_URL/api/auth/callback/discord"
echo ""
echo "  よく使うコマンド:"
echo "    本番ビルド: cd nextjs-web && npm run build && cd .. の後 npm start"
echo "    リセット:   start.bat --reset （Windows） / bash scripts/start/tailscale.sh --reset"
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
