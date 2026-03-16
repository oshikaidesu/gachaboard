/**
 * 主要 API の接続確認（招待・ワークスペース等）
 * CI でサーバ起動後に実行し、接続面の regressions を早期検知する
 *
 * 実行: E2E_BASE_URL=http://localhost:3010 npx tsx scripts/check-connectivity.ts
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3010";

async function check(name: string, url: string, expectStatus: number | number[]) {
  const ok = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  try {
    const res = await fetch(url, { redirect: "manual" });
    const match = ok.includes(res.status);
    console.log(match ? "✓" : "✗", name, res.status, ok.includes(res.status) ? "" : `(expected ${expectStatus})`);
    return match;
  } catch (e) {
    console.log("✗", name, "error:", e instanceof Error ? e.message : e);
    return false;
  }
}

async function main() {
  let failed = 0;

  if (!(await check("GET /api/invite/dummy (invalid token)", `${BASE}/api/invite/dummy`, [400, 404]))) failed++;
  if (!(await check("GET /api/workspaces (no auth)", `${BASE}/api/workspaces`, [401, 302]))) failed++;

  if (failed > 0) {
    process.exit(1);
  }
  console.log("All connectivity checks passed.");
}

main();
