"use client";

import { createContext, useContext } from "react";
import type { Atom } from "@cmpd/state";
import type { WebsocketProvider } from "y-websocket";

type UserInfo = { id: string; name: string; color: string };

type BoardContextValue = {
  boardId: string;
  workspaceId: string;
  currentUserId: string;
  userName: string;
  avatarUrl: string | null;
  userInfoAtom: Atom<UserInfo> | null;
  provider?: WebsocketProvider | null;
  /** リアクション・コメントが同期可能なとき true（オフライン/エラー時は false） */
  syncAvailable: boolean;
};

export const BoardContext = createContext<BoardContextValue>({
  boardId: "",
  workspaceId: "",
  currentUserId: "",
  userName: "",
  avatarUrl: null,
  userInfoAtom: null,
  provider: null,
  syncAvailable: false,
});

export function useBoardContext() {
  return useContext(BoardContext);
}
