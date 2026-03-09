/**
 * 各サーバの起動確認。seed または screenshots 実行前に呼ぶ。
 *
 * 実行: npx tsx scripts/check-servers.ts <seed|screenshots>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const E2E_URL = "http://localhost:3010";
const MINIO_HEALTH = "http://localhost:9000/minio/health/live";

async function checkDb(): Promise<boolean> {
  try {
    const { db } = await import("../src/lib/db");
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    console.error("❌ PostgreSQL に接続できません。docker compose up -d で起動してください。");
    console.error("   ", e instanceof Error ? e.message : e);
    return false;
  }
}

async function checkMinio(): Promise<boolean> {
  try {
    const res = await fetch(MINIO_HEALTH, { method: "GET", signal: AbortSignal.timeout(5000) });
    if (res.ok) return true;
  } catch {
    // ignore
  }
  console.warn("⚠️  MinIO に接続できません。S3 アセットのシードはスキップされます。");
  console.warn("   docker compose up -d で MinIO を起動してください。");
  return false;
}

async function checkE2eServer(): Promise<boolean> {
  try {
    const res = await fetch(E2E_URL, { method: "GET", signal: AbortSignal.timeout(5000) });
    if (res.ok || res.status === 307 || res.status === 302) return true;
  } catch {
    // ignore
  }
  console.error("❌ E2E サーバに接続できません。");
  console.error(`   ${E2E_URL} で npm run e2e:server を起動してください。`);
  return false;
}

async function main() {
  const mode = process.argv[2] ?? "";
  if (mode !== "seed" && mode !== "screenshots") {
    console.error("使い方: npx tsx scripts/check-servers.ts <seed|screenshots>");
    process.exit(1);
  }

  if (mode === "seed") {
    const dbOk = await checkDb();
    if (!dbOk) process.exit(1);
    await checkMinio(); // 警告のみ、失敗しても続行
    console.log("✅ シード実行の準備ができています");
    return;
  }

  if (mode === "screenshots") {
    const e2eOk = await checkE2eServer();
    if (!e2eOk) process.exit(1);
    console.log("✅ スクリーンショット実行の準備ができています");
    return;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
