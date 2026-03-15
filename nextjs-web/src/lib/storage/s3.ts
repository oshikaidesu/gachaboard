/**
 * S3 互換ストレージ（AWS S3 / MinIO / R2）クライアント。
 * env.S3_BUCKET が未設定の場合は S3 機能は無効。
 */

import { S3Client, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, UploadPartCommand, ListPartsCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, type CompletedPart } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, getS3PublicUrl } from "@/lib/env";

export function isS3Enabled(): boolean {
  return !!(env.S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

function getClient(): S3Client {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  };
  if (env.S3_ENDPOINT) {
    config.endpoint = env.S3_ENDPOINT;
    config.forcePathStyle = true;
  }
  return new S3Client(config);
}

/**
 * Presigned URL のホスト部分を公開パスに書き換える。
 *
 * 署名は S3_ENDPOINT（デフォルト: localhost:18583）で作成し、URL のホスト部分だけ /minio に置換する。
 * /minio/* は API route が受けて Host ヘッダを S3_ENDPOINT に設定して MinIO に転送するため、
 * 署名が一致する。
 */
function rewritePresignedUrl(url: string): string {
  const publicUrl = getS3PublicUrl();
  const internal = env.S3_ENDPOINT || "http://localhost:18583";
  if (!publicUrl || publicUrl === internal) return url;
  return url.replace(internal, publicUrl);
}

const bucket = () => env.S3_BUCKET;

/** S3 キー: オリジナルファイル */
export function s3KeyAssets(storageKey: string): string {
  return `assets/${storageKey}`;
}

/** S3 キー: 変換済み（mp4/mp3） */
export function s3KeyConverted(storageKey: string, ext: string): string {
  const base = storageKey.replace(/\.[^.]+$/, "");
  return `converted/${base}${ext}`;
}

/** S3 キー: サムネイル */
export function s3KeyThumbnail(storageKey: string): string {
  const base = storageKey.replace(/\.[^.]+$/, "");
  return `thumbnails/${base}.jpg`;
}

/** S3 キー: 波形 JSON */
export function s3KeyWaveform(storageKey: string): string {
  const base = storageKey.replace(/\.[^.]+$/, "");
  return `waveforms/${base}.json`;
}

/** Multipart アップロードを開始 */
export async function createMultipartUpload(storageKey: string, mimeType: string) {
  const client = getClient();
  const Key = s3KeyAssets(storageKey);
  const cmd = new CreateMultipartUploadCommand({
    Bucket: bucket(),
    Key,
    ContentType: mimeType,
  });
  const res = await client.send(cmd);
  return { uploadId: res.UploadId!, key: Key };
}

/** アップロード済みパート一覧を取得 */
export async function listParts(key: string, uploadId: string): Promise<{ PartNumber: number; ETag: string }[]> {
  const client = getClient();
  const parts: { PartNumber: number; ETag: string }[] = [];
  let marker: string | undefined;
  for (;;) {
    const res = await client.send(new ListPartsCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      PartNumberMarker: marker,
    }));
    for (const p of res.Parts ?? []) {
      if (p.PartNumber != null && p.ETag) parts.push({ PartNumber: p.PartNumber, ETag: p.ETag });
    }
    if (!res.IsTruncated) break;
    marker = res.NextPartNumberMarker;
  }
  return parts;
}

/** Part 用 Presigned PUT URL を取得（MinIO 実エンドポイントで署名 → 公開 URL に書き換え） */
export async function getPresignedPutUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
  const client = getClient();
  const cmd = new UploadPartCommand({
    Bucket: bucket(),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  const url = await getSignedUrl(client, cmd, { expiresIn: 3600 });
  return rewritePresignedUrl(url);
}

/** Multipart アップロードを完了 */
export async function completeMultipartUpload(key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]) {
  const client = getClient();
  const completed: CompletedPart[] = parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }));
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: bucket(),
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: completed },
  }));
}

/** Multipart アップロードを中止 */
export async function abortMultipartUpload(key: string, uploadId: string) {
  const client = getClient();
  await client.send(new AbortMultipartUploadCommand({
    Bucket: bucket(),
    Key: key,
    UploadId: uploadId,
  }));
}

/** Presigned GET のオプション */
export type PresignedGetOptions = {
  /** Content-Disposition の上書き（例: attachment; filename*=UTF-8''foo.mp4） */
  responseContentDisposition?: string;
  /** Content-Type の上書き */
  responseContentType?: string;
};

/** オブジェクトの Presigned GET URL を取得（MinIO 実エンドポイントで署名 → 公開 URL に書き換え） */
export async function getPresignedGetUrl(
  key: string,
  expiresIn = 3600,
  opts?: PresignedGetOptions
): Promise<string> {
  const client = getClient();
  const cmd = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ...(opts?.responseContentDisposition && { ResponseContentDisposition: opts.responseContentDisposition }),
    ...(opts?.responseContentType && { ResponseContentType: opts.responseContentType }),
  });
  const url = await getSignedUrl(client, cmd, { expiresIn });
  return rewritePresignedUrl(url);
}

/** ファイルを S3 にアップロード（PutObject） */
export async function putObject(key: string, body: Buffer | Uint8Array | ReadableStream, contentType?: string) {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

/** S3 からオブジェクトを取得（ストリーム） */
export async function getObjectStream(key: string, range?: string) {
  const client = getClient();
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket(), Key: key, ...(range && { Range: range }) })
  );
  return res;
}

/** S3 オブジェクトを削除 */
export async function deleteS3Object(key: string) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** S3 オブジェクトの存在チェック */
export async function headS3Object(key: string): Promise<boolean> {
  try {
    const client = getClient();
    await client.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}
