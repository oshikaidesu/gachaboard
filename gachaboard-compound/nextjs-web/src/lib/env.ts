/**
 * 環境変数の集約・バリデーション。
 *
 * アプリ内で process.env.XXX を直接参照する代わりに、このモジュールから
 * 型安全な値をインポートする。
 *
 * 必須変数が未設定の場合は起動時にエラーを throw するため、
 * 本番環境での設定漏れを早期に検出できる。
 *
 * 使い方:
 *   import { env } from "@/lib/env";
 *   const url = env.SYNC_SERVER_URL;
 */

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`[env] 必須の環境変数 "${key}" が設定されていません。`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function bool(key: string, fallback = false): boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export const env = {
  // ---- 認証 ----------------------------------------------------------------
  /** NextAuth シークレット（必須） */
  NEXTAUTH_SECRET: required("NEXTAUTH_SECRET"),
  /** NextAuth ベース URL（必須） */
  NEXTAUTH_URL: required("NEXTAUTH_URL"),
  /** Discord OAuth クライアント ID（必須） */
  DISCORD_CLIENT_ID: required("DISCORD_CLIENT_ID"),
  /** Discord OAuth クライアントシークレット（必須） */
  DISCORD_CLIENT_SECRET: required("DISCORD_CLIENT_SECRET"),

  // ---- データベース ---------------------------------------------------------
  /** PostgreSQL 接続文字列（必須） */
  DATABASE_URL: required("DATABASE_URL"),

  // ---- ストレージ -----------------------------------------------------------
  /** アップロードファイルの保存ディレクトリ */
  UPLOAD_DIR: optional("UPLOAD_DIR", ""),
  /** 変換済みファイルの保存ディレクトリ */
  CONVERTED_DIR: optional("CONVERTED_DIR", ""),
  /** 波形データの保存ディレクトリ */
  WAVEFORM_DIR: optional("WAVEFORM_DIR", ""),
  /** チャンクアップロード一時ディレクトリ */
  CHUNKS_DIR: optional("CHUNKS_DIR", ""),
  /** 動画サムネイルの保存ディレクトリ */
  THUMBNAIL_DIR: optional("THUMBNAIL_DIR", ""),
  /** アップロードファイルの最大サイズ（バイト）。デフォルト 100GB（stem 等の大容量ファイル用） */
  MAX_UPLOAD_SIZE: parseInt(optional("MAX_UPLOAD_SIZE", "107374182400"), 10),

  // ---- S3（オプション。未設定時はローカルアップロードのみ）-------------------------
  /** S3 バケット名 */
  S3_BUCKET: optional("S3_BUCKET", ""),
  /** AWS アクセスキー（MinIO でも使用） */
  AWS_ACCESS_KEY_ID: optional("AWS_ACCESS_KEY_ID", ""),
  /** AWS シークレットキー */
  AWS_SECRET_ACCESS_KEY: optional("AWS_SECRET_ACCESS_KEY", ""),
  /** S3 エンドポイント（MinIO 用。例: http://minio:9000） */
  S3_ENDPOINT: optional("S3_ENDPOINT", ""),
  /** S3 リージョン（AWS 用。MinIO は us-east-1 等） */
  S3_REGION: optional("S3_REGION", "us-east-1"),
  /** クライアントが Presigned URL でアクセスするベース URL（MinIO が別ホスト/ポートのとき必須） */
  S3_PUBLIC_URL: optional("S3_PUBLIC_URL", ""),

  // ---- 内部サービス --------------------------------------------------------
  /** sync-server の内部 URL */
  SYNC_SERVER_URL: optional("SYNC_SERVER_URL", "http://sync-server:5858"),
  /** クライアント用 WebSocket URL（NEXT_PUBLIC 必須）。例: ws://localhost:5858 または wss://host/ws */
  NEXT_PUBLIC_SYNC_WS_URL: optional("NEXT_PUBLIC_SYNC_WS_URL", "ws://localhost:5858"),

  /** サーバーオーナーの Discord ID（設定時はこのユーザーのみワークスペースへアクセス可） */
  SERVER_OWNER_DISCORD_ID: optional("SERVER_OWNER_DISCORD_ID", ""),

  // ---- テスト・開発 --------------------------------------------------------
  /** E2E テストモード（認証バイパス等） */
  E2E_TEST_MODE: bool("E2E_TEST_MODE"),
  /** Node.js 環境 */
  NODE_ENV: optional("NODE_ENV", "development") as "development" | "production" | "test",
} as const;

// E2E テストモードは本番環境で使用禁止（認証バイパス等の重大な脆弱性）
if (env.E2E_TEST_MODE && env.NODE_ENV === "production") {
  throw new Error("[env] E2E_TEST_MODE は本番環境で使用できません");
}
