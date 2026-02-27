"use client";

import { createContext, useContext } from "react";

type BoardContextValue = {
  boardId: string;
  workspaceId: string;
  currentUserId: string;
};

export const BoardContext = createContext<BoardContextValue>({
  boardId: "",
  workspaceId: "",
  currentUserId: "",
});

export function useBoardContext() {
  return useContext(BoardContext);
}
