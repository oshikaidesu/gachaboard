/**
 * href / src に使用する URL の安全検証。
 * javascript:, data:, vbscript: 等の危険なプロトコルを拒否し、
 * http / https のみ許可する。
 *
 * @see https://www.npmjs.com/package/url-sanitizer
 */
import { sanitizeURLSync } from "url-sanitizer";

const ALLOWED_SCHEMES = ["http", "https"] as const;

/**
 * URL が安全な href として使用可能か検証する。
 * http / https のみ許可。それ以外は null を返す。
 */
export function getSafeHref(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return sanitizeURLSync(trimmed, { only: [...ALLOWED_SCHEMES] });
}

/**
 * Y.Doc 由来の assetId を URL パスに埋め込む前に検証する。
 * UUID + 拡張子（例: "a1b2c3d4-...-.mp4"）のみ許可。
 * パストラバーサル（../ 等）や CSS injection（) 等）を防止。
 */
const SAFE_ASSET_ID_RE = /^[\w][\w.\-]{0,254}$/;

export function getSafeAssetId(assetId: string | null | undefined): string | null {
  if (!assetId || typeof assetId !== "string") return null;
  const trimmed = assetId.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/") || trimmed.includes("\\")) return null;
  if (trimmed.includes("..")) return null;
  return SAFE_ASSET_ID_RE.test(trimmed) ? trimmed : null;
}

/** hex カラーのみ許可（#rgb または #rrggbb）。CSS インジェクション防止。 */
const SAFE_HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

/**
 * 他クライアント由来の color を style に使用する前に検証する。
 * hex のみ許可。不正な値は null を返す。
 */
export function getSafeColor(color: string | null | undefined): string | null {
  if (!color || typeof color !== "string") return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  return SAFE_HEX_RE.test(trimmed) ? trimmed : null;
}
