import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import BoardClient from "./BoardClient";

type Props = { params: Promise<{ boardId: string }> };

export default async function BoardPage({ params }: Props) {
  const { boardId } = await params;
  const [board, session] = await Promise.all([
    db.board.findUnique({ where: { id: boardId } }),
    getServerSession(authOptions),
  ]);
  if (!board) notFound();

  const userName = session?.user?.name ?? "Unknown";

  return (
    <BoardClient
      boardId={boardId}
      workspaceId={board.workspaceId}
      userName={userName}
    />
  );
}
