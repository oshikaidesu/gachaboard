"use client";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  type TLBaseBoxShape,
} from "@cmpd/compound";
import { resizeBox } from "@cmpd/editor";
import { useRef, useState, useCallback, useEffect } from "react";
import { useEditor } from "@cmpd/compound";
import {
  CreatorLabel,
  getCreatedBy,
  getCreationRank,
  ShapeReactionPanel,
  ShapeConnectHandles,
  AssetLoader,
  WheelGuard,
  DownloadButton,
  FileSizeLabel,
  getColorForShape,
  getStrokeHexForColorStyle,
} from "../common";
import { SHAPE_TYPE, type VideoShape } from "@shared/shapeDefs";
import { useBoardContext } from "@/app/components/board/BoardContext";
import { useBoardComments } from "@/app/components/board/BoardCommentProvider";
import { useVisibility } from "@/app/hooks/useVisibility";
import type { ApiComment } from "@shared/apiTypes";

export type { VideoShape } from "@shared/shapeDefs";

// ---------- 定数 ----------

const BLUE = "#3b82f6";
const TRACK_BG = "#e2e8f0";
const BG = "#ffffff";
const TEXT_PRIMARY = "#1e293b";
const TEXT_MUTED = "#64748b";
const SEEK_BAR_HEIGHT = 6;
const SEEK_BAR_HIT_HEIGHT = 28; // クリック・ドラッグの当たり判定をゆるくする
const CONTROLS_HEIGHT = 36;
const HEADER_HEIGHT = 26;
const COMMENT_ROW_HEIGHT = 32;
const COMMENT_GAP = 4;
const COMMENT_LIST_OVERHEAD = 28;

/**
 * 動画エリア以外の UI（ヘッダー・コントロール・コメント入力欄）の合計高さ。
 * シェイプの h = 動画エリアの高さ + VIDEO_UI_OVERHEAD になる。
 *
 * 内訳:
 *   Header   : HEADER_HEIGHT(26) + borderBottom(1) = 27
 *   Controls : borderTop(1) + padTop(6) + seekbar(28) + gap(6) + buttons(26) + padBot(8) = 75
 *   Comment  : input(~30) + padBot(6) = 36
 *   Border   : WheelGuard の border-box border 上下各 1px = 2
 */
export const VIDEO_UI_OVERHEAD =
  (HEADER_HEIGHT + 1) +
  (1 + 6 + SEEK_BAR_HIT_HEIGHT + 6 + (CONTROLS_HEIGHT - 10) + 8) +
  (30 + 6) +
  2;

export const MIN_COMMENT_LIST_H =
  COMMENT_LIST_OVERHEAD + COMMENT_ROW_HEIGHT + COMMENT_GAP;

/** コメントリストの最大表示高さ（超えた分はスクロール） */
const MAX_COMMENT_LIST_HEIGHT = COMMENT_LIST_OVERHEAD + 6 * (COMMENT_ROW_HEIGHT + COMMENT_GAP);

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
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        width: "100%",
        height: SEEK_BAR_HIT_HEIGHT,
        display: "flex",
        alignItems: "center",
        cursor: duration > 0 ? "pointer" : "default",
        flexShrink: 0,
        touchAction: "none",
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

// ---------- 音量スライダー（PointerCapture 方式） ----------

function VolumeSlider({
  value,
  onChange,
  accentColor = BLUE,
  width = 80,
}: {
  value: number;
  onChange: (v: number) => void;
  accentColor?: string;
  width?: number;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const calcValue = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar) return value;
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [value]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    onChange(calcValue(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!dragging) return;
    onChange(calcValue(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDragging(false);
  };

  const pct = Math.max(0, Math.min(100, value * 100));

  return (
    <div
      ref={barRef}
      data-volume-slider
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        width,
        height: 28,
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        touchAction: "none",
        pointerEvents: "auto",
      }}
    >
      {/* トラック背景 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 4,
          borderRadius: 2,
          background: TRACK_BG,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: accentColor,
            borderRadius: 2,
            transition: dragging ? "none" : "width 0.05s linear",
          }}
        />
      </div>
      {/* つまみ */}
      <div
        style={{
          position: "absolute",
          left: `calc(${pct}% - 6px)`,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: accentColor,
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: dragging ? "none" : "left 0.05s linear",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ---------- メインプレイヤー ----------

function VideoPlayer({ shape }: { shape: VideoShape }) {
  const props = shape.props as import("@shared/shapeDefs").VideoProps;
  // assetId をキーにしてキャッシュバスト済み src を生成する。
  // useRef で「前回の assetId」を追跡し、変わった時だけ新しい timestamp を生成する。
  const srcRef = useRef<{ assetId: string; src: string } | null>(null);
  if (!srcRef.current || srcRef.current.assetId !== props.assetId) {
    srcRef.current = { assetId: props.assetId, src: `/api/assets/${props.assetId}/file?v=${Date.now()}` };
  }
  const stableSrc = srcRef.current.src;

  const { boardId, workspaceId } = useBoardContext();
  const editor = useEditor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const { ref: visRef } = useVisibility<HTMLDivElement>();
  const { comments, addComment, deleteComment } = useBoardComments(props.assetId);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentFocused, setCommentFocused] = useState(false);
  const [isPointerOver, setIsPointerOver] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const heightUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTargetH = useRef<number>(props.h);
  const userResized = useRef(false);

  const videoAreaH = Math.round(props.w / aspectRatio);
  const commentListH = Math.max(
    MIN_COMMENT_LIST_H,
    Math.min(
      comments.length > 0
        ? COMMENT_LIST_OVERHEAD + comments.length * (COMMENT_ROW_HEIGHT + COMMENT_GAP)
        : 0,
      MAX_COMMENT_LIST_HEIGHT,
    ),
  );
  const naturalH = videoAreaH + VIDEO_UI_OVERHEAD + commentListH;

  const isCompact = props.h < naturalH;

  const shortName =
    props.fileName.length > 36
      ? props.fileName.slice(0, 34) + "…"
      : props.fileName;

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      setDeleting(commentId);
      deleteComment(commentId);
      setDeleting(null);
    },
    [deleteComment]
  );

  // コメント数・アスペクト比に応じてシェイプの高さを自動更新（ユーザーが手動リサイズしていない場合のみ）
  useEffect(() => {
    if (userResized.current) return;
    const targetH = naturalH;
    if (props.h === targetH && lastTargetH.current === targetH) return;
    if (heightUpdateTimer.current) clearTimeout(heightUpdateTimer.current);
    heightUpdateTimer.current = setTimeout(() => {
      lastTargetH.current = targetH;
      editor.updateShape({ id: shape.id, type: shape.type, props: { h: targetH } });
    }, 100);
    return () => { if (heightUpdateTimer.current) clearTimeout(heightUpdateTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length, naturalH]);

  // ユーザーが手動でリサイズした場合を検知
  useEffect(() => {
    if (Math.abs(props.h - lastTargetH.current) > 2) {
      userResized.current = true;
    }
  }, [props.h]);

  // コメントが追加されたとき、スクロールモードでなければ自動拡張を再開
  const prevCommentCount = useRef(comments.length);
  useEffect(() => {
    if (comments.length > prevCommentCount.current && !isCompact) {
      userResized.current = false;
    }
    prevCommentCount.current = comments.length;
  }, [comments.length, isCompact]);

  const postComment = () => {
    if (!newComment.trim()) return;
    setPosting(true);
    addComment(currentTime, newComment.trim());
    setNewComment("");
    setPosting(false);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      // play() が pending 中に pause() が呼ばれると AbortError になるため無視する
      video.play().catch((e) => {
        if (e?.name !== "AbortError") console.error(e);
      });
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

  const handleVolumeChange = (v: number) => {
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

  // スペースキーで再生/一時停止（選択中 or カーソル乗せ時・コメント入力中は除外）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " || commentFocused) return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) return;
      const canControl = editor.getSelectedShapeIds().includes(shape.id) || isPointerOver;
      if (!canControl) return;
      e.preventDefault();
      e.stopPropagation();
      togglePlay();
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [shape.id, commentFocused, editor, isPointerOver, playing]);

  // シェイプ外タップでコメント入力を解除
  useEffect(() => {
    const handleOutsideTouch = (e: MouseEvent | TouchEvent) => {
      const container = containerRef.current;
      const input = commentInputRef.current;
      if (!container || !input) return;
      const target = e instanceof TouchEvent ? e.touches[0]?.target : e.target;
      if (target && !container.contains(target as Node)) {
        input.blur();
        setCommentFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideTouch, true);
    document.addEventListener("touchstart", handleOutsideTouch, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutsideTouch, true);
      document.removeEventListener("touchstart", handleOutsideTouch, true);
    };
  }, []);

  return (
    <WheelGuard
      ref={(node) => {
        (visRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      onPointerEnter={() => setIsPointerOver(true)}
      onPointerLeave={() => setIsPointerOver(false)}
      shapeId={shape.id}
      selectOnEmptyClick
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderRadius: 12,
        background: BG,
        border: "1px solid #e2e8f0",
        boxSizing: "border-box",
        boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
        fontFamily: "system-ui, sans-serif",
        color: TEXT_PRIMARY,
      }}
    >
      {/* ヘッダー（ドラッグハンドル） */}
      <div
        data-drag-handle
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: HEADER_HEIGHT,
          flexShrink: 0,
          padding: "0 10px",
          borderBottom: "1px solid #f1f5f9",
          cursor: "grab",
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
        <FileSizeLabel sizeBytes={shape.meta?.sizeBytes as string | undefined} />
        <DownloadButton assetId={props.assetId} fileName={props.fileName}
          style={{ flexShrink: 0, width: 20, height: 20, fontSize: 10, background: "#f1f5f9", border: "1px solid #e2e8f0", color: TEXT_MUTED }}
        />
      </div>

      {/* 動画エリア */}
      <div
        style={{
          height: videoAreaH,
          flexShrink: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          touchAction: "none",
          backgroundImage:
            "linear-gradient(45deg, #e8e8e8 25%, transparent 25%, transparent 75%, #e8e8e8 75%)," +
            "linear-gradient(45deg, #e8e8e8 25%, transparent 25%, transparent 75%, #e8e8e8 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 8px 8px",
          backgroundColor: "#f4f4f4",
        }}
        onMouseDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "BUTTON" || t.tagName === "VIDEO") e.stopPropagation();
        }}
        onPointerDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "BUTTON" || t.tagName === "VIDEO") e.stopPropagation();
        }}
        onTouchStart={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "BUTTON" || t.tagName === "VIDEO") e.stopPropagation();
        }}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if ((t.tagName === "BUTTON" || t.tagName === "VIDEO") && playing) togglePlay();
        }}
        onTouchEnd={(e) => {
          const t = e.target as HTMLElement;
          if ((t.tagName === "BUTTON" || t.tagName === "VIDEO") && playing) {
            e.stopPropagation();
            e.preventDefault();
            togglePlay();
          }
        }}
      >
        {/* 再生オーバーレイボタン（未再生時のみ表示） */}
        {!playing && (
          <button
            onClick={togglePlay}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); togglePlay(); }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(59,130,246,0.85)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 22,
              boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
              touchAction: "none",
            }}
          >
            ▶
          </button>
        )}
        <video
          ref={videoRef}
          src={stableSrc}
          poster={`/api/assets/${props.assetId}/thumbnail`}
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
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (v?.videoWidth && v?.videoHeight) {
              const ar = v.videoWidth / v.videoHeight;
              setAspectRatio(ar);
              editor.updateShape({
                id: shape.id,
                type: shape.type,
                meta: { ...shape.meta, aspectRatio: ar },
              });
            }
            setDuration(v?.duration ?? 0);
          }}
          onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>

      {/* コントロールエリア */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "6px 10px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          background: BG,
          borderTop: "1px solid #f1f5f9",
        }}
      >
        {/* シークバー＋ボタン＋入力（まとめて flexShrink: 0） */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
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
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); togglePlay(); }}
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
              touchAction: "none",
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
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); toggleMute(); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                padding: 0,
                lineHeight: 1,
                color: TEXT_MUTED,
                touchAction: "none",
              }}
            >
              {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <VolumeSlider
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              accentColor={BLUE}
              width={80}
            />
          </div>
        </div>

        {/* コメント入力（入力欄/ボタン以外は選択に） */}
        <div
        style={{ display: "flex", gap: 4, alignItems: "center", padding: "0 10px 6px", flexShrink: 0 }}
        onMouseDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "INPUT" || t.tagName === "BUTTON" || t.tagName === "SPAN") e.stopPropagation();
        }}
        onPointerDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "INPUT" || t.tagName === "BUTTON" || t.tagName === "SPAN") e.stopPropagation();
        }}
      >
        {commentFocused && (
          <span style={{ fontSize: 13, color: TEXT_MUTED, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
            {formatTime(currentTime)}
          </span>
        )}
        <input
          ref={commentInputRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { postComment(); commentInputRef.current?.blur(); setCommentFocused(false); }
            if (e.key === "Escape") { commentInputRef.current?.blur(); setCommentFocused(false); setNewComment(""); }
          }}
          onFocus={() => setCommentFocused(true)}
          onBlur={() => setCommentFocused(false)}
          onTouchEnd={(e) => { e.stopPropagation(); commentInputRef.current?.focus(); }}
          placeholder={commentFocused ? "コメントを追加..." : "💬 コメント"}
          style={{
            flex: 1,
            fontSize: 14,
            padding: commentFocused ? "6px 10px" : "5px 8px",
            borderRadius: 4,
            border: commentFocused ? `1px solid ${BLUE}` : "1px solid #e2e8f0",
            background: commentFocused ? "#fff" : "#f8fafc",
            color: TEXT_PRIMARY,
            outline: "none",
            minWidth: 0,
            transition: "border-color 0.15s, padding 0.15s",
            boxShadow: commentFocused ? `0 0 0 2px ${BLUE}33` : "none",
          }}
        />
        {commentFocused && (
          <button
            onClick={() => { postComment(); setCommentFocused(false); }}
            disabled={posting || !newComment.trim()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); postComment(); setCommentFocused(false); }}
            style={{
              fontSize: 13,
              padding: "5px 12px",
              borderRadius: 4,
              border: "none",
              background: BLUE,
              color: "#fff",
              cursor: "pointer",
              flexShrink: 0,
              opacity: posting || !newComment.trim() ? 0.4 : 1,
              touchAction: "none",
            }}
          >
            投稿
          </button>
        )}
        </div>
      </div>

      {/* コメントリスト（項目クリックはシークに、余白クリックは選択に） */}
      {comments.length > 0 && (
        <div
          className="comment-list"
          style={{
            borderTop: "1px solid #f1f5f9",
            padding: "4px 10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: isCompact ? 1 : undefined,
            minHeight: 0,
            overflowY: "auto" as const,
            touchAction: "pan-y",
          }}
          onMouseDown={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("[data-comment-row]") || t.closest("button")) e.stopPropagation();
          }}
          onPointerDown={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("[data-comment-row]") || t.closest("button")) e.stopPropagation();
          }}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {comments.map((c) => {
            const m = Math.floor(c.timeSec / 60);
            const s = Math.floor(c.timeSec % 60);
            const timeStr = `${m}:${s.toString().padStart(2, "0")}`;
            return (
              <div
                key={c.id}
                data-comment-row
                onClick={() => seekTo(c.timeSec)}
                onTouchEnd={(e) => { e.stopPropagation(); seekTo(c.timeSec); }}
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
                <span style={{ fontSize: 13, color: BLUE, fontVariantNumeric: "tabular-nums", flexShrink: 0, fontWeight: 600 }}>
                  {timeStr}
                </span>
                <span style={{ fontSize: 14, color: TEXT_PRIMARY, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.body}
                </span>
                <span style={{ fontSize: 12, color: TEXT_MUTED, flexShrink: 0 }}>
                  {c.author.discordName}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteComment(c.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteComment(c.id); }}
                  disabled={deleting === c.id}
                  style={{
                    fontSize: 13,
                    color: TEXT_MUTED,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 2px",
                    flexShrink: 0,
                    opacity: deleting === c.id ? 0.3 : 0.6,
                    touchAction: "none",
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </WheelGuard>
  );
}

// ---------- ShapeUtil ----------

export class VideoShapeUtil extends BaseBoxShapeUtil<VideoShape & TLBaseBoxShape> {
  static override type = SHAPE_TYPE.VIDEO;

  getDefaultProps(): VideoShape["props"] {
    const w = 480;
    const videoAreaH = Math.round(w / (16 / 9));
    return {
      assetId: "",
      fileName: "video.mp4",
      mimeType: "video/mp4",
      w,
      h: videoAreaH + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H,
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
    const editor = useEditor();
    const p = shape.props as import("@shared/shapeDefs").VideoProps;
    const strokeHex = getStrokeHexForColorStyle(getColorForShape(shape.id));
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: p.w,
          height: p.h,
          overflow: "visible",
          position: "relative",
          pointerEvents: "all",
          border: `3px solid ${strokeHex}`,
          borderRadius: 12,
          boxSizing: "border-box",
        }}
        onPointerDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest?.("[data-drag-handle]") || t.hasAttribute?.("data-shape-frame")) return;
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest?.("[data-drag-handle]") || t.hasAttribute?.("data-shape-frame")) return;
          e.stopPropagation();
        }}
      >
        <CreatorLabel name={getCreatedBy(shape)} rank={getCreationRank(editor, shape)} />
        <AssetLoader assetId={p.assetId} fileName={p.fileName}>
          <VideoPlayer shape={shape} />
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
        <ShapeConnectHandles shapeId={shape.id} w={p.w} h={p.h} />
      </HTMLContainer>
    );
  }

  override onResize = (shape: VideoShape & TLBaseBoxShape, info: Parameters<typeof resizeBox>[1]) => {
    const p = shape.props as import("@shared/shapeDefs").VideoProps;
    const ar = (shape.meta as { aspectRatio?: number } | undefined)?.aspectRatio ?? 16 / 9;
    const minVideoH = Math.ceil(p.w / ar);
    return resizeBox(shape, info, { minWidth: 240, minHeight: minVideoH + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H });
  };

  override hideSelectionBoundsBg = () => true;

  override indicator(shape: VideoShape) {
    const p = shape.props as import("@shared/shapeDefs").VideoProps;
    return <rect width={p.w} height={p.h} rx={12} />;
  }
}
