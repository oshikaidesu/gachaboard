# Yjs 改善ライブラリ・選定（外部レビュー反映）

> **作成日**: 2026-03-07  
> **元資料**: [yjs-system-specification.md](../dev/yjs-system-specification.md)  
> **概要**: 設計はしっかりしているが、GitHub に「そのまま効く改善ライブラリ」がいくつかある。Yjs 周辺ツールはここ 1〜2 年でかなり増えている。

---

## 1. 改善 direction（3 カテゴリ）

| カテゴリ | 内容 | 効果 |
|----------|------|------|
| **sync-server 改善** | メモリのみ → 永続化・スケール | いちばん効果大 |
| **CRDT 自体の高速化** | yjs → Y-Octo 等 | メモリ・update 高速化 |
| **Yjs 周辺ツール** | persistence, DB, Redis | すぐ効く |

---

## 2. sync-server 改善（いちばん効果大）

### 2.1 現状

```
y-websocket-server（メモリのみ）
```

Yjs の**最小構成**で、かなり原始的。

### 2.2 代替 1（おすすめ）: Hocuspocus

- **GitHub**: https://github.com/ueberdosis/hocuspocus
- Yjs 公式周辺で一番使われているサーバ
- **Notion 系はだいたいこの系統**

| 機能 | 内容 |
|------|------|
| Redis スケール | 水平スケール |
| persistence | Y.Doc 永続化 |
| hooks / auth | 認証・拡張 |
| websocket | 標準サポート |
| production | 本番運用向け |

例:

```ts
import { Server } from '@hocuspocus/server'
import { SQLite } from '@hocuspocus/extension-sqlite'

const server = new Server({
  port: 1234,
  extensions: [
    new SQLite({
      database: 'db.sqlite',
    }),
  ],
})
```

メリット: Y.Doc 永続化、Webhook、Redis cluster、scaling。

### 2.3 代替 2（最近）: Y-Sweet

- **GitHub**: https://github.com/jamsocket/y-sweet
- Rust 製の Yjs backend

| 機能 | 内容 |
|------|------|
| S3 persistence | Y.Doc を S3 に直接保存 |
| horizontal scaling | 水平スケール |
| Rust server | 高速 |
| Next.js integration | Next.js 連携 |

構成:

```
client → y-sweet → S3
```

**Figma っぽい設計。**

---

## 3. CRDT 自体の高速化

### 3.1 現状

```
yjs（純 JS）
```

### 3.2 代替: Y-Octo

- **GitHub**: https://github.com/y-crdt/y-octo
- 最近出てきた Rust 実装

| 特徴 | 内容 |
|------|------|
| yjs 互換 | 置き換え可能 |
| native binding | Electron / mobile 向け |
| AFFiNE で採用 | Electron アプリ |

メリット: メモリ使用量減、update 高速。

⚠️ **web だけなら yjs のままで十分**。

---

## 4. Yjs 周辺ツール（すぐ効く）

### 4.1 y-indexeddb（persistence）

- 仕様書にも記載済み
- 効果: reload instant、offline editing、network diff only

```js
import { IndexeddbPersistence } from 'y-indexeddb'
const provider = new IndexeddbPersistence("doc", ydoc)
```

流れ: 初回同期 → IndexedDB 保存 → リロード 0 ms

### 4.2 y-postgresql

- Yjs の update を DB 保存
- 構成: client → websocket → server → postgres

### 4.3 y-redis

- Redis pub/sub でスケール
- server1 / server2 / server3 を同期

---

## 5. ドラッグ同期（最大ボトルネック）

### 5.1 現状の問題

```
ドラッグ 60 fps → Y.Update
30 人 × 60 fps = 1,800 update/sec
```

### 5.2 推奨アーキテクチャ

```
dragging → awareness（ephemeral）
drop    → Y.Update
```

**Figma / tldraw もこの方式。** dragging state は ephemeral にする。

---

## 6.  GitHub で役に立つツール一覧

| 用途 | ライブラリ |
|------|------------|
| Yjs server | Hocuspocus |
| CRDT backend（S3） | Y-Sweet |
| browser cache | y-indexeddb |
| DB persistence | y-postgresql |
| horizontal scale | y-redis |
| CRDT 代替（Rust） | Y-Octo |

---

## 7. 正直な評価（危ない点）

### ① JSON stringify

- 現状: `Y.Map = JSON`
- 問題: CPU heavy、memory heavy
- 理想: binary encoding

### ② ドラッグ同期

- 最大ボトルネック（前述）

### ③ iframe embed（YouTube / X）

- 低スペ PC で死ぬ

---

## 8. 推奨改善ロードマップ

| 順番 | 内容 |
|------|------|
| ① | y-indexeddb |
| ② | dragging → awareness |
| ③ | Hocuspocus server |
| ④ | update batching |

効果:

```
1,800 updates/sec → 約 30 updates/sec
```

---

## 9. 関連ドキュメント

- [lightweighting-phase-plan.md](./lightweighting-phase-plan.md) - 軽量化フェーズ計画（実装順序）
- [yjs-system-specification.md](../dev/yjs-system-specification.md) - 元仕様
- [performance-optimization-plan.md](./performance-optimization-plan.md) - 負荷対策
- [sync-improvement-implementation-guide.md](./sync-improvement-implementation-guide.md) - 同期アーキテクチャ
