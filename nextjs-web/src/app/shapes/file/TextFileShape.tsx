"use client";

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
  WheelGuard,
  getColorForShape,
  getStrokeHexForColorStyle,
} from "../common";
import { resizeBox } from "@cmpd/editor";
import { SHAPE_TYPE, isTextFile, type TextFileShape } from "@shared/shapeDefs";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import { getSafeAssetId } from "@/lib/safeUrl";
import { convertToFileIcon } from "@/app/shapes";

export type { TextFileShape } from "@shared/shapeDefs";
export { isTextFile } from "@shared/shapeDefs";

/** 初期配置のデフォルトサイズ（最小値にも使用） */
const TEXT_FILE_DEFAULT_W = 320;
const TEXT_FILE_DEFAULT_H = 240;

/** 最大寸法（デフォルトの4倍） */
const TEXT_FILE_MAX_W = TEXT_FILE_DEFAULT_W * 4;
const TEXT_FILE_MAX_H = TEXT_FILE_DEFAULT_H * 4;

/** タッチで変換した直後の click 二重実行を防ぐため */
const lastTouchEndByShapeId = new Map<string, number>();

export class TextFileShapeUtil extends BaseBoxShapeUtil<TextFileShape> {
  static override type = SHAPE_TYPE.TEXT_FILE;

  getDefaultProps(): TextFileShape["props"] {
    return {
      assetId: "",
      fileName: "file.txt",
      mimeType: "text/plain",
      content: "",
      w: TEXT_FILE_DEFAULT_W,
      h: TEXT_FILE_DEFAULT_H,
    };
  }

  override getGeometry(shape: TextFileShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize = (shape: TextFileShape, info: Parameters<typeof resizeBox>[1]) => {
    const { scaleX, scaleY, handle } = info;
    const result = resizeBox(shape, info, {
      minWidth: TEXT_FILE_DEFAULT_W,
      minHeight: TEXT_FILE_DEFAULT_H,
      maxWidth: TEXT_FILE_MAX_W,
      maxHeight: TEXT_FILE_MAX_H,
    });
    // max クランプ時、resizeBox は位置を補正しないため、アンカーを固定するよう自前で補正
    const rawW = shape.props.w * scaleX;
    const rawH = shape.props.h * scaleY;
    const clampedW = result.props.w;
    const clampedH = result.props.h;
    const hitMax = rawW > TEXT_FILE_MAX_W || rawH > TEXT_FILE_MAX_H;
    if (!hitMax) return result;
    const rot = shape.rotation ?? 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    let dx = 0;
    let dy = 0;
    if (["top", "top_left", "top_right"].includes(handle)) {
      dy += rawH - clampedH;
    }
    if (["left", "top_left", "bottom_left"].includes(handle)) {
      dx += rawW - clampedW;
    }
    if (handle === "top") {
      dx += (rawW - clampedW) / 2;
    }
    if (handle === "left") {
      dy += (rawH - clampedH) / 2;
    }
    const x = result.x + dx * cos - dy * sin;
    const y = result.y + dx * sin + dy * cos;
    return { x, y, props: result.props };
  };

  override component(shape: TextFileShape) {
    const editor = useEditor();
    const safeAssetId = getSafeAssetId(shape.props.assetId);
    const ext = shape.props.fileName.split(".").pop()?.toLowerCase() ?? "";
    const isCode = ["js", "ts", "jsx", "tsx", "py", "go", "rs", "cpp", "c", "java", "sh", "bash", "zsh", "html", "css"].includes(ext);
    const isJson = ["json", "yaml", "yml", "toml", "xml"].includes(ext);
    const strokeHex = getStrokeHexForColorStyle(getColorForShape(shape.id));

    let headerBg = "#f4f4f5";
    let icon = "📄";
    if (isCode) { headerBg = "#1e1e2e"; icon = "💻"; }
    else if (isJson) { headerBg = "#f59e0b"; icon = "🔧"; }
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
          border: `3px solid ${strokeHex}`,
          borderRadius: 8,
          boxSizing: "border-box",
        }}
      >
        <CreatorLabel
          name={getCreatedBy(shape)}
          avatarUrl={getCreatedByAvatarUrl(shape)}
          rank={getCreationRank(editor, shape)}
          rightSlot={
            <button
              type="button"
              title="アイコンで表示"
              onClick={(e) => {
                e.stopPropagation();
                if (lastTouchEndByShapeId.has(shape.id) && Date.now() - (lastTouchEndByShapeId.get(shape.id) ?? 0) < 400) {
                  lastTouchEndByShapeId.delete(shape.id);
                  return;
                }
                convertToFileIcon(editor, shape.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => {
                e.stopPropagation();
                convertToFileIcon(editor, shape.id);
                lastTouchEndByShapeId.set(shape.id, Date.now());
              }}
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
                touchAction: "manipulation",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              ▢
            </button>
          }
        />
        <AssetLoader assetId={shape.props.assetId} fileName={shape.props.fileName}>
        <WheelGuard
          shapeId={shape.id}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            borderRadius: 6,
            overflow: "hidden",
            border: "none",
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
            <TwemojiImg emoji={icon} size={14} />
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
            <FileSizeLabel sizeBytes={shape.meta?.sizeBytes as string | undefined}
              style={{ color: isCode ? "rgba(255,255,255,0.4)" : undefined }}
            />
            {safeAssetId && (
              <DownloadButton assetId={safeAssetId} fileName={shape.props.fileName}
                style={{ flexShrink: 0, width: 20, height: 20, fontSize: 10, background: isCode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", border: `1px solid ${isCode ? "rgba(255,255,255,0.15)" : "#e4e4e7"}`, color: isCode ? "#cdd6f4" : "#71717a" }}
              />
            )}
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
