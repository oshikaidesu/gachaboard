import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiErrorHandler";
import { assertBoardAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type Params = {
  params: Promise<{ workspaceId: string; boardId: string; backupId: string }>;
};

/** POST - バックアップから復元（Board.snapshotData 上書き + sync-server のドキュメント削除） */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { workspaceId, boardId, backupId } = await params;

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

    const backup = await db.boardSnapshotHistory.findFirst({
      where: { id: backupId, boardId },
      select: { snapshotData: true },
    });

    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const snapshotData = backup.snapshotData as Record<string, unknown>;
    const records = Array.isArray(snapshotData?.records) ? snapshotData.records : [];
    const reactions =
      snapshotData?.reactions &&
      typeof snapshotData.reactions === "object" &&
      !Array.isArray(snapshotData.reactions)
        ? (snapshotData.reactions as Record<string, string>)
        : {};
    const comments =
      snapshotData?.comments &&
      typeof snapshotData.comments === "object" &&
      !Array.isArray(snapshotData.comments)
        ? (snapshotData.comments as Record<string, string>)
        : {};
    const reactionEmojiPreset = Array.isArray(snapshotData?.reactionEmojiPreset)
      ? snapshotData.reactionEmojiPreset.filter((e): e is string => typeof e === "string")
      : null;

    const dataToSave = {
      records,
      reactions,
      comments,
      reactionEmojiPreset,
      savedAt: new Date().toISOString(),
    };

    await db.board.update({
      where: { id: boardId },
      data: { snapshotData: dataToSave as object },
    });

    // sync-server の SQLite から該当ドキュメントを削除（次回ボード開時に fetchSnapshotWhenEmpty で復元データが読み込まれる）
    try {
      const syncUrl = env.SYNC_SERVER_URL;
      await fetch(`${syncUrl}/room/${boardId}`, { method: "DELETE" });
    } catch {
      // sync-server が落ちていても DB 更新は成功させる
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e, "backup:restore:POST");
  }
}
