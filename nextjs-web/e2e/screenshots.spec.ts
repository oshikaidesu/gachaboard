/**
 * ドキュメント用スクリーンショット取得
 *
 * 実行: npm run e2e:server でサーバ起動後、
 *       E2E_BASE_URL=http://localhost:3010 npx playwright test e2e/screenshots.spec.ts
 *
 * 出力: ../docs/images/*.png
 */
import { test } from "@playwright/test";

const OUT_DIR = "../docs/images";

test.describe("ドキュメント用スクリーンショット", () => {
  test("01 トップページ（未ログイン）", async ({ page, baseURL }) => {
    await page.goto(baseURL ?? "http://localhost:3010", {
      waitUntil: "domcontentloaded",
    });
    await page.screenshot({
      path: `${OUT_DIR}/01-top.png`,
      fullPage: true,
    });
  });

  test("02 サインイン", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/auth/signin`, {
      waitUntil: "domcontentloaded",
    });
    await page.screenshot({
      path: `${OUT_DIR}/02-signin.png`,
      fullPage: true,
    });
  });

  test("03 ボード編集画面", async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({
      "x-e2e-user-id": "__e2e_user__",
      "x-e2e-user-name": "ScreenshotUser",
    });
    const url = `${baseURL}/board/e2e-screenshot?testUserId=__e2e_user__&testUserName=ScreenshotUser`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=← 戻る", { timeout: 30_000 });
    // キャンバスが描画されるまで少し待つ
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${OUT_DIR}/03-board.png`,
      fullPage: false,
    });
  });

  test("04 ワークスペース一覧", async ({ page, baseURL }) => {
    await page.route("**/api/**", (route) => {
      const headers = { ...route.request().headers(), "x-e2e-user-id": "__e2e_user__", "x-e2e-user-name": "E2E Screenshot User" };
      route.continue({ headers });
    });
    await page.setExtraHTTPHeaders({
      "x-e2e-user-id": "__e2e_user__",
      "x-e2e-user-name": "E2E Screenshot User",
    });
    const url = `${baseURL}/workspaces?testUserId=__e2e_user__&testUserName=E2E%20Screenshot%20User`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=ワークスペース", { timeout: 10_000 });
    await page.waitForSelector("text=スクリーンショット用ワークスペース", { timeout: 30_000 });
    await page.screenshot({
      path: `${OUT_DIR}/04-workspaces.png`,
      fullPage: true,
    });
  });

  test("05 ワークスペース詳細（ボード一覧）", async ({ page, baseURL }) => {
    await page.route("**/api/**", (route) => {
      const headers = { ...route.request().headers(), "x-e2e-user-id": "__e2e_user__", "x-e2e-user-name": "E2E Screenshot User" };
      route.continue({ headers });
    });
    await page.setExtraHTTPHeaders({
      "x-e2e-user-id": "__e2e_user__",
      "x-e2e-user-name": "E2E Screenshot User",
    });
    const url = `${baseURL}/workspace/__e2e_workspace__?testUserId=__e2e_user__&testUserName=E2E%20Screenshot%20User`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=サンプルボード", { timeout: 30_000 });
    await page.screenshot({
      path: `${OUT_DIR}/05-workspace-detail.png`,
      fullPage: true,
    });
  });
});
