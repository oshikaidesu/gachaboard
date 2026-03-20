#!/usr/bin/env bash
# 起動スクリプト共通処理

# 必須ツールの存在チェック。未インストールなら催促して return 1
# 使用: check_required [tailscale] || exit 1
#   tailscale … Tailscale モード用に tailscale コマンドも必須にする
check_required() {
  local missing=()
  local need_tailscale=false
  for arg in "$@"; do
    [[ "$arg" == "tailscale" ]] && need_tailscale=true
  done

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    missing+=("node")
  fi
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  [[ "$need_tailscale" == true ]] && { command -v tailscale >/dev/null 2>&1 || missing+=("tailscale"); }

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
          tailscale) echo "     - Tailscale（tailscale CLI）" ;;
          *)    echo "     - $m" ;;
        esac
    done
    echo ""

    local step=1
    if [[ "$(uname)" == "Darwin" ]]; then
      echo "  📦 Mac でのインストール手順:"
      echo "  ─────────────────────────────"
      for m in "${missing[@]}"; do
        case "$m" in
          node)      echo "  ${step}) Node.js をインストール（npm 同梱）"
                     echo "     brew install node"
                     echo "     または https://nodejs.org/ からダウンロード"
                     echo ""; step=$((step+1)) ;;
          curl)      echo "  ${step}) curl をインストール（通常はプリインストール）"
                     echo "     brew install curl"
                     echo ""; step=$((step+1)) ;;
          tailscale) echo "  ${step}) Tailscale CLI をインストール"
                     echo "     brew install tailscale"
                     echo "     インストール後、ターミナルで tailscale コマンドが使えます。"
                     echo "     https://tailscale.com/download"
                     echo ""; step=$((step+1)) ;;
        esac
      done
    else
      echo "  📦 Linux でのインストール手順:"
      echo "  ─────────────────────────────"
      for m in "${missing[@]}"; do
        case "$m" in
          node)      echo "  ${step}) Node.js をインストール（npm 同梱）"
                     echo "     https://nodejs.org/ または nvm を使用"
                     echo ""; step=$((step+1)) ;;
          curl)      echo "  ${step}) curl をインストール"
                     echo "     sudo apt install curl  # Debian/Ubuntu"
                     echo ""; step=$((step+1)) ;;
          tailscale) echo "  ${step}) Tailscale CLI をインストール"
                     echo "     https://tailscale.com/download で配布元に合わせてインストール"
                     echo "     （Debian/Ubuntu: 公式リポジトリ追加後 apt install tailscale）"
                     echo ""; step=$((step+1)) ;;
        esac
      done
    fi

    echo "  インストール後、再度起動してください。"
    echo "============================================"
    echo ""
    if [[ -t 0 ]]; then
      echo "Enter キーを押すと終了します..."
      read -r
    fi
    return 1
  fi
  echo "✓ 必須ツール インストール確認済み"
  return 0
}

# Discord ログインに必要な env が nextjs-web/.env.local に設定されているか確認
# 未設定なら案内して return 1（Callback エラーを起動前に防ぐ）
# 使用: check_discord_env "$ROOT_DIR" || exit 1
check_discord_env() {
  local root_dir="${1:-.}"
  local env_file="${root_dir}/nextjs-web/.env.local"
  [[ -f "$env_file" ]] || [[ -L "$env_file" ]] || return 0

  local missing=()
  _get_env_val() {
    grep -E "^${1}=" "$env_file" 2>/dev/null | cut -d= -f2- | tr -d '"\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
  }
  [[ -n "$(_get_env_val NEXTAUTH_SECRET)" ]]    || missing+=("NEXTAUTH_SECRET")
  [[ -n "$(_get_env_val DISCORD_CLIENT_ID)" ]]  || missing+=("DISCORD_CLIENT_ID")
  [[ -n "$(_get_env_val DISCORD_CLIENT_SECRET)" ]] || missing+=("DISCORD_CLIENT_SECRET")

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo ""
    echo "============================================"
    echo "  ❌ Discord ログインに必要な設定が未入力です"
    echo "============================================"
    echo ""
    echo "  未設定: $(IFS=,; echo "${missing[*]}")"
    echo ""
    echo "  nextjs-web/.env.local を開いて以下を入力してください:"
    echo "    - NEXTAUTH_SECRET … セッション暗号化用（英数字32文字程度でOK）"
    echo "    - DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET … Discord Developer Portal で取得"
    echo ""
    echo "  初回セットアップ: プロジェクトルートで npm run setup:env を実行"
    echo "  詳細: docs/user/SETUP.md または docs/user/discord-auth-troubleshooting.md"
    echo ""
    echo "============================================"
    if [[ -t 0 ]]; then
      echo "Enter キーを押すと終了します..."
      read -r
    fi
    return 1
  fi
  return 0
}

# .env が存在するか確認。未作成なら案内して return 1
# 使用: check_env_exists || exit 1
check_env_exists() {
  local root_dir="${1:-.}"
  local env_file="${root_dir}/nextjs-web/.env.local"
  if [[ ! -f "$env_file" ]] && [[ ! -L "$env_file" ]]; then
    echo ""
    echo "============================================"
    echo "  nextjs-web/.env.local が未作成です（初回セットアップ）"
    echo "============================================"
    echo ""
    echo "  以下を実行してください:"
    echo ""
    echo "    npm run setup:env"
    echo ""
    echo "  その後 nextjs-web/.env.local を開いて"
    echo "  Discord OAuth 等を入力してください。"
    echo ""
    echo "============================================"
    echo ""
    if [[ -t 0 ]]; then
      echo "Enter キーを押すと終了します..."
      read -r
    fi
    return 1
  fi
  return 0
}

# Canonical env is nextjs-web/.env.local only. Remove legacy root .env (file or symlink).
# If a root .env file exists, merge keys missing from .env.local, then delete root .env.
drop_legacy_root_env() {
  local root_dir="${1:-.}"
  local env_local="${root_dir}/nextjs-web/.env.local"
  local env_root="${root_dir}/.env"

  [[ -e "$env_root" ]] || return 0

  if [[ -L "$env_root" ]]; then
    rm -f "$env_root"
    echo "    (removed legacy root .env symlink)"
    return 0
  fi

  if [[ -f "$env_root" ]]; then
    mkdir -p "$(dirname "$env_local")"
    if [[ ! -f "$env_local" ]]; then
      mv "$env_root" "$env_local"
      echo "    (moved root .env → nextjs-web/.env.local)"
      return 0
    fi
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^[[:space:]]*$ ]] && continue
      local key="${line%%=*}"
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      [[ -z "$key" ]] && continue
      if ! grep -qE "^[[:space:]]*${key}=" "$env_local" 2>/dev/null; then
        echo "$line" >> "$env_local"
      fi
    done < "$env_root"
    rm -f "$env_root"
    echo "    (merged root .env into nextjs-web/.env.local and removed root .env)"
  fi
}

# No-op: single canonical file is nextjs-web/.env.local
sync_env_to_root() {
  return 0
}

# 指定した tailscale バイナリからホスト名を取得
# 使用: detect_tailscale_host_from "/mnt/c/Program Files/Tailscale/tailscale.exe"
detect_tailscale_host_from() {
  local ts_bin="$1"
  [[ -z "$ts_bin" ]] && return 1
  local json
  json=$("$ts_bin" status --json --peers=false 2>/dev/null) || return 1
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

# Tailscale ホスト名を取得（jq 不要）
# TAILSCALE_HOST が設定済みならそれを使い、未設定なら tailscale status から自動検出
detect_tailscale_host() {
  if [[ -n "${TAILSCALE_HOST:-}" ]]; then
    echo "$TAILSCALE_HOST"
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

# Docker Engine が応答するか（docker info で CLI 経由の接続を確認）
_docker_engine_alive() {
  docker info >/dev/null 2>&1
}

# PostgreSQL が接続を受け付けるまで待つ
# ネイティブ起動時は pg_isready をホストで実行。Docker 起動時は docker exec で判定。
# 使用: wait_for_postgres || exit 1
wait_for_postgres() {
  local max=300
  local port="${POSTGRES_HOST_PORT:-18581}"
  echo "    PostgreSQL の起動を待機中..."
  for i in $(seq 1 "$max"); do
    [[ $((i % 10)) -eq 0 ]] && echo "    ... ${i}秒"
    # 1) ネイティブ: ホストで pg_isready が使える場合はそれを優先
    if command -v pg_isready >/dev/null 2>&1; then
      if pg_isready -h 127.0.0.1 -p "$port" -U gachaboard -q 2>/dev/null; then
        echo "    ✓ PostgreSQL 準備完了 (${i}秒)"
        return 0
      fi
    fi
    # 2) Docker: コンテナが稼働していれば docker exec で判定
    local running
    running=$(docker inspect -f '{{.State.Running}}' compound-postgres 2>/dev/null || echo "false")
    if [[ "$running" == "true" ]]; then
      if docker exec compound-postgres pg_isready -U gachaboard -q 2>/dev/null; then
        echo "    ✓ PostgreSQL 準備完了 (${i}秒)"
        return 0
      fi
      local status
      status=$(docker inspect -f '{{.State.Health.Status}}' compound-postgres 2>/dev/null || true)
      if [[ "$status" == "healthy" ]]; then
        echo "    ✓ PostgreSQL 準備完了 (${i}秒)"
        return 0
      fi
    fi
    sleep 1
  done
  echo "    ⚠ PostgreSQL の起動が ${max}秒 以内に完了しませんでした"
  return 1
}

# nextjs-web で Prisma スキーマを適用（generate + migrate deploy）
# 既存 DB（スキーマあり・マイグレーション履歴なし）の場合は初回だけ baseline してから deploy
# 使用: apply_prisma_schema "$ROOT_DIR"
apply_prisma_schema() {
  local root_dir="${1:-.}"
  local web_dir="${root_dir}/nextjs-web"
  local init_migration="20250318120000_init"
  echo ">>> スキーマ適用 (prisma generate / migrate deploy)"
  (cd "$web_dir" && npx prisma generate) || return 1
  (cd "$web_dir" && npx prisma migrate deploy) && return 0
  echo ">>> 既存 DB のため baseline を適用してから再実行します"
  (cd "$web_dir" && npx prisma migrate resolve --applied "$init_migration" && npx prisma migrate deploy) || return 1
}

# macOS: Docker Desktop を完全終了→再起動→Engine 準備完了まで待つ
_restart_docker_desktop() {
  echo ">>> Docker Desktop を再起動します..."
  osascript -e 'quit app "Docker Desktop"' 2>/dev/null || true
  sleep 5
  # プロセスが残っていたら強制終了
  pkill -f "Docker Desktop" 2>/dev/null || true
  sleep 3
  open -a Docker
  echo "    Engine の起動を待機中（最大5分）..."
  for i in $(seq 1 300); do
    if _docker_engine_alive; then
      echo "    ✓ Docker Engine 起動完了 (${i}秒)"
      return 0
    fi
    sleep 1
  done
  return 1
}

# portable/scripts/start-services.sh で Postgres, MinIO, sync-server を起動する
# 使用: run_native_services || exit 1
run_native_services() {
  local root="${GACHABOARD_ROOT:-.}"
  export GACHABOARD_DATA_DIR="${root}/data"
  mkdir -p "$GACHABOARD_DATA_DIR"
  local env_file="${root}/nextjs-web/.env.local"
  if [[ -f "$env_file" ]]; then
    export POSTGRES_HOST_PORT=$(grep -E '^POSTGRES_HOST_PORT=' "$env_file" 2>/dev/null | cut -d= -f2- | tr -d '"\r') || true
    export MINIO_API_HOST_PORT=$(grep -E '^MINIO_API_HOST_PORT=' "$env_file" 2>/dev/null | cut -d= -f2- | tr -d '"\r') || true
    export MINIO_CONSOLE_HOST_PORT=$(grep -E '^MINIO_CONSOLE_HOST_PORT=' "$env_file" 2>/dev/null | cut -d= -f2- | tr -d '"\r') || true
    export SYNC_SERVER_HOST_PORT=$(grep -E '^SYNC_SERVER_HOST_PORT=' "$env_file" 2>/dev/null | cut -d= -f2- | tr -d '"\r') || true
  fi
  export POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-18581}"
  export MINIO_API_HOST_PORT="${MINIO_API_HOST_PORT:-18583}"
  export MINIO_CONSOLE_HOST_PORT="${MINIO_CONSOLE_HOST_PORT:-18584}"
  export SYNC_SERVER_HOST_PORT="${SYNC_SERVER_HOST_PORT:-18582}"
  bash "$root/portable/scripts/start-services.sh" "$root"
}

# ネイティブ起動したサービスを停止（--reset 用）
# 使用: reset_native_services
reset_native_services() {
  echo ">>> リセット: 依存サービスを停止"
  local root="${GACHABOARD_ROOT:-.}"
  bash "$root/portable/scripts/stop-services.sh" "$root"
  sleep 2
}

# docker compose up -d を実行（postgres / sync-server / minio のみ。web は --profile app で別起動）
# 開発時はローカルで npm run dev するため、ここでは web コンテナは起動しない。
run_docker_compose_up() {
  local max_compose_retries=3
  local compose_retry_interval=5

  # 1. 事前チェック: Engine が応答しない場合は compose 前に Docker を起動/待機
  if ! _docker_engine_alive; then
    if [[ "$(uname)" == "Darwin" ]] && [[ -d "/Applications/Docker.app" ]]; then
      if pgrep -f "Docker Desktop" >/dev/null 2>&1; then
        echo ""
        echo ">>> Docker Desktop は起動していますが、Engine が応答しません。再起動します..."
        if ! _restart_docker_desktop; then
          return 1
        fi
      else
        echo ""
        echo ">>> Docker Desktop が未起動のため、起動します..."
        open -a Docker
        echo "    Engine の起動を待機中（最大5分）..."
        for i in $(seq 1 300); do
          if _docker_engine_alive; then
            echo "    ✓ Docker Engine 起動完了 (${i}秒)"
            break
          fi
          sleep 1
          if [[ $i -eq 300 ]]; then
            return 1
          fi
        done
      fi
    else
      echo ""
      echo "❌ Docker に接続できません。Docker を起動してから再試行してください。"
      return 1
    fi
  fi

  # 2. データは常にプロジェクト直下 ./data（オプション廃止）
  local root="${GACHABOARD_ROOT:-.}"
  export GACHABOARD_DATA_DIR="${root}/data"
  mkdir -p "$GACHABOARD_DATA_DIR"

  # 3. 古いコンテナを掃除してから docker compose up -d --build を実行
  docker compose down --remove-orphans 2>/dev/null || true

  local attempt=1
  local err
  while true; do
    if err=$(docker compose up -d --build --remove-orphans 2>&1); then
      echo "$err"
      return 0
    fi

    echo ""
    echo ">>> docker compose up -d --build が失敗しました (試行 ${attempt}/${max_compose_retries}):"
    echo "$err"

    if [[ $attempt -ge $max_compose_retries ]]; then
      return 1
    fi

    # Engine 接続系のエラーかどうか判定（Engine 以外の問題なら再起動しても無駄）
    if ! _docker_engine_alive; then
      if [[ "$(uname)" == "Darwin" ]] && [[ -d "/Applications/Docker.app" ]]; then
        echo ""
        echo ">>> Docker Engine が応答しません。Docker Desktop を再起動します..."
        if ! _restart_docker_desktop; then
          return 1
        fi
      else
        echo ""
        echo "❌ Docker Engine に接続できません。Docker を起動してから再試行してください。"
        return 1
      fi
    fi

    attempt=$((attempt + 1))
    echo "    ${compose_retry_interval}秒後にリトライ (${attempt}/${max_compose_retries})..."
    sleep "$compose_retry_interval"
  done
}

# 指定ポートを解放（既存の Next.js を停止）
kill_app_port() {
  local port="${1:-${PORT:-18580}}"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null) || true
    if [[ -n "$pids" ]]; then
      echo ">>> ポート $port を解放中（既存プロセスを停止）"
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 2
    fi
  fi
}

# 後方互換のため kill_port_3000 をエイリアス
kill_port_3000() {
  kill_app_port 18580
}

# リセット: Docker コンテナを停止（Docker 利用時用。ネイティブ起動では reset_native_services を使用）
reset_docker() {
  echo ">>> リセット: Docker コンテナを停止"
  docker compose down 2>/dev/null || true
  sleep 2
}

# 全データリセット: Docker コンテナとボリュームを削除（PostgreSQL / MinIO / sync-server のデータが消える）
reset_docker_volumes() {
  echo ">>> 全データリセット: Docker コンテナ・ボリュームを削除"
  docker compose down -v 2>/dev/null || true
  sleep 2
}

# URL をブラウザで開く（可能なら今見てるウィンドウに新タブで追加＝新ウィンドウを出さない）
open_app_url() {
  local url="$1"
  if [[ -z "$url" ]]; then
    return 1
  fi
  if [[ "$(uname)" == "Darwin" ]] && command -v osascript >/dev/null 2>&1; then
    local front
    front=$(osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null) || true
    case "$front" in
      Safari)
        osascript -e "tell application \"Safari\" to make new tab at end of tabs of front window with properties {URL:\"$url\"}" 2>/dev/null && return 0
        ;;
      "Google Chrome")
        osascript -e "tell application \"Google Chrome\" to make new tab at end of tabs of front window with URL \"$url\"" 2>/dev/null && return 0
        ;;
      "Microsoft Edge")
        osascript -e "tell application \"Microsoft Edge\" to make new tab at end of tabs of front window with URL \"$url\"" 2>/dev/null && return 0
        ;;
    esac
    # 前面がブラウザでない、または失敗した場合は通常の open（新タブで開く）
    open "$url"
  elif [[ -f /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
    for p in /mnt/c/Windows/System32/cmd.exe /mnt/c/WINDOWS/System32/cmd.exe; do
      if [[ -x "$p" ]]; then
        "$p" /c start "" "$url" 2>/dev/null && return 0
        break
      fi
    done
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url"
  elif command -v open >/dev/null 2>&1; then
    open "$url"
  fi
}
