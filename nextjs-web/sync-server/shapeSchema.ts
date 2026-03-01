/**
 * sync-server 用カスタムシェイプのスキーマ定義。
 *
 * SHAPE_DEFS（shared/shapeDefs.ts）をループして BaseBoxShapeUtil スタブを動的生成し、
 * createTLSchemaFromUtils でスキーマを作成する。
 *
 * 新しいカスタムシェイプを追加する場合は shared/shapeDefs.ts の SHAPE_DEFS に
 * エントリを追加するだけでよい。このファイルへの変更は不要。
 */

import {
  BaseBoxShapeUtil,
  Rectangle2d,
  ImageShapeUtil,
  VideoShapeUtil,
  NoteShapeUtil,
  GeoShapeUtil,
  TextShapeUtil,
  ArrowShapeUtil,
  DrawShapeUtil,
  HighlightShapeUtil,
  LineShapeUtil,
  FrameShapeUtil,
  BookmarkShapeUtil,
  EmbedShapeUtil,
  createTLSchemaFromUtils,
  type TLShape,
} from "@tldraw/tldraw";

// shared/shapeDefs.ts を相対パスで参照（コンテナ内では /app/shared/ に配置）
import { SHAPE_DEFS } from "./shared/shapeDefs.js";

// ---------- SHAPE_DEFS から動的にスタブ ShapeUtil を生成 --------------------

function createStubShapeUtil(shapeType: string, defaultProps: Record<string, unknown>) {
  type StubShape = TLShape<typeof shapeType>;

  class StubUtil extends BaseBoxShapeUtil<StubShape> {
    static override type = shapeType;

    getDefaultProps(): StubShape["props"] {
      return defaultProps as StubShape["props"];
    }

    override getGeometry(shape: StubShape) {
      const w = (shape.props as Record<string, unknown>).w as number ?? 100;
      const h = (shape.props as Record<string, unknown>).h as number ?? 100;
      return new Rectangle2d({ width: w, height: h, isFilled: true });
    }

    component() { return null; }
    indicator() { return null; }
  }

  return StubUtil;
}

const customShapeUtils = Object.entries(SHAPE_DEFS).map(([type, def]) =>
  createStubShapeUtil(type, def.defaultProps as Record<string, unknown>)
);

// ---------- スキーマ生成 ----------------------------------------------------
// カスタムシェイプ（SHAPE_DEFS から自動生成）+ 組み込みシェイプ全種

export const customSchema = createTLSchemaFromUtils({
  shapeUtils: [
    ...customShapeUtils,
    ImageShapeUtil,
    VideoShapeUtil,
    NoteShapeUtil,
    GeoShapeUtil,
    TextShapeUtil,
    ArrowShapeUtil,
    DrawShapeUtil,
    HighlightShapeUtil,
    LineShapeUtil,
    FrameShapeUtil,
    BookmarkShapeUtil,
    EmbedShapeUtil,
  ],
});
