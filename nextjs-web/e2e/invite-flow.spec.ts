import { expect, test } from "@playwright/test";

/** seed-e2e.ts で設定する固定トークン（inviteTokenSchema 準拠） */
const E2E_INVITE_TOKEN = "e2e_invite_token_0123456789abcdef012345";
const E2E_WORKSPACE_ID = "__e2e_workspace__";

/**
 * 前提: npm run seed:e2e 済み、npm run test:e2e で webServer が起動
 * 招待リンク表示 → 参加 → ワークスペース表示までの接続・認可を検証
 */
test("招待ページで参加してワークスペースが表示される", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");

  await page.route("**/api/**", (route) => {
    const headers = { ...route.request().headers(), "x-e2e-user-id": "__e2e_user__", "x-e2e-user-name": "Invitee" };
    route.continue({ headers });
  });
  await page.setExtraHTTPHeaders({
    "x-e2e-user-id": "__e2e_user__",
    "x-e2e-user-name": "Invitee",
  });

  const inviteUrl = new URL(
    `/invite/${E2E_INVITE_TOKEN}?testUserId=__e2e_user__&testUserName=Invitee`,
    baseURL
  ).toString();

  await page.goto(inviteUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "参加する" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "参加する" }).click({ force: true });

  await expect(page).toHaveURL(new RegExp(`/workspace/${E2E_WORKSPACE_ID}`), { timeout: 30_000 });
  await expect(page.getByText(/スクリーンショット用ワークスペース|Board:|ボード/)).toBeVisible({
    timeout: 10_000,
  });
});
