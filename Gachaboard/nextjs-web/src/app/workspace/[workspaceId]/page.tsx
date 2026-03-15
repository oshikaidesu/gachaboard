import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertWorkspaceAccess } from "@/lib/authz";
import { env } from "@/lib/env";
import WorkspaceDetailClient from "./WorkspaceDetailClient";

type Props = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ testUserId?: string; testUserName?: string }>;
};

export default async function WorkspacePage({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const query = await searchParams;
  const isE2eMode = env.E2E_TEST_MODE;
  const testUserId = query.testUserId?.trim();
  const testUserName = query.testUserName?.trim();

  if (isE2eMode && testUserId && testUserName) {
    return (
      <WorkspaceDetailClient
        workspaceId={workspaceId}
        currentUserId={testUserId}
        e2eHeaders={{ userId: testUserId, userName: testUserName }}
      />
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/?callbackUrl=${encodeURIComponent(`/workspace/${workspaceId}`)}`);

  const ctx = await assertWorkspaceAccess(workspaceId);
  if (!ctx) redirect("/access-denied");

  return <WorkspaceDetailClient workspaceId={workspaceId} currentUserId={session.user.id} />;
}
