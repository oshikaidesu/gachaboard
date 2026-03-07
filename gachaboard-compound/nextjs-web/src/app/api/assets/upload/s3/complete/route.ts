import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";
import { db } from "@/lib/db";
import { s3CompleteSchema } from "@/lib/apiSchemas";
import { formatZodError, parseJsonBody } from "@/lib/parseJsonBody";
import { ZodError } from "zod";
import {
  isS3Enabled,
  completeMultipartUpload,
  s3KeyAssets,
  s3KeyConverted,
  s3KeyThumbnail,
  s3KeyWaveform,
} from "@/lib/s3";
import {
  ensureLocalFromS3,
  uploadToS3,
  transcodeVideoToLight,
  generateThumbnail,
} from "@/lib/storage";
import { isPlayableAudio } from "@shared/mimeUtils";
import fs from "fs/promises";
import path from "path";

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

  const row = await db.s3UploadSession.findUnique({ where: { uploadId } });
  if (!row) return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
  if (row.uploaderId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { storageKey, fileName, mimeType, totalSize, boardId } = row;

  await completeMultipartUpload(key, uploadId, parts);

  await db.s3UploadSession.delete({ where: { uploadId } });

  const board = await db.board.findUnique({ where: { id: boardId }, select: { workspaceId: true } });
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const kind = getKind(mimeType);

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
      storageBackend: "s3",
    },
  });

  // ffmpeg 変換を非同期で実行（S3: DL → 変換 → S3 にアップロード）
  if (mimeType.startsWith("video/")) {
    runVideoConversion(storageKey).catch((err) => {
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

function getKind(mimeType: string): string {
  if (mimeType === "image/gif") return "gif";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (isPlayableAudio(mimeType)) return "audio";
  return "file";
}

async function runVideoConversion(storageKey: string) {
  const tmpDir = path.join(process.cwd(), "uploads", "tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  let tmpSrc: string | null = null;
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    const tmpDest = path.join(tmpDir, `conv_${storageKey.replace(/\.[^.]+$/, "")}.mp4`);
    await transcodeVideoToLightWithPath(tmpSrc, tmpDest);
    await uploadToS3(s3KeyConverted(storageKey, ".mp4"), tmpDest, "video/mp4");
    const tmpThumb = path.join(tmpDir, `thumb_${storageKey.replace(/\.[^.]+$/, "")}.jpg`);
    await generateThumbnailWithPath(tmpSrc, tmpThumb);
    await uploadToS3(s3KeyThumbnail(storageKey), tmpThumb, "image/jpeg");
  } finally {
    if (tmpSrc) await fs.unlink(tmpSrc).catch(() => {});
  }
}

async function transcodeVideoToLightWithPath(srcPath: string, destPath: string) {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const tmp = destPath.replace(/\.mp4$/, ".tmp.mp4");
  await new Promise<void>((resolve, reject) => {
    ffmpeg(srcPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .format("mp4")
      .outputOptions(["-vf", "scale=-2:min(ih\\,720)", "-crf", "28", "-preset", "fast", "-movflags", "+faststart"])
      .output(tmp)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
  const { renameSync } = await import("fs");
  renameSync(tmp, destPath);
}

async function generateThumbnailWithPath(srcPath: string, destPath: string) {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const duration = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(srcPath, (err, meta) => (err ? reject(err) : resolve(meta?.format?.duration ?? 0)));
  });
  const seekSec = duration > 0 ? duration / 2 : 0;
  await new Promise<void>((resolve, reject) => {
    ffmpeg(srcPath)
      .inputOptions([`-ss ${seekSec}`])
      .outputOptions(["-vframes", "1", "-q:v", "3"])
      .output(destPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

async function runWavToMp3(storageKey: string) {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  let tmpSrc: string | null = null;
  const tmpDir = path.join(process.cwd(), "uploads", "tmp");
  const tmpDest = path.join(tmpDir, `mp3_${storageKey.replace(/\.[^.]+$/, "")}.mp3`);
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpSrc!)
        .audioCodec("libmp3lame")
        .audioBitrate(192)
        .save(tmpDest)
        .on("end", () => resolve())
        .on("error", reject);
    });
    await uploadToS3(s3KeyConverted(storageKey, ".mp3"), tmpDest, "audio/mpeg");
  } finally {
    if (tmpSrc) await fs.unlink(tmpSrc).catch(() => {});
    await fs.unlink(tmpDest).catch(() => {});
  }
}

async function runWaveform(storageKey: string) {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { writeFile } = await import("fs/promises");
  const BAR_COUNT = 200;
  let tmpSrc: string | null = null;
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    const pcmBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      ffmpeg(tmpSrc!)
        .audioChannels(1)
        .audioFrequency(8000)
        .format("s16le")
        .pipe()
        .on("data", (chunk: Buffer) => chunks.push(chunk))
        .on("end", () => resolve(Buffer.concat(chunks)))
        .on("error", reject);
    });
    const sampleCount = Math.floor(pcmBuffer.length / 2);
    const samplesPerBar = Math.max(1, Math.floor(sampleCount / BAR_COUNT));
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      let max = 0;
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, sampleCount);
      for (let j = start; j < end; j++) {
        const sample = Math.abs(pcmBuffer.readInt16LE(j * 2));
        if (sample > max) max = sample;
      }
      peaks.push(max / 32768);
    }
    const tmpJson = path.join(process.cwd(), "uploads", "tmp", `wave_${storageKey.replace(/\.[^.]+$/, "")}.json`);
    await fs.mkdir(path.dirname(tmpJson), { recursive: true });
    await writeFile(tmpJson, JSON.stringify({ peaks }), "utf-8");
    await uploadToS3(s3KeyWaveform(storageKey), tmpJson, "application/json");
  } finally {
    if (tmpSrc) await fs.unlink(tmpSrc).catch(() => {});
  }
}
