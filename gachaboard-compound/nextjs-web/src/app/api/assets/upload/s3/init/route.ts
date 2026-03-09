import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { isS3Enabled, createMultipartUpload, getPresignedPutUrl, s3KeyAssets } from "@/lib/s3";
import { randomUUID } from "crypto";
import path from "path";

const S3_PART_SIZE = 100 * 1024 * 1024; // 100MB per part

/**
 * POST /api/assets/upload/s3/init
 * S3 Multipart アップロードを開始し、uploadId, key, 各 part の Presigned PUT URL を返す。
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireLogin();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isS3Enabled()) {
      return NextResponse.json(
        { error: "MinIO が起動していません。docker compose up -d で MinIO を起動してください。" },
        { status: 503 }
      );
    }

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

    const board = await db.board.findUnique({ where: { id: boardId }, select: { workspaceId: true } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const ext = path.extname(fileName);
    const storageKey = `${randomUUID()}${ext}`;
    const key = s3KeyAssets(storageKey);

    const { uploadId } = await createMultipartUpload(storageKey, mimeType);

    await db.s3UploadSession.create({
      data: {
        uploadId,
        s3Key: key,
        storageKey,
        boardId,
        uploaderId: session.user.id,
        fileName,
        mimeType,
        totalSize: BigInt(totalSize),
      },
    });

    const totalParts = Math.ceil(totalSize / S3_PART_SIZE);
    const presignedUrls: string[] = [];
    for (let i = 1; i <= totalParts; i++) {
      const url = await getPresignedPutUrl(key, uploadId, i);
      presignedUrls.push(url);
    }

    return NextResponse.json({
      uploadId,
      key,
      storageKey,
      totalParts,
      presignedUrls,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[S3 init]", err);
    return NextResponse.json(
      { error: msg.includes("ECONNREFUSED") || msg.includes("connect") ? "MinIO に接続できません。docker compose up -d で MinIO を起動してください。" : msg },
      { status: 503 }
    );
  }
}
