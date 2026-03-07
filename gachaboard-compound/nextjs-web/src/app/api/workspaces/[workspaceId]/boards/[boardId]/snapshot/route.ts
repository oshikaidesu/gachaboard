import { NextRequest, NextResponse } from "next/server";
import { assertBoardAccess } from "@/lib/authz";
import { db } from "@/lib/db";

type Params = { params: Promise<{ workspaceId: string; boardId: string }> };

/** GET - Board.snapshotData を取得（sync-server 復旧時の復元用） */
export async function GET(_req: NextRequest, { params }: Params) {
  const { workspaceId, boardId } = await params;
  const ctx = await assertBoardAccess(boardId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.board.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { snapshotData: true },
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = board.snapshotData as { records?: unknown[]; savedAt?: string } | null;
  return NextResponse.json({
    snapshotData: data?.records ?? null,
    savedAt: data?.savedAt ?? null,
  });
}

/** PUT - Board.snapshotData を保存（定期的・離脱時にクライアントから送信） */
export async function PUT(req: NextRequest, { params }: Params) {
  const { workspaceId, boardId } = await params;
  const ctx = await assertBoardAccess(boardId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.board.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as { records?: unknown[] };
  const records = Array.isArray(body?.records) ? body.records : [];

  await db.board.update({
    where: { id: boardId },
    data: {
      snapshotData: {
        records,
        savedAt: new Date().toISOString(),
      } as object,
    },
  });

  return NextResponse.json({ ok: true });
}
