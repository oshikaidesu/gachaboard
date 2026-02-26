# Phase 0: クローン元ギャップ調査

## 目的

- クローン元（Cloudflare前提）で流用できる範囲と再実装範囲を確定する。

## 現行で提供されている機能（確認済み）

- マルチ編集同期（WebSocket + Durable Object）
  - `client/pages/Room.tsx` の `useSync` が `/api/connect/:roomId` に接続。
  - `worker/TldrawDurableObject.ts` の `TLSocketRoom` がセッション同期を処理。
- マウスカーソル/Presence系UI
  - `Room.tsx` の `Tldraw` コメント上で「cursors & presence menu」を前提としている。
  - 同期ストアを `Tldraw` に渡しているため、共同編集中のカーソル表示は既存機能として利用可能。
- URL共有でのルーム参加
  - ルームID付きURLで参加し、画面上でリンクコピー可能。
- 画像/動画アセットアップロード
  - `client/multiplayerAssetStore.tsx` から `/api/uploads/:uploadId` へ送信。
  - `worker/assetUploads.ts` で保存/取得/キャッシュを処理。
  - `worker/assetUploads.ts` は `image/*` と `video/*` を許可しており、`image/gif` は許可範囲に含まれる。
- URLプレビュー（OGP相当）
  - `client/getBookmarkPreview.tsx` が `/api/unfurl` を呼び、`title/image/description/favicon` を取得。

## 現行で不足している機能（再実装が必要）

- Discord認証（OAuth）とセッション統合。
- Discord Guild単位のプロジェクト分離と可視性制御。
- 他Guildへの直URLアクセス遮断（認可レイヤー）。
- 音声変換パイプライン（wav -> mp3）。
- アプリ内GUIでの資産削除オペレーション。
- 動画の簡易プレビュー仕様（サムネイル生成/表示ルール）。
- GIF運用ルール（容量制限、最適化方針、表示性能）。
- タイムラインコメント（音声波形/動画時刻へのコメント紐づけ）。
- オブジェクト単位のTwemojiリアクション（投稿/集計/重複制御）。
- draw.io風コネクタ体験（吸着アンカー、ルーティング、Auto-connect）。

## 主要確認項目

- 既存同期: `client/pages/Room.tsx` + `worker/worker.ts`
- 既存資産アップロード: `client/multiplayerAssetStore.tsx` + `worker/assetUploads.ts`
- OGP相当: `client/getBookmarkPreview.tsx` + `/api/unfurl` の有無
- 欠落機能: Discord認証、Guild分離、ロール管理、音声変換ジョブ

## 注意点（ドキュメント差分）

- `README.md` には `worker/bookmarkUnfurling.ts` や `client/App.tsx` の記述があるが、このクローンには存在しない。
- 実装時は README記載よりも、現在の実ファイル構成を正として判断する。

## 上流ドキュメント参照（今後の拡張用）

- クローン元テンプレート
  - `https://github.com/tldraw/tldraw-sync-cloudflare`
  - OGP連携の参照実装: `client/getBookmarkPreview.tsx`
- tldraw公式（同期全体）
  - `https://tldraw.dev/docs/sync`
  - バックエンド構成（WebSocket room / asset storage / unfurl service）の前提確認に使う。
- tldraw公式（サーバ側ルーム）
  - `https://tldraw.dev/reference/sync-core/TLSocketRoom`
  - マルチ編集・Presence挙動の責務確認に使う。
- tldraw公式（クライアント同期フック）
  - `https://tldraw.dev/reference/sync/useSync`
  - `useSync` の状態遷移や `assets` ハンドリング確認に使う。
- OGP unfurlライブラリ
  - `https://www.npmjs.com/package/cloudflare-workers-unfurl`
  - `/api/unfurl` の実装差し替えや拡張時の仕様確認に使う。
- コネクタ体験参考（draw.io）
  - `https://www.drawio.com/doc/faq/connectors-features`
  - `https://www.drawio.com/doc/faq/connect-to-shapes`
  - 接続点（固定/浮動）とルーティングの挙動確認に使う。

## OGP拡張時の調査メモ

- 優先確認
  - タイムアウト、リトライ、キャッシュTTL、サイズ上限。
  - 失敗時のフォールバック（タイトルなし/画像なし）表示仕様。
- セキュリティ観点
  - SSRF対策（内部IP・localhostブロック）。
  - 許可プロトコル制限（`http/https` のみ）。
- 運用観点
  - OGP取得ログ（対象URL・ステータス・失敗理由）を最低限残す。

## 成果物

- 流用可/要再実装の一覧表（機能単位）
- リスク一覧（技術負債・依存ライブラリ・Cloudflare依存差分）
- 次フェーズの入力仕様（Auth/DB/UI）

## DB運用クリティカル設計（最優先）

ここで転ぶと全フェーズに波及するため、Phase 0時点で先に固定する。

- データ分類
  - 構造化データ: `User/Guild/Project/Board/AssetMeta`（PostgreSQL）
  - 実ファイル: 画像・動画・音声・zip（オブジェクトストレージ）
  - 監査ログ: 削除/変換/認可拒否イベント（PostgreSQL）
- 境界ルール
  - `guildId` を全主要テーブルの検索境界にする。
  - 実ファイルは必ず `assetId` 経由で参照し、直パス参照を禁止する。
  - 削除は「DBメタ -> 実体削除 -> 監査ログ」の順で一貫実行する。
- 障害時原則
  - DB成功/実体失敗の片落ちを検出するため、削除ジョブに再試行フラグを持たせる。
  - 実体成功/DB失敗を防ぐため、実体削除はDB側で削除予約が確定してから実行する。

## DB運用チェックリスト（Go/No-Go）

- [ ] スキーマに `guildId` 境界がある（Project/Board/Assetで外部キー制約あり）
- [ ] `updatedAt/deletedAt` など運用列が定義されている
- [ ] 主要インデックスがある（`guildId`, `projectId`, `boardId`, `createdAt`）
- [ ] マイグレーション適用手順が再現可能（空DBから1コマンドで構築）
- [ ] バックアップ手順が確定（取得コマンド、保管先、世代数）
- [ ] リストア手順が確定（復元コマンド、検証SQL、所要時間目安）
- [ ] 容量監視の最小指標がある（DBサイズ、オブジェクト総量、増加率）
- [ ] 破壊操作の保護がある（GUI削除の確認、監査ログ記録）

## Phase 0で必ずやる検証

- 認可境界検証
  - Guild AユーザでGuild Bの `projectId/boardId/assetId` を直指定して拒否されること。
- データ整合性検証
  - 資産削除で「DBメタなし・実体あり」「DBメタあり・実体なし」が残らないこと。
- バックアップ復元検証
  - バックアップ取得 -> 初期化 -> 復元 -> 主要データ再表示まで一連確認。
- リカバリ検証
  - 変換ジョブ中断時に `failed` へ遷移し、再試行できること。
- コメント整合性検証
  - メディアコメントが `assetId/projectId/guildId` 境界を越えて参照できないこと。
- コネクタ整合性検証
  - `Connector` が `boardId/projectId/guildId` 境界を越えて参照/更新されないこと。

## 完了条件（Phase 0の関門）

- 「何を移植し、何を捨てるか」が全機能で明文化されている。
- 上記の `DB運用チェックリスト` が全てチェック済み。
- 認可境界・整合性・復元の検証結果がドキュメント化されている。
