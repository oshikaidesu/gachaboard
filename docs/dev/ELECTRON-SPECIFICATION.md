# Electron デスクトップアプリ仕様書

Gachaboard を Electron でラップし、**ライトな層でもワンクリックで起動できる**デスクトップアプリの仕様を定義する。

> **現行ランチャー（`launcher/`）** は **`http://localhost:18580`** を既定とする。本文中のポート表・シーケンスはリポジトリの **`PORT` / `SYNC_SERVER_HOST_PORT`（18580 / 18582 番台）** に揃えてある。

---

## 1. 目的・背景

### 1.1 目的

- **ワンクリック起動**: アプリを起動するだけで、Docker や手動セットアップなしに Gachaboard が使える
- **ターゲット**: 技術的な前提知識が少ないユーザー（ライトな層）が気軽に試せる形にする
- **デスクトップ体験**: ブラウザではなくネイティブアプリとしての起動・利用体験を提供する

### 1.2 現状の課題

| 課題 | 現状 |
|------|------|
| セットアップ | Docker Compose + PostgreSQL + MinIO + sync-server の起動が必要 |
| 環境変数 | `.env.local` の作成・設定（Discord OAuth 含む） |
| 起動手順 | `scripts/start/production.sh` 実行 or 複数コマンドの実行 |

### 1.3 スコープ

**含む:**
- Electron アプリとしての起動・終了
- 同梱バックエンド（DB・ストレージ・sync-server）の自動起動
- 既存 Next.js アプリのウィンドウ表示
- macOS / Windows / Linux 向けパッケージング

**含まない（将来的に検討）:**
- ローカル認証モード（Discord なしで利用）
- オフライン完全稼働
- アプリ内での環境変数編集 UI

---

## 2. アーキテクチャ

### 2.1 全体図

```
┌──────────────────────────────────────────────────────────────────────┐
│  Electron アプリ                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Main Process                                                    │  │
│  │  - 起動順序制御（sync-server → Next.js）                          │  │
│  │  - userData ディレクトリ初期化                                    │  │
│  │  - 環境変数注入                                                   │  │
│  │  - 子プロセスのライフサイクル管理                                  │  │
│  └──────────┬─────────────────────────────────────────────────────┘  │
│             │ spawn                                                    │
│  ┌──────────▼──────────┐  ┌──────────────────────────┐               │
│  │  sync-server        │  │  Next.js (next start)     │               │
│  │  :18582 (Yjs WS)    │  │  :18580 (既定 PORT)      │               │
│  └─────────────────────┘  └───────────┬──────────────┘               │
│                                       │                               │
│  ┌────────────────────────────────────▼───────────────────────────┐  │
│  │  userData/data/                                                 │  │
│  │  ├── gachaboard.db     # SQLite                                 │  │
│  │  └── storage/          # ローカルファイル                         │  │
│  │      ├── assets/                                                │  │
│  │      ├── converted/                                             │  │
│  │      ├── thumbnails/                                            │  │
│  │      └── waveforms/                                             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Renderer (BrowserWindow)                                       │  │
│  │  loadURL(http://localhost:18580)                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 起動シーケンス

```
Main 起動
    │
    ├─→ app.getPath('userData') 取得
    ├─→ data/, data/storage/* ディレクトリ作成
    │
    ├─→ [1] sync-server 子プロセス起動 (例: PORT=18582)
    │       └─→ 待機: WebSocket 応答確認
    │
    ├─→ [2] 環境変数セット (DATABASE_URL, STORAGE_*, NEXT_PUBLIC_SYNC_WS_URL 等)
    │
    ├─→ [3] next start 子プロセス起動
    │       └─→ 待機: http://localhost:18580 応答確認 (wait-on 等)
    │
    └─→ [4] BrowserWindow 作成・loadURL(localhost:18580)
```

### 2.3 終了シーケンス

```
ウィンドウ閉じる / アプリ終了
    │
    └─→ 子プロセス kill (Next.js → sync-server の順)
        └─→ app.quit()
```

---

## 3. バックエンド同梱方針

### 3.1 データベース: PostgreSQL → SQLite

| 項目 | 内容 |
|------|------|
| 理由 | PostgreSQL バイナリ同梱は重く複雑。SQLite は単一ファイルで同梱不要 |
| 方式 | Electron モード時のみ SQLite、既存の Docker/本番は PostgreSQL のまま |
| スキーマ | `prisma/schema.electron.prisma` を別途用意（provider: sqlite） |
| パス | `{userData}/data/gachaboard.db` |
| 互換性 | Prisma 6.2+ で SQLite の Json サポート。BigInt は Int 相当で格納 |

**スキーマ差分（SQLite 化で注意）:**
- `provider = "sqlite"`
- `BigInt` → そのまま（Prisma が INTEGER にマッピング）
- `Json` → そのまま利用可能
- 既存の PostgreSQL 専用機能があれば個別対応

### 3.2 ストレージ: S3/MinIO → ローカルファイル

| 項目 | 内容 |
|------|------|
| 理由 | MinIO バイナリ同梱も可能だが、ローカル fs の方が軽量・シンプル |
| 方式 | `STORAGE_BACKEND=local` で `src/lib/storage/local.ts` を利用 |
| パス | `{userData}/data/storage/` 配下に S3 キー構造をマッピング |
| S3 キー例 | `assets/{storageKey}` → `storage/assets/{storageKey}` |

**必要な API（既存 s3.ts と同等）:**

| 既存 S3 関数 | ローカル実装 |
|-------------|-------------|
| `putObject` | `fs.writeFile` |
| `getObjectStream` | `fs.createReadStream` |
| `deleteS3Object` | `fs.unlink` |
| `headS3Object` | `fs.stat` |
| `getPresignedGetUrl` | `/api/assets/[id]/file` 等の直リンク URL を返す |
| `createMultipartUpload` / `completeMultipartUpload` | 簡易化: 単一アップロード相当にフォールバック |

### 3.3 sync-server: 子プロセス起動

| 項目 | 内容 |
|------|------|
| 場所 | `nextjs-web/sync-server`（既存） |
| 起動 | `child_process.spawn` で `node` または `npx y-websocket-server` |
| ポート | 既定 **18582**（`SYNC_SERVER_HOST_PORT`。他と衝突時は `.env.local` で変更） |
| パッケージ時 | asarUnpack で sync-server を asar 外に配置し、node_modules を参照可能にする |

---

## 4. 環境変数

### 4.1 Electron 起動時に Main が設定する変数

| 変数 | 値（例） |
|------|----------|
| `DATABASE_URL` | `file:{userData}/data/gachaboard.db` |
| `DATABASE_PROVIDER` | `sqlite` |
| `STORAGE_BACKEND` | `local` |
| `STORAGE_LOCAL_PATH` | `{userData}/data/storage` |
| `NEXT_PUBLIC_SYNC_WS_URL` | `ws://localhost:18582`（ポートは `.env.local` と一致） |
| `NEXTAUTH_URL` | `http://localhost:18580`（`PORT` と一致） |
| `NODE_ENV` | `production` |

### 4.2 ユーザーが設定する変数（引き続き必要）

| 変数 | 用途 |
|------|------|
| `DISCORD_CLIENT_ID` | Discord OAuth |
| `DISCORD_CLIENT_SECRET` | Discord OAuth |
| `NEXTAUTH_SECRET` | セッション暗号化 |
| `SERVER_OWNER_DISCORD_ID` | オプション（オーナー制限） |

**初回セットアップ**: `.env.local` を `userData` 配下に作成するか、セットアップウィザードで入力させることを検討。現状は従来通りユーザーが手動作成する前提でも可。

---

## 5. ディレクトリ構成

```
（プロジェクトルート）
├── electron/
│   ├── main.ts           # メインプロセス（起動・子プロセス管理）
│   ├── preload.ts        # 必要に応じて（現状は minimal）
│   ├── package.json      # electron, electron-builder, wait-on
│   └── tsconfig.json
│
├── nextjs-web/
│   ├── prisma/
│   │   ├── schema.prisma          # 既存（PostgreSQL）
│   │   └── schema.electron.prisma # 新規（SQLite）
│   │
│   └── src/lib/
│       ├── env.ts                 # STORAGE_BACKEND, DATABASE_PROVIDER 等を追加
│       ├── db/
│       │   └── db.ts              # provider 分岐
│       └── storage/
│           ├── s3.ts              # 既存
│           ├── local.ts           # 新規（ローカルファイル実装）
│           └── storage.ts         # S3 / local 分岐
```

---

## 6. 変更対象ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `electron/main.ts` | 新規。起動シーケンス、子プロセス管理 |
| `electron/preload.ts` | 新規（必要最小限） |
| `electron/package.json` | 新規 |
| `nextjs-web/src/lib/env.ts` | `STORAGE_BACKEND`, `STORAGE_LOCAL_PATH`, `DATABASE_PROVIDER` 追加 |
| `nextjs-web/src/lib/db/db.ts` | SQLite / PostgreSQL アダプター分岐 |
| `nextjs-web/src/lib/storage/local.ts` | 新規 |
| `nextjs-web/src/lib/storage/storage.ts` | S3 / local 分岐 |
| `nextjs-web/src/lib/s3.ts` | `isS3Enabled()` を STORAGE_BACKEND で拡張 or storage 層で吸収 |
| `nextjs-web/prisma/schema.electron.prisma` | 新規（SQLite 用スキーマ） |
| `/api/assets/[id]/file`, `thumbnail` 等 | ローカル時は Presigned ではなくストリーム直接返却 |
| `s3Upload` 関連 API | ローカル時は multipart を簡易アップロードにフォールバック |

---

## 7. 実装フェーズ

### Phase 1: Electron ラッパーのみ（既存インフラ前提）

- Electron main で `next start` を起動し、`http://localhost:18580` を BrowserWindow で表示（`PORT` に合わせる）
- PostgreSQL, MinIO, sync-server は従来どおり Docker / 手動起動
- **効果**: 既存コードへの影響なし。Electron 基盤を先行構築できる

### Phase 2: sync-server 同梱

- Main から sync-server を子プロセス起動
- Docker で sync-server を起動する必要がなくなる

### Phase 3: SQLite + ローカルストレージ

- DB とストレージを SQLite + ローカル fs に切り替え
- 真のワンクリック起動を実現

### Phase 4（将来）: ビルド・パッケージ

- electron-builder で dmg / exe / AppImage を生成
- インストーラー・自動更新の検討

---

## 8. 制限・検討事項

| 項目 | 内容 |
|------|------|
| **Discord OAuth** | 初回利用時に Discord Developer Portal でアプリ作成が必要。完全オフライン利用には「ローカル認証モード」の追加が必要 |
| **ffmpeg** | 動画変換・波形生成に使用。ユーザーが別途インストールするか、Electron に同梱するか検討 |
| **パッケージサイズ** | Electron + Next.js + Node でおよそ 150〜200MB 程度を想定 |
| **マルチインスタンス** | 同一マシンで複数起動する場合、ポート競合（`PORT` / sync / DB 等）に注意。1 インスタンス想定で設計 |
| **開発モード** | `npm run dev` で Next.js を起動し、Electron は `ELECTRON_START_URL=http://localhost:18580`（または使用中の `PORT`）で接続する構成を検討 |

---

## 9. 参考

- [ARCHITECTURE.md](ARCHITECTURE.md): 既存システム構成
- [database-and-storage-inventory.md](database-and-storage-inventory.md): DB・ストレージ仕様
- [Electron + Next.js without Nextron](https://prishusoft.com/blog/electron-nextjs-without-nextron)

---

[← 開発ドキュメント TOP](README.md)
