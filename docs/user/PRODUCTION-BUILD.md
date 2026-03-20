# 本番ビルドの作成

`scripts/entry/start.command` や `npm start` で **ビルド済み**（本番モード）で起動するために、事前に本番ビルドを作成する手順です。

---

## いつ必要か

| 起動方法 | 本番ビルド |
|----------|------------|
| `npm run dev` / `scripts/entry/start.command`（開発モードで起動する場合） | 不要 |
| `npm start` / `scripts/entry/start.command`（本番モードで起動する場合） | **必要** |

`.next/` に **本番用のビルド成果物** がないと `npm start` は動きません。開発中は `next dev` のキャッシュだけが入っているため、本番起動前にビルドが必要です。

---

## 手順（ローカルで本番ビルドを作る）

**プロジェクトルート**で:

```bash
cd nextjs-web
npm run build
cd ..
```

- `npm run build` で Next.js の本番ビルドが実行され、`.next/` が本番用に上書きされます。
- 完了後、`scripts/entry/start.command` をダブルクリックするか `npm start` で本番モードで起動できます。

**初回および DB スキーマ変更後**は、ビルド前に Prisma の反映を推奨します。

```bash
cd nextjs-web
npx prisma generate
npx prisma migrate deploy   # 必要に応じて
npm run build
cd ..
```

---

## 関連

- [SETUP.md](SETUP.md) … 初回セットアップ
- [ENV-REFERENCE.md](ENV-REFERENCE.md) … 環境変数
