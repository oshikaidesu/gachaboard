# Docker 経由セットアップ & ボード修正 TODO

## 1. Docker 経由で動かす

### 現状

`docker-compose.yml` には以下があるが、**nextjs サービスが含まれていない**。

- postgres (port 5433)
- sync-server (y-websocket, port 5858)
- minio (port 9000, 9001)
- minio-init (バケット作成)

→ 現状は nextjs をローカルで `npm run dev` し、DB/MinIO/sync だけ Docker で動かす構成。

### Docker 経由で nextjs も動かす場合

fresh の `docker-compose.yml` を参考に、nextjs サービスを追加する。

```yaml
# docker-compose.yml に追加
  nextjs:
    container_name: compound-nextjs
    build:
      context: ./nextjs-web
      dockerfile: Dockerfile
    working_dir: /app
    ports:
      - "3000:3000"
    volumes:
      - ./nextjs-web:/app
      - /app/node_modules
      - /app/.next
      - ./nextjs-web/uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      minio-init:
        condition: service_completed_successfully
    env_file:
      - nextjs-web/.env.local
    environment:
      DATABASE_URL: "postgresql://gachaboard:gachaboard@postgres:5432/gachaboard"
      NEXTAUTH_URL: "${NEXTAUTH_URL:-http://localhost:3000}"
      S3_ENDPOINT: "http://minio:9000"
      S3_PUBLIC_URL: "http://localhost:9000"
      NEXT_PUBLIC_SYNC_WS_URL: "ws://localhost:5858"
    command: >
      sh -c "
        npm install &&
        npx prisma generate &&
        npx prisma db push &&
        exec npm run dev -- --hostname 0.0.0.0 --port 3000
      "
```

**注意**: `sync-server` はコンテナ内の nextjs から `localhost:5858` で届かない。同一ネットワークなら `compound-sync:5858` で接続する必要がある。その場合、ブラウザは `http://localhost:3000` を開くので、`NEXT_PUBLIC_SYNC_WS_URL` は `ws://localhost:5858` のままでよい（nextjs がホストの 3000 を expose し、ブラウザは localhost 経由でアクセスするため、WebSocket も localhost:5858 で OK）。

### .env.local（Docker 用）

```env
# 認証（そのまま）
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# DB: Docker 内は postgres ホスト名
DATABASE_URL=postgresql://gachaboard:gachaboard@postgres:5432/gachaboard

# S3/MinIO: Docker 内は minio ホスト名
S3_BUCKET=my-bucket
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_PUBLIC_URL=http://localhost:9000

# 同期
NEXT_PUBLIC_SYNC_WS_URL=ws://localhost:5858
```

### 起動コマンド

```bash
docker compose up -d
# 初回は nextjs の起動に時間がかかる
docker compose logs -f nextjs
```

---

## 2. ボードでまだ修正が必要な部分

### 高優先度

| 項目 | 内容 |
|------|------|
| **shapeUtils 重複** | patch-package で Compound を修正済み。`npm install` 後は `postinstall` で自動適用。 |
| **S3 init 500** | S3UploadSession テーブルが無いと 500。`prisma db push` で解消。S3 未設定なら 503 で POST /api/assets にフォールバック。 |
| **S3_ENDPOINT** | ローカル実行時は `http://localhost:9000`、Docker 内は `http://minio:9000`。 |

### 中優先度

| 項目 | 内容 |
|------|------|
| **言語メッセージ** | `action.fit-frame-to-content`, `action.remove-frame` が ja で未定義。compound のデフォルト翻訳に追加するか、overrides で上書き。 |
| **リント** | 既存の errors/warnings（17 errors, 15 warnings）。WorkspacesClient の set-state-in-effect 等。 |
| **E2E** | `next dev` が既に動いていると e2e:server が起動できない。テスト前に dev を停止すること。 |

### 低優先度

| 項目 | 内容 |
|------|------|
| **Phase 7 コネクタ** | 固定・浮動アンカー、ルーティング、障害物回避、Waypoint 編集、Connector CRUD API。未実装。 |
| **GIF 対応** | Phase 5 の GIF が要確認。 |
| **SmartHandToolbar / CollaboratorCursorWithName** | スタブのままの可能性。 |

### 確認済み・動作しているもの

- カスタムシェイプ（FileIcon, TextFile, Audio, Video, WrappedImage/Note/Geo/Text/Arrow）
- ファイルドロップ・アップロード（useFileDropHandler, placeFile, placeholderShape）
- ConnectHandles, PreviewModal, handleRestoreAsset
- 6 つのフック（ArrowCascadeDelete, AutoCreatedBy, DoubleClickPreview, UrlPreviewAttacher, ShapeDeletePositionCapture, FileDropHandler）
- API 一式（assets, upload, reactions, comments, ogp）
- BoardReactionProvider, NativeShapeWrappers（CreatorLabel, OGP, ShapeReactionPanel）

---

## 3. 次のアクション

1. **Docker 経由**: 上記の nextjs サービスを `docker-compose.yml` に追加し、`docker compose up -d` で動作確認。
2. **ボード修正**: 言語メッセージ、リント を順に解消。
3. **E2E**: dev を停止してから `npm run test:e2e:smoke` を実行。
