"use client";

import { useEffect, useState, useCallback } from "react";

const EMOJI_LIST = ["👍","❤️","🔥","✨","😂","😮","👀","🎉","💯","🤔","😢","🚀"];

type Reaction = {
  id: string;
  shapeId: string;
  emoji: string;
  userId: string;
  deletedAt: string | null;
  user: { id: string; name: string | null; image: string | null };
};

type Props = {
  boardId: string;
  workspaceId: string;
  shapeId: string;
  currentUserId: string;
};

export default function ReactionPicker({ boardId, workspaceId, shapeId, currentUserId }: Props) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reactions?boardId=${boardId}&shapeId=${shapeId}`);
    if (res.ok) setReactions(await res.json());
  }, [boardId, shapeId]);

  useEffect(() => { load(); }, [load]);

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
          <span>{emoji}</span>
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
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => toggle(emoji)}
              className="rounded p-1 text-xl hover:bg-zinc-100"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
