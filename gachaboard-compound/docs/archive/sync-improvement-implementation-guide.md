# 同期改善 実装手順・考慮点

> **実装状況**: オプション C（per-record Y.Map）を採用済み。旧 STORE_KEY 形式は削除済み。

## 1. 背景・課題

### 現状（実装済み）

- **シェイプ同期**: per-record Y.Map + `store.put` / `store.remove` で双方向同期
- **スムーズさ**: FPS スロットルで送信、RAF で受信適用

### 技術比較（tldraw vs gachaboard-compound）

| 項目 | tldraw sync | gachaboard-compound（現状） |
|------|-------------|----------------------------|
| データ形式 | RecordsDiff（added / updated / removed） | per-record（各レコード ID をキーに Y.Map） |
| 送信タイミング | FPS スロットル、差分のみ | FPS スロットル、差分のみ |
| 受信時の適用 | `store.put` / `store.remove` で差分適用 | `store.put` / `store.remove` で差分適用 |
| 初回以降のリモート適用 | 継続的に適用 | 継続的に適用 |
| カメラ・instance 状態 | scope 分離 | scope 分離（document のみ Y.Doc） |

**過去の課題（解消済み）**: 旧実装では `loadSnapshot` による全置換がカメラフリーズを引き起こしたため、`initialSyncDone` で初回以降をスキップしていた。現行は put/remove で差分適用し、カメラを保持。

---

## 2. リバースエンジニアリングで確認すべき点

### tldraw リポジトリの調査対象

| パス | 内容 |
|------|------|
| `packages/sync-core/src/lib/TLSyncClient.ts` | クライアント側同期エンジン。push/pull/rebase モデル。`store` + `socket` + `presence` で初期化 |
| `packages/sync-core/src/lib/*` | メッセージ形式、差分の送受信。`ClientWebSocketAdapter` が WebSocket を抽象化 |
| `packages/store/src/lib/RecordsDiff.ts` | RecordsDiff 型定義（added / updated / removed） |
| `packages/sync` | サーバー側、WebSocket アダプター。`TLPersistentClientSocket` インターフェース |
| `packages/store` の `listen` | `store.listen` で `source: "user"` の変更を購読し、RecordsDiff を取得 |

**TLSyncClient の動作概要**（[公式ドキュメント](https://tldraw.dev/reference/sync-core/TLSyncClient)）:

- **Push**: ローカル変更を RecordsDiff としてサーバーに送信
- **Pull**: サーバーから受信した差分を `store.put` / `store.remove` で適用
- **Rebase**: 競合時はローカルを一旦巻き戻し、サーバー差分を適用後、ローカルを再適用

### RecordsDiff の扱い

```ts
// RecordsDiff の構造（tldraw 公式）
interface RecordsDiff<R> {
  added: Record<IdOf<R>, R>;
  updated: Record<IdOf<R>, [from: R, to: R]>;
  removed: Record<IdOf<R>, R>;
}
```

- **added**: 新規作成されたレコード（ID をキー）
- **updated**: 変更されたレコード（[旧, 新] のタプル）
- **removed**: 削除されたレコード

### store.listen の差分取得方法

`@cmpd/store`（compound）の `listen` API:

```ts
store.listen(
  (entry) => {
    // entry.changes: { added, updated, removed }
    // entry.source: "user" | "remote"
  },
  { source: "user", scope: "document" }
);
```

- **source**: `"user"` = ローカル操作、`"remote"` = リモート適用
- **scope**: `"document"` = シェイプ等、`"session"` = instance 系、`"presence"` = プレゼンス

`listen` のコールバックには `{ changes, source }` が渡される。`changes` は RecordsDiff 形式。

### サーバー ↔ クライアントのメッセージ形式

- **tldraw sync**: 独自プロトコル。RecordsDiff をシリアライズして送受信
- **gachaboard（y-websocket）**: Y.Doc の更新（Y.Update）をそのまま送受信。**現状**: per-record 形式（各レコード ID をキーに `yMap.set(recordId, JSON.stringify(record))`）

---

## 3. 実装手順（オプション A: リモート適用の復活）

**方針**: `loadSnapshot` を使わず、`store.put` / `store.remove` で差分のみ適用する。これにより `initialSyncDone` 以降もリモート変更を継続的に受け入れられる。

### Phase 1: handleYUpdate でリモート変更を継続的に受け取る

**対象ファイル**: `nextjs-web/src/app/hooks/useYjsStore.ts`

- 163–166 行目: `initialSyncDone` による早期 return を削除
- 現状の `handleYUpdate` は `yMap.get(STORE_KEY)` でフル JSON を取得しているため、差分として解釈するには Phase 2 の送信側変更と連動する必要がある

### Phase 2: loadSnapshot を使わず store.put / store.remove で差分適用

**初回接続時**:

- Y.Map から取得した JSON をパースし、`StoreSnapshot` として解釈
- `store.mergeRemoteChanges(() => { store.put(Object.values(snapshot.store)); })` で適用
- 既存レコードとの重複は `store.put` が upsert 的に扱うため、初回は問題なし

**継続的な更新時**:

- 現状の Yjs は「フル JSON の上書き」なので、**差分**を送るように送信側を変えない限り、受信側で「前回値との diff」を自前計算する必要がある
- または、オプション C に移行して Y.Doc 側で差分を管理する

### Phase 3: カメラ・instance 状態がリセットされないよう scope を分離

**対象**: `store.listen` の filters、`persistToY` の対象

- `store.listen` に `scope: "document"` を指定し、シェイプ・ページ・アセット等のドキュメントスコープのみを Y.Doc に送信
- カメラ・instance_page_state は `scope: "session"`。instance_presence は Awareness で別管理（`AwarenessSync.tsx` 参照）のため Y.Doc に含めない
- これにより、リモート適用時にカメラ等が上書きされない

### Phase 4: フリーズ対策（適用タイミング・バッチング）

**参考**: `useYjsStore.ts` 54–56 行目、172 行目で `store.mergeRemoteChanges` を使用

- `handleYUpdate` 内で `store.mergeRemoteChanges(() => { ... })` を使い、`source: "remote"` として適用（`@cmpd/store` は `isMergingRemoteChanges` フラグで自動判定）
- 複数の Y.Update が短時間に連続した場合、デバウンスまたは `requestAnimationFrame` でバッチングし、1 フレームに 1 回の適用に抑える

---

## 4. 実装手順（オプション C: Yjs を活かした差分ベース）

**方針**: 送信側で RecordsDiff を取得し、Y.Doc に差分のみを書き込む。受信側は Y.Doc の observe で差分のみを受け取り、`store.put` / `store.remove` で適用する。

### Phase 1: store.listen で RecordsDiff を取得

**対象ファイル**: `nextjs-web/src/app/hooks/useYjsStore.ts`

現在 220 行目で `store.listen(persistToY, { source: "user" })` を使用。`scope: "document"` を追加し、コールバックで `entry.changes`（RecordsDiff）を取得する。

```ts
store.listen(
  (entry) => {
    const { changes, source } = entry;
    if (source !== "user") return;
    // changes: { added, updated, removed }
    // これを Y.Doc に書き込む
  },
  { source: "user", scope: "document" }
);
```

### Phase 2: 差分のみを Y.Doc に書き込む

**対象ファイル**: `nextjs-web/src/app/hooks/useYjsStore.ts` の `persistToY`（199–218 行目付近）

**方式 A: Y.Map の部分更新**

- **実装済み**: 各レコード ID をキーとして `yMap.set(recordId, JSON.stringify(record))` で個別に保存
- 削除時: `yMap.delete(recordId)`
- Yjs が自動的に差分（Y.Update）として送信するため、ネットワーク効率が向上

**方式 B: 別キーで差分キューを管理**

- `STORE_DIFF_KEY` のようなキーに、直近の RecordsDiff を append する
- 受信側でキューを消費し、適用後にクリア（競合・順序の管理が複雑になりやすい）

**推奨**: 方式 A。シンプルで Yjs の CRDT をそのまま活用できる。

### Phase 3: Y.Doc の observe で受信側は差分のみ適用

Y.MapEvent の構造（[Yjs Y.Map ドキュメント](https://docs.yjs.dev/api/shared-types/y.map)）:

- `event.changes.keys`: `Map<string, { action: 'add'|'update'|'delete', oldValue: any }>`
- `action === 'delete'`: `yMap.get(key)` は undefined、`change.oldValue` に旧値
- `action === 'add'` / `'update'`: `yMap.get(key)` に新値

```ts
yMap.observe((event) => {
  if (isLocalUpdateRef.current) return;
  event.changes.keys.forEach((change, key) => {
    if (change.action === "delete") {
      store.mergeRemoteChanges(() => store.remove([key]));
    } else {
      const raw = yMap.get(key);
      const record = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (record && typeof record === "object") {
        store.mergeRemoteChanges(() => store.put([record]));
      }
    }
  });
});
```

- 初回接続時は、Y.Map の全エントリを走査して `store.put` で適用
- 以降は observe の差分のみを適用

### Phase 4: デバウンス → FPS スロットル

**実装済み**: `requestAnimationFrame` で 1 フレームに 1 回まで送信に制限。ドラッグ中のスムーズな同期を実現。

---

## 5. 考慮点・落とし穴（詳細版）

**要約**: オプション C（Yjs 差分ベース）をベストとする。段階的アプローチで、まずオプション A で「同期しない」を解消し、続けて C でスムーズさと効率を向上させる。

---

### 5.1 推奨アプローチの決定基準

| 観点 | オプション A（リモート適用の復活） | オプション C（Yjs 差分ベース） | 優位 |
|------|----------------------------------|-------------------------------|------|
| 実装工数 | 小（主に受信側の変更） | 中（送受信両方の変更） | A |
| ネットワーク効率 | 低（フルスナップショットのまま） | 高（差分のみ送信） | C |
| スムーズさ | 中（適用は差分だが送信は重い） | 高（送受信とも軽量） | C |
| 既存ルームとの互換 | 高い | 移行ロジックが必要 | A |
| 将来の拡張性 | 限定的 | スケールしやすい | C |

**結論**: **オプション C を採用するのがベスト**。オプション A は「まず動かす」ための暫定策として有効だが、長期的には C への移行を前提に進める。

**段階的アプローチ**:
1. **Phase 0（即時）**: オプション A の Phase 1–2 で、`loadSnapshot` → `store.put` に変更し、`initialSyncDone` の早期 return を削除。これだけで「シェイプが同期しない」は解消可能（送信はフルスナップショットのまま）
2. **Phase 1（短期）**: オプション C の Phase 1–3 を実装。per-record Y.Map に移行
3. **Phase 2（中期）**: デバウンス → FPS スロットル（Phase 4）でスムーズさを向上

---

### 5.2 scope 分離（ベストプラクティス）

| scope | 含まれる typeName 例 | Y.Doc に含める？ | 理由 |
|-------|---------------------|------------------|------|
| **document** | shape, page, asset, document | ✅ はい | 永続化・共有対象。同期の本質 |
| **session** | instance, instance_page_state, camera | ❌ いいえ | クライアント固有。共有すると他者のカメラで上書きされる |
| **presence** | instance_presence | ❌ いいえ | Awareness で別管理済み |

**実装時の注意**:
- `store.listen` に `scope: "document"` を指定すれば、session / presence は自動的に除外される
- カメラ位置は `restoreCameraFromLS` でローカル復元。Y.Doc には書き込まない
- `@cmpd/tlschema` の各型定義で `scope` が決まっている。compound のスキーマを確認して document に含まれる型を把握すること

---

### 5.3 競合時の挙動（詳細）

**シナリオ 1: 同一シェイプを A と B が同時に編集**

- **Yjs**: 同じキー（recordId）への `set` は CRDT でマージ。ただし値は JSON なので「最後の書き込み」が残る（Yjs は値のマージは行わず、キー単位で競合解決）
- **推奨**: フィールド単位の CRDT は複雑なため、現状は「最後にサーバーに届いた値が勝つ」で許容。tldraw も同様のモデル
- **エッジケース**: ドラッグ中に他者が削除した場合 → `store.remove` が先に適用されれば、自クライアントの `put` は無視される（ID が存在しないため）。問題なし

**シナリオ 2: オフライン中の編集 → 再接続**

- **Yjs**: オフライン中の変更はローカル Y.Doc に蓄積。再接続時にサーバーと自動マージ
- **注意**: 長時間オフラインだとマージ結果が予測しづらい。可能なら「オフライン時は編集不可」の UX を検討

**シナリオ 3: 初回接続時に他者が大量に編集済み**

- **per-record 形式**: Y.Map の全エントリを `store.put` で一括適用。`mergeRemoteChanges` 内で 1 トランザクションにまとめる
- **パフォーマンス**: 1000 シェイプ程度なら問題なし。5000 以上は `requestIdleCallback` で分割適用を検討

---

### 5.4 初回接続時のフルスナップショット vs 差分のみ

| 方式 | 実装 | メリット | デメリット |
|------|------|----------|------------|
| **フルスキャン** | `yMap.forEach` で全エントリを `store.put` | シンプル、observe の前に確実に適用 | 大規模ドキュメントで初回が重い |
| **observe のみ** | observe の差分だけ適用 | 軽量 | 接続前に存在したデータが取れない（observe は変更のみ） |

**実装済み**: **フルスキャン + observe** の併用。
1. 接続直後に `yMap.forEach` で全レコードをフルスキャンして初期適用
2. 以降は observe で差分のみ適用

---

### 5.5 サーバー側（y-websocket）の変更要否

| 変更内容 | 要否 | 理由 |
|----------|------|------|
| プロトコル | 不要 | Y.Update の形式はクライアントの Y.Map の使い方に依存しない |
| ポート・ルーム管理 | 既存のまま | 変更不要 |
| 永続化（LevelDB 等） | 任意 | y-websocket-server はメモリのみ。再起動でデータ消失。永続化する場合は別途検討 |

---

### 5.6 パフォーマンス（実装済み・ベストプラクティス）

| 指標 | 実装済み |
|------|----------|
| 送信間隔 | 16ms（60fps）RAF スロットル |
| 1 回の送信サイズ | 差分のみ（変更レコードのみ） |
| 受信時の適用 | 毎回、RAF で 1 フレーム内に完了 |

**ベストプラクティス**:
- `mergeRemoteChanges` 内の `store.put` / `store.remove` は同期的に実行。複数レコードを 1 回の `put([...])` にまとめる
- observe のコールバック内で `store.put` を個別に呼ぶより、変更を蓄積して 1 回の `put` にまとめる
- デバウンスは `throttledRaf` 相当で「1 フレームに 1 回」に制限。これ以上細かくすると送信過多になる

---

### 5.7 エッジケース・失敗モード

| ケース | 現象 | 対処 |
|--------|------|------|
| ネットワーク断 | 編集が他者に届かない | y-websocket が自動再接続。再接続後に同期 |
| サーバー再起動 | メモリ内の Y.Doc が消失 | クライアントが再送。空のルームから再開 |
| JSON パース失敗 | `yMap.get(key)` が不正な文字列 | try-catch でスキップ。該当レコードのみ無視 |
| スキーマ不一致 | 他クライアントが新しい型を送信 | compound の migrateSnapshot でマイグレーション。未知の型はスキップ |
| 同一ユーザー複数タブ | 2 つの presence が表示される | Awareness 側で `userId` でグループ化済み（AwarenessSync 参照） |

---

### 5.8 検証・テストチェックリスト

実装後に以下を確認すること:

- [ ] 2 クライアントでシェイプを作成 → 相互に表示される
- [ ] 2 クライアントで同一シェイプを編集 → 競合なく反映（どちらかが勝つ）
- [ ] シェイプ削除 → 他クライアントでも削除される
- [ ] カメラ移動・ズーム → 他クライアントのカメラに影響しない
- [ ] 同一ユーザーが 2 タブで開く → 1 本のカーソルのみ表示
- [ ] ネットワーク断 → 復旧後に同期が再開する
- [ ] 100 シェイプ以上のドキュメントでパフォーマンスが劣化しない

---

### 5.9 ロールバック戦略

旧 STORE_KEY 形式は削除済み。問題発生時はコードのロールバック（git revert）で対応。feature flag による切り替えは未実装。

---

## 6. 参考リンク

### tldraw

- [TLSyncClient - tldraw Docs](https://tldraw.dev/reference/sync-core/TLSyncClient)
- [RecordsDiff - tldraw Docs](https://tldraw.dev/reference/store/RecordsDiff)
- [tldraw sync-core ソース](https://github.com/tldraw/tldraw/blob/main/packages/sync-core/src/lib/TLSyncClient.ts)
- [tldraw store RecordsDiff ソース](https://github.com/tldraw/tldraw/blob/main/packages/store/src/lib/RecordsDiff.ts)

### compound / @cmpd/store

- `@cmpd/store` の `listen` API: `Store.mjs` の `listen` メソッド、`_flushHistory` で `onHistory({ changes, source })` を呼び出し
- `scope` によるフィルタ: `filterChangesByScope` で document / session / presence を分離

### gachaboard-compound

- [multi-cursor-implementation-guide.md](./multi-cursor-implementation-guide.md): マルチカーソル（Awareness）に特化
- [discord-auth-troubleshooting.md](../user/discord-auth-troubleshooting.md): 認証トラブルシューティング
- `nextjs-web/src/app/hooks/useYjsStore.ts`: 現状の同期ロジック
- `nextjs-web/src/app/components/collaboration/AwarenessSync.tsx`: Awareness ↔ instance_presence ブリッジ
