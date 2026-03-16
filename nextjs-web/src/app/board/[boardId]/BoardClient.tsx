"use client";

import dynamic from "next/dynamic";
import CompoundBoard from "@/app/components/board/CompoundBoard";

const CompoundBoardDynamic = dynamic(() => import("@/app/components/board/CompoundBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] min-h-[100dvh] items-center justify-center text-sm text-zinc-400">
      ボードを読み込み中...
    </div>
  ),
});

type Props = {
  boardId: string;
  workspaceId: string;
  boardName: string;
  userName: string;
  currentUserId: string;
  avatarUrl?: string | null;
  /** E2E 時は動的インポートをスキップして即時表示（テストの安定性のため） */
  e2eImmediateLoad?: boolean;
};

export default function BoardClient({
  boardId,
  workspaceId,
  boardName,
  userName,
  currentUserId,
  avatarUrl,
  e2eImmediateLoad,
}: Props) {
  const boardProps = {
    boardId,
    workspaceId,
    boardName,
    userName,
    currentUserId,
    avatarUrl,
  };
  if (e2eImmediateLoad) {
    return <CompoundBoard {...boardProps} />;
  }
  return <CompoundBoardDynamic {...boardProps} />;
}
