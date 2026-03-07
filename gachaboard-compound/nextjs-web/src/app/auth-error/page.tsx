import Link from "next/link";
import { AuthTroubleshooting } from "@/app/components/auth/AuthTroubleshooting";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function AuthErrorPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400">ログインエラー</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Discord ログイン中にエラーが発生しました。以下を確認してください。
      </p>

      <AuthTroubleshooting />

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          エラー: {error}
        </p>
      )}
      <div className="flex gap-3">
        <Link className="inline-flex rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600" href="/auth/signin">
          ログインを再試行
        </Link>
        <Link className="inline-flex rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800" href="/">
          トップに戻る
        </Link>
      </div>
    </main>
  );
}
