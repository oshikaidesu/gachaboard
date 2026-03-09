import { z } from "zod";

/** UUID v4 形式のスキーマ（汎用） */
export const uploadIdSchema = z.string().uuid();

/** AWS S3 Multipart Upload の UploadId（UUID ではない不透明な文字列） */
export const s3UploadIdSchema = z.string().min(1).max(500);

/** base64url 英数字・-・_ のみ。長さ 32〜64 文字（crypto.randomBytes(32).toString('base64url') は 43 文字） */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);

/** 非負整数の文字列 */
export const chunkIndexSchema = z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).pipe(z.number().int().min(0));

/** @deprecated uploadIdSchema.safeParse(value).success を使用 */
export function isValidUploadId(value: string): boolean {
  return uploadIdSchema.safeParse(value).success;
}

/** @deprecated chunkIndexSchema.safeParse(value).success を使用 */
export function isValidChunkIndex(value: string): boolean {
  return chunkIndexSchema.safeParse(value).success;
}

export function isValidInviteToken(value: string): boolean {
  return inviteTokenSchema.safeParse(value).success;
}
