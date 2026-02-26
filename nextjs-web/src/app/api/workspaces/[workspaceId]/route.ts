import { NextRequest, NextResponse } from "next/server";
import { assertWorkspaceOwner, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";

type Params = { params: Promise<{ workspaceId: string }> };

/** DELETE /api/workspaces/[workspaceId] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.workspace.delete({ where: { id: workspaceId } });
  await writeAuditLog(ctx.session.user.id, workspaceId, "workspace.delete", workspaceId);
  return new NextResponse(null, { status: 204 });
}
