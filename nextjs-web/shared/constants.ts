/**
 * アプリケーション全体で共有する定数。
 * マジックナンバーをここに集約し、変更を1箇所で完結させる。
 */

/** AssetLoader のポーリング間隔（ミリ秒） */
export const POLLING_INTERVAL_ASSET_LOADER = 1500;

/** テキストファイルプレビューの最大バイト数 */
export const MAX_TEXT_PREVIEW_BYTES = 10240;

/** リアクション絵文字の固定5つ（常に表示） */
export const FIXED_EMOJI_LIST = ["❤️", "👍", "🙇", "🔥", "🆗"];
/** カスタム候補（ユーザーが追加したいときの例） */
export const CUSTOM_EMOJI_CANDIDATES = [
  "👍", "❤️", "🔥", "✨", "😂", "😮", "👀", "🎉", "💯", "🤔", "😢", "🚀",
  "👏", "🙏", "💪", "🎊", "😍", "🤩", "😎", "🥳", "💡", "⭐", "🌟", "💎",
];
/** デフォルト表示用（固定5つのみ。カスタムは空） */
export const DEFAULT_REACTION_EMOJI_LIST = [...FIXED_EMOJI_LIST];

/** OGP キャッシュ TTL（ミリ秒） */
export const OGP_CACHE_TTL_MS = 60 * 60 * 1000;
/** OGP キャッシュ上限件数 */
export const OGP_CACHE_LIMIT = 200;
/** OGP fetch タイムアウト（ミリ秒） */
export const OGP_FETCH_TIMEOUT_MS = 5000;
/** エラー表示の消去時間（ミリ秒） */
export const ERROR_TOAST_DURATION_MS = 5000;

/** アセット種別（Asset.kind 用） */
export const ASSET_KIND = {
  GIF: "gif",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  FILE: "file",
} as const;
