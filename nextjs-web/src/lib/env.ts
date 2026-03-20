/**
 * 環境変数の集約・バリデーション。
 * @t3-oss/env-nextjs を使用。
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

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const boolSchema = z
  .string()
  .optional()
  .transform((v) => v === "1" || v?.toLowerCase() === "true");

export const env = createEnv({
  server: {
    NEXTAUTH_SECRET: z.string().min(1),
    /** 未設定時は getBaseUrl() がリクエストの Host から動的に解決。HTTPS のみなら env で固定しなくてよい */
    NEXTAUTH_URL: z
      .union([z.string().url(), z.literal("")])
      .optional()
      .default(""),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DATABASE_URL: z.string().url(),
    MAX_UPLOAD_SIZE: z
      .string()
      .optional()
      .default("107374182400")
      .transform((v) => parseInt(v, 10)),
    S3_BUCKET: z.string().default(""),
    AWS_ACCESS_KEY_ID: z.string().default(""),
    AWS_SECRET_ACCESS_KEY: z.string().default(""),
    S3_ENDPOINT: z.string().default(""),
    S3_REGION: z.string().default("us-east-1"),
    S3_PUBLIC_URL: z.string().default(""),
    SYNC_SERVER_URL: z.string().default("http://sync-server:5858"),
    SERVER_OWNER_DISCORD_ID: z.string().default(""),
    E2E_TEST_MODE: boolSchema.default(false),
    /** 動画エンコード: cpu=常に libx264, gpu=HW 利用可なら利用 */
    FFMPEG_VIDEO_BACKEND: z.enum(["cpu", "gpu"]).optional(),
    /** CPU 並列の強さ: light|medium|heavy（主に ffmpeg -threads。変換品質・OS 優先度とは別） */
    FFMPEG_RESOURCE_INTENSITY: z.enum(["light", "medium", "heavy"]).optional(),
    /** プレビュー変換の品質・サイズ: light|medium|heavy（動画CRF/CQ・サムネ・MP3・波形） */
    FFMPEG_OUTPUT_PRESET: z.enum(["light", "medium", "heavy"]).optional(),
    /** ffmpeg のスレッド上限（正の整数）。未設定なら負荷段階で 2 / 4 / 無制限 */
    FFMPEG_THREAD_LIMIT: z
      .string()
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return undefined;
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      }),
    /**
     * ffmpeg プロセスの OS 優先度。low=他アプリ優先（Unix: nice、Win: Idle 相当）。
     * auto=CPU 並列「低い」のときだけ low（FFMPEG_RESOURCE_INTENSITY と連動）。
     */
    FFMPEG_OS_PRIORITY: z.enum(["low", "normal", "auto"]).optional(),
    /** レガシー: gentle|balanced|speed（RESOURCE / OUTPUT 両方に相当する段階として解釈） */
    FFMPEG_MEDIA_LOAD_PRESET: z.enum(["gentle", "balanced", "speed"]).optional(),
    /** レガシー: 動画エンコーダ。libx264→cpu寄り、HW 名→gpu+そのエンコーダ優先 */
    FFMPEG_MEDIA_ENCODER: z
      .enum(["auto", "libx264", "h264_nvenc", "h264_qsv", "h264_amf", "h264_videotoolbox"])
      .optional(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_SYNC_WS_URL: z.string().default("ws://localhost:18582"),
  },
  runtimeEnv: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    MAX_UPLOAD_SIZE: process.env.MAX_UPLOAD_SIZE,
    S3_BUCKET: process.env.S3_BUCKET,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_PUBLIC_URL: process.env.S3_PUBLIC_URL,
    SYNC_SERVER_URL: process.env.SYNC_SERVER_URL,
    SERVER_OWNER_DISCORD_ID: process.env.SERVER_OWNER_DISCORD_ID,
    E2E_TEST_MODE: process.env.E2E_TEST_MODE,
    FFMPEG_VIDEO_BACKEND: process.env.FFMPEG_VIDEO_BACKEND?.trim() || undefined,
    FFMPEG_RESOURCE_INTENSITY: process.env.FFMPEG_RESOURCE_INTENSITY?.trim() || undefined,
    FFMPEG_OUTPUT_PRESET: process.env.FFMPEG_OUTPUT_PRESET?.trim() || undefined,
    FFMPEG_THREAD_LIMIT: process.env.FFMPEG_THREAD_LIMIT,
    FFMPEG_OS_PRIORITY: process.env.FFMPEG_OS_PRIORITY?.trim() || undefined,
    FFMPEG_MEDIA_LOAD_PRESET: process.env.FFMPEG_MEDIA_LOAD_PRESET?.trim() || undefined,
    FFMPEG_MEDIA_ENCODER: process.env.FFMPEG_MEDIA_ENCODER?.trim() || undefined,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SYNC_WS_URL: process.env.NEXT_PUBLIC_SYNC_WS_URL,
  },
});

/**
 * ブラウザから見た S3 リソースの公開 URL ベースを返す。
 *
 * baseUrl 省略時は env.NEXTAUTH_URL を使用（空なら https://localhost:PORT）。
 * リクエストコンテキストでは getBaseUrl() を渡すと動的オリジンになる。
 *
 * HTTPS（Tailscale 等）の場合、S3_PUBLIC_URL が localhost を指していても
 * 混合コンテンツになるため /minio プロキシ経由に強制する。
 */
export function getS3PublicUrl(baseUrl?: string): string {
  const base = baseUrl || env.NEXTAUTH_URL || `https://localhost:${process.env.PORT || "18580"}`;
  const authUrl = new URL(base);
  const isHttps = authUrl.protocol === "https:";

  if (env.S3_PUBLIC_URL) {
    try {
      const pub = new URL(env.S3_PUBLIC_URL);
      if (isHttps && (pub.hostname === "localhost" || pub.hostname === "127.0.0.1")) {
        return `${authUrl.origin}/minio`;
      }
    } catch { /* invalid URL — fall through */ }
    return env.S3_PUBLIC_URL;
  }

  if (authUrl.hostname === "localhost" || authUrl.hostname === "127.0.0.1") {
    const port = env.S3_ENDPOINT ? new URL(env.S3_ENDPOINT).port || "18583" : "18583";
    return `http://localhost:${port}`;
  }
  return `${authUrl.origin}/minio`;
}

// E2E テストモードは本番環境で使用禁止（認証バイパス等の重大な脆弱性）
// サーバーでのみ実行: クライアントで env を import した際、E2E_TEST_MODE 等の
// サーバー専用変数に触れないようにする（Next.js の client/server 分離）
if (typeof window === "undefined") {
  if (env.E2E_TEST_MODE && env.NODE_ENV === "production") {
    throw new Error("[env] E2E_TEST_MODE は本番環境で使用できません");
  }
}
