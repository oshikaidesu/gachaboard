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

**フォーク元**: ホワイトボードエンジンは [DallasCarraher/compound](https://github.com/DallasCarraher/compound)（tldraw の Apache 2.0 フォーク）をベースにしています。

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

### 最短の起動手順

```bash
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard
# Windows: start.bat → 1 を選択 → .env.local が自動作成 → Discord 認証を入力
# Mac/Linux: cp .env.example .env して編集 → start.sh / start.command
```

| OS | 起動 |
|:---|:---|
| **Windows** | **`start.bat`** をダブルクリック → 1（ローカル）または 2（Tailscale HTTPS） |
| **Mac** | `start.command` をダブルクリック |
| **Linux** | `./start.sh` または `bash start.sh` |

**Windows**: `start.bat` が唯一の入口。Node.js のみ・Docker 不要:
- **1** … ローカル（localhost）
- **2** … Tailscale HTTPS（他端末からアクセス可）
- **3** … リセットして再起動

起動完了後、ターミナルに表示される HTTPS URL と Discord Redirect URL をコピーして [Discord Developer Portal](https://discord.com/developers/applications) の OAuth2 → Redirects に登録してください。

### 友達を招待する（Tailscale 共有ノード）

Gachaboard は **Tailscale** を使って、グローバル IP なしで安全に公開します。参加者は `start.bat` を実行する必要はなく、ブラウザでアクセスするだけです。

1. [Tailscale Admin Console](https://login.tailscale.com/admin/machines) であなたのマシンを「**Share**」
2. 参加者は招待リンクから Tailscale に参加 → [Tailscale をインストール](https://tailscale.com/download) → ログイン
3. 共有された URL をブラウザで開く → Discord ログイン → 完了

詳細は [docs/user/SETUP.md](docs/user/SETUP.md) と [docs/user/INVITE-GUIDE.md](docs/user/INVITE-GUIDE.md) を参照。

---

### 初回セットアップで必要なこと

**Windows（start.bat）**:

| やること | 自動？ | 備考 |
|:---------|:------:|:-----|
| Node.js インストール | 手動 | [nodejs.org](https://nodejs.org/) |
| Discord OAuth 入力 | 手動 | `nextjs-web\.env.local` に 2 項目入力 |
| ffmpeg（動画変換用） | 任意 | `winget install ffmpeg` |
| Tailscale（2 を選ぶ場合） | 手動 | [tailscale.com/download](https://tailscale.com/download) |
| PostgreSQL・MinIO・sync-server | ✅ 自動 | 初回実行時にダウンロード |
| npm install・DB スキーマ | ✅ 自動 | 起動スクリプトが実行 |

**Mac / Linux**:

| やること | 自動？ | 備考 |
|:---------|:------:|:-----|
| Docker Desktop（Mac） / Docker（Linux） | 手動 | |
| Node.js 18+ | 手動 | |
| Tailscale 利用時 | 手動 | `brew install tailscale jq`（Mac）等 |
| `.env` 作成・Discord OAuth 入力 | 手動 | `cp .env.example .env` して 2 項目入力 |
| Tailscale HTTPS 有効化 | 手動 | [Admin Console](https://login.tailscale.com/admin/dns) で MagicDNS + HTTPS Certificates を ON |
| Discord Redirect URL 登録 | 手動 | 起動後にターミナルに表示される URL を登録 |
| npm install・DB スキーマ | ✅ 自動 | 起動スクリプトが実行 |

### 方法 A: Docker のみで起動（Node.js 不要）

Tailscale なし、localhost のみでよい場合:

```bash
cp .env.example .env
# .env を編集
docker compose --profile app up -d
# ブラウザで http://localhost:18580 を開く
```

停止: `docker compose --profile app down`

---

### 起動コマンド一覧

| コマンド | 説明 |
|----------|------|
| **start.bat**（Windows） | **メイン入口**。1=ローカル, 2=Tailscale, 3=リセット |
| **start.sh** / **start.command**（Mac/Linux） | Tailscale モードで起動（HTTPS） |
| `npm run dev` | 開発モード（Docker 依存サービス + ローカル Next.js） |
| `npm run dev:local` | 開発モード（localhost のみ） |
| `npm start` | ビルド済み起動（Tailscale） |
| `npm run reset:all` | **全データリセット**（DB / ストレージ削除） |
| `cd nextjs-web && npm run status` | Docker / DB / MinIO / sync-server の状態確認 |

**本番ビルド**: `cd nextjs-web && npm run build` の後 `npm start`。詳細は [docs/user/PRODUCTION-BUILD.md](docs/user/PRODUCTION-BUILD.md)。

### プラットフォーム別メモ

| プラットフォーム | 事前準備 | 備考 |
|------------------|----------|------|
| **Windows** | Node.js のみ | **start.bat** で Docker 不要に起動。詳細は [WINDOWS-NATIVE-SETUP.md](docs/user/WINDOWS-NATIVE-SETUP.md) |
| **Mac** | Docker Desktop + Node.js 18+ | Tailscale 利用時: `brew install tailscale jq` |
| **Linux** | Docker + Node.js + Tailscale | `apt install docker.io docker-compose-v2 nodejs npm` 等 |

詳細は [docs/user/SETUP.md](docs/user/SETUP.md) を参照してください。

---

## 📚 Documentation

目的別に詳細なドキュメントを用意しています。

### 👤 [ユーザーガイド (docs/user/)](docs/user/README.md)

- [セットアップ手順 (SETUP.md)](docs/user/SETUP.md)
- [Windows 起動（start.bat）](docs/user/WINDOWS-NATIVE-SETUP.md)
- [友達の招待方法 (INVITE-GUIDE.md)](docs/user/INVITE-GUIDE.md)
- [環境変数リファレンス](docs/user/ENV-REFERENCE.md)（ポート変更含む）
- [落ちたときに自動で再起動する](docs/user/AUTO-RESTART.md)（Docker / systemd / PM2）
- [24時間運用時の注意点](docs/user/24-7-OPERATION.md)（常時稼働・バックアップ・監視）
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

> **Note:** ホワイトボードエンジンには [compound](https://github.com/tldraw/compound)（tldraw 系）の **alpha 版** を使用しています。API の安定性は開発状況に依存します。

---

## 🔒 セキュリティ・制限について

- **セルフホスト前提**: 本アプリは同一ネットワーク（または Tailscale 等で限定したアクセス）を信頼する設計です。sync-server（WebSocket）には接続時の認証はなく、**ネットワークに到達できる全員が共同編集に参加可能**です。インターネット公開時はリバースプロキシでアクセス制限することを推奨します。
- **本番環境**: Docker の PostgreSQL / MinIO のデフォルト認証情報は開発用です。本番では必ず変更してください（PostgreSQL は `DATABASE_URL`、MinIO は `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`。詳細は [環境変数リファレンス](docs/user/ENV-REFERENCE.md) および [SECURITY.md](SECURITY.md) を参照）。
- 詳細は [SECURITY.md](SECURITY.md) を参照してください。

---

## 開発について

本プロジェクトでは、設計・実装・ドキュメント整備に **AI エージェント（LLM ベースのコーディング支援）** を利用しています。AI の出力を編集のうえ取り込んでいる場合があり、内容の正確性は保証しません。個人の趣味で公開しているため、Issue や PR への対応はお約束できかねますが、指摘や議論は歓迎です。**コラボレーターとして参加して更新を手がけてくれる方がいれば、Issue で声をかけてもらえれば招待を検討します。**

---

## ⚖️ License

Apache 2.0 License
(Based on compound / tldraw)
