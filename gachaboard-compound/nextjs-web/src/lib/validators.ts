/** UUID v4 形式か検証（uploadId 等に使用） */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** base64url 英数字・-・_ のみ。長さ 32〜64 文字（crypto.randomBytes(32).toString('base64url') は 43 文字） */
const INVITE_TOKEN_REGEX = /^[A-Za-z0-9_-]{32,64}$/;

export function isValidUploadId(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function isValidChunkIndex(value: string): boolean {
  return /^\d+$/.test(value) && parseInt(value, 10) >= 0;
}

export function isValidInviteToken(value: string): boolean {
  return INVITE_TOKEN_REGEX.test(value);
}
