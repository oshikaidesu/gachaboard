/**
 * インフラ周りの確認事項（INFRA-CHECKLIST.md）の自動チェック
 *
 * 実行: cd nextjs-web && npm run infra:check
 *
 * 自動検証できる項目を実行し、手動確認が必要な項目を一覧表示する。
 */
import { config } from "dotenv";
import * as net from "net";
import pg from "pg";

config({ path: ".env.local" });

const TIMEOUT_MS = 5000;

type CheckResult = { ok: boolean; detail: string };

// --- 共通ユーティリティ ---

function parseWsPort(wsUrl: string): number {
  try {
    const u = new URL(wsUrl.replace(/^ws/, "http"));
    return parseInt(u.port || "80", 10) || (u.protocol === "https:" ? 443 : 80);
  } catch {
    return 5858;
  }
}

function minioHealthUrl(s3Endpoint: string): string {
  const base = (s3Endpoint || "http://localhost:18583").replace(/\/$/, "");
  return `${base}/minio/health/live`;
}

async function checkTcpPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const h = host === "localhost" ? "127.0.0.1" : host;
    const socket = new net.Socket();
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, h);
  });
}

async function checkHttp(url: string): Promise<CheckResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    const ok = res.ok || res.status === 302 || res.status === 307 || res.status === 401;
    return { ok, detail: ok ? `${res.status}` : `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg };
  }
}

async function runCmd(cmd: string): Promise<{ ok: boolean; out: string }> {
  const { execSync } = await import("child_process");
  try {
    const out = execSync(cmd, { encoding: "utf-8", timeout: 3000 }).trim();
    return { ok: true, out };
  } catch {
    return { ok: false, out: "" };
  }
}

// --- 各チェック ---

async function checkDb(): Promise<CheckResult> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl?.trim()) {
    return { ok: false, detail: "DATABASE_URL 未設定" };
  }
  const client = new pg.Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: TIMEOUT_MS,
  });
  try {
    await client.connect();
    let tables = "?";
    let users = "?";
    try {
      const r = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public'`
      );
      tables = r.rows[0]?.n ?? "?";
    } catch {
      /* ignore */
    }
    try {
      const r = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM "User"`);
      users = r.rows[0]?.n ?? "0";
    } catch {
      users = "(未適用の可能性)";
    }
    await client.end();
    return { ok: true, detail: `接続OK / テーブル ${tables} / User ${users}` };
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

async function checkMinio(): Promise<CheckResult> {
  const s3 = process.env.S3_ENDPOINT || "http://localhost:18583";
  const r = await checkHttp(minioHealthUrl(s3));
  return r.ok
    ? { ok: true, detail: s3 }
    : { ok: false, detail: `${s3} に接続できません` };
}

async function checkSyncServer(): Promise<CheckResult> {
  const wsUrl = process.env.NEXT_PUBLIC_SYNC_WS_URL || "ws://localhost:18582";
  let host = "127.0.0.1";
  try {
    host = new URL(wsUrl.replace(/^ws/, "http")).hostname;
  } catch {
    /* ignore */
  }
  const port = parseWsPort(wsUrl);
  const ok = await checkTcpPort(host, port);
  return ok
    ? { ok: true, detail: `port ${port} (${wsUrl})` }
    : { ok: false, detail: `port ${port} に接続できません` };
}

async function checkNextjs(): Promise<CheckResult> {
  const url = (process.env.NEXTAUTH_URL || "http://localhost:18580").replace(/\/$/, "");
  const r = await checkHttp(url);
  return r.ok ? { ok: true, detail: url } : { ok: false, detail: `${url} に接続できません` };
}

async function checkS3PublicUrl(): Promise<CheckResult> {
  const internal = process.env.S3_ENDPOINT || "http://localhost:18583";
  const publicUrl = process.env.S3_PUBLIC_URL;
  if (!publicUrl || publicUrl === internal) {
    return { ok: true, detail: "S3_PUBLIC_URL 未設定（内部URL使用）" };
  }
  const r = await checkHttp(`${publicUrl.replace(/\/$/, "")}/minio/health/live`);
  return r.ok
    ? { ok: true, detail: `公開URL到達可: ${publicUrl}` }
    : { ok: false, detail: `${publicUrl} にクライアントから到達できません` };
}

async function checkTailscale(): Promise<CheckResult> {
  const { ok, out } = await runCmd("tailscale status 2>/dev/null");
  if (!ok) return { ok: false, detail: "tailscale コマンドなし / 未接続" };
  const connected = /(Active|running|Connected)/i.test(out) || out.length > 10;
  return { ok: true, detail: connected ? "接続中" : "要手動確認（tailscale status）" };
}

function checkEnvVars(): CheckResult[] {
  const results: CheckResult[] = [];
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  const syncWsUrl = process.env.NEXT_PUBLIC_SYNC_WS_URL;

  results.push({
    ok: !!nextAuthUrl?.trim(),
    detail: nextAuthUrl ? `${nextAuthUrl}` : "NEXTAUTH_URL 未設定",
  });

  results.push({
    ok: !!syncWsUrl?.trim(),
    detail: syncWsUrl ? `${syncWsUrl}` : "NEXT_PUBLIC_SYNC_WS_URL 未設定",
  });

  const nextHttps = nextAuthUrl?.includes("https");
  const wsSecure = syncWsUrl?.startsWith("wss");
  const protoMatch = !nextHttps || wsSecure || (syncWsUrl?.includes("localhost") ?? false);
  results.push({
    ok: protoMatch,
    detail: protoMatch ? "プロトコル整合" : "本番でHTTPS運用時はWSS必須",
  });

  return results;
}

async function checkDiskSpace(): Promise<CheckResult> {
  const { ok, out } = await runCmd("df -h . 2>/dev/null | tail -1");
  if (!ok || !out) return { ok: true, detail: "(取得不可)" };
  const parts = out.split(/\s+/);
  const avail = parts[3] ?? "?"; // 4th column = Avail
  const pct = parts[4] ?? ""; // 5th = Use%
  const used = parseInt(pct, 10) || 0;
  return { ok: used < 95, detail: `空き ${avail} / 使用率 ${pct}` };
}

// --- メイン ---

function line(ok: boolean, label: string, detail: string) {
  const icon = ok ? "✅" : "❌";
  console.log(`  ${icon} ${label.padEnd(20)} ${detail}`);
}

async function main() {
  console.log("\n📋 インフラ確認（INFRA-CHECKLIST 自動チェック）");
  console.log("─".repeat(60));

  console.log("\n【認証・セッション】");
  const nextAuth = process.env.NEXTAUTH_URL;
  line(!!nextAuth, "NEXTAUTH_URL", nextAuth || "未設定");
  console.log("  ⚪ OAuth callback URL ... Discord Portal で手動確認");
  console.log("  ⚪ Cookie SameSite/Secure ... ブラウザで手動確認");

  console.log("\n【同期 Yjs / WebSocket】");
  const sync = await checkSyncServer();
  line(sync.ok, "sync-server", sync.detail);
  const syncWs = process.env.NEXT_PUBLIC_SYNC_WS_URL;
  line(!!syncWs, "NEXT_PUBLIC_SYNC_WS_URL", syncWs || "未設定");
  console.log("  ⚪ プロキシ WebSocket 設定 ... 本番環境で手動確認");

  console.log("\n【ストレージ S3/MinIO】");
  const minio = await checkMinio();
  line(minio.ok, "MinIO 接続", minio.detail);
  const s3pub = await checkS3PublicUrl();
  line(s3pub.ok, "S3_PUBLIC_URL", s3pub.detail);
  console.log("  ⚪ Presigned URL 権限 ... アップロードで動作確認");

  console.log("\n【ネットワーク】");
  const ts = await checkTailscale();
  line(ts.ok, "Tailscale", ts.detail);
  console.log("  ⚪ ポート開放 ... 環境に応じて手動確認");

  console.log("\n【データベース PostgreSQL】");
  const db = await checkDb();
  line(db.ok, "接続・スキーマ", db.detail);

  console.log("\n【Next.js】");
  const next = await checkNextjs();
  line(next.ok, "Next.js 起動", next.detail);

  console.log("\n【リソース】");
  const disk = await checkDiskSpace();
  line(disk.ok, "ディスク空き", disk.detail);

  const envResults = checkEnvVars();
  console.log("\n【環境変数】");
  line(envResults[0].ok, "NEXTAUTH_URL", envResults[0].detail);
  line(envResults[1].ok, "NEXT_PUBLIC_SYNC_WS_URL", envResults[1].detail);
  line(envResults[2].ok, "プロトコル整合", envResults[2].detail);

  console.log("\n" + "─".repeat(60));
  const allOk = db.ok && minio.ok && sync.ok && next.ok;
  if (allOk) {
    console.log("✅ 主要サービスは起動しています。詳細は docs/user/INFRA-CHECKLIST.md");
  } else {
    console.log("⚠️  一部エラーがあります。上記を確認してください。");
    process.exit(1);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
