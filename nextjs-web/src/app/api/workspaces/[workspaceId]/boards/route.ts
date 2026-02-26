import { NextRequest, NextResponse } from "next/server";
import { requireLogin, assertWorkspaceOwner, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";

type Params = { params: Promise<{ workspaceId: string }> };

/** GET /api/workspaces/[workspaceId]/boards - ログイン済みなら誰でも取得可 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const boards = await db.board.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(boards);
}

/** POST /api/workspaces/[workspaceId]/boards - オーナーのみ作成可 */
export async function POST(req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceOwner(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { name: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const board = await db.board.create({
    data: { workspaceId, name: body.name.trim() },
  });

  await writeAuditLog(ctx.session.user.id, workspaceId, "board.create", board.id);
  return NextResponse.json(board, { status: 201 });
}
