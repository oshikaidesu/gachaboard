# DB・ストレージ一覧

> **目的**: プロジェクト内のすべてのデータ保存・永続化レイヤーを網羅的に一覧化する。  
> **作成日**: 2026-03-08

---

## 1. 全体マップ

```mermaid
flowchart TB
    subgraph Server [サーバー側]
        PG[(PostgreSQL)]
        Mem[Y.Doc メモリ]
        Local[uploads/ ローカル]
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
    NextJS --> Local
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

## 4. ファイルストレージ

### 4.1 ローカル（`uploads/`）

| ディレクトリ | 用途 |
|--------------|------|
| `uploads/assets/` | 元ファイル |
| `uploads/converted/` | 変換済み（mp3, 720p mp4） |
| `uploads/thumbnails/` | 動画サムネイル JPEG |
| `uploads/waveforms/` | 音声波形 JSON |
| `uploads/chunks/` | チャンクアップロード一時 |

- S3 未設定時はここに保存。`UPLOAD_DIR` 等で制御

### 4.2 S3 / MinIO

- バケット内に上記と同様のパス構造
- 環境変数: `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_URL`

### 4.3 参照

- `Asset.storageKey`: ファイル名（UUID + 拡張子）
- `Asset.storageBackend`: `"local"` | `"s3"`

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
| `uploadSession:{fileName}:{size}:{chunks}` | チャンクアップロード再開用の uploadId |

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
        Local[uploads/]
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
    Asset --> Local
    Asset --> S3Storage
    Shapes --> IndexedDB
    Reactions --> IndexedDB
    Comments --> IndexedDB
    ReactionPreset --> IndexedDB
```

- **シェイプ・リアクション・コメント（Y.Doc）**: クライアント ↔ sync-server で WebSocket 同期。IndexedDB に永続
- **snapshotData**: records + reactions + comments + reactionEmojiPreset を定期的に PostgreSQL へ保存。sync-server 再起動時の復旧用
- **Asset**: メタデータは PostgreSQL、実体はローカル or S3

---

## 7. 不整合・注意点

### 7.1 ドキュメントと実装の差異

| ドキュメント | 記載 | 実態 |
|--------------|------|------|
| `ARCHITECTURE.md` | BoardMember | スキーマには WorkspaceMember のみ |

### 7.2 スキーマと認証

- Account / Session テーブルは Prisma スキーマに**含まれていない**（JWT 戦略のため）
- `@auth/prisma-adapter` は依存にあるが、auth.ts では使用していない

### 7.3 冗長 workspaceId

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
