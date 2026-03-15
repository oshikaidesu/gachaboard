"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_REACTION_EMOJI_LIST } from "@shared/constants";
import type { WebsocketProvider } from "y-websocket";

const REACTION_EMOJI_PRESET_MAP_KEY = "reactionEmojiPreset";
const REACTION_EMOJI_PRESET_EMOJIS_KEY = "emojis";

function parseEmojisFromYMap(provider: WebsocketProvider): string[] | null {
  const yMap = provider.doc.getMap<string>(REACTION_EMOJI_PRESET_MAP_KEY);
  const raw = yMap.get(REACTION_EMOJI_PRESET_EMOJIS_KEY);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.filter((e): e is string => typeof e === "string");
  } catch {
    return null;
  }
}

export type UseReactionPresetOptions = {
  boardId: string;
  workspaceId: string;
  provider?: WebsocketProvider | null;
};

/**
 * ボードのリアクション絵文字プリセットを取得するフック。
 * provider があれば Y.Doc から、なければ snapshot API から取得。
 */
export function useReactionPreset({
  boardId,
  workspaceId,
  provider,
}: UseReactionPresetOptions): string[] {
  const [emojis, setEmojis] = useState<string[]>(DEFAULT_REACTION_EMOJI_LIST);

  const fetchFromSnapshot = useCallback(async () => {
    if (!boardId || !workspaceId) return;
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/boards/${boardId}/snapshot`
      );
      if (!res.ok) return;
      const json = (await res.json()) as { reactionEmojiPreset?: string[] | null };
      const preset = json?.reactionEmojiPreset;
      if (Array.isArray(preset) && preset.length > 0) {
        setEmojis(preset);
      }
    } catch {
      // フェッチ失敗は無視
    }
  }, [boardId, workspaceId]);

  useEffect(() => {
    if (provider) {
      const yMap = provider.doc.getMap<string>(REACTION_EMOJI_PRESET_MAP_KEY);

      const apply = () => {
        const parsed = parseEmojisFromYMap(provider);
        setEmojis(parsed ?? DEFAULT_REACTION_EMOJI_LIST);
      };

      apply();
      yMap.observe(apply);
      return () => yMap.unobserve(apply);
    }

    void fetchFromSnapshot();
  }, [provider, boardId, fetchFromSnapshot]);

  return emojis;
}
