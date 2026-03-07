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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-8">
      <h1 className="text-2xl font-semibold dark:text-zinc-100">ログイン</h1>

      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Discord でログインしてください。
        </p>
        <button
          type="button"
          onClick={() => signIn("discord", { callbackUrl })}
          className="inline-flex rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          Sign in with Discord
        </button>
      </div>

      {error && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            ログイン中にエラーが発生しました。以下を確認してください。
          </p>
          <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            エラー: {error}
          </p>
          <AuthTroubleshooting />
        </div>
      )}

      <Link className="inline-flex w-fit text-sm text-zinc-500 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300" href="/">
        ← トップに戻る
      </Link>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-8"><p className="text-zinc-500 dark:text-zinc-400">読み込み中...</p></main>}>
      <SignInContent />
    </Suspense>
  );
}
