import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { env } from "@/lib/env";
import { CHUNKS_DIR, ensureUploadDirs } from "@/lib/storage";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

/**
 * POST /api/assets/upload/init
 * チャンクアップロードのセッションを開始する。
 * uploadId（UUID）を発行し、一時ディレクトリと meta.json を作成して返す。
 */
export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fileName, mimeType, totalSize, boardId } = await req.json() as {
    fileName: string;
    mimeType: string;
    totalSize: number;
    boardId: string;
  };

  if (!fileName || !mimeType || !totalSize || !boardId) {
    return NextResponse.json({ error: "fileName, mimeType, totalSize, boardId are required" }, { status: 400 });
  }
  if (totalSize > env.MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max ${Math.round(env.MAX_UPLOAD_SIZE / 1024 / 1024)}MB` },
      { status: 400 }
    );
  }

  await ensureUploadDirs();

  const uploadId = randomUUID();
  const uploadDir = path.join(CHUNKS_DIR, uploadId);
  await fs.mkdir(uploadDir, { recursive: true });

  await fs.writeFile(
    path.join(uploadDir, "meta.json"),
    JSON.stringify({ fileName, mimeType, totalSize, boardId, uploaderId: session.user.id }),
    "utf-8"
  );

  return NextResponse.json({ uploadId });
}
