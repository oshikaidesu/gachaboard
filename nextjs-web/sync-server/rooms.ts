import { NodeSqliteWrapper, SQLiteSyncStorage, TLSocketRoom } from "@tldraw/sync-core";
import Database from "better-sqlite3";
import { mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { customSchema } from "./shapeSchema.js";

const DIR = process.env.ROOMS_DIR ?? "./.rooms";
mkdirSync(DIR, { recursive: true });

function sanitizeRoomId(roomId: string): string {
  return roomId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

interface RoomEntry {
  room: TLSocketRoom;
  db: InstanceType<typeof Database>;
  sessionCount: number;
}

const rooms = new Map<string, RoomEntry>();

export function makeOrLoadRoom(roomId: string): TLSocketRoom {
  roomId = sanitizeRoomId(roomId);

  const existing = rooms.get(roomId);
  if (existing && !existing.room.isClosed()) {
    return existing.room;
  }

  console.log(`[sync] room=${roomId} loading from disk`);
  const db = new Database(join(DIR, `${roomId}.db`));
  const sql = new NodeSqliteWrapper(db);
  const storage = new SQLiteSyncStorage({ sql });

  const entry: RoomEntry = { room: null as unknown as TLSocketRoom, db, sessionCount: 0 };

  const room = new TLSocketRoom({
    storage,
    schema: customSchema,
    onSessionRemoved(_room, args) {
      const e = rooms.get(roomId);
      if (e) e.sessionCount = Math.max(0, args.numSessionsRemaining);
      console.log(
        `[sync] room=${roomId} session_left sessionId=${args.sessionId} remaining=${args.numSessionsRemaining}`
      );
      if (args.numSessionsRemaining === 0) {
        console.log(`[sync] room=${roomId} closing (no sessions left)`);
        room.close();
        db.close();
        rooms.delete(roomId);
      }
    },
  });

  entry.room = room;
  rooms.set(roomId, entry);
  console.log(`[sync] room=${roomId} created session_count=0`);
  return room;
}

export function markRoomSessionJoined(roomId: string): number {
  roomId = sanitizeRoomId(roomId);
  const entry = rooms.get(roomId);
  if (!entry || entry.room.isClosed()) return 0;
  entry.sessionCount += 1;
  console.log(`[sync] room=${roomId} session_joined total=${entry.sessionCount}`);
  return entry.sessionCount;
}

export function getRoomSessionCount(roomId: string): number {
  roomId = sanitizeRoomId(roomId);
  return rooms.get(roomId)?.sessionCount ?? 0;
}

export function deleteRoom(roomId: string): boolean {
  roomId = sanitizeRoomId(roomId);

  const existing = rooms.get(roomId);
  if (existing && !existing.room.isClosed()) {
    existing.room.close();
    existing.db.close();
    rooms.delete(roomId);
  }

  const dbPath = join(DIR, `${roomId}.db`);
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
    console.log(`[sync] room=${roomId} db deleted`);
    return true;
  }
  return false;
}
