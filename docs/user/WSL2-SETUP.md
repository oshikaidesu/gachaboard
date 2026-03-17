# WSL2 セットアップガイド（Windows）

Gachaboard は **Windows では WSL2 を前提**に動作します。WSL2 上で Mac と同じ Bash スクリプトがそのまま使えるため、シンボリックリンクやパス周りの問題を避けられます。

> **起動結果のまとめ**: [WSL2-RESULT.md](WSL2-RESULT.md)

---

## 1. WSL2 のインストール

### 新規インストール

1. **管理者 PowerShell** を開く
2. 以下を実行:
   ```powershell
   wsl --install -d Ubuntu
   ```
3. PC を再起動
4. 起動後、Ubuntu の初回セットアップ（ユーザー名・パスワード）を行う

### 既存の WSL をバージョン2に切り替え

```powershell
wsl --set-default-version 2
```

---

## 2. WSL2 を D ドライブに配置（任意）

C ドライブの容量を節約したい場合は、WSL2 のディストロを D ドライブに移動できます。

### 方法 A: wsl --manage --move（推奨）

```powershell
# 管理者 PowerShell
wsl --shutdown
wsl --manage Ubuntu --move D:\WSL\Ubuntu
wsl -d Ubuntu
```

### 方法 B: export / import（--move が使えない場合）

```powershell
wsl --shutdown
wsl --export Ubuntu D:\WSL\ubuntu-backup.tar
wsl --unregister Ubuntu
wsl --import Ubuntu D:\WSL\Ubuntu D:\WSL\ubuntu-backup.tar --version 2
del D:\WSL\ubuntu-backup.tar
```

---

## 3. プロジェクトのクローン（WSL2 内）

**重要**: プロジェクトは WSL2 の Linux ファイルシステム内（例: `~/gachaboard`）に置くことを推奨します。`/mnt/d/` 配下は I/O が遅く、`node_modules` や Docker で問題が出ることがあります。

```bash
# WSL2 のターミナルを開く（スタートメニューから Ubuntu 等を起動）
cd ~
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard
```

---

## 4. 初回セットアップ

```bash
# 環境変数ファイルを作成
cp .env.example .env
npm run setup:env

# .env.local を編集し、以下を入力:
# - DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET（Discord Developer Portal で取得）
# - NEXTAUTH_SECRET（未設定時は setup:env で自動生成）
# - SERVER_OWNER_DISCORD_ID（任意）

# 依存関係と DB スキーマ
cd nextjs-web && npm install --legacy-peer-deps && npx prisma generate && npx prisma db push && cd ..
```

---

## 5. 依存関係のインストール

### Node.js（nvm 推奨）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### Docker

**Docker Desktop は使いません。** WSL2 内で Docker Engine (docker.io) のみ使用します。

- `wsl2-install-deps.sh` で docker.io を自動インストール
- 手動: `sudo apt install -y docker.io && sudo usermod -aG docker $USER`

---

## 6. 起動

### 方法 A: start.bat をダブルクリック（プロジェクトが Windows パスにある場合）

プロジェクトが `D:\server\gachaboard` 等の Windows パスにある場合、エクスプローラーで `start.bat` をダブルクリックすると WSL2 が起動し、Tailscale モードで起動します。

### 方法 B: WSL2 ターミナルから起動（推奨）

```bash
cd ~/gachaboard
bash scripts/start/tailscale.sh
```

開発モードで起動する場合:
```bash
bash scripts/start/tailscale.sh --dev
```

### リモート／一発起動（パスワード入力なし）

初回の `wsl2-install-deps.sh` 実行時、`sudo` のパスワード入力が 1 回必要です。その後、`tailscale` に NOPASSWD を設定するため、以降はパスワード不要で起動できます。

**完全非対話**（リモートから初回も一発）にする場合、`.env` に Tailscale の Auth Key を設定:

1. https://login.tailscale.com/admin/settings/keys で **Reusable** キーを発行
2. `.env` に追加: `TAILSCALE_AUTH_KEY=tskey-auth-xxxxx`
3. 初回の依存関係インストール時に sudo パスワードが 1 回必要（NOPASSWD 設定のため）

---

## 7. データ保存先

データはプロジェクト直下の `./data` に保存されます。プロジェクトが `/mnt/d/` 等の Windows マウント上にある場合のみ、PostgreSQL の制限のため `~/gachaboard-data` に保存されます。

---

## トラブルシューティング

詰まりやすいポイントの詳細は [WSL2-HELP.md](WSL2-HELP.md) を参照。

### WSL が起動しない

- Windows の機能で「仮想マシンプラットフォーム」「Windows サブシステム for Linux」が有効か確認
- BIOS で仮想化（VT-x / AMD-V）が有効か確認

### Docker が動かない

- `sudo service docker start` で Docker デーモンを起動
- `sudo usermod -aG docker $USER` 実行後、WSL を再起動（`wsl --shutdown`）してグループを反映

### Tailscale が通らない

- WSL2 内で `tailscale status` を実行し、ログイン済みか確認
- `tailscale up` でログインしていない場合はブラウザが開くので認証する

### start.bat で「WSL2 がインストールされていません」と出る

- `wsl --install` を実行し、PC を再起動
- Windows を最新にアップデート
