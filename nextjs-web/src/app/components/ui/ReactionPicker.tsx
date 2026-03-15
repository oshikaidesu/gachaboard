"use client";

import { useState } from "react";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import { useReactionPreset } from "@/app/hooks/useReactionPreset";
import { useBoardReactions } from "@/app/components/board/BoardReactionProvider";
import { useBoardContext } from "@/app/components/board/BoardContext";

type Props = {
  boardId: string;
  shapeId: string;
  currentUserId: string;
};

export default function ReactionPicker({ boardId, shapeId, currentUserId }: Props) {
  const { workspaceId, provider } = useBoardContext();
  const emojiList = useReactionPreset({ boardId, workspaceId, provider });
  const [showPicker, setShowPicker] = useState(false);
  const { reactions, addReaction, removeReaction } = useBoardReactions(shapeId);

  const toggle = (emoji: string) => {
    const reacted = reactions.find((r) => r.emoji === emoji && r.userId === currentUserId);
    if (reacted) {
      removeReaction(reacted.id);
    } else {
      addReaction(emoji);
    }
    setShowPicker(false);
  };

  const active = reactions.filter((r) => !r.deletedAt);

  // emoji ごとに集計
  const grouped = active.reduce<Record<string, { count: number; reacted: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, reacted: false };
    acc[r.emoji].count++;
    if (r.userId === currentUserId) acc[r.emoji].reacted = true;
    return acc;
  }, {});

  return (
    <div className="relative flex flex-wrap items-center gap-1">
      {Object.entries(grouped).map(([emoji, { count, reacted }]) => (
        <button
          key={emoji}
          onClick={() => toggle(emoji)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition ${
            reacted ? "border-blue-300 bg-blue-50 text-blue-700" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <TwemojiImg emoji={emoji} size={16} />
          <span className="text-xs">{count}</span>
        </button>
      ))}

      <button
        onClick={() => setShowPicker((v) => !v)}
        className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-sm text-zinc-400 hover:bg-zinc-50"
      >
        +
      </button>

      {showPicker && (
        <div className="absolute bottom-full left-0 z-50 mb-1 flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
          {emojiList.map((emoji) => (
            <button
              key={emoji}
              onClick={() => toggle(emoji)}
              className="rounded p-1 text-xl hover:bg-zinc-100"
            >
              <TwemojiImg emoji={emoji} size={20} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
