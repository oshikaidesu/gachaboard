# Windows 起動（scripts/entry/start.bat）

**`scripts/entry/start.bat` をダブルクリック** → メニューでモードを選ぶだけで起動できます。Postgres / MinIO / sync-server は自動でセットアップされ、Next.js も続けて起動します。

---

## 事前準備（初回のみ）

### 1. Node.js のインストール

- [https://nodejs.org/](https://nodejs.org/) から LTS 版をダウンロード・インストール
- インストール後、コマンドプロンプトで `node -v` が表示されれば OK

### 2. Discord OAuth の設定

1. [Discord Developer Portal](https://discord.com/developers/applications) にログイン
2. **New Application** でアプリを作成
3. **OAuth2** → **Client ID** と **Client Secret** をコピー
4. **OAuth2** → **Redirects** に以下を追加:
   - ローカルのみ: `http://localhost:18580/api/auth/callback/discord`
   - Tailscale 利用時: `https://<あなたのTailscaleホスト>.ts.net/api/auth/callback/discord`

### 3. （任意）ffmpeg のインストール

動画・音声の変換に必要。インストールしなくても起動自体は可能ですが、動画や音声を扱う場合はインストールを推奨します。

- `winget install ffmpeg`
- または [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html) から手動インストール

---

## 起動手順

### 初回

1. プロジェクトをクローン: `git clone https://github.com/oshikaidesu/gachaboard.git`
2. **`scripts/entry/start.bat`** をダブルクリック → **1**（Tailscale 本番・既定）を選択
3. `.env.local` が無ければ自動で作成される
4. 表示される案内に従い、**nextjs-web\.env.local** を開いて以下を入力:
   - `DISCORD_CLIENT_ID` … Discord Developer Portal で取得
   - `DISCORD_CLIENT_SECRET` … 同上
   - `NEXTAUTH_SECRET` が空なら、`npm run setup:env` を実行して自動生成
5. 保存後、**`scripts/entry/start.bat`** → 1 を再度実行

### 2回目以降

**`scripts/entry/start.bat`** → **Enter**（既定は 1）または必要な番号を選ぶだけです。

- PostgreSQL / MinIO / sync-server は自動で起動（初回はダウンロードのため数分かかる場合があります）
- ブラウザで http://localhost:18580 が開きます

---

## 起動オプション

**`scripts/entry/start.bat`** をダブルクリックするとメニューが表示されます:

| 番号 | 説明 |
|------|------|
| 1 | Tailscale 本番（既定・Enter） |
| 2 | localhost 本番 |
| 3 | ビルドのみ |
| 4 | Tailscale 開発 |
| 5 | ローカル開発 |
| 6 | リセットして再起動 |
| 0 | 終了 |

---

## 自動で入るもの

上記メニューで 1 または 2 などを実行したとき、以下が自動で行われます:

| 項目 | 説明 |
|------|------|
| PostgreSQL | 未インストール時は portable 版をダウンロード（初回のみ） |
| MinIO | 未インストール時はダウンロード（初回のみ） |
| sync-server | nextjs-web/sync-server の npm install（初回のみ） |
| nextjs-web | npm install、prisma、ビルド（初回のみ） |
| .env.local | 無ければ .env.example から作成、NEXTAUTH_SECRET を自動生成 |

---

## トラブルシューティング

### Node.js not found

Node.js をインストールしてください: https://nodejs.org/

### Discord ログイン設定が未完了の場合

nextjs-web\.env.local を開き、DISCORD_CLIENT_ID と DISCORD_CLIENT_SECRET を入力してください。Discord Developer Portal の OAuth2 から取得できます。

### PostgreSQL startup timeout

ポート 18581 が他プロセスで使用されている可能性があります。メニュー **6**（Reset and restart）で全サービスを停止してから再実行してください。

### プロジェクトを移動した後に起動しない

フォルダを別の場所に移動した場合、PostgreSQL のデータパスが古いままになることがあります。

1. **メニュー 6（リセット）** を試す
2. それでもダメな場合は `data/postgres` フォルダを削除してから再起動（データは初期化されます）

### 動画アップロードで「Cannot find ffmpeg」

ffmpeg をインストールしてください: `winget install ffmpeg`

### 同期エラーが発生する

メニュー **6** を実行して sync データをリセットし、再起動してください。

---

## データの保存場所

すべて `gachaboard/data/` 以下に保存されます:

- `data/postgres` … PostgreSQL のデータ
- `data/minio` … アップロードファイル（S3）
- `data/sync` … リアルタイム同期の永続化データ

フォルダごと削除すれば完全リセットできます。

---

## Windows サインイン時の自動起動

PowerShell で以下を実行すると、サインイン時に **`scripts/entry/start.bat` 1**（Tailscale 本番）が最小化で自動実行されます。

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
.\scripts\win\setup-auto-start.ps1
```

無効化: タスクスケジューラで「Gachaboard-Start」を無効にする。
