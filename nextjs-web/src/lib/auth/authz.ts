/**
 * API ルート用の認可ヘルパー。
 * セッション取得・ワークスペース/ボード/アセットへのアクセス判定を担当。
 */

import type { Prisma } from "@/generated/prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { headers } from "next/headers";

// ---------- セッション・ログイン ----------

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

// ---------- サーバーオーナー ----------

/** サーバーオーナーか確認。SERVER_OWNER_DISCORD_ID 未設定時は全員 true */
function isServerOwner(session: { user: { discordId?: string | null } } | null): boolean {
  if (!session?.user?.discordId) return false;
  const id = env.SERVER_OWNER_DISCORD_ID.trim();
  if (!id) return true; // 未設定なら制限なし（従来どおり）
  return session.user.discordId === id;
}

/** サーバーオーナーであることを要求。違反時は null。E2E 時はスキップ */
export async function assertServerOwner() {
  const session = await requireLogin();
  if (!session) return null;
  if (env.E2E_TEST_MODE) return { session };
  if (!isServerOwner(session)) return null;
  return { session };
}

// ---------- ワークスペース ----------

/** ワークスペースオーナーまたは招待メンバーか */
async function hasWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerUserId: true },
  });
  if (!workspace) return false;
  if (workspace.ownerUserId === userId) return true;
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  return !!member;
}

/** アセットからワークスペースを取得。board.workspace があればそれを、なければ workspaceId で取得 */
async function getAssetWorkspace(asset: {
  board?: { workspace: Awaited<ReturnType<typeof db.workspace.findUnique>> } | null;
  workspaceId: string;
}) {
  if (asset.board?.workspace) return asset.board.workspace;
  return db.workspace.findUnique({ where: { id: asset.workspaceId } });
}

/** ワークスペースへアクセス可能か（オーナー or 招待メンバー） */
export async function assertWorkspaceAccess(workspaceId: string) {
  const session = await requireLogin();
  if (!session) return null;

  if (env.E2E_TEST_MODE) {
    const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
    return workspace ? { session, workspace } : null;
  }

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return null;

  if (env.SERVER_OWNER_DISCORD_ID.trim()) {
    const ok = workspace.ownerUserId === session.user.id || (await hasWorkspaceAccess(workspaceId, session.user.id));
    if (!ok) return null;
  }

  return { session, workspace };
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

// ---------- ボード ----------

/** Board が存在しログイン済みか。サーバーオーナーモード時は WS オーナー or 招待メンバー */
export async function assertBoardAccess(boardId: string) {
  const session = await requireLogin();
  if (!session) return null;

  const board = await db.board.findUnique({
    where: { id: boardId },
    include: { workspace: true },
  });
  if (!board) return null;

  if (env.E2E_TEST_MODE) return { session, board };

  if (env.SERVER_OWNER_DISCORD_ID.trim()) {
    const ok =
      board.workspace.ownerUserId === session.user.id ||
      (await hasWorkspaceAccess(board.workspaceId, session.user.id));
    if (!ok) return null;
  }

  return { session, board };
}

// ---------- アセット ----------

/**
 * アセットの読み取り権限を確認。
 * ワークスペースオーナー、アップロード者、または所属ボードへアクセス可能なユーザーを許可。
 */
export async function assertAssetReadAccess(assetId: string) {
  const session = await requireLogin();
  if (!session) return null;

  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: { board: { include: { workspace: true } } },
  });
  if (!asset) return null;

  const workspace = await getAssetWorkspace(asset);
  if (!workspace) return null;

  if (workspace.ownerUserId === session.user.id) return { session, asset };
  if (asset.uploaderId === session.user.id) return { session, asset };
  if (await hasWorkspaceAccess(asset.workspaceId, session.user.id)) return { session, asset };
  if (asset.boardId) {
    const boardAccess = await assertBoardAccess(asset.boardId);
    if (boardAccess) return { session, asset };
  }
  return null;
}

/**
 * アセットの書き込み権限を確認（trash/restore/delete 用）。
 * ワークスペースオーナーまたはアップロード者のみ許可。
 */
export async function assertAssetWriteAccess(assetId: string) {
  const session = await requireLogin();
  if (!session) return null;

  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: { board: { include: { workspace: true } } },
  });
  if (!asset) return null;

  const workspace = await getAssetWorkspace(asset);
  if (!workspace) return null;

  if (workspace.ownerUserId === session.user.id) return { session, asset };
  if (asset.uploaderId === session.user.id) return { session, asset };
  if (await hasWorkspaceAccess(asset.workspaceId, session.user.id)) return { session, asset };
  return null;
}

/**
 * ワークスペースへの書き込み権限を確認（オーナー or 招待メンバー）。
 * アップロード等で使用。
 */
export async function assertWorkspaceWriteAccess(workspaceId: string) {
  const session = await requireLogin();
  if (!session) return null;

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return null;
  if (workspace.ownerUserId === session.user.id) return { session, workspace };
  if (env.SERVER_OWNER_DISCORD_ID.trim() && (await hasWorkspaceAccess(workspaceId, session.user.id))) {
    return { session, workspace };
  }
  return null;
}

// ---------- S3 セッション・監査 ----------

/**
 * S3 アップロードセッションを取得。uploaderId が一致する場合のみ返す。
 * 認可チェック用。requireLogin は呼び出し元で行うこと。
 */
export async function getS3UploadSessionForUser(uploadId: string, userId: string) {
  const row = await db.s3UploadSession.findUnique({
    where: { uploadId },
  });
  if (!row || row.uploaderId !== userId) return null;
  return row;
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
