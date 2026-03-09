# カスタムシェイプ解析（gachaboard-fresh → compound 移植状況）

<!-- 最終更新: 2026-03-06 -->

## 概要

gachaboard は音楽・映像・デザインファイルを貼り付けて共有するホワイトボード。
tldraw / compound のネイティブシェイプ（画像・テキスト・図形等）に加えて、
メディア再生やファイル管理に特化した **カスタムシェイプ** を実装している。

---

## アーキテクチャ（実装アプローチ）

### Single Source of Truth: `shared/shapeDefs.ts`

すべてのカスタムシェイプは `shared/shapeDefs.ts` で一元管理。

- **SHAPE_TYPE**: 型名定数（`"file-icon"`, `"audio-player"`, `"text-file"`, `"video-player"`）
- **SHAPE_DEFS**: 各シェイプの `defaultProps`, `matchMime`, `priority` を定義
- **resolveShapeType**: MIME + ファイル名 → 最適なシェイプ型を返す（priority 降順で試行）
- **declare module**: `@cmpd/tlschema` の `TLGlobalShapePropsMap` を拡張

### 振り分けフロー

```
ファイル到着（ドロップ or ペースト）
  → registerExternalContentHandler("files")
  → uploadFile() → ApiAsset
  → placeFile(editor, file, data, position, createdBy)
      ├─ image/*  → tldraw ネイティブ画像シェイプ（AssetRecordType + createShape）
      ├─ video/*  → VideoShape（video-player）
      └─ その他   → resolveShapeType(mime, fileName)
            ├─ priority 40: video-player（video/mp4）
            ├─ priority 30: audio-player（isPlayableAudio）
            ├─ priority 20: text-file（isTextFile）
            └─ priority  0: file-icon（fallback）
```

### 新規シェイプ追加手順

1. `shared/shapeDefs.ts` の `SHAPE_DEFS` にエントリ追加
2. `shapes/file/` or `shapes/media/` に ShapeUtil クラスを作成
3. `shapes/index.ts` の `CUSTOM_SHAPE_UTILS` に追加
→ `placeFile` / `placeholderShape` / sync-server スキーマへの反映は自動

### 共通コンポーネント（shapes/common/）

各シェイプが共有する UI パーツ:

| コンポーネント | 役割 |
|----------------|------|
| **CreatorLabel** | `shape.meta.createdBy` から作成者名を表示 |
| **FileSizeLabel** | `shape.meta.sizeBytes` を「1.2 MB」等にフォーマット表示 |
| **DownloadButton** | `/api/assets/{id}/file?download=1` からストリームDL、進捗toast表示 |
| **ShapeReactionPanel** | Twemoji 絵文字リアクション（BoardReactionProvider 連携） |
| **ShapeConnectHandles** | 上下左右の矢印ハンドル（draw.io 風接続） |
| **OgpPreview** | `meta.ogpUrls` の URL を OGP カード / YouTube iframe で表示 |
| **AssetLoader** | HEAD で 200/202 をポーリングし、変換完了まで「変換中…」UI |
| **WheelGuard** | 選択中はホイールをキャンバスに渡さず、内部スクロールのみ有効化 |

### sizeBytes の流れ

`placeFile()` → `meta = { createdBy, sizeBytes: data.sizeBytes }` → シェイプ作成時に `meta` を付与
→ 各シェイプの `component()` で `shape.meta?.sizeBytes` を `FileSizeLabel` に渡す

---

## 1. 画像シェイプ（WrappedImageShapeUtil）

### アプローチ

tldraw ネイティブの `ImageShapeUtil` をラップ。ファクトリ `wrapWithExtras()` で CreatorLabel 等を追加した上で、**`component()` を完全オーバーライド**。

```
WrappedImageShapeUtil = class extends wrapWithExtras(ImageShapeUtil) {
  component(shape) {
    const nativeImage = super.component(shape);  // tldraw の画像描画
    // チェッカー背景 + nativeImage + FileSizeLabel + DownloadButton
  }
}
```

### 機能一覧

| 機能 | 実装 |
|------|------|
| 画像表示 | `super.component(shape)` で tldraw ネイティブ描画を取得 |
| 透過チェッカー背景 | CSS チェッカーパターン |
| アスペクト比固定 | `isAspectRatioLocked() → true` |
| 容量表示 | `FileSizeLabel`（右上） |
| ダウンロード | `DownloadButton`（右上、`/api/assets/{id}/file` から assetId 抽出） |
| リアクション | `ShapeReactionPanel`（wrapWithExtras で自動付与） |
| 接続ハンドル | `ShapeConnectHandles`（wrapWithExtras で自動付与） |
| 作成者表示 | CreatorLabel は画像では使用していない（独自レイアウトのため） |
| OGP | 画像では使用しない |

### 画像特有の処理

- `editor.getAsset(assetId)` → `asset.props.src` から API assetId を正規表現で抽出
- `src.match(/\/api\/assets\/([^/]+)\/file/)` → DownloadButton に渡す

---

## 2. 音声シェイプ（AudioShapeUtil）

### アプローチ

`BaseBoxShapeUtil<AudioShape>` を継承。`AudioPlayer` コンポーネントで波形 + カスタムコントロールを実装。

```
AudioShapeUtil.component(shape) {
  return (
    <CreatorLabel />
    <AssetLoader converted={isWav}>   ← WAV は ?converted=1 で MP3 変換版を使用
      <AudioPlayer shape={shape} />
    </AssetLoader>
    <ShapeReactionPanel />
    <ShapeConnectHandles />
  );
}
```

### 機能一覧

| 機能 | 実装 |
|------|------|
| 波形表示 | `useWaveform(assetId)` → Canvas に roundRect で描画 |
| 波形色分け | 再生済み → オレンジ (#ff5500)、未再生 → グレー (#d1d5db) |
| 再生/停止 | `audio.play()` / `audio.pause()` |
| シーク | 波形クリックで `audio.currentTime = ratio * duration` |
| 音量 | `<input type="range">` → `audio.volume` |
| 容量表示 | `FileSizeLabel`（ヘッダー右側） |
| ダウンロード | `DownloadButton`（ヘッダー右端） |
| 作成者表示 | `CreatorLabel` |
| リアクション | `ShapeReactionPanel` |
| 接続ハンドル | `ShapeConnectHandles` |
| タイムラインコメント | `/api/comments` で投稿・取得・30秒ポーリング |
| コメントピン | 波形上にオレンジ円で位置表示、ホバーでツールチップ |
| コメントクリック | 該当時刻へシーク |
| WAV → MP3 変換 | `AssetLoader converted={true}` で HEAD 202 ポーリング |
| シェイプ高さ自動調整 | コメント数 × 24px + パディングで `props.h` を更新 |

### props（デフォルト）

| prop | 値 |
|------|------|
| assetId | `""` |
| fileName | `"audio.mp3"` |
| mimeType | `"audio/mpeg"` |
| w | 560 |
| h | 160 |

---

## 3. 動画シェイプ（VideoShapeUtil）

### アプローチ

`BaseBoxShapeUtil<VideoShape>` を継承。`VideoPlayer` + `SeekBar` コンポーネントでフルカスタム動画プレイヤーを実装。tldraw ネイティブの `video` シェイプは使わない。

```
VideoShapeUtil.component(shape) {
  return (
    <CreatorLabel />
    <AssetLoader assetId={assetId}>   ← HEAD 202 で変換待ちポーリング
      <VideoPlayer shape={shape} />
    </AssetLoader>
    <ShapeReactionPanel />
    <ShapeConnectHandles />
  );
}
```

### 機能一覧

| 機能 | 実装 |
|------|------|
| 動画再生 | `<video>` 要素、`controls={false}` でカスタム UI |
| サムネイル | `poster={/api/assets/{id}/thumbnail}` |
| キャッシュバスト | `src` に `?v=${Date.now()}` を付与（assetId 変更時のみ再生成） |
| シークバー | `SeekBar` コンポーネント（ポインタドラッグ対応） |
| コメントピン | シークバー上に青い円で位置表示 |
| 再生/停止 | `video.play()` / `video.pause()`、AbortError 無視 |
| 音量 | `<input type="range">` → `video.volume`、ミュートトグル |
| 容量表示 | `FileSizeLabel`（ヘッダー右側） |
| ダウンロード | `DownloadButton`（ヘッダー右端） |
| 作成者表示 | `CreatorLabel` |
| リアクション | `ShapeReactionPanel` |
| 接続ハンドル | `ShapeConnectHandles` |
| タイムラインコメント | `/api/comments` で投稿・取得・30秒ポーリング |
| コメントクリック | 該当時刻へシーク |
| シェイプ高さ自動調整 | `BASE_HEIGHT + COMMENT_LIST_PADDING + comments.length * COMMENT_ROW_HEIGHT` |
| 動画変換対応 | `AssetLoader` の HEAD 200/202 でポーリング、変換中はスピナー+サムネイル背景 |

### props（デフォルト）

| prop | 値 |
|------|------|
| assetId | `""` |
| fileName | `"video.mp4"` |
| mimeType | `"video/mp4"` |
| w | 480 |
| h | 330 |

### VIDEO_UI_OVERHEAD

動画エリア以外の UI の合計高さ。`placeFile` でシェイプ高さを `videoH + VIDEO_UI_OVERHEAD` に設定する。

```
VIDEO_UI_OVERHEAD = HEADER_HEIGHT(26) + コントロール(50) + コメント入力(26) = 102
```

---

## 4. ファイルアイコンシェイプ（FileIconShapeUtil）

### アプローチ

`BaseBoxShapeUtil<FileIconShape>` を継承。ファイル種別に応じた絵文字アイコン＋ファイル名を表示。あらゆるファイルの fallback。

### 機能一覧

| 機能 | 実装 |
|------|------|
| アイコン表示 | `getFileEmoji(fileName, kind)` で種別→絵文字 |
| 画像/GIF プレビュー | `kind === "image" \| "gif"` のとき `/api/assets/{id}/file` の img を 64×64 で表示 |
| ファイル名 | `truncateWithExtension(name, 14)` で省略表示 |
| 容量表示 | `FileSizeLabel`（ホバー時に右上） |
| ダウンロード | `DownloadButton`（ホバー時に右上） |
| 作成者表示 | `CreatorLabel` |
| リアクション | `ShapeReactionPanel` |
| 接続ハンドル | `ShapeConnectHandles` |
| アップロード進捗 | `UploadProgressDisplay`（`assetId` 空 + `meta.uploadProgress` 時） |

### 絵文字マッピング（getFileEmoji）

| 条件 | 絵文字 |
|------|--------|
| kind = image / gif | 🖼️ |
| kind = video | 🎬 |
| kind = audio | 🎵 |
| zip, tar, gz, 7z, rar | 🗜️ |
| pdf | 📕 |
| doc, docx | 📝 |
| xls, xlsx, csv | 📊 |
| ppt, pptx | 📊 |
| txt, md, log | 📄 |
| json, yaml, yml, toml, xml | 🔧 |
| js, ts, py, go, rs, cpp, c, java | 💻 |
| exe, dmg, pkg, deb, rpm | ⚙️ |
| stem, als, flp, ptx, logic | 🎛️ |
| デフォルト | 📦 |

### props（デフォルト）

| prop | 値 |
|------|------|
| assetId | `""` |
| fileName | `"file"` |
| mimeType | `"application/octet-stream"` |
| kind | `"file"` |
| w | 96 |
| h | 96 |

---

## 5. テキストファイルシェイプ（TextFileShapeUtil）

### アプローチ

`BaseBoxShapeUtil<TextFileShape>` を継承。`props.content` にテキスト内容を保持し、`<pre>` でプレビュー表示。

### 機能一覧

| 機能 | 実装 |
|------|------|
| テキストプレビュー | `<pre>` で monospace 表示（Fira Code 等） |
| 拡張子別スタイル | コード系→ダーク背景、JSON→黄背景、MD→青背景、CSV→緑背景 |
| 拡張子別アイコン | コード→💻、JSON→🔧、MD→📝、CSV→📊、その他→📄 |
| 容量表示 | `FileSizeLabel`（ヘッダー右側、常時表示） |
| ダウンロード | `DownloadButton`（ヘッダー右端、常時表示） |
| 作成者表示 | `CreatorLabel` |
| リアクション | `ShapeReactionPanel` |
| 接続ハンドル | `ShapeConnectHandles` |
| スクロール | `WheelGuard` でキャンバスへの伝播を防止 |
| 内容取得 | `placeFile` 内で `fetchTextContent(assetId)` → `MAX_TEXT_PREVIEW_BYTES`（10240）で切り詰め |

### props（デフォルト）

| prop | 値 |
|------|------|
| assetId | `""` |
| fileName | `"file.txt"` |
| mimeType | `"text/plain"` |
| content | `""` |
| w | 320 |
| h | 240 |

---

## compound への移植状況

### シェイプ移植状況

| シェイプ | 移植 | 差分 |
|----------|------|------|
| **WrappedImageShapeUtil** | ✅ 同等 | import パスのみ差 |
| **AudioShapeUtil** | ✅ 同等 | import パスのみ差 |
| **VideoShapeUtil** | ✅ 同等 | import パスのみ差 |
| **TextFileShapeUtil** | ✅ 同等 | import パスのみ差 |
| **FileIconShapeUtil** | ⚠️ 機能縮小 | 下記参照 |

### FileIconShapeUtil の差分（compound で不足）

| 機能 | fresh | compound |
|------|-------|----------|
| CreatorLabel | あり | なし |
| AssetLoader | あり | なし |
| ShapeReactionPanel | あり | なし |
| ShapeConnectHandles | あり | なし |
| UploadProgressDisplay | あり | なし |
| 画像/GIF プレビュー | あり（kind=image/gif → img 表示） | なし（絵文字のみ） |
| DownloadButton | あり | 簡易（`<a download>` のみ） |
| FileSizeLabel | あり（ホバー時） | なし |
| getFileEmoji 拡張子 | ppt, exe, stem 等含む | ppt, exe, stem 等なし |
| indicator rx | 6（角丸） | 0（角丸なし） |

### 共通コンポーネント移植状況

| コンポーネント | compound | 差分 |
|----------------|----------|------|
| CreatorLabel | ✅ あり | 同等 |
| FileSizeLabel | ✅ あり | 同等 |
| DownloadButton | ✅ あり | 同等 |
| ShapeReactionPanel | ✅ あり | 同等 |
| ShapeConnectHandles | ✅ あり | Arrow API が異なる（binding vs props.start） |
| OgpPreview | ✅ あり | 同等 |
| AssetLoader | ✅ あり | 同等 |
| WheelGuard | ✅ あり | 同等 |

### クリップボードペースト問題

| 経路 | 動画の扱い | 状態 |
|------|------------|------|
| ファイルドロップ | ✅ 動作する | `registerExternalContentHandler("files")` が全ファイル処理 |
| イベントペースト（Ctrl+V） | ✅ 動作する想定 | `item.kind === "file"` で全ファイル取得 |
| Clipboard API ペースト | ❌ 動作しない | `isFile` が `image/` のみ判定、`video/` が漏れる |

**原因**: `@cmpd/compound` の `useClipboardEvents.mjs` 内:
- `isFile()` が `/^image\//` のみマッチ → `/^(image|video)\//` に修正必要
- `handlePasteFromClipboardApi` 内の `type.match(/^image\//)` → `/^(image|video)\//` に修正必要

**対応**: `patches/@cmpd+compound+2.0.0-alpha.21.patch` に `useClipboardEvents` の diff を追記

---

## 残課題

| 項目 | 優先度 | 内容 |
|------|--------|------|
| Clipboard API 動画ペースト | 高 | `isFile` + `handlePasteFromClipboardApi` のパッチ |
| FileIconShapeUtil 機能復元 | 中 | CreatorLabel, Reaction, ConnectHandles, Progress, 画像プレビュー, DL, Size |
| getFileEmoji 拡張子追加 | 低 | ppt, exe, stem 等を compound にも追加 |
