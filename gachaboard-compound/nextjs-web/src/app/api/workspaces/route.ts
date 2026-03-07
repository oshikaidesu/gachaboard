import { NextRequest, NextResponse } from "next/server";
import { assertServerOwner, requireLogin, writeAuditLog } from "@/lib/authz";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createWorkspaceSchema } from "@/lib/apiSchemas";
import { formatZodError, parseJsonBody } from "@/lib/parseJsonBody";
import { ZodError } from "zod";

/** GET /api/workspaces - ワークスペース一覧。SERVER_OWNER_DISCORD_ID 設定時はサーバーオーナーの WS のみ */
export async function GET(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (env.SERVER_OWNER_DISCORD_ID.trim() && !env.E2E_TEST_MODE) {
    const ctx = await assertServerOwner();
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const includeDeleted = req.nextUrl.searchParams.get("includeDeleted") === "1";

  const workspaces = await db.workspace.findMany({
    where: {
      ...(env.SERVER_OWNER_DISCORD_ID.trim() && !env.E2E_TEST_MODE
        ? { ownerUserId: session.user.id }
        : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    include: {
      _count: { select: { boards: true } },
      owner: { select: { discordName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ownerUserId を含めてUIでオーナー判定できるようにする
  return NextResponse.json(
    workspaces.map((ws) => ({
      ...ws,
      ownerName: ws.owner.discordName,
    }))
  );
}

/** POST /api/workspaces - ワークスペース作成。SERVER_OWNER_DISCORD_ID 設定時はサーバーオーナーのみ */
export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (env.SERVER_OWNER_DISCORD_ID.trim() && !env.E2E_TEST_MODE) {
    const ctx = await assertServerOwner();
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name: string; description?: string };
  try {
    body = await parseJsonBody(req, createWorkspaceSchema);
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: formatZodError(e) }, { status: 400 });
    throw e;
  }

  const workspace = await db.workspace.create({
    data: {
      ownerUserId: session.user.id,
      name: body.name,
      description: body.description ?? null,
    },
  });

  await writeAuditLog(session.user.id, workspace.id, "workspace.create", workspace.id);
  return NextResponse.json(workspace, { status: 201 });
}
