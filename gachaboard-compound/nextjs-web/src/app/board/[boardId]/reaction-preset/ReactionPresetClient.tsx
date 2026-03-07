"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { TwemojiImg } from "@/app/components/ui/Twemoji";
import {
  DEFAULT_REACTION_EMOJI_LIST,
  FIXED_EMOJI_LIST,
  CUSTOM_EMOJI_CANDIDATES,
} from "@shared/constants";

type Props = {
  boardId: string;
  boardName: string;
  workspaceId: string;
  initialEmojis: string[] | null;
};

export default function ReactionPresetClient({
  boardId,
  boardName,
  workspaceId,
  initialEmojis,
}: Props) {
  const [emojis, setEmojis] = useState<string[]>(
    initialEmojis ?? DEFAULT_REACTION_EMOJI_LIST
  );
  const [showCandidates, setShowCandidates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addEmoji = useCallback((emoji: string) => {
    if (emojis.length >= 48) return;
    if (emojis.includes(emoji)) return;
    setEmojis((prev) => [...prev, emoji]);
  }, [emojis]);

  const removeEmoji = useCallback((index: number) => {
    setEmojis((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length >= 1 ? next : prev;
    });
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const from = draggedIndex;
      if (from === null || from === dropIndex) {
        setDraggedIndex(null);
        return;
      }
      setEmojis((prev) => {
        const arr = [...prev];
        const [removed] = arr.splice(from, 1);
        arr.splice(dropIndex, 0, removed);
        return arr;
      });
      setDraggedIndex(null);
    },
    [draggedIndex]
  );

  const resetToDefault = useCallback(() => {
    setEmojis(DEFAULT_REACTION_EMOJI_LIST);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/boards/${boardId}/reaction-preset`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emojis }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }, [boardId, emojis]);

  const candidateList = [...new Set([...FIXED_EMOJI_LIST, ...CUSTOM_EMOJI_CANDIDATES])];
  const availableToAdd = candidateList.filter((e) => !emojis.includes(e));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`/workspace/${workspaceId}`}
          className="text-xs text-zinc-400 hover:underline dark:text-zinc-500 dark:hover:text-zinc-400"
        >
          ← ワークスペースに戻る
        </Link>
        <h1 className="text-xl font-semibold dark:text-zinc-100">
          リアクション絵文字のカスタマイズ
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          ボード「{boardName}」で使用するリアクション絵文字を設定します。
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">選択中の絵文字（ドラッグで並び替え）</h2>
        <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          {emojis.map((emoji, i) => (
            <div
              key={`${emoji}-${i}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, i)}
              className={`group relative flex cursor-grab items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 transition-shadow active:cursor-grabbing dark:border-zinc-600 dark:bg-zinc-800 ${
                draggedIndex === i ? "opacity-50 shadow-lg" : "hover:shadow-md"
              }`}
            >
              <TwemojiImg emoji={emoji} size={20} />
              <button
                type="button"
                onClick={() => removeEmoji(i)}
                onPointerDown={(e) => e.stopPropagation()}
                className="ml-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                aria-label="削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">絵文字を追加</h2>
        <button
          onClick={() => setShowCandidates((v) => !v)}
          className="w-fit rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          {showCandidates ? "候補を閉じる" : "候補から追加"}
        </button>
        {showCandidates && (
          <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">すべて追加済みです</p>
            ) : (
              availableToAdd.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addEmoji(emoji)}
                  className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
                >
                  <TwemojiImg emoji={emoji} size={24} />
                </button>
              ))
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={resetToDefault}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          デフォルトに戻す
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {saved && (
          <span className="flex items-center text-sm text-green-600 dark:text-green-400">保存しました</span>
        )}
      </div>

      <Link
        href={`/board/${boardId}`}
        className="text-sm text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
      >
        ボードに戻る →
      </Link>
    </main>
  );
}
