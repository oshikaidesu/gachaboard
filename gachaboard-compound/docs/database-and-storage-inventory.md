# DB・ストレージ一覧

> **目的**: プロジェクト内のすべてのデータ保存・永続化レイヤーを網羅的に一覧化する。  
> **作成日**: 2026-03-08

---

## 0. サービス構成（起動するもの）

| サービス | ポート | 役割 |
|----------|--------|------|
| **Next.js** | 3000 | Web アプリ本体（認証・API・フロント） |
| **PostgreSQL** | 5433 | ユーザー・ワークスペース・ボード・アセットのメタデータ |
| **sync-server** | 5858 | Yjs WebSocket サーバー（リアルタイム共同編集） |
| **MinIO** | 9000 | S3 互換ストレージ（ファイル本体） |

最小構成（アプリ + DB）に、リアルタイム同期とファイルストレージを足した構成。`docker compose up -d` で postgres / sync-server / minio を起動。Next.js は `npm run dev` で別途起動。

---

## 1. 全体マップ

```mermaid
flowchart TB
    subgraph Server [サーバー側]
        PG[(PostgreSQL)]
        Mem[Y.Doc メモリ]
        S3[S3/MinIO]
    end
    subgraph Client [クライアント側]
        IDB[IndexedDB]
        LS[localStorage]
        MemMap[Map メモリキャッシュ]
    end
    PG <--> NextJS
    Mem <--> SyncServer
    SyncServer <--> WebSocket
    WebSocket <--> Client
    IDB <--> Client
    LS <--> Client
    MemMap <--> Client
    NextJS --> S3
    Client --> NextJS
```

---

## 2. PostgreSQL（Prisma）

**接続**: `DATABASE_URL`（Docker: `postgresql://gachaboard:gachaboard@localhost:5433/gachaboard`）

### 2.1 スキーマ一覧

| モデル | 主用途 | 備考 |
|--------|--------|------|
| **User** | Discord OAuth ユーザー | `discordId` で upsert。NextAuth は JWT 戦略のため Account/Session テーブルなし |
| **Workspace** | プロジェクト単位 | `ownerUserId`, `inviteToken`, ソフト削除 |
| **WorkspaceMember** | 招待メンバー | `workspaceId` + `userId` のユニーク |
| **Board** | ホワイトボード | `snapshotData`（records + reactions + comments + reactionEmojiPreset） |
| **Asset** | アップロードファイルメタ | `workspaceId` + `boardId?`。`storageKey` で実体参照 |
| **S3UploadSession** | S3 マルチパート再開用 | `uploadId` 一意。完了後に削除 |

#### Asset trash の 10 分猶予

キャンバス上のシェイプ削除時、アセットは**即座に trash されない**。10 分の猶予を持たせる。その間に Undo されたら trash をキャンセルする。タブを閉じる / ボード離脱時は即時フラッシュ。

- **理由**: Undo（元に戻す）時に DB がすでに trash 済みだと、ファイル API が 404 を返し「ファイルが削除されました」となる問題を避けるため
- **実装**: `useShapeDeletePositionCapture`
- **補足**: 削除してからゴミ箱に反映されるまで最大 10 分かかる場合がある。同期エラーではない
| **AuditLog** | 監査ログ | `action`, `target`, `metadata` |

**注**: リアクション・コメントは Y.Doc に統合済み（ObjectReaction, MediaComment テーブルは削除）。Connector も削除（アローは tldraw shape で Y.Doc 内）。

### 2.2 冗長フィールド

- `Asset` に `workspaceId` を冗長保持（未配置アセット一覧用）

### 2.3 認証

- NextAuth: **JWT 戦略**（`session: { strategy: "jwt" }`）
- `db.user.upsert` は JWT コールバック内で実行。DB には User のみ、Account/Session テーブルは使っていない

---

## 3. sync-server（Y.Doc）

**プロセス**: `y-websocket-server`（y-websocket 同梱）  
**ポート**: 5858（デフォルト）

| 項目 | 内容 |
|------|------|
| 永続化 | **メモリのみ**。再起動で Y.Doc 消失 |
| ルーム | URL パス（例: `/room/{boardId}`）でルーム識別 |
| 復旧 | クライアントの IndexedDB または API の `Board.snapshotData` から復元 |

---

## 4. ファイルストレージ（S3/MinIO）

### 4.1 バケット構造・環境変数

- バケット内パス: `assets/`, `converted/`, `thumbnails/`, `waveforms/` 等
- 環境変数: `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_URL`

### 4.2 配信フロー（Presigned URL）

- **アップロード**: クライアント → init API（認可）→ Presigned PUT URL → S3 に直接アップロード
- **配信**: クライアント → file/thumbnail API（認可）→ 302 リダイレクト → Presigned GET URL → S3 から直接取得
- **波形**: waveform API は fetch が CORS で弾かれるため Next.js 経由でプロキシ（データは小さい）
- Next.js は認可と Presigned URL 発行のみ。実データは S3 とクライアント間で直接転送

### 4.3 MinIO CORS

MinIO を別オリジン（例: localhost:9000）で使う場合、バケットに CORS を設定する必要があります。`mc` または MinIO Console で、アプリのオリジン（例: `http://localhost:3000`）を許可してください。

### 4.4 参照

- `Asset.storageKey`: ファイル名（UUID + 拡張子）
- `Asset.storageBackend`: `"s3"`（S3 のみ）

---

## 5. クライアント側ストレージ

### 5.1 IndexedDB

| DB 名 | ストア | 用途 | 備考 |
|-------|--------|------|------|
| **y-indexeddb**（y-indexeddb が作成） | - | Y.Doc 永続化 | ルーム ID をキーに Y.Doc を保存。リロード即復元・オフライン編集 |
| **gachaboard-s3-uploads** | sessions | S3 再開可能アップロード | `uploadId` を keyPath。FileSystemFileHandle も保存可 |

### 5.2 localStorage

| キー | 用途 |
|------|------|
| `COMPOUND_USER_DATA_v3` | compound ユーザー設定（ダークモード等） |
| `gachaboard-camera:{roomId}` | ボードごとのカメラ位置・instance_page_state |

### 5.3 メモリキャッシュ（Map）

| 場所 | 用途 | 上限・TTL |
|------|------|-----------|
| `OgpPreview.tsx` | OGP データ | 200 件（古いものから削除） |
| `api/ogp/route.ts` | OGP API レスポンス | 1 時間 TTL |

---

## 6. データフロー概要

```mermaid
flowchart LR
    subgraph PG [PostgreSQL]
        User
        WS[Workspace]
        Board
        Asset
        S3[S3UploadSession]
        Audit[AuditLog]
    end
    subgraph YDoc [Y.Doc]
        Shapes[shapes/pages]
        Reactions[reactions]
        Comments[comments]
        ReactionPreset[reactionEmojiPreset]
    end
    subgraph Storage [ファイル]
        S3Storage[S3/MinIO]
    end
    User --> WS
    WS --> Board
    Board --> Snapshot[snapshotData]
    Snapshot --> Shapes
    Snapshot --> Reactions
    Snapshot --> Comments
    Snapshot --> ReactionPreset
    Board --> Asset
    Asset --> S3Storage
    Shapes --> IndexedDB
    Reactions --> IndexedDB
    Comments --> IndexedDB
    ReactionPreset --> IndexedDB
```

- **シェイプ・リアクション・コメント（Y.Doc）**: クライアント ↔ sync-server で WebSocket 同期。IndexedDB に永続
- **snapshotData**: records + reactions + comments + reactionEmojiPreset を定期的に PostgreSQL へ保存。sync-server 再起動時の復旧用
- **Asset**: メタデータは PostgreSQL、実体は S3/MinIO

---

## 7. 不整合・注意点

### 7.1 スキーマと認証

- Account / Session テーブルは Prisma スキーマに**含まれていない**（JWT 戦略のため）
- `@auth/prisma-adapter` は依存にあるが、auth.ts では使用していない

### 7.2 冗長 workspaceId

- Asset の `workspaceId` は denormalized（未配置アセット一覧用）

---

## 8. 関連ファイル

| 種類 | パス |
|------|------|
| Prisma スキーマ | `nextjs-web/prisma/schema.prisma` |
| DB クライアント | `nextjs-web/src/lib/db.ts` |
| ストレージ操作 | `nextjs-web/src/lib/storage.ts`, `nextjs-web/src/lib/s3.ts` |
| S3 セッション IndexedDB | `nextjs-web/src/lib/s3UploadSessionStore.ts` |
| Y.Doc 永続化 | `nextjs-web/src/app/hooks/useYjsStore.ts`（y-indexeddb） |
| sync-server | `nextjs-web/sync-server/`（Docker はこちらを使用）。ルート `sync-server/` は同構成の別コピー |
