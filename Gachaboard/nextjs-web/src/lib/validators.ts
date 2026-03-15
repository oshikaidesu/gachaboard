import { z } from "zod";

/** AWS S3 Multipart Upload の UploadId（UUID ではない不透明な文字列） */
export const s3UploadIdSchema = z.string().min(1).max(500);

/** base64url 英数字・-・_ のみ。長さ 32〜64 文字（crypto.randomBytes(32).toString('base64url') は 43 文字） */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);

/** フロントの getSafeAssetId と同等。パストラバーサル・CSS injection 防止 */
export const assetIdSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\w][\w.\-]*$/)
  .refine((s) => !s.includes("..") && !s.includes("/") && !s.includes("\\"));

export function isValidInviteToken(value: string): boolean {
  return inviteTokenSchema.safeParse(value).success;
}
