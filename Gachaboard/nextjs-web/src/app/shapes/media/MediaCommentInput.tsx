"use client";

import { formatTime } from "@/lib/formatTime";
import { useTheme } from "@/app/components/theme/ThemeProvider";

type Props = {
  accentColor: string;
  syncAvailable: boolean;
  commentFocused: boolean;
  currentTime: number;
  newComment: string;
  onNewCommentChange: (v: string) => void;
  onPostComment: () => void;
  posting: boolean;
  commentInputRef: React.RefObject<HTMLInputElement>;
  onFocus: () => void;
  onBlur: () => void;
  onCommentFocusedChange: (focused: boolean) => void;
};

export function MediaCommentInput({
  accentColor,
  syncAvailable,
  commentFocused,
  currentTime,
  newComment,
  onNewCommentChange,
  onPostComment,
  posting,
  commentInputRef,
  onFocus,
  onBlur,
  onCommentFocusedChange,
}: Props) {
  const { isDarkMode } = useTheme();

  const errorBg = isDarkMode ? "rgba(127,29,29,0.6)" : "rgba(254,226,226,0.9)";
  const timeColor = isDarkMode ? "#94a3b8" : "#64748b";
  const inputBorder = isDarkMode ? "#334155" : "#e2e8f0";
  const inputBg = isDarkMode ? (commentFocused ? "#1e293b" : "#0f172a") : (commentFocused ? "#fff" : "#f8fafc");
  const inputColor = isDarkMode ? "#f1f5f9" : "#1e293b";

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        alignItems: "center",
        opacity: syncAvailable ? 1 : 0.6,
        pointerEvents: syncAvailable ? undefined : "none",
      }}
      title={!syncAvailable ? "同期エラーにより利用できません" : undefined}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "BUTTON" || t.tagName === "SPAN")
          e.stopPropagation();
      }}
      onPointerDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "INPUT" || t.tagName === "BUTTON" || t.tagName === "SPAN")
          e.stopPropagation();
      }}
    >
      {!syncAvailable && (
        <span
          title="同期エラーにより利用できません"
          style={{
            fontSize: 10,
            color: isDarkMode ? "#f87171" : "#b91c1c",
            background: errorBg,
            padding: "1px 5px",
            borderRadius: 4,
            fontWeight: 500,
            pointerEvents: "auto",
          }}
        >
          同期エラー
        </span>
      )}
      {commentFocused && (
        <span
          style={{
            fontSize: 13,
            color: timeColor,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTime(currentTime)}
        </span>
      )}
      <input
        ref={commentInputRef}
        value={newComment}
        onChange={(e) => onNewCommentChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (e.nativeEvent.isComposing) return;
            onPostComment();
            commentInputRef.current?.blur();
            onCommentFocusedChange(false);
          }
          if (e.key === "Escape") {
            commentInputRef.current?.blur();
            onCommentFocusedChange(false);
            onNewCommentChange("");
          }
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        onTouchEnd={(e) => {
          e.stopPropagation();
          commentInputRef.current?.focus();
        }}
        placeholder={commentFocused ? "コメントを追加..." : "💬 コメント"}
        style={{
          flex: 1,
          fontSize: 14,
          padding: commentFocused ? "6px 10px" : "5px 8px",
          borderRadius: 4,
          border: commentFocused ? `1px solid ${accentColor}` : `1px solid ${inputBorder}`,
          background: inputBg,
          color: inputColor,
          outline: "none",
          minWidth: 0,
          transition: "border-color 0.15s, padding 0.15s",
          boxShadow: commentFocused ? `0 0 0 2px ${accentColor}33` : "none",
        }}
      />
      {commentFocused && (
        <button
          onClick={() => {
            onPostComment();
            onCommentFocusedChange(false);
          }}
          disabled={posting || !newComment.trim()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onPostComment();
            onCommentFocusedChange(false);
          }}
          style={{
            fontSize: 13,
            padding: "5px 12px",
            borderRadius: 4,
            border: "none",
            background: accentColor,
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
  );
}
