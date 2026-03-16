# Yjs 仕様とシステムコンセプト（数値ベース）

> **作成日**: 2026-03-07  
> **対象**: Gachaboard  
> **想定規模**: 最大 30 人同時接続 / 1000 シェイプ

---

## 0. プロジェクト・システムコンセプト

### 0.1 プロジェクトコンセプト

| 項目 | 内容 |
|------|------|
| **何を作っているか** | 音楽・映像・デザインファイルを**貼り付けて共有**できるリアルタイム共同ホワイトボード |
| **誰向け** | Discord コミュニティ内の身内。URL を知っていれば参加可能 |
| **運用方針** | ローカルサーバー 1 台で完結。クラウド依存を最小化 |
| **ワークスペース** | 3〜4 個のプロジェクト単位でボードを管理 |
| **ライセンス** | Apache 2.0（compound / tldraw ベース） |

### 0.2 データの流れと P2P / ミニマム構成

```
[メンバーA ブラウザ]                    [ホスト 1 台]
       │                                      │
       ├──Tailscale P2P──┐                    │
       │  (WireGuard)    │                    ├── nextjs-web :3000
[メンバーB ブラウザ]     │                    ├── sync-server :5858
       │                 └──────────────────►├── postgres :5432
       │                                      └── MinIO (S3互換) :9000
       │
       └── WebSocket ──────────────────────► Y.Doc / Awareness 同期
```

| レイヤー | 技術 | コンセプト |
|----------|------|------------|
| **ネットワーク** | Tailscale | 端末間 P2P 暗号化トンネル。グローバル IP・ポート開放不要。最大 100 台（無料） |
| **ドキュメント同期** | Yjs + y-websocket | CRDT でオフライン編集もマージ可能。sync-server は Hocuspocus + SQLite（YPERSISTENCE）で永続化 |
| **ファイル保存** | S3 / **MinIO** | S3 互換必須。MinIO で自前サーバー内に完結可能 |
| **公開** | Tailscale / Cloudflare Tunnel | 身内向けは Tailscale で P2P。外部公開時は Tunnel で HTTPS |

### 0.3 設計思想（数値）

| 思想 | 数値・方針 |
|------|------------|
| **同時接続** | 最大 30 人。y-websocket-server 単体で十分。100 人超は別構成 |
| **ボード規模** | 約 1000 シェイプ。ローカルサーバー・1TB ストレージ想定 |
| **依存の最小化** | メタデータは PostgreSQL、ファイルは S3/MinIO。クラウド必須の SaaS にしない |
| **認証** | Discord OAuth 必須。匿名排除で身内運用 |

---

## 1. システムスケール（数値サマリー）

| 項目 | 数値 | 備考 |
|------|------|------|
| **最大同時接続** | **30 人** | 設計目標。y-websocket-server 単体で想定 |
| **1 ボードあたりシェイプ数** | **約 1000** | パフォーマンス検証の目安 |
| **カーソル更新頻度** | **60 fps** | RAF スロットルで制御 |
| **ドキュメント同期** | **1 フレームに 1 回** | Store → Y.Doc の書き込み |
| **Awareness オフライン判定** | **30 秒** | y-protocols 標準。更新なしで離脱扱い |
| **WebSocket 接続遅延** | **50 ms** | Strict Mode 対策。`connect: false` 後に接続 |

---

## 2. Yjs 技術スタック

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| **yjs** | ^13.6.0 | CRDT エンジン。Y.Doc / Y.Map の操作 |
| **y-websocket** | ^2.1.0 | WebsocketProvider。Y.Doc と Awareness の送受信 |
| **y-protocols** | (y-websocket 同梱) | Awareness CRDT。マルチカーソル |
| **y-websocket-server** | - | sync-server。メモリ内でルーム管理 |

---

## 3. データ構造と同期方式

### 3.1 Y.Doc 内構成

| キー/種別 | 用途 | 永続化 | 同期先 |
|----------|------|--------|--------|
| `yMap["tldraw"]` | シェイプ・ページ・アセット等 | サーバーメモリ | 全クライアント |
| `yMap["reactions"]` | リアクション | サーバーメモリ | 全クライアント |
| **Awareness** | カーソル・user・currentPageId | **永続化しない** | 接続中のクライアントのみ |
| カメラ・instance_page_state | scope: "session" | localStorage | ローカルのみ |

### 3.2 per-record 形式

- **キー**: `recordId`（TLRecord の id）
- **値**: `JSON.stringify(record)`
- **差分**: Yjs が Y.Update として差分のみ送信

---

## 4. 数値ベースのスロットル・間隔

| 対象 | 現在値 | 単位 | 備考 |
|------|--------|------|------|
| Store → Y.Doc 書き込み | 1 回/フレーム | ~16 ms (60 fps) | `store.listen` + RAF |
| Y.Doc → Store 適用 | 1 回/フレーム | ~16 ms | `yMap.observe` + RAF |
| カーソル Awareness 送信 | 1 回/フレーム | ~16 ms | `updateLocalCursor` + RAF |
| リアクションポーリング（Yjs 接続時） | 2000 | ms | `POLLING_INTERVAL_REACTIONS_SYNC` |
| リアクションポーリング（未接続） | 15000 | ms | `POLLING_INTERVAL_REACTIONS` |
| カメラ保存 localStorage | 500 | ms | 変更後 debounce |

---

## 5. 30 人規模の負荷推定

### 5.1 現状（最悪ケース）

| イベント | 頻度 | 数値根拠 |
|----------|------|----------|
| ドラッグ中の Y.Update | ~60 回/秒/人 | 毎フレーム `store.put` |
| 30 人同時ドラッグ時の Y.Update | ~1,800 回/秒 | 60 × 30 |
| Awareness `syncRemoteToStore` | 最大 1,800 回/秒 | 30 人カーソル × 60 fps |
| useUrlPreviewAttacher 発火 | 最大 1,800 回/秒 | scope: "session" で全変更 |
| リロード時の初期ロード | Y.Doc 全体 | 1000 シェイプを全件再受信 |
| 30 人同時リロード | 30 並列フル送信 | サーバー負荷集中 |
| Y.Doc サイズ（1 時間利用） | 数十 MB | ドラッグ履歴が蓄積 |

### 5.2 最適化後の目標

| イベント | 目標値 |
|----------|--------|
| ドラッグ中の Y.Update | 0 回/秒（Awareness のみ） |
| `syncRemoteToStore` | 最大 60 回/秒（RAF） |
| リロード | IndexedDB から即時復元 |
| Y.Doc サイズ（1000 シェイプ、30 人、1 時間） | 約 1 MB |

---

## 6. Awareness フィールド（数値）

| フィールド | 型 | 用途 |
|-----------|-----|------|
| `user` | `{ id, name, color }` | 接続ユーザー識別 |
| `cursor` | `{ x, y, type, rotation }` | ページ座標でのカーソル |
| `currentPageId` | string | 表示中ページ ID |
| `dragging` | `{ shapeId, x, y }` | （将来）ドラッグ中一時座標 |
| ユーザー色パレット | 12 色 | `USER_COLORS` |

---

## 7. sync-server の数値

| 項目 | 値 |
|------|-----|
| 永続化 | なし（メモリのみ） |
| 再起動時 | Y.Doc 消失。クライアント再送で復旧 |
| デフォルトポート | 5858（nextjs-web） / 5860（E2E） |
| 想定同時接続/ルーム | 30 人 |

---

## 8. スケールアウトの目安

| 規模 | 推奨構成 |
|------|----------|
| **〜30 人** | y-websocket-server 単体。現状のまま |
| **30〜100 人** | y-indexeddb + ドラッグ Awareness 分離。Hocuspocus 検討 |
| **100 人超** | Hocuspocus / Y-Sweet / y-octo 等、サーバー永続化・スケール対応 |

---

## 9. 使用技術一覧

### 9.1 フロントエンド / アプリ基盤

| 用途 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | Next.js | 16.1.6 |
| UI | React | ^18.2.0 |
| 言語 | TypeScript | 5.9.3 |
| スタイリング | Tailwind CSS | ^4 |
| トースト | sonner | ^2.0.7 |

### 9.2 ホワイトボード・編集

| 用途 | 技術 | バージョン |
|------|------|-----------|
| ホワイトボード | @cmpd/compound, @cmpd/editor | ^2.0.0-alpha.21 |
| 状態管理 | @cmpd/store, @cmpd/state | ^2.0.0-alpha.21 |
| スキーマ | @cmpd/tlschema | ^2.0.0-alpha.21 |
| アセット | @cmpd/assets | ^2.0.0-alpha.21 |
| 絵文字表示 | @twemoji/api | ^17.0.2 |

### 9.3 リアルタイム同期（Yjs 系）

| 用途 | 技術 | バージョン |
|------|------|-----------|
| CRDT エンジン | yjs | ^13.6.0 |
| WebSocket プロバイダ | y-websocket | ^2.1.0 |
| 同期サーバー | y-websocket-server | (y-websocket 同梱) |

### 9.4 認証・データベース

| 用途 | 技術 | バージョン |
|------|------|-----------|
| 認証 | NextAuth (Auth.js) | ^4.24.13 |
| 認証アダプタ | @auth/prisma-adapter | ^2.11.1 |
| ORM | Prisma | 7.4.1 |
| データベース | PostgreSQL (pg) | ^8.13.3 |
| DB アダプタ | @prisma/adapter-pg | ^7.4.1 |

### 9.5 ストレージ・メディア

| 用途 | 技術 | バージョン |
|------|------|-----------|
| オブジェクトストレージ | AWS S3 (@aws-sdk/client-s3) | ^3.1000.0 |
| S3 互換（ローカル/小規模） | MinIO | Docker image |
| 署名付き URL | @aws-sdk/s3-request-presigner | ^3.1000.0 |
| メディア変換 | fluent-ffmpeg | ^2.1.3 |

### 9.6 その他 API ・ユーティリティ

| 用途 | 技術 | バージョン |
|------|------|-----------|
| OGP パース | cheerio | ^1.2.0 |

### 9.7 開発・テスト

| 用途 | 技術 | バージョン |
|------|------|-----------|
| E2E テスト | Playwright | ^1.58.2 |
| Lint | ESLint | ^9 |
| パッチ適用 | patch-package | ^8.0.1 |
| 並列実行 | concurrently | ^9.1.2 |

### 9.8 技術選定理由と不安点

| 技術 | 選定理由 | 不安点 |
|------|----------|--------|
| **Next.js** | App Router で RSC 活用。API Routes とフロントを同一プロジェクトで管理。Vercel 以外にも Self-hosted 可能 | 16 系は比較的新しく、破壊的変更の影響範囲は要確認 |
| **compound** | tldraw の Apache 2.0 フォーク。共同編集・カスタムシェイプ対応。OSS で改修しやすい | alpha 版のため API 変更の可能性。tldraw 本家との乖離が今後増えるリスク |
| **yjs** | CRDT でオフライン編集もマージ可能。競合解決が自動。y-websocket と相性が良い | ドラッグ中の全軌跡が CRDT に蓄積し Y.Doc 肥大化。per-record でも JSON オーバーヘッドあり |
| **Hocuspocus + SQLite** | sync-server は Hocuspocus で SQLite 永続化。Awareness 対応。30 人規模なら十分 | 再起動時は SQLite から復元。同時接続数・ボード数増加時のメモリ・ディスク要監視。100 人超は別構成を検討 |
| **NextAuth** | Discord OAuth をそのまま利用。身内運用で追加 ID 連携が不要 | Discord 依存。プロバイダ障害時にログイン不可 |
| **PostgreSQL + Prisma** | リレーション・制約を活かしたスキーマ。型安全な ORM。マイグレーション管理 | 現状 `prisma db push` 運用。本番では migrate 運用への移行検討 |
| **S3 / MinIO** | MinIO で自前サーバー内に完結可能。S3 互換で AWS / R2 に切替え容易。Presigned URL で直接アップロード | MinIO は単一障害点。バックアップ・冗長化は別途検討 |
| **fluent-ffmpeg** | 業界標準 ffmpeg の Node ラッパー。wav→mp3、動画 720p、波形 JSON を網羅 | ffmpeg バイナリ必須。大容量ファイルで同期変換タイムアウト（2 分）のリスク。ジョブ化は未対応 |
| **Tailscale** | P2P 暗号化トンネル。グローバル IP・ポート開放不要。無料 100 台 | ホスト PC 停止でサービス停止。スリープ無効化・UPS 検討が必要 |
| **cheerio** | 軽量 HTML パース。OGP 取得にフルブラウザ不要 | 動的 JS レンダリングのサイトには対応不可。一部サイトで OGP 取得失敗 |
| **Twemoji** | Twitter 系絵文字で一貫表示。CDN または自前ホスト可 | 外部 CDN 依存の場合は可用性に影響。自前ホストなら OK |
| **Playwright** | モダンな E2E。複数ブラウザ対応。CI 組み込み容易 | 認証バイパス（E2E_TEST_MODE）が本番で有効になるリスクに注意 |
| **y-indexeddb** | （導入済み）リロード時の即時復元、オフライン編集対応。useYjsStore で IndexeddbPersistence を利用 | Mobile Safari で fetch 失敗の報告あり（2025 年）。検証推奨 |

**見送り技術と理由**:

| 技術 | 見送り理由 |
|------|------------|
| SyncedStore | @cmpd/store が同等役割。最終更新 2 年前でメンテ停止 |
| Hocuspocus | 30 人なら y-websocket-server で十分。移行コストに見合わない |
| Y-Sweet / y-octo | 100 人超で検討。現規模では不要 |
| Zustand | 30 人規模では Context で許容。将来の選択肢として留保 |

**システム全体の不安点**:

- ディスク容量枯渇 → 定期的な不要ファイル削除・容量監視が未整備（24時間運用時は [24-7-OPERATION.md](../user/24-7-OPERATION.md) 参照）
- sync-server の SQLite / メモリ増加 → ボード数・同時接続が多い場合は監視を推奨
- WAV→MP3 等の変換が同期処理のため、大容量ファイルでタイムアウト・ジョブ化の検討余地
- E2E_TEST_MODE が本番環境で有効になる設定ミスのリスク

---

## 10. カスタムシェイプ

| 型名 | 用途 | 優先度 | MIME マッチ |
|------|------|--------|-------------|
| `video-player` | 動画再生（720p 変換・サムネ・タイムラインコメント） | 40 | video/mp4 |
| `audio-player` | 音声再生（波形表示・mp3 変換・タイムラインコメント） | 30 | mp3, wav, ogg, m4a, flac, webm 等 |
| `text-file` | テキストプレビュー（最大 10,240 バイト） | 20 | txt, md, json, yaml, py, js 等 |
| `file-icon` | 汎用ファイルアイコン（フォールバック） | 0 | すべて |

tldraw 組み込み型: image, note, geo, text, arrow, draw, highlight, line, frame, bookmark, embed, group

---

## 11. データモデル（Prisma）

| モデル | 主なフィールド | 用途 |
|--------|----------------|------|
| **User** | discordId, discordName, avatarUrl | Discord OAuth ユーザー |
| **Workspace** | ownerUserId, name, description, deletedAt | プロジェクト単位（3〜4 個想定） |
| **Board** | workspaceId, name, snapshotData, deletedAt | ボード（ソフト削除対応） |
| **Asset** | boardId, uploaderId, kind, mimeType, storageKey, storageBackend, lastKnownX/Y | アップロードファイル（storageBackend は `"s3"` のみ） |
| **S3UploadSession** | uploadId, s3Key, storageKey, boardId, uploaderId | S3 マルチパートアップロード |

**Y.Doc に統合**（DB テーブルなし）:
| yMap キー | 内容 |
|-----------|------|
| `reactions` | シェイプへの絵文字リアクション |
| `comments` | メディアのタイムスタンプ付きコメント |
| **AuditLog** | userId, workspaceId, action, target, metadata | 監査ログ |

---

## 12. ファイル変換パイプライン（数値）

| 処理 | 入力条件 | 出力 | 数値 |
|------|----------|------|------|
| WAV → MP3 | audio/wav | libmp3lame MP3 | **192 kbps** |
| 動画 → 軽量版 | video/* | H.264 + AAC mp4 | **720p, CRF 28, faststart** |
| サムネイル | 動画 | JPEG | 中間フレーム（ffprobe で尺取得） |
| 波形 | 再生可能音声 | peaks JSON | **200 バー**, 8kHz モノラル PCM |

| 制約 | 値 |
|------|-----|
| 変換タイムアウト | **2 分** |
| S3 マルチパート | **100 MB/パート** |
| テキストプレビュー上限 | **10,240 バイト** |
| OGP キャッシュ | **200 件**, TTL **1 時間** |

### ストレージディレクトリ

| ディレクトリ | 用途 |
|-------------|------|
| `uploads/assets/` | 元ファイル |
| `uploads/converted/` | 変換済み（mp3, 720p mp4） |
| `uploads/thumbnails/` | 動画サムネイル JPEG |
| `uploads/waveforms/` | 波形データ JSON |
| `uploads/chunks/` | チャンクアップロード一時ファイル |

---

## 13. コラボレーション機能

| 機能 | 概要 | 同期方式 |
|------|------|----------|
| **マルチカーソル** | Awareness で他ユーザーのカーソルをリアルタイム表示 | Awareness（60 fps） |
| **ユーザー一覧** | 接続中ユーザーをパネル表示 | Awareness |
| **シェイプリアクション** | 絵文字リアクション（Twemoji） | Y.Doc のみ |
| **タイムラインコメント** | メディアの再生位置に紐づくコメント | Y.Doc のみ |
| **OGP プレビュー** | geo シェイプ内 URL の OGP / YouTube iframe / X(Twitter) | REST API + キャッシュ |
| **コネクトハンドル** | シェイプ選択時にアロー接続用ハンドルを表示 | TLStore + DB |
| **アロー連鎖削除** | シェイプ削除時に接続アローを自動削除 | TLStore |
| **SmartHandTool** | 空白ドラッグでパン、brushMode でブラシ選択 | ローカル |
| **ボードゴミ箱** | trash / restore、オーナーのみ完全削除 | DB + sync-server room 削除 |

### ポーリング間隔

| 対象 | 間隔 |
|------|------|
| AssetLoader | **1,500 ms** |

（リアクション・コメントは Y.Doc でリアルタイム同期のためポーリング不要）

---

## 14. API ルート一覧

| パス | メソッド | 用途 |
|------|----------|------|
| `/api/auth/[...nextauth]` | * | NextAuth（Discord OAuth） |
| `/api/workspaces` | GET / POST | ワークスペース一覧・作成 |
| `/api/workspaces/[id]` | GET / PATCH / DELETE | ワークスペース詳細・更新・削除 |
| `/api/workspaces/[id]/boards` | GET / POST | ボード一覧・作成 |
| `/api/workspaces/[id]/boards/[boardId]` | PATCH / DELETE | ボード trash/restore・完全削除 |
| `/api/workspaces/[id]/invite` | GET / POST | 招待リンク発行・リセット |
| `/api/workspaces/[id]/members` | GET / DELETE | メンバー一覧・キック |
| `/api/invite/[token]` | GET | 招待トークン検証・WS 情報 |
| `/api/invite/[token]/join` | POST | メンバー参加 |
| `/api/assets` | GET / POST | アセット一覧・アップロード |
| `/api/assets/[id]` | GET / DELETE | アセット詳細・削除 |
| `/api/assets/[id]/file` | HEAD / GET | ファイル配信（converted=1, download=1） |
| `/api/assets/[id]/thumbnail` | GET | 動画サムネイル JPEG |
| `/api/assets/[id]/waveform` | GET | 波形 JSON（オンデマンド生成） |
| `/api/assets/upload/init` | POST | チャンクアップロード初期化 |
| `/api/assets/upload/[uploadId]/[chunk]` | PUT | チャンク送信 |
| `/api/assets/upload/[uploadId]/complete` | POST | チャンク結合・アセット登録 |
| `/api/assets/upload/s3/init` | POST | S3 マルチパート初期化 |
| `/api/assets/upload/s3/presign` | POST | Presigned PUT URL |
| `/api/assets/upload/s3/complete` | POST | S3 アップロード完了 |
| `/api/ogp` | GET | OGP 取得（URL パラメータ） |

（リアクション・コメントは Y.Doc に統合済み。API なし）

---

## 15. Docker Compose サービス

| サービス | イメージ | ポート（ホスト→コンテナ内） | 備考 |
|----------|----------|------------------------------|------|
| **postgres** | postgres:16 | 127.0.0.1:18581 → 5432 | ユーザー: gachaboard |
| **sync-server** | ビルド | 127.0.0.1:18582 → 5858 | y-websocket-server |
| **minio** | minio/minio:latest | 18583（API）, 18584（コンソール） | S3 互換ストレージ |
| **minio-init** | minio/mc | - | バケット `my-bucket` 自動作成 |

nextjs-web は compose に含まず、`npm run dev` で別途起動（デフォルト PORT=18580。コンテナ内のみの場合は 3000）。

---

## 16. 認証・セキュリティ

| 項目 | 内容 |
|------|------|
| プロバイダ | Discord OAuth（scope: identify） |
| セッション方式 | JWT（strategy: "jwt"） |
| ミドルウェア保護 | `/workspaces`, `/workspace`, `/board`, `/assets` |
| 認可 | `assertWorkspaceOwner`（オーナー確認）、`assertBoardAccess`（ログイン確認） |
| 監査ログ | `writeAuditLog`（workspace.create, board.trash, board.delete 等） |
| E2E バイパス | `E2E_TEST_MODE=1` + `testUserId` / `testUserName` クエリ |

---

## 17. E2E テスト構成

| 項目 | 値 |
|------|-----|
| フレームワーク | Playwright |
| テストタイムアウト | **60 秒**（expect **15 秒**） |
| ベース URL | `http://localhost:3010` |
| sync-server ポート | 5860（E2E 専用） |
| 起動コマンド | `npm run e2e:server`（sync + next を並列起動） |
| 認証バイパス | `E2E_TEST_MODE=1` |

---

## 18. 低スペックPCで困りそうな例（技術・ライブラリ）

> 低スペックPCやタブレット・古いPCで開くユーザーが困りそうな具体例。解決策は別途調査・検討。

### 18.1 ライブラリ（数値）

| ライブラリ | 数値 | 困りそうな例 |
|------------|------|--------------|
| **@twemoji/api** | 絵文字 1 枚あたり数 KB 〜 数十 KB | リアクション × シェイプ数。100 シェイプ × 平均 3 絵文字 = 300 リクエスト/画像 |
| **@cmpd/compound** | 1000 シェイプ × 60 fps | 毎フレーム 1000 オブジェクト描画。draw/highlight のパス頂点数に比例 |
| **yjs** | 数十 MB（1000 シェイプ、30 人、1 時間）、§5.1 | Y.Doc メモリ。リロードで 1000 件 × JSON パース |
| **y-websocket** | 1,800 回/秒（30 人 × 60 fps）、§5.1 | `syncRemoteToStore` 最大値。毎フレーム ~16 ms 内に処理 |
| **y-websocket** | 60 回/秒/人 | ドラッグ中の Y.Update。30 人同時で 1,800 回/秒 |
| **@cmpd/assets** | 720p、192 kbps mp3、§12 | 複数動画同時表示でデコード負荷。バッファ累積 |
| **Next.js** | 初期 JS バンドル | hydration までのブロック。RSC + クライアントの二重フェッチ |

### 18.2 拡張・カスタム機能（数値）

| 機能 | 数値 | 困りそうな例 |
|------|------|--------------|
| **video-player** | 720p、CRF 28、§12 | 1 動画あたりフレームデコード。複数同時再生で乗算 |
| **audio-player** | 200 バー、8 kHz モノラル、§12 | 波形 1 本あたり 200 矩形描画。複数オーディオで累積 |
| **OGP / embed** | 1 iframe あたり 1〜数 MB | YouTube / X は外部スクリプト込み。1 ページに 5〜10 個で重い |
| **リアクション** | 1 シェイプ × N 絵文字 × M シェイプ | `parse()` が DOM 全走査。100 シェイプ × 3 絵文字 = 300 ノード差し替え |
| **useUrlPreviewAttacher** | 1,800 回/秒、§5.1 | scope: "session" で全 Store 変更に反応 |
| **マルチカーソル** | 30 人 × 60 fps = 1,800 回/秒 | カーソル DOM/Canvas 更新。`user` + `cursor` + `currentPageId` |
| **text-file** | 10,240 バイト、§12 | 上限いっぱいだと 10 KB のパース・DOM 生成 |
| **ポーリング** | 2,000 ms / 15,000 ms、§13 | リアクション。1,500 ms（AssetLoader）。30,000 ms（コメント） |

### 18.3 データ・ネットワーク（数値）

| 要因 | 数値 | 困りそうな例 |
|------|------|--------------|
| **Y.Doc 初期同期** | 1000 シェイプ全件 | y-indexeddb 導入済みのため IndexedDB から即時復元。初回・新規ボード時のみサーバーから受信 |
| **Awareness** | 60 fps × 30 人 | 30 クライアント分の cursor 受信・適用。RAF 落ちるとキュー詰まり |
| **アセット取得** | 100 MB/パート、§12 | S3 マルチパート。複数アセット同時で並列リクエスト数・帯域 |

### 18.4 改善・代替ライブラリがありそうなもの

> GitHub 等に軽量版や代替がありそうなライブラリ。未調査。

| ライブラリ | 備考 |
|------------|------|
| @twemoji/api | 軽量絵文字、ネイティブ絵文字、subset 版など |
| compound / tldraw | 軽量 Canvas ホワイトボード、部分描画 |
| yjs | 軽量 CRDT、圧縮効率の良い実装 |
| Next.js | 軽量フレームワーク（Astro, Fresh 等） |
| cheerio | 軽量 HTML パース |
| fluent-ffmpeg | 軽量メディア変換、WASM 版 ffmpeg |
| sonner | 軽量トースト |

---

## 19. 関連ドキュメント

- [archive/lightweighting-phase-plan.md](../archive/lightweighting-phase-plan.md) - 軽量化フェーズ計画（実装順序・依存関係）
- [archive/yjs-improvement-selection.md](../archive/yjs-improvement-selection.md) - 改善ライブラリ・選定（Hocuspocus, Y-Sweet, y-indexeddb 等）
- [archive/performance-optimization-plan.md](../archive/performance-optimization-plan.md) - 負荷対策の詳細
- [archive/multi-cursor-implementation-guide.md](../archive/multi-cursor-implementation-guide.md) - Awareness 実装
- [archive/sync-improvement-implementation-guide.md](../archive/sync-improvement-implementation-guide.md) - 同期アーキテクチャ
