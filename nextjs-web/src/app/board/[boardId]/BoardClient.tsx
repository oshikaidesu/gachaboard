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

type Props = { boardId: string; workspaceId: string; userName: string };

export default function BoardClient({ boardId, workspaceId, userName }: Props) {
  return <TldrawBoard boardId={boardId} workspaceId={workspaceId} userName={userName} />;
}
