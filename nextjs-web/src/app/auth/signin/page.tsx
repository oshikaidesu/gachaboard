import { Suspense } from "react";
import { getBaseUrl } from "@/lib/baseUrl";
import { SignInContent } from "./SignInContent";

export default async function SignInPage() {
  const discordCallbackUrl = `${await getBaseUrl()}/api/auth/callback/discord`;

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
