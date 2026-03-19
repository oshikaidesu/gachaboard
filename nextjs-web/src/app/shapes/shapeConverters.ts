/**
 * シェイプ種別の相互変換（file-icon ⇔ audio/video/text-file）。
 * 矢印の binding を保持したまま削除→再作成で type を切り替える。
 */

import type { Editor } from "@cmpd/compound";
import type { TLShapeId } from "@cmpd/tlschema";
import {
  SHAPE_TYPE,
  type FileIconShape,
  type AudioShape,
  type TextFileShape,
  type VideoShape,
} from "@shared/shapeDefs";
import { MIN_COMMENT_LIST_H } from "@/app/hooks/media/useMediaPlayerComments";
import { AUDIO_DEFAULT_W, AUDIO_DEFAULT_H, VIDEO_UI_OVERHEAD } from "./media/mediaConstants";

const FILE_ICON_SIZE = 96;

const CENTER_BINDING = {
  type: "binding" as const,
  normalizedAnchor: { x: 0.5, y: 0.5 },
  isExact: false,
  isPrecise: false,
};

/** 指定シェイプに接続している矢印の ID と接続端（start/end）を収集。 */
function getArrowsBoundToShape(
  editor: Editor,
  shapeId: TLShapeId
): { id: TLShapeId; end: "start" | "end" }[] {
  const result: { id: TLShapeId; end: "start" | "end" }[] = [];
  for (const s of editor.getCurrentPageShapes()) {
    if (s.type !== "arrow") continue;
    const props = s.props as { start?: { type?: string; boundShapeId?: TLShapeId }; end?: { type?: string; boundShapeId?: TLShapeId } };
    if (props.start?.type === "binding" && props.start.boundShapeId === shapeId) result.push({ id: s.id as TLShapeId, end: "start" });
    if (props.end?.type === "binding" && props.end.boundShapeId === shapeId) result.push({ id: s.id as TLShapeId, end: "end" });
  }
  return result;
}

/** 矢印を同じシェイプに再 bind する。 */
function rebindArrowsToShape(editor: Editor, shapeId: TLShapeId, boundArrows: { id: TLShapeId; end: "start" | "end" }[]): void {
  const binding = { ...CENTER_BINDING, boundShapeId: shapeId };
  for (const { id: arrowId, end } of boundArrows) {
    const arrow = editor.getShape(arrowId);
    if (!arrow || arrow.type !== "arrow") continue;
    const props = arrow.props as { start?: { type?: string }; end?: { type?: string }; [k: string]: unknown };
    const current = end === "start" ? props.start : props.end;
    if (current?.type === "binding" && (current as { boundShapeId?: TLShapeId }).boundShapeId === shapeId) continue;
    editor.updateShapes([
      { id: arrowId, type: "arrow", props: { ...props, [end]: binding } },
    ]);
  }
}

const CONVERTIBLE_TO_FILE_ICON = [SHAPE_TYPE.AUDIO, SHAPE_TYPE.VIDEO, SHAPE_TYPE.TEXT_FILE] as const;

/**
 * audio-player / video-player / text-file を file-icon（アイコン表示）に変換する。
 */
export function convertToFileIcon(editor: Editor, shapeId: string): boolean {
  const sid = shapeId as TLShapeId;
  const shape = editor.getShape(sid);
  if (!shape) return false;
  if (!CONVERTIBLE_TO_FILE_ICON.includes(shape.type as (typeof CONVERTIBLE_TO_FILE_ICON)[number])) return false;

  const boundArrows = getArrowsBoundToShape(editor, sid);
  const p = shape.props as { assetId?: string; fileName?: string; mimeType?: string; content?: string };
  const assetId = p.assetId ?? "";
  const fileName = p.fileName ?? "";
  const mimeType = p.mimeType ?? "";
  const kind = shape.type === SHAPE_TYPE.AUDIO ? "audio" : shape.type === SHAPE_TYPE.VIDEO ? "video" : "file";
  const { x, y } = shape;
  const meta = { ...(shape.meta ?? {}) } as Record<string, string | number>;
  if (shape.type === SHAPE_TYPE.TEXT_FILE && p.content) {
    meta._textContent = p.content;
  }

  editor.batch(() => {
    editor.deleteShapes([sid]);
    editor.createShape({
      id: sid,
      type: SHAPE_TYPE.FILE_ICON,
      x,
      y,
      meta,
      props: {
        assetId,
        fileName,
        mimeType,
        kind,
        w: FILE_ICON_SIZE,
        h: FILE_ICON_SIZE,
      } as FileIconShape["props"],
    });
    rebindArrowsToShape(editor, sid, boundArrows);
  });
  return true;
}

const CONVERTIBLE_FROM_FILE_ICON_KINDS = ["audio", "video", "file"] as const;

/**
 * file-icon を kind に応じて audio-player / video-player / text-file に変換する。
 */
export function convertFromFileIcon(editor: Editor, shapeId: string): boolean {
  const sid = shapeId as TLShapeId;
  const shape = editor.getShape(sid);
  if (!shape || shape.type !== SHAPE_TYPE.FILE_ICON) return false;

  const p = shape.props as FileIconShape["props"];
  const kind = p.kind;
  if (!(CONVERTIBLE_FROM_FILE_ICON_KINDS as readonly string[]).includes(kind)) return false;

  const boundArrows = getArrowsBoundToShape(editor, sid);
  const assetId = p.assetId ?? "";
  const fileName = p.fileName ?? "";
  const mimeType = p.mimeType ?? "";
  const { x, y } = shape;
  const meta = shape.meta ?? {};

  if (kind === "audio") {
    editor.batch(() => {
      editor.deleteShapes([sid]);
      editor.createShape({
        id: sid,
        type: SHAPE_TYPE.AUDIO,
        x,
        y,
        meta: meta as object,
        props: {
          assetId,
          fileName,
          mimeType,
          w: AUDIO_DEFAULT_W,
          h: AUDIO_DEFAULT_H,
        } as AudioShape["props"],
      });
      rebindArrowsToShape(editor, sid, boundArrows);
    });
  } else if (kind === "video") {
    const w = 480;
    const videoAreaH = Math.round(w / (16 / 9));
    const defaultH = videoAreaH + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H;
    editor.batch(() => {
      editor.deleteShapes([sid]);
      editor.createShape({
        id: sid,
        type: SHAPE_TYPE.VIDEO,
        x,
        y,
        meta: meta as object,
        props: {
          assetId,
          fileName,
          mimeType,
          w,
          h: defaultH,
        } as VideoShape["props"],
      });
      rebindArrowsToShape(editor, sid, boundArrows);
    });
  } else {
    const savedContent = typeof meta._textContent === "string" ? meta._textContent : "";
    const restoredMeta = { ...meta } as Record<string, unknown>;
    delete restoredMeta._textContent;
    editor.batch(() => {
      editor.deleteShapes([sid]);
      editor.createShape({
        id: sid,
        type: SHAPE_TYPE.TEXT_FILE,
        x,
        y,
        meta: restoredMeta as object,
        props: {
          assetId,
          fileName,
          mimeType,
          content: savedContent,
          w: 320,
          h: 240,
        } as TextFileShape["props"],
      });
      rebindArrowsToShape(editor, sid, boundArrows);
    });
  }
  return true;
}

/** @deprecated convertFromFileIcon を使用 */
export const convertToMediaPlayer = convertFromFileIcon;
