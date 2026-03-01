"use client";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  type TLBaseBoxShape,
} from "@tldraw/tldraw";
import { useRef, useState, useCallback, useEffect } from "react";
import { useEditor } from "@tldraw/tldraw";
import { CreatorLabel, getCreatedBy } from "./CreatorLabel";
import { ShapeReactionPanel } from "./ShapeReactionPanel";
import { ShapeConnectHandles } from "./ShapeConnectHandles";
import { AssetLoader } from "./AssetLoader";
import { SHAPE_TYPE, type VideoShape } from "@shared/shapeDefs";
import { WheelGuard } from "./ScrollContainer";
import { DownloadButton } from "./DownloadButton";
import { useBoardContext } from "@/app/components/BoardContext";
import { useVisibility } from "@/app/hooks/useVisibility";
import type { ApiComment } from "@shared/apiTypes";

export type { VideoShape } from "@shared/shapeDefs";

// ---------- 定数 ----------

const BLUE = "#3b82f6";
const TRACK_BG = "#e2e8f0";
const BG = "#ffffff";
const TEXT_PRIMARY = "#1e293b";
const TEXT_MUTED = "#64748b";
const SEEK_BAR_HEIGHT = 4;
const CONTROLS_HEIGHT = 36;
const HEADER_HEIGHT = 26;
const BASE_HEIGHT = 330;
const COMMENT_ROW_HEIGHT = 24;
const COMMENT_LIST_PADDING = 8;

// ---------- シークバー ----------

function SeekBar({
  currentTime,
  duration,
  onSeek,
  comments = [],
}: {
  currentTime: number;
  duration: number;
  onSeek: (sec: number) => void;
  comments?: ApiComment[];
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const calcTime = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || duration <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (duration <= 0) return;
    setDragging(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    onSeek(calcTime(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!dragging || duration <= 0) return;
    onSeek(calcTime(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragging(false);
  };

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        width: "100%",
        height: SEEK_BAR_HEIGHT + 12,
        display: "flex",
        alignItems: "center",
        cursor: duration > 0 ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      {/* トラック */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: SEEK_BAR_HEIGHT,
          borderRadius: SEEK_BAR_HEIGHT / 2,
          background: TRACK_BG,
          overflow: "hidden",
        }}
      >
        {/* 再生済み部分 */}
        <div
          style={{
            width: `${playedPct}%`,
            height: "100%",
            background: BLUE,
            borderRadius: SEEK_BAR_HEIGHT / 2,
            transition: dragging ? "none" : "width 0.1s linear",
          }}
        />
      </div>
      {/* つまみ */}
      {duration > 0 && (
        <div
          style={{
            position: "absolute",
            left: `calc(${playedPct}% - 6px)`,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: BLUE,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: dragging ? "none" : "left 0.1s linear",
            pointerEvents: "none",
          }}
        />
      )}
      {/* コメントピン */}
      {duration > 0 && comments.map((c) => (
        <div
          key={c.id}
          title={`${Math.floor(c.timeSec / 60)}:${String(Math.floor(c.timeSec % 60)).padStart(2, "0")} ${c.author.discordName}: ${c.body}`}
          style={{
            position: "absolute",
            bottom: 0,
            left: `calc(${(c.timeSec / duration) * 100}% - 3px)`,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: BLUE,
            opacity: 0.7,
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
}

// ---------- メインプレイヤー ----------

function VideoPlayer({ shape }: { shape: VideoShape }) {
  const props = shape.props as import("@shared/shapeDefs").VideoProps;
  const src = `/api/assets/${props.assetId}/file`;

  const { boardId, workspaceId } = useBoardContext();
  const editor = useEditor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref: visRef, visible } = useVisibility<HTMLDivElement>();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const heightUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shortName =
    props.fileName.length > 36
      ? props.fileName.slice(0, 34) + "…"
      : props.fileName;

  const loadComments = useCallback(async () => {
    const res = await fetch(`/api/comments?assetId=${props.assetId}`);
    if (res.ok) setComments(await res.json() as ApiComment[]);
  }, [props.assetId]);

  useEffect(() => {
    loadComments();
    if (!visible) return;
    const id = setInterval(loadComments, 5000);
    return () => clearInterval(id);
  }, [loadComments, visible]);

  // コメント数に応じてシェイプの高さを自動更新（debounce で同期ストーム回避）
  useEffect(() => {
    const targetH = comments.length > 0
      ? BASE_HEIGHT + COMMENT_LIST_PADDING + comments.length * COMMENT_ROW_HEIGHT
      : BASE_HEIGHT;
    if (props.h === targetH) return;
    if (heightUpdateTimer.current) clearTimeout(heightUpdateTimer.current);
    heightUpdateTimer.current = setTimeout(() => {
      if (props.h !== targetH) {
        editor.updateShape({ id: shape.id, type: shape.type, props: { h: targetH } });
      }
    }, 300 + Math.random() * 200);
    return () => { if (heightUpdateTimer.current) clearTimeout(heightUpdateTimer.current); };
  }, [comments.length, editor, shape.id, shape.type, props.h]);

  const postComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: props.assetId,
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

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      video.play();
    }
  };

  const seekTo = (sec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = sec;
    setCurrentTime(sec);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    setMuted(next);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      if (v === 0) {
        videoRef.current.muted = true;
        setMuted(true);
      } else if (muted) {
        videoRef.current.muted = false;
        setMuted(false);
      }
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, []);

  return (
    <WheelGuard
      ref={visRef}
      shapeId={shape.id}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderRadius: 10,
        background: BG,
        border: "1px solid #e2e8f0",
        boxSizing: "border-box",
        boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
        fontFamily: "system-ui, sans-serif",
        color: TEXT_PRIMARY,
        overflow: "hidden",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: HEADER_HEIGHT,
          flexShrink: 0,
          padding: "0 10px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <span style={{ fontSize: 12, flexShrink: 0, color: BLUE }}>▶</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {shortName}
        </span>
        <DownloadButton assetId={props.assetId} fileName={props.fileName}
          style={{ flexShrink: 0, width: 20, height: 20, fontSize: 10, background: "#f1f5f9", border: "1px solid #e2e8f0", color: TEXT_MUTED }}
        />
      </div>

      {/* 動画エリア */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: "#000",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          autoPlay={false}
          controls={false}
          muted={false}
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload nofullscreen noremoteplayback"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            pointerEvents: "none",
            background: "transparent",
            WebkitAppearance: "none",
          }}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>

      {/* コントロールエリア */}
      <div
        style={{
          flexShrink: 0,
          padding: "6px 10px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          background: BG,
          borderTop: "1px solid #f1f5f9",
        }}
      >
        {/* シークバー */}
        <SeekBar currentTime={currentTime} duration={duration} onSeek={seekTo} comments={comments} />

        {/* ボタン行 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: CONTROLS_HEIGHT - 10,
          }}
        >
          {/* 再生/一時停止 */}
          <button
            onClick={togglePlay}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: BLUE,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#fff",
              fontSize: 10,
            }}
          >
            {playing ? "⏸" : "▶"}
          </button>

          {/* 時刻表示 */}
          <span
            style={{
              fontSize: 10,
              color: TEXT_MUTED,
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* 音量コントロール */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginLeft: "auto",
            }}
          >
            <button
              onClick={toggleMute}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                padding: 0,
                lineHeight: 1,
                color: TEXT_MUTED,
              }}
            >
              {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ width: 64, accentColor: BLUE, cursor: "pointer" }}
            />
          </div>
        </div>
      </div>

      {/* コメント入力 */}
      <div
        style={{ display: "flex", gap: 4, alignItems: "center", padding: "0 10px 6px" }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: 9, color: TEXT_MUTED, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
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
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            color: TEXT_PRIMARY,
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
            background: BLUE,
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
            borderTop: "1px solid #f1f5f9",
            padding: "4px 10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflowY: "auto",
            maxHeight: 8 * COMMENT_ROW_HEIGHT,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {comments.map((c) => {
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
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#f1f5f9"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 9, color: BLUE, fontVariantNumeric: "tabular-nums", flexShrink: 0, fontWeight: 600 }}>
                  {timeStr}
                </span>
                <span style={{ fontSize: 10, color: TEXT_PRIMARY, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.body}
                </span>
                <span style={{ fontSize: 9, color: TEXT_MUTED, flexShrink: 0 }}>
                  {c.author.discordName}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WheelGuard>
  );
}

// ---------- ShapeUtil ----------

export class VideoShapeUtil extends BaseBoxShapeUtil<VideoShape & TLBaseBoxShape> {
  static override type = SHAPE_TYPE.VIDEO;

  getDefaultProps(): VideoShape["props"] {
    return {
      assetId: "",
      fileName: "video.mp4",
      mimeType: "video/mp4",
      w: 480,
      h: 330,
    };
  }

  override getGeometry(shape: VideoShape) {
    const p = shape.props as import("@shared/shapeDefs").VideoProps;
    return new Rectangle2d({
      width: p.w,
      height: p.h,
      isFilled: true,
    });
  }

  override component(shape: VideoShape) {
    const p = shape.props as import("@shared/shapeDefs").VideoProps;
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: p.w,
          height: p.h,
          overflow: "visible",
          position: "relative",
          pointerEvents: "all",
        }}
      >
        <CreatorLabel name={getCreatedBy(shape)} />
        <AssetLoader assetId={p.assetId}>
          <VideoPlayer shape={shape} />
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
        <ShapeConnectHandles shapeId={shape.id} w={p.w} h={p.h} />
      </HTMLContainer>
    );
  }

  override hideSelectionBoundsBg() {
    return true;
  }

  override indicator(shape: VideoShape) {
    const p = shape.props as import("@shared/shapeDefs").VideoProps;
    return <rect width={p.w} height={p.h} rx={12} />;
  }
}
