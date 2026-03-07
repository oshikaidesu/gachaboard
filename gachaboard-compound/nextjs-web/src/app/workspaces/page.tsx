import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import WorkspacesClient from "./WorkspacesClient";

export default async function WorkspacesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  if (env.SERVER_OWNER_DISCORD_ID.trim() && !env.E2E_TEST_MODE) {
    const discordId = (session.user as { discordId?: string }).discordId;
    if (discordId !== env.SERVER_OWNER_DISCORD_ID) {
      redirect("/access-denied?reason=workspaces");
    }
  }

  return <WorkspacesClient currentUserId={session.user.id} />;
}
