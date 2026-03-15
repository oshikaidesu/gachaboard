"use client";

import { ORANGE, WAVEFORM_HEIGHT, WAVEFORM_VIEW_WIDTH, BAR_GAP } from "./mediaConstants";
import type { ApiComment } from "@shared/apiTypes";

export function WaveformCanvas({
  peaks,
  currentTime,
  duration,
  comments,
  onSeek,
  unplayedBarColor,
}: {
  peaks: number[];
  currentTime: number;
  duration: number;
  comments: ApiComment[];
  onSeek: (sec: number) => void;
  unplayedBarColor: string;
}) {
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

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 56,
        display: "flex",
        alignItems: "center",
        touchAction: "none",
        cursor: duration > 0 ? "pointer" : "default",
      }}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
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
              fill={i < boundary ? ORANGE : unplayedBarColor}
            />
          );
        })}
      </svg>

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
    </div>
  );
}
