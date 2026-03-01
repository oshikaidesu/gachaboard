"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBoardContext } from "@/app/components/BoardContext";
import { POLLING_INTERVAL_REACTIONS } from "@shared/constants";

// Twemoji CDN から絵文字画像URLを生成する
function twemojiUrl(emoji: string): string {
  // サロゲートペアや variation selector を除いてコードポイント列を取得
  const codePoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    // variation selector (U+FE0F) は除外
    if (cp === 0xfe0f) continue;
    codePoints.push(cp.toString(16));
  }
  const filename = codePoints.join("-");
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/72x72/${filename}.png`;
}

const EMOJI_LIST = [
  "👍","❤️","🔥","✨","😂","😮","👀","🎉","💯","🤔","😢","🚀",
  "👏","🙏","💪","🎊","😍","🤩","😎","🥳","💡","⭐","🌟","💎",
];

type Reaction = {
  id: string;
  shapeId: string;
  emoji: string;
  userId: string;
  deletedAt: string | null;
  user: { id: string; discordName: string; avatarUrl: string | null };
};

type Props = {
  shapeId: string;
  /** 外側コンテナの style を上書きする。デフォルトは position:absolute, bottom:-28 */
  containerStyle?: React.CSSProperties;
};

function TwemojiImg({ emoji, size = 16 }: { emoji: string; size?: number }) {
  return (
    <img
      src={twemojiUrl(emoji)}
      alt={emoji}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle" }}
      draggable={false}
    />
  );
}

export function ShapeReactionPanel({ shapeId, containerStyle }: Props) {
  const { boardId, workspaceId, currentUserId } = useBoardContext();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!boardId || !shapeId) return;
    const res = await fetch(`/api/reactions?boardId=${boardId}&shapeId=${shapeId}`);
    if (res.ok) setReactions(await res.json());
  }, [boardId, shapeId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLLING_INTERVAL_REACTIONS);
    return () => clearInterval(timer);
  }, [load]);

  // ピッカー外クリックで閉じる
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const toggle = async (emoji: string) => {
    await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId, workspaceId, shapeId, emoji }),
    });
    await load();
    setShowPicker(false);
  };

  const active = reactions.filter((r) => !r.deletedAt);
  const grouped = active.reduce<Record<string, { count: number; reacted: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, reacted: false };
    acc[r.emoji].count++;
    if (r.userId === currentUserId) acc[r.emoji].reacted = true;
    return acc;
  }, {});

  return (
    <div
      style={{
        position: "absolute",
        bottom: -28,
        left: 0,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 3,
        pointerEvents: "all",
        userSelect: "none",
        zIndex: 10,
        whiteSpace: "nowrap",
        ...containerStyle,
      }}
      // tldraw のドラッグ操作と競合しないよう伝播を止める
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {Object.entries(grouped).map(([emoji, { count, reacted }]) => (
        <button
          key={emoji}
          onClick={() => toggle(emoji)}
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
          }}
        >
          <TwemojiImg emoji={emoji} size={13} />
          <span>{count}</span>
        </button>
      ))}

      {/* ＋ボタン */}
      <div style={{ position: "relative" }} ref={pickerRef}>
        <button
          onClick={() => setShowPicker((v) => !v)}
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
          }}
        >
          +
        </button>

        {showPicker && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 4px)",
              left: 0,
              zIndex: 9999,
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              padding: 8,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              width: 220,
            }}
          >
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => toggle(emoji)}
                style={{
                  width: 34,
                  height: 34,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <TwemojiImg emoji={emoji} size={20} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
