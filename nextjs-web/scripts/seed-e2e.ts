/**
 * E2E スクリーンショット用シードデータ
 *
 * 実行: cd nextjs-web && npm run seed:e2e
 * 前提: .env.local に DATABASE_URL、prisma db push 済み
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const E2E_USER_ID = "__e2e_user__";
const E2E_WORKSPACE_ID = "__e2e_workspace__";
const E2E_BOARD_ID = "e2e-screenshot";
/** E2E 招待フロー用。inviteTokenSchema 準拠（32-64 文字） */
const E2E_INVITE_TOKEN = "e2e_invite_token_0123456789abcdef012345";

async function main() {
  const { db } = await import("../src/lib/db");
  await db.user.upsert({
    where: { id: E2E_USER_ID },
    create: {
      id: E2E_USER_ID,
      discordId: "__e2e_seed__",
      discordName: "E2E Screenshot User",
    },
    update: { discordName: "E2E Screenshot User" },
  });

  await db.workspace.upsert({
    where: { id: E2E_WORKSPACE_ID },
    create: {
      id: E2E_WORKSPACE_ID,
      ownerUserId: E2E_USER_ID,
      name: "スクリーンショット用ワークスペース",
      description: "ドキュメント用のサンプルデータ",
      inviteToken: E2E_INVITE_TOKEN,
    },
    update: {
      name: "スクリーンショット用ワークスペース",
      description: "ドキュメント用のサンプルデータ",
      inviteToken: E2E_INVITE_TOKEN,
    },
  });

  await db.board.upsert({
    where: { id: E2E_BOARD_ID },
    create: {
      id: E2E_BOARD_ID,
      workspaceId: E2E_WORKSPACE_ID,
      name: "サンプルボード",
    },
    update: {
      name: "サンプルボード",
      workspaceId: E2E_WORKSPACE_ID,
    },
  });

  const { seedE2EAssets } = await import("./seed-e2e-assets");
  const seededAssets = await seedE2EAssets(db);
  if (seededAssets.length > 0) {
    console.log("E2E seed completed: User, Workspace, Board, サンプルアセット（動画・音声・画像・ファイルアイコン）");
  } else {
    console.log("E2E seed completed: User, Workspace, Board (S3 未設定のためアセットはスキップ)");
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
