# Windows（WSL2）での起動結果まとめ

start.bat をダブルクリックするだけで起動できる状態になりました。

---

## 前提

- **Docker Desktop は使わない**。WSL2 内の Docker Engine (docker.io) のみ使用
- **Windows マウント**（`D:\server\gachaboard`）でも **WSL ホーム**（`~/gachaboard`）でも起動可能

---

## 起動フロー（start.bat 一発）

1. **start.bat** をダブルクリック
2. WSL2 が起動し、CRLF を LF に変換
3. **依存関係チェック** → 不足があれば `wsl2-install-deps.sh` を root で自動実行（sudo 不要）
4. **Tailscale** 未ログインなら `wsl -u root -e tailscale up` でログイン誘導
5. **Docker** 未起動なら `wsl -u root -e service docker start` で起動
6. **PostgreSQL / MinIO / sync-server** を起動
7. **Next.js** を起動
8. **Tailscale Serve** で HTTPS 化（`tailscale set --operator` を自動実行）
9. **ブラウザ** で URL を開く（WSL2 では `cmd.exe start` で Windows のブラウザを起動）

---

## 構成のポイント

| 項目 | 内容 |
|------|------|
| Docker | docker.io + docker-compose-v2（Docker Desktop 不要） |
| データ | プロジェクト直下 `./data`。`/mnt/d/` 上なら `D:\gachaboard-data` に自動切り替え |
| Tailscale | `wsl -u root` でパスワード不要。`tailscale set --operator` で Serve も root 不要 |
| ブラウザ | WSL2 では `cmd.exe /c start` で Windows のブラウザを起動 |

---

## 初回のみ必要な設定

- **`.env`** に Discord OAuth と Tailscale Auth Key（任意）を設定
- **リモート／非対話** にする場合は `TAILSCALE_AUTH_KEY` を設定

---

## トラブルシューティング

詳細は [WSL2-HELP.md](WSL2-HELP.md) を参照。

| 現象 | 対処 |
|------|------|
| Docker に接続できない | `sudo service docker start` |
| Tailscale ホスト名が取れない | `sudo tailscale up` でログイン |
| Tailscale Serve: Access denied | `tailscale set --operator=$USER` を自動実行済み。再起動で解消 |
| ブラウザが開かない | `https://ホスト名.tailxxx.ts.net` を手動で開く |
