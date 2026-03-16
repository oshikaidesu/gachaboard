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
  getCreatedByAvatarUrl,
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
import { convertToFileIcon } from "@/app/shapes";
import { useWaveform } from "@/app/hooks/media/useWaveform";
import { useVisibility } from "@/app/hooks/useVisibility";
import { useMediaPlayerComments } from "@/app/hooks/media/useMediaPlayerComments";
import { formatTime } from "@/lib/formatTime";
import { useTheme } from "@/app/components/theme/ThemeProvider";
import { getSafeAssetId } from "@/lib/safeUrl";
import { MediaCommentInput } from "./MediaCommentInput";
import { MediaCommentList } from "./MediaCommentList";
import { WaveformCanvas } from "./WaveformCanvas";
import {
  ORANGE,
  GRAY_LIGHT,
  GRAY_DARK,
  BG_LIGHT,
  BG_DARK,
  TEXT_LIGHT,
  TEXT_DARK,
  MUTED_LIGHT,
  MUTED_DARK,
  BORDER_LIGHT,
  BORDER_DARK,
  SKELETON_LIGHT,
  SKELETON_DARK,
  WAVEFORM_HIT_HEIGHT,
  BASE_HEIGHT,
  AUDIO_DEFAULT_W,
  AUDIO_DEFAULT_H,
} from "./mediaConstants";

export type { AudioShape } from "@shared/shapeDefs";

/** タッチで変換した直後の click 二重実行を防ぐため */
const lastTouchEndByShapeId = new Map<string, number>();

// ---------- 音量スライダー（PointerCapture 方式） ----------

function VolumeSlider({
  value,
  onChange,
  accentColor = ORANGE,
  trackBg,
  width = 196,
}: {
  value: number;
  onChange: (v: number) => void;
  accentColor?: string;
  trackBg: string;
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
          background: trackBg,
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
  const { isDarkMode } = useTheme();
  const safeAssetId = getSafeAssetId(shape.props.assetId);

  const bg = isDarkMode ? BG_DARK : BG_LIGHT;
  const text = isDarkMode ? TEXT_DARK : TEXT_LIGHT;
  const muted = isDarkMode ? MUTED_DARK : MUTED_LIGHT;
  const border = isDarkMode ? BORDER_DARK : BORDER_LIGHT;
  const trackBg = isDarkMode ? GRAY_DARK : GRAY_LIGHT;
  const skeletonBg = isDarkMode ? SKELETON_DARK : SKELETON_LIGHT;
  const errorColor = isDarkMode ? "#94a3b8" : "#9ca3af";
  const btnBg = isDarkMode ? "#334155" : "#f3f4f6";
  const btnBorder = isDarkMode ? "#475569" : "#e5e7eb";

  const isWav =
    shape.props.mimeType === "audio/wav" ||
    shape.props.fileName.endsWith(".wav");
  const src = safeAssetId
    ? (isWav ? `/api/assets/${safeAssetId}/file?converted=1` : `/api/assets/${safeAssetId}/file`)
    : "";

  const editor = useEditor();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { ref: visRef } = useVisibility<HTMLDivElement>();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const heightUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTargetH = useRef<number>(shape.props.h);
  const userResized = useRef(false);

  const seekTo = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = sec;
    setCurrentTime(sec);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
  }, [playing]);

  const commentsHook = useMediaPlayerComments({
    assetId: shape.props.assetId,
    currentTime,
    shapeId: shape.id,
    onSeek: seekTo,
    onTogglePlay: togglePlay,
  });
  const {
    comments,
    newComment,
    setNewComment,
    postComment,
    posting,
    commentFocused,
    setCommentFocused,
    commentInputRef,
    setContainerRef,
    commentListH,
    handleDeleteComment,
    deleting,
    syncAvailable,
    isPointerOver,
    setIsPointerOver,
    COMMENT_ROW_HEIGHT,
  } = commentsHook;

  const { peaks, status: waveStatus } = useWaveform(shape.props.assetId);

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

  return (
    <WheelGuard
      ref={(node) => {
        visRef(node);
        setContainerRef(node);
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
        background: bg,
        border: `1px solid ${border}`,
        padding: "10px 12px",
        boxSizing: "border-box",
        boxShadow: isDarkMode ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.08)",
        fontFamily: "system-ui, sans-serif",
        color: text,
      }}
    >
      {/* ファイル名（ドラッグハンドル） */}
      <div data-drag-handle style={{ display: "flex", alignItems: "center", gap: 6, cursor: "grab" }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>🎵</span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}>
          {shortName}
        </span>
        <FileSizeLabel sizeBytes={shape.meta?.sizeBytes as string | undefined} />
        {safeAssetId && (
          <DownloadButton assetId={safeAssetId} fileName={shape.props.fileName}
            style={{ flexShrink: 0, width: 22, height: 22, fontSize: 11, background: btnBg, border: `1px solid ${btnBorder}`, color: muted }}
          />
        )}
      </div>

      {/* 波形 */}
      {waveStatus === "loading" && (
        <div style={{
          height: WAVEFORM_HIT_HEIGHT,
          borderRadius: 4,
          background: skeletonBg,
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
          unplayedBarColor={trackBg}
        />
      )}
      {waveStatus === "error" && (
        <div style={{ height: WAVEFORM_HIT_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: errorColor }}>波形を読み込めませんでした</span>
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
        <span style={{ fontSize: 10, color: muted, fontVariantNumeric: "tabular-nums" }}>
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
            trackBg={trackBg}
            width={196}
          />
        </div>
        {comments.length > 0 && (
          <span style={{ fontSize: 13, color: ORANGE }}>
            💬 {comments.length}
          </span>
        )}
      </div>

      {/* コメント入力 */}
      <MediaCommentInput
        accentColor={ORANGE}
        syncAvailable={syncAvailable}
        commentFocused={commentFocused}
        currentTime={currentTime}
        newComment={newComment}
        onNewCommentChange={setNewComment}
        onPostComment={postComment}
        posting={posting}
        commentInputRef={commentInputRef}
        onFocus={() => setCommentFocused(true)}
        onBlur={() => setCommentFocused(false)}
        onCommentFocusedChange={setCommentFocused}
      />

      {/* コメントリスト */}
      <MediaCommentList
        comments={comments}
        accentColor={ORANGE}
        syncAvailable={syncAvailable}
        isCompact={isCompact}
        commentRowHeight={COMMENT_ROW_HEIGHT}
        onSeek={seekTo}
        onDelete={handleDeleteComment}
        deleting={deleting}
      />

      {/* hidden audio element - src が空のときは要素を出さず NotSupportedError を防ぐ */}
      {src && (
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
      )}
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
      w: AUDIO_DEFAULT_W,
      h: AUDIO_DEFAULT_H,
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
                e.preventDefault();
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
        <AssetLoader assetId={shape.props.assetId} converted={isWav} fileName={shape.props.fileName}>
          <AudioPlayer shape={shape} />
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
        <ShapeConnectHandles shapeId={shape.id} w={shape.props.w} h={shape.props.h} />
      </HTMLContainer>
    );
  }

  override onResize = (shape: AudioShape, info: Parameters<typeof resizeBox>[1]) => {
    return resizeBox(shape, info, { minWidth: AUDIO_DEFAULT_W, minHeight: AUDIO_DEFAULT_H });
  };

  override hideSelectionBoundsBg = () => true;

  override indicator(shape: AudioShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} />;
  }
}
