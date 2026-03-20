#!/usr/bin/env bash
# Create and maintain nextjs-web/.env.local (single canonical env file; no root .env)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$SCRIPTS_DIR")"
cd "$ROOT_DIR"

ENV_LOCAL="nextjs-web/.env.local"
ENV_ROOT=".env"

echo "=== Gachaboard env setup (nextjs-web/.env.local only) ==="

# Migrate or remove legacy root .env
if [[ -L "$ENV_ROOT" ]] || [[ -f "$ENV_ROOT" ]]; then
  if [[ -f "$ENV_ROOT" ]] && [[ ! -L "$ENV_ROOT" ]]; then
    if [[ ! -f "$ENV_LOCAL" ]]; then
      mkdir -p "$(dirname "$ENV_LOCAL")"
      mv "$ENV_ROOT" "$ENV_LOCAL"
      echo ">>> Moved root .env → $ENV_LOCAL"
    else
      while IFS= read -r line || [[ -n "$line" ]]; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue
        key="${line%%=*}"
        key="${key#"${key%%[![:space:]]*}"}"
        key="${key%"${key##*[![:space:]]}"}"
        [[ -z "$key" ]] && continue
        if ! grep -qE "^[[:space:]]*${key}=" "$ENV_LOCAL" 2>/dev/null; then
          echo "$line" >> "$ENV_LOCAL"
        fi
      done < "$ENV_ROOT"
      rm -f "$ENV_ROOT"
      echo ">>> Merged root .env into $ENV_LOCAL and removed root .env"
    fi
  else
    rm -f "$ENV_ROOT"
    echo ">>> Removed legacy root .env (symlink)"
  fi
fi

# 1. Create nextjs-web/.env.local from template if missing
if [[ ! -f "$ENV_LOCAL" ]] && [[ ! -L "$ENV_LOCAL" ]]; then
  cp .env.example "$ENV_LOCAL"
  echo ">>> $ENV_LOCAL created from .env.example"
elif [[ -L "$ENV_LOCAL" ]]; then
  echo ">>> Resolving old symlink .env.local → regular file"
  cp -L "$ENV_LOCAL" "${ENV_LOCAL}.tmp"
  rm "$ENV_LOCAL"
  mv "${ENV_LOCAL}.tmp" "$ENV_LOCAL"
fi

if ! grep -qE "^NEXTAUTH_SECRET=.+" "$ENV_LOCAL" 2>/dev/null; then
  secret=$(openssl rand -base64 32 2>/dev/null || echo "")
  if [[ -n "$secret" ]]; then
    if grep -q "^NEXTAUTH_SECRET=" "$ENV_LOCAL"; then
      tmp=$(mktemp)
      sed "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${secret}|" "$ENV_LOCAL" > "$tmp" && mv "$tmp" "$ENV_LOCAL"
    else
      echo "NEXTAUTH_SECRET=${secret}" >> "$ENV_LOCAL"
    fi
    echo "    NEXTAUTH_SECRET generated"
  fi
fi

bash "$SCRIPTS_DIR/lib/sync-env-ports.sh" 2>/dev/null || true

echo ""
echo "✓ Done. Edit $ENV_LOCAL (Discord OAuth, etc.) then start the app."
