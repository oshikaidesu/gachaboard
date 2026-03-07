import { NextRequest, NextResponse } from "next/server";
import { assertWorkspaceOwner, requireLogin, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";

type Params = { params: Promise<{ workspaceId: string }> };

/** GET /api/workspaces/[workspaceId] - ワークスペース詳細（ログイン済み全員） */
export async function GET(_req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: { owner: { select: { discordName: true } } },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...workspace, ownerName: workspace.owner.discordName });
}

/** PATCH /api/workspaces/[workspaceId] - trash, restore, or rename */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { action: "trash" | "restore" | "rename"; name?: string; description?: string };

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "rename") {
    if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const updated = await db.workspace.update({
      where: { id: workspaceId },
      data: {
        name: body.name.trim(),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
      },
    });
    await writeAuditLog(session.user.id, workspaceId, "workspace.rename", workspaceId);
    return NextResponse.json(updated);
  }

  if (workspace.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.workspace.update({
    where: { id: workspaceId },
    data: { deletedAt: body.action === "trash" ? new Date() : null },
  });

  await writeAuditLog(session.user.id, workspaceId, `workspace.${body.action}`, workspaceId);
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

  // ワークスペース配下の全アセットファイルを削除してからDBレコードを消す
  const assets = await db.asset.findMany({ where: { workspaceId }, select: { storageKey: true, storageBackend: true } });
  await Promise.all(assets.map((a) => deleteFile(a.storageKey, (a.storageBackend as "local" | "s3") ?? "local").catch(() => {})));

  await db.workspace.delete({ where: { id: workspaceId } });
  await writeAuditLog(ctx.session.user.id, workspaceId, "workspace.delete", workspaceId);
  return new NextResponse(null, { status: 204 });
}
