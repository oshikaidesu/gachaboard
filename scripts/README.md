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
├── lib/          # 共通処理（直接実行しない）
│   ├── common.sh         # Docker 起動、ポート解放、ブラウザ起動など
│   └── sync-env-ports.sh # ポート変数から .env を自動同期
├── start/        # 起動スクリプト
│   ├── launcher.sh      # 起動ランチャー（Mac/Windows 共用・モード選択）
│   ├── tailscale.sh     # Tailscale モード（--dev, --reset）
│   ├── local.sh         # ローカルモード（--dev, --reset）
│   └── production.sh    # 本番（Mac/Linux）
├── systemd/      # 自動再起動用（Linux）
│   └── gachaboard-web.service.example  # systemd ユニットの例（docs/user/AUTO-RESTART.md 参照）
└── setup/        # セットアップスクリプト
    ├── env.sh              # .env 統合（Mac/Linux）
    ├── env.ps1             # .env 統合（Windows）
    ├── create-env-symlink.mjs  # シンボリックリンク作成（Mac/Windows 共通）
    ├── run-env-setup.mjs   # setup:env エントリポイント
    └── tailscale-https.sh  # Tailscale HTTPS (Caddy)
```

## 使い方

`npm run` から呼ばれる（package.json 参照）。直接実行する場合:

```bash
bash scripts/start/tailscale.sh        # ビルド済み起動
bash scripts/start/tailscale.sh --dev  # 開発モード
bash scripts/start/tailscale.sh --reset
bash scripts/setup/env.sh
```

### Windows での起動

- **start.bat**（プロジェクトルート）: ダブルクリックで WSL2 を起動し、`launcher.sh` → `tailscale.sh` を実行。WSL2 が必須。

### 必須ツールの事前チェック

起動時に以下が未インストールの場合、その時点で停止しインストール方法を表示します。

- **共通**: Docker, Node.js, npm, curl
- **Tailscale モード**: 上記 + Tailscale

### Tailscale モード起動時

`tailscale.sh` 実行時に `setup/tailscale-https.sh` を自動実行し、Caddyfile を `.env`（正本は `.env.local`）のポートに合わせて更新します。Caddy は別途 `caddy run --config config/Caddyfile` で起動してください。
