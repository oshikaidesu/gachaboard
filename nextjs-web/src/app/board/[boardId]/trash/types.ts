/**
 * ゴミ箱画面で使用する型定義。API レスポンス（GET /api/assets?trash=1）と一致させる。
 */

export type TrashAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: string;
  deletedAt: string;
  lastKnownX: number | null;
  lastKnownY: number | null;
  uploader: { name: string | null; image: string | null };
};

export type SortKey = "deletedAt_desc" | "deletedAt_asc" | "size_desc" | "size_asc";
