import cors from "@fastify/cors";
import websocketPlugin from "@fastify/websocket";
import fastify from "fastify";
import { makeOrLoadRoom, deleteRoom, getRoomSessionCount, markRoomSessionJoined } from "./rooms.js";

const PORT = process.env.SYNC_PORT ? parseInt(process.env.SYNC_PORT) : 5858;

const app = fastify({ logger: { level: "info" } });
app.register(websocketPlugin);
app.register(cors, { origin: "*" });

app.register(async (app) => {
  // メイン同期エンドポイント（公式 simple-server-example と同じ構成）
  app.get("/sync/:roomId", { websocket: true }, (socket, req) => {
    const roomId = (req.params as { roomId: string }).roomId;
    // sessionId はクエリから受け取るか、サーバー側で生成する
    // useSync が内部で生成した sessionId をクエリに付けてくる
    const sessionId = (req.query as { sessionId?: string }).sessionId ?? crypto.randomUUID();

    console.log(`[sync] ws_connect roomId=${roomId} sessionId=${sessionId.slice(0, 8)} ip=${req.ip}`);

    const room = makeOrLoadRoom(roomId);
    try {
      // socket は ws.WebSocket インスタンス（addEventListener を持つ）
      room.handleSocketConnect({ sessionId, socket });
      const count = markRoomSessionJoined(roomId);
      console.log(`[sync] room=${roomId} active_sessions=${count}`);
    } catch (error) {
      console.error(
        `[sync] ws_connect_failed roomId=${roomId} sessionId=${sessionId.slice(0, 8)} error=${String(error)}`
      );
      socket.close();
    }
  });

  // ルーム削除エンドポイント（ボード完全削除時に Next.js から呼ぶ）
  app.delete("/room/:roomId", async (req, res) => {
    const roomId = (req.params as { roomId: string }).roomId;
    const deleted = deleteRoom(roomId);
    res.send({ ok: deleted });
  });

  // ルーム状態確認（デバッグ用）
  app.get("/status/:roomId", async (req, res) => {
    const roomId = (req.params as { roomId: string }).roomId;
    const count = getRoomSessionCount(roomId);
    res.send({ roomId, activeSessions: count });
  });

  // ヘルスチェック
  app.get("/health", async (_req, res) => {
    res.send({ ok: true });
  });
});

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[sync] server listening on port ${PORT}`);
});
