"use client";

import React from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  useEditor,
} from "@cmpd/compound";
import {
  DownloadButton,
  FileSizeLabel,
  CreatorLabel,
  getCreatedBy,
  getCreationRank,
  ShapeReactionPanel,
  ShapeConnectHandles,
  AssetLoader,
  getColorForShape,
  getStrokeHexForColorStyle,
} from "../common";
import { SHAPE_TYPE, type FileIconShape } from "@shared/shapeDefs";
import { TwemojiImg } from "@/app/components/ui/Twemoji";

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

/** 長いファイル名を省略するが、拡張子は必ず表示する */
function truncateWithExtension(fileName: string, maxLen: number): string {
  if (fileName.length <= maxLen) return fileName;
  const lastDot = fileName.lastIndexOf(".");
  const ext = lastDot > 0 ? fileName.slice(lastDot) : "";
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const keep = maxLen - ext.length - 1; // 1 = "…"
  if (keep <= 0) return "…" + ext;
  return base.slice(0, keep) + "…" + ext;
}

function UploadProgressDisplay({ fileName, progress, w }: { fileName: string; progress: number; w: number; h: number }) {
  const shortName = truncateWithExtension(fileName, 14);
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 6, padding: "8px 10px", boxSizing: "border-box",
    }}>
      <TwemojiImg emoji="⬆️" size={32} style={{ opacity: 0.5 }} />
      <span style={{ fontSize: 10, color: "#64748b", textAlign: "center", maxWidth: w - 16 }}>{shortName}</span>
      <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3,
          background: "linear-gradient(90deg, #3b82f6, #6366f1)",
          width: `${progress}%`,
          transition: "width 0.2s ease",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "#3b82f6", fontWeight: 600 }}>{progress}%</span>
    </div>
  );
}

function FileIconContent({ shape }: { shape: FileIconShape }) {
  const [hovered, setHovered] = React.useState(false);
  const emoji = getFileEmoji(shape.props.fileName, shape.props.kind);
  const name = shape.props.fileName;
  const shortName = truncateWithExtension(name, 14);

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
        <TwemojiImg emoji={emoji} size={48} style={{ pointerEvents: "none" }} />
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
        <div style={{ position: "absolute", top: 2, right: 2, display: "flex", alignItems: "center", gap: 3 }}>
          <FileSizeLabel sizeBytes={shape.meta?.sizeBytes as string | undefined}
            style={{ background: "rgba(255,255,255,0.9)", borderRadius: 3, padding: "1px 4px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
          />
          <DownloadButton assetId={shape.props.assetId} fileName={shape.props.fileName}
            style={{ width: 20, height: 20, fontSize: 11, background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb", color: "#6b7280", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
          />
        </div>
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
    const editor = useEditor();
    const uploadProgress = typeof shape.meta?.uploadProgress === "number" ? shape.meta.uploadProgress : null;
    const isUploading = !shape.props.assetId && uploadProgress !== null;
    const strokeHex = getStrokeHexForColorStyle(getColorForShape(shape.id));

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
          border: `3px solid ${strokeHex}`,
          borderRadius: 6,
          boxSizing: "border-box",
        }}
      >
        <CreatorLabel name={getCreatedBy(shape)} rank={getCreationRank(editor, shape)} />
        {isUploading ? (
          <UploadProgressDisplay
            fileName={shape.props.fileName}
            progress={uploadProgress as number}
            w={shape.props.w}
            h={shape.props.h}
          />
        ) : (
          <AssetLoader assetId={shape.props.assetId} fileName={shape.props.fileName}>
            <FileIconContent shape={shape} />
          </AssetLoader>
        )}
        <ShapeReactionPanel shapeId={shape.id} />
        <ShapeConnectHandles shapeId={shape.id} w={shape.props.w} h={shape.props.h} />
      </HTMLContainer>
    );
  }

  override indicator(shape: FileIconShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={6} />;
  }
}
