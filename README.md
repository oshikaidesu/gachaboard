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

- **🎨 クリエイターファースト**: 動画や音声を貼り、タイムラインに直接コメント。レビューがスムーズになります。
- **🔒 安心のプライベート空間**: Discord 認証により、信頼できるメンバーだけのクローズドな環境を実現。
- **🏠 セルフホストで完結**: クラウド SaaS に依存せず、ローカルサーバー1台でデータの管理も手元で完結。
- **📱 どこでもアクセス**: Tailscale 対応で、グローバル IP なしでもスマホや外出先から接続可能。

---

## ✨ Features

### 📦 多彩なメディア対応

あらゆるクリエイティブ資産をボード上で管理・共有できます。

#### 🎬 動画

720pに自動変換されるため、ブラウザ上でスムーズに再生できます。タイムラインにコメントを残せます。

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

### アプリで起動（推奨）

[Releases](https://github.com/oshikaidesu/gachaboard/releases) から **Gachaboard 1.0.0.exe**（portable）をダウンロードし、プロジェクトフォルダに配置して **exe をダブルクリック**で起動。初回はウィザードで Discord Client ID / Client Secret / オーナー ID を入力するだけで起動できます。ターミナルは出さず、トレイに常駐します。

```bash
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard
# Releases から Gachaboard 1.0.0.exe をダウンロードし、このフォルダに置いて exe を実行
```

### 軽量版・開発者向け（start.bat / start.sh）

| OS | 起動方法 | 事前に必要なもの |
|:---|:---|:---|
| **Windows** | `start.bat` をダブルクリック | [Node.js](https://nodejs.org/) |
| **Mac** | `start.command` をダブルクリック | Node.js + [PostgreSQL](https://www.postgresql.org/) |
| **Linux** | `./start.sh` | Node.js + PostgreSQL |

PostgreSQL・MinIO・sync-server・npm install・DB スキーマ適用は起動スクリプトが自動で行います。初回起動時に `.env.local` が作成されるので、[Discord Developer Portal](https://discord.com/developers/applications) で取得した **Client ID** と **Client Secret** を入力してください。

詳しいセットアップ手順は [docs/user/SETUP.md](docs/user/SETUP.md) を参照。Windows の詳細は [WINDOWS-NATIVE-SETUP.md](docs/user/WINDOWS-NATIVE-SETUP.md) を参照。

### 友達を招待する

[Tailscale](https://tailscale.com/) を使えば、グローバル IP なしで他の端末からアクセスできます。参加者はブラウザでアクセスするだけです。

1. `start.bat` → 1（Tailscale、デフォルト）で起動
2. [Tailscale Admin Console](https://login.tailscale.com/admin/machines) であなたのマシンを「**Share**」
3. 参加者は Tailscale をインストール → 共有された URL を開く → Discord ログイン → 完了

詳細は [docs/user/INVITE-GUIDE.md](docs/user/INVITE-GUIDE.md) を参照。

---

## 📚 Documentation

目的別に詳細なドキュメントを用意しています。

### 👤 [ユーザーガイド (docs/user/)](docs/user/README.md)

- [セットアップ手順 (SETUP.md)](docs/user/SETUP.md)
- [Windows 起動（start.bat）](docs/user/WINDOWS-NATIVE-SETUP.md)
- [友達の招待方法 (INVITE-GUIDE.md)](docs/user/INVITE-GUIDE.md)
- [環境変数リファレンス](docs/user/ENV-REFERENCE.md)（ポート変更含む）
- [落ちたときに自動で再起動する](docs/user/AUTO-RESTART.md)（systemd / PM2）
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

- **セルフホスト前提**: 本アプリは、同一ネットワーク内（または Tailscale 等で限定したアクセス）の利用者を信頼する設計となっています。sync-server（WebSocket）には接続時の認証はなく、**ネットワークに到達できる全員が共同編集に参加可能**です。インターネット公開時はリバースプロキシでアクセス制限することを推奨します。
- **本番環境**: PostgreSQL / MinIO のデフォルト認証情報は開発用です。本番では必ず変更してください（PostgreSQL は `DATABASE_URL`、MinIO は `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`。詳細は [環境変数リファレンス](docs/user/ENV-REFERENCE.md) および [SECURITY.md](SECURITY.md) を参照）。
- 詳細は [SECURITY.md](SECURITY.md) を参照してください。

---

## 開発について

本プロジェクトでは、設計・実装・ドキュメント整備に **AI エージェント（LLM ベースのコーディング支援）** を利用しています。AIの出力を調整して取り込んでいる箇所があるため、内容の正確性は保証しません。個人の趣味で公開しているため、Issue や PR への対応はお約束できかねますが、指摘や議論は歓迎です。**コラボレーターとして参加して更新を手がけてくれる方がいれば、Issue で声をかけてもらえれば招待を検討します。**

---

## ⚖️ License

Apache 2.0 License
(Based on compound / tldraw)
