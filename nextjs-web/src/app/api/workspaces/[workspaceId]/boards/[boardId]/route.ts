import { NextRequest, NextResponse } from "next/server";
import { requireLogin, assertWorkspaceOwner, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";

type Params = { params: Promise<{ workspaceId: string; boardId: string }> };

/** PATCH /api/workspaces/[workspaceId]/boards/[boardId] - trash or restore（全ログインユーザー可） */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { workspaceId, boardId } = await params;
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json() as { action: "trash" | "restore" };

  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board || board.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.board.update({
    where: { id: boardId },
    data: { deletedAt: action === "trash" ? new Date() : null },
  });

  await writeAuditLog(session.user.id, workspaceId, `board.${action}`, boardId);
  return NextResponse.json(updated);
}

/** DELETE /api/workspaces/[workspaceId]/boards/[boardId] - 完全削除（ゴミ箱内のみ、オーナーのみ） */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { workspaceId, boardId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!board.deletedAt) {
    return NextResponse.json({ error: "Move to trash first" }, { status: 400 });
  }

  await db.board.delete({ where: { id: boardId } });
  await writeAuditLog(ctx.session.user.id, workspaceId, "board.delete", boardId);

  // sync-server の SQLite ファイルも削除（失敗しても無視）
  try {
    const syncUrl = process.env.SYNC_SERVER_URL ?? "http://sync-server:5858";
    await fetch(`${syncUrl}/room/${boardId}`, { method: "DELETE" });
  } catch {
    // sync-server が落ちていても DB 削除は成功させる
  }

  return new NextResponse(null, { status: 204 });
}
