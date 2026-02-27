"use client";

import dynamic from "next/dynamic";

const TldrawBoard = dynamic(() => import("@/app/components/TldrawBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center text-sm text-zinc-400">
      ボードを読み込み中...
    </div>
  ),
});

type Props = { boardId: string; workspaceId: string; userName: string; currentUserId: string };

export default function BoardClient({ boardId, workspaceId, userName, currentUserId }: Props) {
  return <TldrawBoard boardId={boardId} workspaceId={workspaceId} userName={userName} currentUserId={currentUserId} />;
}
