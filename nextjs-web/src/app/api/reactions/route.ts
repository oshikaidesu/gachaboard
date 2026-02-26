import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const boardId = req.nextUrl.searchParams.get("boardId");
  const shapeId = req.nextUrl.searchParams.get("shapeId");
  if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 });

  const reactions = await db.objectReaction.findMany({
    where: { boardId, ...(shapeId ? { shapeId } : {}), deletedAt: null },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  // emoji ごとに集計
  const grouped: Record<string, { emoji: string; count: number; users: { id: string; name: string | null; image: string | null }[]; reacted: boolean }> = {};
  for (const r of reactions) {
    const key = `${r.shapeId}:${r.emoji}`;
    if (!grouped[key]) grouped[key] = { emoji: r.emoji, count: 0, users: [], reacted: false };
    grouped[key].count++;
    grouped[key].users.push(r.user);
    if (r.userId === session.user.id) grouped[key].reacted = true;
  }

  return NextResponse.json(reactions);
}

export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId, workspaceId, shapeId, emoji } =
    await req.json() as { boardId: string; workspaceId: string; shapeId: string; emoji: string };

  if (!boardId || !workspaceId || !shapeId || !emoji) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await db.objectReaction.findUnique({
    where: { boardId_shapeId_emoji_userId: { boardId, shapeId, emoji, userId: session.user.id } },
  });

  if (existing) {
    // トグル: 既存があれば削除/復元
    const updated = await db.objectReaction.update({
      where: { id: existing.id },
      data: { deletedAt: existing.deletedAt ? null : new Date() },
    });
    return NextResponse.json(updated);
  }

  const reaction = await db.objectReaction.create({
    data: { boardId, workspaceId, shapeId, emoji, userId: session.user.id },
  });

  return NextResponse.json(reaction, { status: 201 });
}
