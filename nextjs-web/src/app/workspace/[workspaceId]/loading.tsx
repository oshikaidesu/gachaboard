/**
 * ワークスペースページ読み込み中の即時表示用。
 * 「戻る」クリック後、サーバー応答を待つ間の体感を良くする。
 */
export default function WorkspaceLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-background bg-grid-subtle">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-[#25292e]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-600" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-600" />
            <div className="h-7 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-600" />
          </div>
          <div className="mt-3 h-4 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">読み込み中...</p>
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 w-full max-w-[280px] animate-pulse rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/50"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
