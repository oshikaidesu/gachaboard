import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import InviteClient from "./InviteClient";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  if (env.E2E_TEST_MODE) {
    const h = await headers();
    if (h.get("x-e2e-user-id")) {
      return <InviteClient token={token} />;
    }
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return <InviteClient token={token} />;
}
