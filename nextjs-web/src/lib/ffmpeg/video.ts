import path from "path";
import fs from "fs/promises";
import { ensureLocalFromS3, uploadToS3 } from "@/lib/storage";
import { s3KeyConverted, s3KeyThumbnail } from "@/lib/s3";
import { runWithFfmpegLimit } from "./concurrency";

export async function runVideoConversion(storageKey: string): Promise<void> {
  return runWithFfmpegLimit(() => runVideoConversionImpl(storageKey));
}

async function runVideoConversionImpl(storageKey: string): Promise<void> {
  const tmpDir = path.join(process.cwd(), "uploads", "tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  let tmpSrc: string | null = null;
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    const base = storageKey.replace(/\.[^.]+$/, "");
    const tmpDest = path.join(tmpDir, `conv_${base}.mp4`);
    const tmpThumb = path.join(tmpDir, `thumb_${base}.jpg`);
    // サムネイルとトランスコードを並列。サムネイルは軽いので先に完了→即S3へ
    const [, convPath] = await Promise.all([
      (async () => {
        await generateThumbnailWithPath(tmpSrc!, tmpThumb);
        await uploadToS3(s3KeyThumbnail(storageKey), tmpThumb, "image/jpeg");
      })(),
      transcodeVideoToLightWithPath(tmpSrc!, tmpDest).then(() => tmpDest),
    ]);
    await uploadToS3(s3KeyConverted(storageKey, ".mp4"), convPath, "video/mp4");
  } finally {
    if (tmpSrc) await fs.unlink(tmpSrc).catch(() => {});
  }
}

export async function transcodeVideoToLightWithPath(srcPath: string, destPath: string): Promise<void> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const tmp = destPath.replace(/\.mp4$/, ".tmp.mp4");
  await new Promise<void>((resolve, reject) => {
    ffmpeg(srcPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .format("mp4")
      .outputOptions(["-vf", "scale=-2:min(ih\\,720)", "-crf", "30", "-preset", "veryfast", "-movflags", "+faststart"])
      .output(tmp)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
  const { renameSync } = await import("fs");
  renameSync(tmp, destPath);
}

export async function generateThumbnailWithPath(srcPath: string, destPath: string): Promise<void> {
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
