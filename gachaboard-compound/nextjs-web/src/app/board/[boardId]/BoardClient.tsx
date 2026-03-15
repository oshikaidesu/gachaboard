"use client";

import dynamic from "next/dynamic";

const CompoundBoard = dynamic(() => import("@/app/components/board/CompoundBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] min-h-[100dvh] items-center justify-center text-sm text-zinc-400">
      ボードを読み込み中...
    </div>
  ),
});

type Props = { boardId: string; workspaceId: string; boardName: string; userName: string; currentUserId: string; avatarUrl?: string | null };

export default function BoardClient({ boardId, workspaceId, boardName, userName, currentUserId, avatarUrl }: Props) {
  return <CompoundBoard boardId={boardId} workspaceId={workspaceId} boardName={boardName} userName={userName} currentUserId={currentUserId} avatarUrl={avatarUrl} />;
}
