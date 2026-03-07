import type { Prisma } from "@/generated/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { headers } from "next/headers";

/** ログイン済みセッションを取得。未ログインなら null */
export async function getSession() {
  return getServerSession(authOptions);
}

/** ログイン必須。未ログインなら null を返す */
export async function requireLogin() {
  // E2E テストモード: X-E2E-User-Id / X-E2E-User-Name ヘッダーで擬似セッションを生成
  if (env.E2E_TEST_MODE) {
    const hdrs = await headers();
    const userId = hdrs.get("x-e2e-user-id");
    const userName = hdrs.get("x-e2e-user-name") ?? "E2EUser";
    if (userId) {
      // DB の外部キー制約を満たすため固定の e2e ユーザー ID を使う
      return {
        user: { id: "__e2e_user__", name: userName, email: null, discordId: null, avatarUrl: null },
        expires: new Date(Date.now() + 86400_000).toISOString(),
      } as any;
    }
  }

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
    data: { userId, workspaceId, action, target, metadata: metadata as Prisma.InputJsonValue },
  });
}
