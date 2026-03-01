"use client";

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
import { WheelGuard } from "./ScrollContainer";
import { SHAPE_TYPE, isTextFile, type TextFileShape } from "@shared/shapeDefs";

export type { TextFileShape } from "@shared/shapeDefs";
export { isTextFile } from "@shared/shapeDefs";

export class TextFileShapeUtil extends BaseBoxShapeUtil<TextFileShape> {
  static override type = SHAPE_TYPE.TEXT_FILE;

  getDefaultProps(): TextFileShape["props"] {
    return {
      assetId: "",
      fileName: "file.txt",
      mimeType: "text/plain",
      content: "",
      w: 320,
      h: 240,
    };
  }

  override getGeometry(shape: TextFileShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override component(shape: TextFileShape) {
    const ext = shape.props.fileName.split(".").pop()?.toLowerCase() ?? "";
    const isCode = ["js", "ts", "jsx", "tsx", "py", "go", "rs", "cpp", "c", "java", "sh", "bash", "zsh", "html", "css"].includes(ext);
    const isJson = ["json", "yaml", "yml", "toml", "xml"].includes(ext);

    let headerBg = "#f4f4f5";
    let icon = "📄";
    if (isCode) { headerBg = "#1e1e2e"; icon = "💻"; }
    else if (isJson) { headerBg = "#fef3c7"; icon = "🔧"; }
    else if (ext === "md") { headerBg = "#eff6ff"; icon = "📝"; }
    else if (ext === "csv") { headerBg = "#f0fdf4"; icon = "📊"; }

    const shortName = shape.props.fileName.length > 28
      ? shape.props.fileName.slice(0, 26) + "…"
      : shape.props.fileName;

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          overflow: "visible",
          position: "relative",
          pointerEvents: "all",
        }}
      >
        <CreatorLabel name={getCreatedBy(shape)} />
        <AssetLoader assetId={shape.props.assetId}>
        <WheelGuard
          shapeId={shape.id}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid #e4e4e7",
            background: "#ffffff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              background: headerBg,
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderBottom: "1px solid #e4e4e7",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: isCode ? "#cdd6f4" : "#18181b",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {shortName}
            </span>
            <DownloadButton assetId={shape.props.assetId} fileName={shape.props.fileName}
              style={{ flexShrink: 0, width: 20, height: 20, fontSize: 10, background: isCode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", border: `1px solid ${isCode ? "rgba(255,255,255,0.15)" : "#e4e4e7"}`, color: isCode ? "#cdd6f4" : "#71717a" }}
            />
          </div>
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "8px 10px",
              background: isCode ? "#1e1e2e" : "#ffffff",
            }}
            onPointerDown={(e) => { e.stopPropagation(); }}
            onPointerMove={(e) => { e.stopPropagation(); }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.6,
                fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                color: isCode ? "#cdd6f4" : "#3f3f46",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {shape.props.content || "(空のファイル)"}
            </pre>
          </div>
        </WheelGuard>
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
        <ShapeConnectHandles shapeId={shape.id} w={shape.props.w} h={shape.props.h} />
      </HTMLContainer>
    );
  }

  override indicator(shape: TextFileShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }
}
