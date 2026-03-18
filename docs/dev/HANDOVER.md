# 引き継ぎドキュメント

新規参加者・引き継ぎ担当者向けに、Gachaboard の全体像と開発フローを解説します。

---

## 1. 全体像

Gachaboard は**音楽・映像・デザインファイルを貼り付けて共有できるリアルタイム共同ホワイトボード**です。

- **対象**: Discord コミュニティなど、限定されたメンバー間での利用を想定
- **運用**: ローカルサーバー 1 台で完結。クラウド依存を最小化
- **認証**: Discord OAuth 必須

---

## 2. 構成

```
（プロジェクトルート）/
├── nextjs-web/      # メインアプリ（Next.js + compound + API）
├── sync-server/     # Yjs WebSocket サーバ（ルート直下。起動スクリプトは nextjs-web/sync-server を使用）
├── portable/        # PostgreSQL・MinIO の取得・起動スクリプト
├── scripts/         # 起動・セットアップ（start.sh, launcher.sh, win/run.ps1 等）
└── docs/            # ドキュメント（user / dev / archive）
```

### 技術スタック

| 層 | 技術 |
|----|------|
| フロント | Next.js 16, React 18, Tailwind CSS |
| ホワイトボード | compound (@cmpd/compound, @cmpd/editor) |
| 同期 | Yjs, y-websocket |
| 認証 | NextAuth, Discord OAuth |
| DB | PostgreSQL, Prisma |
| ストレージ | S3 互換（AWS/MinIO）必須 |
| メディア変換 | fluent-ffmpeg |

---

## 3. 開発フロー

### 起動手順

- **Windows**: `start.bat` を実行 → 1（ローカル）または 2（Tailscale）を選択。PostgreSQL・MinIO・sync-server が自動で起動し、Next.js も起動する。
- **Mac / Linux**: `./start.sh` または `start.command` を実行。同様に依存サービス + Next.js が起動する。

初回は `nextjs-web/.env.local` に `DISCORD_CLIENT_ID` と `DISCORD_CLIENT_SECRET` を入力。`npm run setup:env` で .env を生成してから起動してもよい。詳細は [SETUP.md](../user/SETUP.md) を参照。

### 環境変数

- 必須: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`
- S3/MinIO: `env.local.template` に既定値が含まれています
- `SERVER_OWNER_DISCORD_ID`: オーナー限定運用時に設定。詳細は [ownership-design.md](../user/ownership-design.md)
- `npm run setup:env` を実行して .env を生成してから起動することも可能です。詳細は [SETUP.md](../user/SETUP.md) を参照。

---

## 4. 主要なディレクトリ・ファイル

### nextjs-web

| パス | 用途 |
|------|------|
| `src/app/board/[boardId]/` | ボード画面 |
| `src/app/components/board/CompoundBoard.tsx` | ボード編集の中心 |
| `src/app/shapes/` | カスタムシェイプ（video, audio, text-file, file-icon 等） |
| `src/app/hooks/` | useYjsStore, useFileDropHandler 等 |
| `src/app/api/` | API ルート |
| `src/lib/` | auth, storage, db 等 |
| `shared/` | API 型、定数、shapeDefs |

### sync-server

- 場所: `nextjs-web/sync-server`（起動スクリプトではこちらのディレクトリを使用します）。ルート直下にも同名フォルダあり
- y-websocket 同梱の WebSocket サーバ。Hocuspocus + SQLite（YPERSISTENCE）で永続化。再起動時は SQLite から復元
- 起動: start スクリプトが `node server.mjs` で起動。ポートは `SYNC_SERVER_HOST_PORT`（デフォルト 18582）

---

## 5. 必読ドキュメント（優先順）

1. [README.md](../../README.md) - クイックスタート
2. [SETUP.md](../user/SETUP.md) - セットアップ
3. [CONCEPT.md](CONCEPT.md) - コンセプト・設計思想
4. [ARCHITECTURE.md](ARCHITECTURE.md) - アーキテクチャ
5. [yjs-system-specification.md](yjs-system-specification.md) - 同期の詳細仕様

---

## 6. トラブルシューティング

| 事象 | 参照 |
|------|------|
| Discord 認証エラー | [discord-auth-troubleshooting.md](../user/discord-auth-troubleshooting.md) |
| Tailscale 経由アクセス | 同上 |
| 動画・音声の変換失敗 | ffmpeg が入っているか確認 |
| 同期が動かない | `NEXT_PUBLIC_SYNC_WS_URL` が正しいか、sync-server が起動しているか |

---

## 7. 用語・略語

[GLOSSARY.md](GLOSSARY.md) を参照。
