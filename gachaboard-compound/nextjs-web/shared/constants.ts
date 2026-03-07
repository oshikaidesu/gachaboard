/**
 * アプリケーション全体で共有する定数。
 * マジックナンバーをここに集約し、変更を1箇所で完結させる。
 */

/** ShapeReactionPanel のポーリング間隔（ミリ秒）。Yjs 同期時は短く、未接続時は長め */
export const POLLING_INTERVAL_REACTIONS = 15000;
export const POLLING_INTERVAL_REACTIONS_SYNC = 2000;

/** AssetLoader のポーリング間隔（ミリ秒） */
export const POLLING_INTERVAL_ASSET_LOADER = 1500;

/** シェイプコメントのポーリング間隔（ミリ秒） */
export const POLLING_INTERVAL_COMMENTS = 30000;

/** テキストファイルプレビューの最大バイト数 */
export const MAX_TEXT_PREVIEW_BYTES = 10240;

/** リアクション絵文字のデフォルトプリセット（5固定 + 24カスタム候補） */
export const FIXED_EMOJI_LIST = ["❤️", "👍", "🙇", "🔥", "🆗"];
export const CUSTOM_EMOJI_CANDIDATES = [
  "👍", "❤️", "🔥", "✨", "😂", "😮", "👀", "🎉", "💯", "🤔", "😢", "🚀",
  "👏", "🙏", "💪", "🎊", "😍", "🤩", "😎", "🥳", "💡", "⭐", "🌟", "💎",
];
/** デフォルト表示用（固定5個 + カスタム24個、重複除去） */
export const DEFAULT_REACTION_EMOJI_LIST = [
  ...FIXED_EMOJI_LIST,
  ...CUSTOM_EMOJI_CANDIDATES.filter((e) => !FIXED_EMOJI_LIST.includes(e)),
];
