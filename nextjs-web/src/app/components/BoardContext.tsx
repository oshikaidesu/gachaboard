"use client";

import { createContext, useContext } from "react";
import type { Atom } from "@tldraw/tldraw";
import type { TLPresenceUserInfo } from "@tldraw/tldraw";

type BoardContextValue = {
  boardId: string;
  workspaceId: string;
  currentUserId: string;
  avatarUrl: string | null;
  userInfoAtom: Atom<TLPresenceUserInfo> | null;
};

export const BoardContext = createContext<BoardContextValue>({
  boardId: "",
  workspaceId: "",
  currentUserId: "",
  avatarUrl: null,
  userInfoAtom: null,
});

export function useBoardContext() {
  return useContext(BoardContext);
}
