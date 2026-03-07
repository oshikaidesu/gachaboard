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

  const data = board.snapshotData as {
    records?: unknown[];
    reactions?: Record<string, string>;
    comments?: Record<string, string>;
    reactionEmojiPreset?: string[] | null;
    savedAt?: string;
  } | null;
  const reactionEmojiPreset = data?.reactionEmojiPreset ?? null;

  return NextResponse.json({
    records: data?.records ?? null,
    reactions: data?.reactions ?? null,
    comments: data?.comments ?? null,
    reactionEmojiPreset,
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

  const body = (await req.json()) as {
    records?: unknown[];
    reactions?: Record<string, string>;
    comments?: Record<string, string>;
    reactionEmojiPreset?: string[] | null;
  };
  const records = Array.isArray(body?.records) ? body.records : [];
  const reactions = body?.reactions && typeof body.reactions === "object" ? body.reactions : {};
  const comments = body?.comments && typeof body.comments === "object" ? body.comments : {};
  const reactionEmojiPreset =
    body?.reactionEmojiPreset !== undefined
      ? Array.isArray(body.reactionEmojiPreset) && body.reactionEmojiPreset.length > 0
        ? body.reactionEmojiPreset.filter((e): e is string => typeof e === "string")
        : null
      : undefined;

  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { snapshotData: true },
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = (board.snapshotData as Record<string, unknown> | null) ?? {};
  const snapshotData = {
    ...current,
    records,
    reactions,
    comments,
    ...(reactionEmojiPreset !== undefined && { reactionEmojiPreset }),
    savedAt: new Date().toISOString(),
  };

  await db.board.update({
    where: { id: boardId },
    data: { snapshotData: snapshotData as object },
  });

  return NextResponse.json({ ok: true });
}

/** PATCH - reactionEmojiPreset のみ部分更新（reaction-preset ページ用） */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { workspaceId, boardId } = await params;
  const ctx = await assertBoardAccess(boardId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.board.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as { reactionEmojiPreset?: string[] | null };
  const reactionEmojiPreset =
    body?.reactionEmojiPreset !== undefined
      ? Array.isArray(body.reactionEmojiPreset) && body.reactionEmojiPreset.length > 0
        ? body.reactionEmojiPreset.filter((e): e is string => typeof e === "string")
        : null
      : null;

  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { snapshotData: true },
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = (board.snapshotData as Record<string, unknown> | null) ?? {};
  const snapshotData = {
    ...current,
    reactionEmojiPreset,
    savedAt: new Date().toISOString(),
  };

  await db.board.update({
    where: { id: boardId },
    data: { snapshotData: snapshotData as object },
  });

  return NextResponse.json({ ok: true });
}
