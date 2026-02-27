"use client";

/**
 * tldraw 組み込みシェイプ（image / video / note / geo）に
 * CreatorLabel を追加するための薄いラッパー。
 *
 * 各クラスは元の ShapeUtil を継承し、component() だけ上書きする。
 * 元の描画は super.component(shape) で取得して、その上にラベルを重ねる。
 */

import { HTMLContainer, ImageShapeUtil, VideoShapeUtil, NoteShapeUtil, GeoShapeUtil, TextShapeUtil, ArrowShapeUtil, Editor, TLImageShape, TLVideoShape, TLNoteShape, TLGeoShape, TLTextShape, TLArrowShape, TLDefaultColorStyle } from "@tldraw/tldraw";
import { CreatorLabel, getCreatedBy } from "./CreatorLabel";
import { ShapeReactionPanel } from "./ShapeReactionPanel";

function getColorForShape(shapeId: string): TLDefaultColorStyle {
  const pastelColors: TLDefaultColorStyle[] = [
    'light-blue',
    'light-green',
    'light-violet',
    'light-red',
    'yellow',
    'orange',
    'blue',
    'green',
    'violet',
  ];
  
  let hash = 0;
  for (let i = 0; i < shapeId.length; i++) {
    hash = ((hash << 5) - hash) + shapeId.charCodeAt(i);
    hash = hash & hash;
  }
  
  return pastelColors[Math.abs(hash) % pastelColors.length];
}

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

export class WrappedGeoShapeUtil extends GeoShapeUtil {
  override onBeforeCreate(shape: TLGeoShape): TLGeoShape | undefined {
    return {
      ...shape,
      props: {
        ...shape.props,
        color: getColorForShape(shape.id),
        fill: 'solid',
        dash: 'solid',
        font: 'sans',
      },
    };
  }

  override component(shape: TLGeoShape) {
    const createdBy = getCreatedBy(shape);
    const strokeColor = shape.props.color;
    
    const greyFill = super.component({
      ...shape,
      props: { ...shape.props, color: 'grey' as TLDefaultColorStyle, fill: 'solid' as const },
    });
    
    const coloredStroke = super.component({
      ...shape,
      props: { ...shape.props, color: strokeColor, fill: 'none' as const },
    });
    
    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: shape.props.w, height: shape.props.h, position: "relative", overflow: "visible" }}
      >
        <CreatorLabel name={createdBy} />
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}>
          {greyFill}
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}>
          {coloredStroke}
        </div>
        <ShapeReactionPanel shapeId={shape.id} />
      </HTMLContainer>
    );
  }
}

function getSourceShapeColor(editor: Editor, arrow: TLArrowShape): TLDefaultColorStyle {
  const bindings = editor.getBindingsFromShape(arrow.id, 'arrow');
  const startBinding = bindings.find((b) => b.props.terminal === 'start');
  
  if (startBinding) {
    const sourceShape = editor.getShape(startBinding.toId);
    if (sourceShape && editor.isShapeOfType(sourceShape, 'geo')) {
      return sourceShape.props.color;
    }
  }
  
  return getColorForShape(arrow.id);
}

export class WrappedArrowShapeUtil extends ArrowShapeUtil {
  override onBeforeCreate(shape: TLArrowShape): TLArrowShape | undefined {
    const color = getSourceShapeColor(this.editor, shape);
    return {
      ...shape,
      props: {
        ...shape.props,
        color,
      },
    };
  }

  override onBeforeUpdate(prev: TLArrowShape, next: TLArrowShape): TLArrowShape | undefined {
    const color = getSourceShapeColor(this.editor, next);
    if (color !== next.props.color) {
      return {
        ...next,
        props: {
          ...next.props,
          color,
        },
      };
    }
    return undefined;
  }
}
