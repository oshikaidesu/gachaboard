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
import { useVisibility } from "@/app/hooks/useVisibility";
import { useMediaPlayerComments, MIN_COMMENT_LIST_H } from "@/app/hooks/media/useMediaPlayerComments";
import { formatTime } from "@/lib/formatTime";
import { useTheme } from "@/app/components/theme/ThemeProvider";
import { getSafeAssetId } from "@/lib/safeUrl";
import { MediaCommentInput } from "./MediaCommentInput";
import { MediaCommentList } from "./MediaCommentList";
import { SeekBar } from "./SeekBar";
import {
  BLUE,
  TRACK_BG_LIGHT,
  TRACK_BG_DARK,
  BG_LIGHT,
  BG_DARK,
  TEXT_PRIMARY_LIGHT,
  TEXT_PRIMARY_DARK,
  TEXT_MUTED_LIGHT,
  TEXT_MUTED_DARK,
  BORDER_LIGHT,
  BORDER_DARK,
  BORDER_SUBTLE_LIGHT,
  BORDER_SUBTLE_DARK,
  CHECKER_LIGHT,
  CHECKER_DARK,
  CHECKER_BG_LIGHT,
  CHECKER_BG_DARK,
  CONTROLS_HEIGHT,
  HEADER_HEIGHT,
  SEEK_BAR_HIT_HEIGHT,
} from "./mediaConstants";
import type { ApiComment } from "@shared/apiTypes";

export type { VideoShape } from "@shared/shapeDefs";
export { MIN_COMMENT_LIST_H } from "@/app/hooks/media/useMediaPlayerComments";

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

// ---------- 音量スライダー（PointerCapture 方式） ----------

function VolumeSlider({
  value,
  onChange,
  accentColor = BLUE,
  trackBg,
  width = 80,
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
      {/* トラック背景 */}
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
  const { isDarkMode } = useTheme();
  const props = shape.props as import("@shared/shapeDefs").VideoProps;
  const safeAssetId = getSafeAssetId(props.assetId);

  const bg = isDarkMode ? BG_DARK : BG_LIGHT;
  const textPrimary = isDarkMode ? TEXT_PRIMARY_DARK : TEXT_PRIMARY_LIGHT;
  const textMuted = isDarkMode ? TEXT_MUTED_DARK : TEXT_MUTED_LIGHT;
  const border = isDarkMode ? BORDER_DARK : BORDER_LIGHT;
  const borderSubtle = isDarkMode ? BORDER_SUBTLE_DARK : BORDER_SUBTLE_LIGHT;
  const trackBg = isDarkMode ? TRACK_BG_DARK : TRACK_BG_LIGHT;
  const checker = isDarkMode ? CHECKER_DARK : CHECKER_LIGHT;
  const checkerBg = isDarkMode ? CHECKER_BG_DARK : CHECKER_BG_LIGHT;
  const srcRef = useRef<{ assetId: string; src: string } | null>(null);
  if (safeAssetId && (!srcRef.current || srcRef.current.assetId !== safeAssetId)) {
    srcRef.current = { assetId: safeAssetId, src: `/api/assets/${safeAssetId}/file?v=${Date.now()}` };
  }
  const stableSrc = srcRef.current?.src ?? "";

  const editor = useEditor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref: visRef } = useVisibility<HTMLDivElement>();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const heightUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTargetH = useRef<number>(props.h);
  const userResized = useRef(false);

  const seekTo = useCallback((sec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = sec;
    setCurrentTime(sec);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      video.play().catch((e) => {
        if (e?.name !== "AbortError") console.error(e);
      });
    }
  }, [playing]);

  const commentsHook = useMediaPlayerComments({
    assetId: props.assetId,
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

  const videoAreaH = Math.round(props.w / aspectRatio);
  const naturalH = videoAreaH + VIDEO_UI_OVERHEAD + commentListH;

  const isCompact = props.h < naturalH;

  const shortName =
    props.fileName.length > 36
      ? props.fileName.slice(0, 34) + "…"
      : props.fileName;

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, []);

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
        gap: 0,
        borderRadius: 9,
        background: bg,
        border: `1px solid ${border}`,
        boxSizing: "border-box",
        boxShadow: isDarkMode ? "0 1px 6px rgba(0,0,0,0.4)" : "0 1px 6px rgba(0,0,0,0.1)",
        fontFamily: "system-ui, sans-serif",
        color: textPrimary,
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
          borderBottom: `1px solid ${borderSubtle}`,
          cursor: "grab",
        }}
      >
        <span style={{ fontSize: 12, flexShrink: 0, color: BLUE }}>▶</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {shortName}
        </span>
        <FileSizeLabel sizeBytes={shape.meta?.sizeBytes as string | undefined} />
        {safeAssetId && (
          <DownloadButton assetId={safeAssetId} fileName={props.fileName}
            style={{ flexShrink: 0, width: 20, height: 20, fontSize: 10, background: isDarkMode ? "#334155" : "#f1f5f9", border: `1px solid ${border}`, color: textMuted }}
          />
        )}
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
            `linear-gradient(45deg, ${checker} 25%, transparent 25%, transparent 75%, ${checker} 75%),` +
            `linear-gradient(45deg, ${checker} 25%, transparent 25%, transparent 75%, ${checker} 75%)`,
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 8px 8px",
          backgroundColor: checkerBg,
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
          poster={safeAssetId ? `/api/assets/${safeAssetId}/thumbnail` : undefined}
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
          background: bg,
          borderTop: `1px solid ${borderSubtle}`,
        }}
      >
        {/* シークバー＋ボタン＋入力（まとめて flexShrink: 0） */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <SeekBar currentTime={currentTime} duration={duration} onSeek={seekTo} comments={comments} trackBg={trackBg} />

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
              color: textMuted,
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
                color: textMuted,
                touchAction: "none",
              }}
            >
              {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <VolumeSlider
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              accentColor={BLUE}
              trackBg={trackBg}
              width={80}
            />
          </div>
        </div>
        </div>

        {/* コメント入力 */}
        <div style={{ padding: "0 10px 6px", flexShrink: 0 }}>
          <MediaCommentInput
            accentColor={BLUE}
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
        </div>

        {/* コメントリスト */}
        <MediaCommentList
          comments={comments}
          accentColor={BLUE}
          syncAvailable={syncAvailable}
          isCompact={isCompact}
          commentRowHeight={COMMENT_ROW_HEIGHT}
          onSeek={seekTo}
          onDelete={handleDeleteComment}
          deleting={deleting}
        />
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
