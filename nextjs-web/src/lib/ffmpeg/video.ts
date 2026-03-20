import path from "path";
import fs from "fs/promises";
import { ensureLocalFromS3, uploadToS3 } from "@/lib/storage";
import { s3KeyConverted, s3KeyThumbnail } from "@/lib/s3";
import { resolveVideoTranscodeOptions, THUMBNAIL_COLOR_VF } from "./encoder-strategy";
import { applyFfmpegOsPriorityToCommand, resolveFfmpegThreadArgs } from "./ffmpeg-tuning";
import { deriveOutputPreset } from "./load-preset-behavior";
import { getMergedMediaEncodingEffective } from "./media-encoding-prefs";
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
  const eff = await getMergedMediaEncodingEffective();
  const { videoCodec, outputOptions, summary } = await resolveVideoTranscodeOptions({
    videoBackend: eff.videoBackend,
    resourceIntensity: eff.resourceIntensity,
    outputPreset: eff.outputPreset,
    forceHwEncoder: eff.forceHwEncoder,
  });
  console.log("[transcodeVideoToLightWithPath]", summary);

  const tmp = destPath.replace(/\.mp4$/, ".tmp.mp4");
  const cmd = ffmpeg(srcPath)
    .videoCodec(videoCodec)
    .audioCodec("aac")
    .format("mp4")
    .outputOptions(outputOptions)
    .output(tmp);
  applyFfmpegOsPriorityToCommand(cmd, eff.resourceIntensity);
  await new Promise<void>((resolve, reject) => {
    cmd.on("end", () => resolve()).on("error", (err) => reject(err)).run();
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
  const eff = await getMergedMediaEncodingEffective();
  const { thumbnailJpegQ } = deriveOutputPreset(eff.outputPreset);
  const duration = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(srcPath, (err, meta) => (err ? reject(err) : resolve(meta?.format?.duration ?? 0)));
  });
  const seekSec = duration > 0 ? duration / 2 : 0;
  const outOpts = [
    ...resolveFfmpegThreadArgs(eff.resourceIntensity),
    "-vf",
    THUMBNAIL_COLOR_VF,
    "-vframes",
    "1",
    "-q:v",
    String(thumbnailJpegQ),
  ];
  const cmd = ffmpeg(srcPath).inputOptions([`-ss ${seekSec}`]).outputOptions(outOpts).output(destPath);
  applyFfmpegOsPriorityToCommand(cmd, eff.resourceIntensity);
  await new Promise<void>((resolve, reject) => {
    cmd.on("end", () => resolve()).on("error", reject).run();
  });
}
