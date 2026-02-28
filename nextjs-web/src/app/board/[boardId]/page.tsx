import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import BoardClient from "./BoardClient";

type Props = {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{
    testUserId?: string;
    testUserName?: string;
    testAvatarUrl?: string;
  }>;
};

export default async function BoardPage({ params, searchParams }: Props) {
  const { boardId } = await params;
  const query = await searchParams;
  const isE2eMode = process.env.E2E_TEST_MODE === "1";
  const testUserId = query.testUserId?.trim();
  const testUserName = query.testUserName?.trim();
  const testAvatarUrl = query.testAvatarUrl?.trim();

  const boardRecord = await db.board.findUnique({ where: { id: boardId } });
  if (!boardRecord && !isE2eMode) notFound();

  if (isE2eMode && testUserId && testUserName) {
    return (
      <BoardClient
        boardId={boardId}
        workspaceId={boardRecord?.workspaceId ?? "__e2e_workspace__"}
        userName={testUserName}
        currentUserId={testUserId}
        avatarUrl={testAvatarUrl ?? null}
      />
    );
  }

  const [board, session] = await Promise.all([
    Promise.resolve(boardRecord),
    getServerSession(authOptions),
  ]);
  if (!board) notFound();
  if (!session?.user?.id) {
    redirect(`/?callbackUrl=${encodeURIComponent(`/board/${boardId}`)}`);
  }

  const rawName = session?.user?.name ?? "";
  const userName = rawName.trim() || "Unknown";
  const currentUserId = session.user.id;
  const avatarUrl = session?.user?.avatarUrl ?? null;

  return (
    <BoardClient
      boardId={boardId}
      workspaceId={board.workspaceId}
      userName={userName}
      currentUserId={currentUserId}
      avatarUrl={avatarUrl}
    />
  );
}
