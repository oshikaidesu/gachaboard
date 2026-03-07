# シェイプ上にオーバーレイ表示（枠に含めない）

シェイプの上や周辺に表示用の要素（ラベル、ボタン、OGP プレビューなど）を追加しつつ、**選択枠（Transformer）には含めない**実装パターン。

## 適用例

| 用途 | 説明 |
|------|------|
| お名前ラベル | 作成者名をシェイプ上部に表示 |
| リアクションボタン | 👍 など、シェイプの角に表示 |
| OGP プレビュー | リンクカードのサムネイル・タイトルを上に表示 |
| バッジ・ステータス | 進行中・完了などのステータス表示 |

## 課題

ノードの子として要素を追加すると、Konva の bounds に含まれ、選択枠が拡張されてしまう。

## 解決策: getClientRect のオーバーライド

**枠の bounds 計算**は Weave SDK が `node.getClientRect()` を呼ぶ。  
これをオーバーライドし、**メインコンテンツのみ**の bounds を返す。

### 1. 表示の追加（ノード内）

表示用の要素はノードの子として追加。`y` を負にしてシェイプの上に配置。

```typescript
const LABEL_Y = -18; // シェイプの上

const bg = new Konva.Rect({
  name: "overlay-bg",
  x: 6,
  y: LABEL_Y,
  width: 80,
  height: 16,
  fill: "rgba(0,0,0,0.55)",
  cornerRadius: 3,
  listening: false,  // クリック無効
});

const text = new Konva.Text({
  name: "overlay-text",
  x: 10,
  y: LABEL_Y + 2,
  text: "表示内容",
  fontSize: 10,
  listening: false,
});

group.add(bg);
group.add(text);
```

### 2. 枠の除外（getClientRect オーバーライド）

Group の `getClientRect` を、メインコンテンツ（例: `.sticky-bg`）の bounds を返すように上書きする。

```typescript
// 枠（Transformer）はメインコンテンツのみを基準にする
const origGetClientRect = group.getClientRect.bind(group);
(group as unknown as { getClientRect: (config?: object) => { x: number; y: number; width: number; height: number } }).getClientRect = (config?: object) => {
  const mainContent = group.findOne<Konva.Rect>(".sticky-bg"); // メインの Rect など
  if (mainContent) return mainContent.getClientRect(config as Konva.NodeConfig);
  return origGetClientRect(config);
};
```

### 3. ポイント

- **listening: false** … オーバーレイはクリック対象にしない
- **メインコンテンツのセレクタ** … ノード種別ごとに適切な子を指定（`.sticky-bg`, `.text-content` など）
- **y 座標** … 負の値でシェイプの上、正の値で下に配置可能

## 参照実装

- `lib/weave-nodes/WeaveStickyNode.ts` … お名前ラベル + getClientRect オーバーライド
- `app/hooks/useAutoCreatedBy.ts` … onNodeAdded でラベルを追加
- `app/hooks/useCreatedByLabels.ts` … text / image / connector 用ラベル

## 別案: オーバーレイレイヤー

ラベルを**別レイヤー**に描画し、ノードの `getAbsolutePosition()` で位置を合わせる方法もある。  
その場合は枠に含まれないが、`dragend` / `transformend` で位置更新が必要。

枠の修正（getClientRect）は、ノード内に表示を置きたい場合のシンプルな方法。
