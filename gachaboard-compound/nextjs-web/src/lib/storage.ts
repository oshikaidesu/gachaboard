import path from "path";
import fs from "fs/promises";
import { existsSync, renameSync, createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { env } from "@/lib/env";
import { isS3Enabled, getObjectStream, putObject, deleteS3Object, s3KeyAssets, s3KeyConverted, s3KeyThumbnail, s3KeyWaveform } from "@/lib/s3";

export const UPLOAD_DIR = env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "assets");
export const CONVERTED_DIR = env.CONVERTED_DIR || path.join(process.cwd(), "uploads", "converted");
export const WAVEFORM_DIR = env.WAVEFORM_DIR || path.join(process.cwd(), "uploads", "waveforms");
export const CHUNKS_DIR = env.CHUNKS_DIR || path.join(process.cwd(), "uploads", "chunks");
export const THUMBNAIL_DIR = env.THUMBNAIL_DIR || path.join(process.cwd(), "uploads", "thumbnails");

export async function ensureUploadDirs() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(CONVERTED_DIR, { recursive: true });
  await fs.mkdir(WAVEFORM_DIR, { recursive: true });
  await fs.mkdir(CHUNKS_DIR, { recursive: true });
  await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
}

export async function deleteFile(storageKey: string, storageBackend: "local" | "s3" = "local") {
  if (storageBackend === "s3" && isS3Enabled()) {
    const base = storageKey.replace(/\.[^.]+$/, "");
    await Promise.allSettled([
      deleteS3Object(s3KeyAssets(storageKey)),
      deleteS3Object(s3KeyConverted(storageKey, ".mp3")),
      deleteS3Object(s3KeyConverted(storageKey, ".mp4")),
      deleteS3Object(s3KeyThumbnail(storageKey)),
      deleteS3Object(s3KeyWaveform(storageKey)),
    ]);
    return;
  }
  const filePath = path.join(UPLOAD_DIR, storageKey);
  const convertedAudioPath = path.join(CONVERTED_DIR, storageKey.replace(/\.[^.]+$/, ".mp3"));
  const convertedVideoPath = path.join(CONVERTED_DIR, storageKey.replace(/\.[^.]+$/, ".mp4"));
  const waveformPath = path.join(WAVEFORM_DIR, storageKey.replace(/\.[^.]+$/, ".json"));
  const thumbnailPath = getThumbnailPath(storageKey);
  if (existsSync(filePath)) await fs.unlink(filePath);
  if (existsSync(convertedAudioPath)) await fs.unlink(convertedAudioPath);
  if (existsSync(convertedVideoPath)) await fs.unlink(convertedVideoPath);
  if (existsSync(waveformPath)) await fs.unlink(waveformPath);
  if (existsSync(thumbnailPath)) await fs.unlink(thumbnailPath);
}

/** S3 のオリジナルを一時ファイルにダウンロード。ffmpeg 用。 */
export async function ensureLocalFromS3(storageKey: string): Promise<string> {
  const tmpDir = path.join(process.cwd(), "uploads", "tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `s3_${storageKey.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
  const res = await getObjectStream(s3KeyAssets(storageKey));
  const body = res.Body;
  if (!body) throw new Error("S3 object not found");
  let nodeStream: NodeJS.ReadableStream;
  if (typeof (body as { pipe?: unknown }).pipe === "function") {
    nodeStream = body as NodeJS.ReadableStream;
  } else {
    nodeStream = Readable.fromWeb(body as unknown as import("stream/web").ReadableStream);
  }
  await pipeline(nodeStream, createWriteStream(tmpPath));
  return tmpPath;
}

/** ローカルファイルを S3 にアップロード（変換結果用） */
export async function uploadToS3(key: string, localPath: string, contentType?: string): Promise<void> {
  const buf = await fs.readFile(localPath);
  await putObject(key, buf, contentType);
  await fs.unlink(localPath).catch(() => {});
}

export function getFilePath(storageKey: string) {
  return path.join(UPLOAD_DIR, storageKey);
}

export function getConvertedPath(storageKey: string) {
  return path.join(CONVERTED_DIR, storageKey.replace(/\.[^.]+$/, ".mp3"));
}

export function getChunkPath(uploadId: string, index: number) {
  return path.join(CHUNKS_DIR, uploadId, `${index}.part`);
}

export function getThumbnailPath(storageKey: string) {
  return path.join(THUMBNAIL_DIR, storageKey.replace(/\.[^.]+$/, ".jpg"));
}

/**
 * 動画の中間フレームを JPEG サムネイルとして抽出する。
 * ffprobe で尺を取得し、中間点のフレームを -vframes 1 で抽出する。
 */
export async function generateThumbnail(storageKey: string): Promise<void> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  await ensureUploadDirs();
  const src = getFilePath(storageKey);
  const dest = getThumbnailPath(storageKey);

  const duration = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(src, (err, meta) => {
      if (err) reject(err);
      else resolve(meta.format.duration ?? 0);
    });
  });

  const seekSec = duration > 0 ? duration / 2 : 0;

  await new Promise<void>((resolve, reject) => {
    ffmpeg(src)
      .inputOptions([`-ss ${seekSec}`])
      .outputOptions(["-vframes", "1", "-q:v", "3"])
      .output(dest)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

/** 動画の軽量版（720p H.264）パス */
export function getVideoConvertedPath(storageKey: string) {
  return path.join(CONVERTED_DIR, storageKey.replace(/\.[^.]+$/, ".mp4"));
}

export function getWaveformPath(storageKey: string) {
  return path.join(WAVEFORM_DIR, storageKey.replace(/\.[^.]+$/, ".json"));
}

/**
 * 動画を 720p H.264 + AAC の軽量版に変換してバックグラウンドで保存する。
 * 元ファイルより短辺が 720px 以下の場合はスケールしない。
 * -movflags +faststart でブラウザ再生の開始を高速化。
 *
 * 書き込み中のファイルを HEAD が検知しないよう、.tmp ファイルに書いてから
 * 完成後にリネームするアトミック書き込みを行う。
 */
export async function transcodeVideoToLight(storageKey: string): Promise<void> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  await ensureUploadDirs();
  const src = getFilePath(storageKey);
  const dest = getVideoConvertedPath(storageKey);
  // FFmpeg は拡張子でコンテナ形式を判定するため、tmp も .mp4 拡張子にする
  const tmp = dest.replace(/\.mp4$/, ".tmp.mp4");

  // 中途半端な .tmp.mp4 が残っている場合は削除
  if (existsSync(tmp)) {
    await fs.unlink(tmp).catch(() => {});
  }

  await new Promise<void>((resolve, reject) => {
    ffmpeg(src)
      .videoCodec("libx264")
      .audioCodec("aac")
      .format("mp4")
      .outputOptions([
        "-vf", "scale=-2:min(ih\\,720)",
        "-crf", "28",
        "-preset", "fast",
        "-movflags", "+faststart",
      ])
      .output(tmp)
      .on("end", () => resolve())
      .on("error", (err) => {
        fs.unlink(tmp).catch(() => {});
        reject(err);
      })
      .run();
  });

  // 完成後にアトミックリネーム → この瞬間から HEAD が 200 を返す
  renameSync(tmp, dest);
}
