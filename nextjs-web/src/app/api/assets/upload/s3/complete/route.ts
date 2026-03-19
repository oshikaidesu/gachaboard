import { NextRequest, NextResponse } from "next/server";
import { requireLogin, getS3UploadSessionForUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { s3CompleteSchema } from "@/lib/apiSchemas";
import { formatZodError, parseJsonBody } from "@/lib/parseJsonBody";
import { ZodError } from "zod";
import { isS3Enabled, completeMultipartUpload, getS3StorageFullError } from "@/lib/s3";
import { runVideoConversion, runWavToMp3, runWaveform } from "@/lib/ffmpeg";
import { getAssetKind, isPlayableAudio } from "@shared/mimeUtils";

/**
 * POST /api/assets/upload/s3/complete
 * Multipart アップロードを完了し、Asset を登録。ffmpeg 変換を非同期で開始。
 */
export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isS3Enabled()) {
    return NextResponse.json({ error: "S3 is not configured" }, { status: 503 });
  }

  let body: { uploadId: string; key: string; parts: { PartNumber: number; ETag: string }[] };
  try {
    body = await parseJsonBody(req, s3CompleteSchema);
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: formatZodError(e) }, { status: 400 });
    throw e;
  }

  const { uploadId, key, parts } = body;

  const row = await getS3UploadSessionForUser(uploadId, session.user.id);
  if (!row) return NextResponse.json({ error: "Upload session not found" }, { status: 404 });

  const { storageKey, fileName, mimeType, totalSize, boardId } = row;

  try {
    await completeMultipartUpload(key, uploadId, parts);
  } catch (err) {
    console.error("[S3 complete]", err);
    const storageFull = getS3StorageFullError(err);
    if (storageFull) {
      return NextResponse.json({ error: storageFull.message }, { status: storageFull.status });
    }
    throw err;
  }

  await db.s3UploadSession.delete({ where: { uploadId } });

  const board = await db.board.findUnique({ where: { id: boardId }, select: { workspaceId: true } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const kind = getAssetKind(mimeType);

  const asset = await db.asset.create({
    data: {
      workspaceId: board.workspaceId,
      boardId,
      uploaderId: row.uploaderId,
      kind,
      mimeType: mimeType || "application/octet-stream",
      fileName,
      sizeBytes: totalSize,
      storageKey,
    },
  });

  if (mimeType.startsWith("video/")) {
    runVideoConversion(storageKey).conversionComplete.catch((err) => {
      console.error("[runVideoConversion] failed for", storageKey, err?.message ?? err);
    });
  }
  if (mimeType === "audio/wav" || fileName.endsWith(".wav")) {
    runWavToMp3(storageKey).catch(console.error);
  }
  if (isPlayableAudio(mimeType)) {
    runWaveform(storageKey).catch(console.error);
  }

  return NextResponse.json({ ...asset, sizeBytes: asset.sizeBytes.toString() }, { status: 201 });
}
