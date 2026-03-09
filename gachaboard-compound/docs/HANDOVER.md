# 引き継ぎドキュメント

> 新規参加者・引き継ぎ担当者向けの体系的ドキュメント。

---

## 1. 全体像

Gachaboard は「音楽・映像・デザインファイルを貼り付けて共有できるリアルタイム共同ホワイトボード」です。Discord 認証で身内向けに運用し、ローカルサーバー 1 台で完結する設計です。

### 1.1 主要リポジトリ構成

```
gachaboard-compound/
├── nextjs-web/      # メインアプリ（Next.js + compound + API）
├── sync-server/     # Yjs WebSocket サーバ
├── docs/            # ドキュメント群
└── docker-compose.yml
```

### 1.2 必読ドキュメント（優先順）

1. [README.md](../README.md) - クイックスタート
2. [CONCEPT.md](CONCEPT.md) - コンセプト・設計思想
3. [ARCHITECTURE.md](ARCHITECTURE.md) - アーキテクチャ
4. [GETTING-STARTED.md](GETTING-STARTED.md) - 開発環境セットアップ
5. [yjs-system-specification.md](yjs-system-specification.md) - 同期の詳細仕様

---

## 2. 開発フロー

### 2.1 ローカル起動手順

```bash
# 1. インフラ起動
cd gachaboard-compound
docker compose up -d

# 2. アプリセットアップ（初回）
cd nextjs-web
cp env.local.template .env.local
# .env.local を編集

npm install --legacy-peer-deps
npx prisma generate
npx prisma db push

# 3. 起動
npm run dev
```

### 2.2 環境変数

- `env.local.template` を `.env.local` にコピーして編集
- Discord OAuth、NextAuth、DATABASE_URL が必須
- `SERVER_OWNER_DISCORD_ID`: サーバーオーナーの Discord ID。未設定なら全員アクセス可。設定時はオーナーのみ WS にアクセス。運用詳細は [ownership-design.md](ownership-design.md)
- S3/MinIO が必須。`env.local.template` にデフォルト値あり

### 2.3 マイグレーション

```bash
cd nextjs-web
npx prisma migrate dev
```

---

## 3. 技術スタック一覧

| 層 | 技術 |
|----|------|
| フロント | Next.js 16, React 18, Tailwind CSS |
| ホワイトボード | compound (@cmpd/compound, @cmpd/editor) |
| 同期 | Yjs, y-websocket |
| 認証 | NextAuth, Discord OAuth |
| DB | PostgreSQL, Prisma |
| ストレージ | S3 互換（AWS/MinIO）またはローカル |
| メディア変換 | fluent-ffmpeg |

---

## 4. 主要なディレクトリ・ファイル

### 4.1 nextjs-web

| パス | 用途 |
|------|------|
| `src/app/board/[boardId]/` | ボード画面 |
| `src/app/components/board/CompoundBoard.tsx` | ボード編集の中心 |
| `src/app/shapes/` | カスタムシェイプ（video, audio, text-file, file-icon 等） |
| `src/app/hooks/` | useYjsStore, useFileDropHandler 等 |
| `src/app/api/` | API ルート |
| `src/lib/` | auth, storage, db 等 |
| `shared/` | API 型、定数、shapeDefs（sync-server と共有） |

### 4.2 sync-server

- `y-websocket` 同梱の WebSocket サーバ
- ルーム単位で Y.Doc をメモリ保持（永続化なし）
- 起動: `cd sync-server && PORT=5858 npm start`

---

## 5. Phase 状況と TODO

### 5.1 完了済み

- Phase 1: プロジェクト基盤（compound + 永続）
- Phase 2: カスタムシェイプ移植
- Phase 3: 同期層（Yjs + y-websocket）
- Phase 4: ConnectHandles, SmartHandTool, アセット API
- Phase 5: メディア拡張（YouTube, OGP, 変換）
- Phase 6: コラボ機能（リアクション, コメント, 作成者表示）

### 5.2 未対応・要確認

- Phase 7: コネクタ体験（アンカー, ルーティング, 障害物回避）
- GIF 対応
- 詳細は [planning/fresh-to-compound-migration.md](planning/fresh-to-compound-migration.md)

---

## 6. トラブルシューティング

| 事象 | 参照 |
|------|------|
| Discord 認証エラー | [discord-auth-troubleshooting.md](discord-auth-troubleshooting.md) |
| Tailscale 経由アクセス | 同上、「Tailscale 経由でスマホからアクセスする場合」 |
| 動画・音声の変換失敗 | README「軽量化の確認」、ffmpeg が入っているか確認 |
| 同期が動かない | `NEXT_PUBLIC_SYNC_WS_URL` が正しいか、sync-server が起動しているか |

---

## 7. 用語・略語

[GLOSSARY.md](GLOSSARY.md) を参照。

---

## 8. 関連リポジトリ・アーカイブ

- **gachaboard-fresh**: tldraw ベースの参照実装。compound への移行元
- **アーカイブ/gachaboard-Weave-v3**: 旧 Konva 系のアーカイブ
