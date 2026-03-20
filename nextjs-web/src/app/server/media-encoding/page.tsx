import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import MediaEncodingClient from "./MediaEncodingClient";

export default async function MediaEncodingPage() {
  if (env.E2E_TEST_MODE) {
    redirect("/workspaces");
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const discordId = (session.user as { discordId?: string }).discordId;
  const ownerId = env.SERVER_OWNER_DISCORD_ID.trim();
  if (ownerId && discordId !== ownerId) {
    redirect("/access-denied?reason=workspaces");
  }

  return <MediaEncodingClient />;
}
