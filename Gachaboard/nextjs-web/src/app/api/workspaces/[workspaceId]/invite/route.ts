import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { assertWorkspaceOwner, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type Params = { params: Promise<{ workspaceId: string }> };

/** GET /api/workspaces/[workspaceId]/invite - 現在の招待 URL を返す（オーナーのみ） */
export async function GET(_req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { inviteToken: true },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inviteUrl = workspace.inviteToken
    ? `${env.NEXTAUTH_URL.replace(/\/$/, "")}/invite/${workspace.inviteToken}`
    : null;

  return NextResponse.json({ inviteUrl });
}

/** POST /api/workspaces/[workspaceId]/invite - 招待リンク発行・リセット（オーナーのみ） */
export async function POST(_req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { inviteToken: true },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = randomBytes(32).toString("base64url");
  await db.workspace.update({
    where: { id: workspaceId },
    data: { inviteToken: token },
  });

  const action = workspace.inviteToken ? "invite.reset" : "invite.create";
  await writeAuditLog(ctx.session.user.id, workspaceId, action, workspaceId);

  const inviteUrl = `${env.NEXTAUTH_URL.replace(/\/$/, "")}/invite/${token}`;
  return NextResponse.json({ inviteUrl });
}
