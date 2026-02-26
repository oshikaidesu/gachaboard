import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/** ログイン済みセッションを取得。未ログインなら null */
export async function getSession() {
  return getServerSession(authOptions);
}

/** ログイン必須。未ログインなら null を返す */
export async function requireLogin() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return session;
}

/** Workspace のオーナーか確認。違反時は null */
export async function assertWorkspaceOwner(workspaceId: string) {
  const session = await requireLogin();
  if (!session) return null;

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace || workspace.ownerUserId !== session.user.id) return null;

  return { session, workspace };
}

/** Board が存在しログイン済みか確認（アクセスはログインのみ必須） */
export async function assertBoardAccess(boardId: string) {
  const session = await requireLogin();
  if (!session) return null;

  const board = await db.board.findUnique({
    where: { id: boardId },
    include: { workspace: true },
  });
  if (!board) return null;

  return { session, board };
}

/** 監査ログ書き込み */
export async function writeAuditLog(
  userId: string | null,
  workspaceId: string | null,
  action: string,
  target: string,
  metadata?: Record<string, unknown>
) {
  await db.auditLog.create({
    data: { userId, workspaceId, action, target, metadata },
  });
}
