#!/usr/bin/env bash
# 起動スクリプト共通処理

# Docker Engine が応答するか（ソケット経由で _ping）
_docker_engine_alive() {
  curl -sf --unix-socket "$HOME/.docker/run/docker.sock" http://localhost/_ping >/dev/null 2>&1
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

# docker compose up -d を実行。失敗時は Docker Desktop の起動・再起動を試みる
run_docker_compose_up() {
  # 1. まず普通に試す
  local err
  if err=$(docker compose up -d 2>&1); then
    echo "$err"
    return 0
  fi

  # Docker 接続エラー以外ならそのまま失敗
  if [[ "$err" != *"Cannot connect to the Docker daemon"* ]] && [[ "$err" != *"docker daemon running"* ]]; then
    echo "$err"
    return 1
  fi

  # macOS 以外は案内のみ
  if [[ "$(uname)" != "Darwin" ]] || [[ ! -d "/Applications/Docker.app" ]]; then
    echo "$err"
    return 1
  fi

  # 2. Docker Desktop の GUI が動いているか確認
  if pgrep -f "Docker Desktop" >/dev/null 2>&1; then
    # GUI はあるが Engine が死んでいる → 再起動
    echo ""
    echo ">>> Docker Desktop は起動していますが、Engine が応答しません。再起動します..."
    if ! _restart_docker_desktop; then
      return 1
    fi
  else
    # Docker Desktop 自体が未起動 → 起動
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

  # 3. Engine が起動したので docker compose をリトライ
  docker compose up -d
}

# ポート 3000 を解放（既存の Next.js を停止）
kill_port_3000() {
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti :3000 2>/dev/null) || true
    if [[ -n "$pids" ]]; then
      echo ">>> ポート 3000 を解放中（既存プロセスを停止）"
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 2
    fi
  fi
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
