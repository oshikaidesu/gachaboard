"use client";

import React from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
} from "@tldraw/tldraw";
import { DownloadButton } from "./DownloadButton";
import { CreatorLabel, getCreatedBy } from "./CreatorLabel";
import { ShapeReactionPanel } from "./ShapeReactionPanel";
import { ShapeConnectHandles } from "./ShapeConnectHandles";
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

function FileIconContent({ shape }: { shape: FileIconShape }) {
  const [hovered, setHovered] = React.useState(false);
  const emoji = getFileEmoji(shape.props.fileName, shape.props.kind);
  const name = shape.props.fileName;
  const shortName = name.length > 14 ? name.slice(0, 12) + "…" : name;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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
      {hovered && (
        <DownloadButton assetId={shape.props.assetId} fileName={shape.props.fileName}
          style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, fontSize: 11, background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb", color: "#6b7280", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
        />
      )}
    </div>
  );
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
          <FileIconContent shape={shape} />
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
        <ShapeConnectHandles shapeId={shape.id} w={shape.props.w} h={shape.props.h} />
      </HTMLContainer>
    );
  }

  override indicator(shape: FileIconShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={6} />;
  }
}
