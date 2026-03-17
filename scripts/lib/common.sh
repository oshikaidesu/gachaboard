#!/usr/bin/env bash
# 起動スクリプト共通処理

# WSL2 かどうか判定
_is_wsl2() {
  [[ -f /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null
}

# 必須ツールの存在チェック。未インストールなら催促して return 1
# WSL2 の場合、自動インストールを案内・実行する
# 使用: check_required [tailscale] || exit 1
#   tailscale … Tailscale モード用に tailscale コマンドも必須にする
check_required() {
  local missing=()
  local need_tailscale=false
  for arg in "$@"; do
    [[ "$arg" == "tailscale" ]] && need_tailscale=true
  done

  command -v docker >/dev/null 2>&1 || missing+=("docker")
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

    # WSL2: 自動インストールを実行（プロンプトなし、start.bat から一発起動）
    if _is_wsl2; then
      if [[ "${CHECK_REQUIRED_INSTALL_ATTEMPTED:-0}" == "1" ]]; then
        echo "  インストール後も不足があります。手動で docs/user/WSL2-SETUP.md を参照してください。"
        echo "============================================"
        echo ""
        return 1
      fi
      echo "  📦 不足しているツールをインストールしています..."
      echo "     詳細: docs/user/WSL2-SETUP.md"
      echo ""
      export CHECK_REQUIRED_INSTALL_ATTEMPTED=1
      local root_dir="${GACHABOARD_ROOT:-.}"
      local setup_script="${root_dir}/scripts/setup/wsl2-install-deps.sh"
      if [[ -f "$setup_script" ]]; then
        local install_ok=false
        for p in /mnt/c/Windows/System32/wsl.exe /mnt/c/WINDOWS/System32/wsl.exe; do
          if [[ -x "$p" ]]; then
            "$p" -u root -e bash -c "cd \"$root_dir\" && bash scripts/setup/wsl2-install-deps.sh" && install_ok=true
            break
          fi
        done
        [[ "$install_ok" != true ]] && bash "$setup_script" && install_ok=true
        if [[ "$install_ok" == true ]]; then
          echo ""
          echo "  インストール完了。起動を再試行します..."
          echo "============================================"
          echo ""
          check_required "$@"
          return $?
        fi
      else
        echo "  セットアップスクリプトが見つかりません: $setup_script"
      fi
      echo "============================================"
      echo ""
      return 1
    fi

    local step=1
    if [[ "$(uname)" == "Darwin" ]]; then
      echo "  📦 Mac でのインストール手順:"
      echo "  ─────────────────────────────"
      for m in "${missing[@]}"; do
        case "$m" in
          docker)    echo "  ${step}) Docker Desktop をインストール"
                     echo "     https://docs.docker.com/desktop/install/mac-install/"
                     echo ""; step=$((step+1)) ;;
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
          docker)    echo "  ${step}) Docker Engine をインストール"
                     echo "     https://docs.docker.com/engine/install/"
                     echo ""; step=$((step+1)) ;;
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
    echo "  .env が未作成です（初回セットアップ）"
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

# .env (root) を nextjs-web/.env.local へのシンボリックリンクにする。
# Mac / Linux / WSL2 共通。1ファイルで管理し二重管理を防ぐ。
# 使用: ensure_env_symlink "$ROOT_DIR"
ROOT_ONLY_KEYS=""

ensure_env_symlink() {
  local root_dir="${1:-.}"
  local env_local="${root_dir}/nextjs-web/.env.local"
  local env_root="${root_dir}/.env"

  [[ -f "$env_local" ]] || [[ -L "$env_local" ]] || return 0

  if [[ -L "$env_root" ]]; then
    return 0
  fi

  if [[ -f "$env_root" ]]; then
    echo ">>> .env が通常ファイルです。シンボリックリンクに修復します..."
    for key in $ROOT_ONLY_KEYS; do
      local val
      val=$(grep -E "^[[:space:]]*${key}=" "$env_root" 2>/dev/null | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '\"\\r')
      [[ -z "$val" ]] && continue
      grep -qE "^[[:space:]]*${key}=" "$env_local" 2>/dev/null || echo "${key}=${val}" >> "$env_local"
    done
    rm -f "$env_root"
  fi

  ln -sf "nextjs-web/.env.local" "$env_root"
  echo "    ✓ .env → nextjs-web/.env.local シンボリックリンク作成"
}

# switch-env.sh 実行後、.env.local の変更を root .env に反映する。
# シンボリックリンク時は同一ファイルなので不要。コピー方式（Windows で symlink 不可）のときのみ必要。
sync_env_to_root() {
  local root_dir="${1:-.}"
  local env_local="${root_dir}/nextjs-web/.env.local"
  local env_root="${root_dir}/.env"
  [[ -f "$env_local" ]] || return 0
  [[ -L "$env_root" ]] && return 0
  cp "$env_local" "$env_root"
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
# 本質: コンテナ稼働後に pg_isready で判定（Docker health は補助）。Windows でも確実に通す。
# 使用: wait_for_postgres || exit 1
wait_for_postgres() {
  local max=300
  echo "    PostgreSQL の起動を待機中..."
  for i in $(seq 1 "$max"); do
    # コンテナが存在しない・未稼働のときは docker exec を叩かずスキップ（エラー抑制）
    local running
    running=$(docker inspect -f '{{.State.Running}}' compound-postgres 2>/dev/null || echo "false")
    if [[ "$running" != "true" ]]; then
      sleep 1
      continue
    fi
    # 接続可能なら完了（判定の主体は pg_isready。health は参考）
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
    sleep 1
  done
  echo "    ⚠ PostgreSQL の起動が ${max}秒 以内に完了しませんでした"
  return 1
}

# nextjs-web で Prisma スキーマを適用（generate + db push）
# 使用: apply_prisma_schema "$ROOT_DIR"
apply_prisma_schema() {
  local root_dir="${1:-.}"
  local web_dir="${root_dir}/nextjs-web"
  echo ">>> スキーマ適用 (prisma generate / db push)"
  (cd "$web_dir" && npx prisma generate && npx prisma db push)
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

# docker compose up -d を実行（postgres / sync-server / minio のみ。Next.js は --profile app で別起動）。
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
    elif _is_wsl2; then
      echo ""
      echo ">>> Docker Engine が未起動です。起動しています..."
      for p in /mnt/c/Windows/System32/wsl.exe /mnt/c/WINDOWS/System32/wsl.exe; do
        if [[ -x "$p" ]]; then
          "$p" -u root -e service docker start 2>/dev/null || true
          break
        fi
      done
      echo "    Engine の起動を待機中（最大60秒）..."
      for i in $(seq 1 60); do
        if _docker_engine_alive; then
          echo "    ✓ Docker Engine 起動完了 (${i}秒)"
          break
        fi
        sleep 1
        if [[ $i -eq 60 ]]; then
          echo ""
          echo "❌ Docker に接続できません。WSL で sudo service docker start を実行してください。"
          return 1
        fi
      done
    else
      echo ""
      echo "❌ Docker に接続できません。Docker を起動してから再試行してください。"
      return 1
    fi
  fi

  # 2. データは常にプロジェクト直下 ./data（オプション廃止）
  local root="${GACHABOARD_ROOT:-.}"
  if _is_wsl2; then
    export PATH="/usr/bin:$PATH"
    [[ -n "$root" ]] && {
      mkdir -p "${root}/.gachaboard/docker-wsl2"
      [[ ! -f "${root}/.gachaboard/docker-wsl2/config.json" ]] && echo '{}' > "${root}/.gachaboard/docker-wsl2/config.json"
      export DOCKER_CONFIG="${root}/.gachaboard/docker-wsl2"
    }
    export DOCKER_BUILDKIT=0
    if [[ "$root" == /mnt/d/* ]]; then
      export GACHABOARD_DATA_DIR="/mnt/d/gachaboard-data"
    elif [[ "$root" == /mnt/* ]]; then
      export GACHABOARD_DATA_DIR="$HOME/gachaboard-data"
    else
      export GACHABOARD_DATA_DIR="${root}/data"
    fi
  else
    export GACHABOARD_DATA_DIR="${root}/data"
  fi
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
      elif _is_wsl2; then
        for p in /mnt/c/Windows/System32/wsl.exe /mnt/c/WINDOWS/System32/wsl.exe; do
          [[ -x "$p" ]] && "$p" -u root -e service docker start 2>/dev/null; break
        done
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

# リセット: Docker コンテナを停止
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
