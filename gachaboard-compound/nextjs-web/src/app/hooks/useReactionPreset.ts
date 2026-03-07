"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_REACTION_EMOJI_LIST } from "@shared/constants";

/**
 * ボードのリアクション絵文字プリセットを取得するフック。
 * ロード中はデフォルトリストを返す。
 */
export function useReactionPreset(boardId: string): string[] {
  const [emojis, setEmojis] = useState<string[]>(DEFAULT_REACTION_EMOJI_LIST);

  const load = useCallback(async () => {
    if (!boardId) return;
    const res = await fetch(`/api/boards/${boardId}/reaction-preset`);
    if (res.ok) {
      const json = (await res.json()) as { emojis: string[] };
      if (Array.isArray(json.emojis) && json.emojis.length > 0) {
        setEmojis(json.emojis);
      }
    }
  }, [boardId]);

  useEffect(() => {
    load();
  }, [load]);

  return emojis;
}
