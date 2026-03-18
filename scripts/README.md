# scripts ディレクトリ

## 環境変数（.env 統合）

- **正本**: `nextjs-web/.env.local`（Git に含まれない）
- **プロジェクトルート**: `.env` は nextjs-web/.env.local へのシンボリックリンク

`npm run setup:env` で自動作成。**clone 後は必ず実行**（.env は .gitignore のためリポジトリに含まれない）。

- **Mac/Linux**: `env.sh`（bash）+ `create-env-symlink.mjs`（Node）
- **Windows**: `env.ps1`（PowerShell）+ `create-env-symlink.mjs`（Node）

シンボリックリンクは Node.js で作成するため Mac/Windows 両対応。Windows で失敗時は管理者権限または開発者モードを有効化。

## 構成

```
scripts/
├── lib/          # 共通処理（Mac/Linux・直接実行しない）
│   ├── common.sh         # Docker 起動、ポート解放、ブラウザ起動など
│   └── sync-env-ports.sh # ポート変数から .env を自動同期
├── start/        # 起動スクリプト（Mac/Linux）
│   ├── launcher.sh      # 起動ランチャー（start.sh / start.command から呼ばれる）
│   ├── tailscale.sh     # Tailscale モード（--dev, --reset）
│   ├── local.sh         # ローカルモード（--dev, --reset）
│   └── production.sh    # 本番
├── setup/        # セットアップ（Mac/Linux）
│   ├── env.sh              # .env 統合（Mac/Linux）
│   ├── env.ps1             # .env 統合（Windows）
│   ├── create-env-symlink.mjs  # シンボリックリンク作成
│   ├── run-env-setup.mjs   # setup:env エントリポイント
│   └── tailscale-https.sh  # Tailscale HTTPS (Caddy)
├── win/          # Windows 起動スクリプト（start.bat から呼ばれる）
│   ├── run.ps1              # メイン起動（PostgreSQL/MinIO/sync-server + Next.js）
│   ├── reset-services.ps1   # 全サービス停止
│   ├── sync-env-tailscale.ps1  # Tailscale HTTPS 用 .env.local 更新
│   └── setup-auto-start.ps1    # ログオン時自動起動のタスク登録
└── systemd/      # 自動再起動用（Linux）
    └── gachaboard-web.service.example  # docs/user/AUTO-RESTART.md 参照
```

## 使い方

`npm run` から呼ばれる（package.json 参照）。直接実行する場合:

```bash
./start.sh                            # Mac/Linux 共通（launcher → tailscale）
bash scripts/start/tailscale.sh        # 直接呼び出し（ビルド済み起動）
bash scripts/start/tailscale.sh --dev  # 開発モード
bash scripts/start/tailscale.sh --reset
bash scripts/setup/env.sh
```

### Windows での起動

- **start.bat**（Windows）: ダブルクリックでメニュー表示。1=ローカル, 2=Tailscale, 3=リセット。
- **start.sh** / **start.command**（Mac/Linux）: 同一の `launcher.sh` を呼ぶ。Docker + Node.js 使用。

### 必須ツールの事前チェック

起動時に以下が未インストールの場合、その時点で停止しインストール方法を表示します。

- **共通**: Docker, Node.js, npm, curl
- **Tailscale モード**: 上記 + Tailscale

### Tailscale モード起動時

`tailscale.sh` 実行時に `setup/tailscale-https.sh` を自動実行し、Caddyfile を `.env`（正本は `.env.local`）のポートに合わせて更新します。Caddy は別途 `caddy run --config config/Caddyfile` で起動してください。
