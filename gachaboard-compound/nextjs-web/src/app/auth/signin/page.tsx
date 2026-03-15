import { Suspense } from "react";
import { env } from "@/lib/env";
import { SignInContent } from "./SignInContent";

export default function SignInPage() {
  const discordCallbackUrl = `${env.NEXTAUTH_URL.replace(/\/$/, "")}/api/auth/callback/discord`;

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4">
          <p className="text-zinc-500 dark:text-zinc-400">読み込み中...</p>
        </main>
      }
    >
      <SignInContent discordCallbackUrl={discordCallbackUrl} />
    </Suspense>
  );
}
