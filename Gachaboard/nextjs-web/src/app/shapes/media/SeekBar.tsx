"use client";

import { useRef, useState, useCallback } from "react";
import { formatTime } from "@/lib/formatTime";
import { BLUE, SEEK_BAR_HEIGHT, SEEK_BAR_HIT_HEIGHT } from "./mediaConstants";
import type { ApiComment } from "@shared/apiTypes";

export function SeekBar({
  currentTime,
  duration,
  onSeek,
  comments = [],
  trackBg,
}: {
  currentTime: number;
  duration: number;
  onSeek: (sec: number) => void;
  comments?: ApiComment[];
  trackBg: string;
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
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: SEEK_BAR_HEIGHT,
          borderRadius: SEEK_BAR_HEIGHT / 2,
          background: trackBg,
          overflow: "hidden",
        }}
      >
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
      {duration > 0 && comments.map((c) => (
        <div
          key={c.id}
          title={`${formatTime(c.timeSec)} ${c.author.discordName}: ${c.body}`}
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
