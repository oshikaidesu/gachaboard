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
  type StoreLike,
} from "@/lib/yjsSyncHelpers";

export type { StoreLike } from "@/lib/yjsSyncHelpers";

const SMOOTH_LERP_FACTOR = 0.25;
const SMOOTH_DONE_DISTANCE = 0.5;

function getPeerDraggedShapeIds(store: StoreLike): Set<string> {
  const ids = new Set<string>();
  for (const rec of store.allRecords()) {
    if (rec.typeName !== "instance_presence") continue;
    const p = rec as { selectedShapeIds?: string[] };
    for (const id of p.selectedShapeIds ?? []) ids.add(id);
  }
  return ids;
}

function isShapeWithPosition(rec: TLRecord): rec is TLRecord & { id: string; x: number; y: number } {
  return "x" in rec && "y" in rec && typeof (rec as { x?: unknown }).x === "number" && typeof (rec as { y?: unknown }).y === "number";
}

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

    // ---------- 接続・認証（HocuspocusProvider） ----------
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
    const smoothTargets = new Map<string, { targetX: number; targetY: number; record: TLRecord }>();
    let smoothRafId: number | null = null;

    // ---------- スムースフォロー（他ユーザーがドラッグ中のシェイプを滑らかに追従） ----------
    const runSmoothLoop = () => {
      smoothRafId = null;
      const s = getStoreRef.current?.();
      if (!s || smoothTargets.size === 0) return;
      const peerDragged = getPeerDraggedShapeIds(s);
      const records = Array.from(s.allRecords());
      const getShape = (id: string) => records.find((r) => r.id === id) as (TLRecord & { x: number; y: number }) | undefined;

      for (const [shapeId, { targetX, targetY, record }] of Array.from(smoothTargets.entries())) {
        if (!peerDragged.has(shapeId)) {
          s.mergeRemoteChanges(() => s.put([record]));
          smoothTargets.delete(shapeId);
          continue;
        }
        const current = getShape(shapeId);
        if (!current) {
          s.mergeRemoteChanges(() => s.put([record]));
          smoothTargets.delete(shapeId);
          continue;
        }
        const dx = targetX - current.x;
        const dy = targetY - current.y;
        const dist = Math.hypot(dx, dy);
        if (dist < SMOOTH_DONE_DISTANCE) {
          s.mergeRemoteChanges(() => s.put([record]));
          smoothTargets.delete(shapeId);
          continue;
        }
        const newX = current.x + dx * SMOOTH_LERP_FACTOR;
        const newY = current.y + dy * SMOOTH_LERP_FACTOR;
        const next = { ...record, x: newX, y: newY } as TLRecord;
        s.mergeRemoteChanges(() => s.put([next]));
        smoothTargets.set(shapeId, { targetX, targetY, record });
      }
      if (smoothTargets.size > 0) smoothRafId = requestAnimationFrame(runSmoothLoop);
    };

    const scheduleSmooth = () => {
      if (smoothRafId === null && smoothTargets.size > 0) smoothRafId = requestAnimationFrame(runSmoothLoop);
    };

    // ---------- Store←Y 同期（Y.Map の変更を Store に反映） ----------
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
        const peerDragged = getPeerDraggedShapeIds(store);
        const toPutImmediate: TLRecord[] = [];
        for (const rec of toPut) {
          if (isShapeWithPosition(rec) && peerDragged.has(rec.id)) {
            smoothTargets.set(rec.id, { targetX: rec.x, targetY: rec.y, record: rec });
            scheduleSmooth();
          } else {
            toPutImmediate.push(rec);
          }
        }
        if (toPutImmediate.length > 0 || toRemove.length > 0) {
          store.mergeRemoteChanges(() => {
            if (toRemove.length > 0) store.remove(toRemove);
            if (toPutImmediate.length > 0) store.put(toPutImmediate);
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

    // ---------- Store→Y 永続化（Store の変更を Y.Map に書き込み・ドラッグ時は throttle） ----------
    const DRAG_SYNC_THROTTLE_MS = 80;
    let rafScheduled = false;
    let pendingChanges: RecordsDiffLike | null = null;
    let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let dragSyncTimer: ReturnType<typeof setTimeout> | null = null;
    const flushToY = (clearDragging = true) => {
      if (!pendingChanges) return;
      if (clearDragging) prov.awareness?.setLocalStateField("dragging", null);
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
    const scheduleDragSync = () => {
      if (dragSyncTimer) return;
      dragSyncTimer = setTimeout(() => {
        dragSyncTimer = null;
        if (pendingChanges) flushToY(false);
      }, DRAG_SYNC_THROTTLE_MS);
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
          scheduleDragSync();
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

    // ---------- クリーンアップ ----------
    return () => {
      if (smoothRafId !== null) cancelAnimationFrame(smoothRafId);
      if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
      if (dragSyncTimer) clearTimeout(dragSyncTimer);
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
