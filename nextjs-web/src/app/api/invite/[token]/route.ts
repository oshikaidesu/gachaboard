import { NextRequest, NextResponse } from "next/server";
import { isValidInviteToken } from "@/lib/validators";
import { db } from "@/lib/db";
import { checkRateLimit, getRateLimitKey } from "@/lib/rateLimit";

type Params = { params: Promise<{ token: string }> };

const INVITE_RATE_LIMIT_PER_MIN = 60;

/** GET /api/invite/[token] - トークン検証・ワークスペース情報（未ログインでも取得可） */
export async function GET(req: NextRequest, { params }: Params) {
  const key = getRateLimitKey(req, "invite");
  if (!checkRateLimit(key, INVITE_RATE_LIMIT_PER_MIN)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

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
