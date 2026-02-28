import { NextRequest, NextResponse } from "next/server";
import { requireLogin, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";

/** GET /api/workspaces - 全ワークスペース一覧（ログイン済み全員が閲覧可） */
export async function GET(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const includeDeleted = req.nextUrl.searchParams.get("includeDeleted") === "1";

  const workspaces = await db.workspace.findMany({
    where: {
      // ownerUserId フィルタを削除 → 全ユーザーが全WSを閲覧可能
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    include: {
      _count: { select: { boards: true } },
      owner: { select: { discordName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ownerUserId を含めてUIでオーナー判定できるようにする
  return NextResponse.json(
    workspaces.map((ws) => ({
      ...ws,
      ownerName: ws.owner.discordName,
    }))
  );
}

/** POST /api/workspaces - ワークスペース作成 */
export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name: string; description?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const workspace = await db.workspace.create({
    data: {
      ownerUserId: session.user.id,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
    },
  });

  await writeAuditLog(session.user.id, workspace.id, "workspace.create", workspace.id);
  return NextResponse.json(workspace, { status: 201 });
}
