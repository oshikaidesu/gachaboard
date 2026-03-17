# Windows（WSL2）ヘルプページ

start.bat で起動する際に詰まりやすいポイントと対処法をまとめています。

---

## クイックリファレンス

| 項目 | 内容 |
|------|------|
| **起動** | `start.bat` をダブルクリック |
| **リセット** | `start.bat --reset` |
| **開発モード** | `start.bat` → 3 を選択、または WSL ターミナルで `bash scripts/start/tailscale.sh --dev` |
| **データ** | プロジェクト直下 `./data`（`/mnt/d/` 上なら `D:\gachaboard-data`） |
| **Docker** | docker.io（Docker Desktop 不要） |

---

## 詰まりやすいポイントと対処

### 1. Tailscale Serve: Access denied

**現象**: `tailscale serve` 実行時に権限エラーが出る。

**原因**: Tailscale Serve は通常 root 権限が必要だが、一般ユーザーで起動している。

**対処**: `tailscale set --operator=$USER` を実行。start.bat 経由なら自動実行される。手動で解消する場合:

```bash
tailscale set --operator=$(whoami)
```

再起動後、再度 `start.bat` を実行。

---

### 2. Docker に接続できない / Docker Desktop が干渉する

**現象**: `docker ps` が失敗する、または Docker Desktop の設定が使われてしまう。

**原因**: 
- Docker デーモンが未起動
- Docker Desktop が入っていると、WSL2 内の docker.io より Desktop 側が優先される

**対処**:

```bash
# Docker デーモンを起動
sudo service docker start

# グループに追加済みなら sudo 不要（WSL 再起動後）
service docker start
```

スクリプトは WSL2 検出時に `DOCKER_CONFIG` を `.gachaboard/docker-wsl2` に設定し、`PATH` で `/usr/bin` を優先して docker.io を使う。Docker Desktop は起動していなくてよい。

---

### 3. sudo パスワードが入力できない

**現象**: CMD から start.bat を実行したとき、`sudo` でパスワード入力が求められるが入力できない。

**原因**: CMD 経由の WSL 起動では TTY がなく、対話的なパスワード入力ができない。

**対処**: スクリプトは `wsl -u root` で root として実行するため、パスワード不要。初回の `wsl2-install-deps.sh` 実行時のみ、WSL ターミナルを開いて手動で `sudo apt install ...` するか、事前に `wsl -u root` で依存関係をインストールしておく。

---

### 4. スクリプトが「command not found」などで失敗する

**現象**: `\r` や改行コードの違いで bash がエラーになる。

**原因**: Windows で編集したファイルが CRLF になっており、`\r` がコマンドの一部として解釈される。

**対処**: start.bat 実行時に `sed -i 's/\r$//'` で LF に変換してから実行。手動で直す場合:

```bash
sed -i 's/\r$//' scripts/start/tailscale.sh scripts/lib/common.sh
```

---

### 5. ブラウザが自動で開かない

**現象**: 起動完了後、ブラウザが開かない。

**原因**: WSL2 には `open` コマンドがない。

**対処**: スクリプトは `cmd.exe /c start` で Windows のブラウザを起動する。それでも開かない場合は、表示された URL（例: `https://xxx.tailxxx.ts.net`）を手動でブラウザに貼り付けて開く。

---

### 6. データ保存先の制限（PostgreSQL）

**現象**: プロジェクトが `/mnt/d/` 等の Windows マウント上にあると、PostgreSQL のデータディレクトリで問題が出ることがある。

**対処**: スクリプトは `/mnt/d/` 配下なら `D:\gachaboard-data`、それ以外の `/mnt/` なら `~/gachaboard-data` に自動切り替える。プロジェクトを WSL のホーム（例: `~/gachaboard`）に置くことも推奨。

---

### 7. 初回の依存関係インストール

**現象**: Node.js / Docker / Tailscale が未インストールで起動できない。

**対処**: start.bat 実行時に `check_required` が不足を検出し、`wsl -u root` で `wsl2-install-deps.sh` を自動実行。手動でインストールする場合:

```bash
# WSL ターミナルで
sudo bash scripts/setup/wsl2-install-deps.sh
```

---

### 8. Tailscale ホスト名が取れない

**現象**: `tailscale status` でホスト名が表示されない、または未ログイン。

**対処**:

```bash
sudo tailscale up
```

ブラウザが開いたら認証を完了する。リモート／非対話で起動したい場合は `.env` に `TAILSCALE_AUTH_KEY` を設定。

---

### 9. WSL2 がインストールされていない

**現象**: start.bat で「WSL2 is not installed」と表示される。

**対処**:

```powershell
# 管理者 PowerShell
wsl --install -d Ubuntu
```

実行後、PC を再起動。

---

## よく使うコマンド

| 目的 | コマンド |
|------|----------|
| 起動 | `start.bat` をダブルクリック |
| リセットして再起動 | `start.bat --reset` |
| 開発モード | `start.bat` → 3、または `bash scripts/start/tailscale.sh --dev` |
| 本番ビルド | `cd nextjs-web && npm run build && cd ..` の後 `npm start` |
| 状態確認 | `cd nextjs-web && npm run status` |
| Docker 起動 | `sudo service docker start` |
| Tailscale ログイン | `sudo tailscale up` |

---

## 問題点: vhdx の容量

WSL2 の仮想ディスク（ext4.vhdx）には次の挙動がある。

| 現象 | 説明 |
|------|------|
| **外側の枠は縮まない** | 中でファイルを削除しても、vhdx ファイルのサイズは自動では減らない。中身は空いても外側の枠はそのまま。 |
| **新データは空きに入る** | 削除したあとに新しいデータを入れると、その空いたスペースに収まる。枠が大きくなるのは「追加量が空きを超えたとき」だけ。 |
| **容量に余裕があれば問題なし** | 枠（vhdx）に十分な空きがあれば、圧縮しなくても運用できる。C ドライブが逼迫したときだけ圧縮を検討すればよい。 |

圧縮する場合:

```powershell
# 管理者 PowerShell（WSL 内の Gachaboard 等は停止する）
.\scripts\setup\wsl2-compact.ps1
```

---

## 関連ドキュメント

- [WSL2-SETUP.md](WSL2-SETUP.md) … セットアップ手順
- [WSL2-RESULT.md](WSL2-RESULT.md) … 起動フローと構成のまとめ
- [SETUP.md](SETUP.md) … Discord OAuth 等の共通セットアップ
