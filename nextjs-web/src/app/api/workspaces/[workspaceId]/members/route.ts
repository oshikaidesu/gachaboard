import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiErrorHandler";
import { assertWorkspaceAccess, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";
import type { ApiWorkspaceMember } from "@shared/apiTypes";

const KICK_GRACE_MS = 24 * 60 * 60 * 1000;

type Params = { params: Promise<{ workspaceId: string }> };

function canKick(workspace: { ownerUserId: string; members: { userId: string; createdAt: Date }[] }, currentUserId: string): boolean {
  if (workspace.ownerUserId === currentUserId) return true;
  const self = workspace.members.find((m) => m.userId === currentUserId);
  if (!self) return false;
  return Date.now() - self.createdAt.getTime() >= KICK_GRACE_MS;
}

/** GET /api/workspaces/[workspaceId]/members - オーナー＋招待メンバー一覧 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceAccess(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: { select: { id: true, discordName: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, discordName: true, avatarUrl: true } } },
      },
    },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerItem: ApiWorkspaceMember = {
    userId: workspace.owner.id,
    discordName: workspace.owner.discordName,
    avatarUrl: workspace.owner.avatarUrl,
    role: "owner",
    joinedAt: workspace.createdAt.toISOString(),
  };

  const ownerId = workspace.ownerUserId;
  const memberItems: ApiWorkspaceMember[] = workspace.members
    .filter((m) => m.userId !== ownerId)
    .map((m) => ({
      userId: m.user.id,
      discordName: m.user.discordName,
      avatarUrl: m.user.avatarUrl,
      role: "member" as const,
      joinedAt: m.createdAt.toISOString(),
    }));

  const members = [ownerItem, ...memberItems];
  const canKickMembers = canKick(workspace, ctx.session.user.id);

  return NextResponse.json({ members, canKick: canKickMembers });
  } catch (e) {
    return handleApiError(e, "members:GET");
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/members - 招待メンバーをキック
 * オーナー、または参加から24時間経過した招待メンバーが実行可能
 * Body: { userId: string }
 * キック時に招待リンクを自動リセット（旧リンク無効化）
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceAccess(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: true },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canKick(workspace, ctx.session.user.id)) {
    return NextResponse.json({ error: "Kick requires owner or 24h after join" }, { status: 403 });
  }

  const body = (await req.json()) as { userId?: string };
  const userId = body.userId;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (workspace.ownerUserId === userId) {
    return NextResponse.json({ error: "Cannot kick owner" }, { status: 400 });
  }

  const member = workspace.members.find((m) => m.userId === userId);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await db.$transaction([
    db.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    }),
    db.workspace.update({
      where: { id: workspaceId },
      data: { inviteToken: null },
    }),
  ]);

  await writeAuditLog(ctx.session.user.id, workspaceId, "member.kick", userId);

  return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleApiError(e, "members:DELETE");
  }
}
