/**
 * 起動状況・DB 接続をまとめて表示（手軽なヘルスチェック）
 *
 * 実行: cd nextjs-web && npm run status
 */
import { config } from "dotenv";
import * as net from "net";
import pg from "pg";

config({ path: ".env.local" });

const TIMEOUT_MS = 4000;

function parseWsPort(wsUrl: string): number {
  try {
    const u = new URL(wsUrl.replace(/^ws/, "http"));
    return parseInt(u.port || "80", 10) || (u.protocol === "https:" ? 443 : 80);
  } catch {
    return 5858;
  }
}

function minioHealthUrl(s3Endpoint: string): string {
  try {
    const base = s3Endpoint.replace(/\/$/, "");
    return `${base}/minio/health/live`;
  } catch {
    return "http://localhost:9000/minio/health/live";
  }
}

async function checkTcpPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function checkHttp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    return res.ok || res.status === 302 || res.status === 307 || res.status === 401;
  } catch {
    return false;
  }
}

async function checkDb(databaseUrl: string | undefined): Promise<{ ok: boolean; detail: string }> {
  if (!databaseUrl?.trim()) {
    return { ok: false, detail: ".env.local に DATABASE_URL がありません" };
  }
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: TIMEOUT_MS });
  try {
    await client.connect();
    let users = "?";
    let tables = "?";
    try {
      const tablesRes = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public'`
      );
      tables = tablesRes.rows[0]?.n ?? "?";
    } catch {
      /* ignore */
    }
    try {
      const usersRes = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM "User"`);
      users = usersRes.rows[0]?.n ?? "0";
    } catch {
      users = "(スキーマ未適用の可能性 → npx prisma db push)";
    }
    await client.end();
    return { ok: true, detail: `公開テーブル数 ${tables} / User 行 ${users}` };
  } catch (e) {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg };
  }
}

function line(ok: boolean, label: string, detail: string) {
  const mark = ok ? "OK " : "NG ";
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${mark}${label.padEnd(14)} ${detail}`);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const nextUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const s3Endpoint = process.env.S3_ENDPOINT || "http://localhost:9000";
  const wsUrl = process.env.NEXT_PUBLIC_SYNC_WS_URL || "ws://localhost:5858";
  const syncPort = parseWsPort(wsUrl);
  const syncHost = (() => {
    try {
      return new URL(wsUrl.replace(/^ws/, "http")).hostname;
    } catch {
      return "127.0.0.1";
    }
  })();

  console.log("");
  console.log("Gachaboard 状態 (npm run status)");
  console.log("─".repeat(50));

  const db = await checkDb(dbUrl);
  line(db.ok, "PostgreSQL", db.detail);
  if (!db.ok) {
    console.log("");
    console.log("   → docker compose up -d postgres");
    console.log("   → DATABASE_URL を .env.local で確認（例: localhost:5433）");
    console.log("");
    process.exit(1);
  }

  const minioOk = await checkHttp(minioHealthUrl(s3Endpoint));
  line(minioOk, "MinIO", minioOk ? s3Endpoint : `${s3Endpoint} に接続できません → docker compose up -d minio`);

  const syncOk = await checkTcpPort(syncHost === "localhost" ? "127.0.0.1" : syncHost, syncPort);
  line(
    syncOk,
    "sync-server",
    syncOk ? `port ${syncPort} (Yjs)` : `port ${syncPort} 不通 → docker compose up -d sync-server`
  );

  const nextOk = await checkHttp(nextUrl);
  line(
    nextOk,
    "Next.js",
    nextOk ? nextUrl : `${nextUrl} 不通 → cd nextjs-web && npm run dev`
  );

  console.log("─".repeat(50));
  if (nextOk && minioOk && syncOk) {
    console.log("✅ 主要サービスは起動しています。ブラウザで " + nextUrl + " を開いてください。");
  } else {
    console.log("⚠️  一部未起動。上記を確認してください。");
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
