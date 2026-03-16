/**
 * sync-server 接続用の短期トークン。
 * 署名は HMAC-SHA256(base64url(payload), NEXTAUTH_SECRET)。
 * sync-server のゲートが同じアルゴリズムで検証する。
 */

import crypto from "crypto";

const TOKEN_TTL_MS = 2 * 60 * 1000; // 2 分

export type SyncTokenPayload = {
  boardId: string;
  exp: number;
};

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** ペイロードを署名して token 文字列を返す（Next.js サーバー用） */
export function signSyncToken(boardId: string, secret: string): string {
  const payload: SyncTokenPayload = {
    boardId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, "utf8"));
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}
