"use client";

import { createContext, useContext } from "react";
import type { Atom } from "@cmpd/state";

type UserInfo = { id: string; name: string; color: string };

type BoardContextValue = {
  boardId: string;
  workspaceId: string;
  currentUserId: string;
  avatarUrl: string | null;
  userInfoAtom: Atom<UserInfo> | null;
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
