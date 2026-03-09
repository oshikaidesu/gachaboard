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

## 2. useFileDropHandler ✅ 完了

- S3 マルチパートアップロード、再開、チャンク分割を `lib/s3Upload.ts` に分離
- useFileDropHandler はドロップ・UI 連携に特化し、`uploadAndPlace` で共通化

---

## 3. useYjsStore ✅ ヘルパー抽出済み

- カメラ保存・復元、RecordsDiff 反映、ドラッグ検出などを `lib/yjsSyncHelpers.ts` に抽出
- useYjsStore の行数を削減

---

## 4. CompoundBoard ✅ ヘッダー分割済み

- `BoardHeader` を独立コンポーネントに抽出（ヘッダーバー、続行可能アップロード表示）

---

## 5. shapes/index.ts ✅ 完了

- `createShapeForResolved` ヘルパーで placeFile / placeAsset / placeholderShape の重複を解消

---

## 6. その他（未着手）

| ファイル | 行数 | メモ |
|----------|------|------|
| `useShapeDeletePositionCapture.ts` | 174 | 責務は 1 つに近いが、ロジックがやや複雑 |
| `WorkspaceDetailClient.tsx` | 416 | ボード一覧・ゴミ箱タブ・アセット一覧を 1 ページに集約 |

---

## 6.1 重複実装（formatSize / fileIcon） ✅ 完了

| 機能 | 実装箇所 | 対応 |
|------|----------|------|
| **formatSize** | `BoardTrashClient`, `assets/page` | `@shared/utils` の `formatFileSize` に統一 |
| **fileIcon / getFileEmoji** | `BoardTrashClient`, `assets/page`, `FileIconShape` | `getFileEmoji` を `@/app/shapes` から import して BoardTrashClient・assets/page で利用 |

---

## 6.2 巨大コンポーネント（状態過多）

| ファイル | 行数 | 状態数 | 問題 |
|----------|------|--------|------|
| `WorkspaceDetailClient.tsx` | 416 | 22+ | ボード一覧・ゴミ箱・アセット・メンバー・招待・リネーム・メニュー・作成フォームを 1 ファイルに集約 |
| `assets/page.tsx` | 308 | 12+ | アセット一覧・検索・フィルタ・プレビュー・削除・タブを 1 ページに集約 |

**提案**: WorkspaceDetailClient を `WorkspaceBoardsTab`, `WorkspaceTrashTab`, `WorkspaceAssetsTab`, `WorkspaceMembersPopover` 等に分割。assets/page も同様にタブ・フィルタ・リストを分離。

---

## 6.3 複雑なロジック（分割候補）

| ファイル | 行数 | メモ |
|----------|------|------|
| `ShapeConnectHandles.tsx` | 329 | 接続ハンドル・リサイズ・矢印の描画・ドラッグを 1 コンポーネントに集約 |
| `NativeShapeWrappers.tsx` | 325 | 複数ネイティブシェイプのラッパーを 1 ファイルに |
| `boardOverrides.ts` | 238 | ツール・アクション・geo サイズ・キーボードショートカットを 1 関数で返す |

---

## 7. コード間参照・依存関係（検討事項）

### 7.1 レイヤー逆転（shapes → board）

| 参照元 | 参照先 | 内容 |
|--------|--------|------|
| `shapes/common/AssetLoader` | `BoardContext` | boardId, workspaceId |
| `shapes/common/ShapeReactionPanel` | `BoardContext` | boardId, workspaceId, currentUserId, provider, syncAvailable |
| `shapes/media/VideoShape` | `BoardContext` | （useMediaPlayerComments 経由） |
| `hooks/useMediaPlayerComments` | `BoardContext` | syncAvailable |

**課題**: シェイプ（下層）が BoardContext（上層）に依存。シェイプをボード外で再利用しづらい。

**提案**: 必要なら props で渡す、または `BoardContext` を `BoardProvider` 配下に限定し、シェイプは「ボード内でのみ使う」前提を明文化。

---

### 7.2 @shared の利用状況

| モジュール | 用途 |
|------------|------|
| `@shared/apiTypes` | ApiAsset, ApiComment, ApiBoard, ApiWorkspace 等（10+ ファイル） |
| `@shared/shapeDefs` | SHAPE_TYPE, resolveShapeType, 型定義（shapes 系） |
| `@shared/constants` | MAX_TEXT_PREVIEW_BYTES, POLLING_INTERVAL, DEFAULT_REACTION_EMOJI_LIST |
| `@shared/utils` | formatFileSize |
| `@shared/mimeUtils` | isPlayableAudio（S3 complete のみ） |

**現状**: nextjs-web 内の `shared/` を `@shared/*` で参照。sync-server は別リポジトリの可能性。

**提案**: 型・定数・ユーティリティの責務を分け、必要なら `packages/shared` のような共通パッケージに昇格。

---

### 7.3 shapes の barrel export

`@/app/shapes` から export されるもの:
- `CUSTOM_SHAPE_UTILS`, `placeFile`, `placeAsset`, `placeholderShape`
- 型: `ApiAsset`, `FileIconShape`, `AudioShape`, `TextFileShape`, `VideoShape`
- 個別: `FileIconShapeUtil`, `TextFileShapeUtil`, `AudioShapeUtil`, `VideoShapeUtil`, `VIDEO_UI_OVERHEAD`, `MIN_COMMENT_LIST_H`, `getFileEmoji`, `isTextFile`

**課題**: 1 ファイルに集約されており、tree-shaking が効きにくい可能性。

**提案**: 必要に応じて `shapes/placeFile`, `shapes/utils` などに分割し、利用側で個別 import。

---

### 7.4 tsconfig の exclude

```json
"exclude": [
  "src/app/shapes/media/AudioShape.tsx",
  "src/app/shapes/media/VideoShape.tsx",
  "src/app/shapes/file/TextFileShape.tsx",
  "src/app/shapes/NativeShapeWrappers.tsx"
]
```

**要確認**: 上記が意図的か、過去の暫定対応か。ビルドには含まれるが型チェックから外れている可能性。

---

### 7.5 循環依存

- **app コード**: madge では検出なし（Prisma 生成コードのみ循環）
- **注意**: `shapes` → `BoardContext` → （CompoundBoard が shapes を利用）の一方向依存。現状は循環していない。
