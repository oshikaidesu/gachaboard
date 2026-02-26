import { NextRequest, NextResponse } from "next/server";
import { assertWorkspaceOwner, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";

type Params = { params: Promise<{ workspaceId: string; boardId: string }> };

/** DELETE /api/workspaces/[workspaceId]/boards/[boardId] - オーナーのみ削除可 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { workspaceId, boardId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.board.delete({ where: { id: boardId } });
  await writeAuditLog(ctx.session.user.id, workspaceId, "board.delete", boardId);
  return new NextResponse(null, { status: 204 });
}
