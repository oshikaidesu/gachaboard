import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import path from "path";
import { UPLOAD_DIR, ensureUploadDirs } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string | null;
  const boardId = formData.get("boardId") as string | null;

  if (!file || !workspaceId) {
    return NextResponse.json({ error: "file and workspaceId are required" }, { status: 400 });
  }

  await ensureUploadDirs();

  const ext = path.extname(file.name);
  const storageKey = `${randomUUID()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storageKey);

  // ストリーミング書き込み（大容量ファイルでもメモリを消費しない）
  const readable = Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(readable, createWriteStream(filePath));

  const asset = await db.asset.create({
    data: {
      workspaceId,
      boardId: boardId || null,
      uploaderId: session.user.id,
      kind: getKind(file.type),
      mimeType: file.type,
      fileName: file.name,
      sizeBytes: BigInt(file.size),
      storageKey,
    },
  });

  // wav ファイルは非同期でmp3変換
  if (file.type === "audio/wav" || file.name.endsWith(".wav")) {
    convertWavToMp3(storageKey).catch(console.error);
  }

  return NextResponse.json({ ...asset, sizeBytes: asset.sizeBytes.toString() }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const boardId = searchParams.get("boardId");
  const trash = searchParams.get("trash") === "1";

  const assets = await db.asset.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      ...(boardId ? { boardId } : {}),
      deletedAt: trash ? { not: null } : null,
    },
    orderBy: { createdAt: "desc" },
    include: { uploader: { select: { name: true, image: true } } },
  });

  return NextResponse.json(
    assets.map((a) => ({ ...a, sizeBytes: a.sizeBytes.toString() }))
  );
}

function getKind(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "image/gif") return "gif";
  return "file";
}

async function convertWavToMp3(storageKey: string) {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { getFilePath, getConvertedPath, ensureUploadDirs } = await import("@/lib/storage");
  await ensureUploadDirs();
  return new Promise<void>((resolve, reject) => {
    ffmpeg(getFilePath(storageKey))
      .audioCodec("libmp3lame")
      .audioBitrate(192)
      .save(getConvertedPath(storageKey))
      .on("end", () => resolve())
      .on("error", reject);
  });
}
