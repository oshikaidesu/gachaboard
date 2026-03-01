/**
 * Prisma クエリで共通利用する select / filter 定数。
 * 全 API ルートからインポートし、User フィールド名のハードコードを排除する。
 */

/** User モデルの公開フィールド（id, discordName, avatarUrl） */
export const USER_SELECT = {
  id: true,
  discordName: true,
  avatarUrl: true,
} as const;

/** 論理削除されていないレコードのみ取得するフィルタ */
export const SOFT_DELETE_FILTER = { deletedAt: null } as const;
