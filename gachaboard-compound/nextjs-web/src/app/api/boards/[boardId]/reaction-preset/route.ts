import { NextRequest, NextResponse } from "next/server";
import { assertBoardAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import { DEFAULT_REACTION_EMOJI_LIST } from "@shared/constants";

type Params = { params: Promise<{ boardId: string }> };

/** GET - 誰でも取得可。null ならデフォルトを返す */
export async function GET(req: NextRequest, { params }: Params) {
  const { boardId } = await params;
  const ctx = await assertBoardAccess(boardId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { reactionEmojiPreset: true },
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const emojis =
    Array.isArray(board.reactionEmojiPreset) && board.reactionEmojiPreset.length > 0
      ? (board.reactionEmojiPreset as string[])
      : DEFAULT_REACTION_EMOJI_LIST;

  return NextResponse.json({ emojis });
}

/** PATCH - ボードにアクセスできるログイン済みユーザーなら誰でも */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { boardId } = await params;
  const ctx = await assertBoardAccess(boardId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const board = await db.board.findUnique({ where: { id: boardId } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as { emojis?: string[] };
  if (!Array.isArray(body.emojis)) {
    return NextResponse.json({ error: "emojis must be an array" }, { status: 400 });
  }

  // 1〜48 個に制限
  const emojis = body.emojis
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .slice(0, 48);

  if (emojis.length === 0) {
    return NextResponse.json({ error: "At least 1 emoji required" }, { status: 400 });
  }

  await db.board.update({
    where: { id: boardId },
    data: { reactionEmojiPreset: emojis },
  });

  return NextResponse.json({ emojis });
}
