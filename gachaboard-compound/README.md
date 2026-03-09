# Gachaboard (ガチャボード)

**「創る」を、もっと自由に。**
音楽・映像・デザインファイルを貼り付けて、リアルタイムで共同編集できる次世代ホワイトボード。

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![OGP](public/ogp.png)

---

## 🚀 Gachaboard とは？

Gachaboard は、Discord コミュニティやクリエイティブチームのための**共同編集ホワイトボード**です。
動画・音声・テキスト・画像をドラッグ＆ドロップで自由に配置し、複数人で同時にレビューやブレストを行えます。

### 💡 主な利用シーン
- **クリエイターのレビュー**: 動画や音声を貼り、タイムラインに直接コメント。
- **プロジェクト集約**: デザイン案、コード、素材を一つのボードにまとめて共有。
- **ブレインストーミング**: 画像やメモを並べて、リアルタイムでアイデアを形に。

### 🛠️ 設計の特徴
- **セルフホスト対応**: クラウド SaaS に依存せず、ローカルサーバー1台で完結。
- **身内限定の安心感**: Discord 認証により、信頼できるメンバーだけの空間を実現。
- **どこでもアクセス**: Tailscale 対応で、グローバル IP なしでもスマホや外出先から接続可能。

---

## ✨ できること

### 多彩なシェイプ
あらゆるクリエイティブ資産をボード上で扱えます。

| 動画 | 音声 | 画像 | テキスト | ファイル |
|:---:|:---:|:---:|:---:|:---:|
| ![動画](docs/images/shapes/shape-video.png) | ![音声](docs/images/shapes/shape-audio.png) | ![画像](docs/images/shapes/shape-image.png) | ![テキスト](docs/images/shapes/shape-text-file.png) | ![ファイル](docs/images/shapes/shape-file-icon.png) |
| 720p自動変換 | 波形表示 | ドラッグ配置 | コード補完 | アイコン表示 |

### 強力な機能
- **リアルタイム同期**: Yjs による超高速な共同編集。誰がどこを触っているか一目でわかるマルチカーソル。
- **タイムラインコメント**: 動画や音声の特定の時間にコメントを残せます。
- **リアクション**: シェイプに絵文字でクイックに反応。
- **スマート接続**: draw.io 風の接続線で、要素間の関係性を可視化。
- **ワークスペース管理**: プロジェクトごとにボードをグループ化。招待リンクで簡単メンバー追加。

---

## 📸 画面イメージ

| ボード編集画面 | ワークスペース一覧 |
|:---:|:---:|
| ![ボード](docs/images/03-board.png) | ![ワークスペース一覧](docs/images/04-workspaces.png) |

> [!TIP]
> スクリーンショットの再生成は `cd nextjs-web && npm run screenshots:all` で実行可能です。

---

## 🏁 はじめ方

Node.js 18+ と Docker があれば、数分で起動できます。

```bash
# リポジトリのクローン
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard-compound

# 環境設定
cp nextjs-web/env.local.template nextjs-web/.env.local
# .env.local を編集（Discord OAuth 情報などを入力）

# 起動
docker compose up -d
cd nextjs-web
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
npm run dev
```

ブラウザで `http://localhost:3000` を開き、Discord でログインしてください。

---

## 📚 ドキュメント

目的別に詳細なドキュメントを用意しています。

- **[ユーザーガイド (docs/user/)](docs/user/README.md)**
  - [セットアップ手順 (SETUP.md)](docs/user/SETUP.md)
  - [環境変数リファレンス](docs/user/ENV-REFERENCE.md)
  - [権限と招待の仕組み](docs/user/ownership-design.md)
- **[開発者ガイド (docs/dev/)](docs/dev/README.md)**
  - [全体像と引き継ぎ (HANDOVER.md)](docs/dev/HANDOVER.md)
  - [アーキテクチャ設計](docs/dev/ARCHITECTURE.md)
  - [同期システムの仕様](docs/dev/yjs-system-specification.md)

---

## 🛠️ 技術スタック

- **Frontend**: Next.js 16 (Turbopack), React 18
- **Whiteboard**: compound (tldraw engine)
- **Realtime**: Yjs, WebSocket
- **Auth**: NextAuth.js (Discord OAuth)
- **Database**: PostgreSQL (Prisma)
- **Storage**: S3 / MinIO

---

## ⚖️ ライセンス

Apache 2.0 License
(Based on compound / tldraw)
