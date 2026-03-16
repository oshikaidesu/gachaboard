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

  command -v docker >/dev/null 2>&1 || missing+=("docker")
  # node と npm はセットで判定（node がなければ npm も表示不要）
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    missing+=("node")
  fi
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  [[ "$need_tailscale" == true ]] && { command -v tailscale >/dev/null 2>&1 || missing+=("tailscale"); }
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
          tailscale) echo "  ${step}) Tailscale をインストール"
                     echo "     brew install tailscale"
                     echo "     または https://tailscale.com/download"
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
          tailscale) echo "  ${step}) Tailscale をインストール"
                     echo "     https://tailscale.com/download"
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

# プロジェクトルートの .env が nextjs-web/.env.local へのシンボリックリンクか確認し、
# 通常ファイルになっていたら修復する（二重管理で env が食い違う問題を防止）
# 使用: ensure_env_symlink "$ROOT_DIR"
ensure_env_symlink() {
  local root_dir="${1:-.}"
  local env_local="${root_dir}/nextjs-web/.env.local"
  local env_root="${root_dir}/.env"

  [[ -f "$env_local" ]] || return 0

  if [[ -L "$env_root" ]]; then
    return 0
  fi

  if [[ -f "$env_root" ]]; then
    echo ">>> .env が通常ファイルです。シンボリックリンクに修復します..."
    cp "$env_root" "$env_local"
    rm "$env_root"
    ln -s "nextjs-web/.env.local" "$env_root"
    echo "    ✓ .env → nextjs-web/.env.local シンボリックリンク復元"
    return 0
  fi

  ln -s "nextjs-web/.env.local" "$env_root"
  echo "    ✓ .env → nextjs-web/.env.local シンボリックリンク作成"
}

# Docker Engine が応答するか（docker info で CLI 経由の接続を確認）
_docker_engine_alive() {
  docker info >/dev/null 2>&1
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
    else
      echo ""
      echo "❌ Docker に接続できません。Docker Desktop を起動してから再試行してください。"
      echo "   macOS: open -a Docker"
      return 1
    fi
  fi

  # 2. 古いコンテナを掃除してから docker compose up -d を実行（最大3回リトライ、5秒間隔）
  docker compose down --remove-orphans 2>/dev/null || true

  local attempt=1
  local err
  while true; do
    if err=$(docker compose up -d --remove-orphans 2>&1); then
      echo "$err"
      return 0
    fi

    echo ""
    echo ">>> docker compose up -d が失敗しました (試行 ${attempt}/${max_compose_retries}):"
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
# 使用: kill_app_port または kill_app_port 3010
# 環境変数 PORT または第1引数。未指定時は 18580
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
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url"
  elif command -v open >/dev/null 2>&1; then
    open "$url"
  fi
}
