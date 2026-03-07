# Konva 座標システムと DOM オーバーレイ追従ガイド

Konva キャンバス上に DOM オーバーレイを配置し、シェイプに追従させる際の座標変換とパフォーマンスの知見をまとめる。

## 1. Konva 座標システム

### getAbsolutePosition()

ノードの**親トランスフォームを適用した後の座標**を返す。ステージの pan（position）と zoom（scale）は**既に含まれる**。

```typescript
const absPos = node.getAbsolutePosition();
// absPos.x, absPos.y はステージ座標（論理座標）
```

### getClientRect(config?)

**キャンバス内のピクセル座標**を直接返す。`{ x, y, width, height }`。DOM オーバーレイの `left` / `top` にそのまま使える。

```typescript
const rect = node.getClientRect({ skipStroke: true });
// rect.x, rect.y はキャンバスピクセル座標
```

### 二重適用の罠（避けるべき）

`getAbsolutePosition()` の結果に、さらに `stage.position()` と `stage.scaleX()` を掛けると**二重適用**になる。

```typescript
// 誤り: absPos には既に scale/pan が含まれている
x: stagePos.x + absPos.x * scaleX;  // 二重適用で座標がズレる
```

正しくは `getClientRect()` を使う。

```typescript
// 正解: キャンバスピクセルを直接取得
const rect = node.getClientRect({ skipStroke: true });
x: rect.x;
y: rect.y + rect.height;  // シェイプの下に配置する場合
```

## 2. DOM オーバーレイの追従パターン

### setState 方式（重い）

毎フレーム `setState` で座標を更新すると、React の再レンダーが走り、ドラッグ中にカクつく。

```typescript
// 避ける: ドラッグ中に毎フレーム setState
stage.on("dragmove", () => setPositions(computePositions()));
```

### ref 直接更新方式（推奨）

DOM の `style` を直接更新し、React の再レンダーを避ける。

```typescript
const refsMapRef = useRef<Map<string, HTMLDivElement>>(new Map());

const updatePositions = () => {
  for (const [nodeId, el] of refsMapRef.current) {
    const rect = konvaNode.getClientRect({ skipStroke: true });
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y + rect.height}px`;
    el.style.width = `${rect.width}px`;
  }
};

stage.on("dragmove", () => {
  requestAnimationFrame(updatePositions);
});
```

- `requestAnimationFrame` でバッチ化
- 再レンダーなし = 60fps でスムーズに追従

### イベント登録

| イベント | 用途 |
|----------|------|
| `dragmove` | ドラッグ中の追従 |
| `wheel` | パン・ズーム中の追従 |
| `dragend` / `transformend` | 確定時の位置更新 |

## 3. 軽量化のポイント

| 項目 | 方針 |
|------|------|
| ノードスキャン | OGP 付きノードのみ Map で管理。全 children ループは 1 秒間隔のポーリングに限定 |
| 位置更新 | ref で DOM 直接更新。setState は使わない |
| getClientRect | 対象ノードのみ呼ぶ（Map に登録されたノードだけ） |
| Store 保存 | `updateNode` は編集終了時のみ。ドラッグ中は呼ばない |
| OGP fetch | `ogpCache` Map でキャッシュ。同じ URL は即返却 |

## 4. パフォーマンス比較

| 方式 | 追従 | クリック/リンク | YouTube iframe | 実装 |
|------|------|-----------------|---------------|------|
| DOM オーバーレイ | ref 直接更新で 60fps | 可能 | 可能 | 座標変換が必要 |
| Konva キャンバス | 完全にスムーズ | 不可 | 不可 | ノードの子として追加 |
| ハイブリッド | キャンバスで描画 | ポップアップで代替 | サムネイルのみ | 複雑 |

DOM オーバーレイはリンク・iframe をそのまま使えるため、OGP プレビューには適している。ref 直接更新で追従のスムーズさを確保する。

## 5. 参照実装

- [app/hooks/useOgpOverlay.tsx](../nextjs-web/app/hooks/useOgpOverlay.tsx) … ref 直接更新、dragmove/wheel で 60fps 追従
- [docs/overlay-on-shape-without-frame.md](./overlay-on-shape-without-frame.md) … 枠に含めないパターン（getClientRect オーバーライド）
