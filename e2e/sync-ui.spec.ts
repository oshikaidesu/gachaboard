import { expect, test } from "@playwright/test";

function buildBoardUrl(boardId: string, userId: string, userName: string) {
  const params = new URLSearchParams({
    e2e: "1",
    testUserId: userId,
    testUserName: userName,
  });
  return `/board/${boardId}?${params.toString()}`;
}

test("2ユーザーでヘッダー表示と同期が成立する", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");

  const boardId = `e2e-board-${Date.now()}`;
  const userAName = "UserA";
  const userBName = "UserB";

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const urlA = new URL(buildBoardUrl(boardId, "e2e-user-a", userAName), baseURL).toString();
  const urlB = new URL(buildBoardUrl(boardId, "e2e-user-b", userBName), baseURL).toString();

  await pageA.goto(urlA, { waitUntil: "domcontentloaded" });
  await pageB.goto(urlB, { waitUntil: "domcontentloaded" });

  await expect(pageA.getByText("Board:")).toBeVisible();
  await expect(pageB.getByText("Board:")).toBeVisible();
  await expect(pageA.getByText("同期中")).toBeVisible();
  await expect(pageB.getByText("同期中")).toBeVisible();

  const shapeId = await pageA.evaluate(() => {
    const editor = (window as unknown as { __E2E_TLDRAW_EDITOR__?: any }).__E2E_TLDRAW_EDITOR__;
    if (!editor) throw new Error("E2E editor is not mounted");
    const beforeIds = new Set<string>(editor.getCurrentPageShapes().map((s: { id: string }) => s.id));
    editor.createShape({
      type: "geo",
      x: 240,
      y: 180,
      props: { w: 180, h: 120, geo: "rectangle" },
    });
    const created = editor
      .getCurrentPageShapes()
      .find((s: { id: string; type: string }) => s.type === "geo" && !beforeIds.has(s.id));
    if (!created) throw new Error("Failed to create geo shape");
    return created.id;
  });

  await pageB.waitForFunction(
    (id) => {
      const editor = (window as unknown as { __E2E_TLDRAW_EDITOR__?: any }).__E2E_TLDRAW_EDITOR__;
      if (!editor) return false;
      return Boolean(editor.getShape(id));
    },
    shapeId,
    { timeout: 15_000 }
  );

  await pageA.mouse.move(360, 320);
  await pageA.mouse.move(500, 360);
  await expect(pageB.getByText(userAName)).toBeVisible({ timeout: 15_000 });

  await contextA.close();
  await contextB.close();
});
