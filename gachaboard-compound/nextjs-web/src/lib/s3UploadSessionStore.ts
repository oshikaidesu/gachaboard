/**
 * S3 再開可能アップロード用の IndexedDB ストア。
 * FileSystemFileHandle を保存し、再開時にファイルを再取得できるようにする。
 * idb ライブラリを使用。
 */

import { openDB } from "idb";

const DB_NAME = "gachaboard-s3-uploads";
const STORE = "sessions";
const VERSION = 1;

export type StoredSession = {
  uploadId: string;
  key: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  totalSize: number;
  totalParts: number;
  boardId: string;
  handle?: FileSystemFileHandle;
  createdAt: number;
};

interface S3UploadDB {
  sessions: {
    key: string;
    value: StoredSession;
  };
}

function getDb() {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return openDB<S3UploadDB>(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "uploadId" });
      }
    },
  });
}

export async function saveS3UploadSession(session: StoredSession): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.put(STORE, session);
  db.close();
}

export async function getS3UploadSession(uploadId: string): Promise<StoredSession | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.get(STORE, uploadId);
  db.close();
  return result ?? null;
}

export async function listResumableS3Uploads(): Promise<StoredSession[]> {
  const db = await getDb();
  if (!db) return [];
  const list = (await db.getAll(STORE)) ?? [];
  db.close();
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeS3UploadSession(uploadId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(STORE, uploadId);
  db.close();
}
