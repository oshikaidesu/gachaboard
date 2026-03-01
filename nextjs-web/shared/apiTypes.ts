/**
 * API レスポンスの共有型定義。
 * クライアントコンポーネントと API ルートの双方からインポートする。
 * フィールド名は Prisma スキーマの User モデル（discordName, avatarUrl）に準拠。
 */

export type ApiUser = {
  id: string;
  discordName: string;
  avatarUrl: string | null;
};

export type ApiAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
};

export type ApiComment = {
  id: string;
  assetId: string;
  timeSec: number;
  body: string;
  author: ApiUser;
  createdAt: string;
  deletedAt: string | null;
};

export type ApiReaction = {
  id: string;
  shapeId: string;
  emoji: string;
  userId: string;
  deletedAt: string | null;
  user: ApiUser;
};

export type ApiWorkspace = {
  id: string;
  name: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  createdAt: string;
  deletedAt: string | null;
  _count: { boards: number };
};

export type ApiBoard = {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
};

export type ApiWorkspaceInfo = {
  name: string;
  ownerUserId: string;
  ownerName: string;
};
