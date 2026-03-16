/**
 * アップロードボタン・ドラッグ&ドロップ 共通ロジック。
 *
 * 両パスで同じ挙動を保つため、以下を共有する:
 *
 * 1. MIME 解決: resolveMimeType(file.type, file.name)
 *    - Picker は file.type を正しく返しやすいが、DD は空になりやすい（例: MOV）
 *    - 拡張子から推測し、変換・シェイプ種別を統一
 *
 * 2. 処理フロー: placeholderShape → uploadFileViaS3 → placeFile
 *    - プレースホルダーは全種別 FileIconShape に統一（送信%表示のため）
 *    - 完了後に placeFile で本来のシェイプに差し替え
 *
 * 使用箇所:
 * - s3Upload.ts: init/complete/session の mimeType
 * - shapes/index.ts: placeholderShape（プレースホルダー種別）、placeFile（data.mimeType 優先）
 */

import { resolveMimeType } from "@shared/mimeUtils";

/**
 * File から有効な MIME タイプを取得。
 * アップロードボタン・DD 共通で使用し、挙動を統一する。
 */
export function getEffectiveMimeType(file: File): string {
  return resolveMimeType(file.type || "", file.name);
}
