import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiErrorHandler";
import { assertBoardAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type Params = { params: Promise<{ workspaceId: string; boardId: string }> };

type SnapshotData = {
  records?: unknown[];
  reactions?: Record<string, string>;
  comments?: Record<string, string>;
  reactionEmojiPreset?: string[] | null;
  savedAt?: string;
} | null;

/** GET - Board.snapshotData を取得（sync-server 復旧時の復元用） */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
  const { workspaceId, boardId } = await params;

  let data: SnapshotData = null;

  if (!env.E2E_TEST_MODE) {
    const ctx = await assertBoardAccess(boardId);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (ctx.board.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    data = ctx.board.snapshotData as SnapshotData;
  } else {
    const board = await db.board.findUnique({
      where: { id: boardId },
      select: { snapshotData: true },
    });
    if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
    data = board.snapshotData as SnapshotData;
  }

  const reactionEmojiPreset = data?.reactionEmojiPreset ?? null;

  return NextResponse.json({
    records: data?.records ?? null,
    reactions: data?.reactions ?? null,
    comments: data?.comments ?? null,
    reactionEmojiPreset,
    savedAt: data?.savedAt ?? null,
  });
  } catch (e) {
    return handleApiError(e, "snapshot:GET");
  }
}

/**
 * PUT - Board.snapshotData を保存（定期的・離脱時にクライアントから送信）
 * 注意: 受信が空のフィールドで既存データを上書きしない（records/reactions/comments それぞれでガード）
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
  const { workspaceId, boardId } = await params;

  let current: Record<string, unknown> = {};

  if (!env.E2E_TEST_MODE) {
    const ctx = await assertBoardAccess(boardId);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (ctx.board.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    current = (ctx.board.snapshotData as Record<string, unknown> | null) ?? {};
  } else {
    const board = await db.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true, snapshotData: true },
    });
    if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (board.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    current = (board.snapshotData as Record<string, unknown> | null) ?? {};
  }

  const body = (await req.json()) as {
    records?: unknown[];
    reactions?: Record<string, string>;
    comments?: Record<string, string>;
    reactionEmojiPreset?: string[] | null;
  };
  const currentRecords = Array.isArray(current.records) ? current.records : [];
  const incomingRecords = Array.isArray(body?.records) ? body.records : [];
  // 既存にレコードがあるのに空で上書きするのを防ぐ（リアクション追加時などの誤保存でボードが消える不具合対策）
  const records =
    incomingRecords.length > 0
      ? incomingRecords
      : currentRecords.length > 0
        ? currentRecords
        : incomingRecords;

  const currentReactions =
    current.reactions && typeof current.reactions === "object" && !Array.isArray(current.reactions)
      ? (current.reactions as Record<string, string>)
      : {};
  const incomingReactions =
    body?.reactions && typeof body.reactions === "object" && !Array.isArray(body.reactions)
      ? body.reactions
      : {};
  const reactions =
    Object.keys(incomingReactions).length > 0
      ? incomingReactions
      : Object.keys(currentReactions).length > 0
        ? currentReactions
        : incomingReactions;

  const currentComments =
    current.comments && typeof current.comments === "object" && !Array.isArray(current.comments)
      ? (current.comments as Record<string, string>)
      : {};
  const incomingComments =
    body?.comments && typeof body.comments === "object" && !Array.isArray(body.comments)
      ? body.comments
      : {};
  const comments =
    Object.keys(incomingComments).length > 0
      ? incomingComments
      : Object.keys(currentComments).length > 0
        ? currentComments
        : incomingComments;
  const reactionEmojiPreset =
    body?.reactionEmojiPreset !== undefined
      ? Array.isArray(body.reactionEmojiPreset) && body.reactionEmojiPreset.length > 0
        ? body.reactionEmojiPreset.filter((e): e is string => typeof e === "string")
        : null
      : undefined;
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
  } catch (e) {
    return handleApiError(e, "snapshot:PUT");
  }
}

/** PATCH - reactionEmojiPreset のみ部分更新（reaction-preset ページ用） */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
  const { workspaceId, boardId } = await params;

  let current: Record<string, unknown> = {};

  if (!env.E2E_TEST_MODE) {
    const ctx = await assertBoardAccess(boardId);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (ctx.board.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    current = (ctx.board.snapshotData as Record<string, unknown> | null) ?? {};
  } else {
    const board = await db.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true, snapshotData: true },
    });
    if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (board.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    current = (board.snapshotData as Record<string, unknown> | null) ?? {};
  }

  const body = (await req.json()) as { reactionEmojiPreset?: string[] | null };
  const reactionEmojiPreset =
    body?.reactionEmojiPreset !== undefined
      ? Array.isArray(body.reactionEmojiPreset) && body.reactionEmojiPreset.length > 0
        ? body.reactionEmojiPreset.filter((e): e is string => typeof e === "string")
        : null
      : null;
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
  } catch (e) {
    return handleApiError(e, "snapshot:PATCH");
  }
}
