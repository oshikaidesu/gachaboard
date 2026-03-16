import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiErrorHandler";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { USER_SELECT } from "@/lib/prismaHelpers";

/** ローカルアップロードは廃止。S3/MinIO 経由のみ。 */
export async function POST() {
  return NextResponse.json(
    { error: "MinIO が起動していません。docker compose up -d で MinIO を起動してください。" },
    { status: 503 }
  );
}

export async function GET(req: NextRequest) {
  try {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const boardId = searchParams.get("boardId");
  const trash = searchParams.get("trash") === "1";

  if (!workspaceId && !boardId) {
    return NextResponse.json({ error: "workspaceId or boardId is required" }, { status: 400 });
  }
  if (boardId) {
    const { assertBoardAccess } = await import("@/lib/authz");
    const boardCtx = await assertBoardAccess(boardId);
    if (!boardCtx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (workspaceId) {
    const { assertWorkspaceAccess } = await import("@/lib/authz");
    const wsCtx = await assertWorkspaceAccess(workspaceId);
    if (!wsCtx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assets = await db.asset.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      ...(boardId ? { boardId } : {}),
      deletedAt: trash ? { not: null } : null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      uploader: { select: USER_SELECT },
      ...(workspaceId ? { board: { select: { id: true, name: true } } } : {}),
    },
  });

  return NextResponse.json(
    assets.map((a) => ({ ...a, sizeBytes: a.sizeBytes.toString() }))
  );
  } catch (e) {
    return handleApiError(e, "assets:GET");
  }
}


