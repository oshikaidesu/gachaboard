"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { restoreCameraFromLS, LOCAL_ORIGIN } from "@/lib/yjsSyncHelpers";
import type { TLRecord } from "@cmpd/tlschema";

export type SnapshotData = {
  records: TLRecord[];
  reactions?: Record<string, string>;
  comments?: Record<string, string>;
  reactionEmojiPreset?: string[] | null;
};

type StoreLike = {
  put: (r: TLRecord[]) => void;
  mergeRemoteChanges: (fn: () => void) => void;
  has: (id: unknown) => boolean;
};

type UseYjsPersistenceOptions = {
  roomId: string;
  wsUrl: string;
  getStore: () => StoreLike;
  fetchSnapshotWhenEmpty?: () => Promise<SnapshotData>;
  onSynced: () => void;
  isLocalUpdateRef: React.MutableRefObject<boolean>;
};

/**
 * IndexedDB 永続化と、空の場合の DB スナップショット復元。
 * ydoc を作成し、persistence をセットアップする。
 */
export function useYjsPersistence({
  roomId,
  wsUrl,
  getStore,
  fetchSnapshotWhenEmpty,
  onSynced,
  isLocalUpdateRef,
}: UseYjsPersistenceOptions): Y.Doc | null {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  useEffect(() => {
    if (typeof window === "undefined" || !roomId || !wsUrl) return;

    const yd = new Y.Doc();
    const yMap = yd.getMap<string>("tldraw");

    const persistence = new IndexeddbPersistence(roomId, yd);
    persistence.on("synced", () => {
      const hasData = yMap.size > 0;
      if (!hasData && fetchSnapshotWhenEmpty) {
        void fetchSnapshotWhenEmpty().then((snapshot) => {
          const records = snapshot?.records ?? [];
          const hasReactions = snapshot?.reactions && Object.keys(snapshot.reactions).length > 0;
          const hasComments = snapshot?.comments && Object.keys(snapshot.comments).length > 0;
          const hasReactionEmojiPreset =
            Array.isArray(snapshot?.reactionEmojiPreset) && snapshot.reactionEmojiPreset.length > 0;
          if (records.length === 0 && !hasReactions && !hasComments && !hasReactionEmojiPreset) {
            onSyncedRef.current();
            return;
          }
          const store = getStore();
          if (records.length > 0) {
            store.mergeRemoteChanges(() => store.put(records));
            restoreCameraFromLS(store, roomId);
          }
          isLocalUpdateRef.current = true;
          yd.transact(() => {
            for (const rec of records) {
              yMap.set(rec.id, JSON.stringify(rec));
            }
            const reactionsMap = yd.getMap<string>("reactions");
            for (const [k, v] of Object.entries(snapshot?.reactions ?? {})) {
              reactionsMap.set(k, v);
            }
            const commentsMap = yd.getMap<string>("comments");
            for (const [k, v] of Object.entries(snapshot?.comments ?? {})) {
              commentsMap.set(k, v);
            }
            if (hasReactionEmojiPreset) {
              const presetMap = yd.getMap<string>("reactionEmojiPreset");
              presetMap.set("emojis", JSON.stringify(snapshot!.reactionEmojiPreset));
            }
          }, LOCAL_ORIGIN);
          isLocalUpdateRef.current = false;
          onSyncedRef.current();
        });
      } else {
        onSyncedRef.current();
      }
    });

    setYdoc(yd);

    return () => {
      persistence.destroy();
      yd.destroy();
      setYdoc(null);
    };
  }, [roomId, wsUrl, getStore, fetchSnapshotWhenEmpty, isLocalUpdateRef]);

  return ydoc;
}
