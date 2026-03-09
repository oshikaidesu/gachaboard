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

/** コメント（タイムライン付き）。Y.Doc に保存。表示用 */
export type ApiComment = {
  id: string;
  assetId: string;
  timeSec: number;
  body: string;
  createdAt?: string;
  deletedAt?: string | null;
  author: ApiUser;
  authorUserId?: string;
};

/** シェイプへのリアクション。Y.Doc に保存。表示用 */
export type ApiReaction = {
  id: string;
  shapeId: string;
  emoji: string;
  userId: string;
  deletedAt?: string | null;
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

/** ワークスペースメンバー（オーナー＋招待メンバー一覧） */
export type ApiWorkspaceMember = {
  userId: string;
  discordName: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: string;
};
