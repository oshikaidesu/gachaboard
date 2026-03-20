import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import WorkspacesClient from "./WorkspacesClient";

type Props = { searchParams: Promise<{ testUserId?: string; testUserName?: string }> };

export default async function WorkspacesPage({ searchParams }: Props) {
  const params = await searchParams;
  const isE2eMode = env.E2E_TEST_MODE;
  const testUserId = params.testUserId?.trim();
  const testUserName = params.testUserName?.trim();

  if (isE2eMode && testUserId && testUserName) {
    return (
      <WorkspacesClient
        currentUserId={testUserId}
        e2eHeaders={{ userId: testUserId, userName: testUserName }}
        showServerMediaLink={false}
      />
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  if (env.SERVER_OWNER_DISCORD_ID.trim() && !env.E2E_TEST_MODE) {
    const discordId = (session.user as { discordId?: string }).discordId;
    if (discordId !== env.SERVER_OWNER_DISCORD_ID) {
      redirect("/access-denied?reason=workspaces");
    }
  }

  return <WorkspacesClient currentUserId={session.user.id} showServerMediaLink />;
}
