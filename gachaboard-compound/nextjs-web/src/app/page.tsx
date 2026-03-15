import Link from "next/link";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "./components/auth/SignInButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <header className="space-y-3">
          <h1 className="flex items-center justify-center gap-3 text-3xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={48} height={48} className="shrink-0" />
            Gachaboard
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            音楽・映像・デザインファイルを貼り付けて、みんなで一緒に使えるホワイトボード。
          </p>
        </header>

        <section className="w-full rounded-xl border border-zinc-200 p-6 dark:border-zinc-700 dark:bg-zinc-900/50">
          {session?.user ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                ログイン中: <strong>{session.user.name}</strong>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 break-all">
                User ID: {session.user.id}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                <Link
                  className="min-h-[44px] rounded-lg bg-zinc-900 px-6 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  href="/workspaces"
                >
                  ワークスペースへ
                </Link>
                <a
                  className="min-h-[44px] rounded-lg border border-zinc-300 px-6 py-3 text-center text-sm dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  href="/api/auth/signout"
                >
                  サインアウト
                </a>
              </div>
            </div>
          ) : (
            <Suspense
              fallback={
                <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                  読み込み中...
                </p>
              }
            >
              <SignInButton />
            </Suspense>
          )}
        </section>
      </div>
    </main>
  );
}
