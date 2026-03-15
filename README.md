<div align="center">
  <img src="nextjs-web/public/ogp.png" alt="Gachaboard" width="100%">

<h1>
  <img src="nextjs-web/public/icon.svg" alt="" width="48" height="48" style="vertical-align: middle;" />
  Gachaboard
</h1>

<p>
    <strong>ホワイトボード + ファイルサーバのp2pシステム</strong><br>
    音楽・映像・デザインファイルを貼り付けて、リアルタイムで共同編集できる次世代ホワイトボード。
  </p>

<p>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js"></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React"></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript"></a>
    <a href="https://www.docker.com"><img src="https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker" alt="Docker"></a>
    <br>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-green?style=flat-square" alt="License"></a>
  </p>
</div>

---

## 🚀 Gachaboard とは？

Gachaboard は、Discord コミュニティやクリエイティブチームのための**共同編集ホワイトボード**です。
動画・音声・テキスト・画像をドラッグ＆ドロップで自由に配置し、複数人で同時にレビューやブレストを行えます。

### 💡 Why Gachaboard?

- **🎨 クリエイターファースト**: 動画や音声を貼り、タイムラインに直接コメント。レビューが加速します。
- **🔒 安心のプライベート空間**: Discord 認証により、信頼できるメンバーだけのクローズドな環境を実現。
- **🏠 セルフホストで完結**: クラウド SaaS に依存せず、ローカルサーバー1台でデータも管理も手元に。
- **📱 どこでもアクセス**: Tailscale 対応で、グローバル IP なしでもスマホや外出先から接続可能。

---

## ✨ Features

### 📦 多彩なメディア対応

あらゆるクリエイティブ資産をボード上で扱えます。

#### 🎬 動画

720pに自動変換され、ブラウザ上でスムーズに再生。タイムラインにコメントを残せます。

<img src="docs/images/shapes/shape-video.png" width="450" alt="動画">

#### 🎵 音声

波形が自動生成され、視覚的に分かりやすく。シーク再生も可能です。

<img src="docs/images/shapes/shape-audio.png" width="450" alt="音声">

#### 🖼️ 画像

ドラッグ＆ドロップで配置。リサイズやトリミングも自由自在。

<img src="docs/images/shapes/shape-image.png" width="300" alt="画像">

#### 📄 テキスト・ファイル

コードのシンタックスハイライトや、各種ファイルのアイコン表示・ダウンロードに対応。

<img src="docs/images/shapes/shape-text-file.png" width="300" alt="テキスト"> <img src="docs/images/shapes/shape-file-icon.png" width="100" alt="ファイル">

### ⚡️ Powerful Collaboration

- **リアルタイム同期**: Yjs による超高速な共同編集。誰がどこを触っているか一目でわかるマルチカーソル。
- **リアクション**: シェイプに絵文字でクイックに反応。
- **スマート接続**: draw.io 風の接続線で、要素間の関係性を可視化。
- **ワークスペース管理**: プロジェクトごとにボードをグループ化。招待リンクで簡単メンバー追加。

---

## 📸 Gallery

<div align="center">
  <h3>ボード編集画面</h3>
  <img src="docs/images/03-board.png" alt="ボード編集画面" width="80%">

<h3>ワークスペース一覧</h3>
  <img src="docs/images/04-workspaces.png" alt="ワークスペース一覧" width="80%">
</div>

> [!TIP]
> スクリーンショットの再生成は、`cd nextjs-web && npm run screenshots:all` で実行できます。

---

## 🏁 クイックスタート

**Docker のみ**（Node.js 不要）または **Docker + Node.js** で起動できます。

### 方法 A: Docker のみで起動（Node.js 不要・Immich 式）

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/oshikaidesu/gachaboard.git
   cd gachaboard
   ```

2. **環境変数の作成**
   ```bash
   cp .env.example .env
   ```
   `.env` を開き、`DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `NEXTAUTH_SECRET` を入力してください。

3. **起動**
   ```bash
   docker compose --profile app up -d
   ```
   または `npm run up`。ブラウザで `http://localhost:18580` を開いてください。

4. **停止**
   ```bash
   docker compose --profile app down
   ```
   または `npm run down`。

---

### 方法 B: Docker + Node.js（開発・Tailscale 対応）

### 1. セットアップ（初回のみ）

1. **リポジトリのクローン**（プロジェクトルートで作業）
   ```bash
   git clone https://github.com/oshikaidesu/gachaboard.git
   cd gachaboard
   ```
   リポジトリを親ディレクトリで管理している場合は、`cd Gachaboard` でプロジェクトルートに移動してください。

2. **環境変数の作成と設定**
   ```bash
   npm run setup:env
   ```
   `nextjs-web/.env.local` を開き、次の項目を入力・確認してください。
   - `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`（[Discord Developer Portal](https://discord.com/developers/applications) で取得）
   - `NEXTAUTH_SECRET`（未設定の場合は setup 実行時に自動生成されます）
   - `SERVER_OWNER_DISCORD_ID`（任意）

3. **初回のみ: 依存パッケージとデータベース**
   ```bash
   cd nextjs-web && npm install --legacy-peer-deps && npx prisma generate && npx prisma db push && cd ..
   ```

### 2. 起動

以上の手順でセットアップは完了です。起動方法は以下のとおりです。

| 方法 | 説明 |
|------|------|
| **Mac** | **`start.command` をダブルクリック**（Docker + Next.js をまとめて起動） |
| ターミナル（Mac/Windows） | `npm run dev` |
| ローカルのみ | `npm run dev:local` |
| 本番 | `cd nextjs-web && npm run build && cd ..` の後 `npm start` |

ブラウザで表示された URL（例: `http://localhost:18580`）を開き、Discord でログインしてください。

> **Discord Redirect**: Discord Developer Portal の Redirects に `http://localhost:18580/api/auth/callback/discord` を追加してください。詳細は [docs/user/SETUP.md](docs/user/SETUP.md) を参照してください。

---

### 起動コマンド一覧

| コマンド | 説明 |
|----------|------|
| **start.command**（Mac） | Docker のみ or Tailscale モード（環境に応じて自動切り替え） |
| `npm run up` | Docker 全コンテナ起動（Node.js 不要） |
| `npm run down` | Docker 全コンテナ停止 |
| `npm run dev` | 開発モード（Docker + ローカル Next.js） |
| `npm run dev:local` | 開発モード（localhost のみ） |
| `npm start` | ビルド済み起動（Tailscale） |
| `npm run start:local` | ビルド済み起動（localhost） |
| `npm run dev:tailscale:reset` | Docker リセット後に再起動 |

**本番ビルド**（`npm start` を使用する場合）: 事前に `cd nextjs-web && npm run build` を実行してください。詳細は [docs/user/PRODUCTION-BUILD.md](docs/user/PRODUCTION-BUILD.md) を参照してください。

Tailscale モードでは `brew install tailscale jq` が必要です。HTTPS のセットアップは `npm run setup:tailscale-https` で行えます。手順は [TAILSCALE_HTTPS_SETUP.md](docs/user/TAILSCALE_HTTPS_SETUP.md) を参照してください。

**起動確認**: `cd nextjs-web && npm run status` で Docker / DB / MinIO / sync-server の状態を確認できます。

### プラットフォーム別メモ

| プラットフォーム | 事前準備 | 備考 |
|------------------|----------|------|
| **Mac** | Node.js 18+、[Docker Desktop](https://www.docker.com/products/docker-desktop/) または Colima | `brew install tailscale jq`（Tailscale 利用時） |
| **Windows** | [Node.js](https://nodejs.org/)、[Docker Desktop](https://www.docker.com/products/docker-desktop/)、[Git](https://git-scm.com/) | `copy` を `cp` の代わりに使用 |
| **Linux** | `apt install docker.io docker-compose-v2 git nodejs npm` 等 | - |

詳細は [docs/user/SETUP.md](docs/user/SETUP.md) を参照してください。

---

## 📚 Documentation

目的別に詳細なドキュメントを用意しています。

### 👤 [ユーザーガイド (docs/user/)](docs/user/README.md)

- [セットアップ手順 (SETUP.md)](docs/user/SETUP.md)
- [環境変数リファレンス](docs/user/ENV-REFERENCE.md)（ポート変更含む）
- [権限と招待の仕組み](docs/user/ownership-design.md)

### 💻 [開発者ガイド (docs/dev/)](docs/dev/README.md)

- [全体像と引き継ぎ (HANDOVER.md)](docs/dev/HANDOVER.md)
- [アーキテクチャ設計](docs/dev/ARCHITECTURE.md)
- [同期システムの仕様](docs/dev/yjs-system-specification.md)

---

## 🛠️ Tech Stack


| Category       | Technology                                     |
| :--------------- | :----------------------------------------------- |
| **Frontend**   | Next.js 16 (Turbopack), React 18, Tailwind CSS |
| **Whiteboard** | compound (tldraw engine)                       |
| **Realtime**   | Yjs, WebSocket                                 |
| **Auth**       | NextAuth.js (Discord OAuth)                    |
| **Database**   | PostgreSQL (Prisma)                            |
| **Storage**    | S3 / MinIO                                     |

---

## ⚖️ License

Apache 2.0 License
(Based on compound / tldraw)
