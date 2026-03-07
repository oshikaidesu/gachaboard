import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertWorkspaceAccess } from "@/lib/authz";
import WorkspaceDetailClient from "./WorkspaceDetailClient";

type Props = { params: Promise<{ workspaceId: string }> };

export default async function WorkspacePage({ params }: Props) {
  const { workspaceId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/?callbackUrl=${encodeURIComponent(`/workspace/${workspaceId}`)}`);

  const ctx = await assertWorkspaceAccess(workspaceId);
  if (!ctx) redirect("/access-denied");

  return <WorkspaceDetailClient workspaceId={workspaceId} currentUserId={session.user.id} />;
}
