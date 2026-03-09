"use client";

import { formatTime } from "@/lib/formatTime";
import { useTheme } from "@/app/components/theme/ThemeProvider";
import type { ApiComment } from "@shared/apiTypes";

type Props = {
  comments: ApiComment[];
  accentColor: string;
  syncAvailable: boolean;
  isCompact: boolean;
  commentRowHeight: number;
  onSeek: (sec: number) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
};

export function MediaCommentList({
  comments,
  accentColor,
  syncAvailable,
  isCompact,
  commentRowHeight,
  onSeek,
  onDelete,
  deleting,
}: Props) {
  const { isDarkMode } = useTheme();

  const borderColor = isDarkMode ? "#334155" : "#f1f5f9";
  const rowHoverBg = isDarkMode ? "#334155" : "#f1f5f9";
  const bodyColor = isDarkMode ? "#e2e8f0" : "#1e293b";
  const metaColor = isDarkMode ? "#94a3b8" : "#64748b";

  if (comments.length === 0) return null;

  return (
    <div
      className="comment-list"
      style={{
        borderTop: `1px solid ${borderColor}`,
        padding: "4px 10px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flex: isCompact ? 1 : undefined,
        minHeight: 0,
        overflowY: "auto",
        touchAction: "pan-y",
        opacity: syncAvailable ? 1 : 0.6,
        pointerEvents: syncAvailable ? undefined : "none",
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
      {comments.map((c) => (
        <div
          key={c.id}
          data-comment-row
          onClick={() => onSeek(c.timeSec)}
          onTouchEnd={(e) => {
            e.stopPropagation();
            onSeek(c.timeSec);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "2px 4px",
            borderRadius: 4,
            cursor: "pointer",
            height: commentRowHeight,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = rowHoverBg;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "transparent";
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: accentColor,
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            {formatTime(c.timeSec)}
          </span>
          <span
            style={{
              fontSize: 14,
              color: bodyColor,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.body}
          </span>
          <span style={{ fontSize: 12, color: metaColor, flexShrink: 0 }}>
            {c.author.discordName}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(c.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete(c.id);
            }}
            disabled={deleting === c.id}
            style={{
              fontSize: 13,
              color: metaColor,
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
      ))}
    </div>
  );
}
