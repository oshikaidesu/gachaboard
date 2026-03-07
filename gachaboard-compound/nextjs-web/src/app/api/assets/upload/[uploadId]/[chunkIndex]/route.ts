import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { CHUNKS_DIR } from "@/lib/storage";
import { isValidChunkIndex, isValidUploadId } from "@/lib/validators";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { existsSync } from "fs";
import path from "path";

type Params = { params: Promise<{ uploadId: string; chunkIndex: string }> };

/**
 * PUT /api/assets/upload/[uploadId]/[chunkIndex]
 * チャンクバイナリを受け取り、{chunkIndex}.part としてディスクに書き込む。
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uploadId, chunkIndex } = await params;

  if (!isValidUploadId(uploadId)) {
    return NextResponse.json({ error: "Invalid uploadId" }, { status: 400 });
  }
  if (!isValidChunkIndex(chunkIndex)) {
    return NextResponse.json({ error: "Invalid chunkIndex" }, { status: 400 });
  }

  const uploadDir = path.join(CHUNKS_DIR, uploadId);
  if (!existsSync(uploadDir)) {
    return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
  }

  const chunkPath = path.join(uploadDir, `${chunkIndex}.part`);

  if (!req.body) {
    return NextResponse.json({ error: "No body" }, { status: 400 });
  }

  const readable = Readable.fromWeb(req.body as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(readable, createWriteStream(chunkPath));

  return NextResponse.json({ ok: true });
}
