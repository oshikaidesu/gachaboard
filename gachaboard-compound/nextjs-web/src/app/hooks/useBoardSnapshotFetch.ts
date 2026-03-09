"use client";

import { useCallback } from "react";
import type { TLRecord } from "@cmpd/tlschema";

export type SnapshotData = {
  records: TLRecord[];
  reactions?: Record<string, string>;
  comments?: Record<string, string>;
  reactionEmojiPreset?: string[] | null;
};

export function useBoardSnapshotFetch(workspaceId: string, boardId: string) {
  return useCallback(async (): Promise<SnapshotData> => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}/snapshot`);
      if (!res.ok) return { records: [], reactions: {}, comments: {}, reactionEmojiPreset: null };
      const json = (await res.json()) as {
        records?: unknown[];
        reactions?: Record<string, string>;
        comments?: Record<string, string>;
        reactionEmojiPreset?: string[] | null;
      };
      const records = Array.isArray(json?.records) ? json.records : [];
      return {
        records: records as TLRecord[],
        reactions: json?.reactions ?? {},
        comments: json?.comments ?? {},
        reactionEmojiPreset: json?.reactionEmojiPreset ?? null,
      };
    } catch {
      return { records: [], reactions: {}, comments: {}, reactionEmojiPreset: null };
    }
  }, [workspaceId, boardId]);
}
