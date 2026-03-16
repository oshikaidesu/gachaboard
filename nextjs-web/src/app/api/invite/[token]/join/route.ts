import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiErrorHandler";
import { requireLogin, writeAuditLog } from "@/lib/authz";
import { isValidInviteToken } from "@/lib/validators";
import { db } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

/** POST /api/invite/[token]/join - 招待リンクでワークスペースに参加 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // セッションの user.id が DB に存在するか確認（DB リセット後などで FK 違反を防ぐ）
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!user) {
    return NextResponse.json(
      { error: "セッションが無効です。再ログインしてください。" },
      { status: 401 }
    );
  }

  const { token } = await params;

  if (!isValidInviteToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const workspace = await db.workspace.findUnique({
    where: { inviteToken: token, deletedAt: null },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } },
    create: { workspaceId: workspace.id, userId: session.user.id },
    update: {},
  });

  await writeAuditLog(session.user.id, workspace.id, "invite.join", workspace.id);

  return NextResponse.json({ workspaceId: workspace.id });
  } catch (e) {
    return handleApiError(e, "invite-join");
  }
}
