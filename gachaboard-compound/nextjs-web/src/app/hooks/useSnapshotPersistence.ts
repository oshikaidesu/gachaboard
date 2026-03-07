"use client";

/**
 * Board.snapshotData への保存・復元。
 * - 保存: 変更 debounce（3秒）、visibilitychange（タブ非表示）、beforeunload
 * - 復元: useYjsStore の fetchSnapshotWhenEmpty 経由で Y.Doc が空のときに API から取得
 */
import type { TLRecord } from "@cmpd/tlschema";
import { useEffect, useRef } from "react";

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

export type UseSnapshotSaveOptions = {
  store: { allRecords: () => Iterable<TLRecord>; listen: (fn: () => void, opts?: object) => (() => void) | undefined } | null;
  boardId: string;
  workspaceId: string;
  enabled: boolean;
};

const SAVE_DEBOUNCE_MS = 3000;

export function useSnapshotSave({ store, boardId, workspaceId, enabled }: UseSnapshotSaveOptions) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveRef = useRef<string>("");

  const save = (source: string) => {
    if (!store || !enabled) return;
    const records = getDocumentRecords(store);
    const payload = JSON.stringify(records);
    if (payload === lastSaveRef.current) return;
    lastSaveRef.current = payload;

    const url = `/api/workspaces/${workspaceId}/boards/${boardId}/snapshot`;
    const body = JSON.stringify({ records });

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

  useEffect(() => {
    if (!store || !enabled) return;

    const scheduleSave = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        save("debounce");
      }, SAVE_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        save("visibilitychange");
      }
    };

    const handleBeforeUnload = () => {
      save("beforeunload");
    };

    const unsub = store.listen(
      () => scheduleSave(),
      { source: "user" as const, scope: "document" }
    );

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsub?.();
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [store, boardId, workspaceId, enabled]);
}
