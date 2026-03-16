import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { handleApiError } from "@/lib/apiErrorHandler";
import { assertWorkspaceOwner, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";
import { getBaseUrl } from "@/lib/baseUrl";

type Params = { params: Promise<{ workspaceId: string }> };

/** GET /api/workspaces/[workspaceId]/invite - 現在の招待 URL を返す（オーナーのみ） */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { inviteToken: true },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base = await getBaseUrl();
  const inviteUrl = workspace.inviteToken
    ? `${base}/invite/${workspace.inviteToken}`
    : null;

  return NextResponse.json({ inviteUrl });
  } catch (e) {
    return handleApiError(e, "workspaces-invite:GET");
  }
}

/** POST /api/workspaces/[workspaceId]/invite - 招待リンク発行・リセット（オーナーのみ） */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
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

  const inviteUrl = `${await getBaseUrl()}/invite/${token}`;
  return NextResponse.json({ inviteUrl });
  } catch (e) {
    return handleApiError(e, "workspaces-invite:POST");
  }
}
