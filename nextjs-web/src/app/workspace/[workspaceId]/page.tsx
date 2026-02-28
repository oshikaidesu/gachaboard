import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import WorkspaceDetailClient from "./WorkspaceDetailClient";

type Props = { params: Promise<{ workspaceId: string }> };

export default async function WorkspacePage({ params }: Props) {
  const { workspaceId } = await params;
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id ?? "";

  return <WorkspaceDetailClient workspaceId={workspaceId} currentUserId={currentUserId} />;
}
