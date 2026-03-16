# 落ちたときに自動で再起動する

Next.js（Web アプリ）がクラッシュや OOM で落ちたときに**自動で再起動**させる方法です。

---

## 方法 1: Docker で一式動かす（推奨）

Next.js も Docker コンテナで動かす場合は、**すでに自動再起動が有効**です。

```bash
docker compose --profile app up -d
```

- `web` コンテナに `restart: unless-stopped` が設定されています。
- コンテナが落ちると Docker が自動で再起動します。
- PostgreSQL / MinIO / sync-server も同じく `restart: unless-stopped` です。

**何もしなくてよい**場合: すでに `docker compose --profile app up -d` で運用しているなら、そのままで大丈夫です。

---

## 方法 2: systemd で Next.js だけサービス化（Linux）

PostgreSQL / MinIO / sync-server は Docker、Next.js はホストで動かす構成で、**Next.js だけ落ちたときに自動再起動**させたい場合に使います。

### 手順

1. **サンプルユニットをコピーして編集**

   ```bash
   sudo cp scripts/systemd/gachaboard-web.service.example /etc/systemd/system/gachaboard-web.service
   sudo systemctl edit --full gachaboard-web
   ```

2. **次の項目を実際の環境に合わせて変更**

   - `User=` / `Group=` … 実行ユーザー（例: `deploy` や自分のユーザー名）
   - `WorkingDirectory=` … プロジェクト内の **nextjs-web** の絶対パス（例: `/home/deploy/gachaboard/nextjs-web`）
   - `EnvironmentFile=` … **nextjs-web/.env.local** の絶対パス（例: `-/home/deploy/gachaboard/nextjs-web/.env.local`）。先頭の `-` は「ファイルがなくても起動する」意味です。
   - `ExecStart=` で `npm` を使う場合、`/usr/bin/npm` が存在するか確認。nvm 利用時は `ExecStart=/home/deploy/.nvm/versions/node/v20.x.x/bin/npm run start` のようにフルパスを指定するか、`ExecStart=/bin/bash -c 'source ~/.nvm/nvm.sh && npm run start'` のように nvm を読み込んでから実行する。

3. **反映して有効化**

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable gachaboard-web
   sudo systemctl start gachaboard-web
   ```

4. **状態確認**

   ```bash
   sudo systemctl status gachaboard-web
   journalctl -u gachaboard-web -f
   ```

- **落ちたとき**: `Restart=on-failure` により、異常終了すると約 5 秒後に自動で再起動されます。
- **手動で止める**: `sudo systemctl stop gachaboard-web`
- **再起動**: `sudo systemctl restart gachaboard-web`

---

## 方法 3: PM2 で Next.js を常駐（Mac / Linux）

systemd が使えない環境（Mac や、権限のない Linux）では **PM2** でプロセス管理できます。

### 手順

1. **PM2 をインストール**

   ```bash
   npm install -g pm2
   ```

2. **nextjs-web で起動**

   ```bash
   cd nextjs-web
   pm2 start npm --name gachaboard-web -- run start
   ```

3. **落ちたときに自動再起動**

   - デフォルトでクラッシュ時に再起動されます。
   - 設定を保存: `pm2 save`
   - OS 起動時に PM2 を立ち上げる: `pm2 startup` の表示に従ってコマンドを実行する。

4. **操作**

   ```bash
   pm2 status
   pm2 logs gachaboard-web
   pm2 restart gachaboard-web
   pm2 stop gachaboard-web
   ```

---

## まとめ

| 方法 | 環境 | 自動再起動 |
|------|------|------------|
| Docker `web` コンテナ | どこでも | ✅ 最初から有効（`restart: unless-stopped`） |
| systemd | Linux（systemd あり） | ✅ ユニットを入れて enable すれば有効 |
| PM2 | Mac / Linux | ✅ デフォルトでクラッシュ時に再起動 |

**Docker で一式動かしている**なら追加の設定は不要です。**Next.js だけホストで動かしている**場合は、systemd または PM2 のどちらかを導入すると落ちたときに自動で再起動できます。

---

## 関連ドキュメント

- [24-7-OPERATION.md](24-7-OPERATION.md) - 24時間運用時の注意点
- [PRODUCTION-BUILD.md](PRODUCTION-BUILD.md) - 本番ビルドの作成
