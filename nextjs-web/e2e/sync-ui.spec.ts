import { expect, test } from "@playwright/test";

function buildBoardUrl(boardId: string, userId: string, userName: string) {
  const params = new URLSearchParams({
    testUserId: userId,
    testUserName: userName,
  });
  return `/board/${boardId}?${params.toString()}`;
}

/**
 * 前提: npm run test:e2e で webServer が sync-server (port 5860) + next (port 3010) を起動する
 * 既存の next dev が動いている場合は lock 競合で失敗するため、E2E 実行前に停止すること
 * シェイプ同期の検証は Yjs の初回 sync タイミングに依存するため、環境によっては失敗する場合あり
 */
test("2ユーザーでヘッダー表示と同期が成立する", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");

  const boardId = `e2e-board-${Date.now()}`;
  const userAName = "UserA";
  const userBName = "UserB";

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.route("**/api/**", (route) => {
    const headers = { ...route.request().headers(), "x-e2e-user-id": "e2e-user-a", "x-e2e-user-name": userAName };
    route.continue({ headers });
  });
  await pageB.route("**/api/**", (route) => {
    const headers = { ...route.request().headers(), "x-e2e-user-id": "e2e-user-b", "x-e2e-user-name": userBName };
    route.continue({ headers });
  });
  await pageA.setExtraHTTPHeaders({ "x-e2e-user-id": "e2e-user-a", "x-e2e-user-name": userAName });
  await pageB.setExtraHTTPHeaders({ "x-e2e-user-id": "e2e-user-b", "x-e2e-user-name": userBName });

  const urlA = new URL(buildBoardUrl(boardId, "e2e-user-a", userAName), baseURL).toString();
  const urlB = new URL(buildBoardUrl(boardId, "e2e-user-b", userBName), baseURL).toString();

  await pageA.goto(urlA, { waitUntil: "domcontentloaded" });
  await pageB.goto(urlB, { waitUntil: "domcontentloaded" });

  await expect(pageA.getByRole("link", { name: "← 戻る" })).toBeVisible({ timeout: 30_000 });
  await expect(pageB.getByRole("link", { name: "← 戻る" })).toBeVisible({ timeout: 30_000 });
  await expect(pageA.getByText(/同期中|接続中|同期エラー|ローカル保存/)).toBeVisible({ timeout: 20_000 });
  await expect(pageB.getByText(/同期中|接続中|同期エラー|ローカル保存/)).toBeVisible({ timeout: 20_000 });

  await pageA.waitForFunction(
    () => Boolean((window as unknown as { __E2E_TLDRAW_EDITOR__?: unknown }).__E2E_TLDRAW_EDITOR__),
    { timeout: 60_000 }
  );

  const shapeId = await pageA.evaluate(() => {
    const editor = (window as unknown as { __E2E_TLDRAW_EDITOR__?: { getCurrentPageShapes: () => { id: string; type: string }[]; createShapes: (s: unknown[]) => void } }).__E2E_TLDRAW_EDITOR__;
    if (!editor) throw new Error("E2E editor is not mounted");
    const beforeIds = new Set<string>(editor.getCurrentPageShapes().map((s) => s.id));
    editor.createShapes([
      {
        type: "geo",
        x: 240,
        y: 180,
        props: { w: 180, h: 120, geo: "rectangle" },
      },
    ]);
    const created = editor
      .getCurrentPageShapes()
      .find((s) => s.type === "geo" && !beforeIds.has(s.id));
    if (!created) throw new Error("Failed to create geo shape");
    return created.id;
  });

  await pageB.waitForFunction(
    (id: string) => {
      const editor = (window as unknown as { __E2E_TLDRAW_EDITOR__?: { getShape: (id: string) => unknown } }).__E2E_TLDRAW_EDITOR__;
      if (!editor) return false;
      return Boolean(editor.getShape(id));
    },
    shapeId,
    { timeout: 30_000 }
  );

  await pageA.mouse.move(360, 320);
  await pageA.mouse.move(500, 360);
  await expect(pageB.getByText(userAName)).toBeVisible({ timeout: 15_000 });

  await contextA.close();
  await contextB.close();
});
