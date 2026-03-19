"use client";

/**
 * 動画シェイプのコントロール領域：シークバー＋再生/一時停止＋時刻＋音量。
 */

import { SeekBar } from "./SeekBar";
import { MediaVolumeSlider } from "./MediaVolumeSlider";
import { BLUE, CONTROLS_HEIGHT } from "./mediaConstants";
import { formatTime } from "@/lib/formatTime";
import type { ApiComment } from "@shared/apiTypes";

export type VideoControlsBarProps = {
  currentTime: number;
  duration: number;
  onSeek: (sec: number) => void;
  comments: ApiComment[];
  trackBg: string;
  textMuted: string;
  playing: boolean;
  onTogglePlay: () => void;
  volume: number;
  muted: boolean;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
};

export function VideoControlsBar({
  currentTime,
  duration,
  onSeek,
  comments,
  trackBg,
  textMuted,
  playing,
  onTogglePlay,
  volume,
  muted,
  onToggleMute,
  onVolumeChange,
}: VideoControlsBarProps) {
  return (
    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <SeekBar currentTime={currentTime} duration={duration} onSeek={onSeek} comments={comments} trackBg={trackBg} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: CONTROLS_HEIGHT - 10,
        }}
      >
        <button
          onClick={onTogglePlay}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginLeft: "auto",
          }}
        >
          <button
            onClick={onToggleMute}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
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
          <MediaVolumeSlider
            value={muted ? 0 : volume}
            onChange={onVolumeChange}
            accentColor={BLUE}
            trackBg={trackBg}
            width={80}
          />
        </div>
      </div>
    </div>
  );
}
