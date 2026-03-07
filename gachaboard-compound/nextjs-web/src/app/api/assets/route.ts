import { NextRequest, NextResponse } from "next/server";
import { assertWorkspaceWriteAccess, requireLogin } from "@/lib/authz";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { USER_SELECT } from "@/lib/prismaHelpers";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import path from "path";
import { UPLOAD_DIR, ensureUploadDirs, getFilePath, transcodeVideoToLight, generateThumbnail } from "@/lib/storage";
import { generateWaveform } from "@/lib/waveform";
import { isPlayableAudio } from "@shared/mimeUtils";

export async function POST(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string | null;
  const boardId = formData.get("boardId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > env.MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max ${Math.round(env.MAX_UPLOAD_SIZE / 1024 / 1024)}MB` },
      { status: 400 }
    );
  }

  // boardId のみ渡された場合は DB から workspaceId を補完
  let resolvedWorkspaceId = workspaceId;
  if (!resolvedWorkspaceId && boardId) {
    const board = await db.board.findUnique({ where: { id: boardId }, select: { workspaceId: true } });
    if (!board) return NextResponse.json({ error: "board not found" }, { status: 404 });
    resolvedWorkspaceId = board.workspaceId;
  }
  if (!resolvedWorkspaceId) {
    return NextResponse.json({ error: "workspaceId or boardId is required" }, { status: 400 });
  }

  const writeCtx = await assertWorkspaceWriteAccess(resolvedWorkspaceId);
  if (!writeCtx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureUploadDirs();

  const ext = path.extname(file.name);
  const storageKey = `${randomUUID()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storageKey);

  // ストリーミング書き込み（大容量ファイルでもメモリを消費しない）
  const readable = Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(readable, createWriteStream(filePath));

  const mimeType = file.type || "application/octet-stream";
  const kind = getKind(mimeType);

  const asset = await db.asset.create({
    data: {
      workspaceId: resolvedWorkspaceId,
      boardId: boardId || null,
      uploaderId: session.user.id,
      kind,
      mimeType,
      fileName: file.name,
      sizeBytes: BigInt(file.size),
      storageKey,
    },
  });

  // wav ファイルは非同期でmp3変換
  if (mimeType === "audio/wav" || file.name.endsWith(".wav")) {
    convertWavToMp3(storageKey).catch(console.error);
  }

  // 再生可能な音声ファイルは非同期で波形JSON生成
  if (isPlayableAudio(mimeType)) {
    generateWaveform(storageKey).catch(console.error);
  }

  // 動画はすべて非同期で軽量版（720p）とサムネイルを生成
  if (mimeType.startsWith("video/")) {
    transcodeVideoToLight(storageKey).catch((err) => {
      console.error("[transcodeVideoToLight] failed for", storageKey, err?.message ?? err);
    });
    generateThumbnail(storageKey).catch((err) => {
      console.error("[generateThumbnail] failed for", storageKey, err?.message ?? err);
    });
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
}

function getKind(mimeType: string): string {
  if (mimeType === "image/gif") return "gif";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (isPlayableAudio(mimeType)) return "audio";
  return "file";
}

async function convertWavToMp3(storageKey: string) {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { getFilePath, getConvertedPath, ensureUploadDirs } = await import("@/lib/storage");
  const { existsSync, renameSync } = await import("fs");
  const fs = await import("fs/promises");
  await ensureUploadDirs();
  const dest = getConvertedPath(storageKey);
  const tmp = dest.replace(/\.mp3$/, ".tmp.mp3");
  if (existsSync(tmp)) await fs.unlink(tmp).catch(() => {});
  await new Promise<void>((resolve, reject) => {
    ffmpeg(getFilePath(storageKey))
      .audioCodec("libmp3lame")
      .audioBitrate(192)
      .save(tmp)
      .on("end", () => resolve())
      .on("error", (err) => { fs.unlink(tmp).catch(() => {}); reject(err); });
  });
  renameSync(tmp, dest);
}

