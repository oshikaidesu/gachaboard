import path from "path";
import fs from "fs/promises";
import { ensureLocalFromS3, uploadToS3 } from "@/lib/storage";
import { s3KeyConverted, s3KeyThumbnail } from "@/lib/s3";
import { runWithFfmpegLimit } from "./concurrency";

export type VideoConversionHandles = {
  conversionComplete: Promise<void>;
};

/**
 * 動画変換（サムネイル＋トランスコード）をバックグラウンドで開始。
 * サムネイルは thumbnail API からオンデマンド生成もされるため、
 * ここでの生成は「先行して作っておく」最適化。
 */
export function runVideoConversion(storageKey: string): VideoConversionHandles {
  const conversionComplete = runWithFfmpegLimit(() => runVideoConversionImpl(storageKey)).catch(
    (err) => {
      console.error("[runVideoConversion] failed for", storageKey, err?.message ?? err);
    }
  ) as Promise<void>;

  return { conversionComplete };
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
    const thumbPromise = (async () => {
      await generateThumbnailWithPath(tmpSrc!, tmpThumb);
      await uploadToS3(s3KeyThumbnail(storageKey), tmpThumb, "image/jpeg");
    })();
    const transcodePromise = transcodeVideoToLightWithPath(tmpSrc!, tmpDest).then(() =>
      uploadToS3(s3KeyConverted(storageKey, ".mp4"), tmpDest, "video/mp4")
    );
    await Promise.all([thumbPromise, transcodePromise]);
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

// ---------- オンデマンドサムネイル生成 ----------

const thumbnailInFlight = new Map<string, Promise<boolean>>();

/**
 * storageKey の動画からサムネイルを生成し S3 にアップロードする。
 * 同一 storageKey に対する同時リクエストは 1 つだけ実行し、他は待つ。
 * 成功時 true、失敗時 false。
 */
export async function ensureThumbnail(storageKey: string): Promise<boolean> {
  const existing = thumbnailInFlight.get(storageKey);
  if (existing) return existing;

  const promise = runWithFfmpegLimit(() => generateAndUploadThumbnail(storageKey))
    .then(() => true)
    .catch((err) => {
      console.error("[ensureThumbnail] failed for", storageKey, err?.message ?? err);
      return false;
    })
    .finally(() => {
      thumbnailInFlight.delete(storageKey);
    });

  thumbnailInFlight.set(storageKey, promise);
  return promise;
}

async function generateAndUploadThumbnail(storageKey: string): Promise<void> {
  const tmpDir = path.join(process.cwd(), "uploads", "tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  const base = storageKey.replace(/\.[^.]+$/, "");
  const tmpThumb = path.join(tmpDir, `thumb_${base}.jpg`);
  let tmpSrc: string | null = null;
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    await generateThumbnailWithPath(tmpSrc, tmpThumb);
    await uploadToS3(s3KeyThumbnail(storageKey), tmpThumb, "image/jpeg");
  } finally {
    if (tmpSrc) await fs.unlink(tmpSrc).catch(() => {});
    await fs.unlink(tmpThumb).catch(() => {});
  }
}

// ---------- ffmpeg ヘルパー ----------

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
