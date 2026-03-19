# 更新手順

## アプリ（ランチャー）で起動している場合

1. [Releases](https://github.com/oshikaidesu/gachaboard/releases) から新しいバージョンの exe / dmg をダウンロード
2. 既存のプロジェクトフォルダ内の exe を新しいファイルで上書き（または置き換え）
3. `.env.local` や `data/` フォルダはそのまま保持されます。上書きする必要はありません

## ZIP で取得している場合

1. [Releases](https://github.com/oshikaidesu/gachaboard/releases) から新しい ZIP をダウンロード
2. 解凍して既存のフォルダに上書き。**`nextjs-web/.env.local` は上書きしないでください**（バックアップから戻すか、上書き時に除外する）
3. `data/` フォルダ（PostgreSQL や MinIO のデータ）も保持する必要がある場合は、上書き前にバックアップを取り、上書き後に戻す

## Git で clone している場合

```bash
git pull
npm install
```

必要に応じて `npm run setup:env` を実行してください。既存の `.env.local` はそのまま使えます。
