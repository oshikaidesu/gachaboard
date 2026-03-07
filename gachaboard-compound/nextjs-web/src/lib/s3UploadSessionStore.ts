/**
 * S3 再開可能アップロード用の IndexedDB ストア。
 * FileSystemFileHandle を保存し、再開時にファイルを再取得できるようにする。
 */

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE, { keyPath: "uploadId" });
    };
  });
}

export async function saveS3UploadSession(session: StoredSession): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(session);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getS3UploadSession(uploadId: string): Promise<StoredSession | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(uploadId);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function listResumableS3Uploads(): Promise<StoredSession[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      db.close();
      const list = (req.result as StoredSession[]) ?? [];
      resolve(list.sort((a, b) => a.createdAt - b.createdAt));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeS3UploadSession(uploadId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(uploadId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
