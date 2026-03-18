# 実際の起動フロー（コードベース準拠）

スクリプトを追い、**どの入口がどのスクリプトを呼び、どの方式で Postgres / MinIO / sync-server が起動するか**を記載する。

---

## 結論（プラットフォーム別）

| プラットフォーム | 入口 | Postgres / MinIO / sync-server の起動 | Next.js の起動 |
|------------------|------|----------------------------------------|----------------|
| **Windows**      | start.bat → run.ps1 | portable/scripts/start-services.ps1（ネイティブ） | ホストで npm run start / dev |
| **Mac / Linux**  | start.sh → launcher.sh | portable/scripts/start-services.sh（ネイティブ） | ホストで npm run start / dev |

- Windows: run.ps1 が `portable\scripts\start-services.ps1` を呼ぶ。Postgres は `pg_ctl` が無ければ `portable\bin` にダウンロード。MinIO は `portable\bin\minio.exe`。sync-server は `nextjs-web\sync-server` で `node server.mjs`。run.ps1 は docker を参照しない。
- Mac/Linux: tailscale.sh / local.sh が `run_native_services` 経由で `portable/scripts/start-services.sh` を呼ぶ。Postgres はシステムの `pg_ctl` を使用（無ければインストール案内）。MinIO は未入りなら `portable/bin` にダウンロード（darwin-amd64 / darwin-arm64 / linux-amd64 / linux-arm64）。common.sh の `check_required` は node / curl（Tailscale モード時は tailscale）をチェックする。docker はチェックしない。

---

## Windows の経路

1. **start.bat** → `scripts\win\run.ps1`（オプション: -Tailscale, -Dev, -BuildOnly）
2. **run.ps1** の「Step 1」で **`portable\scripts\start-services.ps1`** を実行
   - Postgres: システムに `pg_ctl` が無ければ `portable\bin` に PostgreSQL をダウンロードして展開。`data/postgres` で initdb / pg_ctl start。
   - MinIO: `portable\bin\minio.exe` が無ければダウンロード。`data/minio` でサーバー起動。
   - sync-server: `nextjs-web\sync-server` で `node server.mjs` を別プロセスで起動。データは `data/sync`。
3. Step 2 で pg_isready で Postgres 待機。
4. Step 4 で nextjs-web で `npx prisma generate` / `npx prisma db push`。
5. Step 6 で nextjs-web で `npm run start` または `npm run dev`。

---

## Mac / Linux の経路

1. **start.sh** または **start.command** → **scripts/start/launcher.sh**
2. **launcher.sh**:
   - Node.js（npm）が無い → メッセージ表示のうえ終了。docker が利用可能な場合は `docker compose --profile app up -d` の案内を表示。
   - node + npm あり + tailscale あり → モード選択（1: 本番 / 2: ビルド再生成して本番 / 3: 開発）後 **scripts/start/tailscale.sh** に exec。
   - node + npm あり + tailscale なし → ローカル起動するか確認し、y なら **scripts/start/local.sh** に exec。
3. **tailscale.sh**（Tailscale モード）:
   - **run_native_services**（common.sh）→ **portable/scripts/start-services.sh** で Postgres / MinIO / sync-server を起動。`--reset` 時は **reset_native_services** → **portable/scripts/stop-services.sh** で停止してから起動。
   - **wait_for_postgres** → ホストの `pg_isready` で待機。Docker コンテナ compound-postgres が稼働している場合は docker exec でも判定可能。
   - nextjs-web で prisma / build 後、ホストで `npm run start` または `npm run dev`。
4. **local.sh**（ローカルモード）も同様: run_native_services → wait_for_postgres → ホストで Next.js。

---

## Docker 設定ファイル

- リポジトリに docker-compose.yml および Dockerfile は含まれない。postgres / minio / sync-server は **portable スクリプト**で起動する。

---

## 更新履歴

- 2025-03: 記述を客観的事実に限定（主観表現を削除）。
- 2025-03: Mac/Linux の起動を portable/start-services.sh に変更。
- 2025-03: 初版。
