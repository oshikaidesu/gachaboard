"use client";

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useBoardContext } from "./BoardContext";
import { POLLING_INTERVAL_REACTIONS, POLLING_INTERVAL_REACTIONS_SYNC } from "@shared/constants";
import type { WebsocketProvider } from "y-websocket";

type Reaction = {
  id: string;
  shapeId: string;
  emoji: string;
  userId: string;
  deletedAt: string | null;
  user: { id: string; discordName: string; avatarUrl: string | null };
};

type BoardReactionContextValue = {
  getReactions: (shapeId: string) => Reaction[];
  refresh: () => Promise<void>;
  syncReactionToYjs: (reaction: Reaction) => void;
};

const REACTIONS_MAP_KEY = "reactions";

const BoardReactionContext = createContext<BoardReactionContextValue>({
  getReactions: () => [],
  refresh: async () => {},
  syncReactionToYjs: () => {},
});

export function useBoardReactions(shapeId: string): {
  reactions: Reaction[];
  refresh: () => Promise<void>;
  syncReactionToYjs: (reaction: Reaction) => void;
} {
  const { getReactions, refresh, syncReactionToYjs } = useContext(BoardReactionContext);
  return { reactions: getReactions(shapeId), refresh, syncReactionToYjs };
}

function reactionsToMap(all: Reaction[]): Map<string, Reaction[]> {
  const map = new Map<string, Reaction[]>();
  for (const r of all) {
    let arr = map.get(r.shapeId);
    if (!arr) { arr = []; map.set(r.shapeId, arr); }
    arr.push(r);
  }
  return map;
}

export function BoardReactionProvider({
  children,
  provider,
}: {
  children: React.ReactNode;
  provider?: WebsocketProvider;
}) {
  const { boardId } = useBoardContext();
  const [byShape, setByShape] = useState<Map<string, Reaction[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const byIdRef = useRef<Map<string, Reaction>>(new Map());
  const yMapRef = useRef<{ forEach: (fn: (v: string, k: string) => void) => void } | null>(null);

  const load = useCallback(async () => {
    if (!boardId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/reactions?boardId=${boardId}`, { signal: ac.signal });
      if (!res.ok) return;
      const all: Reaction[] = await res.json();
      const byId = new Map<string, Reaction>();
      for (const r of all) byId.set(r.id, r);
      yMapRef.current?.forEach((value) => {
        try {
          const r = JSON.parse(value) as Reaction;
          if (r?.id && r?.shapeId) {
            byId.set(r.id, { ...r, user: r.user ?? { id: r.userId, discordName: "?", avatarUrl: null } });
          }
        } catch {
          /* skip */
        }
      });
      byIdRef.current = byId;
      setByShape(reactionsToMap(Array.from(byId.values())));
    } catch {
      // abort or network error
    }
  }, [boardId]);

  const syncReactionToYjs = useCallback(
    (reaction: Reaction) => {
      if (!provider) return;
      const ydoc = provider.doc;
      const yMap = ydoc.getMap<string>(REACTIONS_MAP_KEY);
      yMap.set(reaction.id, JSON.stringify(reaction));
    },
    [provider]
  );

  const pollInterval = provider ? POLLING_INTERVAL_REACTIONS_SYNC : POLLING_INTERVAL_REACTIONS;
  useEffect(() => {
    load();
    const timer = setInterval(load, pollInterval);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [load, pollInterval]);

  useEffect(() => {
    if (!provider) return;
    const ydoc = provider.doc;
    const yMap = ydoc.getMap<string>(REACTIONS_MAP_KEY);
    yMapRef.current = yMap;

    const applyYUpdate = () => {
      const byId = new Map(byIdRef.current);
      yMap.forEach((value) => {
        try {
          const r = JSON.parse(value) as Reaction;
          if (r && r.id && r.shapeId) {
            byId.set(r.id, {
              ...r,
              user: r.user ?? { id: r.userId, discordName: "?", avatarUrl: null },
            });
          }
        } catch {
          // skip parse error
        }
      });
      byIdRef.current = byId;
      setByShape(reactionsToMap(Array.from(byId.values())));
    };

    applyYUpdate();
    yMap.observe(applyYUpdate);
    return () => {
      yMapRef.current = null;
      yMap.unobserve(applyYUpdate);
    };
  }, [provider]);

  const getReactions = useCallback(
    (shapeId: string) => byShape.get(shapeId) ?? [],
    [byShape],
  );

  return (
    <BoardReactionContext.Provider value={{ getReactions, refresh: load, syncReactionToYjs }}>
      {children}
    </BoardReactionContext.Provider>
  );
}
