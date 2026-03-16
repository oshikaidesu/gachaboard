import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiErrorHandler";
import { assertWorkspaceAccess, assertWorkspaceOwner, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { env } from "@/lib/env";

type Params = { params: Promise<{ workspaceId: string }> };

/** GET /api/workspaces/[workspaceId] - ワークスペース詳細。SERVER_OWNER 設定時はオーナー or 招待メンバーのみ */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceAccess(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: { owner: { select: { discordName: true } } },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...workspace, ownerName: workspace.owner.discordName });
  } catch (e) {
    return handleApiError(e, "workspace:GET");
  }
}

/** PATCH /api/workspaces/[workspaceId] - trash, restore, or rename */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { session, workspace } = ctx;
  const body = await req.json() as { action: "trash" | "restore" | "rename"; name?: string; description?: string };

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

  const updated = await db.workspace.update({
    where: { id: workspaceId },
    data: { deletedAt: body.action === "trash" ? new Date() : null },
  });

  await writeAuditLog(session.user.id, workspaceId, `workspace.${body.action}`, workspaceId);
  return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e, "workspace:PATCH");
  }
}

/** DELETE /api/workspaces/[workspaceId] - 完全削除（ゴミ箱内のみ）。配下の全ボード・アセット・sync をまとめて削除 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!ctx.workspace.deletedAt) {
    return NextResponse.json({ error: "Move to trash first" }, { status: 400 });
  }

  // 1. 配下の全ボードの sync ドキュメントを削除
  const boards = await db.board.findMany({ where: { workspaceId }, select: { id: true } });
  const syncUrl = env.SYNC_SERVER_URL;
  await Promise.all(
    boards.map((b) =>
      fetch(`${syncUrl}/room/${b.id}`, { method: "DELETE" }).catch(() => {})
    )
  );

  // 2. ワークスペース配下の全アセットのファイルを削除
  const assets = await db.asset.findMany({ where: { workspaceId }, select: { storageKey: true } });
  await Promise.all(assets.map((a) => deleteFile(a.storageKey).catch(() => {})));

  // 3. アセットの DB レコードを削除
  await db.asset.deleteMany({ where: { workspaceId } });

  // 4. 未完了のアップロードセッションを削除（boardId が配下のボードのもの）
  const boardIds = boards.map((b) => b.id);
  if (boardIds.length > 0) {
    await db.s3UploadSession.deleteMany({ where: { boardId: { in: boardIds } } });
  }

  // 5. ワークスペース削除（ボードは DB の cascade で削除される）
  await db.workspace.delete({ where: { id: workspaceId } });
  await writeAuditLog(ctx.session.user.id, workspaceId, "workspace.delete", workspaceId);
  return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleApiError(e, "workspace:DELETE");
  }
}
