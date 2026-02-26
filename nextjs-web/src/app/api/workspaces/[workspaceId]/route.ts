import { NextRequest, NextResponse } from "next/server";
import { assertWorkspaceOwner, requireLogin, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";

type Params = { params: Promise<{ workspaceId: string }> };

/** PATCH /api/workspaces/[workspaceId] - trash or restore */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json() as { action: "trash" | "restore" };

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || workspace.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.workspace.update({
    where: { id: workspaceId },
    data: { deletedAt: action === "trash" ? new Date() : null },
  });

  await writeAuditLog(session.user.id, workspaceId, `workspace.${action}`, workspaceId);
  return NextResponse.json(updated);
}

/** DELETE /api/workspaces/[workspaceId] - 完全削除（ゴミ箱内のみ） */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!ctx.workspace.deletedAt) {
    return NextResponse.json({ error: "Move to trash first" }, { status: 400 });
  }

  await db.workspace.delete({ where: { id: workspaceId } });
  await writeAuditLog(ctx.session.user.id, workspaceId, "workspace.delete", workspaceId);
  return new NextResponse(null, { status: 204 });
}
