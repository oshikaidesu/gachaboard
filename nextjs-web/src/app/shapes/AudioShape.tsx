"use client";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
} from "@tldraw/tldraw";
import { CreatorLabel, getCreatedBy } from "./CreatorLabel";
import { ShapeReactionPanel } from "./ShapeReactionPanel";
import { AssetLoader } from "./AssetLoader";
import { SHAPE_TYPE, type AudioShape } from "@shared/shapeDefs";

export type { AudioShape } from "@shared/shapeDefs";

function AudioPlayer({ shape }: { shape: AudioShape }) {
  const isWav =
    shape.props.mimeType === "audio/wav" ||
    shape.props.fileName.endsWith(".wav");
  const src = isWav
    ? `/api/assets/${shape.props.assetId}/file?converted=1`
    : `/api/assets/${shape.props.assetId}/file`;

  const shortName =
    shape.props.fileName.length > 30
      ? shape.props.fileName.slice(0, 28) + "…"
      : shape.props.fileName;

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 8,
      borderRadius: 12,
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      border: "1px solid #2d2d4e",
      padding: "10px 14px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>🎵</span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#e2e8f0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          fontFamily: "system-ui, sans-serif",
        }}>
          {shortName}
        </span>
      </div>

      <audio
        controls
        src={src}
        style={{ width: "100%", height: 32, accentColor: "#7c3aed" }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export class AudioShapeUtil extends BaseBoxShapeUtil<AudioShape> {
  static override type = SHAPE_TYPE.AUDIO;

  getDefaultProps(): AudioShape["props"] {
    return {
      assetId: "",
      fileName: "audio.mp3",
      mimeType: "audio/mpeg",
      w: 320,
      h: 96,
    };
  }

  override getGeometry(shape: AudioShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override component(shape: AudioShape) {
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
          <AudioPlayer shape={shape} />
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
      </HTMLContainer>
    );
  }

  override indicator(shape: AudioShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} />;
  }
}
