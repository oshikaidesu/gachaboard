"use client";

import React, { createContext, useContext, useCallback } from "react";
import { useBoardContext } from "./BoardContext";
import type { WebsocketProvider } from "y-websocket";
import { useYMapSync } from "@/app/hooks/yjs/useYMapSync";

/** Y.Doc に保存するコメント形式。author は非正規化で埋め込む */
export type YDocComment = {
  id: string;
  assetId: string;
  timeSec: number;
  body: string;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt?: string;
  deletedAt?: string | null;
};

/** 表示用。ApiComment 互換 */
export type DisplayComment = YDocComment & {
  author: { id: string; discordName: string; avatarUrl: string | null };
};

type BoardCommentContextValue = {
  getComments: (assetId: string) => DisplayComment[];
  addComment: (assetId: string, timeSec: number, body: string) => void;
  deleteComment: (commentId: string) => void;
  isInProvider: boolean;
};

const COMMENTS_MAP_KEY = "comments";

const BoardCommentContext = createContext<BoardCommentContextValue>({
  getComments: () => [],
  addComment: () => {},
  deleteComment: () => {},
  isInProvider: false,
});

export function useBoardComments(assetId: string): {
  comments: DisplayComment[];
  addComment: (timeSec: number, body: string) => void;
  deleteComment: (commentId: string) => void;
  isInProvider: boolean;
} {
  const { getComments, addComment, deleteComment, isInProvider } = useContext(BoardCommentContext);
  return {
    comments: getComments(assetId),
    addComment: (timeSec, body) => addComment(assetId, timeSec, body),
    deleteComment,
    isInProvider,
  };
}

function toDisplayComment(c: YDocComment): DisplayComment {
  return {
    ...c,
    author: {
      id: c.authorUserId,
      discordName: c.authorName,
      avatarUrl: c.authorAvatarUrl,
    },
  };
}

function commentsByAsset(all: DisplayComment[]): Map<string, DisplayComment[]> {
  const map = new Map<string, DisplayComment[]>();
  for (const c of all) {
    const arr = map.get(c.assetId) ?? [];
    arr.push(c);
    map.set(c.assetId, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.timeSec - b.timeSec);
  }
  return map;
}

function parseComment(value: string): DisplayComment | null {
  try {
    const c = JSON.parse(value) as YDocComment;
    if (c && c.id && c.assetId && !c.deletedAt) return toDisplayComment(c);
  } catch {
    /* skip parse error */
  }
  return null;
}

export function BoardCommentProvider({
  children,
  provider,
}: {
  children: React.ReactNode;
  provider?: WebsocketProvider;
}) {
  const { currentUserId, userName, avatarUrl } = useBoardContext();
  const byAsset = useYMapSync(provider, COMMENTS_MAP_KEY, parseComment, commentsByAsset);

  const addComment = useCallback(
    (assetId: string, timeSec: number, body: string) => {
      if (!provider) return;
      const id = crypto.randomUUID();
      const comment: YDocComment = {
        id,
        assetId,
        timeSec,
        body,
        authorUserId: currentUserId,
        authorName: userName,
        authorAvatarUrl: avatarUrl ?? null,
        createdAt: new Date().toISOString(),
      };
      const ydoc = provider.doc;
      const yMap = ydoc.getMap<string>(COMMENTS_MAP_KEY);
      yMap.set(id, JSON.stringify(comment));
    },
    [provider, currentUserId, userName, avatarUrl]
  );

  const deleteComment = useCallback(
    (commentId: string) => {
      if (!provider) return;
      const ydoc = provider.doc;
      const yMap = ydoc.getMap<string>(COMMENTS_MAP_KEY);
      const raw = yMap.get(commentId);
      if (!raw) return;
      try {
        const c = JSON.parse(raw) as YDocComment;
        yMap.set(commentId, JSON.stringify({ ...c, deletedAt: new Date().toISOString() }));
      } catch {
        yMap.delete(commentId);
      }
    },
    [provider]
  );

  const getComments = useCallback(
    (assetId: string) => byAsset.get(assetId) ?? [],
    [byAsset],
  );

  return (
    <BoardCommentContext.Provider
      value={{
        getComments,
        addComment,
        deleteComment,
        isInProvider: true,
      }}
    >
      {children}
    </BoardCommentContext.Provider>
  );
}
