import Link from "next/link";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "./components/auth/SignInButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 bg-background p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold dark:text-zinc-100">Gachaboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          音楽・映像・デザインファイルを貼り付けて、みんなで一緒に使えるホワイトボード。
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
        {session?.user ? (
          <div className="space-y-3">
            <p className="text-sm dark:text-zinc-300">
              ログイン中: <strong>{session.user.name}</strong>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              User ID: {session.user.id} / Discord ID: {session.user.discordId}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900 hover:dark:bg-zinc-200" href="/workspaces">
                ワークスペースへ
              </Link>
              <a className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800" href="/api/auth/signout">
                サインアウト
              </a>
            </div>
          </div>
        ) : (
          <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">読み込み中...</p>}>
            <SignInButton />
          </Suspense>
        )}
      </section>
    </main>
  );
}
