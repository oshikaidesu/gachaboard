# Phase 1: Discord認証基盤

## 目的

- Auth.js（NextAuth）でDiscord OAuthを導入し、ユーザ識別情報をセッションで扱える状態にする。

## 実装対象

- `nextjs-web/src/app/api/auth/[...nextauth]/route.ts`
- `nextjs-web/src/lib/auth.ts`
- `nextjs-web/src/app/layout.tsx`
- `nextjs-web/.env.example`

## タスク

1. Auth.js/Discord Providerを導入。
2. `guilds` スコープでログイン。
3. セッションへ `discordId`, `username`, `avatar` を保持。
4. 未ログイン時の導線（サインイン・サインアウトUI）を配置。

## 依存

- 先行: `Phase 0`
- 後続に提供: `Phase 3`, `Phase 4`

## 完了条件

- ログイン後にユーザの `id/name/icon` が画面表示できる。
