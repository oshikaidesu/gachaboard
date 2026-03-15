# 黄色・カラーの視認性改善ガイド

黄色など視認しにくい色を、見やすくするための変更方法をまとめます。

## 変更箇所一覧

黄色が使われる主な場所と、それぞれの変更方法です。

| 箇所 | ファイル | 変更方法 |
|------|----------|----------|
| JSON ファイルのヘッダー背景 | `nextjs-web/src/app/shapes/file/TextFileShape.tsx` | 直接編集 |
| geo / note 等のシェイプ色 | `@cmpd/tlschema` | **パッチ** |
| パレット候補 | `nextjs-web/src/app/shapes/NativeShapeWrappers.tsx` | 直接編集（色の追加・削除） |

---

## 1. 自前コードの色を変える（直接編集）

プロジェクト内のファイルは、該当箇所の色コードを書き換えるだけです。

### 例: TextFileShape（JSON ヘッダー）

```tsx
// nextjs-web/src/app/shapes/file/TextFileShape.tsx
else if (isJson) { headerBg = "#f59e0b"; icon = "🔧"; }  // アンバー500
```

- 変更前: `#fef3c7`（薄い黄色）
- 変更後: `#f59e0b`（アンバー、視認性重視）
- 参考（Tailwind）: `#fcd34d`(amber-300), `#f59e0b`(amber-500), `#d97706`(amber-600)

---

## 2. compound / tldraw の色を変える（パッチ必須）

geo や note などのシェイプの色は **`@cmpd/tlschema`** の `DefaultColorThemePalette` で定義されています。  
`node_modules` 内のため、**patch-package** でパッチを当てる必要があります。

### 変更の手順（大事）

1. **ソースを確認する**
   - `node_modules/@cmpd/tlschema/src/styles/TLColorStyle.ts`（型や構造の参考）
   - 実際に読み込まれるのは `dist-cjs` / `dist-esm` のビルド結果

2. **編集するファイル（両方変更する）**
   - `node_modules/@cmpd/tlschema/dist-cjs/styles/TLColorStyle.js`
   - `node_modules/@cmpd/tlschema/dist-esm/styles/TLColorStyle.mjs`

3. **パッチを作成・更新する**
   ```bash
   cd nextjs-web
   npx patch-package @cmpd/tlschema
   ```
   - `patches/@cmpd+tlschema+2.0.0-alpha.21.patch` が生成/更新されます
   - `package.json` の `postinstall` で自動適用されます

4. **バージョンアップ時**
   - `@cmpd/tlschema` のバージョンが変わったら、パッチファイル名を変えるか、新バージョン用にパッチをやり直す必要があります

### 黄色の定義（lightMode）

```javascript
yellow: {
  solid: "#facc15",    // 塗りつぶし
  semi: "#fde047",     // 半透明
  pattern: "#f59e0b",  // パターン
  highlight: {
    srgb: "#b8860b",   // 線・枠（stroke）← ここが geo の枠線に使われる
    p3: "color(display-p3 0.7 0.55 0.02)"
  }
}
```

- geo の枠線は主に `highlight.srgb` を使います
- `solid` / `semi` / `pattern` は塗りつぶしやパターンに使われます
- 視認性を上げるなら、値を少し暗く・濃くするのがおすすめです

### 参考: 色の候補（より濃い順）

| 用途 | 薄い → 濃い |
|------|-------------|
| 枠線（highlight） | `#fddd00` → `#d4a800` → `#b8860b` → `#9a7b0a` |
| 塗り（solid） | `#fff9b1` → `#fef08a` → `#fde047` → `#facc15` |

---

## 3. パレット候補を変える（色の出る頻度を変える）

`getColorForShape` で、新規 geo にランダムに割り当てる色のリストです。  
「黄色を減らす」「特定の色を増やす」などの調整ができます。

```tsx
// nextjs-web/src/app/shapes/NativeShapeWrappers.tsx
const pastelColors: TLDefaultColorStyle[] = [
  "light-blue", "light-green", "light-violet", "light-red",
  "yellow", "orange", "blue", "green", "violet",
];
```

- `"yellow"` を削除すれば、新規 geo では黄色は出ません
- 既存シェイプの色は変わりません（データに保存されているため）

---

## 現在の設定（まとめ）

| 項目 | 色コード | 備考 |
|------|----------|------|
| JSON ヘッダー | `#f59e0b` | アンバー500相当 |
| geo 黄色（枠線） | `#b8860b` | ダークゴールデンロッド |
| geo 黄色（塗り） | `#facc15` | アンバー400相当 |

---

## トラブルシューティング

### パッチが当たらない
- `npm install` または `yarn install` を再実行
- `patches/` に `@cmpd+tlschema+*.patch` があるか確認
- `package.json` に `"postinstall": "patch-package"` があるか確認

### 色が変わらない
- ビルドキャッシュ: `rm -rf .next && npm run build` で再ビルド
- ブラウザのハードリロード（Cmd+Shift+R / Ctrl+Shift+R）
- light / dark モードで別定義のため、どちらのテーマか確認
