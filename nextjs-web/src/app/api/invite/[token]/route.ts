import { NextRequest, NextResponse } from "next/server";
import { isValidInviteToken } from "@/lib/validators";
import { db } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

/** GET /api/invite/[token] - トークン検証・ワークスペース情報（未ログインでも取得可） */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  if (!isValidInviteToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const workspace = await db.workspace.findUnique({
    where: { inviteToken: token, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    workspaceId: workspace.id,
    workspaceName: workspace.name,
  });
}
