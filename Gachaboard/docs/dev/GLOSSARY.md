# 用語集

> Gachaboard 関連の用語・略語の定義。

---

## A

- **Awareness**
  - Yjs のプロトコル。カーソル位置・ユーザー情報・currentPageId など、セッション単位の状態をリアルタイム共有。永続化しない。

- **Asset**
  - アップロードされたファイル（動画・音声・画像等）のメタデータ。API でアップロード・取得・変換を管理。

---

## B

- **Board**
  - 1 つのホワイトボード画面。複数シェイプを配置し、複数人で共同編集する単位。

- **BoardReactionProvider**
  - シェイプへのリアクション表示・追加を管理する React コンテキスト。

---

## C

- **compound**
  - tldraw の Apache 2.0 フォーク。共同編集とカスタムシェイプを前提としたホワイトボード SDK。

- **CompoundBoard**
  - ボード編集画面のメインコンポーネント。compound + useYjsStore + 各種フックで構成。

- **ConnectHandles / ShapeConnectHandles**
  - draw.io 風の接続ハンドル。シェイプ同士を矢印（Arrow）で接続するための UI。

- **CRDT**
  - Conflict-free Replicated Data Type。分散環境で一貫性を保ちながら同期するデータ構造。Yjs の基盤。

- **CreatorLabel**
  - シェイプの左上に表示する作成者名ラベル。新しさに応じて色が変化。

---

## D

- **Discord OAuth**
  - 認証プロバイダ。Discord アカウントでログイン。

---

## F

- **FileIcon / file-icon**
  - 汎用ファイル用のフォールバックシェイプ。プレビュー不可な形式向け。

- **fresh（gachaboard-fresh）**
  - tldraw ベースの参照実装。compound への移行元。

---

## G

- **Gachaboard**
  - 本プロダクト名。メディア・ファイル共有特化のホワイトボード。

---

## H

- **useFileDropHandler**
  - ファイルドロップ時のアップロード・シェイプ配置を処理するカスタムフック。

---

## M

- **MinIO**
  - S3 互換のオブジェクトストレージ。ローカル運用で S3 と同じ API を利用可能。

---

## N

- **NextAuth**
  - Auth.js。Next.js 向け認証ライブラリ。Discord プロバイダを使用。

---

## P

- **persistenceKey**
  - compound のローカル永続化キー。Yjs 接続なし時に localStorage に保存。

- **Phase**
  - 開発フェーズ。Phase 1〜7 で機能を段階的に実装。

---

## S

- **Shape**
  - ボード上に配置する図形・オブジェクト。video-player, audio-player, text-file, file-icon など。

- **SmartHandTool**
  - 選択ツールを万能ハンドに変更。空白ドラッグでパン、brush モードでブラシ選択。

- **sync-server**
  - Yjs 用 WebSocket サーバ。y-websocket 同梱のサーバを利用。ルーム単位で Y.Doc をメモリ保持。

---

## T

- **Tailscale**
  - WireGuard ベースの P2P VPN。グローバル IP 不要で端末間接続。身内向け公開に使用。

- **TLRecord / TLStore**
  - compound/tldraw のレコード型・ストア。シェイプ・ページ・アセット等を保持。

- **tldraw**
  - 元のホワイトボードライブラリ。compound はそのフォーク。

---

## U

- **useYjsStore**
  - Y.Doc と TLStore を双方向バインドするカスタムフック。Yjs 同期の中心。

- **Workspace**
  - ボードをグループ化する単位。3〜4 プロジェクト想定。

---

## Y

- **Y.Doc / Yjs**
  - CRDT ベースの共同編集ライブラリ。Y.Doc がドキュメント、Y.Map 等で構造を保持。

- **y-websocket**
  - Yjs 用 WebSocket プロバイダ。クライアントと sync-server 間の通信に使用。
