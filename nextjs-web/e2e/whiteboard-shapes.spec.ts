import { expect, test } from "@playwright/test";

function buildBoardUrl(boardId: string, userId: string, userName: string) {
  const params = new URLSearchParams({
    testUserId: userId,
    testUserName: userName,
  });
  return `/board/${boardId}?${params.toString()}`;
}

/**
 * 前提: npm run test:e2e で webServer が sync-server + next を起動
 * 単一ユーザーでシェイプ配置ができることを検証
 */
test("1ユーザーで geo シェイプを配置できる", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");

  await page.route("**/api/**", (route) => {
    const headers = { ...route.request().headers(), "x-e2e-user-id": "e2e-shapes", "x-e2e-user-name": "ShapesUser" };
    route.continue({ headers });
  });
  await page.setExtraHTTPHeaders({
    "x-e2e-user-id": "e2e-shapes",
    "x-e2e-user-name": "ShapesUser",
  });

  const boardId = `e2e-shapes-${Date.now()}`;
  const url = new URL(buildBoardUrl(boardId, "e2e-shapes", "ShapesUser"), baseURL).toString();

  await page.goto(url, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("link", { name: "← 戻る" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/同期中|接続中|同期エラー|ローカル保存/)).toBeVisible({ timeout: 20_000 });

  await page.waitForFunction(
    () => Boolean((window as unknown as { __E2E_TLDRAW_EDITOR__?: unknown }).__E2E_TLDRAW_EDITOR__),
    { timeout: 60_000 }
  );

  const shapes = await page.evaluate(() => {
    const editor = (window as unknown as {
      __E2E_TLDRAW_EDITOR__?: {
        getCurrentPageShapes: () => { id: string; type: string }[];
        createShapes: (s: unknown[]) => void;
      };
    }).__E2E_TLDRAW_EDITOR__;
    if (!editor) throw new Error("E2E editor is not mounted");
    const beforeIds = new Set<string>(editor.getCurrentPageShapes().map((s) => s.id));
    editor.createShapes([
      { type: "geo", x: 100, y: 100, props: { w: 120, h: 80, geo: "rectangle" } },
      { type: "geo", x: 280, y: 100, props: { w: 100, h: 100, geo: "ellipse" } },
    ]);
    return editor
      .getCurrentPageShapes()
      .filter((s) => !beforeIds.has(s.id))
      .map((s) => ({ id: s.id, type: s.type }));
  });

  expect(shapes).toHaveLength(2);
  expect(shapes.map((s) => s.type)).toEqual(expect.arrayContaining(["geo", "geo"]));
});

/**
 * geo テキスト編集は作成者のみ可能（SmartHandTool の createdById 制限）
 * ユーザー A が geo 作成 → ユーザー B がダブルクリック → 編集モードにならない
 * ユーザー A がダブルクリック → 編集モードになる
 */
test("geo シェイプは作成者のみダブルクリックで編集モードに入れる", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");

  const boardId = `e2e-geo-edit-${Date.now()}`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.route("**/api/**", (route) => {
    const headers = { ...route.request().headers(), "x-e2e-user-id": "e2e-user-a", "x-e2e-user-name": "UserA" };
    route.continue({ headers });
  });
  await pageB.route("**/api/**", (route) => {
    const headers = { ...route.request().headers(), "x-e2e-user-id": "e2e-user-b", "x-e2e-user-name": "UserB" };
    route.continue({ headers });
  });
  await pageA.setExtraHTTPHeaders({ "x-e2e-user-id": "e2e-user-a", "x-e2e-user-name": "UserA" });
  await pageB.setExtraHTTPHeaders({ "x-e2e-user-id": "e2e-user-b", "x-e2e-user-name": "UserB" });

  const urlA = new URL(buildBoardUrl(boardId, "e2e-user-a", "UserA"), baseURL).toString();
  const urlB = new URL(buildBoardUrl(boardId, "e2e-user-b", "UserB"), baseURL).toString();

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

  const { shapeId, centerX, centerY } = await pageA.evaluate(() => {
    const editor = (window as unknown as {
      __E2E_TLDRAW_EDITOR__?: {
        getCurrentPageShapes: () => { id: string; type: string }[];
        createShapes: (s: unknown[]) => void;
      };
    }).__E2E_TLDRAW_EDITOR__;
    if (!editor) throw new Error("E2E editor is not mounted");
    const beforeIds = new Set<string>(editor.getCurrentPageShapes().map((s) => s.id));
    editor.createShapes([
      { type: "geo", x: 300, y: 250, props: { w: 160, h: 100, geo: "rectangle" } },
    ]);
    const created = editor
      .getCurrentPageShapes()
      .find((s) => s.type === "geo" && !beforeIds.has(s.id));
    if (!created) throw new Error("Failed to create geo shape");
    return { shapeId: created.id, centerX: 380, centerY: 300 };
  });

  await pageB.waitForFunction(
    (id: string) => {
      const editor = (window as unknown as { __E2E_TLDRAW_EDITOR__?: { getShape: (id: string) => unknown } })
        .__E2E_TLDRAW_EDITOR__;
      if (!editor) return false;
      return Boolean(editor.getShape(id));
    },
    shapeId,
    { timeout: 30_000 }
  );

  await pageB.mouse.dblclick(centerX, centerY);
  await pageB.waitForTimeout(300);

  const editingAfterB = await pageB.evaluate(() => {
    const editor = (window as unknown as { __E2E_TLDRAW_EDITOR__?: { getEditingShapeId: () => string | null } })
      .__E2E_TLDRAW_EDITOR__;
    return editor?.getEditingShapeId() ?? null;
  });
  expect(editingAfterB).toBeNull();

  await pageA.mouse.dblclick(centerX, centerY);
  await pageA.waitForTimeout(300);

  const editingAfterA = await pageA.evaluate(
    (id: string) => {
      const editor = (window as unknown as { __E2E_TLDRAW_EDITOR__?: { getEditingShapeId: () => string | null } })
        .__E2E_TLDRAW_EDITOR__;
      return editor?.getEditingShapeId() === id;
    },
    shapeId
  );
  expect(editingAfterA).toBe(true);

  await contextA.close();
  await contextB.close();
});
