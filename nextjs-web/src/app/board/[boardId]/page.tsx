import dynamic from "next/dynamic";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

const TldrawBoard = dynamic(() => import("@/app/components/TldrawBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center text-sm text-zinc-400">
      ボードを読み込み中...
    </div>
  ),
});

type Props = { params: Promise<{ boardId: string }> };

export default async function BoardPage({ params }: Props) {
  const { boardId } = await params;
  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) notFound();

  return <TldrawBoard boardId={boardId} workspaceId={board.workspaceId} />;
}
