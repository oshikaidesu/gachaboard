"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AuthTroubleshooting } from "@/app/components/auth/AuthTroubleshooting";

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/workspaces";

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-3xl">ログイン</h1>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Discord でログインしてください。
        </p>

        <button
          type="button"
          onClick={() => signIn("discord", { callbackUrl })}
          className="min-h-[44px] w-full max-w-xs rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:active:bg-indigo-700"
        >
          Sign in with Discord
        </button>

        {error && (
          <div className="w-full space-y-4 text-left">
            <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
              ログイン中にエラーが発生しました。以下を確認してください。
            </p>
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
              エラー: {error}
            </p>
            <div className="text-left">
              <AuthTroubleshooting />
            </div>
          </div>
        )}

        <Link
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
          href="/"
        >
          ← トップに戻る
        </Link>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4">
          <p className="text-zinc-500 dark:text-zinc-400">読み込み中...</p>
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
