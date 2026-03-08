# gachaboard-compound sync-server

Phase 3: Yjs + y-websocket によるマルチプレイヤー同期サーバー。

`y-websocket` パッケージに同梱の WebSocket サーバーを使用。
クライアントは `y-websocket` の `WebsocketProvider` で接続。

## 起動

```sh
npm install
PORT=5858 HOST=0.0.0.0 npm start
```

デフォルトポート: 5858（`PORT=5858` 指定時）

## クライアント統合

compound の TLStore と Y.Doc を双方向バインドするカスタムフックが必要。
store.serialize() / store.load() を利用して Y.Doc と同期する実装を検討。
