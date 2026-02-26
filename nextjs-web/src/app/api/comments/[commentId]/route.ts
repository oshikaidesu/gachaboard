import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";

type Params = { params: Promise<{ commentId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await params;
  const { body } = await req.json() as { body: string };

  const comment = await db.mediaComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.authorUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.mediaComment.update({
    where: { id: commentId },
    data: { body: body.trim() },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await params;
  const comment = await db.mediaComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.authorUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.mediaComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
