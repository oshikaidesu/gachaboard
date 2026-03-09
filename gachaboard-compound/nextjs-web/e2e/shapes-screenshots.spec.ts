/**
 * 各シェイプのスクリーンショット取得（ドキュメント・OGP用）
 *
 * 実行: npm run e2e:server でサーバ起動後、
 *       E2E_BASE_URL=http://localhost:3010 npx playwright test e2e/shapes-screenshots.spec.ts
 *
 * 出力: ../docs/images/shapes/*.png
 *
 * シェイプはキャンバス内の座標で配置されているため、キャンバスをスクリーンショットして
 * シードの配置順（video, audio, image, text-file, file-icon）に従いクリップで切り出す。
 */
import { test } from "@playwright/test";

const OUT_DIR = "../docs/images/shapes";
const BOARD_URL = "/board/e2e-screenshot?testUserId=__e2e_user__&testUserName=ScreenshotUser";

/** シードの配置に基づくクリップ領域（キャンバス座標、zoom=1 想定）。ピクセルは概算。 */
const SHAPE_CLIPS: { filename: string; x: number; y: number; w: number; h: number }[] = [
  { filename: "shape-video.png", x: 60, y: 60, w: 500, h: 320 },
  { filename: "shape-audio.png", x: 580, y: 60, w: 580, h: 280 },
  { filename: "shape-image.png", x: 1180, y: 60, w: 360, h: 280 },
  { filename: "shape-text-file.png", x: 60, y: 360, w: 360, h: 240 },
  { filename: "shape-file-icon.png", x: 440, y: 360, w: 120, h: 140 },
];

test.describe.serial("シェイプ別スクリーンショット", () => {
  test("ボードから各シェイプをクリップ", async ({ page, baseURL }) => {
    const url = `${baseURL}${BOARD_URL}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=← 戻る", { timeout: 15_000 });
    await page.waitForSelector("[data-testid='canvas']", { timeout: 10_000 });
    await page.waitForTimeout(2500);

    const canvas = page.locator("[data-testid='canvas']");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    for (const clip of SHAPE_CLIPS) {
      await page.screenshot({
        path: `${OUT_DIR}/${clip.filename}`,
        clip: {
          x: box.x + clip.x,
          y: box.y + clip.y,
          width: Math.min(clip.w, box.width - clip.x),
          height: Math.min(clip.h, box.height - clip.y),
        },
      });
    }
  });
});

/** OGP 用画像（1200x630）→ public/ogp.png に出力（Next.js が静的配信） */
const OGP_OUT = "public/ogp.png";

test.describe("OGP 用スクリーンショット", () => {
  test("トップページ OGP サイズ", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto(baseURL ?? "http://localhost:3010", {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: OGP_OUT,
      fullPage: false,
    });
  });
});
