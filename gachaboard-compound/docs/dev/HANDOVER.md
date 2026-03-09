# 引き継ぎドキュメント

新規参加者・引き継ぎ担当者向け。Gachaboard の全体像と開発フローをまとめます。

---

## 1. 全体像

Gachaboard は**音楽・映像・デザインファイルを貼り付けて共有できるリアルタイム共同ホワイトボード**です。

- **対象**: Discord コミュニティ内の身内
- **運用**: ローカルサーバー 1 台で完結。クラウド依存を最小化
- **認証**: Discord OAuth 必須

---

## 2. 構成

```
gachaboard-compound/
├── nextjs-web/      # メインアプリ（Next.js + compound + API）
├── sync-server/     # Yjs WebSocket サーバ（ルート直下。Docker は nextjs-web/sync-server を使用）
├── docs/            # ドキュメント（user / dev / archive）
└── docker-compose.yml
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

```bash
cd gachaboard-compound
docker compose up -d

cd nextjs-web
cp env.local.template .env.local
# .env.local を編集

npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npm run dev
```

### 環境変数

- 必須: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`
- S3/MinIO: `env.local.template` にデフォルト値あり
- `SERVER_OWNER_DISCORD_ID`: オーナー限定運用時に設定。詳細は [ownership-design.md](../user/ownership-design.md)

### マイグレーション

```bash
cd nextjs-web
npx prisma migrate dev
```

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

- 場所: `nextjs-web/sync-server`（Docker 使用）。ルート直下にも同名フォルダあり
- y-websocket 同梱の WebSocket サーバ
- ルーム単位で Y.Doc をメモリ保持（永続化なし）
- 起動: `cd nextjs-web/sync-server && PORT=5858 npm start`

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
