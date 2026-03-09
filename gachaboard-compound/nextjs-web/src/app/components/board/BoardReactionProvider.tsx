"use client";

import React, { createContext, useContext, useCallback } from "react";
import { useBoardContext } from "./BoardContext";
import type { WebsocketProvider } from "y-websocket";
import { useYMapSync } from "@/app/hooks/useYMapSync";

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
  addReaction: (shapeId: string, emoji: string) => void;
  removeReaction: (reactionId: string) => void;
};

const REACTIONS_MAP_KEY = "reactions";

const BoardReactionContext = createContext<BoardReactionContextValue>({
  getReactions: () => [],
  addReaction: () => {},
  removeReaction: () => {},
});

export function useBoardReactions(shapeId: string): {
  reactions: Reaction[];
  addReaction: (emoji: string) => void;
  removeReaction: (reactionId: string) => void;
} {
  const { getReactions, addReaction, removeReaction } = useContext(BoardReactionContext);
  return {
    reactions: getReactions(shapeId),
    addReaction: (emoji) => addReaction(shapeId, emoji),
    removeReaction,
  };
}

function parseReaction(value: string): Reaction | null {
  try {
    const r = JSON.parse(value) as Reaction;
    if (r && r.id && r.shapeId && !r.deletedAt) {
      return {
        ...r,
        user: r.user ?? { id: r.userId, discordName: "?", avatarUrl: null },
      };
    }
  } catch {
    /* skip parse error */
  }
  return null;
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
  const { currentUserId, userName, avatarUrl } = useBoardContext();
  const byShape = useYMapSync(provider, REACTIONS_MAP_KEY, parseReaction, reactionsToMap);

  const addReaction = useCallback(
    (shapeId: string, emoji: string) => {
      if (!provider) return;
      const id = crypto.randomUUID();
      const reaction: Reaction = {
        id,
        shapeId,
        emoji,
        userId: currentUserId,
        deletedAt: null,
        user: { id: currentUserId, discordName: userName, avatarUrl: avatarUrl ?? null },
      };
      const ydoc = provider.doc;
      const yMap = ydoc.getMap<string>(REACTIONS_MAP_KEY);
      yMap.set(id, JSON.stringify(reaction));
    },
    [provider, currentUserId, userName, avatarUrl]
  );

  const removeReaction = useCallback(
    (reactionId: string) => {
      if (!provider) return;
      const ydoc = provider.doc;
      const yMap = ydoc.getMap<string>(REACTIONS_MAP_KEY);
      const raw = yMap.get(reactionId);
      if (!raw) return;
      try {
        const r = JSON.parse(raw) as Reaction;
        yMap.set(reactionId, JSON.stringify({ ...r, deletedAt: new Date().toISOString() }));
      } catch {
        yMap.delete(reactionId);
      }
    },
    [provider]
  );

  const getReactions = useCallback(
    (shapeId: string) => byShape.get(shapeId) ?? [],
    [byShape],
  );

  return (
    <BoardReactionContext.Provider value={{ getReactions, addReaction, removeReaction }}>
      {children}
    </BoardReactionContext.Provider>
  );
}
