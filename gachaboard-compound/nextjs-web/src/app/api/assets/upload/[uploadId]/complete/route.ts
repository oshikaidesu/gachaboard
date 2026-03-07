import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  CHUNKS_DIR,
  UPLOAD_DIR,
  ensureUploadDirs,
  transcodeVideoToLight,
  generateThumbnail,
} from "@/lib/storage";
import { generateWaveform } from "@/lib/waveform";
import { isPlayableAudio } from "@shared/mimeUtils";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { pipeline } from "stream/promises";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ uploadId: string }> };

/**
 * POST /api/assets/upload/[uploadId]/complete
 * 全チャンクを結合して通常のアセットとして登録する。
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uploadId } = await params;
  const { totalChunks } = await req.json() as { totalChunks: number };

  const uploadDir = path.join(CHUNKS_DIR, uploadId);
  if (!existsSync(uploadDir)) {
    return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
  }

  const metaRaw = await fs.readFile(path.join(uploadDir, "meta.json"), "utf-8");
  const { fileName, mimeType, totalSize, boardId, uploaderId } = JSON.parse(metaRaw) as {
    fileName: string;
    mimeType: string;
    totalSize: number;
    boardId: string;
    uploaderId: string;
  };

  // アップロードしたユーザーと完了リクエストのユーザーが一致するか確認
  if (uploaderId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureUploadDirs();

  const ext = path.extname(fileName);
  const storageKey = `${randomUUID()}${ext}`;
  const destPath = path.join(UPLOAD_DIR, storageKey);

  // チャンクを順番に結合してストリーミング書き込み
  const writeStream = createWriteStream(destPath);
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(uploadDir, `${i}.part`);
    if (!existsSync(chunkPath)) {
      writeStream.destroy();
      return NextResponse.json({ error: `Chunk ${i} is missing` }, { status: 400 });
    }
    const readable = createReadStream(chunkPath);
    await pipeline(readable, writeStream, { end: false });
  }
  writeStream.end();
  await new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  // 一時ディレクトリを削除
  await fs.rm(uploadDir, { recursive: true, force: true });

  // boardId から workspaceId を取得
  const board = await db.board.findUnique({ where: { id: boardId }, select: { workspaceId: true } });
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const kind = getKind(mimeType);

  const asset = await db.asset.create({
    data: {
      workspaceId: board.workspaceId,
      boardId,
      uploaderId: session.user.id,
      kind,
      mimeType,
      fileName,
      sizeBytes: BigInt(totalSize),
      storageKey,
    },
  });

  // 動画: 軽量版変換 + サムネイル生成
  if (mimeType.startsWith("video/")) {
    transcodeVideoToLight(storageKey).catch((err) => {
      console.error("[transcodeVideoToLight] failed for", storageKey, err?.message ?? err);
    });
    generateThumbnail(storageKey).catch((err) => {
      console.error("[generateThumbnail] failed for", storageKey, err?.message ?? err);
    });
  }

  // 音声: WAV → MP3 変換 + 波形生成
  if (mimeType === "audio/wav" || fileName.endsWith(".wav")) {
    convertWavToMp3(storageKey).catch(console.error);
  }
  if (isPlayableAudio(mimeType)) {
    generateWaveform(storageKey).catch(console.error);
  }

  return NextResponse.json({ ...asset, sizeBytes: asset.sizeBytes.toString() }, { status: 201 });
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
  const { getFilePath, getConvertedPath, ensureUploadDirs: ensureDirs } = await import("@/lib/storage");
  const { existsSync, renameSync } = await import("fs");
  const fs = await import("fs/promises");
  await ensureDirs();
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

