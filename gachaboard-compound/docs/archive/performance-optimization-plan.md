# パフォーマンス最適化計画

> **作成日**: 2026-03-07
> **更新日**: 2026-03-07
> **対象**: gachaboard-compound nextjs-web
> **前提**: 同期改善（per-record Y.Map / FPS スロットル）実装後の状態
> **想定規模**: 最大 30 人同時接続 / 1000 シェイプ

---

## 1. 現状分析サマリー

per-record Y.Map 方式への移行、マルチカーソル（Awareness）、リアクション Yjs 同期を実装した結果、同期のスムーズさは大幅に改善された。一方で、以下のパフォーマンスボトルネックが浮上している。

| 優先度 | 箇所 | 問題 |
|--------|------|------|
| **最高** | ドラッグ中のシェイプ同期 | ドラッグの全軌跡が Y.Doc の CRDT 履歴に蓄積され、Y.Doc が急速に肥大化 |
| **最高** | リロード時の初期ロード | y-indexeddb 導入済み。IndexedDB から即時復元（※ドラッグ最適化・その他は未対応） |
| **高** | `useUrlPreviewAttacher` | `source: "all"` + `scope: "session"` でカーソル移動のたびにコールバック実行 |
| **中** | `AwarenessSync` の `syncRemoteToStore` | awareness 変更ごとに呼ばれ、30 人で最大 1,800 回/秒 |
| **中** | `BoardReactionProvider` の `applyYUpdate` | スロットルなし・全件走査・毎回 `setByShape` |
| **低** | `BoardReactionContext` | `byShape` 変更で Context 配下の全子孫が再レンダリング（30 人規模では顕在化しにくい） |
| **低** | `BoardReactionProvider` ポーリング | Yjs 接続時 2 秒間隔で API 呼び出し |

---

## 2. 技術選定: 使うもの / 使わないもの

### 採用済み

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| **yjs** (`^13.6.0`) | CRDT エンジン | `useYjsStore.ts` で Y.Doc / Y.Map を直接操作 |
| **y-websocket** (`^2.1.0`) | リアルタイム通信 | `WebsocketProvider` で同期 |
| **Awareness** (y-protocols) | カーソル同期 | `AwarenessSync.tsx` で利用。y-websocket に同梱 |
| **requestAnimationFrame** | スロットル | `useYjsStore.ts` / `AwarenessSync.tsx` で使用 |
| **@cmpd/store** | 状態管理 | compound の TLStore が SyncedStore / mutative-yjs の役割を担う |

### 採用済み（2026-03 時点）

| ライブラリ | 用途 |
|-----------|------|
| **y-indexeddb** (`^9.0.12`) | ブラウザ永続化 + オフライン対応 + リロード即時復元（導入済み） |

### 新規導入（推奨）

| ライブラリ | 用途 | 優先度 |
|-----------|------|--------|
| **Awareness 拡張**（ドラッグ一時座標） | ドラッグ中の座標同期を Y.Doc から分離 | **最高** |

### 見送り（30 人規模では不要）

| ライブラリ | 見送り理由 |
|-----------|-----------|
| **SyncedStore** | `@cmpd/store` が同等の役割を果たしている。最終更新 2 年前（v0.6.0）でメンテ停止 |
| **mutative-yjs** | `store.put` / `store.mergeRemoteChanges` が既にイミュータブルな差分適用を実現済み |
| **Hocuspocus** | 30 人なら y-websocket-server で十分。v3.4.4 は堅牢だが移行コストに見合わない |
| **Y-Sweet / y-octo** | サーバースケーリングフェーズ（100 人超）で初めて検討。y-octo は npm 未提供・v0.0.2 で時期尚早 |
| **Zustand** | リアクション頻度が低い 30 人規模では Context で許容可能。将来の選択肢として留保 |
| **lodash.throttle** | requestAnimationFrame で上位互換を実現済み |
| **YKeyValue (y-utility)** | ドラッグ Awareness 分離で Y.Doc 肥大化が大幅緩和されるため、長期に後ろ倒し |

---

## 3. 改善フェーズ

### Phase 1: ドラッグ中の座標を Awareness に逃がす（即時・最高効果）

**現状の問題**:

ドラッグ中の毎フレームで `store.put(shape)` → `yMap.set(shapeId, ...)` → Y.Update 送信が走る。

```
ドラッグ中: store → yMap.set() → Y.Update（毎フレーム）
 → Y.Doc に全軌跡が CRDT 履歴として蓄積
 → 1000 シェイプ × 30 人のドラッグ = 数十 MB の Y.Doc 肥大化リスク
```

**修正方針**:

```
ドラッグ中:
  awareness.setLocalStateField("dragging", { shapeId, x, y })
  → Awareness で他クライアントに即時反映（保存されない一時データ）
  → 受信側は CSS transform で一時的に表示位置を更新

ドラッグ終了:
  store.put(shape)  → yMap.set(shapeId, ...)
  → Y.Doc に確定値のみ保存（1 回だけ）
```

**期待効果**:
- Y.Doc サイズ: ドラッグ分の CRDT 履歴が **ゼロ** に
- ネットワーク: ドラッグ中は軽量な Awareness パケットのみ（Y.Update の 1/10 以下）
- 操作感: Awareness は 60fps で同期されるため、スムーズさは維持

**実装対象ファイル**:
- `useYjsStore.ts`: ドラッグ中の `store.listen` からの書き込みを抑制
- `AwarenessSync.tsx`: `dragging` フィールドの送受信を追加
- シェイプコンポーネント: ドラッグ中は Awareness の座標で一時表示

**工数**: 中

---

### Phase 2: y-indexeddb 導入（即時・最高効果）※導入済み

**現状の問題**（y-indexeddb 導入により解消済み）:

- y-websocket-server はメモリのみ → サーバー再起動でデータ消失
- リロード時、サーバーから Y.Doc 全体を再受信 → 1000 シェイプで遅延
- 30 人が同時にリロードすると、サーバーに Y.Doc 全体の送信が 30 並列走る

**修正方針**:

```ts
// useYjsStore.ts に追加
import { IndexeddbPersistence } from "y-indexeddb";

const ydoc = new Y.Doc();
const persistence = new IndexeddbPersistence(roomId, ydoc);

// synced イベントで IndexedDB からのロード完了を検知
persistence.on("synced", () => {
  // ローカルから瞬時に復元完了
  // → WebSocket 接続後はサーバーとの差分のみ同期
});
```

**期待効果**:
- リロード: IndexedDB から瞬時復元（サーバー不要）
- ネットワーク: 差分のみ同期（フルドキュメント送信なし）
- オフライン: 編集可能 → 復帰時に自動マージ
- サーバー負荷: 30 人同時リロードでも影響なし

**工数**: 極小（npm install + 数行追加）

---

### Phase 3: useUrlPreviewAttacher の scope 修正（即時・高効果）

**現状の問題**:

```ts
// useUrlPreviewAttacher.ts:129-149
editor.store.listen(
  () => { /* 編集終了の検知 */ },
  { source: "all", scope: "session" }
);
```

- `source: "all"` によりリモート変更を含む **すべての** store 変更で呼ばれる
- `scope: "session"` により `instance_presence`（カーソル位置）の更新でも発火
- 30 人のカーソル移動 → 毎フレーム × 30 = 最大 1,800 回/秒このコールバックが実行される

**修正方針**:

```ts
editor.store.listen(
  () => { /* 編集終了の検知 */ },
  { source: "user", scope: "session" }
);
```

- `source: "user"` に変更し、リモート変更では発火しないようにする
- 編集終了の検知は **ローカルユーザーの操作** でのみ必要なため、`source: "user"` で十分
- **工数**: 1 行の変更。即時修正可能
- **操作感への影響**: なし（ローカル操作の検知タイミングは完全に同一）

---

### Phase 4: AwarenessSync の syncRemoteToStore スロットル（即時・中効果）

**現状の問題**:

```ts
// AwarenessSync.tsx:107-108
syncRemoteToStore();
awareness.on("change", syncRemoteToStore);
```

- `awareness.on("change")` はリモート **とローカル** の awareness 変更で発火
- 30 人が同時にカーソル移動すると、最大 1,800 回/秒 `store.mergeRemoteChanges` が実行される

**修正方針**:

```ts
let syncRafId: number | null = null;
const throttledSync = () => {
  if (syncRafId !== null) return;
  syncRafId = requestAnimationFrame(() => {
    syncRafId = null;
    syncRemoteToStore();
  });
};
awareness.on("change", throttledSync);
```

- RAF で 1 フレームに 1 回に制限（1,800 回/秒 → 60 回/秒）
- **工数**: 小
- **操作感への影響**: なし（描画結果は同一。RAF 内で最新値を適用するため）

---

### Phase 5: BoardReactionProvider 最適化（短期・中効果）

**applyYUpdate にスロットルと差分検知を導入**:

```ts
const applyYUpdate = (event: Y.YMapEvent<string>) => {
  if (!event.changes.keys.size) return;
  if (reactionRafRef.current) return;
  reactionRafRef.current = requestAnimationFrame(() => {
    reactionRafRef.current = null;
    const byId = new Map(byIdRef.current);
    let changed = false;
    yMap.forEach((value, key) => {
      try {
        const r = JSON.parse(value) as Reaction;
        const existing = byId.get(key);
        if (!existing || existing.emoji !== r.emoji || existing.deletedAt !== r.deletedAt) {
          byId.set(r.id, { ...r, user: r.user ?? fallbackUser(r.userId) });
          changed = true;
        }
      } catch { /* skip */ }
    });
    if (changed) {
      byIdRef.current = byId;
      setByShape(reactionsToMap(Array.from(byId.values())));
    }
  });
};
```

- RAF で 1 フレームに 1 回に抑制
- 差分検知で `setByShape` の不要な呼び出しを防止
- **工数**: 中

**ポーリング間隔延長（併せて実施）**:
- Yjs 接続時: 2 秒 → **15〜30 秒** に延長
- Yjs で即時同期されるため、ポーリングは整合性チェック程度で十分

---

### Phase 6（長期）: 将来の検討事項

以下は 30 人規模では不要だが、スケールアップ時に検討する。

| 施策 | 検討条件 |
|------|----------|
| `useSyncExternalStore` + 外部 store | リアクション頻度が高くなり Context 再レンダリングが問題化したとき |
| YKeyValue (y-utility) 移行 | Phase 1 のドラッグ Awareness 分離後も Y.Doc 肥大化が問題になるとき |
| Hocuspocus / Y-Sweet | 100 人超 or サーバー永続化が必要になったとき |
| y-octo | Rust サーバーへの移行、ネイティブアプリ対応が必要になったとき |
| Zustand | 外部 store + devtools が必要になったとき |

---

## 4. 実装優先度マトリクス（30 人 × 1000 シェイプ）

| 順位 | フェーズ | 工数 | 効果 | リスク |
|------|----------|------|------|--------|
| **1** | Phase 1: ドラッグ Awareness 分離 | 中 | **最高** | 低 |
| **2** | Phase 2: y-indexeddb 導入 | **極小** | **最高** | 極低 |
| **3** | Phase 3: useUrlPreviewAttacher scope | **極小** | **高** | 極低 |
| **4** | Phase 4: AwarenessSync RAF スロットル | **小** | **中** | 極低 |
| **5** | Phase 5: BoardReactionProvider 最適化 | 中 | 中 | 低 |

**推奨実装順序**: Phase 3（1 行修正）→ Phase 2（数行追加）→ Phase 4（小修正）→ Phase 1（設計必要）→ Phase 5

> Phase 3 / 2 / 4 は即座に着手可能。Phase 1 はドラッグ中の描画方式の設計が必要なため、先に即効性のある修正を入れてから取り組む。

---

## 5. パフォーマンス指標・検証方法

### 30 人規模での負荷推定

| 指標 | 現状（推定） | Phase 1-5 後 |
|------|-------------|-------------|
| ドラッグ中の Y.Update | 毎フレーム送信（~60 回/秒/人） | **0 回/秒**（Awareness のみ） |
| リロード時の初期ロード | サーバーから Y.Doc 全体を受信 | **IndexedDB から即時復元** |
| `useUrlPreviewAttacher` 発火 | ~1,800 回/秒（30 人カーソル） | **ユーザー操作時のみ** |
| `syncRemoteToStore` | ~1,800 回/秒 | **最大 60 回/秒**（RAF） |
| `applyYUpdate` | Y.Map 変更ごと（無制限） | **最大 60 回/秒**（RAF） |
| Y.Doc サイズ（1000 シェイプ、30 人で 1 時間利用） | 数十 MB（ドラッグ履歴込み） | **~1 MB**（確定値のみ） |

### 検証チェックリスト

- [ ] 30 人のマルチユーザーでカーソル移動がスムーズ（60fps 維持）
- [ ] 1000 シェイプのドラッグが他クライアントに即時反映される
- [ ] ドラッグ後の Y.Doc サイズが 1 回の put 分しか増加しない
- [ ] リロード時に IndexedDB から瞬時にシェイプが表示される
- [ ] `useUrlPreviewAttacher` がリモートカーソル移動で発火しない
- [ ] ネットワーク断 → 復旧後にシェイプ・リアクションが正常に同期
- [ ] Chrome DevTools Performance で Long Task が 50ms 以下

---

## 6. ライブラリ調査結果

### 採用ライブラリ

#### y-indexeddb (`^9.0.12`)
- **パッケージ**: [y-indexeddb](https://www.npmjs.com/package/y-indexeddb)
- **概要**: Yjs 公式の IndexedDB アダプタ。ブラウザにY.Doc を永続化
- **週間 DL**: 216K+
- **機能**: オフライン編集 → 自動マージ、リロード時の即時復元、メタデータ保存
- **注意**: Mobile Safari で一部 fetch 失敗の報告あり（2025年8月）

### 調査済み・見送りライブラリ

#### SyncedStore (`@syncedstore/core` v0.6.0)
- **最終更新**: 2023 年（2 年以上更新なし）
- **見送り理由**: `@cmpd/store` が同等機能を提供。メンテ停止リスク

#### mutative-yjs
- **概要**: Immer 的 API で Yjs を操作。mutative は Immer の 2-6x 高速版
- **見送り理由**: compound の `store.put` / `mergeRemoteChanges` で代替済み

#### Hocuspocus (`@hocuspocus/server` v3.4.4)
- **最終更新**: 2026-01-25（活発にメンテナンス中）
- **機能**: Yjs 専用バックエンド。権限管理、SQLite/Redis 対応、Express/Hono 統合
- **見送り理由**: 30 人なら y-websocket-server で十分。100 人超で再検討

#### Y-Sweet / Relay Server
- **概要**: Rust 製 Yjs バックエンド。S3 永続化、水平スケーリング
- **見送り理由**: 30 人規模では不要。サーバー永続化は y-indexeddb（クライアント側）で当面対応

#### y-octo (v0.0.2)
- **概要**: Rust 製の Yjs 互換 CRDT。AFFiNE が本番利用。Yjs の 5-10x 高速
- **見送り理由**: npm パッケージ未提供、ブラウザ WASM ビルドなし、v0.0.2 で時期尚早。ネイティブアプリ対応時に検討
- **参考**: [y-crdt/y-octo](https://github.com/y-crdt/y-octo)

#### YKeyValue (y-utility)
- **概要**: Y.Map の肥大化問題を解決。100k ops で Y.Map 比 1,937 倍のサイズ効率
- **見送り理由**: Phase 1 のドラッグ Awareness 分離で Y.Doc 肥大化が大幅緩和。長期で検討
- **参考**: [yjs/y-utility](https://github.com/yjs/y-utility)

#### requestAnimationFrame vs lodash.throttle
- RAF はブラウザ描画サイクル同期（~16ms）で lodash.throttle の上位互換
- 既に RAF ベースで実装済み。lodash 追加は不要

---

## 7. 参考リンク

### Yjs 関連
- [Yjs Best Practices - Liveblocks](https://liveblocks.io/docs/guides/yjs-best-practices-and-tips)
- [y-indexeddb - Yjs Docs](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb)
- [y-utility / YKeyValue](https://github.com/yjs/y-utility)
- [Optimizing Yjs First Load - Chronicle / Anik Das](https://anikd.com/blog/optimizing-yjs-first-load/)

### React パフォーマンス
- [Context Performance Trap - useSyncExternalStore](https://azguards.com/performance-optimization/the-propagation-penalty-bypassing-react-context-re-renders-via-usesyncexternalstore/)
- [useSyncExternalStore - React Docs](https://react.dev/reference/react/useSyncExternalStore)

### リアルタイム同期
- [Y.js for Collaborative React Apps](https://medium.com/@t.bendallah/taming-real-time-state-why-y-js-is-the-ultimate-tool-for-collaborative-react-apps-922630e9659f)
- [Hocuspocus Docs](https://tiptap.dev/docs/hocuspocus/getting-started)
- [y-octo](https://github.com/y-crdt/y-octo)

### gachaboard-compound 関連ドキュメント
- [lightweighting-phase-plan.md](./lightweighting-phase-plan.md) - 軽量化フェーズ計画
- [sync-improvement-implementation-guide.md](./sync-improvement-implementation-guide.md)
- [multi-cursor-implementation-guide.md](./multi-cursor-implementation-guide.md)
- [discord-auth-troubleshooting.md](../user/discord-auth-troubleshooting.md)
