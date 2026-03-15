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
> スクリーンショットの再生成は `cd nextjs-web && npm run screenshots:all` で実行可能です。

---

## 🏁 Getting Started

Node.js 18+ と Docker があれば、数分で起動できます。

### 1. 準備 (Common Setup)

まずリポジトリをクローンし、依存サービスを立ち上げます。

```bash
# リポジトリのクローン
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard-compound

# 環境設定
cp nextjs-web/env.local.template nextjs-web/.env.local
# .env.local を編集（Discord OAuth 情報などを入力）

# 依存サービス（DB, MinIO, Sync Server）の起動
docker compose up -d

# パッケージのインストールとDBセットアップ
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
```

### 2. アプリケーションの起動

#### ワンコマンド起動（推奨）

env の切り替え + Docker + Next.js をまとめて起動します。

| モード | コマンド | 用途 |
|--------|----------|------|
| **Tailscale**（デフォルト） | `cd nextjs-web && npm run start:tailscale` | スマホ・他端末から Tailscale 経由でアクセス |
| **ローカル** | `cd nextjs-web && npm run start:local` | PC の localhost のみ（開発・一人用） |
| **リセット＆再起動** | `npm run start:tailscale:reset` / `start:local:reset` | Docker 停止 → 再起動（ポート競合・不調時） |

またはプロジェクトルートから:

```bash
bash scripts/start-tailscale.sh          # Tailscale モード（デフォルト）
bash scripts/start-tailscale.sh --reset  # リセット＆再起動
bash scripts/start-local.sh
bash scripts/start-local.sh --reset
```

Docker が起動していない場合はエラーメッセージで案内します。

Tailscale モードでは `brew install tailscale jq` が必要です。HTTPS は `npm run setup:tailscale-https` で自動セットアップ可能。詳細は [docs/user/TAILSCALE_HTTPS_SETUP.md](docs/user/TAILSCALE_HTTPS_SETUP.md)。

#### 🛠️ 開発モード (Development)

手動で env を切り替えて起動する場合:

```bash
cd nextjs-web
npm run env:tailscale   # または npm run env:local
npm run dev
```

**起動・DB の確認**（Docker / Next / MinIO / sync-server を一覧表示）:

```bash
npm run status
```

#### 🚀 本番モード (Production)

最適化されたビルドを作成して起動します。各プラットフォーム用の起動スクリプトを用意しています。

| プラットフォーム | コマンド |
|------------------|----------|
| Mac / Linux | `./scripts/start-production.sh` |
| Windows (PowerShell) | `.\scripts\start-production.ps1` |

または手動で:

```bash
npm run build
npm start
```

ブラウザで `http://localhost:3000` を開き、Discord でログインしてください。

### 3. プラットフォーム別サーバ起動手順

#### 🪟 Windows

1. **事前準備**: [Node.js](https://nodejs.org/) 18+、[Docker Desktop](https://www.docker.com/products/docker-desktop/)、[Git](https://git-scm.com/) をインストール
2. **PowerShell** または **コマンドプロンプト** を開く
3. 以下を実行:

```powershell
# リポジトリのクローン
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard-compound

# 環境設定（コピー）
copy nextjs-web\env.local.template nextjs-web\.env.local
# .env.local を編集（Discord OAuth 情報などを入力）

# 依存サービス（DB, MinIO, Sync Server）の起動
docker compose up -d

# パッケージのインストールとDBセットアップ
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
```

4. 開発モード: `npm run dev` / 本番モード: `.\scripts\start-production.ps1`

#### 🍎 Mac

1. **事前準備**: [Node.js](https://nodejs.org/) 18+、[Docker Desktop](https://www.docker.com/products/docker-desktop/) または Colima、[Homebrew](https://brew.sh/)（任意）
2. **ターミナル** を開く
3. 以下を実行:

```bash
# リポジトリのクローン
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard-compound

# 環境設定
cp nextjs-web/env.local.template nextjs-web/.env.local
# .env.local を編集（Discord OAuth 情報などを入力）

# 依存サービス（DB, MinIO, Sync Server）の起動
docker compose up -d

# パッケージのインストールとDBセットアップ
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
```

4. 開発モード: `npm run dev` / 本番モード: `./scripts/start-production.sh`

#### 🐧 Linux

1. **事前準備**: Node.js 18+、Docker、git をインストール（`apt install docker.io docker-compose-v2 git` 等）
2. 以下を実行:

```bash
# リポジトリのクローン
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard-compound

# 環境設定
cp nextjs-web/env.local.template nextjs-web/.env.local
# .env.local を編集（Discord OAuth 情報などを入力）

# 依存サービス（DB, MinIO, Sync Server）の起動
docker compose up -d

# パッケージのインストールとDBセットアップ
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
```

3. 開発モード: `npm run dev` / 本番モード: `./scripts/start-production.sh`

---

## 📚 Documentation

目的別に詳細なドキュメントを用意しています。

### 👤 [ユーザーガイド (docs/user/)](docs/user/README.md)

- [セットアップ手順 (SETUP.md)](docs/user/SETUP.md)
- [環境変数リファレンス](docs/user/ENV-REFERENCE.md)
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
