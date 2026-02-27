"use client";

/**
 * tldraw 組み込みシェイプ（image / video / note / geo）に
 * CreatorLabel を追加するための薄いラッパー。
 *
 * 各クラスは元の ShapeUtil を継承し、component() だけ上書きする。
 * 元の描画は super.component(shape) で取得して、その上にラベルを重ねる。
 */

import { HTMLContainer, ImageShapeUtil, VideoShapeUtil, NoteShapeUtil, GeoShapeUtil, TextShapeUtil, TLImageShape, TLVideoShape, TLNoteShape, TLGeoShape, TLTextShape } from "@tldraw/tldraw";
import { CreatorLabel, getCreatedBy } from "./CreatorLabel";
import { ShapeReactionPanel } from "./ShapeReactionPanel";

// ---- Image ----------------------------------------------------------------

export class WrappedImageShapeUtil extends ImageShapeUtil {
  override component(shape: TLImageShape) {
    const base = super.component(shape);
    const createdBy = getCreatedBy(shape);
    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: shape.props.w, height: shape.props.h, position: "relative", overflow: "visible" }}
      >
        <CreatorLabel name={createdBy} />
        {base}
        <ShapeReactionPanel shapeId={shape.id} />
      </HTMLContainer>
    );
  }
}

// ---- Video ----------------------------------------------------------------

export class WrappedVideoShapeUtil extends VideoShapeUtil {
  override component(shape: TLVideoShape) {
    const base = super.component(shape);
    const createdBy = getCreatedBy(shape);
    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: shape.props.w, height: shape.props.h, position: "relative", overflow: "visible" }}
      >
        <CreatorLabel name={createdBy} />
        {base}
        <ShapeReactionPanel shapeId={shape.id} />
      </HTMLContainer>
    );
  }
}

// ---- Note (付箋) -----------------------------------------------------------

export class WrappedNoteShapeUtil extends NoteShapeUtil {
  override component(shape: TLNoteShape) {
    const base = super.component(shape);
    const createdBy = getCreatedBy(shape);
    return (
      <div style={{ position: "relative", overflow: "visible", width: "100%", height: "100%" }}>
        <CreatorLabel name={createdBy} />
        {base}
        <ShapeReactionPanel shapeId={shape.id} />
      </div>
    );
  }
}

// ---- Text (テキストのみ) -----------------------------------------------------

export class WrappedTextShapeUtil extends TextShapeUtil {
  override component(shape: TLTextShape) {
    const base = super.component(shape);
    const createdBy = getCreatedBy(shape);
    return (
      <div style={{ position: "relative", overflow: "visible", width: "100%", height: "100%" }}>
        <CreatorLabel name={createdBy} />
        {base}
        <ShapeReactionPanel shapeId={shape.id} />
      </div>
    );
  }
}

// ---- Geo (長方形・円など) ---------------------------------------------------

export class WrappedGeoShapeUtil extends GeoShapeUtil {
  override component(shape: TLGeoShape) {
    const base = super.component(shape);
    const createdBy = getCreatedBy(shape);
    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: shape.props.w, height: shape.props.h, position: "relative", overflow: "visible" }}
      >
        <CreatorLabel name={createdBy} />
        {base}
        <ShapeReactionPanel shapeId={shape.id} />
      </HTMLContainer>
    );
  }
}
