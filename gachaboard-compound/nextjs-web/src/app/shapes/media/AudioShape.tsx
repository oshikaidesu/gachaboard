"use client";

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  useEditor,
} from "@cmpd/compound";
import { resizeBox } from "@cmpd/editor";
import { useEffect, useRef, useState, useCallback } from "react";
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
import { SHAPE_TYPE, type AudioShape } from "@shared/shapeDefs";
import { useWaveform } from "@/app/hooks/useWaveform";
import { useBoardContext } from "@/app/components/board/BoardContext";
import { useBoardComments } from "@/app/components/board/BoardCommentProvider";
import { useVisibility } from "@/app/hooks/useVisibility";
import type { ApiComment } from "@shared/apiTypes";

export type { AudioShape } from "@shared/shapeDefs";

// ---------- 定数 ----------

const ORANGE = "#ff5500";
const GRAY = "#d1d5db";
const WAVEFORM_HEIGHT = 48;
const WAVEFORM_HIT_HEIGHT = 56; // タップ・クリックの当たり判定をゆるくする
const BAR_GAP = 1;
const BASE_HEIGHT = 190;
const COMMENT_ROW_HEIGHT = 32;
const COMMENT_GAP = 4;
const COMMENT_LIST_OVERHEAD = 24;
const MIN_COMMENT_LIST_H = COMMENT_LIST_OVERHEAD + COMMENT_ROW_HEIGHT + COMMENT_GAP;

/** コメントリストの最大表示高さ（超えた分はスクロール） */
const MAX_COMMENT_LIST_HEIGHT = COMMENT_LIST_OVERHEAD + 6 * (COMMENT_ROW_HEIGHT + COMMENT_GAP);

// ---------- 波形 SVG ----------

const WAVEFORM_VIEW_WIDTH = 360;

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
  const [tooltip, setTooltip] = useState<{ x: number; text: string } | null>(null);

  const barWidth = peaks.length > 0
    ? (WAVEFORM_VIEW_WIDTH - BAR_GAP * (peaks.length - 1)) / peaks.length
    : 0;
  const playedRatio = duration > 0 ? currentTime / duration : 0;
  const boundary = Math.floor(playedRatio * peaks.length);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.stopPropagation();
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
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
      return Math.abs(mouseX - pinX) < 16;
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
      style={{
        position: "relative",
        width: "100%",
        height: WAVEFORM_HIT_HEIGHT,
        display: "flex",
        alignItems: "center",
        touchAction: "none",
        cursor: duration > 0 ? "pointer" : "default",
      }}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
      onTouchStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <svg
        viewBox={`0 0 ${WAVEFORM_VIEW_WIDTH} ${WAVEFORM_HEIGHT}`}
        preserveAspectRatio="none"
        width="100%"
        height={WAVEFORM_HEIGHT}
        style={{ display: "block", pointerEvents: "none" }}
      >
        {peaks.map((peak, i) => {
          const barH = Math.max(2, peak * WAVEFORM_HEIGHT);
          const x = i * (barWidth + BAR_GAP);
          const y = (WAVEFORM_HEIGHT - barH) / 2;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={1}
              fill={i < boundary ? ORANGE : GRAY}
            />
          );
        })}
      </svg>

      {/* コメントピン — クリックでシーク（当たり判定を広く） */}
      {duration > 0 && comments.map((c) => (
        <div
          key={c.id}
          onClick={() => onSeek(c.timeSec)}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onSeek(c.timeSec); }}
          style={{
            position: "absolute",
            bottom: "50%",
            left: `calc(${(c.timeSec / duration) * 100}% - 12px)`,
            width: 24,
            height: 24,
            marginBottom: -12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: ORANGE,
            }}
          />
        </div>
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

// ---------- 音量スライダー（PointerCapture 方式） ----------

function VolumeSlider({
  value,
  onChange,
  accentColor = ORANGE,
  width = 196,
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
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 4,
          borderRadius: 2,
          background: GRAY,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const { ref: visRef } = useVisibility<HTMLDivElement>();
  const { comments, addComment, deleteComment } = useBoardComments(shape.props.assetId);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentFocused, setCommentFocused] = useState(false);
  const [isPointerOver, setIsPointerOver] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const heightUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTargetH = useRef<number>(shape.props.h);
  const userResized = useRef(false);

  const { peaks, status: waveStatus } = useWaveform(shape.props.assetId);

  const commentListH = Math.max(
    MIN_COMMENT_LIST_H,
    Math.min(
      comments.length > 0
        ? COMMENT_LIST_OVERHEAD + comments.length * (COMMENT_ROW_HEIGHT + COMMENT_GAP)
        : 0,
      MAX_COMMENT_LIST_HEIGHT,
    ),
  );
  const naturalH = BASE_HEIGHT + commentListH;

  const isCompact = shape.props.h < naturalH;

  // コメント数に応じてシェイプの高さを自動更新（ユーザーが手動リサイズしていない場合のみ）
  useEffect(() => {
    if (userResized.current) return;
    const targetH = naturalH;
    if (lastTargetH.current === targetH) return;
    lastTargetH.current = targetH;
    if (heightUpdateTimer.current) clearTimeout(heightUpdateTimer.current);
    heightUpdateTimer.current = setTimeout(() => {
      editor.updateShape({ id: shape.id, type: shape.type, props: { h: targetH } });
    }, 100);
    return () => { if (heightUpdateTimer.current) clearTimeout(heightUpdateTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);

  // ユーザーが手動でリサイズした場合を検知
  useEffect(() => {
    if (Math.abs(shape.props.h - lastTargetH.current) > 2) {
      userResized.current = true;
    }
  }, [shape.props.h]);

  // コメントが追加されたとき、スクロールモードでなければ自動拡張を再開
  const prevCommentCount = useRef(comments.length);
  useEffect(() => {
    if (comments.length > prevCommentCount.current && !isCompact) {
      userResized.current = false;
    }
    prevCommentCount.current = comments.length;
  }, [comments.length, isCompact]);

  const shortName =
    shape.props.fileName.length > 32
      ? shape.props.fileName.slice(0, 30) + "…"
      : shape.props.fileName;

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      setDeleting(commentId);
      deleteComment(commentId);
      setDeleting(null);
    },
    [deleteComment]
  );

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

  const postComment = () => {
    if (!newComment.trim()) return;
    setPosting(true);
    addComment(currentTime, newComment.trim());
    setNewComment("");
    setPosting(false);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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
        gap: 6,
        borderRadius: 9,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        padding: "10px 12px",
        boxSizing: "border-box",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ファイル名（ドラッグハンドル） */}
      <div data-drag-handle style={{ display: "flex", alignItems: "center", gap: 6, cursor: "grab" }}>
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
        <FileSizeLabel sizeBytes={shape.meta?.sizeBytes as string | undefined} />
        <DownloadButton assetId={shape.props.assetId} fileName={shape.props.fileName}
          style={{ flexShrink: 0, width: 22, height: 22, fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280" }}
        />
      </div>

      {/* 波形 */}
      {waveStatus === "loading" && (
        <div style={{
          height: WAVEFORM_HIT_HEIGHT,
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
        <div style={{ height: WAVEFORM_HIT_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>波形を読み込めませんでした</span>
        </div>
      )}

      {/* 再生コントロール */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            background: ORANGE,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#fff",
            fontSize: 11,
            touchAction: "none",
          }}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <span style={{ fontSize: 10, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          <span style={{ fontSize: 10 }}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
          <VolumeSlider
            value={volume}
            onChange={(v) => {
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            accentColor={ORANGE}
            width={196}
          />
        </div>
        {comments.length > 0 && (
          <span style={{ fontSize: 13, color: ORANGE }}>
            💬 {comments.length}
          </span>
        )}
      </div>

      {/* コメント入力（入力欄/ボタン以外は選択に） */}
      <div
        style={{ display: "flex", gap: 4, alignItems: "center" }}
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
          <span style={{ fontSize: 13, color: "#9ca3af", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
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
            border: commentFocused ? `1px solid ${ORANGE}` : "1px solid #e5e7eb",
            background: commentFocused ? "#fff" : "#f9fafb",
            color: "#111827",
            outline: "none",
            minWidth: 0,
            transition: "border-color 0.15s, padding 0.15s",
            boxShadow: commentFocused ? `0 0 0 2px ${ORANGE}33` : "none",
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
              background: ORANGE,
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

      {/* コメントリスト（項目クリックはシークに、余白クリックは選択に） */}
      {comments.length > 0 && (
        <div
          className="comment-list"
          style={{
            borderTop: "1px solid #f3f4f6",
            paddingTop: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: isCompact ? 1 : undefined,
            minHeight: 0,
            overflowY: "auto",
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
          {comments.map((c: ApiComment) => {
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
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <span style={{
                  fontSize: 13,
                  color: ORANGE,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                  fontWeight: 600,
                }}>
                  {timeStr}
                </span>
                <span style={{
                  fontSize: 14,
                  color: "#374151",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {c.body}
                </span>
                <span style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  flexShrink: 0,
                }}>
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
                    color: "#9ca3af",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 4px",
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
      h: BASE_HEIGHT + MIN_COMMENT_LIST_H,
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
    const editor = useEditor();
    const isWav =
      shape.props.mimeType === "audio/wav" ||
      shape.props.fileName.endsWith(".wav");
    const strokeHex = getStrokeHexForColorStyle(getColorForShape(shape.id));
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
        <AssetLoader assetId={shape.props.assetId} converted={isWav} fileName={shape.props.fileName}>
          <AudioPlayer shape={shape} />
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
        <ShapeConnectHandles shapeId={shape.id} w={shape.props.w} h={shape.props.h} />
      </HTMLContainer>
    );
  }

  override onResize = (shape: AudioShape, info: Parameters<typeof resizeBox>[1]) => {
    return resizeBox(shape, info, { minWidth: 280, minHeight: BASE_HEIGHT + MIN_COMMENT_LIST_H });
  };

  override hideSelectionBoundsBg = () => true;

  override indicator(shape: AudioShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} />;
  }
}
