"use client";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
} from "@tldraw/tldraw";
import { CreatorLabel, getCreatedBy } from "./CreatorLabel";
import { ShapeReactionPanel } from "./ShapeReactionPanel";
import { AssetLoader } from "./AssetLoader";
import { SHAPE_TYPE, type FileIconShape } from "@shared/shapeDefs";

export type { FileIconShape } from "@shared/shapeDefs";

export function getFileEmoji(fileName: string, kind: string): string {
  if (kind === "image" || kind === "gif") return "🖼️";
  if (kind === "video") return "🎬";
  if (kind === "audio") return "🎵";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) return "🗜️";
  if (ext === "pdf") return "📕";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["ppt", "pptx"].includes(ext)) return "📊";
  if (["txt", "md", "log"].includes(ext)) return "📄";
  if (["json", "yaml", "yml", "toml", "xml"].includes(ext)) return "🔧";
  if (["js", "ts", "py", "go", "rs", "cpp", "c", "java"].includes(ext)) return "💻";
  if (["exe", "dmg", "pkg", "deb", "rpm"].includes(ext)) return "⚙️";
  if (["stem", "als", "flp", "ptx", "logic"].includes(ext)) return "🎛️";
  return "📦";
}

export class FileIconShapeUtil extends BaseBoxShapeUtil<FileIconShape> {
  static override type = SHAPE_TYPE.FILE_ICON;

  getDefaultProps(): FileIconShape["props"] {
    return {
      assetId: "",
      fileName: "file",
      mimeType: "application/octet-stream",
      kind: "file",
      w: 96,
      h: 96,
    };
  }

  override getGeometry(shape: FileIconShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override component(shape: FileIconShape) {
    const emoji = getFileEmoji(shape.props.fileName, shape.props.kind);
    const name = shape.props.fileName;
    const shortName = name.length > 14 ? name.slice(0, 12) + "…" : name;
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          cursor: "pointer",
          userSelect: "none",
          pointerEvents: "all",
          position: "relative",
          overflow: "visible",
        }}
      >
        <CreatorLabel name={getCreatedBy(shape)} />
        <AssetLoader assetId={shape.props.assetId}>
          {shape.props.kind === "image" || shape.props.kind === "gif" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/assets/${shape.props.assetId}/file`}
              alt={name}
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: 8,
                pointerEvents: "none",
              }}
            />
          ) : (
            <span style={{ fontSize: 48, lineHeight: 1, pointerEvents: "none" }}>{emoji}</span>
          )}
          <span
            style={{
              fontSize: 11,
              textAlign: "center",
              wordBreak: "break-all",
              maxWidth: shape.props.w - 8,
              lineHeight: 1.3,
              pointerEvents: "none",
              background: "rgba(255,255,255,0.85)",
              borderRadius: 3,
              padding: "1px 3px",
            }}
          >
            {shortName}
          </span>
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
      </HTMLContainer>
    );
  }

  override indicator(shape: FileIconShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={6} />;
  }
}
