"use client";

/**
 * メディアシェイプ用の音量スライダー（PointerCapture 方式）。
 * VideoShape / AudioShape で共通利用。
 */

import { useRef, useState, useCallback } from "react";
import { BLUE } from "./mediaConstants";

export type MediaVolumeSliderProps = {
  value: number;
  onChange: (v: number) => void;
  accentColor?: string;
  trackBg: string;
  width?: number;
};

export function MediaVolumeSlider({
  value,
  onChange,
  accentColor = BLUE,
  trackBg,
  width = 80,
}: MediaVolumeSliderProps) {
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
