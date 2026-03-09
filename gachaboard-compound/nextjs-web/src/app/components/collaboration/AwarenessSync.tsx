"use client";

/**
 * Yjs Awareness と compound の instance_presence をブリッジする。
 * - リモートの awareness 変更 → store に instance_presence を put/remove
 * - ローカルのポインター移動 → awareness の cursor を更新
 */
import { useEditor } from "@cmpd/editor";
import { InstancePresenceRecordType } from "@cmpd/tlschema";
import rafThrottle from "raf-throttle";
import { useCallback, useEffect, useRef } from "react";
import type { WebsocketProvider } from "y-websocket";

type AwarenessSyncProps = {
  provider: WebsocketProvider;
  localUserId: string;
};

export function AwarenessSync({ provider, localUserId }: AwarenessSyncProps) {
  const editor = useEditor();
  const awareness = provider.awareness;
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  // リモート awareness → store の instance_presence に同期（raf-throttle で 1 フレームに 1 回）
  useEffect(() => {
    const store = editor.store;
    const localClientId = provider.doc.clientID;

    const syncRemoteToStore = () => {
      const states = awareness.getStates();
      const toPut: ReturnType<typeof InstancePresenceRecordType.create>[] = [];
      let currentPageId: string;
      try {
        currentPageId = editor.getCurrentPageId();
      } catch {
        return;
      }
      const viewport = editor.getViewportScreenBounds();

      // 同一 userId の複数タブを統合して、1ユーザー＝1 presence にする
      const byUserId = new Map<string, Record<string, unknown>>();
      states.forEach((state, clientId) => {
        if (clientId === localClientId) return;
        const user = state?.user as { id?: string; name?: string; color?: string } | undefined;
        const userId = user?.id ?? `yjs-${clientId}`;
        const cursor = state?.cursor as { x: number; y: number } | null | undefined;
        const hasCursor = cursor && typeof cursor.x === "number";
        const existing = byUserId.get(userId);
        const existingHasCursor = existing?.cursor && typeof (existing.cursor as { x?: number }).x === "number";
        // カーソルがある state を優先（アクティブなタブの位置を表示）
        if (!existing || (hasCursor && !existingHasCursor) || (hasCursor && existingHasCursor)) {
          byUserId.set(userId, state as Record<string, unknown>);
        }
      });

      byUserId.forEach((state, userId) => {
        const user = state?.user as { id?: string; name?: string; color?: string; avatarUrl?: string | null } | undefined;
        const cursor = state?.cursor as { x: number; y: number; type?: string; rotation?: number } | null | undefined;
        const dragging = state?.dragging as { shapeId: string; x: number; y: number } | null | undefined;
        const userName = user?.name ?? "Unknown";
        const color = user?.color ?? "#888888";
        const presenceId = InstancePresenceRecordType.createId(userId);

        toPut.push(
          InstancePresenceRecordType.create({
            id: presenceId,
            userId,
            userName,
            lastActivityTimestamp: Date.now(),
            followingUserId: null,
            cursor: cursor
              ? {
                  x: cursor.x,
                  y: cursor.y,
                  type: (cursor.type as "default") ?? "default",
                  rotation: cursor.rotation ?? 0,
                }
              : { x: 0, y: 0, type: "default", rotation: 0 },
            color,
            camera: { x: 0, y: 0, z: 1 },
            screenBounds: { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h },
            selectedShapeIds: [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TLPageId is branded, editor.getCurrentPageId() returns valid page id
            currentPageId: currentPageId as any,
            brush: null,
            scribbles: [],
            chatMessage: "",
            meta: { avatarUrl: user?.avatarUrl ?? null, dragging: dragging ?? null },
          })
        );
      });

      store.mergeRemoteChanges(() => {
        const newUserIds = new Set(toPut.map((p) => p.userId));
        const existingPresences = store.allRecords().filter((r) => r.typeName === "instance_presence");

        existingPresences.forEach((rec) => {
          if (!newUserIds.has(rec.userId)) {
            store.remove([rec.id]);
          }
        });
        if (toPut.length > 0) {
          store.put(toPut);
        }
      });
    };

    syncRemoteToStore();
    const throttledSync = rafThrottle(syncRemoteToStore);
    awareness.on("change", throttledSync);

    return () => {
      throttledSync.cancel();
      awareness.off("change", throttledSync);
    };
  }, [editor, awareness, provider.doc.clientID]);

  // ローカル cursor を awareness に送信
  const updateLocalCursor = useCallback(
    (pageX: number, pageY: number) => {
      awareness.setLocalStateField("cursor", {
        x: pageX,
        y: pageY,
        type: "default",
        rotation: 0,
      });
      awareness.setLocalStateField("currentPageId", editor.getCurrentPageId());
    },
    [awareness, editor]
  );

  const clearLocalCursor = useCallback(() => {
    awareness.setLocalStateField("cursor", null);
  }, [awareness]);

  useEffect(() => {
    const container = document.getElementById("compound-editor");
    if (!container) return;

    const throttledUpdate = rafThrottle(() => {
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        updateLocalCursor(pending.x, pending.y);
      }
    });

    const handlePointerMove = (e: PointerEvent) => {
      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY });
      pendingRef.current = { x: pagePoint.x, y: pagePoint.y };
      throttledUpdate();
    };

    const handlePointerLeave = () => {
      pendingRef.current = null;
      throttledUpdate.cancel();
      clearLocalCursor();
    };

    container.addEventListener("pointermove", handlePointerMove, { passive: true });
    container.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
      throttledUpdate.cancel();
    };
  }, [editor, updateLocalCursor, clearLocalCursor]);

  return null;
}
