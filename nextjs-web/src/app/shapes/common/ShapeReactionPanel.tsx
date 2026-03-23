"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useOnClickOutside } from "usehooks-ts";
import { createPortal } from "react-dom";
import { useEditor } from "@cmpd/compound";
import { useBoardContext } from "@/app/components/board/BoardContext";
import { useBoardReactions } from "@/app/components/board/BoardReactionProvider";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import { useReactionPreset } from "@/app/hooks/useReactionPreset";

type Props = {
  shapeId: string;
  containerStyle?: React.CSSProperties;
};

export function ShapeReactionPanel({ shapeId, containerStyle }: Props) {
  const { boardId, workspaceId, currentUserId, provider, syncAvailable } = useBoardContext();
  const emojiList = useReactionPreset({ boardId, workspaceId, provider });
  const { reactions, addReaction, removeReaction } = useBoardReactions(shapeId);
  const editor = useEditor();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const openPicker = useCallback(() => {
    if (plusBtnRef.current) {
      const rect = plusBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowPicker(true);
  }, []);

  const closePicker = useCallback(() => setShowPicker(false), []);

  useEffect(() => {
    if (!showPicker) return;
    const camId = `camera:page:${editor.getCurrentPageId()}`;
    const unsubscribe = editor.store.listen(
      ({ changes }) => {
        if (camId in changes.updated) closePicker();
      },
      { scope: "session" }
    );
    return unsubscribe;
  }, [showPicker, editor, closePicker]);

  useOnClickOutside([pickerRef, plusBtnRef] as React.RefObject<HTMLElement>[], closePicker, "mousedown");
  useOnClickOutside([pickerRef, plusBtnRef] as React.RefObject<HTMLElement>[], closePicker, "touchstart");

  const toggle = (emoji: string) => {
    const reacted = active.find((r) => r.emoji === emoji && r.userId === currentUserId);
    if (reacted) {
      removeReaction(reacted.id);
    } else {
      addReaction(emoji);
    }
    closePicker();
  };

  const active = reactions.filter((r) => !r.deletedAt);
  const grouped = active.reduce<Record<string, { count: number; reacted: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, reacted: false };
    acc[r.emoji].count++;
    if (r.userId === currentUserId) acc[r.emoji].reacted = true;
    return acc;
  }, {});

  const pickerEl = showPicker && pickerPos
    ? createPortal(
        <div
          ref={pickerRef}
          style={{
            position: "fixed",
            top: pickerPos.top,
            left: pickerPos.left,
            zIndex: 99999,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            padding: 6,
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            width: 176,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {emojiList.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => toggle(emoji)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: 28,
                height: 28,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 5,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                transition: "background 0.1s",
                touchAction: "manipulation",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <TwemojiImg emoji={emoji} size={16} />
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "100%",
          marginTop: 6,
          left: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 3,
          pointerEvents: syncAvailable ? "all" : "none",
          userSelect: "none",
          zIndex: 10,
          opacity: syncAvailable ? 1 : 0.6,
          ...containerStyle,
        }}
        title={!syncAvailable ? "同期エラーにより利用できません" : undefined}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {Object.entries(grouped).map(([emoji, { count, reacted }]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "1px 6px",
              borderRadius: 10,
              border: reacted ? "1.5px solid #93c5fd" : "1.5px solid rgba(0,0,0,0.15)",
              background: reacted ? "rgba(219,234,254,0.95)" : "rgba(255,255,255,0.92)",
              fontSize: 11,
              fontFamily: "system-ui, sans-serif",
              cursor: "pointer",
              lineHeight: "18px",
              color: reacted ? "#1d4ed8" : "#374151",
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              touchAction: "manipulation",
            }}
          >
            <TwemojiImg emoji={emoji} size={13} />
            <span>{count}</span>
          </button>
        ))}

        <button
          ref={plusBtnRef}
          type="button"
          onClick={() => (showPicker ? closePicker() : openPicker())}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 11,
            border: "1.5px solid rgba(0,0,0,0.15)",
            background: "rgba(255,255,255,0.92)",
            fontSize: 13,
            cursor: "pointer",
            color: "#6b7280",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
            lineHeight: 1,
            touchAction: "manipulation",
          }}
        >
          +
        </button>
        {!syncAvailable && (
          <span
            style={{
              fontSize: 10,
              color: "#b91c1c",
              background: "rgba(254,226,226,0.9)",
              padding: "1px 5px",
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            同期エラー
          </span>
        )}
      </div>
      {pickerEl}
    </>
  );
}
