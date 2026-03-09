import { NextRequest, NextResponse } from "next/server";
import { assertWorkspaceAccess, assertWorkspaceOwner, requireLogin, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";
import { createBoardSchema } from "@/lib/apiSchemas";
import { formatZodError, parseJsonBody } from "@/lib/parseJsonBody";
import { ZodError } from "zod";

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
  let body: { name: string };
  try {
    body = await parseJsonBody(req, createBoardSchema);
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: formatZodError(e) }, { status: 400 });
    throw e;
  }

  const board = await db.board.create({
    data: { workspaceId, name: body.name },
  });

  await writeAuditLog(session.user.id, workspaceId, "board.create", board.id);
  return NextResponse.json(board, { status: 201 });
}
