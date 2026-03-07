/**
 * API レスポンスの共有型定義。
 *
 * Prisma が生成したモデル型（src/generated/prisma）を基底として派生させることで、
 * DB スキーマ変更時に型の乖離が起きにくい設計にしている。
 *
 * 変換ルール:
 *   - bigint  → string  （JSON シリアライズ時に .toString() する）
 *   - Date    → string  （JSON シリアライズ時に ISO 文字列になる）
 *   - リレーション フィールドは除外し、必要なものだけ明示的に追加する
 */

import type {
  UserModel,
  AssetModel,
  MediaCommentModel,
  ObjectReactionModel,
  WorkspaceModel,
  BoardModel,
} from "../src/generated/prisma/models";

// ---------- ユーティリティ型 --------------------------------------------------

/** bigint を string に、Date を string に変換するユーティリティ */
type Serialize<T> = {
  [K in keyof T]: T[K] extends bigint
    ? string
    : T[K] extends Date
      ? string
      : T[K] extends bigint | null
        ? string | null
        : T[K] extends Date | null
          ? string | null
          : T[K];
};

// ---------- 公開 API 型 -------------------------------------------------------

/** ユーザー情報（認証・プレゼンス用） */
export type ApiUser = Pick<
  Serialize<UserModel>,
  "id" | "discordName" | "avatarUrl"
>;

/** アセット（ファイル）情報 */
export type ApiAsset = Pick<
  Serialize<AssetModel>,
  "id" | "fileName" | "mimeType" | "kind" | "sizeBytes" | "lastKnownX" | "lastKnownY"
>;

/** コメント（タイムライン付き） */
export type ApiComment = Pick<
  Serialize<MediaCommentModel>,
  "id" | "assetId" | "timeSec" | "body" | "createdAt" | "deletedAt"
> & {
  author: ApiUser;
};

/** シェイプへのリアクション */
export type ApiReaction = Pick<
  Serialize<ObjectReactionModel>,
  "id" | "shapeId" | "emoji" | "userId" | "deletedAt"
> & {
  user: ApiUser;
};

/** ワークスペース一覧・詳細 */
export type ApiWorkspace = Pick<
  Serialize<WorkspaceModel>,
  "id" | "name" | "description" | "ownerUserId" | "createdAt" | "deletedAt"
> & {
  ownerName: string;
  _count: { boards: number };
};

/** ボード一覧 */
export type ApiBoard = Pick<
  Serialize<BoardModel>,
  "id" | "name" | "createdAt" | "deletedAt"
>;

/** ワークスペース基本情報（ボードページのヘッダー等で使用） */
export type ApiWorkspaceInfo = Pick<ApiWorkspace, "name" | "ownerUserId"> & {
  ownerName: string;
};
