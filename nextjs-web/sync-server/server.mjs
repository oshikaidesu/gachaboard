#!/usr/bin/env node
/**
 * Hocuspocus ベースの sync-server。
 * - 認証: NEXTAUTH_SECRET 設定時は GET /api/sync-token で発行したトークンを検証
 * - 永続化: SQLite（/app/sync-data/collab.sqlite）。ドキュメント未使用時はメモリ解放の恩恵あり
 * - 接続数: 1ボードあたり SYNC_MAX_CLIENTS_PER_ROOM（デフォルト100）まで
 */

import { Server } from "@hocuspocus/server";
import { SQLite } from "@hocuspocus/extension-sqlite";
import crypto from "crypto";
import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || "5858", 10);
const SECRET = process.env.NEXTAUTH_SECRET?.trim();
const MAX_CLIENTS_PER_ROOM = parseInt(process.env.SYNC_MAX_CLIENTS_PER_ROOM || "100", 10);
const PERSIST_DIR = process.env.YPERSISTENCE || join(__dirname, "sync-data");
fs.mkdirSync(PERSIST_DIR, { recursive: true });

function base64UrlEncode(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function verifyToken(token, documentName) {
  if (!SECRET || !token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  let payload;
  try {
    const raw = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8"
    );
    payload = JSON.parse(raw);
  } catch {
    return false;
  }
  if (payload.exp < Date.now() || payload.boardId !== documentName) return false;
  const expectedSig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest();
  const expectedB64 = base64UrlEncode(expectedSig);
  return (
    expectedB64.length === sigB64.length &&
    crypto.timingSafeEqual(Buffer.from(expectedB64), Buffer.from(sigB64))
  );
}

/** ルーム（documentName）ごとの接続数 */
const roomCounts = new Map();

const server = new Server({
  name: "gachaboard-sync",
  port: PORT,
  quiet: true,
  timeout: 30000,
  debounce: 2000,
  maxDebounce: 10000,

  async onAuthenticate({ documentName, token }) {
    if (SECRET) {
      if (!verifyToken(token, documentName)) {
        throw new Error("Forbidden");
      }
    }
    const current = roomCounts.get(documentName) || 0;
    if (current >= MAX_CLIENTS_PER_ROOM) {
      throw new Error("Room full");
    }
  },

  connected({ documentName }) {
    roomCounts.set(documentName, (roomCounts.get(documentName) || 0) + 1);
  },

  onDisconnect({ documentName }) {
    const n = roomCounts.get(documentName) ?? 0;
    if (n <= 1) roomCounts.delete(documentName);
    else roomCounts.set(documentName, n - 1);
  },

  onRequest({ request, response }) {
    return new Promise((resolve, reject) => {
      const url = new URL(request.url ?? "", `http://${request.headers.host}`);
      if (request.method === "GET" && url.pathname === "/health") {
        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end("ok");
        reject();
        return;
      }
      // ボード完全削除時: Next.js が DELETE /room/:boardId を呼ぶ → SQLite から該当ドキュメントを削除
      const roomMatch = url.pathname.match(/^\/room\/([^/]+)$/);
      if (request.method === "DELETE" && roomMatch) {
        const boardId = roomMatch[1];
        import("sqlite3")
          .then((m) => m.default)
          .then((sqlite3) => {
            const db = new sqlite3.Database(`${PERSIST_DIR}/collab.sqlite`);
            db.run("DELETE FROM documents WHERE name = ?", [boardId], () => {
              db.close();
              response.writeHead(204);
              response.end();
              reject();
            });
          })
          .catch(() => {
            response.writeHead(500);
            response.end();
            reject();
          });
        return;
      }
      resolve();
    });
  },

  extensions: [
    new SQLite({
      database: `${PERSIST_DIR}/collab.sqlite`,
    }),
  ],
});

server.listen();

console.log(
  `[hocuspocus] listening on ${PORT}, auth=${!!SECRET}, maxPerRoom=${MAX_CLIENTS_PER_ROOM}, persist=${PERSIST_DIR}`
);
