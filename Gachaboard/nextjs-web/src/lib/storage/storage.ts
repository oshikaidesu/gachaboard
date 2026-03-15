import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { isS3Enabled, getObjectStream, putObject, deleteS3Object, s3KeyAssets, s3KeyConverted, s3KeyThumbnail, s3KeyWaveform } from "@/lib/s3";

/** S3 のアセットを削除。変換済み・サムネイル・波形も削除。 */
export async function deleteFile(storageKey: string): Promise<void> {
  if (!isS3Enabled()) return;
  await Promise.allSettled([
    deleteS3Object(s3KeyAssets(storageKey)),
    deleteS3Object(s3KeyConverted(storageKey, ".mp3")),
    deleteS3Object(s3KeyConverted(storageKey, ".mp4")),
    deleteS3Object(s3KeyThumbnail(storageKey)),
    deleteS3Object(s3KeyWaveform(storageKey)),
  ]);
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
