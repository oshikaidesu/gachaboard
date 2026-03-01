"use client";

/**
 * tldraw 組み込みシェイプ（image / video / note / text）に
 * CreatorLabel と ShapeReactionPanel を追加するための薄いラッパー。
 *
 * 単純なラッパー（Image/Video/Note/Text）は wrapWithExtras() ファクトリで生成。
 * 独自ロジックがある Geo と Arrow は個別クラスとして残す。
 */

import {
  HTMLContainer,
  ImageShapeUtil,
  VideoShapeUtil,
  NoteShapeUtil,
  GeoShapeUtil,
  TextShapeUtil,
  ArrowShapeUtil,
  Editor,
  TLGeoShape,
  TLArrowShape,
  TLDefaultColorStyle,
  ShapeUtil,
  useEditor,
} from "@tldraw/tldraw";
import { CreatorLabel, getCreatedBy } from "./CreatorLabel";
import { ShapeReactionPanel } from "./ShapeReactionPanel";
import { OgpPreview } from "./OgpPreview";

// ---------- ファクトリ関数 ---------------------------------------------------

/**
 * 任意の ShapeUtil を継承し、component() に CreatorLabel と ShapeReactionPanel を
 * 追加したサブクラスを返す汎用ファクトリ。
 * Geo/Arrow のように独自ロジックが必要なものはこのファクトリを使わず個別実装する。
 */
function wrapWithExtras<TShape extends { id: string; props: { w?: number; h?: number } }>(
  Base: new (...args: unknown[]) => ShapeUtil<TShape>
): new (...args: unknown[]) => ShapeUtil<TShape> {
  class Wrapped extends (Base as new (...args: unknown[]) => ShapeUtil<TShape>) {
    override component(shape: TShape) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const editor = useEditor();
      const base = super.component(shape);
      const w = shape.props.w;
      const h = shape.props.h;
      const hasSize = w !== undefined && h !== undefined;
      const meta = (shape as { meta?: Record<string, unknown> }).meta ?? {};
      const rawOgpUrls = meta.ogpUrls;
      const ogpUrls: string[] = Array.isArray(rawOgpUrls) ? rawOgpUrls as string[] : [];

      const handleDismiss = ogpUrls.length > 0
        ? (url: string) => {
            const next = ogpUrls.filter((u) => u !== url);
            editor.updateShape({
              id: shape.id,
              type: (shape as { type: string }).type,
              meta: { ...meta, ogpUrls: next },
            });
          }
        : undefined;

      if (hasSize) {
        return (
          <HTMLContainer
            id={shape.id}
            style={{ width: w, height: h, position: "relative", overflow: "visible" }}
          >
            <CreatorLabel name={getCreatedBy(shape)} />
            {base}
            {/* OGP プレビュー + リアクションパネルを下部に配置 */}
            <div
              style={{
                position: "absolute",
                top: h,
                left: 0,
                width: w,
                pointerEvents: "none",
              }}
            >
              {ogpUrls.length > 0 && (
                <OgpPreview ogpUrls={ogpUrls} width={w} onDismiss={handleDismiss} />
              )}
              <ShapeReactionPanel
                shapeId={shape.id}
                containerStyle={{
                  position: "static",
                  marginTop: 4,
                  pointerEvents: "all",
                }}
              />
            </div>
          </HTMLContainer>
        );
      }

      // w/h なし（テキストシェイプの autoSize モード等）
      return (
        <div style={{ position: "relative", overflow: "visible", width: "100%", height: "100%" }}>
          <CreatorLabel name={getCreatedBy(shape)} />
          {base}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              width: "100%",
              pointerEvents: "none",
            }}
          >
            {ogpUrls.length > 0 && (
              <OgpPreview ogpUrls={ogpUrls} width={200} onDismiss={handleDismiss} />
            )}
            <ShapeReactionPanel
              shapeId={shape.id}
              containerStyle={{
                position: "static",
                marginTop: 4,
                pointerEvents: "all",
              }}
            />
          </div>
        </div>
      );
    }
  }
  return Wrapped;
}

// ---------- ファクトリ生成（単純ラッパー） -----------------------------------

const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
  backgroundColor: "#c0c0c0",
};

type ImageShape = { id: string; props: { w: number; h: number } };

export class WrappedImageShapeUtil extends (wrapWithExtras(
  ImageShapeUtil as new (...args: unknown[]) => ShapeUtil<ImageShape>
) as unknown as typeof ImageShapeUtil) {
  override component(shape: Parameters<ImageShapeUtil["component"]>[0]) {
    const base = super.component(shape);
    const { w, h } = shape.props;
    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: w, height: h, position: "relative", overflow: "hidden", ...CHECKER_STYLE }}
      >
        {base}
      </HTMLContainer>
    );
  }
}

export const WrappedVideoShapeUtil = wrapWithExtras(
  VideoShapeUtil as new (...args: unknown[]) => ShapeUtil<{ id: string; props: { w: number; h: number } }>
) as unknown as typeof VideoShapeUtil;

export const WrappedNoteShapeUtil = wrapWithExtras(
  NoteShapeUtil as new (...args: unknown[]) => ShapeUtil<{ id: string; props: { w?: number; h?: number } }>
) as unknown as typeof NoteShapeUtil;

export const WrappedTextShapeUtil = wrapWithExtras(
  TextShapeUtil as new (...args: unknown[]) => ShapeUtil<{ id: string; props: { w?: number; h?: number } }>
) as unknown as typeof TextShapeUtil;

// ---------- 個別実装（独自ロジックあり） ------------------------------------

function getColorForShape(shapeId: string): TLDefaultColorStyle {
  const pastelColors: TLDefaultColorStyle[] = [
    "light-blue", "light-green", "light-violet", "light-red",
    "yellow", "orange", "blue", "green", "violet",
  ];
  let hash = 0;
  for (let i = 0; i < shapeId.length; i++) {
    hash = ((hash << 5) - hash) + shapeId.charCodeAt(i);
    hash = hash & hash;
  }
  return pastelColors[Math.abs(hash) % pastelColors.length];
}

export class WrappedGeoShapeUtil extends GeoShapeUtil {
  override onBeforeCreate(shape: TLGeoShape): TLGeoShape | undefined {
    return {
      ...shape,
      props: {
        ...shape.props,
        color: getColorForShape(shape.id),
        fill: "solid",
        dash: "solid",
        font: "sans",
      },
    };
  }

  override component(shape: TLGeoShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const editor = useEditor();
    const createdBy = getCreatedBy(shape);
    const strokeColor = shape.props.color;
    const { w, h } = shape.props;
    const geoMeta = (shape.meta as Record<string, unknown> | undefined) ?? {};
    const rawGeoOgpUrls = geoMeta.ogpUrls;
    const ogpUrls: string[] = Array.isArray(rawGeoOgpUrls) ? rawGeoOgpUrls as string[] : [];

    const handleDismiss = ogpUrls.length > 0
      ? (url: string) => {
          const next = ogpUrls.filter((u) => u !== url);
          editor.updateShape({
            id: shape.id,
            type: shape.type,
            meta: { ...geoMeta, ogpUrls: next },
          });
        }
      : undefined;

    const greyFill = super.component({
      ...shape,
      props: { ...shape.props, color: "grey" as TLDefaultColorStyle, fill: "solid" as const },
    });

    const coloredStroke = super.component({
      ...shape,
      props: { ...shape.props, color: strokeColor, fill: "none" as const },
    });

    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: w, height: h, position: "relative", overflow: "visible" }}
      >
        <CreatorLabel name={createdBy} />
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}>
          {greyFill}
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}>
          {coloredStroke}
        </div>
        {/* OGP プレビュー + リアクションパネルを下部に配置 */}
        <div
          style={{
            position: "absolute",
            top: h,
            left: 0,
            width: w,
            pointerEvents: "none",
          }}
        >
          {ogpUrls.length > 0 && (
            <OgpPreview ogpUrls={ogpUrls} width={w} onDismiss={handleDismiss} />
          )}
          <ShapeReactionPanel
            shapeId={shape.id}
            containerStyle={{
              position: "static",
              marginTop: 4,
              pointerEvents: "all",
            }}
          />
        </div>
      </HTMLContainer>
    );
  }
}

function getSourceShapeColor(editor: Editor, arrow: TLArrowShape): TLDefaultColorStyle {
  const bindings = editor.getBindingsFromShape(arrow.id, "arrow");
  const startBinding = bindings.find((b) => b.props.terminal === "start");
  if (startBinding) {
    const sourceShape = editor.getShape(startBinding.toId);
    if (sourceShape && editor.isShapeOfType(sourceShape, "geo")) {
      return sourceShape.props.color;
    }
  }
  return getColorForShape(arrow.id);
}

export class WrappedArrowShapeUtil extends ArrowShapeUtil {
  override onBeforeCreate(shape: TLArrowShape): TLArrowShape | undefined {
    return {
      ...shape,
      props: { ...shape.props, color: getSourceShapeColor(this.editor, shape) },
    };
  }

  override onBeforeUpdate(prev: TLArrowShape, next: TLArrowShape): TLArrowShape | undefined {
    const color = getSourceShapeColor(this.editor, next);
    if (color !== next.props.color) {
      return { ...next, props: { ...next.props, color } };
    }
    return undefined;
  }
}
