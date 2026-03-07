import Link from "next/link";
import { AuthTroubleshooting } from "@/app/components/auth/AuthTroubleshooting";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function AuthErrorPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 sm:text-3xl">
          ログインエラー
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Discord ログイン中にエラーが発生しました。以下を確認してください。
        </p>

        <div className="w-full text-left">
          <AuthTroubleshooting />
        </div>

        {error && (
          <p className="w-full rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            エラー: {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="min-h-[44px] rounded-lg bg-indigo-600 px-6 py-3 text-center text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            href="/auth/signin"
          >
            ログインを再試行
          </Link>
          <Link
            className="min-h-[44px] rounded-lg border border-zinc-300 px-6 py-3 text-center text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            href="/"
          >
            トップに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
