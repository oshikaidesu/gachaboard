# 起動フロー

各プラットフォームで、どのスクリプトが何を呼び出して起動するかをまとめた。

---

## プラットフォーム別まとめ

| プラットフォーム | 起動方法 | Postgres / MinIO / sync-server | Next.js |
|------------------|----------|--------------------------------|---------|
| **Windows**      | `scripts/entry/start.bat` → `run.ps1` | `portable/scripts/start-services.ps1` | ホストで npm run start / dev |
| **Mac / Linux**  | `scripts/entry/start.sh` または `start.command` → `launcher.sh` | `portable/scripts/start-services.sh` | ホストで npm run start / dev |

**Windows** は run.ps1 が `portable\scripts\start-services.ps1` を呼び出す。Postgres は `pg_ctl` が見つからなければ `portable\bin` にダウンロードして起動する。MinIO も同様に `portable\bin\minio.exe` をダウンロードして起動する。sync-server は `nextjs-web\sync-server` で `node server.mjs` として起動する。run.ps1 は docker を参照しない。

**Mac/Linux** は tailscale.sh / local.sh が common.sh の `run_native_services` 関数経由で `portable/scripts/start-services.sh` を呼び出す。Postgres はシステムの `pg_ctl` を使う（なければインストール案内が出る）。MinIO はシステムにコマンドがなければ `portable/bin` に自動ダウンロードする（darwin-amd64 / darwin-arm64 / linux-amd64 / linux-arm64 対応）。common.sh の `check_required` は node / curl、Tailscale モード時は tailscale も確認する。

---

## Windows の起動の流れ

1. **`scripts/entry/start.bat`** → `scripts\win\run.ps1`（オプション: -Tailscale, -Dev, -BuildOnly）
2. **run.ps1 Step 1** で `portable\scripts\start-services.ps1` を実行
   - Postgres: `pg_ctl` がなければ `portable\bin` にダウンロード → `data/postgres` で initdb / pg_ctl start
   - MinIO: `minio.exe` がなければダウンロード → `data/minio` で起動
   - sync-server: `nextjs-web\sync-server` で `node server.mjs` を別プロセスとして起動（データは `data/sync`）
3. Step 2 で `pg_isready` が通るまで待機
4. Step 4 で `npx prisma generate` と `npx prisma migrate deploy`
5. Step 6 で `npm run start` または `npm run dev`

---

## Mac / Linux の起動の流れ

1. **`scripts/entry/start.sh`** または **`scripts/entry/start.command`** → **`scripts/start/launcher.sh`**
2. **launcher.sh** が条件に応じて分岐する
   - Node.js（npm）がない → インストール案内を表示して終了
   - node + npm + tailscale がある → モード選択（1: 本番 / 2: ビルドしてから本番 / 3: 開発）→ `scripts/start/tailscale.sh` を実行
   - node + npm はあるが tailscale がない → ローカルで起動するか確認 → `scripts/start/local.sh` を実行
3. **tailscale.sh** の流れ
   - `run_native_services` で Postgres / MinIO / sync-server を起動（`--reset` のときは先に `stop-services.sh` で停止）
   - `wait_for_postgres` でホストの `pg_isready` が通るまで待機
   - prisma / ビルド後に `npm run start` または `npm run dev`
4. **local.sh** も同じ流れ（tailscale 設定が不要なだけ）

---

## Dockerfile / docker-compose について

リポジトリに docker-compose.yml および Dockerfile は含まれない。Postgres / MinIO / sync-server は portable スクリプトで起動する。

---

## 更新履歴

- 2026-03: Mac/Linux の起動を portable/start-services.sh に変更。
- 2026-03: 初版。
