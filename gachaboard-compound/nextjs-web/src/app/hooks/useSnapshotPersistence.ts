"use client";

/**
 * Board.snapshotData への保存・復元。
 * - 保存: 変更 debounce（3秒）、visibilitychange（タブ非表示）、beforeunload
 * - 復元: useYjsStore の fetchSnapshotWhenEmpty 経由で Y.Doc が空のときに API から取得
 */
import type { TLRecord } from "@cmpd/tlschema";
import debounce from "lodash.debounce";
import { useEffect, useRef } from "react";
import type { WebsocketProvider } from "y-websocket";

const DOCUMENT_SCOPE_TYPES = new Set([
  "page",
  "shape",
  "asset",
  "document",
  "binding",
  // camera, instance, instance_page_state, instance_presence は除外
]);

function getDocumentRecords(store: { allRecords: () => Iterable<TLRecord> }): TLRecord[] {
  const records: TLRecord[] = [];
  for (const rec of store.allRecords()) {
    if (DOCUMENT_SCOPE_TYPES.has(rec.typeName)) {
      records.push(rec);
    }
  }
  return records;
}

function getYMapEntries(provider: WebsocketProvider, mapKey: string): Record<string, string> {
  const yMap = provider.doc.getMap<string>(mapKey);
  const out: Record<string, string> = {};
  yMap.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export type UseSnapshotSaveOptions = {
  store: { allRecords: () => Iterable<TLRecord>; listen: (fn: () => void, opts?: object) => (() => void) | undefined } | null;
  provider?: WebsocketProvider | null;
  boardId: string;
  workspaceId: string;
  enabled: boolean;
};

const SAVE_DEBOUNCE_MS = 3000;
const REACTIONS_MAP_KEY = "reactions";
const COMMENTS_MAP_KEY = "comments";
const REACTION_EMOJI_PRESET_MAP_KEY = "reactionEmojiPreset";
const REACTION_EMOJI_PRESET_EMOJIS_KEY = "emojis";

function getReactionEmojiPreset(provider: WebsocketProvider | null | undefined): string[] | null {
  if (!provider) return null;
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

export function useSnapshotSave({ store, provider, boardId, workspaceId, enabled }: UseSnapshotSaveOptions) {
  const lastSaveRef = useRef<string>("");

  useEffect(() => {
    if (!store || !enabled) return;

    const save = (source: string) => {
      const records = getDocumentRecords(store);
      const reactions = provider ? getYMapEntries(provider, REACTIONS_MAP_KEY) : {};
      const comments = provider ? getYMapEntries(provider, COMMENTS_MAP_KEY) : {};
      const reactionEmojiPreset = getReactionEmojiPreset(provider);
      const payload = JSON.stringify({ records, reactions, comments, reactionEmojiPreset });
      if (payload === lastSaveRef.current) return;
      lastSaveRef.current = payload;

      const url = `/api/workspaces/${workspaceId}/boards/${boardId}/snapshot`;
      const body = JSON.stringify({ records, reactions, comments, reactionEmojiPreset });

      if (source === "beforeunload") {
        fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
        return;
      }

      fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    };

    const debouncedSave = debounce(() => save("debounce"), SAVE_DEBOUNCE_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        save("visibilitychange");
      }
    };

    const handleBeforeUnload = () => {
      save("beforeunload");
    };

    const unsub = store.listen(
      () => debouncedSave(),
      { source: "user" as const, scope: "document" }
    );

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      debouncedSave.cancel();
      unsub?.();
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [store, provider, boardId, workspaceId, enabled]);
}
