# アーキテクチャ概要

> Gachaboard のシステム構成とコンポーネントの関係をまとめる。

---

## 1. 全体構成

```
┌─────────────────────────────────────────────────────────────────────┐
│  クライアント（ブラウザ）                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Next.js App  │  │ compound     │  │ Yjs Provider │               │
│  │ (React)      │  │ (ホワイトボード) │  │ (WebSocket)  │               │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘               │
└─────────┼───────────────────────────────────┼───────────────────────┘
          │ HTTP/HTTPS                        │ WebSocket
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  サーバー（1 台想定）                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ nextjs-web   │  │ sync-server  │  │ postgres     │               │
│  │ :3000        │  │ :5858        │  │ :5432        │               │
│  │ API / Auth   │  │ Yjs rooms    │  │ メタデータ    │               │
│  └──────┬───────┘  └──────────────┘  └──────────────┘               │
│         │                                                             │
│         ▼                                                             │
│  ┌──────────────┐  ┌──────────────┐                                  │
│  │ MinIO / S3   │  │ uploads/     │  ファイル保存                     │
│  │ オブジェクト  │  │ ローカル     │                                  │
│  └──────────────┘  └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. アプリケーション層

### 2.1 ルーティング（nextjs-web）

| パス | 用途 |
|------|------|
| `/` | トップ（ログイン誘導） |
| `/workspaces` | ワークスペース一覧 |
| `/workspace/[id]` | ワークスペース詳細（ボード一覧） |
| `/board/[id]` | ボード編集画面 |
| `/board/[id]/trash` | ゴミ箱 |
| `/board/[id]/reaction-preset` | リアクション絵文字プリセット |
| `/access-denied` | アクセス拒否（オーナー制限・招待外時） |
| `/auth/signin` | Discord サインイン |

### 2.2 API ルート

| エンドポイント | 用途 |
|----------------|------|
| `/api/auth/[...nextauth]` | NextAuth（Discord OAuth） |
| `/api/workspaces`, `/api/workspaces/[id]/boards` | ワークスペース・ボード管理 |
| `/api/workspaces/[id]/invite`, `/api/workspaces/[id]/members` | 招待リンク・メンバー一覧・キック |
| `/api/invite/[token]`, `/api/invite/[token]/join` | 招待参加 |
| `/api/assets`, `/api/assets/[id]` | アセット一覧・アップロード・配信・変換 |
| `/api/ogp` | OGP プレビュー取得 |

### 2.3 ボード編集（CompoundBoard）

- **compound**: ホワイトボード本体（@cmpd/compound）
- **useYjsStore**: Yjs + y-websocket で TLStore と Y.Doc を双方向同期
- **SmartHandTool**: 選択ツールを万能ハンドに変更（パン・ブラシ選択）
- **ConnectHandles / ShapeConnectHandles**: draw.io 風の接続ハンドル
- **CollaboratorCursor / AwarenessSync**: 他ユーザーのカーソル表示
- **UserSharePanel**: 接続中のユーザー一覧
- **BoardReactionProvider**: シェイプへのリアクション
- **useFileDropHandler**: ファイルドロップ → アップロード → シェイプ配置
- **useArrowCascadeDelete**: シェイプ削除時のアロー連鎖削除
- **useUrlPreviewAttacher**: URL からの OGP プレビュー付与
- **useSnapshotSave**: スナップショット永続化

---

## 3. データ層

### 3.1 PostgreSQL（Prisma）

- User（NextAuth は JWT 戦略のため Account/Session なし）
- Workspace, WorkspaceMember, Board, Asset, S3UploadSession, AuditLog

### 3.2 Y.Doc（Yjs）

| キー | 内容 |
|------|------|
| `yMap["tldraw"]` | シェイプ・ページ・アセット等 |
| `yMap["reactions"]` | シェイプへのリアクション |
| `yMap["comments"]` | メディアタイムラインコメント |
| **Awareness** | カーソル・user・currentPageId（永続化しない） |

永続化: IndexedDB（y-indexeddb）+ Board.snapshotData

### 3.3 ファイルストレージ

- **ローカル**: `uploads/assets/`, `uploads/converted/`, `uploads/thumbnails/`, `uploads/waveforms/`
- **S3/MinIO**: バケット内に同様のパス構造

---

## 4. カスタムシェイプ

| 型 | 用途 | 主な処理 |
|------|------|----------|
| `video-player` | 動画再生 | 720p 変換・サムネイル・コメント |
| `audio-player` | 音声再生 | mp3 変換・波形・コメント |
| `text-file` | テキストプレビュー | 最大 10,240 バイト |
| `file-icon` | 汎用ファイルアイコン | フォールバック |
| WrappedImage, Note, Geo, Text, Arrow | compound ネイティブ + CreatorLabel 等 | - |

---

## 5. インフラ（Docker Compose）

| サービス | ポート | 用途 |
|----------|--------|------|
| postgres | 5433→5432 | PostgreSQL 16 |
| sync-server | 5858 | y-websocket-server |
| minio | 9000, 9001 | S3 互換ストレージ |
| minio-init | - | バケット自動作成 |

nextjs-web は compose 外。`npm run dev` でポート 3000 で起動。
