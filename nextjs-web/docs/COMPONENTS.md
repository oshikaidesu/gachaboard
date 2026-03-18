# コンポーネント一覧・説明

今後の開発のため、`nextjs-web/src/app` 配下の主要コンポーネントをカテゴリ別にまとめたドキュメントです。

---

## 共有資産（`shared/`）

nextjs-web と sync-server の両方から参照する型・定数・ユーティリティです。`@shared/xxx` としてインポートします。

| ファイル | 説明 |
|----------|------|
| **apiTypes.ts** | API レスポンスの共有型。Prisma モデルを基底に bigint→string・Date→string の変換ルールを適用。`ApiUser` / `ApiAsset` / `ApiComment` / `ApiReaction` / `ApiWorkspace` / `ApiBoard` / `ApiWorkspaceInfo` / `ApiWorkspaceMember` / `OgpData` など。 |
| **shapeDefs.ts** | カスタムシェイプの Single Source of Truth。`SHAPE_TYPE`（file-icon, audio-player, text-file, video-player）・props 型・`declare module "@cmpd/tlschema"` 拡張・`SHAPE_DEFS` レジストリ・`isTextFile` / `MEDIA_ICON_KINDS`。sync-server のスキーマ反映もここで一元管理。 |
| **utils.ts** | 共通ユーティリティ。`formatFileSize(bytes)`（pretty-bytes で人間可読なファイルサイズ表記）。 |
| **constants.ts** | アプリ全体で使う定数。`POLLING_INTERVAL_ASSET_LOADER` / `MAX_TEXT_PREVIEW_BYTES` / リアクション絵文字リスト（`FIXED_EMOJI_LIST` 等） / OGP 関連（`OGP_CACHE_TTL_MS` / `OGP_FETCH_TIMEOUT_MS` 等） / `ASSET_KIND`。 |
| **mimeUtils.ts** | MIME まわり。`resolveMimeType(mimeType, fileName)`（拡張子からのフォールバック） / `isPlayableAudio(mimeType)` / `getAssetKind(mimeType)`（Asset.kind 導出）。 |

---

## 1. ボード関連（`components/board/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **CompoundBoard** | `CompoundBoard.tsx` | メインのボード画面。Compound（tldraw 系）エディタをラップし、Yjs/Hocuspocus 同期・カスタムシェイプ・コラボレーション・ファイルドロップ・スナップショット保存・プレビューなどを統合するルートコンポーネント。 |
| **BoardClient** | `board/[boardId]/BoardClient.tsx` | ボードページのクライアントエントリ。`CompoundBoard` を動的インポートし、E2E 時は即時表示オプションをサポート。 |
| **BoardHeader** | `BoardHeader.tsx` | ボード上部のヘッダー。ロゴ・ボード名・同期状態・共有パネル・戻るリンク・横スクロール可能なアクション領域を提供。 |
| **BoardContext** | `BoardContext.tsx` | ボード画面で共有するコンテキスト（`boardId`, `workspaceId`, `currentUserId`, `userName`, `avatarUrl`, `userInfoAtom`, `provider`, `syncAvailable`）。`useBoardContext()` で利用。 |
| **BoardReactionProvider** | `BoardReactionProvider.tsx` | シェイプごとのリアクション（絵文字）を Y.Doc の `reactions` Map で同期。`useBoardReactions(shapeId)` で取得・追加・削除。 |
| **BoardCommentProvider** | `BoardCommentProvider.tsx` | メディアアセットへのコメントを Y.Doc の `comments` Map で同期。`useBoardComments(assetId)` で取得・追加・削除。 |
| **BrushModeToolbarSync** | `BrushModeToolbarSync.tsx` | ブラシ/消しゴムモードと Compound ツールバーの状態を同期するブリッジ。 |
| **ConnectHandles** | `ConnectHandles.tsx` | ボードレベルのコネクトハンドル用コンテナ。現在はプレースホルダー（各シェイプは `ShapeConnectHandles` が担当）。 |
| **DarkModeButton** | `DarkModeButton.tsx` | ダークモード切り替えボタン。指定の portal に描画可能。 |
| **DownloadSelectedButton** | `DownloadSelectedButton.tsx` | 選択中のシェイプを ZIP で一括ダウンロードするボタン。 |
| **currentUserAtom** | `currentUserAtom.ts` | 現在ユーザー ID を保持する Atom（`@cmpd/state`）。シェイプの createdBy などで参照。 |
| **createBoardOverrides** | `boardOverrides.ts` | Compound の UI オーバーライド（ツールバー・メニュー・許可ツール ID など）を生成。 |
| **boardOverridesConfig** | `boardOverridesConfig.ts` | GEO サイズ・ツールバー許可 ID・非表示アクション ID などの定数。 |
| **ConfirmDeleteModal** | `board/trash/ConfirmDeleteModal.tsx` | ゴミ箱からの完全削除確認モーダル。 |

---

## 2. 認証（`components/auth/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **AuthProvider** | `AuthProvider.tsx` | NextAuth の `SessionProvider` をラップ。refetch を抑えてセッションを提供。 |
| **SignInButton** | `SignInButton.tsx` | サインインボタン。未認証時に表示。 |
| **AuthTroubleshooting** | `AuthTroubleshooting.tsx` | 認証エラー時のトラブルシューティング用 UI（callbackUrl を渡して表示）。 |

---

## 3. コラボレーション（`components/collaboration/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **UserSharePanel** | `UserSharePanel.tsx` | 接続中ユーザー一覧。Yjs Awareness から取得。avatarUrl/color は検証してから表示。 |
| **CollaboratorCursorWithName** | `CollaboratorCursor.tsx` | 他ユーザーのカーソル＋名前タグ。Awareness の point/color/zoom/name を表示。5 秒無操作で非表示。 |
| **AwarenessSync** | `AwarenessSync.tsx` | Yjs Awareness と Compound の `instance_presence` を双方向に同期。リモートの cursor/dragging を store に反映し、ローカルのポインター移動を awareness に送信。 |
| **DraggingGhostOverlay** | `DraggingGhostOverlay.tsx` | 他ユーザーがドラッグ中のシェイプをオーバーレイで表示。`meta.dragging`（Awareness）のみ使用し、Y.Doc はドロップ時のみ同期。 |
| **PeerDraggingGhost** | `PeerDraggingGhost.tsx` | シェイプ内に配置する「他ユーザーのドラッグ中ゴースト」。シェイプ座標系で offset のみ描画。 |
| **usePeerDragging** | `usePeerDragging.ts` | 指定 `shapeId` の他ユーザーによるドラッグ情報（x, y, color）を返すフック。 |

---

## 4. テーマ（`components/theme/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **ThemeProvider** | `ThemeProvider.tsx` | ダークモード状態を Context と localStorage で管理。`document.documentElement` の `dark` クラスと BroadcastChannel でタブ間同期。 |
| **useTheme** | `ThemeProvider.tsx` | `{ isDarkMode }` を返すフック。 |
| **ThemeToggle** | `ThemeToggle.tsx` | テーマ切り替えトグル UI。 |
| **ThemeToggleFloating** | `ThemeToggleFloating.tsx` | 画面に浮かぶテーマ切り替えボタン。 |

---

## 5. ツールバー（`components/toolbar/`)

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **SmartHandToolbar** | `SmartHandToolbar.tsx` | Compound 用ツールバー。現状はプレースホルダー（null）。今後 Compound の Toolbar に合わせて実装予定。 |

---

## 6. UI 共通（`components/ui/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **GachaboardLogo** | `GachaboardLogo.tsx` | アプリロゴ。size・href・className を指定可能。 |
| **Identicon** | `Identicon.tsx` | 値から生成するミニ identicon。`getMinidenticonColor(value, saturation, lightness)` も export。 |
| **TwemojiImg** | `Twemoji.tsx` | Twemoji を用いた絵文字表示。`twemojiUrl(emoji)` で CDN URL 取得。 |
| **MoreVerticalIcon** | `MoreVerticalIcon.tsx` | 縦三点メニュー用アイコン。 |
| **PreviewModal** | `PreviewModal.tsx` | ファイルシェイプのダブルクリック時に表示するプレビューモーダル。画像/動画/音声/その他で表示を切り替え。 |
| **MediaPlayer** | `MediaPlayer.tsx` | 動画・音声の再生 UI。再生位置・コメント投稿・削除に対応。`useBoardComments` と連携。 |
| **ReactionPicker** | `ReactionPicker.tsx` | リアクション用絵文字ピッカー。プリセットと既存リアクションの集計表示。 |
| **RenameModal** | `RenameModal.tsx` | 名前・説明を編集するモーダル（ワークスペース/ボードのリネーム等）。 |
| **InviteLinkModal** | `InviteLinkModal.tsx` | ワークスペース招待リンクを表示するモーダル。 |
| **InviteLinkInline** | `InviteLinkInline.tsx` | 招待リンクをインラインで表示するコンポーネント。 |
| **SyncStatusBadge** | `SyncStatusBadge.tsx` | 同期状態を表示するバッジ（store を渡して表示）。 |

---

## 7. シェイプ共通（`shapes/common/`）

| コンポーネント / ユーティリティ | パス | 説明 |
|----------------------------------|------|------|
| **CreatorLabel** | `CreatorLabel.tsx` | シェイプの作成者名・アバター・作成順位を表示。`getCreatedBy` / `getCreatedByAvatarUrl` / `getCreationRank` を export。 |
| **UserAvatarLabel** | `UserAvatarLabel.tsx` | アバター＋名前のラベル。コラボレーターカーソル等で使用。 |
| **ShapeReactionPanel** | `ShapeReactionPanel.tsx` | シェイプに紐づくリアクション一覧＋絵文字ピッカー。`useBoardReactions` とプリセットを利用。 |
| **ShapeConnectHandles** | `ShapeConnectHandles.tsx` | シェイプのコネクト用ハンドル（矢印で他シェイプと接続）。 |
| **OgpPreview** | `OgpPreview.tsx` | URL の OGP カード表示。`useOgp` でメタデータ取得し、Twemoji と安全な URL で表示。 |
| **DownloadButton** | `DownloadButton.tsx` | アセットのダウンロードボタン。`FileSizeLabel` も export。 |
| **AssetLoader** | `AssetLoader.tsx` | アセット ID に基づく読み込み状態（ローディング/エラー）の表示。 |
| **WheelGuard** | `ScrollContainer.tsx` | スクロール領域でホイールイベントを吸収し、キャンバスズームに奪われないようにするガード。 |
| **getColorForShape** / **getStrokeHexForColorStyle** | `ShapeFrameColor.tsx` | シェイプの枠色をテーマに合わせて取得。 |

---

## 8. ネイティブシェイプラッパー（`shapes/NativeShapeWrappers.tsx`）

tldraw 組み込みシェイプ（image / note / text / geo / arrow）に、以下を追加するラッパー群。

- **CreatorLabel**・**ShapeReactionPanel**・**ShapeConnectHandles**
- Note/Text では **OgpPreview**・**DownloadButton**・**FileSizeLabel** も組み合わせ

- `WrappedImageShapeUtil` / `WrappedNoteShapeUtil` / `WrappedGeoShapeUtil` / `WrappedTextShapeUtil` / `WrappedArrowShapeUtil`

---

## 9. ファイル系シェイプ（`shapes/file/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **FileIconShapeUtil** | `FileIconShape.tsx` | ファイルアイコンシェイプ。拡張子に応じた絵文字・ファイル名省略・アップロード進捗・ダウンロード。`getFileEmoji(fileName, kind)` を export。 |
| **TextFileShapeUtil** | `TextFileShape.tsx` | テキストファイル用シェイプ。内容プレビュー・コードハイライト対応。`isTextFile` を export。 |

---

## 10. メディアシェイプ（`shapes/media/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **VideoShapeUtil** | `VideoShape.tsx` | 動画シェイプ。再生コントロール・シークバー・コメント入力・コメントリスト・音量・ダークモード対応。 |
| **AudioShapeUtil** | `AudioShape.tsx` | 音声シェイプ。波形表示・再生・コメント・音量スライダー。 |
| **VideoControlsBar** | `VideoControlsBar.tsx` | 動画用再生・一時停止・シーク・音量などのコントロールバー。 |
| **WaveformCanvas** | `WaveformCanvas.tsx` | 音声用波形キャンバス。 |
| **MediaVolumeSlider** | `MediaVolumeSlider.tsx` | メディア用音量スライダー。 |
| **MediaCommentInput** | `MediaCommentInput.tsx` | メディアの再生位置へのコメント入力欄。 |
| **MediaCommentList** | `MediaCommentList.tsx` | メディアに紐づくコメント一覧表示。 |
| **SeekBar** | `SeekBar.tsx` | 再生位置用シークバー。 |

---

## 11. シェイプ登録・変換（`shapes/`）

- **`index.ts`**  
  - `CUSTOM_SHAPE_UTILS`: Compound に渡すカスタム ShapeUtil の配列（FileIcon, TextFile, Audio, Video, 各 Wrapped ネイティブ, Draw, Highlight, Line, Frame, Bookmark, Embed）。  
  - `placeAsset` / `placeFile` / `placeholderShape`: 配置用。  
  - `convertToFileIcon` / `convertFromFileIcon` / `convertToMediaPlayer`: シェイプ変換用。

---

## 12. ワークスペース・ワークスペース詳細（`workspaces/`・`workspace/[workspaceId]/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **WorkspacesClient** | `workspaces/WorkspacesClient.tsx` | ワークスペース一覧のクライアントコンポーネント。 |
| **WorkspacesHeader** | `workspaces/components/WorkspacesHeader.tsx` | 一覧ページのヘッダー。 |
| **WorkspaceCard** | `workspaces/components/WorkspaceCard.tsx` | ワークスペースカード。Identicon・招待リンク・メニュー・リネーム/ゴミ箱/復元/完全削除。 |
| **WorkspacesEmptyState** | `workspaces/components/WorkspacesEmptyState.tsx` | ワークスペースが無いときの空状態 UI。 |
| **WorkspaceDetailClient** | `workspace/[workspaceId]/WorkspaceDetailClient.tsx` | ワークスペース詳細（ボード一覧）のクライアント。 |
| **WorkspaceBoardCard** | `workspace/[workspaceId]/components/WorkspaceBoardCard.tsx` | ワークスペース内のボードカード。 |
| **BoardCreateForm** | `workspace/[workspaceId]/components/BoardCreateForm.tsx` | 新規ボード作成フォーム。 |
| **WorkspaceMembersPopover** | `workspace/[workspaceId]/components/WorkspaceMembersPopover.tsx` | メンバー一覧のポップオーバー。 |

---

## 13. アセット（`workspace/[workspaceId]/assets/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **AssetFilters** | `assets/components/AssetFilters.tsx` | アセット一覧の検索・ボードフィルタ・種類フィルタ（画像/動画/音声/その他）。 |
| **AssetListItem** | `assets/components/AssetListItem.tsx` | アセット一覧の 1 行。 |
| **AssetPreviewModal** | `assets/components/AssetPreviewModal.tsx` | アセットのプレビュー用モーダル。 |

---

## 14. ボード・ゴミ箱・リアクションプリセット（`board/[boardId]/`）

| コンポーネント | パス | 説明 |
|----------------|------|------|
| **BoardTrashClient** | `board/[boardId]/trash/BoardTrashClient.tsx` | ゴミ箱画面のクライアント。削除済みアイテムの一覧・復元・完全削除。 |
| **ReactionPresetClient** | `board/[boardId]/reaction-preset/ReactionPresetClient.tsx` | ボードで使うリアクション絵文字のプリセット編集画面。 |

---

## 15. 認証・招待・エラーページ

| コンポーネント / ページ | パス | 説明 |
|--------------------------|------|------|
| **SignInContent** | `auth/signin/SignInContent.tsx` | サインイン画面のメインコンテンツ。 |
| **InviteClient** | `invite/[token]/InviteClient.tsx` | 招待トークンでワークスペースに参加するフロー用クライアント。 |
| **access-denied** | `access-denied/page.tsx` | アクセス拒否ページ。 |
| **auth-error** | `auth-error/page.tsx` | 認証エラー用ページ。 |

---

## 16. フック・ユーティリティ（参考）

- **hooks/yjs/** … Yjs store・Hocuspocus 接続・YMap 同期
- **hooks/board/** … スナップショット取得・保存・同期状態・復元・SyncToken
- **hooks/media/** … 波形・OGP・メディアコメント
- **hooks/workspace/** … ワークスペース一覧・メンバー
- **hooks/useReactionPreset** … リアクションプリセット取得
- **lib/safeUrl** … `getSafeHref` / `getSafeColor` / `getSafeAssetId`（XSS 対策）

---

## 更新方針

- 新規コンポーネント追加・役割変更時に、この MD の該当セクションを更新する。
- **共有資産**（`shared/`）の追加・変更時は「共有資産」セクションを更新する。
- パスは `nextjs-web/src/app` からの相対で記載している（共有資産は `nextjs-web/shared/`）。
