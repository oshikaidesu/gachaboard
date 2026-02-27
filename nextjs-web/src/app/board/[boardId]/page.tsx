import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import BoardClient from "./BoardClient";

type Props = { params: Promise<{ boardId: string }> };

export default async function BoardPage({ params }: Props) {
  const { boardId } = await params;
  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) notFound();

  return <BoardClient boardId={boardId} workspaceId={board.workspaceId} />;
}
