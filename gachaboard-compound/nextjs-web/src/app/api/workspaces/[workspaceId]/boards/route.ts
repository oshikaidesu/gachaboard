import { NextRequest, NextResponse } from "next/server";
import { assertWorkspaceAccess, assertWorkspaceOwner, requireLogin, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";

type Params = { params: Promise<{ workspaceId: string }> };

/** GET /api/workspaces/[workspaceId]/boards - SERVER_OWNER 設定時はオーナー or 招待メンバーのみ */
export async function GET(req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceAccess(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const includeDeleted = req.nextUrl.searchParams.get("includeDeleted") === "1";

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const boards = await db.board.findMany({
    where: {
      workspaceId,
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(boards);
}

/** POST /api/workspaces/[workspaceId]/boards - SERVER_OWNER 設定時はオーナー or 招待メンバーのみ */
export async function POST(req: NextRequest, { params }: Params) {
  const { workspaceId } = await params;
  const ctx = await assertWorkspaceAccess(workspaceId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { session } = ctx;
  const body = await req.json() as { name: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const board = await db.board.create({
    data: { workspaceId, name: body.name.trim() },
  });

  await writeAuditLog(session.user.id, workspaceId, "board.create", board.id);
  return NextResponse.json(board, { status: 201 });
}
