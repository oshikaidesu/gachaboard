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
/** 1ボードあたりの最大同時接続数（1ボード約30人想定）。環境変数 SYNC_MAX_CLIENTS_PER_ROOM で上書き可 */
const MAX_CLIENTS_PER_ROOM = parseInt(process.env.SYNC_MAX_CLIENTS_PER_ROOM || "30", 10);

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
  let isShuttingDown = false;
  backend.on("error", (err) => {
    console.error("[gate] backend spawn error:", err);
    process.exit(1);
  });
  backend.on("exit", (code) => {
    if (isShuttingDown) return;
    process.exit(code ?? 1);
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ noServer: true });
  /** ルームIDごとの現在の接続数 */
  const roomCounts = new Map();

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

    const current = roomCounts.get(roomId) || 0;
    if (current >= MAX_CLIENTS_PER_ROOM) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const backendUrl = `ws://127.0.0.1:${BACKEND_PORT}/${roomId}`;
      const backendWs = new WebSocket(backendUrl);

      const BACKEND_TIMEOUT_MS = 5000;
      let opened = false;

      const cleanup = () => {
        clearTimeout(timeout);
        try {
          backendWs.terminate();
        } catch {}
        try {
          clientWs.close(1011, "backend unavailable");
        } catch {}
      };

      const timeout = setTimeout(() => {
        if (opened) return;
        console.warn("[gate] backend connection timeout");
        cleanup();
      }, BACKEND_TIMEOUT_MS);

      backendWs.on("open", () => {
        opened = true;
        clearTimeout(timeout);
        roomCounts.set(roomId, (roomCounts.get(roomId) || 0) + 1);
        const decrementRoom = () => {
          const n = roomCounts.get(roomId) ?? 0;
          if (n <= 1) roomCounts.delete(roomId);
          else roomCounts.set(roomId, n - 1);
        };
        clientWs.on("message", (data) => backendWs.send(data));
        backendWs.on("message", (data) => clientWs.send(data));
        clientWs.on("close", () => {
          decrementRoom();
          backendWs.close();
        });
        backendWs.on("close", () => {
          decrementRoom();
          clientWs.close();
        });
        clientWs.on("error", () => {
          decrementRoom();
          backendWs.close();
        });
        backendWs.on("error", () => {
          decrementRoom();
          clientWs.close();
        });
      });

      backendWs.on("close", () => {
        if (!opened) cleanup();
      });
      backendWs.on("error", () => {
        if (!opened) cleanup();
      });
    });
  });

  function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("[gate] SIGTERM received, closing connections...");
    for (const ws of wss.clients) {
      try {
        ws.close(1001, "going away");
      } catch {}
    }
    backend.kill("SIGTERM");
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

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
