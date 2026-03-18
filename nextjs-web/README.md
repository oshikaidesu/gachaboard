# nextjs-web

<img src="public/icon.svg" alt="" width="24" height="24" style="vertical-align: middle;" />
Gachaboard のフロントエンド・API サーバー。

- **プロジェクト全体**: [../README.md](../README.md)
- **ドキュメント索引**: [../docs/README.md](../docs/README.md)
- **環境変数**: 親で `npm run setup:env`（統合 .env）または `cp env.local.template .env.local`

---

## ディレクトリ構成

```
nextjs-web/
├── src/
│   ├── app/
│   │   ├── api/              # API Routes
│   │   │   ├── assets/       # ファイルアップロード・取得・変換
│   │   │   ├── auth/         # NextAuth エンドポイント
│   │   │   ├── ogp/          # OGP プレビュー取得
│   │   │   └── workspaces/   # ワークスペース・ボード管理
│   │   ├── board/[boardId]/  # ボード画面
│   │   ├── workspace/        # ワークスペース詳細
│   │   ├── workspaces/       # ワークスペース一覧
│   │   ├── components/       # 共通コンポーネント
│   │   ├── hooks/            # カスタムフック
│   │   ├── shapes/           # カスタムシェイプ（common/, file/, media/）
│   │   └── tools/            # カスタムツール定義
│   ├── lib/
│   │   ├── auth.ts           # NextAuth 設定
│   │   ├── authz.ts          # 認可ヘルパー
│   │   ├── db.ts             # Prisma クライアント
│   │   ├── env.ts            # 環境変数バリデーション
│   │   ├── storage.ts        # ファイル保存・変換ユーティリティ
│   │   └── prismaHelpers.ts  # Prisma ユーティリティ
│   └── types/
│       └── next-auth.d.ts    # セッション型拡張
├── shared/
│   ├── apiTypes.ts           # API リクエスト/レスポンス型
│   ├── constants.ts          # ポーリング間隔などの定数
│   ├── shapeDefs.ts          # シェイプ定義（sync-server と共有）
│   └── utils.ts              # 共通ユーティリティ
├── sync-server/
│   └── (y-websocket-server)  # Yjs WebSocket サーバー（Hocuspocus + SQLite 永続化）
├── prisma/
│   └── schema.prisma         # DB スキーマ
├── uploads/                  # 変換用 tmp 等（Git管理外。アップロードは S3/MinIO）
│   ├── assets/               # 元ファイル
│   ├── converted/            # 変換済みファイル（mp3/mp4）
│   └── waveforms/            # 波形データ（JSON）
├── next.config.ts            # Next.js 設定
├── scripts/
│   └── switch-env.sh         # NEXTAUTH_URL を local/tailscale で切り替え
└── .env.local                # 環境変数（Git管理外）
```

---

## 主要な技術・依存関係

| 用途 | ライブラリ |
|---|---|
| フレームワーク | Next.js 16 (App Router) |
| ホワイトボード | compound (@cmpd/compound, @cmpd/editor) |
| 認証 | NextAuth (Auth.js) + Discord Provider |
| DB ORM | Prisma |
| 同期 | Yjs + y-websocket |
| sync-server | y-websocket-server（nextjs-web/sync-server 内） |
| メディア変換 | fluent-ffmpeg |
| スタイリング | Tailwind CSS |

---

## 作成者ラベル（CreatorLabel）の色表示

各シェイプの左上に表示される作成者名ラベルは、**個数ベース**で新しさを色で表現する。

| 順位 | 見た目 |
|------|--------|
| 1（最新） | 緑（エメラルド系） |
| 2〜9 | 緑→グレーへ徐々に変化 |
| 10 以降 | グレー（従来どおり） |

- **判定**: `meta.createdAt` で全シェイプをソートし、新しい順に rank を付与
- **時間ベースではない**: 何個目に作られたかで決まる（数日後見返しても相対的な新しさが分かる）
- **削除されたシェイプ**: store から消えるため、残りシェイプの rank は自動で更新される

---

## ワンコマンド起動（プロジェクトルートで）

依存サービス（PostgreSQL・MinIO・sync-server）の起動と Next.js をまとめて実行:

```bash
npm run start:tailscale   # Tailscale モード（デフォルト）
npm run start:local      # ローカルモード
npm run start:tailscale:reset   # リセット＆再起動
npm run start:local:reset
```

## 起動確認（手軽）

start スクリプトで起動したあと、DB 接続と各サービスをまとめて確認:

```bash
npm run status
```

PostgreSQL に繋がらない場合は終了コード 1 で終了します。

## 開発モードで Next.js だけ起動する場合

すでに `start.bat` / `start.sh` で依存サービスが起動しているときは、nextjs-web だけで:

```bash
cd nextjs-web
npm install
npx prisma db push   # 初回またはスキーマ変更時
npm run dev
```

依存サービスをまだ起動していない場合は、先にプロジェクトルートで `start.bat`（Windows）または `./start.sh`（Mac/Linux）を実行してください。

---

## 環境変数

`env.local.template` を参考に `.env.local` を作成する。

| 変数名 | 説明 |
|---|---|
| `DISCORD_CLIENT_ID` | Discord OAuth Client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth Client Secret |
| `NEXTAUTH_SECRET` | セッション暗号化キー |
| `NEXTAUTH_URL` | アクセス URL（ローカルは `http://localhost:18580`、Tailscale は `http://<あなたのTailscaleホスト>:3000`） |
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `NEXT_PUBLIC_SYNC_WS_URL` | sync-server の WebSocket URL（例: `ws://localhost:18582`） |
| `SERVER_OWNER_DISCORD_ID` | サーバーオーナーの Discord ID。未設定なら全員アクセス可。設定時はオーナーのみ WS にアクセス可。取得: 開発者モード ON → アイコン右クリック → ID をコピー |
| `UPLOAD_DIR` | （ffmpeg 変換用 tmp 等。アップロードは S3 経由） |

**環境変数の詳細**: [../docs/user/ENV-REFERENCE.md](../docs/user/ENV-REFERENCE.md) を参照。

**NEXTAUTH_URL の切り替え**: `npm run env:local` / `npm run env:tailscale`。Tailscale ホスト未指定時は自動検出を試みる。詳細は [../docs/user/ENV-AND-DEPLOYMENT-MODES.md](../docs/user/ENV-AND-DEPLOYMENT-MODES.md) を参照。

**ストレージ**: S3/MinIO が必須。`env.local.template` にデフォルト値あり。MinIO は start スクリプト実行時に自動で起動する。

**サーバーオーナー（運用）**: `SERVER_OWNER_DISCORD_ID` を設定すると、オーナー以外はワークスペースにアクセスできずトップへリダイレクト。Tailscale 運用でサーバー管理者 1 人をオーナーにする想定。詳細は [ownership-design.md](../docs/user/ownership-design.md)。
