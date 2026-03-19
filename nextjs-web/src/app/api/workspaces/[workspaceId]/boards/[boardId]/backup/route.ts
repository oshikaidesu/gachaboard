import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiErrorHandler";
import { assertBoardAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type Params = { params: Promise<{ workspaceId: string; boardId: string }> };

const KEEP_COUNT = 3;

/** GET - バックアップ一覧取得（id, savedAt, thumbnailSvg のみ） */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, boardId } = await params;

    if (!env.E2E_TEST_MODE) {
      const ctx = await assertBoardAccess(boardId);
      if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (ctx.board.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      const board = await db.board.findUnique({
        where: { id: boardId },
        select: { workspaceId: true },
      });
      if (!board || board.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const backups = await db.boardSnapshotHistory.findMany({
      where: { boardId },
      select: { id: true, savedAt: true, thumbnailSvg: true },
      orderBy: { savedAt: "desc" },
    });

    return NextResponse.json({
      backups: backups.map((b) => ({
        id: b.id,
        savedAt: b.savedAt.toISOString(),
        thumbnailSvg: b.thumbnailSvg ?? null,
      })),
    });
  } catch (e) {
    return handleApiError(e, "backup:GET");
  }
}

/** POST - バックアップ作成（直近3件保持、古いものを削除） */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, boardId } = await params;

    if (!env.E2E_TEST_MODE) {
      const ctx = await assertBoardAccess(boardId);
      if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (ctx.board.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      const board = await db.board.findUnique({
        where: { id: boardId },
        select: { workspaceId: true },
      });
      if (!board || board.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    let body: {
      records?: unknown[];
      reactions?: Record<string, string>;
      comments?: Record<string, string>;
      reactionEmojiPreset?: string[] | null;
      thumbnailSvg?: string | null;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const records = Array.isArray(body?.records) ? body.records : [];
    const reactions =
      body?.reactions && typeof body.reactions === "object" && !Array.isArray(body.reactions)
        ? body.reactions
        : {};
    const comments =
      body?.comments && typeof body.comments === "object" && !Array.isArray(body.comments)
        ? body.comments
        : {};
    const reactionEmojiPreset =
      body?.reactionEmojiPreset !== undefined
        ? Array.isArray(body.reactionEmojiPreset) && body.reactionEmojiPreset.length > 0
          ? body.reactionEmojiPreset.filter((e): e is string => typeof e === "string")
          : null
        : null;

    const snapshotData = {
      records,
      reactions,
      comments,
      reactionEmojiPreset,
      savedAt: new Date().toISOString(),
    };

    const thumbnailSvg =
      typeof body?.thumbnailSvg === "string" && body.thumbnailSvg.length > 0
        ? body.thumbnailSvg
        : null;

    // PostgreSQL jsonb の制限対策: サムネイルが大きすぎる場合は切り詰め（1MB 程度）
    const maxThumbnailLen = 1_000_000;
    const safeThumbnailSvg =
      thumbnailSvg && thumbnailSvg.length > maxThumbnailLen
        ? thumbnailSvg.slice(0, maxThumbnailLen)
        : thumbnailSvg;

    await db.boardSnapshotHistory.create({
      data: {
        boardId,
        snapshotData: snapshotData as object,
        thumbnailSvg: safeThumbnailSvg,
      },
    });

    // 古いものを削除（4件目以降）
    const toDelete = await db.boardSnapshotHistory.findMany({
      where: { boardId },
      select: { id: true },
      orderBy: { savedAt: "asc" },
    });

    if (toDelete.length > KEEP_COUNT) {
      const idsToDelete = toDelete.slice(0, toDelete.length - KEEP_COUNT).map((r) => r.id);
      await db.boardSnapshotHistory.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e, "backup:POST");
  }
}
