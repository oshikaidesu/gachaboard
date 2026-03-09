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
    NEXTAUTH_URL: z.string().url(),
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
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_SYNC_WS_URL: z.string().default("ws://localhost:5858"),
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
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SYNC_WS_URL: process.env.NEXT_PUBLIC_SYNC_WS_URL,
  },
});

// E2E テストモードは本番環境で使用禁止（認証バイパス等の重大な脆弱性）
if (env.E2E_TEST_MODE && env.NODE_ENV === "production") {
  throw new Error("[env] E2E_TEST_MODE は本番環境で使用できません");
}
