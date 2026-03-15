import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import BoardTrashClient from "./BoardTrashClient";

type Props = {
  params: Promise<{ boardId: string }>;
};

export default async function BoardTrashPage({ params }: Props) {
  const { boardId } = await params;

  const [board, session] = await Promise.all([
    db.board.findUnique({ where: { id: boardId }, select: { id: true, name: true, workspaceId: true } }),
    getServerSession(authOptions),
  ]);

  if (!board) notFound();

  if (!session?.user?.id) {
    redirect(`/?callbackUrl=${encodeURIComponent(`/board/${boardId}/trash`)}`);
  }

  return (
    <BoardTrashClient
      boardId={board.id}
      boardName={board.name}
      workspaceId={board.workspaceId}
    />
  );
}
