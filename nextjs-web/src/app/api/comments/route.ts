import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { USER_SELECT, SOFT_DELETE_FILTER } from "@/lib/prismaHelpers";

export async function GET(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assetId = req.nextUrl.searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });

  const comments = await db.mediaComment.findMany({
    where: { assetId, ...SOFT_DELETE_FILTER },
    orderBy: { timeSec: "asc" },
    include: { author: { select: USER_SELECT } },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId, workspaceId, boardId, timeSec, body } =
    await req.json() as { assetId: string; workspaceId: string; boardId?: string; timeSec: number; body: string };

  if (!assetId || !workspaceId || timeSec == null || !body?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const comment = await db.mediaComment.create({
    data: {
      assetId,
      workspaceId,
      boardId: boardId ?? null,
      authorUserId: session.user.id,
      timeSec,
      body: body.trim(),
    },
    include: { author: { select: USER_SELECT } },
  });

  return NextResponse.json(comment, { status: 201 });
}
