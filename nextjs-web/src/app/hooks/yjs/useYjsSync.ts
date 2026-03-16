"use client";

import type { TLRecord } from "@cmpd/tlschema";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  saveCameraToLS,
  restoreCameraFromLS,
  isPositionOnlyUpdate,
  persistRecordsDiffToY,
  parseYMapValue,
  type RecordsDiffLike,
} from "@/lib/yjsSyncHelpers";

export type StoreLike = {
  listen: (fn: (entry: { changes: RecordsDiffLike; source: string }) => void, opts: { source: string; scope: string }) => () => void;
  mergeRemoteChanges: (fn: () => void) => void;
  put: (records: TLRecord[]) => void;
  remove: (ids: TLRecord["id"][]) => void;
  has: (id: TLRecord["id"]) => boolean;
  allRecords: () => Iterable<TLRecord>;
};

type UseYjsSyncOptions = {
  roomId: string;
  wsUrl: string;
  ydoc: Y.Doc | null;
  getStore: () => StoreLike;
  setConnectionStatus: (s: "online" | "offline") => void;
  setStatus: (s: "loading" | "synced-remote") => void;
  isLocalUpdateRef: React.MutableRefObject<boolean>;
  /** sync-server ゲート用。undefined=取得中でまだ接続しない, string=接続許可, null=トークンなしで接続（ゲート未使用時） */
  syncToken?: string | null;
};

/**
 * WebSocket 接続と Store⇔Y.Doc 双方向同期。
 */
export function useYjsSync({
  roomId,
  wsUrl,
  ydoc,
  getStore,
  setConnectionStatus,
  setStatus,
  isLocalUpdateRef,
  syncToken,
}: UseYjsSyncOptions): WebsocketProvider | undefined {
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  useEffect(() => {
    if (!ydoc || !wsUrl || syncToken === undefined) return;

    const yMap = ydoc.getMap<string>("tldraw");
    const wsOpts: { connect: boolean; params?: Record<string, string> } = { connect: false };
    if (typeof syncToken === "string") wsOpts.params = { token: syncToken };
    const prov = new WebsocketProvider(wsUrl, roomId, ydoc, wsOpts);
    setProvider(prov);

    const connectTimer = setTimeout(() => prov.connect(), 50);

    const store = getStore();

    let hasRestoredCamera = false;
    let syncRafScheduled = false;
    const changedKeys = new Set<string>();
    const handleYUpdate = (event: { changes: { keys: Map<string, { action: string }> } }) => {
      if (isLocalUpdateRef.current) return;
      event.changes.keys.forEach((_, key) => changedKeys.add(key));
      if (syncRafScheduled) return;
      syncRafScheduled = true;
      requestAnimationFrame(() => {
        syncRafScheduled = false;
        if (isLocalUpdateRef.current) return;
        const keys = Array.from(changedKeys);
        changedKeys.clear();
        const toPut: TLRecord[] = [];
        const toRemove: TLRecord["id"][] = [];
        for (const key of keys) {
          const raw = yMap.get(key);
          if (raw === undefined) {
            toRemove.push(key as TLRecord["id"]);
          } else {
            const record = parseYMapValue(raw);
            if (record) toPut.push(record);
          }
        }
        if (toPut.length > 0 || toRemove.length > 0) {
          store.mergeRemoteChanges(() => {
            if (toRemove.length > 0) store.remove(toRemove);
            if (toPut.length > 0) store.put(toPut);
          });
        }
        if (!hasRestoredCamera) {
          restoreCameraFromLS(store, roomId);
          hasRestoredCamera = true;
        }
      });
    };

    yMap.observe(handleYUpdate);
    // 初回の Y.Map → ストア反映は useYjsPersistence の "synced" で行う（一箇所責務）

    const DRAG_DEFER_MS = 100;
    let rafScheduled = false;
    let pendingChanges: RecordsDiffLike | null = null;
    let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let dragDeferTimer: ReturnType<typeof setTimeout> | null = null;
    const flushToY = () => {
      if (!pendingChanges) return;
      prov.awareness.setLocalStateField("dragging", null);
      const changes = pendingChanges;
      pendingChanges = null;
      persistRecordsDiffToY(yMap, changes, isLocalUpdateRef, ydoc);
    };
    const scheduleFlush = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        flushToY();
      });
    };
    const scheduleFlushDeferred = () => {
      if (dragDeferTimer) clearTimeout(dragDeferTimer);
      dragDeferTimer = setTimeout(() => {
        dragDeferTimer = null;
        flushToY();
      }, DRAG_DEFER_MS);
    };
    const persistToY = (entry: { changes: RecordsDiffLike; source: string }) => {
      if (entry.source !== "user") return;
      if (!cameraSaveTimer) {
        cameraSaveTimer = setTimeout(() => {
          cameraSaveTimer = null;
          saveCameraToLS(store, roomId);
        }, 500);
      }
      if (!pendingChanges) {
        pendingChanges = { added: {}, updated: {}, removed: {} };
      }
      const { added, updated, removed } = entry.changes;
      Object.assign(pendingChanges.added, added);
      Object.assign(pendingChanges.updated, updated);
      Object.assign(pendingChanges.removed, removed);
      if (isPositionOnlyUpdate(entry.changes)) {
        const updated = Object.values(entry.changes.updated);
        if (updated.length === 1) {
          const [, to] = updated[0];
          const shape = to as { id: string; x: number; y: number };
          prov.awareness.setLocalStateField("dragging", {
            shapeId: shape.id,
            x: shape.x,
            y: shape.y,
          });
        }
        scheduleFlushDeferred();
      } else {
        prov.awareness.setLocalStateField("dragging", null);
        if (dragDeferTimer) {
          clearTimeout(dragDeferTimer);
          dragDeferTimer = null;
        }
        scheduleFlush();
      }
    };

    const unsubStore = store.listen(persistToY, {
      source: "user",
      scope: "document",
    });

    const handleBeforeUnload = () => saveCameraToLS(store, roomId);
    window.addEventListener("beforeunload", handleBeforeUnload);

    let hasConnectedOnce = false;
    const handleStatus = (event: { status: string }) => {
      if (event.status === "connected") {
        hasConnectedOnce = true;
        setConnectionStatus("online");
        setStatus("synced-remote");
      } else if (event.status === "disconnected") {
        setConnectionStatus("offline");
        setStatus(hasConnectedOnce ? "synced-remote" : "loading");
      } else if (event.status === "connecting") {
        setConnectionStatus("offline");
        setStatus(hasConnectedOnce ? "synced-remote" : "loading");
      }
    };
    prov.on("status", handleStatus);

    setConnectionStatus("offline");
    setStatus(prov.wsconnected ? "synced-remote" : "loading");

    return () => {
      clearTimeout(connectTimer);
      if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
      if (dragDeferTimer) clearTimeout(dragDeferTimer);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      unsubStore();
      yMap.unobserve(handleYUpdate);
      prov.off("status", handleStatus);
      setProvider(null);
      const runHeavyCleanup = () => {
        saveCameraToLS(store, roomId);
        prov.destroy();
      };
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(runHeavyCleanup, { timeout: 500 });
      } else {
        setTimeout(runHeavyCleanup, 0);
      }
    };
  }, [roomId, wsUrl, ydoc, getStore, setConnectionStatus, setStatus, isLocalUpdateRef, syncToken]);

  return provider ?? undefined;
}
