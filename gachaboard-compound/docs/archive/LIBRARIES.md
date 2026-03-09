# 使用ライブラリ一覧

本プロジェクトで使用しているライブラリをまとめたドキュメント。

---

## nextjs-web（メインアプリ）

### フレームワーク・コア

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| next | 16.1.6 | React フレームワーク |
| react | ^18.2.0 | UI ライブラリ |
| react-dom | ^18.2.0 | React DOM レンダラ |

### 認証

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| next-auth | ^4.24.13 | 認証（Discord OAuth 等） |
| @auth/prisma-adapter | ^2.11.1 | NextAuth の Prisma アダプタ |

### データベース・ORM

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| prisma | 7.4.1 | ORM・マイグレーション |
| @prisma/client | 7.4.1 | Prisma クライアント |
| @prisma/adapter-pg | ^7.4.1 | Prisma PostgreSQL アダプタ |
| pg | ^8.13.3 | PostgreSQL ドライバ |

### ストレージ（AWS S3）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| @aws-sdk/client-s3 | ^3.1000.0 | S3 クライアント |
| @aws-sdk/s3-request-presigner | ^3.1000.0 | 署名付き URL 生成 |

### リアルタイム同期（Yjs）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| yjs | ^13.6.0 | CRDT ベースのリアルタイム同期 |
| y-websocket | ^2.1.0 | WebSocket プロバイダ |
| y-indexeddb | ^9.0.12 | IndexedDB 永続化 |
| idb | ^8.0.3 | IndexedDB ラッパー |

### エディタ（Tldraw Compound）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| @cmpd/assets | ^2.0.0-alpha.21 | アセット関連 |
| @cmpd/compound | ^2.0.0-alpha.21 | Compound エディタ |
| @cmpd/editor | ^2.0.0-alpha.21 | エディタコア |
| @cmpd/state | ^2.0.0-alpha.21 | 状態管理 |
| @cmpd/store | ^2.0.0-alpha.21 | ストア |
| @cmpd/tlschema | ^2.0.0-alpha.21 | スキーマ |
| @cmpd/utils | ^2.0.0-alpha.21 | ユーティリティ |
| @cmpd/validate | ^2.0.0-alpha.21 | バリデーション |

### UI・スタイリング

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| tailwindcss | ^4 | CSS フレームワーク |
| @tailwindcss/postcss | ^4 | PostCSS プラグイン |
| sonner | ^2.0.7 | トースト通知 |
| @twemoji/api | ^17.0.2 | 絵文字表示 |
| minidenticons | ^4.2.1 | アバターアイコン生成 |
| color-hash | ^2.0.2 | 色ハッシュ |
| @use-gesture/react | ^10.3.1 | ジェスチャー操作 |

### ユーティリティ

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| zod | ^4.3.6 | スキーマ・バリデーション |
| date-fns | ^4.1.0 | 日付操作 |
| lodash.debounce | ^4.0.8 | デバウンス |
| raf-throttle | ^2.0.6 | RAF スロットル |
| p-limit | ^7.3.0 | 並列実行制限 |
| p-retry | ^7.1.1 | リトライ |
| pretty-bytes | ^7.1.0 | バイト数フォーマット |
| usehooks-ts | ^3.1.1 | React フック集 |
| @t3-oss/env-nextjs | ^0.13.10 | 環境変数バリデーション |

### メディア・OGP

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| cheerio | ^1.2.0 | HTML パース（OGP 取得） |
| fluent-ffmpeg | ^2.1.3 | 動画・音声処理 |
| get-youtube-id | ^1.0.1 | YouTube ID 抽出 |

### その他

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| emoji-regex | ^9.2.2 | 絵文字正規表現 |
| linkify-it | ^5.0.0 | URL リンク検出 |
| browser-fs-access | ^0.38.0 | ファイルアクセス API |
| react-intersection-observer | ^10.0.3 | ビューポート検知 |

---

## sync-server（Yjs WebSocket サーバ）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| yjs | ^13.6.0 | CRDT コア |
| y-websocket | ^2.1.0 | WebSocket サーバ実装 |

---

## 開発用（devDependencies）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| typescript | 5.9.3 | 型チェック |
| eslint | ^9 | リンター |
| eslint-config-next | 16.1.6 | Next.js ESLint 設定 |
| @playwright/test | ^1.58.2 | E2E テスト |
| puppeteer | ^24.38.0 | ヘッドレスブラウザ |
| concurrently | ^9.1.2 | 並列コマンド実行 |
| patch-package | ^8.0.1 | パッチ適用 |
| @types/* | 各種 | 型定義 |

---

## 依存関係図（概要）

```
nextjs-web
├── Next.js + React
├── Prisma + PostgreSQL
├── NextAuth（Discord）
├── AWS S3
├── Yjs（y-websocket, y-indexeddb）
├── @cmpd/*（Tldraw Compound）
└── 各種 UI・ユーティリティ

sync-server
├── yjs
└── y-websocket（サーバ）
```
