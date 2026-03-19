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
import { SHAPE_TYPE, type VideoShape } from "@shared/shapeDefs";
import { convertToFileIcon } from "@/app/shapes";
import { useBoardContext } from "@/app/components/board/BoardContext";
import { useVisibility } from "@/app/hooks/useVisibility";
import { useMediaPlayerComments, MIN_COMMENT_LIST_H } from "@/app/hooks/media/useMediaPlayerComments";
import { useTheme } from "@/app/components/theme/ThemeProvider";
import { getSafeAssetId } from "@/lib/safeUrl";
import { MediaCommentInput } from "./MediaCommentInput";
import { MediaCommentList } from "./MediaCommentList";
import { VideoControlsBar } from "./VideoControlsBar";
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
  HEADER_HEIGHT,
  VIDEO_UI_OVERHEAD,
  VIDEO_DEFAULT_W,
  VIDEO_DEFAULT_H,
  VIDEO_MAX_W,
  VIDEO_MAX_H,
} from "./mediaConstants";
import type { ApiComment } from "@shared/apiTypes";

export type { VideoShape } from "@shared/shapeDefs";
export { MIN_COMMENT_LIST_H } from "@/app/hooks/media/useMediaPlayerComments";
export { VIDEO_UI_OVERHEAD } from "./mediaConstants";

/** タッチで変換した直後の click 二重実行を防ぐため */
const lastTouchEndByShapeId = new Map<string, number>();

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
  if (!safeAssetId) {
    srcRef.current = null;
  } else if (!srcRef.current || srcRef.current.assetId !== safeAssetId) {
    srcRef.current = { assetId: safeAssetId, src: `/api/assets/${safeAssetId}/file?v=${Date.now()}` };
  }
  const stableSrc = srcRef.current?.src ?? "";

  const editor = useEditor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref: visRef, visible } = useVisibility<HTMLDivElement>({ rootMargin: "300px" });
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
          if (t.tagName === "BUTTON" || t.tagName === "VIDEO" || playing) e.stopPropagation();
        }}
        onPointerDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "BUTTON" || t.tagName === "VIDEO" || playing) e.stopPropagation();
        }}
        onTouchStart={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "BUTTON" || t.tagName === "VIDEO" || playing) e.stopPropagation();
        }}
        onClick={(e) => {
          if (playing) {
            e.stopPropagation();
            togglePlay();
          }
        }}
        onTouchEnd={(e) => {
          if (playing) {
            e.stopPropagation();
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
            onTouchEnd={(e) => { e.stopPropagation(); togglePlay(); }}
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
        {visible && stableSrc ? (
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
        ) : safeAssetId ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: `url(/api/assets/${safeAssetId}/thumbnail)`,
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        ) : null}
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
        <VideoControlsBar
          currentTime={currentTime}
          duration={duration}
          onSeek={seekTo}
          comments={comments}
          trackBg={trackBg}
          textMuted={textMuted}
          playing={playing}
          onTogglePlay={togglePlay}
          volume={volume}
          muted={muted}
          onToggleMute={toggleMute}
          onVolumeChange={handleVolumeChange}
        />

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
        <AssetLoader assetId={p.assetId} fileName={p.fileName}>
          <VideoPlayer shape={shape} />
        </AssetLoader>
        <ShapeReactionPanel shapeId={shape.id} />
        <ShapeConnectHandles shapeId={shape.id} w={p.w} h={p.h} />
      </HTMLContainer>
    );
  }

  override onResize = (shape: VideoShape & TLBaseBoxShape, info: Parameters<typeof resizeBox>[1]) => {
    const { scaleX, scaleY, handle } = info;
    const p = shape.props as import("@shared/shapeDefs").VideoProps;
    const result = resizeBox(shape, info, {
      minWidth: VIDEO_DEFAULT_W,
      minHeight: VIDEO_DEFAULT_H,
      maxWidth: VIDEO_MAX_W,
      maxHeight: VIDEO_MAX_H,
    });
    // max クランプ時、resizeBox は位置を補正しないため、アンカーを固定するよう自前で補正
    const rawW = p.w * scaleX;
    const rawH = p.h * scaleY;
    const clampedW = (result.props as import("@shared/shapeDefs").VideoProps).w;
    const clampedH = (result.props as import("@shared/shapeDefs").VideoProps).h;
    const hitMax = rawW > VIDEO_MAX_W || rawH > VIDEO_MAX_H;
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

  override hideSelectionBoundsBg = () => true;

  override indicator(shape: VideoShape) {
    const p = shape.props as import("@shared/shapeDefs").VideoProps;
    return <rect width={p.w} height={p.h} rx={12} />;
  }
}
