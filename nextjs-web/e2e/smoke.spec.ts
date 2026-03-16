import { expect, test } from "@playwright/test";

/**
 * 前提: npm run test:e2e で webServer が自動起動（sync-server + next）
 * 既存の next dev が動いている場合は先に停止すること
 */
test("ボードページが表示される", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");

  await page.setExtraHTTPHeaders({
    "x-e2e-user-id": "e2e-smoke",
    "x-e2e-user-name": "SmokeUser",
  });

  const boardId = `e2e-smoke-${Date.now()}`;
  const url = `${baseURL}/board/${boardId}?testUserId=e2e-smoke&testUserName=SmokeUser`;

  await page.goto(url, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("link", { name: "← 戻る" })).toBeVisible({ timeout: 30_000 });
});
