# Phase 7: メディア拡張

## 目的

- YouTube埋め込み、OGP表示、wav->mp3プレビューを段階導入する。
- 映像のやり取りに対して、軽量な簡易プレビュー体験を提供する。
- GIFの貼り付け/表示を安定運用できるようにする。

## 実装対象

- `nextjs-web/src/app/project/[projectId]/board/[boardId]/page.tsx`
- `nextjs-web/src/app/api/links/unfurl/route.ts`
- `nextjs-web/src/app/api/media/convert/route.ts`（またはジョブ投入API）
- `nextjs-web/src/lib/media.ts`

## サブフェーズ

1. YouTube iframe埋め込み（MVP優先）
2. OGP取得/キャッシュ表示
3. 動画簡易プレビュー（サムネイル/再生UI）
4. wavアップロード後の非同期mp3変換 + プレビュー再生
5. GIF貼り付け運用（URL貼り付け・ファイルアップロード）

## 実装メモ

- iframeは許可ドメイン検証（`youtube.com`, `youtu.be`）。
- OGPはサーバ側取得（CORS回避 + キャッシュ可能）。
- 動画プレビューは初期表示を軽くするため、一覧/カードではサムネイル中心にする。
- 実再生はクリック時に限定して帯域を節約する。
- 音声変換は `ffmpeg` を使う非同期ジョブ方式。
- 変換状態 `processing/ready/failed` をUI表示。
- GIFは `image/gif` として保存し、アニメーション維持のまま表示する。
- 巨大GIF対策として、容量上限と変換方針（必要ならmp4/webm派生）を別途定義する。

## 依存

- 先行: `Phase 3`, `Phase 4`, `Phase 6`
- 後続に提供: `Phase 8`（タイムラインコメント）

## 完了条件

- YouTubeは再生可能、OGPは表示可能、wavはmp3プレビュー再生可能。
- 動画は一覧で簡易プレビュー（サムネイル）でき、詳細で再生できる。
- GIFは貼り付け/アップロード後に表示できる（再読込後も維持）。
