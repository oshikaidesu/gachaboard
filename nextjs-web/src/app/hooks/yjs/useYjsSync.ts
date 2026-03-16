"use client";

import type { Editor } from "@cmpd/editor";
import type { TLRecord, TLShapeId } from "@cmpd/tlschema";
import type { MutableRefObject, RefObject } from "react";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  saveCameraToLS,
  restoreCameraFromLS,
  isPositionOnlyUpdate,
  persistRecordsDiffToY,
  parseYMapValue,
  recordsFromYMap,
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
  getStoreRef: RefObject<() => StoreLike>;
  getEditorRef?: RefObject<Editor | null>;
  setConnectionStatusRef: RefObject<(s: "online" | "offline") => void>;
  setStatusRef: RefObject<(s: "loading" | "synced-remote") => void>;
  setErrorRef: RefObject<(err: Error | null) => void>;
  isLocalUpdateRef: MutableRefObject<boolean>;
  syncToken?: string | null;
};

/**
 * WebSocket 接続と Store⇔Y.Doc 双方向同期（Hocuspocus 使用）。
 * 公式パターン（https://tiptap.dev/docs/hocuspocus/provider/install）:
 * - HocuspocusProvider({ url, name: roomId, document: ydoc })
 * - name は IndexeddbPersistence の docName と統一
 * - tldraw は Yjs バインディングがないため、TLStore ⇔ Y.Map を手動で双方向バインド
 */
export function useYjsSync({
  roomId,
  wsUrl,
  ydoc,
  getStoreRef,
  getEditorRef,
  setConnectionStatusRef,
  setStatusRef,
  setErrorRef,
  isLocalUpdateRef,
  syncToken,
}: UseYjsSyncOptions): HocuspocusProvider | undefined {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

  useEffect(() => {
    if (!ydoc || !wsUrl || syncToken === undefined) return;

    const yMap = ydoc.getMap<string>("tldraw");
    let hasConnectedOnce = false;
    // name は IndexeddbPersistence の docName と統一（公式パターン）
    const prov = new HocuspocusProvider({
      url: wsUrl,
      name: roomId,
      document: ydoc,
      token: typeof syncToken === "string" ? syncToken : "",
      onStatus: ({ status }) => {
        if (status === "connected") {
          hasConnectedOnce = true;
          setErrorRef.current?.(null);
          setConnectionStatusRef.current?.("online");
          setStatusRef.current?.("synced-remote");
        } else if (status === "disconnected" || status === "connecting") {
          setConnectionStatusRef.current?.("offline");
          setStatusRef.current?.(hasConnectedOnce ? "synced-remote" : "loading");
        }
      },
      onAuthenticationFailed: ({ reason }) => {
        setErrorRef.current?.(new Error(reason || "認証に失敗しました"));
      },
    });
    setProvider(prov);

    const store = getStoreRef.current?.();
    if (!store) {
      prov.destroy();
      setProvider(null);
      return;
    }

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

    // 接続時に yMap に既存データがある場合の初期同期（observe は変更時のみ発火するため）
    const initialRecords = recordsFromYMap(yMap);
    if (initialRecords.length > 0) {
      store.mergeRemoteChanges(() => store.put(initialRecords));
      if (!hasRestoredCamera) {
        restoreCameraFromLS(store, roomId);
        hasRestoredCamera = true;
      }
    }

    let rafScheduled = false;
    let pendingChanges: RecordsDiffLike | null = null;
    let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;
    const flushToY = () => {
      if (!pendingChanges) return;
      prov.awareness?.setLocalStateField("dragging", null);
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
          const editor = getEditorRef?.current ?? null;
          const { x, y } =
            editor != null
              ? editor.getShapePageTransform(shape.id as TLShapeId).point()
              : { x: shape.x, y: shape.y };
          prov.awareness?.setLocalStateField("dragging", {
            shapeId: shape.id,
            x,
            y,
          });
        }
      } else {
        prov.awareness?.setLocalStateField("dragging", null);
        scheduleFlush();
      }
    };

    const onPointerUp = () => {
      if (pendingChanges) flushToY();
    };
    document.addEventListener("pointerup", onPointerUp);

    const unsubStore = store.listen(persistToY, {
      source: "user",
      scope: "document",
    });

    const handleBeforeUnload = () => {
      saveCameraToLS(store, roomId);
      if (pendingChanges) flushToY();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    setConnectionStatusRef.current?.("offline");
    setStatusRef.current?.("loading");

    return () => {
      if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
      document.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      unsubStore();
      yMap.unobserve(handleYUpdate);
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
  }, [roomId, wsUrl, ydoc, syncToken]);

  return provider ?? undefined;
}
