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
