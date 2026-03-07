import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import WorkspacesClient from "./WorkspacesClient";

export default async function WorkspacesPage() {
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id ?? "";

  return <WorkspacesClient currentUserId={currentUserId} />;
}
