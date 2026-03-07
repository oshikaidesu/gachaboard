import { NextRequest, NextResponse } from "next/server";
import { assertWorkspaceAccess, assertWorkspaceOwner, requireLogin, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { env } from "@/lib/env";

type Params = { params: Promise<{ workspaceId: string; boardId: string }> };

/** PATCH /api/workspaces/[workspaceId]/boards/[boardId] - trash, restore, or rename */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { workspaceId, boardId } = await params;
  const ctx = await assertWorkspaceAccess(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { session } = ctx;

  const body = await req.json() as { action: "trash" | "restore" | "rename"; name?: string };

  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board || board.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "rename") {
    if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const updated = await db.board.update({
      where: { id: boardId },
      data: { name: body.name.trim() },
    });
    await writeAuditLog(session.user.id, workspaceId, "board.rename", boardId);
    return NextResponse.json(updated);
  }

  const updated = await db.board.update({
    where: { id: boardId },
    data: { deletedAt: body.action === "trash" ? new Date() : null },
  });

  await writeAuditLog(session.user.id, workspaceId, `board.${body.action}`, boardId);
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

  // ボードに紐づくアセットのファイルを削除してからDBレコードを消す
  const assets = await db.asset.findMany({ where: { boardId }, select: { id: true, storageKey: true, storageBackend: true } });
  await Promise.all(assets.map((a) => deleteFile(a.storageKey, (a.storageBackend as "local" | "s3") ?? "local").catch(() => {})));
  await db.asset.deleteMany({ where: { boardId } });

  await db.board.delete({ where: { id: boardId } });
  await writeAuditLog(ctx.session.user.id, workspaceId, "board.delete", boardId);

  // sync-server の SQLite ファイルも削除（失敗しても無視）
  try {
    const syncUrl = env.SYNC_SERVER_URL;
    await fetch(`${syncUrl}/room/${boardId}`, { method: "DELETE" });
  } catch {
    // sync-server が落ちていても DB 削除は成功させる
  }

  return new NextResponse(null, { status: 204 });
}
