import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiErrorHandler";
import { assertBoardAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type Params = { params: Promise<{ workspaceId: string; boardId: string }> };

const KEEP_COUNT = 3;

/** POST - 現在の Board.snapshotData からバックアップを作成（手動・復元ページ用）。サムネイルなし。直近3件保持。 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, boardId } = await params;

    let board: { snapshotData: unknown; workspaceId: string } | null = null;

    if (!env.E2E_TEST_MODE) {
      const ctx = await assertBoardAccess(boardId);
      if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (ctx.board.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      board = ctx.board;
    } else {
      const b = await db.board.findUnique({
        where: { id: boardId },
        select: { workspaceId: true, snapshotData: true },
      });
      if (!b || b.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      board = b;
    }

    const current = (board.snapshotData as Record<string, unknown> | null) ?? {};
    const records = Array.isArray(current.records) ? current.records : [];
    const reactions =
      current.reactions && typeof current.reactions === "object" && !Array.isArray(current.reactions)
        ? (current.reactions as Record<string, string>)
        : {};
    const comments =
      current.comments && typeof current.comments === "object" && !Array.isArray(current.comments)
        ? (current.comments as Record<string, string>)
        : {};
    const reactionEmojiPreset = Array.isArray(current.reactionEmojiPreset)
      ? (current.reactionEmojiPreset as string[]).filter((e): e is string => typeof e === "string")
      : null;

    const snapshotData = {
      records,
      reactions,
      comments,
      reactionEmojiPreset,
      savedAt: new Date().toISOString(),
    };

    await db.boardSnapshotHistory.create({
      data: {
        boardId,
        snapshotData: snapshotData as object,
        thumbnailSvg: null,
      },
    });

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
    return handleApiError(e, "backup:from-current:POST");
  }
}
