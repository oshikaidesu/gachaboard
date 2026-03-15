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
  getCreatedByAvatarUrl,
  getCreationRank,
  ShapeReactionPanel,
  ShapeConnectHandles,
  AssetLoader,
  getColorForShape,
  getStrokeHexForColorStyle,
} from "../common";
import { SHAPE_TYPE, MEDIA_ICON_KINDS, type FileIconShape } from "@shared/shapeDefs";
import { convertToMediaPlayer } from "@/app/shapes";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import { useTheme } from "@/app/components/theme/ThemeProvider";
import { getSafeAssetId } from "@/lib/safeUrl";

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
  const { isDarkMode } = useTheme();
  const shortName = truncateWithExtension(fileName, 14);
  const textColor = isDarkMode ? "#94a3b8" : "#64748b";
  const trackBg = isDarkMode ? "#334155" : "#e2e8f0";
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 6, padding: "8px 10px", boxSizing: "border-box",
    }}>
      <TwemojiImg emoji="⬆️" size={32} style={{ opacity: 0.5 }} />
      <span style={{ fontSize: 10, color: textColor, textAlign: "center", maxWidth: w - 16 }}>{shortName}</span>
      <div style={{ width: "100%", height: 6, background: trackBg, borderRadius: 3, overflow: "hidden" }}>
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
  const { isDarkMode } = useTheme();
  const emoji = getFileEmoji(shape.props.fileName, shape.props.kind);
  const name = shape.props.fileName;
  const safeAssetId = getSafeAssetId(shape.props.assetId);
  const shortName = truncateWithExtension(name, 14);
  const labelStyle = isDarkMode
    ? { background: "rgba(30,41,59,0.9)", color: "#e2e8f0", borderRadius: 3, padding: "1px 3px" as const }
    : { background: "rgba(255,255,255,0.85)", color: "#1e293b", borderRadius: 3, padding: "1px 3px" as const };
  const overlayStyle = isDarkMode
    ? { background: "rgba(30,41,59,0.95)", border: "1px solid #475569", color: "#cbd5e1", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
    : { background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb", color: "#6b7280", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" };

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
      {(shape.props.kind === "image" || shape.props.kind === "gif") && safeAssetId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/assets/${safeAssetId}/file`}
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
          ...labelStyle,
        }}
      >
        {shortName}
      </span>
      {hovered && (
        <div style={{ position: "absolute", top: 2, right: 2, display: "flex", alignItems: "center", gap: 3 }}>
          <FileSizeLabel sizeBytes={shape.meta?.sizeBytes as string | undefined}
            style={{ ...overlayStyle, borderRadius: 3, padding: "1px 4px" }}
          />
          {safeAssetId && (
            <DownloadButton assetId={safeAssetId} fileName={shape.props.fileName}
              style={{ width: 20, height: 20, fontSize: 11, ...overlayStyle }}
            />
          )}
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
    return <FileIconShapeInner shape={shape} />;
  }

  override indicator(shape: FileIconShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={6} />;
  }
}

function FileIconShapeInner({ shape }: { shape: FileIconShape }) {
  const editor = useEditor();
  const { isDarkMode } = useTheme();
  const uploadProgress = typeof shape.meta?.uploadProgress === "number" ? shape.meta.uploadProgress : null;
  const isUploading = !shape.props.assetId && uploadProgress !== null;
  const strokeHex = getStrokeHexForColorStyle(getColorForShape(shape.id));
  const bgColor = isDarkMode ? "#1e293b" : "#ffffff";

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
        background: bgColor,
        border: `3px solid ${strokeHex}`,
        borderRadius: 6,
        boxSizing: "border-box",
      }}
    >
        <CreatorLabel
          name={getCreatedBy(shape)}
          avatarUrl={getCreatedByAvatarUrl(shape)}
          rank={getCreationRank(editor, shape)}
          rightSlot={
            (MEDIA_ICON_KINDS as readonly string[]).includes(shape.props.kind) ? (
              <button
                type="button"
                title="プレイヤーで表示"
                onClick={(e) => {
                  e.stopPropagation();
                  convertToMediaPlayer(editor, shape.id);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                style={{
                  width: 20,
                  height: 20,
                  padding: 0,
                  border: "none",
                  borderRadius: 3,
                  background: "rgba(0,0,0,0.35)",
                  color: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                ▶
              </button>
            ) : undefined
          }
        />
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
