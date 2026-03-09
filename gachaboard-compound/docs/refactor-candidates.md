# リファクタ候補（スパゲティ化しているコード）

> 改善余地のある箇所をメモ。優先度は要検討。

---

## 1. VideoShape / AudioShape の重複（最優先） ✅ 完了

| ファイル | 行数 | 問題 |
|----------|------|------|
| `VideoShape.tsx` | 1034 | 巨大。AudioShape と構造が酷似 |
| `AudioShape.tsx` | 883 | 同上 |

**重複していたロジック**（共通化済み）:
- コメント入力・投稿・削除 → `useMediaPlayerComments` フック、`MediaCommentInput` / `MediaCommentList` コンポーネント
- `formatTime(sec)` → `lib/formatTime.ts`
- スペースキーで再生/一時停止、シェイプ外タップでコメント入力解除 → `useMediaPlayerComments` 内
- コメントリストの高さ計算 → `useMediaPlayerComments` の `commentListH`, `MIN_COMMENT_LIST_H`

**実施済み**: 共通フック・コンポーネントを抽出し、VideoShape / AudioShape の両方で利用。

---

## 2. useFileDropHandler（452 行）

- S3 マルチパートアップロード、再開、チャンク分割、進捗表示を 1 ファイルに集約
- 責務が多く、テスト・理解が難しい

**提案**: `useS3Upload`（アップロードロジック）と `useFileDrop`（ドロップ・UI 連携）に分割するか、少なくともヘルパー関数を切り出す。

---

## 3. useYjsStore（477 行）

- Y.Doc ↔ TLStore の双方向バインド、IndexedDB 永続化、スナップショット取得、カメラ保存、ドラッグ中の最適化をすべて含む
- 1 フックでやることが多すぎる

**提案**: `useYjsConnection`（接続・provider）と `useYjsStoreSync`（Store ↔ Y.Doc バインド）に分離するか、内部でサブフックに分割。

---

## 4. CompoundBoard（481 行）

- ボード全体のレイアウト、ヘッダー、ファイルドロップ、プレビュー、復元、アップロードエラー表示などを 1 コンポーネントに集約
- 条件分岐（useSync の有無）で 2 系統の UI を描画

**提案**: `BoardHeader`, `BoardContent`, `BoardPreviewModal` などに分割。useSync 分岐は `BoardSyncWrapper` のようなラッパーに寄せる。

---

## 5. その他

| ファイル | 行数 | メモ |
|----------|------|------|
| `useShapeDeletePositionCapture.ts` | 174 | 責務は 1 つに近いが、ロジックがやや複雑 |
| `shapes/index.ts` | 337 | `placeFile` / `placeAsset` で MIME ごとの分岐が長い。`resolveShapeType` 周りを整理できる |
| `WorkspaceDetailClient.tsx` | 416 | ボード一覧・ゴミ箱タブ・アセット一覧を 1 ページに集約 |

---

## まとめ

- **最優先**: VideoShape / AudioShape の共通化（約 400 行以上の重複を削減可能）
- **次点**: useFileDropHandler、useYjsStore の責務分割
- **余裕があれば**: CompoundBoard、shapes/index.ts の整理
