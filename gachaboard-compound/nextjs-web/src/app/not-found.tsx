import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200">404</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        お探しのページが見つかりませんでした。
      </p>
      <Link
        href="/"
        className="inline-flex rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
      >
        トップに戻る
      </Link>
    </main>
  );
}
