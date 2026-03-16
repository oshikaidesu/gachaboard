#!/usr/bin/env node
/**
 * sync-server ゲート: トークン検証後に y-websocket-server へ転送する。
 * NEXTAUTH_SECRET が未設定の場合は y-websocket-server をそのまま起動（従来どおり）。
 */

import { createServer } from "http";
import { spawn } from "child_process";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GATE_PORT = parseInt(process.env.PORT || "5858", 10);
const BACKEND_PORT = parseInt(process.env.SYNC_BACKEND_PORT || "5859", 10);
const SECRET = process.env.NEXTAUTH_SECRET?.trim();

function base64UrlEncode(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function verifyToken(token, roomId) {
  if (!SECRET || !token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  let payload;
  try {
    const raw = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    payload = JSON.parse(raw);
  } catch {
    return false;
  }
  if (payload.exp < Date.now() || payload.boardId !== roomId) return false;
  const expectedSig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest();
  const expectedB64 = base64UrlEncode(expectedSig);
  return expectedB64.length === sigB64.length && crypto.timingSafeEqual(Buffer.from(expectedB64), Buffer.from(sigB64));
}

function extractRoomId(pathname) {
  const p = pathname.replace(/^\/+/, "").split("?")[0].trim();
  return p || null;
}

function runGate() {
  const backend = spawn("npx", ["y-websocket-server"], {
    env: { ...process.env, PORT: String(BACKEND_PORT), HOST: "127.0.0.1" },
    cwd: __dirname,
    stdio: "inherit",
  });
  backend.on("error", (err) => {
    console.error("[gate] backend spawn error:", err);
    process.exit(1);
  });
  backend.on("exit", (code) => {
    process.exit(code ?? 1);
  });

  const server = createServer();
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const roomId = extractRoomId(url.pathname);
    const token = url.searchParams.get("token");

    if (!roomId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    if (!verifyToken(token, roomId)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const backendUrl = `ws://127.0.0.1:${BACKEND_PORT}/${roomId}`;
      const backendWs = new WebSocket(backendUrl);

      backendWs.on("open", () => {
        clientWs.on("message", (data) => backendWs.send(data));
        backendWs.on("message", (data) => clientWs.send(data));
        clientWs.on("close", () => backendWs.close());
        backendWs.on("close", () => clientWs.close());
        clientWs.on("error", () => backendWs.close());
        backendWs.on("error", () => clientWs.close());
      });
      backendWs.on("error", () => clientWs.close());
    });
  });

  function listen() {
    server.listen(GATE_PORT, "0.0.0.0", () => {
      console.log(`[gate] listening on ${GATE_PORT}, backend on ${BACKEND_PORT}`);
    });
  }
  setTimeout(listen, 1500);
}

if (!SECRET) {
  console.log("[gate] NEXTAUTH_SECRET not set, running y-websocket-server directly");
  const child = spawn("npx", ["y-websocket-server"], {
    env: { ...process.env, PORT: String(GATE_PORT), HOST: "0.0.0.0" },
    cwd: __dirname,
    stdio: "inherit",
  });
  child.on("error", (err) => {
    console.error(err);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  runGate();
}
