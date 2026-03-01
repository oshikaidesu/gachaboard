"use client";

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useBoardContext } from "./BoardContext";
import { POLLING_INTERVAL_REACTIONS } from "@shared/constants";

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
};

const BoardReactionContext = createContext<BoardReactionContextValue>({
  getReactions: () => [],
  refresh: async () => {},
});

export function useBoardReactions(shapeId: string): {
  reactions: Reaction[];
  refresh: () => Promise<void>;
} {
  const { getReactions, refresh } = useContext(BoardReactionContext);
  return { reactions: getReactions(shapeId), refresh };
}

export function BoardReactionProvider({ children }: { children: React.ReactNode }) {
  const { boardId } = useBoardContext();
  const [byShape, setByShape] = useState<Map<string, Reaction[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!boardId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/reactions?boardId=${boardId}`, { signal: ac.signal });
      if (!res.ok) return;
      const all: Reaction[] = await res.json();
      const map = new Map<string, Reaction[]>();
      for (const r of all) {
        let arr = map.get(r.shapeId);
        if (!arr) { arr = []; map.set(r.shapeId, arr); }
        arr.push(r);
      }
      setByShape(map);
    } catch {
      // abort or network error
    }
  }, [boardId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLLING_INTERVAL_REACTIONS);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [load]);

  const getReactions = useCallback(
    (shapeId: string) => byShape.get(shapeId) ?? [],
    [byShape],
  );

  return (
    <BoardReactionContext.Provider value={{ getReactions, refresh: load }}>
      {children}
    </BoardReactionContext.Provider>
  );
}
