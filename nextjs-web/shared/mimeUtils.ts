/**
 * 拡張子 → MIME タイプ（変換が必要な動画・音声）。
 * ドラッグ&ドロップで file.type が空になる場合のフォールバック用。
 */
const EXT_TO_VIDEO_MIME: Record<string, string> = {
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  m4v: "video/x-m4v",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  "3gp": "video/3gpp",
};
const EXT_TO_AUDIO_MIME: Record<string, string> = {
  wav: "audio/wav",
};

/**
 * 汎用 MIME または空の場合、fileName の拡張子から MIME を推測。
 * ドラッグ&ドロップでブラウザが file.type を正しく返さない場合に使用。
 */
export function resolveMimeType(mimeType: string, fileName: string): string {
  const generic = !mimeType || mimeType === "application/octet-stream" || mimeType === "application/x-unknown";
  if (!generic) return mimeType;
  const ext = fileName.replace(/^.*\./, "").toLowerCase();
  return (EXT_TO_VIDEO_MIME[ext] ?? EXT_TO_AUDIO_MIME[ext] ?? mimeType) || "application/octet-stream";
}

/**
 * HTML5 audio/video で再生可能な MIME タイプのホワイトリスト。
 * MIDI 等の非波形形式を誤認識しないため、audio/ プレフィックスではなく
 * 明示的に許可する形式のみ audio-player として扱う。
 */
const PLAYABLE_AUDIO_MIMES = new Set([
  "audio/mpeg",  // mp3
  "audio/wav", "audio/wave", "audio/x-wav",  // wav
  "audio/ogg",   // ogg
  "audio/mp4", "audio/aac", "audio/x-m4a",   // m4a, aac
  "audio/flac",  // flac
  "audio/webm",  // webm
]);

export function isPlayableAudio(mimeType: string): boolean {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return PLAYABLE_AUDIO_MIMES.has(base);
}

/** PSD はプレビュー不可のためファイルアイコン扱い */
const FILE_ICON_IMAGE_MIMES = new Set(["image/vnd.adobe.photoshop"]);

/** MIME タイプから Asset.kind を導出 */
export function getAssetKind(mimeType: string): string {
  if (mimeType === "image/gif") return "gif";
  if (FILE_ICON_IMAGE_MIMES.has(mimeType)) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (isPlayableAudio(mimeType)) return "audio";
  return "file";
}
