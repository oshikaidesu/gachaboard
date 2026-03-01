"use client";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  useEditor,
} from "@tldraw/tldraw";
import { useEffect, useRef, useState, useCallback } from "react";
import { CreatorLabel, getCreatedBy } from "./CreatorLabel";
import { ShapeReactionPanel } from "./ShapeReactionPanel";
import { ShapeConnectHandles } from "./ShapeConnectHandles";
import { AssetLoader } from "./AssetLoader";
import { SHAPE_TYPE, type AudioShape } from "@shared/shapeDefs";
import { useWaveform } from "@/app/hooks/useWaveform";
import { useBoardContext } from "@/app/components/BoardContext";
import { useVisibility } from "@/app/hooks/useVisibility";
import { WheelGuard } from "./ScrollContainer";
import { DownloadButton } from "./DownloadButton";
import type { ApiComment } from "@shared/apiTypes";

export type { AudioShape } from "@shared/shapeDefs";

// ---------- 定数 ----------

const ORANGE = "#ff5500";
const GRAY = "#d1d5db";
const WAVEFORM_HEIGHT = 48;
const BAR_GAP = 1;
const BASE_HEIGHT = 160;
const COMMENT_ROW_HEIGHT = 24;
const COMMENT_LIST_PADDING = 8;

// ---------- 波形 Canvas ----------

function WaveformCanvas({
  peaks,
  currentTime,
  duration,
  comments,
  onSeek,
}: {
  peaks: number[];
  currentTime: number;
  duration: number;
  comments: ApiComment[];
  onSeek: (sec: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevBoundaryRef = useRef(-1);
  const [tooltip, setTooltip] = useState<{ x: number; text: string } | null>(null);

  // 波形データが変わった時のみフル再描画
  useEffect(() => {
    prevBoundaryRef.current = -1;
  }, [peaks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const barWidth = (width - BAR_GAP * (peaks.length - 1)) / peaks.length;
    const playedRatio = duration > 0 ? currentTime / duration : 0;
    const boundary = Math.floor(playedRatio * peaks.length);

    if (prevBoundaryRef.current === boundary && prevBoundaryRef.current !== -1) return;

    const prevBoundary = prevBoundaryRef.current;
    prevBoundaryRef.current = boundary;

    if (prevBoundary === -1) {
      ctx.clearRect(0, 0, width, height);
      peaks.forEach((peak, i) => {
        const x = i * (barWidth + BAR_GAP);
        const barH = Math.max(2, peak * height);
        const y = (height - barH) / 2;
        ctx.fillStyle = i < boundary ? ORANGE : GRAY;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 1);
        ctx.fill();
      });
      return;
    }

    const lo = Math.min(prevBoundary, boundary);
    const hi = Math.max(prevBoundary, boundary);
    for (let i = lo; i <= hi && i < peaks.length; i++) {
      const x = i * (barWidth + BAR_GAP);
      const barH = Math.max(2, peaks[i] * height);
      const y = (height - barH) / 2;
      ctx.clearRect(x, y - 1, barWidth + BAR_GAP, barH + 2);
      ctx.fillStyle = i < boundary ? ORANGE : GRAY;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 1);
      ctx.fill();
    }
  }, [peaks, currentTime, duration]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0 || comments.length === 0) {
      setTooltip(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = rect.width;

    const hit = comments.find((c) => {
      const pinX = (c.timeSec / duration) * width;
      return Math.abs(mouseX - pinX) < 8;
    });

    if (hit) {
      const pinX = (hit.timeSec / duration) * width;
      const m = Math.floor(hit.timeSec / 60);
      const s = Math.floor(hit.timeSec % 60);
      setTooltip({ x: pinX, text: `${m}:${s.toString().padStart(2, "0")} ${hit.author.discordName}: ${hit.body}` });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div
      style={{ position: "relative", width: "100%", height: WAVEFORM_HEIGHT + 10 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      <canvas
        ref={canvasRef}
        width={360}
        height={WAVEFORM_HEIGHT}
        style={{ width: "100%", height: WAVEFORM_HEIGHT, cursor: duration > 0 ? "pointer" : "default", display: "block" }}
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />

      {/* コメントピン — クリックでシーク */}
      {duration > 0 && comments.map((c) => (
        <div
          key={c.id}
          onClick={() => onSeek(c.timeSec)}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 0,
            left: `calc(${(c.timeSec / duration) * 100}% - 4px)`,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: ORANGE,
            cursor: "pointer",
          }}
        />
      ))}

      {/* ツールチップ */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: tooltip.x,
            transform: "translateX(-50%)",
            background: "#fff",
            color: "#111827",
            fontSize: 10,
            padding: "3px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

// ---------- メインプレイヤー ----------

function AudioPlayer({ shape }: { shape: AudioShape }) {
  const isWav =
    shape.props.mimeType === "audio/wav" ||
    shape.props.fileName.endsWith(".wav");
  const src = isWav
    ? `/api/assets/${shape.props.assetId}/file?converted=1`
    : `/api/assets/${shape.props.assetId}/file`;

  const { boardId, workspaceId } = useBoardContext();
  const editor = useEditor();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { ref: visRef, visible } = useVisibility<HTMLDivElement>();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const heightUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { peaks, status: waveStatus } = useWaveform(shape.props.assetId);

  // コメント数に応じてシェイプの高さを自動更新（debounce で同期ストーム回避）
  useEffect(() => {
    const targetH = comments.length > 0
      ? BASE_HEIGHT + COMMENT_LIST_PADDING + comments.length * COMMENT_ROW_HEIGHT
      : BASE_HEIGHT;
    if (shape.props.h === targetH) return;
    if (heightUpdateTimer.current) clearTimeout(heightUpdateTimer.current);
    heightUpdateTimer.current = setTimeout(() => {
      if (shape.props.h !== targetH) {
        editor.updateShape({ id: shape.id, type: shape.type, props: { h: targetH } });
      }
    }, 300 + Math.random() * 200);
    return () => { if (heightUpdateTimer.current) clearTimeout(heightUpdateTimer.current); };
  }, [comments.length, editor, shape.id, shape.type, shape.props.h]);

  const shortName =
    shape.props.fileName.length > 32
      ? shape.props.fileName.slice(0, 30) + "…"
      : shape.props.fileName;

  const loadComments = useCallback(async () => {
    const res = await fetch(`/api/comments?assetId=${shape.props.assetId}`);
    if (res.ok) setComments(await res.json() as ApiComment[]);
  }, [shape.props.assetId]);

  useEffect(() => {
    loadComments();
    if (!visible) return;
    const id = setInterval(loadComments, 5000);
    return () => clearInterval(id);
  }, [loadComments, visible]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const seekTo = (sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = sec;
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: shape.props.assetId,
        workspaceId,
        boardId,
        timeSec: currentTime,
        body: newComment.trim(),
      }),
    });
    if (res.ok) {
      setNewComment("");
      await loadComments();
    }
    setPosting(false);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <WheelGuard
      ref={visRef}
      shapeId={shape.id}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderRadius: 12,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        padding: "10px 12px",
        boxSizing: "border-box",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ファイル名 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>🎵</span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#111827",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}>
          {shortName}
        </span>
        <DownloadButton assetId={shape.props.assetId} fileName={shape.props.fileName}
          style={{ flexShrink: 0, width: 22, height: 22, fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280" }}
        />
      </div>

      {/* 波形 */}
      {waveStatus === "loading" && (
        <div style={{
          height: WAVEFORM_HEIGHT,
          borderRadius: 4,
          background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)",
          backgroundSize: "200% 100%",
        }} />
      )}
      {waveStatus === "ready" && (
        <WaveformCanvas
          peaks={peaks}
          currentTime={currentTime}
          duration={duration}
          comments={comments}
          onSeek={seekTo}
        />
      )}
      {waveStatus === "error" && (
        <div style={{ height: WAVEFORM_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>波形を読み込めませんでした</span>
        </div>
      )}

      {/* 再生コントロール */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={togglePlay}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: ORANGE,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#fff",
            fontSize: 11,
          }}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <span style={{ fontSize: 10, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <span style={{ fontSize: 10 }}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ width: 196, accentColor: ORANGE, cursor: "pointer" }}
          />
        </div>
        {comments.length > 0 && (
          <span style={{ fontSize: 9, color: ORANGE }}>
            💬 {comments.length}
          </span>
        )}
      </div>

      {/* コメント入力 */}
      <div
        style={{ display: "flex", gap: 4, alignItems: "center" }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: 9, color: "#9ca3af", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {formatTime(currentTime)}
        </span>
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
          placeholder="コメントを追加..."
          style={{
            flex: 1,
            fontSize: 10,
            padding: "3px 6px",
            borderRadius: 4,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            color: "#111827",
            outline: "none",
            minWidth: 0,
          }}
        />
        <button
          onClick={postComment}
          disabled={posting || !newComment.trim()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            fontSize: 9,
            padding: "3px 7px",
            borderRadius: 4,
            border: "none",
            background: ORANGE,
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
            opacity: posting || !newComment.trim() ? 0.4 : 1,
          }}
        >
          投稿
        </button>
      </div>

      {/* コメントリスト */}
      {comments.length > 0 && (
        <div
          style={{
            borderTop: "1px solid #f3f4f6",
            paddingTop: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflowY: "auto",
            maxHeight: 8 * COMMENT_ROW_HEIGHT,
          }}
        >
          {comments.map((c: ApiComment) => {
            const m = Math.floor(c.timeSec / 60);
            const s = Math.floor(c.timeSec % 60);
            const timeStr = `${m}:${s.toString().padStart(2, "0")}`;
            return (
              <div
                key={c.id}
                onClick={() => seekTo(c.timeSec)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 4px",
                  borderRadius: 4,
                  cursor: "pointer",
                  height: COMMENT_ROW_HEIGHT,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <span style={{
                  fontSize: 9,
                  color: ORANGE,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                  fontWeight: 600,
                }}>
                  {timeStr}
                </span>
                <span style={{
                  fontSize: 10,
                  color: "#374151",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {c.body}
                </span>
                <span style={{
                  fontSize: 9,
                  color: "#9ca3af",
                  flexShrink: 0,
                }}>
                  {c.author.discordName}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        style={{ display: "none" }}
      />
    </WheelGuard>
  );
}

// ---------- ShapeUtil ----------

export class AudioShapeUtil extends BaseBoxShapeUtil<AudioShape> {
  static override type = SHAPE_TYPE.AUDIO;

  getDefaultProps(): AudioShape["props"] {
    return {
      assetId: "",
      fileName: "audio.mp3",
      mimeType: "audio/mpeg",
      w: 560,
      h: 160,
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
        <ShapeConnectHandles shapeId={shape.id} w={shape.props.w} h={shape.props.h} />
      </HTMLContainer>
    );
  }

  override hideSelectionBoundsBg() {
    return true;
  }

  override indicator(shape: AudioShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} />;
  }
}
