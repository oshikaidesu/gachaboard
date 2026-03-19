"use client";

/**
 * 1時間間隔でボードのバックアップを作成。
 * 条件: シェイプが1個以上、前回バックアップから変更あり。
 * サムネイルは editor.getSvg で SVG を取得して保存。
 */
import type { TLRecord } from "@cmpd/tlschema";
import { useEffect, useRef } from "react";
import { useEditor } from "@cmpd/compound";
import type { HocuspocusProvider } from "@hocuspocus/provider";

const DOCUMENT_SCOPE_TYPES = new Set([
  "page",
  "shape",
  "asset",
  "document",
  "binding",
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

function getYMapEntries(provider: HocuspocusProvider, mapKey: string): Record<string, string> {
  const yMap = provider.document.getMap<string>(mapKey);
  const out: Record<string, string> = {};
  yMap.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function getReactionEmojiPreset(provider: HocuspocusProvider | null | undefined): string[] | null {
  if (!provider) return null;
  const yMap = provider.document.getMap<string>("reactionEmojiPreset");
  const raw = yMap.get("emojis");
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.filter((e): e is string => typeof e === "string");
  } catch {
    return null;
  }
}

const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1時間
const REACTIONS_MAP_KEY = "reactions";
const COMMENTS_MAP_KEY = "comments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunBackupParams = {
  editor: any;
  store: { allRecords: () => Iterable<TLRecord> };
  provider: HocuspocusProvider;
  boardId: string;
  workspaceId: string;
};

/** 手動バックアップ実行（ボード上から呼び出し）。シェイプ0個の場合は何もしない。 */
export async function runBackupFromClient({
  editor,
  store,
  provider,
  boardId,
  workspaceId,
}: RunBackupParams): Promise<boolean> {
  const records = getDocumentRecords(store);
  if (records.length < 1) return false;

  const reactions = getYMapEntries(provider, REACTIONS_MAP_KEY);
  const comments = getYMapEntries(provider, COMMENTS_MAP_KEY);
  const reactionEmojiPreset = getReactionEmojiPreset(provider);

  let thumbnailSvg: string | null = null;
  try {
    const shapes = editor.getCurrentPageShapes();
    const shapeIds = shapes.map((s: { id: string }) => s.id);
    if (shapeIds.length > 0) {
      const svgEl = await editor.getSvg(shapeIds, { padding: 20 });
      if (svgEl) thumbnailSvg = svgEl.outerHTML;
    }
  } catch {
    /* ignore */
  }

  const body = { records, reactions, comments, reactionEmojiPreset, thumbnailSvg };
  const res = await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}/backup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export type UseBackupSchedulerOptions = {
  store: {
    allRecords: () => Iterable<TLRecord>;
  } | null;
  provider?: HocuspocusProvider | null;
  boardId: string;
  workspaceId: string;
  enabled: boolean;
};

export function useBackupScheduler({
  store,
  provider,
  boardId,
  workspaceId,
  enabled,
}: UseBackupSchedulerOptions) {
  const editor = useEditor();
  const lastBackupHashRef = useRef<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!store || !provider || !editor || !enabled) return;

    const runBackup = async () => {
      const records = getDocumentRecords(store);
      if (records.length < 1) return;

      const reactions = getYMapEntries(provider, REACTIONS_MAP_KEY);
      const comments = getYMapEntries(provider, COMMENTS_MAP_KEY);
      const reactionEmojiPreset = getReactionEmojiPreset(provider);

      const hash = JSON.stringify({
        records: records.map((r) => r.id).sort(),
        reactionsKeys: Object.keys(reactions).sort(),
        commentsKeys: Object.keys(comments).sort(),
      });
      if (hash === lastBackupHashRef.current) return;
      lastBackupHashRef.current = hash;

      try {
        const ok = await runBackupFromClient({
          editor,
          store,
          provider,
          boardId,
          workspaceId,
        });
        if (!ok) lastBackupHashRef.current = "";
      } catch {
        lastBackupHashRef.current = "";
      }
    };

    intervalRef.current = setInterval(runBackup, BACKUP_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [store, provider, editor, boardId, workspaceId, enabled]);
}
